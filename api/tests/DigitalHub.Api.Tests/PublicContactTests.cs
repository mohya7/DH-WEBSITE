using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using DigitalHub.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DigitalHub.Api.Tests;

[Collection("SqlServer")]
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

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        var stored = await db.ContactRequests.AsNoTracking()
            .SingleAsync(item => item.Email == "ok-" + suffix + "@example.com");
        Assert.Equal("new", stored.Status);
        Assert.Equal("ok-" + suffix, stored.Name);
        Assert.DoesNotContain("ip", JsonSerializer.Serialize(stored), StringComparison.OrdinalIgnoreCase);
        Assert.Null(stored.GetType().GetProperty("IpAddress"));
        Assert.Null(stored.GetType().GetProperty("RemoteIp"));
        Assert.Null(stored.GetType().GetProperty("ClientIp"));
    }

    [Fact]
    public async Task Honeypot_returns_success_and_stores_nothing()
    {
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var payload = ValidBody("bot-" + suffix);
        payload["website"] = "https://spam.example/";
        var before = await CountAsync();
        var response = await _client.PostAsJsonAsync("/api/v1/public/contact", payload);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(before, await CountAsync());
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        Assert.False(await db.ContactRequests.AnyAsync(item => item.Email == "bot-" + suffix + "@example.com"));
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
    public async Task New_count_returns_only_new_enquiries_for_studio()
    {
        var admin = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        Assert.Equal(HttpStatusCode.OK, admin.Status);
        var before = await _client.SendAsync(admin.Authorized(HttpMethod.Get, "/api/v1/contact-requests/new-count"));
        Assert.Equal(HttpStatusCode.OK, before.StatusCode);
        var beforeCount = JsonDocument.Parse(await before.Content.ReadAsStringAsync()).RootElement.GetProperty("count").GetInt32();

        Assert.Equal(HttpStatusCode.Created, (await _client.PostAsJsonAsync("/api/v1/public/contact", ValidBody("count-" + Guid.NewGuid().ToString("N")[..8]))).StatusCode);

        var after = await _client.SendAsync(admin.Authorized(HttpMethod.Get, "/api/v1/contact-requests/new-count"));
        Assert.Equal(HttpStatusCode.OK, after.StatusCode);
        Assert.Equal(beforeCount + 1, JsonDocument.Parse(await after.Content.ReadAsStringAsync()).RootElement.GetProperty("count").GetInt32());
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

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            var stored = await db.ContactRequests.AsNoTracking()
                .SingleAsync(item => item.Email == "xss-" + suffix + "@example.com");
            Assert.Equal(script + " Please call about a programme.", stored.Message);
        }

        var admin = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        Assert.Equal(HttpStatusCode.OK, admin.Status);
        var list = await _client.SendAsync(admin.Authorized(HttpMethod.Get, "/api/v1/contact-requests?search=xss-" + suffix));
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        var id = JsonDocument.Parse(await list.Content.ReadAsStringAsync()).RootElement.GetProperty("items")[0].GetProperty("id").GetGuid();
        var detail = await _client.SendAsync(admin.Authorized(HttpMethod.Get, "/api/v1/contact-requests/" + id));
        Assert.Equal(HttpStatusCode.OK, detail.StatusCode);
        var body = JsonDocument.Parse(await detail.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal(script + " Please call about a programme.", body.GetProperty("message").GetString());
    }

    private async Task<int> CountAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        return await db.ContactRequests.CountAsync();
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

    private static Dictionary<string, object?> ValidBody(string token) => new()
    {
        ["situation"] = "gov",
        ["name"] = token,
        ["organization"] = "Digital Hub",
        ["role"] = "Buyer",
        ["email"] = token + "@example.com",
        ["message"] = "We would like to talk about a digital transformation programme.",
    };
}

public sealed class PublicContactFactory : ApiFactory
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
