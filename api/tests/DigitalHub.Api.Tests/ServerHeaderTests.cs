using System.Net;
using System.Net.Sockets;
using System.Text;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace DigitalHub.Api.Tests;

/// <summary>
/// Finding 9 (GAP-12): the API sends no Server header. TestServer never writes
/// one, so these tests run the real API on Kestrel over a loopback socket, where
/// Kestrel itself would write "Server: Kestrel".
/// </summary>
[Collection("SqlServer")]
public sealed class ServerHeaderTests : IClassFixture<ServerHeaderTests.KestrelFactory>
{
    private readonly KestrelFactory _factory;
    private readonly HttpClient _client;

    public ServerHeaderTests(KestrelFactory factory)
    {
        _factory = factory;
        // Started here so every test, in whatever order xUnit runs them, sees a
        // started Kestrel host. StartServer is a no-op once the host is running.
        _factory.StartServer();
        _client = _factory.CreateClient();
    }

    [Fact]
    public void The_host_under_test_is_Kestrel_on_a_loopback_socket()
    {
        var server = _factory.Services.GetRequiredService<IServer>();
        Assert.IsNotType<TestServer>(server);

        var addresses = server.Features.Get<IServerAddressesFeature>();
        Assert.NotNull(addresses);
        var address = Assert.Single(addresses.Addresses);
        Assert.StartsWith("http://127.0.0.1:", address, StringComparison.Ordinal);
    }

    [Fact]
    public async Task No_server_header_on_a_success()
    {
        using var response = await _client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False(response.Headers.Contains("Server"), ServerHeaderMessage(response));
        Assert.Empty(response.Headers.Server);
    }

    [Theory]
    [InlineData("/api/v1/users")]
    [InlineData("/api/v1/gap-12-no-such-route")]
    public async Task No_server_header_on_a_problem_response(string path)
    {
        using var response = await _client.GetAsync(path);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.False(response.Headers.Contains("Server"), ServerHeaderMessage(response));
        Assert.Empty(response.Headers.Server);
    }

    [Fact]
    public async Task No_server_header_when_Kestrel_rejects_a_malformed_request()
    {
        var address = new Uri(Assert.Single(
            _factory.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses));

        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        using var tcp = new TcpClient();
        await tcp.ConnectAsync(IPAddress.Loopback, address.Port, timeout.Token);
        await using var stream = tcp.GetStream();

        // A header line without a colon: Kestrel answers 400 itself, before any
        // middleware runs.
        var request = Encoding.ASCII.GetBytes("GET / HTTP/1.1\r\nHost: localhost\r\nBad Header\r\n\r\n");
        await stream.WriteAsync(request, timeout.Token);

        var head = await ReadResponseHeadAsync(stream, timeout.Token);
        var lines = head.Split("\r\n", StringSplitOptions.RemoveEmptyEntries);

        Assert.StartsWith("HTTP/1.1 400", lines[0], StringComparison.Ordinal);
        Assert.DoesNotContain(lines, line => line.StartsWith("Server:", StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>Reads up to the blank line that ends the response head.</summary>
    private static async Task<string> ReadResponseHeadAsync(NetworkStream stream, CancellationToken cancellationToken)
    {
        var received = new StringBuilder();
        var buffer = new byte[1024];
        while (!received.ToString().Contains("\r\n\r\n", StringComparison.Ordinal))
        {
            var read = await stream.ReadAsync(buffer, cancellationToken);
            if (read == 0)
                break;
            received.Append(Encoding.ASCII.GetString(buffer, 0, read));
        }

        var text = received.ToString();
        var end = text.IndexOf("\r\n\r\n", StringComparison.Ordinal);
        return end < 0 ? text : text[..end];
    }

    private static string ServerHeaderMessage(HttpResponseMessage response) =>
        "Unexpected Server header: " + string.Join(", ", response.Headers.Server.Select(item => item.ToString()));

    /// <summary>
    /// The shared test host on real Kestrel, on 127.0.0.1 with a port the system
    /// picks. It only chooses where to listen: it must never set
    /// AddServerHeader, or it would hide a missing fix in Program.cs.
    /// </summary>
    public sealed class KestrelFactory : ApiFactory
    {
        public KestrelFactory()
        {
            UseKestrel(options => options.Listen(IPAddress.Loopback, 0));
        }
    }
}
