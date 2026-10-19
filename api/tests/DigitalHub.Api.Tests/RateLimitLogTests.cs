using System.Collections.Concurrent;
using System.Net;
using System.Text;
using System.Text.Json;
using DigitalHub.Api.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Serilog.Core;
using Serilog.Events;

namespace DigitalHub.Api.Tests;

/// <summary>
/// Finding N9: a login or contact-form 429 writes a Warning that names the path
/// and the client's network, never the email or the full address.
/// </summary>
[Collection("SqlServer")]
public sealed class RateLimitLogTests
{
    private static readonly IPAddress Sender = IPAddress.Parse("203.0.113.20");

    [Fact]
    public async Task A_refused_login_logs_a_warning_without_the_email_or_full_address()
    {
        using var factory = new LoggingFactory();
        var marker = "n9-" + Guid.NewGuid().ToString("N")[..8] + "@digitalhub.test";
        for (var attempt = 0; attempt <= ApiFactory.RateLimited.Limit; attempt++)
            await SendAsync(factory, "/api/v1/auth/login", JsonSerializer.Serialize(new { email = marker, password = "wrong-" + attempt }));

        var warnings = factory.Sink.Warnings();
        var line = Assert.Single(warnings);
        Assert.Contains("login", line, StringComparison.Ordinal);
        Assert.Contains("/api/v1/auth/login", line, StringComparison.Ordinal);
        Assert.Contains("203.0.113.0/24", line, StringComparison.Ordinal);
        Assert.DoesNotContain("203.0.113.20", line, StringComparison.Ordinal);
        Assert.DoesNotContain(marker, factory.Sink.All(), StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("wrong-", factory.Sink.All(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task A_refused_contact_submission_logs_a_warning_without_the_message()
    {
        using var factory = new LoggingFactory();
        var marker = "n9-contact-" + Guid.NewGuid().ToString("N")[..8];
        for (var attempt = 0; attempt <= 10; attempt++)
        {
            await SendAsync(factory, "/api/v1/public/contact", JsonSerializer.Serialize(new
            {
                situation = "dx",
                name = marker,
                organization = "Org",
                email = marker + "@example.com",
                message = "A message long enough to keep, " + marker,
            }));
        }

        var line = Assert.Single(factory.Sink.Warnings());
        Assert.Contains("public-contact", line, StringComparison.Ordinal);
        Assert.Contains("/api/v1/public/contact", line, StringComparison.Ordinal);
        Assert.Contains("203.0.113.0/24", line, StringComparison.Ordinal);
        Assert.DoesNotContain(marker, factory.Sink.All(), StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("203.0.113.20", "203.0.113.0/24")]
    [InlineData("::ffff:198.51.100.7", "198.51.100.0/24")]
    [InlineData("2001:db8:abcd:12:34::1", "2001:db8:abcd::/48")]
    public void The_network_drops_the_host_part(string address, string network) =>
        Assert.Equal(network, RateLimitLog.Network(IPAddress.Parse(address)));

    private static async Task SendAsync(ApiFactory factory, string path, string json)
    {
        await factory.Server.SendAsync(ctx =>
        {
            ctx.Connection.RemoteIpAddress = Sender;
            ctx.Request.Method = HttpMethods.Post;
            ctx.Request.Path = path;
            ctx.Request.ContentType = "application/json";
            ctx.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(json));
        });
    }

    private sealed class LoggingFactory : ApiFactory
    {
        public CollectingSink Sink { get; } = new();

        protected override int LoginPermitLimit => RateLimited.Limit;

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.UseSetting("Contact:PermitLimit", "10");
            builder.ConfigureTestServices(services => services.AddSingleton<ILogEventSink>(Sink));
        }
    }

    private sealed class CollectingSink : ILogEventSink
    {
        private readonly ConcurrentQueue<(LogEventLevel Level, string Text)> _events = new();

        public void Emit(LogEvent logEvent)
        {
            using var writer = new StringWriter();
            logEvent.RenderMessage(writer);
            foreach (var property in logEvent.Properties)
                writer.Write($" {property.Key}={property.Value}");
            _events.Enqueue((logEvent.Level, writer.ToString()));
        }

        public List<string> Warnings() => _events
            .Where(item => item.Level == LogEventLevel.Warning && item.Text.Contains("Rate limit", StringComparison.Ordinal))
            .Select(item => item.Text)
            .ToList();

        public string All() => string.Join('\n', _events.Select(item => item.Text));
    }
}
