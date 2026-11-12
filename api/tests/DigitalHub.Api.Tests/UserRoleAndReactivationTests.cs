using System.Diagnostics;
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using DigitalHub.Api.Auth;
using DigitalHub.Api.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit.Abstractions;

namespace DigitalHub.Api.Tests;

/// <summary>
/// ADM-04: an admin can change a Studio user's role and reactivate a deactivated user,
/// keeping the last-admin guard. A role change ends the user's sessions (refresh tokens
/// revoked, security stamp rotated). Reactivation gives a new temporary password and
/// never revives an old session.
///
/// HTTP only, so this file compiles against an API without the new routes. Users cannot
/// be deleted, so every user a test makes an admin, or reactivates, is deactivated again
/// in finally (F-10). Audit rows stay (the app login cannot delete them), so a test finds
/// its own rows by entity id and a time after it started.
/// </summary>
[Collection("SqlServer")]
public sealed class UserRoleAndReactivationTests : IClassFixture<ApiFactory>
{
    /*
     * The users lock UserAccessStore takes around a role change or a reactivation
     * (UserAccessStore.UsersLockSql: @Resource = N'digitalhub:admins', @LockTimeout = 5000).
     * T9 holds this resource from its own connection and expects the API to give up after
     * the timeout. Change the store and these constants together.
     */
    private const string LockResource = "digitalhub:admins";
    private const int LockTimeoutMilliseconds = 5000;

    private readonly ApiFactory _factory;
    private readonly HttpClient _client;
    private readonly ITestOutputHelper _output;

    public UserRoleAndReactivationTests(ApiFactory factory, ITestOutputHelper output)
    {
        _factory = factory;
        _client = factory.CreateClient();
        _output = output;
    }

    // T1
    [Fact]
    public async Task An_admin_changes_an_editors_role_and_it_is_audited()
    {
        var started = DateTime.UtcNow.AddSeconds(-1);
        var admin = await AdminAsync();
        var id = await CreateUserAsync(admin, NewEmail("t1"), "editor", TestPassphrase.New());
        try
        {
            var changed = await SendAsync(admin, HttpMethod.Put, $"/api/v1/users/{id}/role", new { role = "admin" });
            Assert.True(changed.Status == HttpStatusCode.OK, Describe("change editor to admin", changed));
            var body = JsonDocument.Parse(changed.Body).RootElement;
            Assert.Equal("admin", body.GetProperty("role").GetString());
            Assert.True(body.GetProperty("active").GetBoolean());

            var row = await ListedRowAsync(admin, id);
            Assert.Equal("admin", row.GetProperty("role").GetString());

            var audit = Assert.Single(await AuditAsync(id, "change_user_role", started));
            Assert.Equal("user", audit.EntityType);
            Assert.Equal("editor -> admin", audit.Detail);
            Assert.Equal(await PrimaryAdminIdAsync(), audit.UserId);
        }
        finally
        {
            await DeactivateQuietlyAsync(id);
        }
    }

    // T2
    [Fact]
    public async Task A_role_change_ends_the_users_sessions()
    {
        var admin = await AdminAsync();
        var email = NewEmail("t2");
        var password = TestPassphrase.New();
        var id = await CreateUserAsync(admin, email, "editor", password);
        var session = await AuthSession.LoginAsync(_client, email, password);
        Assert.Equal(HttpStatusCode.OK, session.Status);
        var stamp = (await LoadAsync(id)).SecurityStamp;

        var changed = await SendAsync(admin, HttpMethod.Put, $"/api/v1/users/{id}/role", new { role = "hr" });
        Assert.True(changed.Status == HttpStatusCode.OK, Describe("change editor to hr", changed));

        Assert.Equal(HttpStatusCode.Unauthorized, await StatusAsync(session, HttpMethod.Get, "/api/v1/auth/me"));
        Assert.Equal(HttpStatusCode.Unauthorized, await StatusAsync(session, HttpMethod.Get, "/api/v1/pages"));
        using (var refresh = await _client.SendAsync(session.RefreshRequest()))
            Assert.Equal(HttpStatusCode.Unauthorized, refresh.StatusCode);
        Assert.NotEqual(stamp, (await LoadAsync(id)).SecurityStamp);

        var again = await AuthSession.LoginAsync(_client, email, password);
        Assert.Equal(HttpStatusCode.OK, again.Status);
        var me = await SendAsync(again, HttpMethod.Get, "/api/v1/auth/me");
        Assert.True(me.Status == HttpStatusCode.OK, Describe("me after a new sign-in", me));
        Assert.Equal("hr", JsonDocument.Parse(me.Body).RootElement.GetProperty("role").GetString());
    }

