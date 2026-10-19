using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DigitalHub.Api.Tests;

/// <summary>
/// Finding M1: changing a password ends the user's other sessions, and an admin
/// reset ends all of them. The two-session scenario from the security review.
/// </summary>
[Collection("SqlServer")]
public sealed class SessionRevocationTests : IClassFixture<ApiFactory>
{
    private const string FirstPassword = "Session-Test-Pass-1!";
    private readonly HttpClient _client;

    public SessionRevocationTests(ApiFactory factory) => _client = factory.CreateClient();

    [Fact]
    public async Task Changing_the_password_ends_the_other_sessions_and_keeps_this_one()
    {
        var email = await CreateEditorAsync("change");
        var a = await AuthSession.LoginAsync(_client, email, FirstPassword);
        var b = await AuthSession.LoginAsync(_client, email, FirstPassword);

        var change = b.Authorized(HttpMethod.Post, "/api/v1/auth/change-password");
        change.Headers.TryAddWithoutValidation("Cookie", b.CookieHeader);
        change.Content = JsonContent.Create(new { currentPassword = FirstPassword, newPassword = "Session-Test-Pass-2!" });
        Assert.Equal(HttpStatusCode.NoContent, (await _client.SendAsync(change)).StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.SendAsync(a.RefreshRequest())).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _client.SendAsync(b.RefreshRequest())).StatusCode);
    }

    [Fact]
    public async Task Changing_the_password_without_a_refresh_cookie_ends_every_session()
    {
        var email = await CreateEditorAsync("nocookie");
        var a = await AuthSession.LoginAsync(_client, email, FirstPassword);
        var b = await AuthSession.LoginAsync(_client, email, FirstPassword);

        var change = b.Authorized(HttpMethod.Post, "/api/v1/auth/change-password");
        change.Content = JsonContent.Create(new { currentPassword = FirstPassword, newPassword = "Session-Test-Pass-2!" });
        Assert.Equal(HttpStatusCode.NoContent, (await _client.SendAsync(change)).StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.SendAsync(a.RefreshRequest())).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.SendAsync(b.RefreshRequest())).StatusCode);
    }

    [Fact]
    public async Task Another_users_refresh_cookie_does_not_keep_a_family_alive()
    {
        var email = await CreateEditorAsync("foreign");
        var own = await AuthSession.LoginAsync(_client, email, FirstPassword);
        var admin = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);

        var change = own.Authorized(HttpMethod.Post, "/api/v1/auth/change-password");
        change.Headers.TryAddWithoutValidation("Cookie", admin.CookieHeader);
        change.Content = JsonContent.Create(new { currentPassword = FirstPassword, newPassword = "Session-Test-Pass-2!" });
        Assert.Equal(HttpStatusCode.NoContent, (await _client.SendAsync(change)).StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.SendAsync(own.RefreshRequest())).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _client.SendAsync(admin.RefreshRequest())).StatusCode);
    }

    [Fact]
    public async Task An_admin_reset_ends_every_session_of_the_user()
    {
        var email = await CreateEditorAsync("reset");
        var c = await AuthSession.LoginAsync(_client, email, FirstPassword);
        var d = await AuthSession.LoginAsync(_client, email, FirstPassword);
        var admin = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);

        var id = await UserIdAsync(admin, email);
        var reset = await _client.SendAsync(admin.Authorized(HttpMethod.Post, $"/api/v1/users/{id}/reset-password"));
        Assert.Equal(HttpStatusCode.OK, reset.StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.SendAsync(c.RefreshRequest())).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.SendAsync(d.RefreshRequest())).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _client.SendAsync(admin.RefreshRequest())).StatusCode);
    }

    private async Task<string> CreateEditorAsync(string label)
    {
        var email = $"session-{label}-{Guid.NewGuid():N}"[..30] + "@digitalhub.test";
        var admin = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var create = admin.Authorized(HttpMethod.Post, "/api/v1/users");
        create.Content = JsonContent.Create(new { email, role = "editor", password = FirstPassword });
        Assert.Equal(HttpStatusCode.Created, (await _client.SendAsync(create)).StatusCode);
        return email;
    }

    private async Task<string> UserIdAsync(AuthSession admin, string email)
    {
        var list = await _client.SendAsync(admin.Authorized(HttpMethod.Get, "/api/v1/users"));
        var items = JsonDocument.Parse(await list.Content.ReadAsStringAsync()).RootElement.GetProperty("items");
        return items.EnumerateArray().Single(item => item.GetProperty("email").GetString() == email).GetProperty("id").GetString()!;
    }
}
