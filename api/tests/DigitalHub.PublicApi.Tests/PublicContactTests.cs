using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;

namespace DigitalHub.PublicApi.Tests;

/// <summary>
/// The admin API's PublicContactTests, ported to the public forms API (ISO-2):
/// the same names, inputs and assertions, with rows read through FormsDatabase.
/// New_count_returns_only_new_enquiries_for_studio is a Studio route and is not
/// ported; nor is the Studio read-back at the end of the script test.
/// </summary>
[Collection("PublicFormsSql")]
public sealed class PublicContactTests : IClassFixture<PublicContactFactory>
{
    private readonly PublicContactFactory _factory;
    private readonly HttpClient _client;

    public PublicContactTests(PublicContactFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Anonymous_contact_is_stored_as_new_without_an_ip()
    {
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var response = await _client.PostAsJsonAsync("/api/v1/public/contact", ValidBody("ok-" + suffix));
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.True(JsonDocument.Parse(body).RootElement.GetProperty("ok").GetBoolean());
        Assert.False(response.Headers.Contains("Set-Cookie"));

        var stored = Assert.Single(await FormsDatabase.ContactByEmailAsync("ok-" + suffix + "@example.com"));
        Assert.Equal("new", stored["status"]);
        Assert.Equal("ok-" + suffix, stored["name"]);
        Assert.DoesNotContain("ip", JsonSerializer.Serialize(stored), StringComparison.OrdinalIgnoreCase);
        Assert.False(stored.ContainsKey("ip_address"));
        Assert.False(stored.ContainsKey("remote_ip"));
        Assert.False(stored.ContainsKey("client_ip"));
    }

    [Fact]
    public async Task Honeypot_returns_success_and_stores_nothing()
    {
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var payload = ValidBody("bot-" + suffix);
        payload["website"] = "https://spam.example/";
        var before = await FormsDatabase.ContactCountAsync();
        var response = await _client.PostAsJsonAsync("/api/v1/public/contact", payload);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(before, await FormsDatabase.ContactCountAsync());
        Assert.Empty(await FormsDatabase.ContactByEmailAsync("bot-" + suffix + "@example.com"));
    }

    [Fact]
    public async Task Validation_rejects_missing_and_oversized_fields()
    {
        var missing = await _client.PostAsJsonAsync("/api/v1/public/contact", new { situation = "gov" });
        Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);

        var oversized = ValidBody("long-" + Guid.NewGuid().ToString("N")[..8]);
        oversized["message"] = new string('x', 4001);
        var response = await _client.PostAsJsonAsync("/api/v1/public/contact", oversized);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Equal("validation_failed", JsonDocument.Parse(body).RootElement.GetProperty("code").GetString());
        Assert.True(JsonDocument.Parse(body).RootElement.GetProperty("errors").TryGetProperty("message", out _));
    }

    [Fact]
    public async Task Rate_limit_is_ten_per_hour_per_visitor_address()
    {
        var visitor = IPAddress.Parse("198.51.100.50");
        for (var attempt = 0; attempt < 10; attempt++)
        {
            var allowed = await SendFromAsync(PublicContactFactory.ProxyAddress, visitor, ValidBody("rate-" + attempt + "-" + Guid.NewGuid().ToString("N")[..6]));
            Assert.Equal(HttpStatusCode.Created, allowed.StatusCode);
        }

        var blocked = await SendFromAsync(PublicContactFactory.ProxyAddress, visitor, ValidBody("rate-block-" + Guid.NewGuid().ToString("N")[..6]));
        Assert.Equal(HttpStatusCode.TooManyRequests, blocked.StatusCode);
        Assert.Equal("rate_limited", JsonDocument.Parse(await blocked.Content.ReadAsStringAsync()).RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Known_proxy_rate_limits_each_forwarded_visitor_separately()
    {
        var first = IPAddress.Parse("198.51.100.21");
        var second = IPAddress.Parse("198.51.100.22");

        for (var attempt = 0; attempt < 10; attempt++)
        {
            var allowed = await SendFromAsync(PublicContactFactory.ProxyAddress, first, ValidBody("sep-a-" + attempt + "-" + Guid.NewGuid().ToString("N")[..6]));
            Assert.Equal(HttpStatusCode.Created, allowed.StatusCode);
        }

        var firstBlocked = await SendFromAsync(PublicContactFactory.ProxyAddress, first, ValidBody("sep-a-block-" + Guid.NewGuid().ToString("N")[..6]));
        Assert.Equal(HttpStatusCode.TooManyRequests, firstBlocked.StatusCode);

        var secondAllowed = await SendFromAsync(PublicContactFactory.ProxyAddress, second, ValidBody("sep-b-" + Guid.NewGuid().ToString("N")[..6]));
        Assert.Equal(HttpStatusCode.Created, secondAllowed.StatusCode);
    }

    [Fact]
    public async Task Forged_forwarded_for_from_a_non_proxy_is_ignored()
    {
        var attacker = IPAddress.Parse("203.0.113.9");
        var forgedVisitor = IPAddress.Parse("198.51.100.9");

        for (var attempt = 0; attempt < 10; attempt++)
        {
            var allowed = await SendFromAsync(attacker, forgedVisitor, ValidBody("forge-" + attempt + "-" + Guid.NewGuid().ToString("N")[..6]));
            Assert.Equal(HttpStatusCode.Created, allowed.StatusCode);
        }

        var blocked = await SendFromAsync(attacker, forgedVisitor, ValidBody("forge-block-" + Guid.NewGuid().ToString("N")[..6]));
        Assert.Equal(HttpStatusCode.TooManyRequests, blocked.StatusCode);

        var otherVisitor = await SendFromAsync(PublicContactFactory.ProxyAddress, forgedVisitor, ValidBody("real-" + Guid.NewGuid().ToString("N")[..6]));
        Assert.Equal(HttpStatusCode.Created, otherVisitor.StatusCode);
    }

    [Fact]
    public async Task Script_in_a_contact_message_is_stored_unchanged()
    {
        var suffix = Guid.NewGuid().ToString("N")[..8];
        const string script = "<script>alert(1)</script>";
        var payload = ValidBody("xss-" + suffix);
        payload["message"] = script + " Please call about a programme.";
        var created = await _client.PostAsJsonAsync("/api/v1/public/contact", payload);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);

        var stored = Assert.Single(await FormsDatabase.ContactByEmailAsync("xss-" + suffix + "@example.com"));
        Assert.Equal(script + " Please call about a programme.", stored["message"]);
    }

    private async Task<HttpResponseMessage> SendFromAsync(IPAddress remote, IPAddress? forwardedFor, Dictionary<string, object?> body)
    {
        var json = JsonSerializer.Serialize(body);
        var context = await _factory.Server.SendAsync(ctx =>
        {
            ctx.Connection.RemoteIpAddress = remote;
            ctx.Request.Method = HttpMethods.Post;
            ctx.Request.Path = "/api/v1/public/contact";
            ctx.Request.ContentType = "application/json";
            if (forwardedFor is not null)
                ctx.Request.Headers["X-Forwarded-For"] = forwardedFor.ToString();
            ctx.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(json));
        });
        return new HttpResponseMessage((HttpStatusCode)context.Response.StatusCode)
        {
            Content = new StringContent(await new StreamReader(context.Response.Body).ReadToEndAsync(), Encoding.UTF8, "application/json"),
        };
    }

