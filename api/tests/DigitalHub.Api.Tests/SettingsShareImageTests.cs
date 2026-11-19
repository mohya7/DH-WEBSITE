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

    /* ADM-12c: the default share image needs alt text of its own, its library alt or
       a non-blank override (AltText.Effective), whether or not the asset is decorative.
       The save checks the values it would store ("sent ? request : stored") and refuses
       a bad pair with a field error on defaultShareImageAltOverride. */

    [Fact]
    public async Task A_decorative_image_with_blank_alt_and_no_override_is_refused_and_changes_nothing()
    {
        var admin = await AdminAsync();
        var media = await SeedMediaAsync("c1", alt: "", decorative: true);
        try
        {
            var before = await ReadAsync(admin);
            var version = before.GetProperty("version").GetInt32();

            var refused = await PutAsync(admin, new { version, defaultShareImageId = media, defaultShareImageAltOverride = (string?)null });
            Assert.Equal(HttpStatusCode.BadRequest, refused.Status);
            Assert.True(HasError(refused.Body, "defaultShareImageAltOverride"), refused.Body);

            var after = await ReadAsync(admin);
            Assert.Equal(version, after.GetProperty("version").GetInt32());
            Assert.Equal(ShareImageId(before), ShareImageId(after));
        }
        finally
        {
            await CleanUpAsync(media);
        }
    }

    [Fact]
    public async Task A_whitespace_override_does_not_count_as_alt()
    {
        var admin = await AdminAsync();
        var media = await SeedMediaAsync("c2", alt: "", decorative: true);
        try
        {
            var before = await ReadAsync(admin);
            var version = before.GetProperty("version").GetInt32();

            var refused = await PutAsync(admin, new { version, defaultShareImageId = media, defaultShareImageAltOverride = "   " });
            Assert.Equal(HttpStatusCode.BadRequest, refused.Status);
            Assert.True(HasError(refused.Body, "defaultShareImageAltOverride"), refused.Body);

            var after = await ReadAsync(admin);
            Assert.Equal(version, after.GetProperty("version").GetInt32());
            Assert.Equal(ShareImageId(before), ShareImageId(after));
        }
        finally
        {
            await CleanUpAsync(media);
        }
    }

    [Fact]
    public async Task Clearing_the_stored_override_of_a_blank_alt_image_is_refused()
    {
        var admin = await AdminAsync();
        var media = await SeedMediaAsync("c3", alt: "", decorative: true);
        try
        {
            var set = await PutAsync(admin, new { version = (await ReadAsync(admin)).GetProperty("version").GetInt32(), defaultShareImageId = media, defaultShareImageAltOverride = "Logo" });
            Assert.Equal(HttpStatusCode.OK, set.Status);
            var version = VersionOf(set.Body);

            // The body leaves out the image id, so the save would keep the stored blank-alt image.
            var refused = await PutAsync(admin, new { version, defaultShareImageAltOverride = (string?)null });
            Assert.Equal(HttpStatusCode.BadRequest, refused.Status);
            Assert.True(HasError(refused.Body, "defaultShareImageAltOverride"), refused.Body);

            var after = await ReadAsync(admin);
            Assert.Equal(version, after.GetProperty("version").GetInt32());
            Assert.Equal(media, ShareImageId(after));
            Assert.Equal("Logo", after.GetProperty("defaultShareImageAltOverride").GetString());
        }
        finally
        {
            await CleanUpAsync(media);
        }
    }

    [Fact]
    public async Task A_non_decorative_image_with_blank_alt_is_refused_too()
    {
        // Only direct writes and the content import store such an asset; the rule ignores Decorative.
        var admin = await AdminAsync();
        var media = await SeedMediaAsync("c4", alt: "", decorative: false);
        try
        {
            var before = await ReadAsync(admin);
            var version = before.GetProperty("version").GetInt32();

            var refused = await PutAsync(admin, new { version, defaultShareImageId = media, defaultShareImageAltOverride = (string?)null });
            Assert.Equal(HttpStatusCode.BadRequest, refused.Status);
            Assert.True(HasError(refused.Body, "defaultShareImageAltOverride"), refused.Body);

            var after = await ReadAsync(admin);
            Assert.Equal(version, after.GetProperty("version").GetInt32());
            Assert.Equal(ShareImageId(before), ShareImageId(after));
        }
        finally
        {
            await CleanUpAsync(media);
        }
    }

    [Fact]
    public async Task A_save_without_share_fields_over_a_stored_bad_pair_is_refused()
    {
        var admin = await AdminAsync();
        var media = await SeedMediaAsync("c5", alt: "", decorative: true);
        try
        {
            // An ordinary save first, so the settings row exists whatever order the facts run in.
            var ensured = await PutAsync(admin, new { version = (await ReadAsync(admin)).GetProperty("version").GetInt32(), email = "adm12c-before@digitalhub.test" });
            Assert.Equal(HttpStatusCode.OK, ensured.Status);

            // The bad pair, as an import before this change could have stored it.
            int updated;
            await using (var scope = _factory.Services.CreateAsyncScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
                updated = await db.SiteSettings.ExecuteUpdateAsync(setters => setters
                    .SetProperty(settings => settings.DefaultShareImageId, (Guid?)media)
                    .SetProperty(settings => settings.DefaultShareImageAltOverride, (string?)null));
            }

            Assert.Equal(1, updated);

            var version = VersionOf(ensured.Body);
            var refused = await PutAsync(admin, new { version, email = "changed@example.com" });
            Assert.Equal(HttpStatusCode.BadRequest, refused.Status);
            Assert.True(HasError(refused.Body, "defaultShareImageAltOverride"), refused.Body);

            var after = await ReadAsync(admin);
            Assert.Equal(version, after.GetProperty("version").GetInt32());
            Assert.Equal("adm12c-before@digitalhub.test", after.GetProperty("email").GetString());
            Assert.Equal(media, ShareImageId(after));
            Assert.Equal(JsonValueKind.Null, after.GetProperty("defaultShareImageAltOverride").ValueKind);
        }
        finally
        {
            await CleanUpAsync(media);
        }
    }

    [Fact]
    public async Task A_blank_alt_image_with_an_override_is_accepted()
    {
        var admin = await AdminAsync();
        var media = await SeedMediaAsync("c6", alt: "", decorative: true);
        try
        {
            var saved = await PutAsync(admin, new { version = (await ReadAsync(admin)).GetProperty("version").GetInt32(), defaultShareImageId = media, defaultShareImageAltOverride = "Digital Hub logo" });
            Assert.Equal(HttpStatusCode.OK, saved.Status);

            var after = await ReadAsync(admin);
            Assert.Equal(media, ShareImageId(after));
            Assert.Equal("Digital Hub logo", after.GetProperty("defaultShareImageAltOverride").GetString());
        }
        finally
        {
            await CleanUpAsync(media);
        }
    }

    [Fact]
    public async Task Choosing_a_blank_alt_image_keeps_the_stored_override()
    {
        var admin = await AdminAsync();
        var withAlt = await SeedMediaAsync("c7a");
        var blankAlt = await SeedMediaAsync("c7b", alt: "", decorative: true);
        try
        {
            var first = await PutAsync(admin, new { version = (await ReadAsync(admin)).GetProperty("version").GetInt32(), defaultShareImageId = withAlt, defaultShareImageAltOverride = "Logo" });
            Assert.Equal(HttpStatusCode.OK, first.Status);

            // The body leaves out the override, so the stored "Logo" stays and is the new image's alt.
            var second = await PutAsync(admin, new { version = VersionOf(first.Body), defaultShareImageId = blankAlt });
            Assert.Equal(HttpStatusCode.OK, second.Status);

            var after = await ReadAsync(admin);
            Assert.Equal(blankAlt, ShareImageId(after));
            Assert.Equal("Logo", after.GetProperty("defaultShareImageAltOverride").GetString());
        }
        finally
        {
            await CleanUpAsync(withAlt, blankAlt);
        }
    }

    [Fact]
    public async Task A_decorative_image_with_library_alt_is_accepted()
    {
        var admin = await AdminAsync();
        var media = await SeedMediaAsync("c8", alt: "Logo", decorative: true);
        try
        {
            var saved = await PutAsync(admin, new { version = (await ReadAsync(admin)).GetProperty("version").GetInt32(), defaultShareImageId = media, defaultShareImageAltOverride = (string?)null });
            Assert.Equal(HttpStatusCode.OK, saved.Status);
            Assert.Equal(media, ShareImageId(await ReadAsync(admin)));
        }
        finally
        {
            await CleanUpAsync(media);
        }
    }

    private static bool HasError(string body, string field) =>
        JsonDocument.Parse(body).RootElement.TryGetProperty("errors", out var errors) && errors.TryGetProperty(field, out _);

    private static Guid? ShareImageId(JsonElement settings)
    {
        var value = settings.GetProperty("defaultShareImageId");
        return value.ValueKind == JsonValueKind.Null ? null : value.GetGuid();
    }

    private static int VersionOf(string body) => JsonDocument.Parse(body).RootElement.GetProperty("version").GetInt32();

    /// <summary>Alt and decorative default to what the ADM-10 facts seed; the ADM-12c facts pass a blank alt.</summary>
    private async Task<Guid> SeedMediaAsync(string name, string? alt = null, bool decorative = false)
    {
        var asset = new MediaAsset
        {
            Id = Guid.NewGuid(),
            Path = "/media/" + Guid.NewGuid().ToString("N") + ".webp",
            OriginalName = "adm10-" + name + ".webp",
            ContentType = "image/webp",
            GeneratedSizes = "[]",
            ContentHash = Guid.NewGuid().ToString("N"),
            Alt = alt ?? "ADM-10 " + name,
            Decorative = decorative,
            CreatedAt = DateTime.UtcNow,
        };
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        db.Media.Add(asset);
        await db.SaveChangesAsync();
        return asset.Id;
    }

    /// <summary>Written directly, as SettingsVersionTests.SetVersionAsync writes the row, so it runs after a failed assertion too.</summary>
    private async Task CleanUpAsync(params Guid[] media)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        await db.SiteSettings.ExecuteUpdateAsync(setters => setters
            .SetProperty(settings => settings.DefaultShareImageId, (Guid?)null)
            .SetProperty(settings => settings.DefaultShareImageAltOverride, (string?)null));
        await db.Media.Where(asset => media.Contains(asset.Id)).ExecuteDeleteAsync();
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
