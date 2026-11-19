using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;

namespace DigitalHub.PublicApi.Tests;

/// <summary>
/// The contact-form half of the admin API's RequestBodyLimitTests (findings M3
/// and L7), ported to the public forms API (ISO-2): the contact form takes at
/// most 16 KB, and a full form under that is accepted.
/// </summary>
[Collection("PublicFormsSql")]
public sealed class PublicBodyLimitTests : IClassFixture<PublicApiFactory>
{
    private readonly PublicApiFactory _factory;

    public PublicBodyLimitTests(PublicApiFactory factory) => _factory = factory;

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
        Assert.Empty(await FormsDatabase.ContactByEmailAsync(marker + "@example.com"));
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
