using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using DigitalHub.Api.Auth;
using DigitalHub.Api.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DigitalHub.Api.Tests;

public sealed class AuthTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    private readonly HttpClient _client;

    public AuthTests(ApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Login_sets_a_secure_refresh_cookie_and_returns_an_access_token()
    {
        var session = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);

        Assert.Equal(HttpStatusCode.OK, session.Status);
        Assert.False(string.IsNullOrWhiteSpace(session.AccessToken));
        Assert.DoesNotContain("refreshToken", session.Body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(session.CookiePair!.Split('=', 2)[1], session.Body, StringComparison.Ordinal);
        Assert.Contains("httponly", session.SetCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("secure", session.SetCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=strict", session.SetCookie, StringComparison.OrdinalIgnoreCase);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        var raw = Uri.UnescapeDataString(session.CookiePair.Split('=', 2)[1]);
        var stored = await db.RefreshTokens.SingleAsync(token => token.TokenHash == TokenService.Hash(raw));
        Assert.DoesNotContain(raw, stored.TokenHash, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Me_returns_the_admin_user()
    {
        var session = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var response = await _client.SendAsync(session.Authorized(HttpMethod.Get, "/api/v1/auth/me"));
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = JsonDocument.Parse(body).RootElement;
        Assert.Equal(ApiFactory.AdminEmail, json.GetProperty("email").GetString());
        Assert.Equal("admin", json.GetProperty("role").GetString());
        Assert.DoesNotContain("password", body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Refresh_rotates_the_cookie_and_reuse_revokes_the_chain()
    {
        var session = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var firstRaw = session.CookiePair!.Split('=', 2)[1];
        var refreshed = await _client.SendAsync(session.RefreshRequest());
        var refreshedBody = await refreshed.Content.ReadAsStringAsync();
        var newCookie = refreshed.Headers.GetValues("Set-Cookie").Single(value => value.StartsWith("dh_refresh=", StringComparison.Ordinal));
        var newPair = newCookie.Split(';', 2)[0];
        var newCsrf = JsonDocument.Parse(refreshedBody).RootElement.GetProperty("csrfToken").GetString();

        Assert.Equal(HttpStatusCode.OK, refreshed.StatusCode);
        Assert.NotEqual(firstRaw, newPair.Split('=', 2)[1]);

        var replay = await _client.SendAsync(session.RefreshRequest(session.CsrfToken, session.CookieHeader));
        Assert.Equal(HttpStatusCode.Unauthorized, replay.StatusCode);

        var newCsrfPair = refreshed.Headers.GetValues("Set-Cookie").Single(value => value.StartsWith("dh_csrf=", StringComparison.Ordinal)).Split(';', 2)[0];
        var followUp = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/refresh");
        followUp.Headers.TryAddWithoutValidation("Cookie", $"{newPair}; {newCsrfPair}");
        followUp.Headers.TryAddWithoutValidation(TokenService.CsrfHeaderName, newCsrf);
        var followUpResponse = await _client.SendAsync(followUp);
        Assert.Equal(HttpStatusCode.Unauthorized, followUpResponse.StatusCode);
    }

    [Fact]
    public async Task Refresh_without_the_csrf_header_is_forbidden()
    {
        var session = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/refresh");
        request.Headers.TryAddWithoutValidation("Cookie", session.CookieHeader);
        var response = await _client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("csrf_failed", JsonDocument.Parse(body).RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Logout_revokes_the_refresh_token()
    {
        var session = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var logout = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/logout");
        logout.Headers.TryAddWithoutValidation("Cookie", session.CookieHeader);
        logout.Headers.TryAddWithoutValidation(TokenService.CsrfHeaderName, session.CsrfToken);
        var response = await _client.SendAsync(logout);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var refresh = await _client.SendAsync(session.RefreshRequest());
        Assert.Equal(HttpStatusCode.Unauthorized, refresh.StatusCode);
    }

    [Fact]
    public async Task Fresh_client_refreshes_from_the_csrf_cookie_and_rejects_a_missing_header()
    {
        await CreateUserAsync("reload@digitalhub.test", "editor");
        var login = _factory.CreateClient();
        var session = await AuthSession.LoginAsync(login, "reload@digitalhub.test", ApiFactory.AdminPassword);

        Assert.Equal(HttpStatusCode.OK, session.Status);
        Assert.Contains("samesite=strict", session.CsrfSetCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("path=/api/v1/auth", session.CsrfSetCookie, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("httponly", session.CsrfSetCookie, StringComparison.OrdinalIgnoreCase);

        var fresh = _factory.CreateClient();
        var csrfValue = Uri.UnescapeDataString(session.CsrfCookiePair!.Split('=', 2)[1]);
        var withHeader = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/refresh");
        withHeader.Headers.TryAddWithoutValidation("Cookie", session.CookieHeader);
        withHeader.Headers.TryAddWithoutValidation(TokenService.CsrfHeaderName, csrfValue);
        var refreshed = await fresh.SendAsync(withHeader);
        Assert.Equal(HttpStatusCode.OK, refreshed.StatusCode);

        var again = await AuthSession.LoginAsync(login, "reload@digitalhub.test", ApiFactory.AdminPassword);
        var withoutHeader = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/refresh");
        withoutHeader.Headers.TryAddWithoutValidation("Cookie", again.CookieHeader);
        var rejected = await fresh.SendAsync(withoutHeader);
        var body = await rejected.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.Forbidden, rejected.StatusCode);
        Assert.Equal("csrf_failed", JsonDocument.Parse(body).RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Failed_passwords_do_not_lock_the_account()
    {
        using (var scope = _factory.Services.CreateScope())
        {
            var manager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            Assert.False(manager.Options.Lockout.AllowedForNewUsers);
        }

        await CreateUserAsync("lockout@digitalhub.test", "editor");
        for (var attempt = 0; attempt < 5; attempt++)
        {
            var failed = await AuthSession.LoginAsync(_client, "lockout@digitalhub.test", "Wrong-Passw0rd!");
            Assert.Equal(HttpStatusCode.Unauthorized, failed.Status);
        }

        var success = await AuthSession.LoginAsync(_client, "lockout@digitalhub.test", ApiFactory.AdminPassword);
        Assert.Equal(HttpStatusCode.OK, success.Status);
    }

    [Fact]
    public async Task Editor_token_is_forbidden_on_the_admin_endpoint()
    {
        await CreateUserAsync("editor@digitalhub.test", "editor");
        var editor = await AuthSession.LoginAsync(_client, "editor@digitalhub.test", ApiFactory.AdminPassword);
        var response = await _client.SendAsync(editor.Authorized(HttpMethod.Get, "/api/v1/examples/admin"));
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("forbidden", JsonDocument.Parse(body).RootElement.GetProperty("code").GetString());
        Assert.DoesNotContain("AllowedHosts", body, StringComparison.Ordinal);

        var admin = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var allowed = await _client.SendAsync(admin.Authorized(HttpMethod.Get, "/api/v1/examples/admin"));
        Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
    }

    [Fact]
    public async Task User_without_a_known_role_gets_nothing()
    {
        await CreateUserAsync("norole@digitalhub.test", role: null);
        var session = await AuthSession.LoginAsync(_client, "norole@digitalhub.test", ApiFactory.AdminPassword);
        var me = await _client.SendAsync(session.Authorized(HttpMethod.Get, "/api/v1/auth/me"));
        var probe = await _client.SendAsync(session.Authorized(HttpMethod.Get, "/api/v1/examples/private"));

        Assert.Equal(HttpStatusCode.Forbidden, me.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, probe.StatusCode);
    }

    [Fact]
    public async Task Unrecognised_role_gets_nothing()
    {
        await CreateUserAsync("guest@digitalhub.test", "guest");
        var session = await AuthSession.LoginAsync(_client, "guest@digitalhub.test", ApiFactory.AdminPassword);
        var me = await _client.SendAsync(session.Authorized(HttpMethod.Get, "/api/v1/auth/me"));

        Assert.Equal(HttpStatusCode.Forbidden, me.StatusCode);
        var payload = session.AccessToken!.Split('.')[1];
        var json = Encoding.UTF8.GetString(Base64UrlDecode(payload));
        Assert.DoesNotContain("guest", json, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Login_rate_limit_is_per_ip_and_username()
    {
        for (var attempt = 0; attempt < 8; attempt++)
        {
            var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new { email = "limited@digitalhub.test", password = "wrong-password" });
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        var limited = await _client.PostAsJsonAsync("/api/v1/auth/login", new { email = "limited@digitalhub.test", password = "wrong-password" });
        var limitedBody = await limited.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);
        Assert.Equal("rate_limited", JsonDocument.Parse(limitedBody).RootElement.GetProperty("code").GetString());

        var other = await _client.PostAsJsonAsync("/api/v1/auth/login", new { email = "someone-else@digitalhub.test", password = "wrong-password" });
        Assert.Equal(HttpStatusCode.Unauthorized, other.StatusCode);
    }

    [Fact]
    public async Task Authenticated_requests_for_application_files_return_404()
    {
        var session = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        foreach (var path in new[] { "/appsettings.json", "/DigitalHub.Api.csproj", "/media/../appsettings.json" })
        {
            var response = await _client.SendAsync(session.Authorized(HttpMethod.Get, path));
            var body = await response.Content.ReadAsStringAsync();
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.DoesNotContain("AllowedHosts", body, StringComparison.Ordinal);
            Assert.DoesNotContain("UserSecretsId", body, StringComparison.Ordinal);
            Assert.DoesNotContain("<Project", body, StringComparison.Ordinal);
            Assert.DoesNotContain("ConnectionStrings", body, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void Missing_admin_password_refuses_to_start()
    {
        using var factory = new MissingPasswordFactory();
        var exception = Assert.ThrowsAny<Exception>(() => factory.CreateClient());
        Assert.Contains("InitialAdminPassword", exception.ToString(), StringComparison.Ordinal);
    }

    private async Task CreateUserAsync(string email, string? role)
    {
        using var scope = _factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        if (await userManager.FindByEmailAsync(email) is not null)
        {
            return;
        }

        if (role == "guest")
        {
            var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
            if (!await roles.RoleExistsAsync(role))
            {
                var createdRole = await roles.CreateAsync(new IdentityRole(role));
                Assert.True(createdRole.Succeeded);
            }
        }

        var user = new ApplicationUser { UserName = email, Email = email, EmailConfirmed = true };
        var created = await userManager.CreateAsync(user, ApiFactory.AdminPassword);
        Assert.True(created.Succeeded, string.Join(", ", created.Errors.Select(error => error.Code)));
        if (role is not null)
        {
            var added = await userManager.AddToRoleAsync(user, role);
            Assert.True(added.Succeeded);
        }
    }

    private static byte[] Base64UrlDecode(string value)
    {
        var padded = value.Replace('-', '+').Replace('_', '/');
        padded = padded.PadRight(padded.Length + (4 - padded.Length % 4) % 4, '=');
        return Convert.FromBase64String(padded);
    }
}

public sealed class MissingPasswordFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Content", "Server=127.0.0.1,1;Database=DigitalHubContent;Connect Timeout=1;Encrypt=True;TrustServerCertificate=True");
        builder.UseSetting("Auth:SigningKey", ApiFactory.SigningKey);
        builder.UseSetting("Auth:Issuer", "digitalhub");
        builder.UseSetting("Auth:Audience", "digitalhub-api");
        builder.UseSetting("Auth:InitialAdminEmail", ApiFactory.AdminEmail);
    }
}
