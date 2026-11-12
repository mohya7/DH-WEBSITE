using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DigitalHub.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DigitalHub.Api.Tests;

/// <summary>
/// ADM-10: a settings save that leaves out the default share image keeps it. Before
/// the fix, the Studio form never sent the field and the API copied the missing value
/// over the stored one as null. G-1 and G-2 (found with ADM-10, not in the audit): an
/// unknown media id and an alt override over 300 characters are refused with 400,
/// where they were a 500.
///
/// Each test seeds its own media row and, in finally, clears both share image fields
/// and deletes that row directly in the database, so the shared settings row never
/// points at an image another test cannot delete (MediaUsage counts the settings row).
/// </summary>
[Collection("SqlServer")]
public sealed class SettingsShareImageTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    private readonly HttpClient _client;

    public SettingsShareImageTests(ApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task A_save_without_the_share_image_fields_keeps_them()
    {
        var admin = await AdminAsync();
        var media = await SeedMediaAsync("t1");
        try
        {
            var first = await PutAsync(admin, new { version = (await ReadAsync(admin)).GetProperty("version").GetInt32(), defaultShareImageId = media, defaultShareImageAltOverride = "Logo" });
            Assert.Equal(HttpStatusCode.OK, first.Status);

            var second = await PutAsync(admin, new { version = VersionOf(first.Body), email = "adm10-keep@digitalhub.test" });
            Assert.Equal(HttpStatusCode.OK, second.Status);

            var after = await ReadAsync(admin);
            Assert.Equal(media, ShareImageId(after));
            Assert.Equal("Logo", after.GetProperty("defaultShareImageAltOverride").GetString());
            Assert.Equal("adm10-keep@digitalhub.test", after.GetProperty("email").GetString());
        }
        finally
        {
            await CleanUpAsync(media);
        }
    }

    [Fact]
    public async Task An_explicit_null_clears_the_share_image_and_its_alt()
    {
        var admin = await AdminAsync();
        var media = await SeedMediaAsync("t2");
        try
        {
            var set = await PutAsync(admin, new { version = (await ReadAsync(admin)).GetProperty("version").GetInt32(), defaultShareImageId = media, defaultShareImageAltOverride = "Logo" });
            Assert.Equal(HttpStatusCode.OK, set.Status);

            var cleared = await PutAsync(admin, new { version = VersionOf(set.Body), defaultShareImageId = (Guid?)null, defaultShareImageAltOverride = (string?)null });
            Assert.Equal(HttpStatusCode.OK, cleared.Status);
            var afterClear = await ReadAsync(admin);
            Assert.Equal(JsonValueKind.Null, afterClear.GetProperty("defaultShareImageId").ValueKind);
            Assert.Equal(JsonValueKind.Null, afterClear.GetProperty("defaultShareImageAltOverride").ValueKind);

            // The two fields are independent: a body with only the alt changes only the alt.
            var again = await PutAsync(admin, new { version = VersionOf(cleared.Body), defaultShareImageId = media, defaultShareImageAltOverride = "Logo" });
            Assert.Equal(HttpStatusCode.OK, again.Status);
            var altOnly = await PutAsync(admin, new { version = VersionOf(again.Body), defaultShareImageAltOverride = "Only the alt" });
            Assert.Equal(HttpStatusCode.OK, altOnly.Status);
            var afterAlt = await ReadAsync(admin);
            Assert.Equal(media, ShareImageId(afterAlt));
            Assert.Equal("Only the alt", afterAlt.GetProperty("defaultShareImageAltOverride").GetString());
        }
        finally
        {
            await CleanUpAsync(media);
        }
    }

    [Fact]
    public async Task An_unknown_media_id_is_refused_and_changes_nothing()
    {
        var admin = await AdminAsync();
        var media = await SeedMediaAsync("t3");
        try
        {
            var set = await PutAsync(admin, new { version = (await ReadAsync(admin)).GetProperty("version").GetInt32(), defaultShareImageId = media });
            Assert.Equal(HttpStatusCode.OK, set.Status);
            var version = VersionOf(set.Body);

            var unknown = await PutAsync(admin, new { version, defaultShareImageId = Guid.NewGuid() });
            Assert.Equal(HttpStatusCode.BadRequest, unknown.Status);
            Assert.Contains("defaultShareImageId", unknown.Body, StringComparison.Ordinal);

            var after = await ReadAsync(admin);
            Assert.Equal(version, after.GetProperty("version").GetInt32());
            Assert.Equal(media, ShareImageId(after));
        }
        finally
        {
            await CleanUpAsync(media);
        }
    }

    [Fact]
    public async Task An_alt_override_over_300_characters_is_refused()
    {
        var admin = await AdminAsync();
        var media = await SeedMediaAsync("t4");
        try
        {
            var atLimit = await PutAsync(admin, new { version = (await ReadAsync(admin)).GetProperty("version").GetInt32(), defaultShareImageAltOverride = new string('x', 300) });
            Assert.Equal(HttpStatusCode.OK, atLimit.Status);
            var version = VersionOf(atLimit.Body);

            var over = await PutAsync(admin, new { version, defaultShareImageAltOverride = new string('y', 301) });
            Assert.Equal(HttpStatusCode.BadRequest, over.Status);
            Assert.Contains("defaultShareImageAltOverride", over.Body, StringComparison.Ordinal);

            var after = await ReadAsync(admin);
            Assert.Equal(version, after.GetProperty("version").GetInt32());
            Assert.Equal(new string('x', 300), after.GetProperty("defaultShareImageAltOverride").GetString());
        }
        finally
        {
            await CleanUpAsync(media);
        }
    }

    [Fact]
    public async Task The_build_content_carries_the_saved_share_image()
    {
        var admin = await AdminAsync();
        var media = await SeedMediaAsync("t5");
        try
        {
            var first = await PutAsync(admin, new { version = (await ReadAsync(admin)).GetProperty("version").GetInt32(), defaultShareImageId = media, defaultShareImageAltOverride = "Logo" });
            Assert.Equal(HttpStatusCode.OK, first.Status);
            var second = await PutAsync(admin, new { version = VersionOf(first.Body), email = "adm10-build@digitalhub.test" });
            Assert.Equal(HttpStatusCode.OK, second.Status);

            var build = await BuildSettingsAsync();
            Assert.Equal(media, ShareImageId(build));
        }
        finally
        {
            await CleanUpAsync(media);
        }
    }

    private static Guid? ShareImageId(JsonElement settings)
    {
        var value = settings.GetProperty("defaultShareImageId");
        return value.ValueKind == JsonValueKind.Null ? null : value.GetGuid();
    }

    private static int VersionOf(string body) => JsonDocument.Parse(body).RootElement.GetProperty("version").GetInt32();

    private async Task<Guid> SeedMediaAsync(string name)
    {
        var asset = new MediaAsset
        {
            Id = Guid.NewGuid(),
            Path = "/media/" + Guid.NewGuid().ToString("N") + ".webp",
            OriginalName = "adm10-" + name + ".webp",
            ContentType = "image/webp",
            GeneratedSizes = "[]",
            ContentHash = Guid.NewGuid().ToString("N"),
            Alt = "ADM-10 " + name,
            CreatedAt = DateTime.UtcNow,
        };
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        db.Media.Add(asset);
        await db.SaveChangesAsync();
        return asset.Id;
    }

    /// <summary>Written directly, as SettingsVersionTests.SetVersionAsync writes the row, so it runs after a failed assertion too.</summary>
    private async Task CleanUpAsync(Guid media)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        await db.SiteSettings.ExecuteUpdateAsync(setters => setters
            .SetProperty(settings => settings.DefaultShareImageId, (Guid?)null)
            .SetProperty(settings => settings.DefaultShareImageAltOverride, (string?)null));
        await db.Media.Where(asset => asset.Id == media).ExecuteDeleteAsync();
    }

    private async Task<AuthSession> AdminAsync()
    {
        var admin = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        Assert.Equal(HttpStatusCode.OK, admin.Status);
        return admin;
    }

    private async Task<JsonElement> ReadAsync(AuthSession admin)
    {
        var response = await _client.SendAsync(admin.Authorized(HttpMethod.Get, "/api/v1/settings"));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.Clone();
    }

    private async Task<(HttpStatusCode Status, string Body)> PutAsync(AuthSession admin, object payload)
    {
        var request = admin.Authorized(HttpMethod.Put, "/api/v1/settings");
        request.Content = JsonContent.Create(payload);
        var response = await _client.SendAsync(request);
        return (response.StatusCode, await response.Content.ReadAsStringAsync());
    }

    private async Task<JsonElement> BuildSettingsAsync()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/build/content");
        request.Headers.TryAddWithoutValidation("X-Build-Token", ApiFactory.BuildTokenValue);
        var build = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, build.StatusCode);
        return JsonDocument.Parse(await build.Content.ReadAsStringAsync()).RootElement.GetProperty("settings").Clone();
    }
}
