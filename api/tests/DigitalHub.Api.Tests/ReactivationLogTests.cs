using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DigitalHub.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Serilog.Core;
using Serilog.Events;

namespace DigitalHub.Api.Tests;

/// <summary>
/// ADM-04 (review F-2): the temporary password a reactivation returns is in no event the
/// application logs, at any level, and in no audit row. The sink is registered in the test
/// host (as RateLimitLogTests.LoggingFactory does), so it receives the API's own events,
/// including the request log.
/// </summary>
[Collection("SqlServer")]
public sealed class ReactivationLogTests : IClassFixture<ReactivationLogTests.LoggingFactory>
{
    private readonly LoggingFactory _factory;
    private readonly HttpClient _client;

    public ReactivationLogTests(LoggingFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    // T10
    [Fact]
    public async Task A_reactivation_password_appears_in_no_application_log_event_and_no_audit_row()
    {
        await EnsurePrimaryAdminActiveAsync();
        var admin = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        Assert.Equal(HttpStatusCode.OK, admin.Status);
        var email = "adm04-t10-" + Guid.NewGuid().ToString("N")[..8] + "@digitalhub.test";
        var created = await SendAsync(admin, HttpMethod.Post, "/api/v1/users", new { email, role = "editor", password = TestPassphrase.New() });
        Assert.True(created.Status == HttpStatusCode.Created, $"create: {(int)created.Status} {created.Body}");
        var id = JsonDocument.Parse(created.Body).RootElement.GetProperty("id").GetString()!;
        var deactivated = await SendAsync(admin, HttpMethod.Post, $"/api/v1/users/{id}/deactivate");
        Assert.True(deactivated.Status == HttpStatusCode.OK, $"deactivate: {(int)deactivated.Status} {deactivated.Body}");
        try
        {
            _factory.Sink.Clear();
            var reactivated = await SendAsync(admin, HttpMethod.Post, $"/api/v1/users/{id}/reactivate");
            Assert.True(reactivated.Status == HttpStatusCode.OK, $"reactivate: {(int)reactivated.Status} {reactivated.Body}");
            var temporary = JsonDocument.Parse(reactivated.Body).RootElement.GetProperty("temporaryPassword").GetString();
            Assert.NotNull(temporary);
            Assert.NotEmpty(temporary);

            // The request log line for this request, so the test cannot pass on an empty sink.
            var path = $"/api/v1/users/{id}/reactivate";
            var until = DateTime.UtcNow.AddSeconds(2);
            while (!_factory.Sink.Snapshot().Any(item => item.RenderMessage().Contains(path, StringComparison.Ordinal)) && DateTime.UtcNow < until)
                await Task.Delay(50);
            var events = _factory.Sink.Snapshot();
            Assert.Contains(events, item => item.RenderMessage().Contains(path, StringComparison.Ordinal));

            foreach (var item in events)
            {
                Assert.DoesNotContain(temporary, item.RenderMessage(), StringComparison.Ordinal);
                foreach (var property in item.Properties)
                    Assert.DoesNotContain(temporary, property.Value.ToString(), StringComparison.Ordinal);
                if (item.Exception is not null)
                    Assert.DoesNotContain(temporary, item.Exception.ToString(), StringComparison.Ordinal);
            }

            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            var entry = await db.AuditLog.AsNoTracking()
                .Where(row => row.Action == "reactivate_user" && row.EntityId == id)
                .OrderByDescending(row => row.At)
                .FirstAsync();
            Assert.DoesNotContain(temporary, entry.Detail ?? "", StringComparison.Ordinal);
        }
        finally
        {
            await DeactivateQuietlyAsync(id);
        }
    }

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

    private async Task DeactivateQuietlyAsync(string id)
    {
        using var scope = _factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await users.FindByIdAsync(id);
        if (user is null || (user.LockoutEnabled && user.LockoutEnd is not null && user.LockoutEnd > DateTimeOffset.UtcNow))
            return;
        user.LockoutEnabled = true;
        user.LockoutEnd = DateTimeOffset.MaxValue;
        await users.UpdateAsync(user);
    }

    private async Task<(HttpStatusCode Status, string Body)> SendAsync(AuthSession session, HttpMethod method, string url, object? body = null)
    {
        var request = session.Authorized(method, url);
        if (body is not null)
            request.Content = JsonContent.Create(body);
        using var response = await _client.SendAsync(request);
        return (response.StatusCode, await response.Content.ReadAsStringAsync());
    }

    /// <summary>A test host whose log reaches the sink at every level, from every source.</summary>
    public sealed class LoggingFactory : ApiFactory
    {
        public EventSink Sink { get; } = new();

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.UseSetting("Serilog:MinimumLevel:Default", "Verbose");
            builder.UseSetting("Serilog:MinimumLevel:Override:Microsoft.AspNetCore", "Verbose");
            builder.UseSetting("Serilog:MinimumLevel:Override:Microsoft.EntityFrameworkCore", "Verbose");
            builder.ConfigureTestServices(services => services.AddSingleton<ILogEventSink>(Sink));
        }
    }

    /// <summary>A thread-safe list of the events the application logs.</summary>
    public sealed class EventSink : ILogEventSink
    {
        private readonly ConcurrentQueue<LogEvent> _events = new();

        public void Emit(LogEvent logEvent) => _events.Enqueue(logEvent);

        public void Clear() => _events.Clear();

        public List<LogEvent> Snapshot() => _events.ToList();
    }
}
