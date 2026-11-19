using System.Collections.Concurrent;
using System.Data.Common;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DigitalHub.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Xunit.Abstractions;

namespace DigitalHub.Api.Tests;

/// <summary>
/// ADM-04 (review F-1, F-6, R2-1, R2-2): a role change reads the target, the admins and the
/// actor inside the users lock, so two admins demoting each other at once cannot both
/// succeed (T15), and an admin deactivated while their change waits cannot finish it (T16).
///
/// The gate holds reader commands on [AspNetUserRoles] that carry an armed user id. The
/// store makes that read only after the lock; authentication never makes it (SessionCheck
/// reads AspNetUsers and RefreshTokens, the JWT handler reads claims). Sign-in does read
/// it, so every sign-in happens before the gate is armed, and each test starts with a
/// warm-up that proves an authenticated request matches nothing.
/// </summary>
[Collection("SqlServer")]
public sealed class UserRoleConcurrencyTests : IClassFixture<UserRoleConcurrencyTests.GatedUsersFactory>
{
    /*
     * The gate's cap and the API's lock timeout are coupled. At green, the second of
     * T15's two requests waits in sp_getapplock while the gate holds the first one's
     * target roles read, for up to GateCap. So GateCap (2 s) must stay well under the
     * users lock timeout (5 s, UserAccessStore.UsersLockSql, @LockTimeout = 5000), or
     * T15 turns into a 503 at green. Change the two together.
     */
    private static readonly TimeSpan GateCap = TimeSpan.FromSeconds(2);
    private const int LockTimeoutMilliseconds = 5000;

    // T16's manual hold is released by the test; this only stops a broken run hanging.
    private static readonly TimeSpan ManualSafetyCap = TimeSpan.FromSeconds(10);

    private readonly GatedUsersFactory _factory;
    private readonly HttpClient _client;
    private readonly ITestOutputHelper _output;

    public UserRoleConcurrencyTests(GatedUsersFactory factory, ITestOutputHelper output)
    {
        _factory = factory;
        _client = factory.CreateClient();
        _output = output;
    }

    // T15
    [Fact]
    public async Task Two_admins_demoting_each_other_at_once_leave_one_admin()
    {
        Assert.True(GateCap.TotalMilliseconds * 2 <= LockTimeoutMilliseconds, "The gate's cap must stay well under the lock timeout.");
        var admin = await AdminAsync();
        var aEmail = NewEmail("t15-a");
        var bEmail = NewEmail("t15-b");
        var password = TestPassphrase.New();
        var a = await CreateUserAsync(admin, aEmail, "admin", password);
        var b = await CreateUserAsync(admin, bEmail, "admin", password);
        var sent = new ConcurrentQueue<string>();
        try
        {
            var aSession = await AuthSession.LoginAsync(_client, aEmail, password);
            var bSession = await AuthSession.LoginAsync(_client, bEmail, password);
            Assert.Equal(HttpStatusCode.OK, aSession.Status);
            Assert.Equal(HttpStatusCode.OK, bSession.Status);

            await WarmUpAsync([a, b], aSession, bSession);

            _factory.Gate.Arm([a, b], GateCap, manual: false);
            (HttpStatusCode Status, string Body)[] results;
            try
            {
                results = await Task.WhenAll(
                    ChangeRoleAsync("A demotes B", aSession, b, "editor", sent),
                    ChangeRoleAsync("B demotes A", bSession, a, "editor", sent));
            }
            finally
            {
                _factory.Gate.Disarm();
            }

            WriteTimeline(sent);
            var described = string.Join(" | ", results.Select(result => $"{(int)result.Status} {result.Body}"));
            Assert.True(results.All(result => (int)result.Status < 500), "A role change failed on the server: " + described);
            Assert.True(results.Count(result => result.Status == HttpStatusCode.OK) == 1, "Expected exactly one 200: " + described);
            var refused = Assert.Single(results, result => result.Status != HttpStatusCode.OK);
            Assert.True(refused.Status == HttpStatusCode.Forbidden && Code(refused.Body) == "forbidden", "Expected 403 forbidden: " + described);

            var aAdmin = (await RolesAsync(a)).Contains("admin");
            var bAdmin = (await RolesAsync(b)).Contains("admin");
            Assert.True(aAdmin != bAdmin, $"Expected exactly one of A and B to stay admin: A {aAdmin}, B {bAdmin}.");

            var matches = _factory.Gate.Matches;
            Assert.True(matches.Count == 1, $"Expected exactly one held [AspNetUserRoles] read, got {matches.Count}. A read before the lock matches too.");
            Assert.Contains("[AspNetUserRoles]", matches[0].CommandText, StringComparison.Ordinal);
        }
        finally
        {
            _factory.Gate.Disarm();
            await DeactivateQuietlyAsync(a);
            await DeactivateQuietlyAsync(b);
        }
    }

