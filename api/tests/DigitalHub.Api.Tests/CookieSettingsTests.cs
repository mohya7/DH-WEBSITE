using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using DigitalHub.Api.Data;

namespace DigitalHub.Api.Tests;

/// <summary>
/// Section 7: the five cookie banner settings (title and four labels). Saved trimmed,
/// cleared to null, limited to 200 and 80 characters, and given to the build.
/// </summary>
[Collection("SqlServer")]
public sealed class CookieSettingsTests : IClassFixture<ApiFactory>
{
    private static readonly (string Name, int Limit)[] Fields =
    [
        ("cookieBannerTitle", 200),
        ("cookieAcceptLabel", 80),
        ("cookieRejectLabel", 80),
        ("cookieAnalyticsLabel", 80),
        ("cookieSettingsLabel", 80),
    ];

    private readonly ApiFactory _factory;
    private readonly HttpClient _client;

    public CookieSettingsTests(ApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Cookie_banner_settings_are_saved_trimmed_given_to_the_build_and_cleared_to_null()
    {
        var admin = await AdminAsync();
        var payload = await CurrentPayloadAsync(admin);
        foreach (var (name, _) in Fields)
            payload[name] = "  " + name + " value  ";

        var saved = await SendAsync(admin, HttpMethod.Put, "/api/v1/settings", payload);
        Assert.Equal(HttpStatusCode.OK, saved.Status);
        var reread = JsonDocument.Parse((await SendAsync(admin, HttpMethod.Get, "/api/v1/settings")).Body).RootElement;
        var build = await BuildSettingsAsync();
        foreach (var (name, _) in Fields)
        {
            Assert.Equal(name + " value", JsonDocument.Parse(saved.Body).RootElement.GetProperty(name).GetString());
            Assert.Equal(name + " value", reread.GetProperty(name).GetString());
            Assert.Equal(name + " value", build.GetProperty(name).GetString());
        }

        foreach (var (name, _) in Fields)
            payload[name] = name == "cookieBannerTitle" ? "   " : null;
        payload["version"] = JsonDocument.Parse(saved.Body).RootElement.GetProperty("version").GetInt32();
        var cleared = await SendAsync(admin, HttpMethod.Put, "/api/v1/settings", payload);
        Assert.Equal(HttpStatusCode.OK, cleared.Status);
        reread = JsonDocument.Parse((await SendAsync(admin, HttpMethod.Get, "/api/v1/settings")).Body).RootElement;
        build = await BuildSettingsAsync();
        foreach (var (name, _) in Fields)
        {
            Assert.Equal(JsonValueKind.Null, reread.GetProperty(name).ValueKind);
            Assert.Equal(JsonValueKind.Null, build.GetProperty(name).ValueKind);
        }
    }

    [Fact]
    public async Task Cookie_banner_settings_accept_their_limit_and_refuse_one_character_more()
    {
        var admin = await AdminAsync();
        foreach (var (name, limit) in Fields)
        {
            var payload = await CurrentPayloadAsync(admin);
            payload[name] = new string('x', limit);
            var atLimit = await SendAsync(admin, HttpMethod.Put, "/api/v1/settings", payload);
            Assert.Equal(HttpStatusCode.OK, atLimit.Status);
            Assert.Equal(limit, JsonDocument.Parse(atLimit.Body).RootElement.GetProperty(name).GetString()!.Length);

            payload["version"] = JsonDocument.Parse(atLimit.Body).RootElement.GetProperty("version").GetInt32();
            payload[name] = new string('y', limit + 1);
            var over = await SendAsync(admin, HttpMethod.Put, "/api/v1/settings", payload);
            Assert.Equal(HttpStatusCode.BadRequest, over.Status);
            Assert.Contains(name, over.Body, StringComparison.Ordinal);
            var unchanged = JsonDocument.Parse((await SendAsync(admin, HttpMethod.Get, "/api/v1/settings")).Body).RootElement;
            Assert.Equal(new string('x', limit), unchanged.GetProperty(name).GetString());
        }
    }

    [Fact]
    public async Task Editors_cannot_change_the_cookie_banner_settings()
    {
        var editor = await EditorAsync();
        Assert.Equal(HttpStatusCode.Forbidden, (await SendAsync(editor, HttpMethod.Put, "/api/v1/settings", new { cookieBannerTitle = "Cookies" })).Status);
    }

    /// <summary>The current settings as a full PUT body (a save replaces every field).</summary>
    private async Task<Dictionary<string, object?>> CurrentPayloadAsync(AuthSession admin)
    {
        var current = JsonDocument.Parse((await SendAsync(admin, HttpMethod.Get, "/api/v1/settings")).Body).RootElement;
        var payload = current.EnumerateObject()
            .Where(property => property.Value.ValueKind is JsonValueKind.String or JsonValueKind.Null)
            .ToDictionary(property => property.Name, property => property.Value.ValueKind == JsonValueKind.Null ? null : (object?)property.Value.GetString());
        payload.Remove("defaultShareImageId");
        payload["version"] = current.GetProperty("version").GetInt32();
        return payload;
    }

    private async Task<JsonElement> BuildSettingsAsync()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/build/content");
        request.Headers.TryAddWithoutValidation("X-Build-Token", ApiFactory.BuildTokenValue);
        var build = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, build.StatusCode);
        return JsonDocument.Parse(await build.Content.ReadAsStringAsync()).RootElement.GetProperty("settings").Clone();
    }

    private async Task<AuthSession> AdminAsync()
    {
        var session = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        Assert.NotNull(session.AccessToken);
        return session;
    }

    private async Task<AuthSession> EditorAsync()
    {
        const string email = "section7-editor@digitalhub.test";
        using (var scope = _factory.Services.CreateScope())
        {
            var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            if (await users.FindByEmailAsync(email) is null)
            {
                var user = new ApplicationUser { UserName = email, Email = email, EmailConfirmed = true };
                Assert.True((await users.CreateAsync(user, ApiFactory.AdminPassword)).Succeeded);
                Assert.True((await users.AddToRoleAsync(user, "editor")).Succeeded);
            }
        }

        var session = await AuthSession.LoginAsync(_client, email, ApiFactory.AdminPassword);
        Assert.NotNull(session.AccessToken);
        return session;
    }

    private async Task<(HttpStatusCode Status, string Body)> SendAsync(AuthSession session, HttpMethod method, string url, object? body = null)
    {
        var request = session.Authorized(method, url);
        if (body is not null)
            request.Content = JsonContent.Create(body);
        var response = await _client.SendAsync(request);
        return (response.StatusCode, await response.Content.ReadAsStringAsync());
    }
}
