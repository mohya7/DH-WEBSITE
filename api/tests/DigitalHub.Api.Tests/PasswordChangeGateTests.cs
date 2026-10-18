using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DigitalHub.Api.Tests;

/// <summary>
/// Finding L3: after an admin reset, a user signed in with the temporary
/// password can only read who they are, change the password, refresh and sign
/// out. Everything else is 403 password_change_required.
/// </summary>
[Collection("SqlServer")]
public sealed class PasswordChangeGateTests : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client;

    public PasswordChangeGateTests(ApiFactory factory) => _client = factory.CreateClient();

    [Fact]
    public async Task A_temporary_password_allows_only_me_change_password_refresh_and_sign_out()
    {
        var (email, temporary) = await ResetUserAsync();
        var session = await AuthSession.LoginAsync(_client, email, temporary);
        Assert.Equal(HttpStatusCode.OK, session.Status);
        Assert.True(JsonDocument.Parse(session.Body).RootElement.GetProperty("mustChangePassword").GetBoolean());

        var me = await _client.SendAsync(session.Authorized(HttpMethod.Get, "/api/v1/auth/me"));
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);

        foreach (var (method, path) in new[] { (HttpMethod.Get, "/api/v1/pages"), (HttpMethod.Get, "/api/v1/settings"), (HttpMethod.Get, "/api/v1/contact-requests/new-count"), (HttpMethod.Post, "/api/v1/pages") })
        {
            var request = session.Authorized(method, path);
            if (method == HttpMethod.Post)
                request.Content = JsonContent.Create(new { title = "Made with a temporary password", slug = "temp-pw-" + Guid.NewGuid().ToString("N")[..6] });
            var response = await _client.SendAsync(request);
            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            Assert.Equal("password_change_required", JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.GetProperty("code").GetString());
        }

        var refreshed = await _client.SendAsync(session.RefreshRequest());
        Assert.Equal(HttpStatusCode.OK, refreshed.StatusCode);
        var csrf = JsonDocument.Parse(await refreshed.Content.ReadAsStringAsync()).RootElement.GetProperty("csrfToken").GetString();
        var cookies = refreshed.Headers.GetValues("Set-Cookie").Select(value => value.Split(';', 2)[0]).ToList();
        var cookieHeader = string.Join("; ", cookies);
        var token = JsonDocument.Parse(await refreshed.Content.ReadAsStringAsync()).RootElement.GetProperty("accessToken").GetString();

        var change = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/change-password");
        change.Headers.Authorization = new("Bearer", token);
        change.Headers.TryAddWithoutValidation("Cookie", cookieHeader);
        change.Content = JsonContent.Create(new { currentPassword = temporary, newPassword = "Gate-Changed-Pass-1!" });
        Assert.Equal(HttpStatusCode.NoContent, (await _client.SendAsync(change)).StatusCode);

        // The change gives the user a new stamp; this session refreshes and is no longer held back.
        var after = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/refresh");
        after.Headers.TryAddWithoutValidation("Cookie", cookieHeader);
        after.Headers.TryAddWithoutValidation("X-CSRF-Token", csrf);
        var afterResponse = await _client.SendAsync(after);
        Assert.Equal(HttpStatusCode.OK, afterResponse.StatusCode);
        var freshToken = JsonDocument.Parse(await afterResponse.Content.ReadAsStringAsync()).RootElement.GetProperty("accessToken").GetString();
        var pages = new HttpRequestMessage(HttpMethod.Get, "/api/v1/pages");
        pages.Headers.Authorization = new("Bearer", freshToken);
        Assert.Equal(HttpStatusCode.OK, (await _client.SendAsync(pages)).StatusCode);
    }

    [Fact]
    public async Task Sign_out_works_with_a_temporary_password()
    {
        var (email, temporary) = await ResetUserAsync();
        var session = await AuthSession.LoginAsync(_client, email, temporary);
        var logout = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/logout");
        logout.Headers.TryAddWithoutValidation("Cookie", session.CookieHeader);
        logout.Headers.TryAddWithoutValidation("X-CSRF-Token", session.CsrfToken);
        Assert.Equal(HttpStatusCode.NoContent, (await _client.SendAsync(logout)).StatusCode);
    }

    private async Task<(string Email, string Temporary)> ResetUserAsync()
    {
        var email = $"gate-{Guid.NewGuid():N}"[..20] + "@digitalhub.test";
        var admin = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var create = admin.Authorized(HttpMethod.Post, "/api/v1/users");
        create.Content = JsonContent.Create(new { email, role = "editor", password = "Gate-First-Pass-1!" });
        var created = await _client.SendAsync(create);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var id = JsonDocument.Parse(await created.Content.ReadAsStringAsync()).RootElement.GetProperty("id").GetString();
        var reset = await _client.SendAsync(admin.Authorized(HttpMethod.Post, $"/api/v1/users/{id}/reset-password"));
        Assert.Equal(HttpStatusCode.OK, reset.StatusCode);
        var temporary = JsonDocument.Parse(await reset.Content.ReadAsStringAsync()).RootElement.GetProperty("temporaryPassword").GetString()!;
        return (email, temporary);
    }
}