    // T3
    [Fact]
    public async Task The_last_active_admin_keeps_the_admin_role()
    {
        var admin = await AdminAsync();
        var x = await CreateUserAsync(admin, NewEmail("t3-x"), "admin", TestPassphrase.New());
        var yEmail = NewEmail("t3-y");
        var yPassword = TestPassphrase.New();
        var y = await CreateUserAsync(admin, yEmail, "admin", yPassword);
        var saved = new List<(string Id, bool Enabled, DateTimeOffset? End)>();
        try
        {
            var ySession = await AuthSession.LoginAsync(_client, yEmail, yPassword);
            Assert.Equal(HttpStatusCode.OK, ySession.Status);

            using (var scope = _factory.Services.CreateScope())
            {
                var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

                // Y becomes an editor in the database while Y's token still says admin (plan 2.5).
                var yUser = await users.FindByIdAsync(y);
                Assert.NotNull(yUser);
                Assert.True((await users.RemoveFromRoleAsync(yUser, "admin")).Succeeded);
                Assert.True((await users.AddToRoleAsync(yUser, "editor")).Succeeded);

                // Every other admin is locked, so X is the last active one.
                foreach (var other in await users.GetUsersInRoleAsync("admin"))
                {
                    if (other.Id == x)
                        continue;
                    saved.Add((other.Id, other.LockoutEnabled, other.LockoutEnd));
                    if (IsDeactivated(other))
                        continue;
                    other.LockoutEnabled = true;
                    other.LockoutEnd = DateTimeOffset.MaxValue;
                    Assert.True((await users.UpdateAsync(other)).Succeeded);
                }
            }

            var refused = await SendAsync(ySession, HttpMethod.Put, $"/api/v1/users/{x}/role", new { role = "editor" });
            Assert.True(refused.Status == HttpStatusCode.BadRequest && Code(refused.Body) == "last_admin", Describe("demote the last active admin", refused));
            Assert.Contains("admin", await RolesAsync(x));
        }
        finally
        {
            await RestoreLockoutsAsync(saved);
            await DeactivateQuietlyAsync(x);
            await DeactivateQuietlyAsync(y);
            await EnsurePrimaryAdminActiveAsync();
        }
    }

    // T4
    [Fact]
    public async Task Reactivation_brings_a_user_back_with_a_new_temporary_password()
    {
        var started = DateTime.UtcNow.AddSeconds(-1);
        var admin = await AdminAsync();
        var email = NewEmail("t4");
        var password = TestPassphrase.New();
        var id = await CreateUserAsync(admin, email, "hr", password);
        var deactivated = await SendAsync(admin, HttpMethod.Post, $"/api/v1/users/{id}/deactivate");
        Assert.True(deactivated.Status == HttpStatusCode.OK, Describe("deactivate", deactivated));
        try
        {
            using var response = await _client.SendAsync(admin.Authorized(HttpMethod.Post, $"/api/v1/users/{id}/reactivate"));
            var text = await response.Content.ReadAsStringAsync();
            Assert.True(response.StatusCode == HttpStatusCode.OK, $"reactivate: {(int)response.StatusCode} {text}");
            var body = JsonDocument.Parse(text).RootElement;
            Assert.True(body.GetProperty("active").GetBoolean());
            Assert.Equal("hr", body.GetProperty("role").GetString());
            Assert.True(body.GetProperty("mustChangePassword").GetBoolean());
            var temporary = body.GetProperty("temporaryPassword").GetString();
            Assert.NotNull(temporary);
            Assert.Equal(16, temporary.Length);
            Assert.Contains("no-store", response.Headers.CacheControl?.ToString() ?? "", StringComparison.Ordinal);

            Assert.True((await ListedRowAsync(admin, id)).GetProperty("active").GetBoolean());

            var stored = await LoadAsync(id);
            Assert.False(stored.LockoutEnabled);
            Assert.Null(stored.LockoutEnd);
            Assert.Equal(0, stored.AccessFailedCount);

            Assert.Equal(HttpStatusCode.Unauthorized, (await AuthSession.LoginAsync(_client, email, password)).Status);
            var signedIn = await AuthSession.LoginAsync(_client, email, temporary);
            Assert.Equal(HttpStatusCode.OK, signedIn.Status);
            Assert.True(JsonDocument.Parse(signedIn.Body).RootElement.GetProperty("mustChangePassword").GetBoolean());

            var audit = Assert.Single(await AuditAsync(id, "reactivate_user", started));
            Assert.Equal("user", audit.EntityType);
            Assert.Equal("hr", audit.Detail);
        }
        finally
        {
            await DeactivateQuietlyAsync(id);
        }
    }

