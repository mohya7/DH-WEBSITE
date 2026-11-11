using System.Data.Common;
using System.Diagnostics;
using System.Net;
using System.Text.Json;
using DigitalHub.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Xunit.Abstractions;

namespace DigitalHub.Api.Tests;

/// <summary>
/// ADM-07, F-1 from ADM-02's test report: a redirect's checks and its insert are one
/// unit, so concurrent creates of one address (/x and /x/ are one address in the
/// build) give exactly one redirect, and a create that cannot get the lock in time is
/// refused as busy rather than failing or inserting.
/// </summary>
[Collection("SqlServer")]
public sealed class RedirectConcurrencyTests : IClassFixture<RedirectConcurrencyTests.GatedApiFactory>
{
    /*
     * The gate's cap and the API's lock timeout are coupled. At green, the second of
     * T7's two requests waits in sp_getapplock while the gate holds the first one's
     * duplicate check, for up to GateCap. So GateCap (2 s) must stay well under the
     * lock timeout (5 s, AdminStore.CreateRedirectAsync, @LockTimeout = 5000), or T7
     * turns into a 503 at green. Change the two together.
     */
    private static readonly TimeSpan GateCap = TimeSpan.FromSeconds(2);
    private const int LockTimeoutMilliseconds = 5000;

    // The resource the API locks around a redirect create (AdminStore.CreateRedirectAsync).
    private const string LockResource = "digitalhub:redirects";

    private readonly GatedApiFactory _factory;
    private readonly HttpClient _client;
    private readonly ITestOutputHelper _output;

    public RedirectConcurrencyTests(GatedApiFactory factory, ITestOutputHelper output)
    {
        _factory = factory;
        _client = factory.CreateClient();
        _output = output;
    }

    [Theory]
    [InlineData("", "/")]
    [InlineData("/", "")]
    [InlineData("", "")]
    public async Task Two_creates_of_one_address_at_once_give_one_redirect(string firstSuffix, string secondSuffix)
    {
        Assert.True(GateCap.TotalMilliseconds * 2 <= LockTimeoutMilliseconds, "The gate's cap must stay well under the lock timeout.");
        await using var run = await Adm07Run.StartAsync(_factory, _client);
        await WarmUpAsync(run);
        var path = "/" + run.Marker;

        _factory.Gate.Arm(run.Marker, GateCap);
        (HttpStatusCode Status, string Body)[] results;
        try
        {
            results = await Task.WhenAll(
                CreateAsync(run, path + firstSuffix, "/"),
                CreateAsync(run, path + secondSuffix, "/"));
        }
        finally
        {
            _factory.Gate.Disarm();
        }

        var described = string.Join(" | ", results.Select(result => $"{(int)result.Status} {result.Body}"));
        Assert.True(_factory.Gate.Matched >= 1, "The gate saw no duplicate check for the marker, so the test proves nothing: " + described);
        Assert.True(results.All(result => (int)result.Status < 500), "A create failed on the server: " + described);
        Assert.True(results.Count(result => result.Status == HttpStatusCode.Created) == 1, "Expected exactly one 201: " + described);
        var refused = Assert.Single(results, result => result.Status != HttpStatusCode.Created);
        Assert.True(refused.Status == HttpStatusCode.Conflict && Adm02Run.Code(refused.Body) == "redirect_exists", "Expected 409 redirect_exists: " + described);
        Assert.Equal(1, await RowsAtAsync(path));
    }

    [Fact]
    public async Task Many_creates_of_one_address_at_once_give_one_redirect()
    {
        await using var run = await Adm07Run.StartAsync(_factory, _client);
        await WarmUpAsync(run);
        var failures = new List<string>();

        for (var round = 1; round <= 5; round += 1)
        {
            var path = "/" + run.Marker + "-r" + round;
            var results = await Task.WhenAll(Enumerable.Range(0, 8).Select(async index =>
            {
                var clock = Stopwatch.StartNew();
                var result = await CreateAsync(run, index % 2 == 0 ? path : path + "/", "/");
                return (result.Status, result.Body, clock.Elapsed);
            }));

            var slowest = results.Max(result => result.Elapsed);
            _output.WriteLine($"Round {round}: slowest request {slowest.TotalMilliseconds:0} ms; statuses {string.Join(", ", results.Select(result => (int)result.Status))}.");

            var described = string.Join(" | ", results.Select(result => $"{(int)result.Status} {result.Body}"));
            var created = results.Count(result => result.Status == HttpStatusCode.Created);
            var conflicts = results.Count(result => result.Status == HttpStatusCode.Conflict && Adm02Run.Code(result.Body) == "redirect_exists");
            if (created != 1 || conflicts != 7 || results.Any(result => (int)result.Status >= 500))
                failures.Add($"Round {round}: {created} created, {conflicts} redirect_exists: {described}");
            var rows = await RowsAtAsync(path);
            if (rows != 1)
                failures.Add($"Round {round}: {rows} rows at {path}");
        }

        Assert.True(failures.Count == 0, string.Join(Environment.NewLine, failures));
    }

