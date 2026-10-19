using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DigitalHub.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DigitalHub.Api.Tests;

/// <summary>
/// Finding L8: a settings save names the version it read; a stale or missing
/// version changes nothing.
/// </summary>
[Collection("SqlServer")]
public sealed class SettingsVersionTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    private readonly HttpClient _client;

    public SettingsVersionTests(ApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task The_reviews_version_minus_one_is_refused_and_wipes_nothing()
    {
        var admin = await AdminAsync();
        var (version, _) = await SaveAsync(admin, (await ReadAsync(admin)).Version, "keep@digitalhub.test");

        var wipe = await PutAsync(admin, new { version = -1 });
        Assert.Equal(HttpStatusCode.BadRequest, wipe.Status);
        Assert.Contains("version", wipe.Body, StringComparison.Ordinal);

        var missing = await PutAsync(admin, new { email = "x@digitalhub.test" });
        Assert.Equal(HttpStatusCode.BadRequest, missing.Status);

        var after = await ReadAsync(admin);
        Assert.Equal(version, after.Version);
        Assert.Equal("keep@digitalhub.test", after.Email);
    }

    [Fact]
    public async Task A_stale_version_gets_409_and_the_newer_save_stays()
    {
        var admin = await AdminAsync();
        var read = await ReadAsync(admin);

        var first = await SaveAsync(admin, read.Version, "first-writer@digitalhub.test");
        Assert.Equal(read.Version + 1, first.Version);

        var second = await PutAsync(admin, new { version = read.Version, email = "second-writer@digitalhub.test" });
        Assert.Equal(HttpStatusCode.Conflict, second.Status);
        Assert.Equal("concurrency_conflict", JsonDocument.Parse(second.Body).RootElement.GetProperty("code").GetString());

        var after = await ReadAsync(admin);
        Assert.Equal(first.Version, after.Version);
        Assert.Equal("first-writer@digitalhub.test", after.Email);
    }

    [Fact]
    public async Task The_first_save_names_version_0_and_anything_else_conflicts()
    {
        var admin = await AdminAsync();
        await ClearSettingsAsync();

        var empty = await ReadAsync(admin);
        Assert.Equal(0, empty.Version);
        Assert.Equal(HttpStatusCode.Conflict, (await PutAsync(admin, new { version = 3, email = "x@digitalhub.test" })).Status);

        var created = await SaveAsync(admin, 0, "created@digitalhub.test");
        Assert.Equal(1, created.Version);
        Assert.Equal(HttpStatusCode.Conflict, (await PutAsync(admin, new { version = 0, email = "again@digitalhub.test" })).Status);
    }

    private async Task<AuthSession> AdminAsync()
    {
        var admin = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        Assert.Equal(HttpStatusCode.OK, admin.Status);
        return admin;
    }

    private async Task<(int Version, string? Email)> ReadAsync(AuthSession admin)
    {
        var response = await _client.SendAsync(admin.Authorized(HttpMethod.Get, "/api/v1/settings"));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        return (body.GetProperty("version").GetInt32(), body.GetProperty("email").GetString());
    }

    private async Task<(int Version, string? Email)> SaveAsync(AuthSession admin, int version, string email)
    {
        var saved = await PutAsync(admin, new { version, email });
        Assert.Equal(HttpStatusCode.OK, saved.Status);
        var body = JsonDocument.Parse(saved.Body).RootElement;
        return (body.GetProperty("version").GetInt32(), body.GetProperty("email").GetString());
    }

    private async Task<(HttpStatusCode Status, string Body)> PutAsync(AuthSession admin, object payload)
    {
        var request = admin.Authorized(HttpMethod.Put, "/api/v1/settings");
        request.Content = JsonContent.Create(payload);
        var response = await _client.SendAsync(request);
        return (response.StatusCode, await response.Content.ReadAsStringAsync());
    }

    private async Task ClearSettingsAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        db.SiteSettings.RemoveRange(await db.SiteSettings.ToListAsync());
        await db.SaveChangesAsync();
    }
}