    // T5
    [Fact]
    public async Task Reactivation_does_not_revive_old_sessions()
    {
        var admin = await AdminAsync();
        var email = NewEmail("t5");
        var password = TestPassphrase.New();
        var id = await CreateUserAsync(admin, email, "editor", password);
        var session = await AuthSession.LoginAsync(_client, email, password);
        Assert.Equal(HttpStatusCode.OK, session.Status);
        var deactivated = await SendAsync(admin, HttpMethod.Post, $"/api/v1/users/{id}/deactivate");
        Assert.True(deactivated.Status == HttpStatusCode.OK, Describe("deactivate", deactivated));
        try
        {
            var reactivated = await SendAsync(admin, HttpMethod.Post, $"/api/v1/users/{id}/reactivate");
            Assert.True(reactivated.Status == HttpStatusCode.OK, Describe("reactivate", reactivated));

            Assert.Equal(HttpStatusCode.Unauthorized, await StatusAsync(session, HttpMethod.Get, "/api/v1/auth/me"));
            using var refresh = await _client.SendAsync(session.RefreshRequest());
            Assert.Equal(HttpStatusCode.Unauthorized, refresh.StatusCode);
        }
        finally
        {
            await DeactivateQuietlyAsync(id);
        }
    }

    // T6
    [Fact]
    public async Task Reactivating_an_active_or_unknown_user_is_refused()
    {
        var started = DateTime.UtcNow.AddSeconds(-1);
        var admin = await AdminAsync();
        var active = await CreateUserAsync(admin, NewEmail("t6-active"), "editor", TestPassphrase.New());
        var gone = await CreateUserAsync(admin, NewEmail("t6-gone"), "editor", TestPassphrase.New());
        var deactivated = await SendAsync(admin, HttpMethod.Post, $"/api/v1/users/{gone}/deactivate");
        Assert.True(deactivated.Status == HttpStatusCode.OK, Describe("deactivate", deactivated));

        string roleless;
        using (var scope = _factory.Services.CreateScope())
        {
            var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var email = NewEmail("t6-norole");
            var user = new ApplicationUser { UserName = email, Email = email, EmailConfirmed = true };
            Assert.True((await users.CreateAsync(user, TestPassphrase.New())).Succeeded);
            roleless = user.Id;
        }

        var already = await SendAsync(admin, HttpMethod.Post, $"/api/v1/users/{active}/reactivate");
        Assert.True(already.Status == HttpStatusCode.BadRequest && Code(already.Body) == "already_active", Describe("reactivate an active user", already));

        var unknown = await SendAsync(admin, HttpMethod.Post, $"/api/v1/users/{Guid.NewGuid()}/reactivate");
        Assert.True(unknown.Status == HttpStatusCode.NotFound, Describe("reactivate an unknown id", unknown));

        var noRole = await SendAsync(admin, HttpMethod.Post, $"/api/v1/users/{roleless}/reactivate");
        Assert.True(noRole.Status == HttpStatusCode.NotFound, Describe("reactivate a user with no Studio role", noRole));

        // Exactly 5,000 bytes, with a Content-Length, over the 4 KB cap.
        var large = "{\"padding\":\"" + new string('x', 5000 - 14) + "\"}";
        Assert.Equal(5000, Encoding.UTF8.GetByteCount(large));
        var tooLarge = await SendRawAsync(admin, HttpMethod.Post, $"/api/v1/users/{gone}/reactivate", large);
        Assert.True(tooLarge.Status == HttpStatusCode.RequestEntityTooLarge, Describe("reactivate with a 5,000-byte body", tooLarge));

        Assert.True(IsDeactivated(await LoadAsync(gone)), "The refused reactivation left the user active.");
        Assert.False(IsDeactivated(await LoadAsync(active)), "The refused reactivation changed the active user.");
        Assert.Empty(await AuditAsync(active, "reactivate_user", started));
        Assert.Empty(await AuditAsync(gone, "reactivate_user", started));
        Assert.Empty(await AuditAsync(roleless, "reactivate_user", started));
    }

