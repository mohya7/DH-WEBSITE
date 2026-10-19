using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DigitalHub.Api.Auth;
using DigitalHub.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DigitalHub.Api.Tests;

/// <summary>A clock the test moves. The session limit reads it; access-token lifetimes keep the real clock.</summary>
public sealed class FakeClock : TimeProvider
{
    private DateTimeOffset _now = DateTimeOffset.UtcNow;

    public override DateTimeOffset GetUtcNow() => _now;

    public void Advance(TimeSpan by) => _now += by;
}

/// <summary>
/// Item 13: a refresh-token family stops refreshing Auth:SessionMaxDays (30) after
/// its first sign-in, however often it was refreshed. The sliding
/// Auth:RefreshTokenDays (14) idle window stays.
/// </summary>
[Collection("SqlServer")]
public sealed class SessionLimitTests : IClassFixture<SessionLimitTests.ClockedFactory>, IClassFixture<SessionLimitTests.ShortFactory>
{
    private const string Password = "Granite-Lantern-Velvet-73";
    private readonly ClockedFactory _factory;
    private readonly ShortFactory _short;

    public SessionLimitTests(ClockedFactory factory, ShortFactory shortFactory)
    {
        _factory = factory;
        _short = shortFactory;
    }

    public class ClockedFactory : ApiFactory
    {
        public FakeClock Clock { get; } = new();

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.ConfigureTestServices(services => services.AddSingleton<TimeProvider>(Clock));
        }
    }

    /// <summary>Both limits from configuration: a 3-day idle window and a 5-day ceiling.</summary>
    public sealed class ShortFactory : ClockedFactory
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.UseSetting("Auth:RefreshTokenDays", "3");
            builder.UseSetting("Auth:SessionMaxDays", "5");
        }
    }

    [Fact]
    public async Task Refreshes_on_day_13_26_and_29_work()
    {
        var client = _factory.CreateClient();
        var session = await SignInNewEditorAsync(_factory, client, "days");

        _factory.Clock.Advance(TimeSpan.FromDays(13));
        session = await RefreshAsync(client, session, HttpStatusCode.OK);
        _factory.Clock.Advance(TimeSpan.FromDays(13));
        session = await RefreshAsync(client, session, HttpStatusCode.OK);
        _factory.Clock.Advance(TimeSpan.FromDays(3));
        await RefreshAsync(client, session, HttpStatusCode.OK);
    }

    [Fact]
    public async Task A_refresh_on_day_31_fails_though_the_last_refresh_was_5_days_ago()
    {
        var client = _factory.CreateClient();
        var session = await SignInNewEditorAsync(_factory, client, "ceiling");

        _factory.Clock.Advance(TimeSpan.FromDays(13));
        session = await RefreshAsync(client, session, HttpStatusCode.OK);
        _factory.Clock.Advance(TimeSpan.FromDays(13));
        session = await RefreshAsync(client, session, HttpStatusCode.OK);

        // Day 31, 5 days after the day-26 refresh: inside the 14-day idle window, past the 30-day ceiling.
        _factory.Clock.Advance(TimeSpan.FromDays(5));
        await RefreshAsync(client, session, HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task A_refreshed_token_never_expires_after_the_ceiling()
    {
        var client = _factory.CreateClient();
        var session = await SignInNewEditorAsync(_factory, client, "cap");
        var started = _factory.Clock.GetUtcNow();

        _factory.Clock.Advance(TimeSpan.FromDays(13));
        session = await RefreshAsync(client, session, HttpStatusCode.OK);
        _factory.Clock.Advance(TimeSpan.FromDays(13));
        var refreshed = await RefreshAsync(client, session, HttpStatusCode.OK);

        // Refreshed on day 26: 26 + 14 would be day 40; the cookie and the stored token stop at day 30.
        var expires = DateTimeOffset.Parse(refreshed.SetCookie!.Split(';').Single(part => part.Trim().StartsWith("expires=", StringComparison.OrdinalIgnoreCase)).Split('=', 2)[1]);
        Assert.InRange(expires, started.AddDays(30).AddMinutes(-1), started.AddDays(30).AddMinutes(1));
        var family = FamilyOf(refreshed);
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        var live = await db.RefreshTokens.AsNoTracking().SingleAsync(token => token.FamilyId == family && token.RevokedAt == null);
        Assert.Equal(started.AddDays(30).UtcDateTime, live.ExpiresAt, TimeSpan.FromSeconds(1));
        Assert.Equal(started.UtcDateTime, live.SessionStartedAt, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public async Task A_token_whose_expiry_lies_past_the_ceiling_still_stops_refreshing_on_day_31()
    {
        // A token stored before this change can expire after its family's ceiling.
        // The ceiling check refuses it on its own, and ends the family.
        var client = _factory.CreateClient();
        var session = await SignInNewEditorAsync(_factory, client, "legacy");
        var family = FamilyOf(session);
        await SetExpiryAsync(_factory, family, _factory.Clock.GetUtcNow().AddDays(60));

        _factory.Clock.Advance(TimeSpan.FromDays(31));
        await RefreshAsync(client, session, HttpStatusCode.Unauthorized);

        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        Assert.False(await db.RefreshTokens.AnyAsync(token => token.FamilyId == family && token.RevokedAt == null));
    }

    [Fact]
    public async Task The_access_token_of_a_family_past_the_ceiling_is_refused()
    {
        var client = _factory.CreateClient();
        var session = await SignInNewEditorAsync(_factory, client, "access");
        // Expiry far out, so only the ceiling can refuse the token.
        await SetExpiryAsync(_factory, FamilyOf(session), _factory.Clock.GetUtcNow().AddDays(60));

        _factory.Clock.Advance(TimeSpan.FromDays(29));
        Assert.Equal(HttpStatusCode.OK, (await client.SendAsync(session.Authorized(HttpMethod.Get, "/api/v1/pages"))).StatusCode);
        _factory.Clock.Advance(TimeSpan.FromDays(2));
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.SendAsync(session.Authorized(HttpMethod.Get, "/api/v1/pages"))).StatusCode);
    }

    [Fact]
    public async Task A_new_sign_in_after_the_ceiling_starts_a_new_family()
    {
        var client = _factory.CreateClient();
        var email = await CreateEditorAsync(_factory, client, "again");
        var first = await AuthSession.LoginAsync(client, email, Password);
        _factory.Clock.Advance(TimeSpan.FromDays(31));
        await RefreshAsync(client, first, HttpStatusCode.Unauthorized);

        var second = await AuthSession.LoginAsync(client, email, Password);
        Assert.Equal(HttpStatusCode.OK, second.Status);
        Assert.NotEqual(FamilyOf(first), FamilyOf(second));
        Assert.Equal(HttpStatusCode.OK, (await client.SendAsync(second.Authorized(HttpMethod.Get, "/api/v1/pages"))).StatusCode);
        await RefreshAsync(client, second, HttpStatusCode.OK);
    }

    [Fact]
    public async Task Both_limits_come_from_configuration()
    {
        var client = _short.CreateClient();
        var session = await SignInNewEditorAsync(_short, client, "config");

        // Idle window of 3 days: day 2 refreshes; a token left 4 days does not.
        _short.Clock.Advance(TimeSpan.FromDays(2));
        session = await RefreshAsync(client, session, HttpStatusCode.OK);
        _short.Clock.Advance(TimeSpan.FromDays(2));
        session = await RefreshAsync(client, session, HttpStatusCode.OK);
        // Ceiling of 5 days: day 5.5 fails, though the last refresh was 1.5 days ago.
        _short.Clock.Advance(TimeSpan.FromDays(1.5));
        await RefreshAsync(client, session, HttpStatusCode.Unauthorized);

        var idle = await SignInNewEditorAsync(_short, client, "idle");
        _short.Clock.Advance(TimeSpan.FromDays(4));
        await RefreshAsync(client, idle, HttpStatusCode.Unauthorized);
    }

    private static async Task<AuthSession> SignInNewEditorAsync(ApiFactory factory, HttpClient client, string label)
    {
        var email = await CreateEditorAsync(factory, client, label);
        var session = await AuthSession.LoginAsync(client, email, Password);
        Assert.Equal(HttpStatusCode.OK, session.Status);
        return session;
    }

    private static async Task<string> CreateEditorAsync(ApiFactory factory, HttpClient client, string label)
    {
        _ = factory;
        var email = $"limit-{label}-{Guid.NewGuid():N}"[..28] + "@digitalhub.test";
        var admin = await AuthSession.LoginAsync(client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var create = admin.Authorized(HttpMethod.Post, "/api/v1/users");
        create.Content = JsonContent.Create(new { email, role = "editor", password = Password });
        Assert.Equal(HttpStatusCode.Created, (await client.SendAsync(create)).StatusCode);
        return email;
    }

    /// <summary>Refreshes with the session's cookie and returns the new session when the status matches.</summary>
    private static async Task<AuthSession> RefreshAsync(HttpClient client, AuthSession session, HttpStatusCode expected)
    {
        var response = await client.SendAsync(session.RefreshRequest());
        var body = await response.Content.ReadAsStringAsync();
        Assert.True(expected == response.StatusCode, $"refresh gave {response.StatusCode}, expected {expected}: {body}");
        if (response.StatusCode != HttpStatusCode.OK)
            return session;
        var json = JsonDocument.Parse(body).RootElement;
        var cookies = response.Headers.GetValues("Set-Cookie").ToList();
        var refresh = cookies.Single(value => value.StartsWith(TokenService.RefreshCookieName + "=", StringComparison.Ordinal));
        var csrf = cookies.Single(value => value.StartsWith(TokenService.CsrfCookieName + "=", StringComparison.Ordinal));
        return new AuthSession(response.StatusCode, body, json.GetProperty("accessToken").GetString(), json.GetProperty("csrfToken").GetString(),
            refresh.Split(';', 2)[0], refresh, csrf.Split(';', 2)[0], csrf);
    }

    private static Guid FamilyOf(AuthSession session) =>
        Guid.ParseExact(new JwtSecurityTokenHandler().ReadJwtToken(session.AccessToken).Claims.Single(claim => claim.Type == TokenService.SessionClaim).Value, "N");

    private static async Task SetExpiryAsync(ApiFactory factory, Guid family, DateTimeOffset expiresAt)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        foreach (var token in await db.RefreshTokens.Where(token => token.FamilyId == family && token.RevokedAt == null).ToListAsync())
            token.ExpiresAt = expiresAt.UtcDateTime;
        await db.SaveChangesAsync();
    }
}
