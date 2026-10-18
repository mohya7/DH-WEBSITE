using System.Net;
using System.Net.Http.Json;
using DigitalHub.Api.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace DigitalHub.Api.Tests;

[Collection("SqlServer")]
public sealed class AuditRollbackTests : IClassFixture<ApiFactory>
{
    private const string TriggerName = "audit_fail_create_page_test";

    private readonly ApiFactory _factory;
    private readonly HttpClient _client;

    public AuditRollbackTests(ApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task A_write_whose_audit_entry_fails_is_rolled_back()
    {
        var slug = "audit-fail-" + Guid.NewGuid().ToString("N")[..8];
        var admin = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        Assert.Equal(HttpStatusCode.OK, admin.Status);

        await ExecuteElevatedAsync(
            $"""
            IF OBJECT_ID(N'dbo.{TriggerName}', N'TR') IS NOT NULL
                DROP TRIGGER dbo.{TriggerName};
            """);
        await ExecuteElevatedAsync(
            $"""
            CREATE TRIGGER dbo.{TriggerName} ON dbo.audit_log
            AFTER INSERT
            AS
            BEGIN
                SET NOCOUNT ON;
                IF EXISTS (SELECT 1 FROM inserted WHERE action = N'create' AND entity_type = N'page')
                    THROW 50001, N'audit_fail_test', 1;
            END
            """);

        try
        {
            var request = admin.Authorized(HttpMethod.Post, "/api/v1/pages");
            request.Content = JsonContent.Create(new { slug, title = "Must not persist" });
            var response = await _client.SendAsync(request);
            Assert.NotEqual(HttpStatusCode.Created, response.StatusCode);
            Assert.NotEqual(HttpStatusCode.OK, response.StatusCode);

            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            Assert.False(await db.Pages.AnyAsync(item => item.Slug == slug));
            Assert.False(await db.WorkingCopies.AnyAsync(copy => copy.Document.Contains(slug)));
            Assert.False(await db.AuditLog.AnyAsync(item => item.Detail != null && item.Detail.Contains(slug)));
        }
        finally
        {
            await ExecuteElevatedAsync(
                $"""
                IF OBJECT_ID(N'dbo.{TriggerName}', N'TR') IS NOT NULL
                    DROP TRIGGER dbo.{TriggerName};
                """);
        }
    }

    private static async Task ExecuteElevatedAsync(string sql)
    {
        await using var connection = new SqlConnection(ApiFactory.ElevatedTestConnectionString());
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        await command.ExecuteNonQueryAsync();
    }
}