    // T7
    [Fact]
    public async Task A_role_change_checks_its_input()
    {
        var started = DateTime.UtcNow.AddSeconds(-1);
        var admin = await AdminAsync();
        var email = NewEmail("t7");
        var password = TestPassphrase.New();
        var id = await CreateUserAsync(admin, email, "editor", password);
        var session = await AuthSession.LoginAsync(_client, email, password);
        Assert.Equal(HttpStatusCode.OK, session.Status);
        var gone = await CreateUserAsync(admin, NewEmail("t7-gone"), "editor", TestPassphrase.New());
        var deactivated = await SendAsync(admin, HttpMethod.Post, $"/api/v1/users/{gone}/deactivate");
        Assert.True(deactivated.Status == HttpStatusCode.OK, Describe("deactivate", deactivated));

        var viewer = await SendAsync(admin, HttpMethod.Put, $"/api/v1/users/{id}/role", new { role = "viewer" });
        Assert.True(viewer.Status == HttpStatusCode.BadRequest && Code(viewer.Body) == "validation_failed", Describe("role viewer", viewer));
        Assert.True(JsonDocument.Parse(viewer.Body).RootElement.GetProperty("errors").TryGetProperty("role", out _), Describe("errors.role", viewer));

        var duplicate = await SendRawAsync(admin, HttpMethod.Put, $"/api/v1/users/{id}/role", """{"role":"editor","Role":"admin"}""");
        Assert.True(duplicate.Status == HttpStatusCode.BadRequest && Code(duplicate.Body) == "duplicate_field", Describe("two role keys", duplicate));
        Assert.Equal(["editor"], await RolesAsync(id));

        var large = "{\"role\":\"admin\",\"padding\":\"" + new string('x', 5000) + "\"}";
        var tooLarge = await SendRawAsync(admin, HttpMethod.Put, $"/api/v1/users/{id}/role", large);
        Assert.True(tooLarge.Status == HttpStatusCode.RequestEntityTooLarge, Describe("a body over 4 KB", tooLarge));
        Assert.Equal(["editor"], await RolesAsync(id));

        var unknown = await SendAsync(admin, HttpMethod.Put, $"/api/v1/users/{Guid.NewGuid()}/role", new { role = "editor" });
        Assert.True(unknown.Status == HttpStatusCode.NotFound, Describe("an unknown id", unknown));

        var inactive = await SendAsync(admin, HttpMethod.Put, $"/api/v1/users/{gone}/role", new { role = "admin" });
        Assert.True(inactive.Status == HttpStatusCode.BadRequest && Code(inactive.Body) == "user_deactivated", Describe("a deactivated user", inactive));
        Assert.True(IsDeactivated(await LoadAsync(gone)));

        var same = await SendAsync(admin, HttpMethod.Put, $"/api/v1/users/{id}/role", new { role = "editor" });
        Assert.True(same.Status == HttpStatusCode.OK, Describe("the same role", same));
        Assert.Empty(await AuditAsync(id, "change_user_role", started));
        Assert.Equal(HttpStatusCode.OK, await StatusAsync(session, HttpMethod.Get, "/api/v1/auth/me"));
    }

    // T8
    [Fact]
    public async Task An_admin_cannot_change_their_own_role()
    {
        var admin = await AdminAsync();
        var me = await PrimaryAdminIdAsync();
        var refused = await SendAsync(admin, HttpMethod.Put, $"/api/v1/users/{me}/role", new { role = "editor" });
        Assert.True(refused.Status == HttpStatusCode.BadRequest && Code(refused.Body) == "cannot_change_own_role", Describe("change own role", refused));
        Assert.Contains("admin", await RolesAsync(me));
    }

