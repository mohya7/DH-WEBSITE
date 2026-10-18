using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using DigitalHub.Api.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DigitalHub.Api.Tests;

/// <summary>
/// Findings M3 and L7: the auth endpoints take at most 4 KB, the public contact
/// form at most 16 KB, the login email at most 254 characters, and a failed
/// sign-in keeps at most 254 characters of the typed email in the audit log.
/// </summary>
[Collection("SqlServer")]
public sealed class RequestBodyLimitTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    private readonly HttpClient _client;

    public RequestBodyLimitTests(ApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task The_reviews_million_character_email_is_refused_before_anything_is_audited(bool withLength)
    {
        var marker = "m3-" + Guid.NewGuid().ToString("N")[..8];
        var email = new string('a', 1_000_000) + marker + "@x.example";
        var response = await SendAsync("/api/v1/auth/login", JsonSerializer.Serialize(new { email, password = "x" }), withLength);

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.Status);
        Assert.Equal("too_large", response.Code);
        Assert.Equal(0, await AuditRowsContainingAsync(marker));
    }

    [Fact]
    public async Task An_email_over_254_characters_is_refused_as_invalid_and_not_audited()
    {
        var marker = "len-" + Guid.NewGuid().ToString("N")[..8];
        var email = new string('b', 300) + marker + "@x.example";
        var response = await SendAsync("/api/v1/auth/login", JsonSerializer.Serialize(new { email, password = "x" }), withLength: true);

        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Equal(0, await AuditRowsContainingAsync(marker));
    }

    [Fact]
    public async Task A_failed_sign_in_audits_the_typed_email_whole_up_to_254_characters()
    {
        var marker = Guid.NewGuid().ToString("N")[..8];
        var local = marker + new string('c', 64 - marker.Length);
        var email = local + "@" + new string('d', 180) + ".example";
        Assert.True(email.Length <= 254);
        var response = await SendAsync("/api/v1/auth/login", JsonSerializer.Serialize(new { email, password = "x" }), withLength: true);

        Assert.Equal(HttpStatusCode.Unauthorized, response.Status);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        var row = await db.AuditLog.AsNoTracking().SingleAsync(entry => entry.Action == "sign_in_failed" && entry.Detail!.StartsWith(marker));
        Assert.Equal(email, row.Detail);
    }

    [Theory]
    [InlineData("/api/v1/auth/refresh")]
    [InlineData("/api/v1/auth/logout")]
    [InlineData("/api/v1/auth/change-password")]
    public async Task Other_auth_endpoints_refuse_a_body_over_4_KB(string path)
    {
        // These actions read no body (refresh, logout) or need a signed-in user
        // first (change-password), so a body without a Content-Length is never
        // read at all; the declared length is what they refuse.
        var body = JsonSerializer.Serialize(new { padding = new string('p', 5 * 1024) });
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, (await SendAsync(path, body, withLength: true)).Status);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task The_reviews_20_MB_contact_body_is_refused_and_nothing_is_stored(bool withLength)
    {
        var marker = "l7-" + Guid.NewGuid().ToString("N")[..8];
        var body = JsonSerializer.Serialize(new
        {
            situation = "dx",
            name = marker,
            organization = "Org",
            email = marker + "@example.com",
            message = "A message long enough to be accepted.",
            padding = new string('y', 20 * 1024 * 1024),
        });
        var response = await SendAsync("/api/v1/public/contact", body, withLength, IPAddress.Parse("198.51.100.77"));

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.Status);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        Assert.False(await db.ContactRequests.AnyAsync(request => request.Name == marker));
    }

    [Fact]
    public async Task A_full_contact_form_under_16_KB_is_accepted()
    {
        var marker = "ok-" + Guid.NewGuid().ToString("N")[..8];
        var body = JsonSerializer.Serialize(new
        {
            situation = "dx",
            name = marker,
            organization = new string('o', 160),
            role = new string('r', 120),
            email = marker + "@example.com",
            message = new string('م', 4000),
        }, BrowserJson);
        Assert.True(Encoding.UTF8.GetByteCount(body) is > 8 * 1024 and < 16 * 1024);
        var response = await SendAsync("/api/v1/public/contact", body, withLength: true, IPAddress.Parse("198.51.100.78"));
        Assert.Equal(HttpStatusCode.Created, response.Status);
    }

    /// <summary>JSON as a browser's JSON.stringify sends it: non-Latin text as UTF-8 bytes, not escapes.</summary>
    private static readonly JsonSerializerOptions BrowserJson = new() { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    [Fact]
    public async Task Sign_in_still_works_with_an_ordinary_body()
    {
        var session = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        Assert.Equal(HttpStatusCode.OK, session.Status);
    }

    private async Task<int> AuditRowsContainingAsync(string marker)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        return await db.AuditLog.AsNoTracking().CountAsync(entry => entry.Detail != null && entry.Detail.Contains(marker));
    }

    private async Task<(HttpStatusCode Status, string? Code)> SendAsync(string path, string json, bool withLength, IPAddress? remote = null)
    {
        var bytes = Encoding.UTF8.GetBytes(json);
        var context = await _factory.Server.SendAsync(ctx =>
        {
            ctx.Connection.RemoteIpAddress = remote ?? IPAddress.Loopback;
            ctx.Request.Method = HttpMethods.Post;
            ctx.Request.Path = path;
            ctx.Request.ContentType = "application/json";
            if (withLength)
                ctx.Request.ContentLength = bytes.Length;
            ctx.Request.Body = new MemoryStream(bytes);
        });
        var body = await new StreamReader(context.Response.Body).ReadToEndAsync();
        string? code = null;
        if (body.TrimStart().StartsWith('{'))
        {
            using var document = JsonDocument.Parse(body);
            if (document.RootElement.TryGetProperty("code", out var value) && value.ValueKind == JsonValueKind.String)
                code = value.GetString();
        }

        return ((HttpStatusCode)context.Response.StatusCode, code);
    }
}