    internal static Dictionary<string, object?> ValidBody(string token) => new()
    {
        ["situation"] = "gov",
        ["name"] = token,
        ["organization"] = "Digital Hub",
        ["role"] = "Buyer",
        ["email"] = token + "@example.com",
        ["message"] = "We would like to talk about a digital transformation programme.",
    };
}

public sealed class PublicContactFactory : PublicApiFactory
{
    public static readonly IPAddress ProxyAddress = IPAddress.Parse("10.10.10.10");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.UseSetting("ForwardedHeaders:KnownProxies:0", ProxyAddress.ToString());
        builder.UseSetting("Contact:PermitLimit", "10");
        builder.UseSetting("Contact:WindowHours", "1");
    }
}

/// <summary>
/// The production default: <c>ForwardedHeaders:KnownProxies</c> is empty, so a
/// forged <c>X-Forwarded-For</c> must not change the address the rate limiter uses.
/// </summary>
[Collection("PublicFormsSql")]
public sealed class PublicContactEmptyProxyTests : IClassFixture<PublicContactNoProxyFactory>
{
    private readonly PublicContactNoProxyFactory _factory;

    public PublicContactEmptyProxyTests(PublicContactNoProxyFactory factory) => _factory = factory;

    [Fact]
    public async Task Empty_proxy_list_still_rate_limits_one_sender_when_the_forged_address_changes()
    {
        var sender = IPAddress.Parse("203.0.113.9");
        for (var attempt = 0; attempt < 10; attempt++)
        {
            var forged = IPAddress.Parse("198.51.100." + (attempt + 1));
            var allowed = await SendFromAsync(sender, forged, PublicContactTests.ValidBody("empty-" + attempt + "-" + Guid.NewGuid().ToString("N")[..6]));
            Assert.Equal(HttpStatusCode.Created, allowed.StatusCode);
        }

        var blocked = await SendFromAsync(sender, IPAddress.Parse("198.51.100.200"), PublicContactTests.ValidBody("empty-block-" + Guid.NewGuid().ToString("N")[..6]));
        Assert.Equal(HttpStatusCode.TooManyRequests, blocked.StatusCode);
        Assert.Equal("rate_limited", JsonDocument.Parse(await blocked.Content.ReadAsStringAsync()).RootElement.GetProperty("code").GetString());
    }

    private async Task<HttpResponseMessage> SendFromAsync(IPAddress remote, IPAddress forwardedFor, Dictionary<string, object?> body)
    {
        var json = JsonSerializer.Serialize(body);
        var context = await _factory.Server.SendAsync(ctx =>
        {
            ctx.Connection.RemoteIpAddress = remote;
            ctx.Request.Method = HttpMethods.Post;
            ctx.Request.Path = "/api/v1/public/contact";
            ctx.Request.ContentType = "application/json";
            ctx.Request.Headers["X-Forwarded-For"] = forwardedFor.ToString();
            ctx.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(json));
        });
        return new HttpResponseMessage((HttpStatusCode)context.Response.StatusCode)
        {
            Content = new StringContent(await new StreamReader(context.Response.Body).ReadToEndAsync(), Encoding.UTF8, "application/json"),
        };
    }
}

public sealed class PublicContactNoProxyFactory : PublicApiFactory
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.UseSetting("Contact:PermitLimit", "10");
        builder.UseSetting("Contact:WindowHours", "1");
    }
}