    // T17 (test report round 1, finding 1): the own-role refusal compares the loaded user,
    // not the id as typed. SQL Server's = ignores trailing spaces, and the id column's
    // collation ignores case, so either spelling loads the actor's own row.
    [Fact]
    public async Task An_admin_cannot_change_their_own_role_through_another_spelling_of_their_id()
    {
        // A dedicated admin, so a red run demotes only this test's user; the primary admin stays active.
        var admin = await AdminAsync();
        var email = NewEmail("t17");
        var password = TestPassphrase.New();
        var id = await CreateUserAsync(admin, email, "admin", password);
        try
        {
            var self = await AuthSession.LoginAsync(_client, email, password);
            Assert.Equal(HttpStatusCode.OK, self.Status);

            foreach (var spelling in new[] { id.ToUpperInvariant(), id + "%20" })
            {
                var refused = await SendAsync(self, HttpMethod.Put, $"/api/v1/users/{spelling}/role", new { role = "editor" });
                Assert.True(refused.Status == HttpStatusCode.BadRequest && Code(refused.Body) == "cannot_change_own_role", Describe("change own role as " + spelling, refused));
                Assert.Equal(["admin"], await RolesAsync(id));
            }
        }
        finally
        {
            await DeactivateQuietlyAsync(id);
        }
    }

    // T9
    [Fact]
    public async Task A_role_change_waits_for_the_users_lock_and_then_refuses_as_busy()
    {
        var admin = await AdminAsync();
        var id = await CreateUserAsync(admin, NewEmail("t9"), "editor", TestPassphrase.New());

        // Another session holds the users lock for longer than the API waits. It uses
        // the test host's own connection string (the restricted application login).
        var connectionString = _factory.Services.GetRequiredService<IConfiguration>().GetConnectionString("Content");
        Assert.False(string.IsNullOrWhiteSpace(connectionString));
        var holder = new SqlConnection(connectionString);
        SqlTransaction? held = null;
        try
        {
            await holder.OpenAsync();
            held = (SqlTransaction)await holder.BeginTransactionAsync();
            await using (var command = holder.CreateCommand())
            {
                command.Transaction = held;
                command.CommandText = "EXEC @result = sp_getapplock @Resource = @resource, @LockMode = N'Exclusive', @LockOwner = N'Transaction', @LockTimeout = 0;";
                command.Parameters.Add(new SqlParameter("@resource", System.Data.SqlDbType.NVarChar, 255) { Value = LockResource });
                var result = command.Parameters.Add(new SqlParameter("@result", System.Data.SqlDbType.Int) { Direction = System.Data.ParameterDirection.Output });
                await command.ExecuteNonQueryAsync();
                Assert.True((int)result.Value >= 0, "The holder did not get the lock: " + result.Value);
            }

            var clock = Stopwatch.StartNew();
            var busy = await SendAsync(admin, HttpMethod.Put, $"/api/v1/users/{id}/role", new { role = "admin" });
            clock.Stop();
            _output.WriteLine($"The refused role change took {clock.Elapsed.TotalMilliseconds:0} ms.");
            Assert.True(busy.Status == HttpStatusCode.ServiceUnavailable && Code(busy.Body) == "users_busy", Describe("change a role while the lock is held", busy));
            Assert.True(clock.Elapsed.TotalMilliseconds >= LockTimeoutMilliseconds - 500, $"The API gave up after {clock.Elapsed.TotalMilliseconds:0} ms, before its {LockTimeoutMilliseconds} ms lock timeout.");
        }
        finally
        {
            if (held is not null)
            {
                await held.RollbackAsync();
                await held.DisposeAsync();
            }

            await holder.DisposeAsync();
        }

        Assert.Equal(["editor"], await RolesAsync(id));
    }

    // T11
    [Fact]
    public async Task Editors_and_HR_cannot_change_roles_or_reactivate()
    {
        var admin = await AdminAsync();
        var editorEmail = NewEmail("t11-editor");
        var hrEmail = NewEmail("t11-hr");
        var password = TestPassphrase.New();
        await CreateUserAsync(admin, editorEmail, "editor", password);
        await CreateUserAsync(admin, hrEmail, "hr", password);
        var target = await CreateUserAsync(admin, NewEmail("t11-target"), "editor", TestPassphrase.New());
        var gone = await CreateUserAsync(admin, NewEmail("t11-gone"), "editor", TestPassphrase.New());
        var deactivated = await SendAsync(admin, HttpMethod.Post, $"/api/v1/users/{gone}/deactivate");
        Assert.True(deactivated.Status == HttpStatusCode.OK, Describe("deactivate", deactivated));

        foreach (var email in new[] { editorEmail, hrEmail })
        {
            var session = await AuthSession.LoginAsync(_client, email, password);
            Assert.Equal(HttpStatusCode.OK, session.Status);
            var change = await SendAsync(session, HttpMethod.Put, $"/api/v1/users/{target}/role", new { role = "admin" });
            Assert.True(change.Status == HttpStatusCode.Forbidden, Describe(email + " changes a role", change));
            var reactivate = await SendAsync(session, HttpMethod.Post, $"/api/v1/users/{gone}/reactivate");
            Assert.True(reactivate.Status == HttpStatusCode.Forbidden, Describe(email + " reactivates", reactivate));
        }

        Assert.Equal(["editor"], await RolesAsync(target));
        Assert.True(IsDeactivated(await LoadAsync(gone)));
    }