    [Fact]
    public async Task A_create_that_cannot_get_the_lock_in_time_is_refused_as_busy()
    {
        await using var run = await Adm07Run.StartAsync(_factory, _client);
        var path = "/" + run.Marker + "-busy";

        // Another session holds the redirects lock for longer than the API waits.
        // An application lock belongs to the database, so it blocks the API's own login.
        var holder = new SqlConnection(ApiFactory.ElevatedTestConnectionString());
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
            var busy = await CreateAsync(run, path, "/");
            _output.WriteLine($"The refused create took {clock.Elapsed.TotalMilliseconds:0} ms.");
            Assert.True(busy.Status == HttpStatusCode.ServiceUnavailable, $"Expected 503 while the lock is held: {(int)busy.Status} {busy.Body}");
            Assert.Equal("redirect_busy", Adm02Run.Code(busy.Body));

            var listed = await run.SendAsync(HttpMethod.Get, "/api/v1/redirects?search=" + Uri.EscapeDataString(run.Marker + "-busy"));
            Assert.Equal(HttpStatusCode.OK, listed.Status);
            Assert.True(JsonDocument.Parse(listed.Body).RootElement.GetProperty("total").GetInt32() == 0, "The refused create left a row: " + listed.Body);
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

        var created = await CreateAsync(run, path, "/");
        Assert.True(created.Status == HttpStatusCode.Created, $"Expected 201 once the lock is released: {(int)created.Status} {created.Body}");
    }

    /// <summary>
    /// One create and one delete through this factory before anything is timed, so login,
    /// the live-path and resolve queries, and the insert are compiled. On a cold factory the
    /// two gated requests can otherwise arrive more than the gate's cap apart.
    /// </summary>
    private static async Task WarmUpAsync(Adm07Run run)
    {
        var warm = await run.CreateRedirectAsync("/" + run.Marker + "-warm", "/");
        Assert.True(warm.Status == HttpStatusCode.Created, $"warm-up: {warm.Status} {warm.Body}");
        var id = JsonDocument.Parse(warm.Body).RootElement.GetProperty("id").GetGuid();
        var removed = await run.SendAsync(HttpMethod.Delete, "/api/v1/redirects/" + id);
        Assert.True(removed.Status == HttpStatusCode.NoContent, $"warm-up delete: {removed.Status} {removed.Body}");
    }

    /// <summary>A create whose exception, if the host throws, is reported as a failed status rather than lost.</summary>
    private static async Task<(HttpStatusCode Status, string Body)> CreateAsync(Adm07Run run, string from, string to)
    {
        try
        {
            return await run.CreateRedirectAsync(from, to);
        }
        catch (Exception exception) when (exception is not Xunit.Sdk.XunitException)
        {
            return (HttpStatusCode.InternalServerError, "exception: " + exception.GetType().Name + ": " + exception.Message);
        }
    }

    /// <summary>How many stored redirects start at this path's address.</summary>
    private async Task<int> RowsAtAsync(string path)
    {
        var key = path.TrimEnd('/');
        using var scope = _factory.Services.CreateScope();
        var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        return await database.Redirects.AsNoTracking().CountAsync(item => item.FromPath == key || item.FromPath == key + "/");
    }

    /// <summary>The shared test host, with the gate on every ContentDbContext it makes.</summary>
    public sealed class GatedApiFactory : ApiFactory
    {
        public RedirectReadGate Gate { get; } = new();

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.ConfigureTestServices(services =>
                services.ConfigureDbContext<ContentDbContext>(options => options.AddInterceptors(Gate)));
        }
    }

    /// <summary>
    /// Holds the API's duplicate check so two creates both run it before either inserts.
    ///
    /// While armed with a marker, it holds every reader command that reads the redirects
    /// table and has a parameter whose value contains the marker. "Contains", because the
    /// paths are /&lt;marker&gt;…; EF Core 10 sends spellings.Contains(FromPath) as one scalar
    /// parameter per element (WHERE [r].[from_path] IN (@spellings1, @spellings2), seen
    /// with ToQueryString), and a single JSON-array parameter would match too.
    ///
    /// It releases what it holds when two commands have arrived, or after the cap, and
    /// then disarms, so nothing later is held.
    /// </summary>
    public sealed class RedirectReadGate : DbCommandInterceptor
    {
        private readonly object _sync = new();
        private string? _marker;
        private TimeSpan _cap;
        private TaskCompletionSource _released = NewRelease();
        private int _held;
        private int _matched;

        public int Matched
        {
            get
            {
                lock (_sync)
                    return _matched;
            }
        }

        public void Arm(string marker, TimeSpan cap)
        {
            lock (_sync)
            {
                _marker = marker;
                _cap = cap;
                _held = 0;
                _matched = 0;
                _released = NewRelease();
            }
        }

        public void Disarm()
        {
            lock (_sync)
            {
                _marker = null;
                _released.TrySetResult();
            }
        }

        public override async ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
        {
            Task wait;
            TimeSpan cap;
            lock (_sync)
            {
                if (_marker is null || !Matches(command, _marker))
                    return result;
                _matched += 1;
                _held += 1;
                wait = _released.Task;
                cap = _cap;
                if (_held >= 2)
                {
                    _marker = null;
                    _released.TrySetResult();
                }
            }

            await Task.WhenAny(wait, Task.Delay(cap, CancellationToken.None));
            Disarm();
            return result;
        }

        private static bool Matches(DbCommand command, string marker) =>
            command.CommandText.Contains("FROM [redirects]", StringComparison.Ordinal)
            && command.Parameters.Cast<DbParameter>().Any(parameter => parameter.Value is string value && value.Contains(marker, StringComparison.Ordinal));

        private static TaskCompletionSource NewRelease() => new(TaskCreationOptions.RunContinuationsAsynchronously);
    }
}
