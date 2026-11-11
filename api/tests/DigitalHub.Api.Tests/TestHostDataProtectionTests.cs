using System.Collections.Concurrent;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.DataProtection.KeyManagement;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Serilog.Core;
using Serilog.Events;

namespace DigitalHub.Api.Tests;

/// <summary>
/// FU-1 from PR #46: on Linux the default Data Protection key ring has no XML
/// encryptor, so the first test host of a run on a fresh profile logged
/// "No XML encryptor configured" at Warning, and any test that asserts no
/// warnings failed if its host happened to start first. A test host makes a key
/// here on purpose, whatever the profile holds, and must log no warning at all.
/// </summary>
[Collection("SqlServer")]
public sealed class TestHostDataProtectionTests
{
    [Fact]
    public void The_test_host_makes_a_data_protection_key_without_a_warning()
    {
        using var factory = new SinkFactory();
        var keys = factory.Services.GetRequiredService<IKeyManager>();
        var now = DateTimeOffset.UtcNow;
        keys.CreateNewKey(now, now.AddDays(90));

        Assert.Empty(factory.Sink.AtLeast(LogEventLevel.Warning));

        // Data Protection still works in the test host.
        var protector = factory.Services.GetRequiredService<IDataProtectionProvider>().CreateProtector("test");
        Assert.Equal("round trip", protector.Unprotect(protector.Protect("round trip")));
    }

    private sealed class SinkFactory : ApiFactory
    {
        public CollectingSink Sink { get; } = new();

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.ConfigureTestServices(services => services.AddSingleton<ILogEventSink>(Sink));
        }
    }

    private sealed class CollectingSink : ILogEventSink
    {
        private readonly ConcurrentQueue<(LogEventLevel Level, string Text)> _events = new();

        public void Emit(LogEvent logEvent) => _events.Enqueue((logEvent.Level, logEvent.RenderMessage()));

        public List<string> AtLeast(LogEventLevel level) => _events.Where(item => item.Level >= level).Select(item => $"{item.Level}: {item.Text}").ToList();
    }
}