    // T16
    [Fact]
    public async Task An_admin_deactivated_while_their_role_change_waits_cannot_finish_it()
    {
        var admin = await AdminAsync();
        var bEmail = NewEmail("t16-b");
        var xEmail = NewEmail("t16-x");
        var password = TestPassphrase.New();
        var b = await CreateUserAsync(admin, bEmail, "admin", password);
        var x = await CreateUserAsync(admin, xEmail, "editor", password);
        var sent = new ConcurrentQueue<string>();
        try
        {
            var bSession = await AuthSession.LoginAsync(_client, bEmail, password);
            var xSession = await AuthSession.LoginAsync(_client, xEmail, password);
            Assert.Equal(HttpStatusCode.OK, bSession.Status);
            Assert.Equal(HttpStatusCode.OK, xSession.Status);
            var xStamp = (await LoadAsync(x)).SecurityStamp;

            await WarmUpAsync([x], bSession, xSession);

            _factory.Gate.Arm([x], ManualSafetyCap, manual: true);
            (HttpStatusCode Status, string Body) result;
            try
            {
                var pending = ChangeRoleAsync("B changes X to hr", bSession, x, "hr", sent);

                // B's request now holds the users lock and is held at X's roles read.
                var reached = await WaitForMatchesAsync(1, TimeSpan.FromSeconds(5));
                Assert.True(reached, $"B's role change never reached X's roles read inside the users lock (Matched {_factory.Gate.Matched}); the route, the store or the read is not where the plan puts it.");

                // A direct write to AspNetUsers, with no app lock, so it does not wait on B's request.
                await DeactivateDirectlyAsync(b);
                sent.Enqueue($"{Now()} B deactivated in the database while held");
                _factory.Gate.Release();
                result = await pending;
            }
            finally
            {
                _factory.Gate.Release();
                _factory.Gate.Disarm();
            }

            WriteTimeline(sent);
            Assert.True(result.Status == HttpStatusCode.Forbidden && Code(result.Body) == "forbidden", $"Expected 403 forbidden: {(int)result.Status} {result.Body}");
            Assert.Equal(["editor"], await RolesAsync(x));
            Assert.Equal(xStamp, (await LoadAsync(x)).SecurityStamp);
            Assert.True(await xSession.IsLiveAsync(_client), "X's session ended although X's role was not changed.");
        }
        finally
        {
            _factory.Gate.Release();
            _factory.Gate.Disarm();
            await DeactivateQuietlyAsync(x);
            // B is left deactivated.
            await DeactivateQuietlyAsync(b);
        }
    }

    /// <summary>
    /// Armed, each signed-in session sends an authenticated GET /api/v1/pages. That runs
    /// SessionCheck, and ContentStore reads no users or roles, so nothing may match (R2-1).
    /// </summary>
    private async Task WarmUpAsync(IReadOnlyCollection<string> ids, params AuthSession[] sessions)
    {
        _factory.Gate.Arm(ids, GateCap, manual: false);
        try
        {
            foreach (var session in sessions)
            {
                using var response = await _client.SendAsync(session.Authorized(HttpMethod.Get, "/api/v1/pages"));
                Assert.True(response.StatusCode == HttpStatusCode.OK, $"warm-up GET /api/v1/pages: {(int)response.StatusCode}");
            }

            var matches = _factory.Gate.Matches;
            Assert.True(matches.Count == 0, "An authenticated request matched the gate, so it would hold authentication, not the store: "
                + string.Join(" || ", matches.Select(match => match.CommandText)));
            _output.WriteLine($"{Now()} warm-up: {sessions.Length} authenticated requests, Matched 0");
        }
        finally
        {
            _factory.Gate.Disarm();
        }
    }

    private async Task<(HttpStatusCode Status, string Body)> ChangeRoleAsync(string label, AuthSession session, string id, string role, ConcurrentQueue<string> sent)
    {
        var request = session.Authorized(HttpMethod.Put, $"/api/v1/users/{id}/role");
        request.Content = JsonContent.Create(new { role });
        sent.Enqueue($"{Now()} sent: {label}");
        try
        {
            using var response = await _client.SendAsync(request);
            var body = await response.Content.ReadAsStringAsync();
            sent.Enqueue($"{Now()} answered: {label}: {(int)response.StatusCode}");
            return (response.StatusCode, body);
        }
        catch (Exception exception) when (exception is not Xunit.Sdk.XunitException)
        {
            return (HttpStatusCode.InternalServerError, "exception: " + exception.GetType().Name + ": " + exception.Message);
        }
    }

    private async Task<bool> WaitForMatchesAsync(int count, TimeSpan limit)
    {
        var until = DateTime.UtcNow + limit;
        while (DateTime.UtcNow < until)
        {
            if (_factory.Gate.Matched >= count)
                return true;
            await Task.Delay(50);
        }

        return _factory.Gate.Matched >= count;
    }

    /// <summary>
    /// C5: the time each request was sent and answered, each users-lock call and each
    /// matched read (with its CommandText), in one timeline.
    /// </summary>
    private void WriteTimeline(ConcurrentQueue<string> sent)
    {
        var lines = sent.ToList();
        lines.AddRange(_factory.Gate.LockCalls.Select(call => $"{call} users lock requested (sp_getapplock)"));
        lines.AddRange(_factory.Gate.Matches.Select(match => $"{match.At} matched [{match.Parameters}]: {match.CommandText.ReplaceLineEndings(" ")}"));
        foreach (var line in lines.OrderBy(line => line[..12], StringComparer.Ordinal))
            _output.WriteLine(line);
        _output.WriteLine($"Matched {_factory.Gate.Matched}; gate cap {GateCap.TotalMilliseconds:0} ms.");
    }