    // T12
    [Fact]
    public async Task Creating_a_deactivated_email_is_still_email_taken()
    {
        var admin = await AdminAsync();
        var email = NewEmail("t12");
        var id = await CreateUserAsync(admin, email, "editor", TestPassphrase.New());
        var deactivated = await SendAsync(admin, HttpMethod.Post, $"/api/v1/users/{id}/deactivate");
        Assert.True(deactivated.Status == HttpStatusCode.OK, Describe("deactivate", deactivated));

        var again = await SendAsync(admin, HttpMethod.Post, "/api/v1/users", new { email = email.ToUpperInvariant(), role = "admin", password = TestPassphrase.New() });
        Assert.True(again.Status == HttpStatusCode.Conflict && Code(again.Body) == "email_taken", Describe("create on a deactivated email", again));

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        var normalized = email.ToUpperInvariant();
        Assert.Equal(1, await db.Users.AsNoTracking().CountAsync(user => user.NormalizedEmail == normalized));
        Assert.True(IsDeactivated(await LoadAsync(id)));
    }

    // T13 (F-5)
    [Fact]
    public async Task A_refresh_that_races_a_role_change_cannot_keep_the_old_role()
    {
        var admin = await AdminAsync();
        var email = NewEmail("t13");
        var password = TestPassphrase.New();
        var id = await CreateUserAsync(admin, email, "editor", password);
        var session = await AuthSession.LoginAsync(_client, email, password);
        Assert.Equal(HttpStatusCode.OK, session.Status);
        var sid = new JwtSecurityTokenHandler().ReadJwtToken(session.AccessToken).Claims
            .Single(claim => claim.Type == TokenService.SessionClaim).Value;
        var family = Guid.ParseExact(sid, "N");

        var changed = await SendAsync(admin, HttpMethod.Put, $"/api/v1/users/{id}/role", new { role = "hr" });
        Assert.True(changed.Status == HttpStatusCode.OK, Describe("change editor to hr", changed));

        // The write of a refresh that read the user and roles before the change and saved
        // after it: one live token in the session's family again.
        var raced = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = id,
            TokenHash = TokenService.Hash(Guid.NewGuid().ToString("N")),
            CsrfTokenHash = TokenService.Hash(Guid.NewGuid().ToString("N")),
            FamilyId = family,
            ExpiresAt = DateTime.UtcNow.AddDays(1),
            CreatedAt = DateTime.UtcNow,
            SessionStartedAt = DateTime.UtcNow,
        };
        try
        {
            using (var scope = _factory.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
                db.RefreshTokens.Add(raced);
                await db.SaveChangesAsync();
            }

            // The old access token carries the old stamp, as the racing refresh's new token would.
            Assert.Equal(HttpStatusCode.Unauthorized, await StatusAsync(session, HttpMethod.Get, "/api/v1/pages"));
        }
        finally
        {
            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            var row = await db.RefreshTokens.SingleOrDefaultAsync(token => token.Id == raced.Id);
            if (row is not null && row.RevokedAt is null)
            {
                row.RevokedAt = DateTime.UtcNow;
                await db.SaveChangesAsync();
            }
        }
    }

    // T14 (F-6)
    [Fact]
    public async Task A_demoted_or_deactivated_admin_cannot_finish_a_users_change()
    {
        var admin = await AdminAsync();
        var yEmail = NewEmail("t14-y");
        var yPassword = TestPassphrase.New();
        var y = await CreateUserAsync(admin, yEmail, "admin", yPassword);
        var e = await CreateUserAsync(admin, NewEmail("t14-e"), "editor", TestPassphrase.New());
        var d = await CreateUserAsync(admin, NewEmail("t14-d"), "editor", TestPassphrase.New());
        var deactivated = await SendAsync(admin, HttpMethod.Post, $"/api/v1/users/{d}/deactivate");
        Assert.True(deactivated.Status == HttpStatusCode.OK, Describe("deactivate", deactivated));
        try
        {
            var ySession = await AuthSession.LoginAsync(_client, yEmail, yPassword);
            Assert.Equal(HttpStatusCode.OK, ySession.Status);

            // Demoted: Y's token still says admin; the primary admin stays active.
            await SetRoleDirectlyAsync(y, from: "admin", to: "editor");
            var promote = await SendAsync(ySession, HttpMethod.Put, $"/api/v1/users/{e}/role", new { role = "admin" });
            Assert.True(promote.Status == HttpStatusCode.Forbidden && Code(promote.Body) == "forbidden", Describe("a demoted admin promotes", promote));
            Assert.Equal(["editor"], await RolesAsync(e));
            var reactivate = await SendAsync(ySession, HttpMethod.Post, $"/api/v1/users/{d}/reactivate");
            Assert.True(reactivate.Status == HttpStatusCode.Forbidden && Code(reactivate.Body) == "forbidden", Describe("a demoted admin reactivates", reactivate));
            Assert.True(IsDeactivated(await LoadAsync(d)));

            // Deactivated in place of demoted: SessionCheck refuses before the store runs.
            await SetRoleDirectlyAsync(y, from: "editor", to: "admin");
            await DeactivateDirectlyAsync(y);
            Assert.Equal(HttpStatusCode.Unauthorized, (await SendAsync(ySession, HttpMethod.Put, $"/api/v1/users/{e}/role", new { role = "admin" })).Status);
            Assert.Equal(HttpStatusCode.Unauthorized, (await SendAsync(ySession, HttpMethod.Post, $"/api/v1/users/{d}/reactivate")).Status);
            Assert.Equal(["editor"], await RolesAsync(e));
            Assert.True(IsDeactivated(await LoadAsync(d)));
        }
        finally
        {
            await DeactivateQuietlyAsync(y);
        }
    }

    private static string NewEmail(string name) =>
        "adm04-" + name + "-" + Guid.NewGuid().ToString("N")[..8] + "@digitalhub.test";

    private static bool IsDeactivated(ApplicationUser user) =>
        user.LockoutEnabled && user.LockoutEnd is not null && user.LockoutEnd > DateTimeOffset.UtcNow;

    private async Task<AuthSession> AdminAsync()
    {
        await EnsurePrimaryAdminActiveAsync();
        var session = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        Assert.Equal(HttpStatusCode.OK, session.Status);
        return session;
    }

    /// <summary>The logic of AdminApiTests.EnsurePrimaryAdminActiveAsync (AdminApiTests.cs:598-).</summary>
    private async Task EnsurePrimaryAdminActiveAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var primary = await users.FindByEmailAsync(ApiFactory.AdminEmail);
        Assert.NotNull(primary);
        if (!primary.LockoutEnabled && primary.LockoutEnd is null)
            return;
        primary.LockoutEnabled = false;
        primary.LockoutEnd = null;
        Assert.True((await users.UpdateAsync(primary)).Succeeded);
    }

    private async Task<string> PrimaryAdminIdAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        return (await users.FindByEmailAsync(ApiFactory.AdminEmail))!.Id;
    }

    private async Task<string> CreateUserAsync(AuthSession admin, string email, string role, string password)
    {
        var created = await SendAsync(admin, HttpMethod.Post, "/api/v1/users", new { email, role, password });
        Assert.True(created.Status == HttpStatusCode.Created, Describe("create " + email, created));
        return JsonDocument.Parse(created.Body).RootElement.GetProperty("id").GetString()!;
    }

    private async Task<ApplicationUser> LoadAsync(string id)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        return await db.Users.AsNoTracking().SingleAsync(user => user.Id == id);
    }

    private async Task<List<string>> RolesAsync(string id)
    {
        using var scope = _factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await users.FindByIdAsync(id);
        Assert.NotNull(user);
        return (await users.GetRolesAsync(user)).OrderBy(role => role, StringComparer.Ordinal).ToList();
    }

    private async Task<List<AuditLogEntry>> AuditAsync(string entityId, string action, DateTime since)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        return await db.AuditLog.AsNoTracking()
            .Where(entry => entry.EntityId == entityId && entry.Action == action && entry.At >= since)
            .ToListAsync();
    }

    private async Task<JsonElement> ListedRowAsync(AuthSession admin, string id)
    {
        var listed = await SendAsync(admin, HttpMethod.Get, "/api/v1/users");
        Assert.True(listed.Status == HttpStatusCode.OK, Describe("list users", listed));
        return JsonDocument.Parse(listed.Body).RootElement.GetProperty("items").EnumerateArray()
            .Single(item => item.GetProperty("id").GetString() == id).Clone();
    }

    /// <summary>Changes a role in the database only, as an out-of-band demotion would; the user's tokens keep their old role claim.</summary>
    private async Task SetRoleDirectlyAsync(string id, string from, string to)
    {
        using var scope = _factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await users.FindByIdAsync(id);
        Assert.NotNull(user);
        Assert.True((await users.RemoveFromRoleAsync(user, from)).Succeeded);
        Assert.True((await users.AddToRoleAsync(user, to)).Succeeded);
    }

    private async Task DeactivateDirectlyAsync(string id)
    {
        using var scope = _factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await users.FindByIdAsync(id);
        Assert.NotNull(user);
        user.LockoutEnabled = true;
        user.LockoutEnd = DateTimeOffset.MaxValue;
        Assert.True((await users.UpdateAsync(user)).Succeeded);
    }

    /// <summary>Clean-up (F-10): no extra active admin, and no reactivated user, is left behind.</summary>
    private async Task DeactivateQuietlyAsync(string id)
    {
        using var scope = _factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await users.FindByIdAsync(id);
        if (user is null || IsDeactivated(user))
            return;
        user.LockoutEnabled = true;
        user.LockoutEnd = DateTimeOffset.MaxValue;
        var updated = await users.UpdateAsync(user);
        if (!updated.Succeeded)
            _output.WriteLine($"Clean-up could not deactivate {id}: {string.Join(", ", updated.Errors.Select(error => error.Code))}");
    }

    private async Task RestoreLockoutsAsync(List<(string Id, bool Enabled, DateTimeOffset? End)> saved)
    {
        using var scope = _factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        foreach (var (id, enabled, end) in saved)
        {
            var user = await users.FindByIdAsync(id);
            if (user is null)
                continue;
            user.LockoutEnabled = enabled;
            user.LockoutEnd = end;
            var updated = await users.UpdateAsync(user);
            if (!updated.Succeeded)
                _output.WriteLine($"Clean-up could not restore the lockout of {id}: {string.Join(", ", updated.Errors.Select(error => error.Code))}");
        }
    }

    private async Task<HttpStatusCode> StatusAsync(AuthSession session, HttpMethod method, string url)
    {
        using var response = await _client.SendAsync(session.Authorized(method, url));
        return response.StatusCode;
    }

    private async Task<(HttpStatusCode Status, string Body)> SendAsync(AuthSession session, HttpMethod method, string url, object? body = null)
    {
        var request = session.Authorized(method, url);
        if (body is not null)
            request.Content = JsonContent.Create(body);
        using var response = await _client.SendAsync(request);
        return (response.StatusCode, await response.Content.ReadAsStringAsync());
    }

    /// <summary>A raw JSON body, sent with its Content-Length.</summary>
    private async Task<(HttpStatusCode Status, string Body)> SendRawAsync(AuthSession session, HttpMethod method, string url, string json)
    {
        var request = session.Authorized(method, url);
        request.Content = new StringContent(json, Encoding.UTF8, "application/json");
        using var response = await _client.SendAsync(request);
        return (response.StatusCode, await response.Content.ReadAsStringAsync());
    }

    private static string? Code(string body)
    {
        if (string.IsNullOrWhiteSpace(body))
            return null;
        try
        {
            var root = JsonDocument.Parse(body).RootElement;
            return root.ValueKind == JsonValueKind.Object && root.TryGetProperty("code", out var code) ? code.GetString() : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string Describe(string step, (HttpStatusCode Status, string Body) result) =>
        $"{step}: {(int)result.Status} {result.Body}";
}
