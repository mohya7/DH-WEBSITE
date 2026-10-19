using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using DigitalHub.Api.Auth;
using DigitalHub.Api.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace DigitalHub.Api.Tests;

/// <summary>
/// Findings M2 and L2: an access token works only while its user is active and
/// still has the security stamp the token carries. There is no cache, so the
/// change applies on the next request.
/// </summary>
[Collection("SqlServer")]
public sealed class SessionCheckTests : IClassFixture<ApiFactory>
{
    private const string Password = "Session-Check-Pass-1!";
    private readonly ApiFactory _factory;
    private readonly HttpClient _client;

    public SessionCheckTests(ApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task A_deactivated_users_access_token_is_refused_on_the_next_request_and_cannot_write()
    {
        var email = await CreateEditorAsync("deact");
        var user = await AuthSession.LoginAsync(_client, email, Password);
        Assert.Equal(HttpStatusCode.OK, (await _client.SendAsync(user.Authorized(HttpMethod.Get, "/api/v1/pages"))).StatusCode);

        var admin = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var id = await UserIdAsync(admin, email);
        Assert.Equal(HttpStatusCode.OK, (await _client.SendAsync(admin.Authorized(HttpMethod.Post, $"/api/v1/users/{id}/deactivate"))).StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.SendAsync(user.Authorized(HttpMethod.Get, "/api/v1/pages"))).StatusCode);
        var write = user.Authorized(HttpMethod.Post, "/api/v1/redirects");
        write.Content = JsonContent.Create(new { fromPath = "/after-deactivation-" + Guid.NewGuid().ToString("N")[..6], toPath = "/" });
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.SendAsync(write)).StatusCode);
    }

    [Fact]
    public async Task A_locked_out_users_access_token_is_refused_even_while_the_session_is_live()
    {
        // Deactivation also revokes the refresh tokens, so the test above passes on
        // the session check alone. Here the lockout is set on its own, the session
        // stays live and the stamp is unchanged: only the lockout check refuses.
        var email = await CreateEditorAsync("lockout");
        var user = await AuthSession.LoginAsync(_client, email, Password);
        Assert.Equal(HttpStatusCode.OK, (await _client.SendAsync(user.Authorized(HttpMethod.Get, "/api/v1/pages"))).StatusCode);

        using (var scope = _factory.Services.CreateScope())
        {
            var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var account = (await users.FindByEmailAsync(email))!;
            var stamp = account.SecurityStamp;
            Assert.True((await users.SetLockoutEnabledAsync(account, true)).Succeeded);
            Assert.True((await users.SetLockoutEndDateAsync(account, DateTimeOffset.MaxValue)).Succeeded);
            Assert.Equal(stamp, (await users.FindByEmailAsync(email))!.SecurityStamp);
        }

        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.SendAsync(user.Authorized(HttpMethod.Get, "/api/v1/pages"))).StatusCode);
    }

    [Fact]
    public async Task Sign_out_ends_that_access_token_and_other_sessions_continue()
    {
        var email = await CreateEditorAsync("signout");
        var leaving = await AuthSession.LoginAsync(_client, email, Password);
        var staying = await AuthSession.LoginAsync(_client, email, Password);

        var logout = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/logout");
        logout.Headers.TryAddWithoutValidation("Cookie", leaving.CookieHeader);
        logout.Headers.TryAddWithoutValidation("X-CSRF-Token", leaving.CsrfToken);
        Assert.Equal(HttpStatusCode.NoContent, (await _client.SendAsync(logout)).StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.SendAsync(leaving.Authorized(HttpMethod.Get, "/api/v1/auth/me"))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.SendAsync(leaving.Authorized(HttpMethod.Get, "/api/v1/pages"))).StatusCode);

        // Sign-out ends one session, not the user's others.
        Assert.Equal(HttpStatusCode.OK, (await _client.SendAsync(staying.Authorized(HttpMethod.Get, "/api/v1/pages"))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _client.SendAsync(staying.RefreshRequest())).StatusCode);
    }

    [Fact]
    public async Task Reusing_a_spent_refresh_token_ends_the_sessions_access_token()
    {
        var email = await CreateEditorAsync("reuse");
        var session = await AuthSession.LoginAsync(_client, email, Password);
        Assert.Equal(HttpStatusCode.OK, (await _client.SendAsync(session.RefreshRequest())).StatusCode);
        // The first refresh spent the original token; replaying it revokes the whole family.
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.SendAsync(session.RefreshRequest())).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.SendAsync(session.Authorized(HttpMethod.Get, "/api/v1/pages"))).StatusCode);
    }

    [Fact]
    public async Task After_a_password_change_old_access_tokens_are_refused_and_this_session_refreshes()
    {
        var email = await CreateEditorAsync("pwd");
        var other = await AuthSession.LoginAsync(_client, email, Password);
        var current = await AuthSession.LoginAsync(_client, email, Password);

        var change = current.Authorized(HttpMethod.Post, "/api/v1/auth/change-password");
        change.Headers.TryAddWithoutValidation("Cookie", current.CookieHeader);
        change.Content = JsonContent.Create(new { currentPassword = Password, newPassword = "Session-Check-Pass-2!" });
        Assert.Equal(HttpStatusCode.NoContent, (await _client.SendAsync(change)).StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.SendAsync(other.Authorized(HttpMethod.Get, "/api/v1/pages"))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.SendAsync(current.Authorized(HttpMethod.Get, "/api/v1/pages"))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _client.SendAsync(current.RefreshRequest())).StatusCode);
    }

    [Fact]
    public async Task A_correctly_signed_token_without_the_stamp_claim_is_refused()
    {
        var admin = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(admin.AccessToken);
        var sub = jwt.Subject;
        var sid = jwt.Claims.Single(claim => claim.Type == TokenService.SessionClaim).Value;
        var stamp = jwt.Claims.Single(claim => claim.Type == TokenService.StampClaim).Value;

        // The same claims re-signed with the real key are accepted, so the refusals below are about the claims alone.
        var copy = Sign(new Claim("sub", sub), new Claim("role", "admin"), new Claim(TokenService.StampClaim, stamp), new Claim(TokenService.SessionClaim, sid));
        var copyRequest = new HttpRequestMessage(HttpMethod.Get, "/api/v1/users");
        copyRequest.Headers.Authorization = new("Bearer", copy);
        Assert.Equal(HttpStatusCode.OK, (await _client.SendAsync(copyRequest)).StatusCode);

        var forged = Sign(new Claim("sub", sub), new Claim("role", "admin"), new Claim(TokenService.SessionClaim, sid));
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/users");
        request.Headers.Authorization = new("Bearer", forged);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.SendAsync(request)).StatusCode);

        var noSession = Sign(new Claim("sub", sub), new Claim("role", "admin"), new Claim(TokenService.StampClaim, stamp));
        var noSessionRequest = new HttpRequestMessage(HttpMethod.Get, "/api/v1/users");
        noSessionRequest.Headers.Authorization = new("Bearer", noSession);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.SendAsync(noSessionRequest)).StatusCode);

        var stale = Sign(new Claim("sub", sub), new Claim("role", "admin"), new Claim(TokenService.StampClaim, TokenService.StampValue("an-old-stamp")), new Claim(TokenService.SessionClaim, sid));
        var staleRequest = new HttpRequestMessage(HttpMethod.Get, "/api/v1/users");
        staleRequest.Headers.Authorization = new("Bearer", stale);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.SendAsync(staleRequest)).StatusCode);
    }

    private static string Sign(params Claim[] claims)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(ApiFactory.SigningKey));
        var token = new JwtSecurityToken("digitalhub", "digitalhub-api", claims, DateTime.UtcNow, DateTime.UtcNow.AddMinutes(5),
            new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private async Task<string> CreateEditorAsync(string label)
    {
        var email = $"check-{label}-{Guid.NewGuid():N}"[..28] + "@digitalhub.test";
        var admin = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var create = admin.Authorized(HttpMethod.Post, "/api/v1/users");
        create.Content = JsonContent.Create(new { email, role = "editor", password = Password });
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