    private static string Now() => DateTime.UtcNow.ToString("HH:mm:ss.fff");

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

    private async Task<string> CreateUserAsync(AuthSession admin, string email, string role, string password)
    {
        var request = admin.Authorized(HttpMethod.Post, "/api/v1/users");
        request.Content = JsonContent.Create(new { email, role, password });
        using var response = await _client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == HttpStatusCode.Created, $"create {email}: {(int)response.StatusCode} {body}");
        return JsonDocument.Parse(body).RootElement.GetProperty("id").GetString()!;
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

    /// <summary>The shared test host, with the gate on every ContentDbContext it makes.</summary>
    public sealed class GatedUsersFactory : ApiFactory
    {
        public UserRolesReadGate Gate { get; } = new();

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.ConfigureTestServices(services =>
                services.ConfigureDbContext<ContentDbContext>(options => options.AddInterceptors(Gate)));
        }
    }

    public sealed record GateMatch(string At, string CommandText, string Parameters);

    /// <summary>
    /// Modelled on RedirectConcurrencyTests.RedirectReadGate. While armed with user ids, it
    /// holds every reader command whose text contains [AspNetUserRoles] (the table filter,
    /// as ADM-07's gate filters on FROM [redirects]) and that has a parameter equal to one
    /// of the ids.
    ///
    /// Default mode (T15): it releases what it holds when two commands have matched, or
    /// after the cap, and then disarms. Manual mode (T16): it holds until Release(), or
    /// until the cap, and then disarms. Either way nothing later is held.
    ///
    /// While armed it also notes, without holding, each call of the users lock
    /// (sp_getapplock on digitalhub:admins, a non-query command), so the log shows when
    /// each request reached the store (C5).
    /// </summary>
    public sealed class UserRolesReadGate : DbCommandInterceptor
    {
        private readonly object _sync = new();
        private HashSet<string>? _ids;
        private bool _manual;
        private TimeSpan _cap;
        private TaskCompletionSource _released = NewRelease();
        private int _held;
        private int _matched;
        private readonly List<GateMatch> _matches = [];
        private readonly List<string> _lockCalls = [];

        public int Matched
        {
            get
            {
                lock (_sync)
                    return _matched;
            }
        }

        public IReadOnlyList<GateMatch> Matches
        {
            get
            {
                lock (_sync)
                    return _matches.ToList();
            }
        }

        public IReadOnlyList<string> LockCalls
        {
            get
            {
                lock (_sync)
                    return _lockCalls.ToList();
            }
        }

        public void Arm(IEnumerable<string> ids, TimeSpan cap, bool manual)
        {
            lock (_sync)
            {
                _ids = new HashSet<string>(ids, StringComparer.Ordinal);
                _cap = cap;
                _manual = manual;
                _held = 0;
                _matched = 0;
                _matches.Clear();
                _lockCalls.Clear();
                _released = NewRelease();
            }
        }

        public void Disarm()
        {
            lock (_sync)
            {
                _ids = null;
                _released.TrySetResult();
            }
        }

        /// <summary>Lets a manually held command go on, and disarms.</summary>
        public void Release() => Disarm();

        public override async ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
        {
            Task wait;
            TimeSpan cap;
            lock (_sync)
            {
                if (_ids is null || !IsMatch(command, _ids))
                    return result;
                _matched += 1;
                _held += 1;
                _matches.Add(new GateMatch(DateTime.UtcNow.ToString("HH:mm:ss.fff"), command.CommandText, Describe(command)));
                wait = _released.Task;
                cap = _cap;
                if (!_manual && _held >= 2)
                {
                    _ids = null;
                    _released.TrySetResult();
                }
            }

            await Task.WhenAny(wait, Task.Delay(cap, CancellationToken.None));
            Disarm();
            return result;
        }

        public override ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(
            DbCommand command, CommandEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            lock (_sync)
            {
                if (_ids is not null
                    && command.CommandText.Contains("sp_getapplock", StringComparison.Ordinal)
                    && command.CommandText.Contains("digitalhub:admins", StringComparison.Ordinal))
                    _lockCalls.Add(DateTime.UtcNow.ToString("HH:mm:ss.fff"));
            }

            return ValueTask.FromResult(result);
        }

        private static bool IsMatch(DbCommand command, HashSet<string> ids) =>
            command.CommandText.Contains("[AspNetUserRoles]", StringComparison.Ordinal)
            && command.Parameters.Cast<DbParameter>().Any(parameter => parameter.Value is string value && ids.Contains(value));

        private static string Describe(DbCommand command) =>
            string.Join(", ", command.Parameters.Cast<DbParameter>().Select(parameter => $"{parameter.ParameterName}={parameter.Value}"));

        private static TaskCompletionSource NewRelease() => new(TaskCreationOptions.RunContinuationsAsynchronously);
    }
}
