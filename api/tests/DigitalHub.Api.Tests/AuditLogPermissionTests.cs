using DigitalHub.Api.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DigitalHub.Api.Tests;

/// <summary>
/// Finding L6: for the application's SQL login the audit log is append-only.
/// The grants come from the setup that creates the login (CI, the e2e harness,
/// the parity tool, and docs/security-deployment.md for other catalogs), so this
/// test fails on a catalog where that DENY was not applied.
/// </summary>
[Collection("SqlServer")]
public sealed class AuditLogPermissionTests : IClassFixture<ApiFactory>
{
    private const int PermissionDenied = 229;
    private readonly ApiFactory _factory;

    public AuditLogPermissionTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task The_application_login_can_add_and_read_audit_rows_but_not_change_or_delete_them()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        var id = Guid.NewGuid();
        db.AuditLog.Add(new AuditLogEntry
        {
            Id = id,
            Action = "permission_probe",
            EntityType = "test",
            At = DateTime.UtcNow,
            Success = true,
        });
        await db.SaveChangesAsync();

        try
        {
            Assert.True(await db.AuditLog.AsNoTracking().AnyAsync(entry => entry.Id == id));

            var update = await Assert.ThrowsAsync<SqlException>(() =>
                db.AuditLog.Where(entry => entry.Id == id).ExecuteUpdateAsync(set => set.SetProperty(entry => entry.Action, "rewritten")));
            Assert.Equal(PermissionDenied, update.Number);

            var delete = await Assert.ThrowsAsync<SqlException>(() =>
                db.AuditLog.Where(entry => entry.Id == id).ExecuteDeleteAsync());
            Assert.Equal(PermissionDenied, delete.Number);

            Assert.Equal("permission_probe", (await db.AuditLog.AsNoTracking().SingleAsync(entry => entry.Id == id)).Action);
        }
        finally
        {
            await using var connection = new SqlConnection(ApiFactory.ElevatedTestConnectionString());
            await connection.OpenAsync();
            await using var command = connection.CreateCommand();
            command.CommandText = "DELETE FROM dbo.audit_log WHERE id = @id";
            command.Parameters.AddWithValue("@id", id);
            await command.ExecuteNonQueryAsync();
        }
    }
}
