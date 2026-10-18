using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;

namespace DigitalHub.Api.Tests;

/// <summary>
/// Finding H1: the sign-in limits count the email the login action checks.
/// Each test has its own host, so the production limits apply and start empty.
/// </summary>
[Collection("SqlServer")]
public sealed class LoginLimitTests
{
    private static readonly IPAddress Sender = IPAddress.Parse("203.0.113.20");

    [Fact]
    public async Task Plain_bodies_are_limited_per_address_and_email_and_the_right_password_waits_too()
    {
        using var factory = new ApiFactory.RateLimited();
        for (var attempt = 0; attempt < ApiFactory.RateLimited.Limit; attempt++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(factory, Sender, Body(ApiFactory.AdminEmail, "wrong-" + attempt))).Status);

        var limited = await LoginAsync(factory, Sender, Body(ApiFactory.AdminEmail, ApiFactory.AdminPassword));
        Assert.Equal(HttpStatusCode.TooManyRequests, limited.Status);
        Assert.Equal("rate_limited", limited.Code);
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(factory, IPAddress.Parse("203.0.113.21"), Body(ApiFactory.AdminEmail, ApiFactory.AdminPassword))).Status);
    }

    [Theory]
    [InlineData("""{"email":"decoy@digitalhub.test","Email":"admin@digitalhub.test","password":"x"}""")]
    [InlineData("""{"Email":"admin@digitalhub.test","email":"decoy@digitalhub.test","password":"x"}""")]
    [InlineData("""{"EMAIL":"decoy@digitalhub.test","eMaIl":"admin@digitalhub.test","password":"x"}""")]
    [InlineData("""{"email":"admin@digitalhub.test","password":"x","Password":"y"}""")]
    public async Task A_body_that_names_a_field_twice_is_refused(string json)
    {
        using var factory = new ApiFactory.RateLimited();
        var response = await LoginAsync(factory, Sender, json);
        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Equal("duplicate_field", response.Code);
    }

    [Fact]
    public async Task The_review_attack_ends_in_400_and_never_reaches_a_password_check()
    {
        // auth1.mjs: 20 guesses at one account, each with a new decoy "email".
        using var factory = new ApiFactory.RateLimited();
        for (var attempt = 0; attempt < 20; attempt++)
        {
            var json = $$"""{"email":"decoy-{{attempt}}@digitalhub.test","Email":"{{ApiFactory.AdminEmail}}","password":"guess-{{attempt}}"}""";
            Assert.Equal(HttpStatusCode.BadRequest, (await LoginAsync(factory, Sender, json)).Status);
        }

        // The plain limit still counts from zero: the refused bodies took nothing from it.
        for (var attempt = 0; attempt < ApiFactory.RateLimited.Limit; attempt++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(factory, Sender, Body(ApiFactory.AdminEmail, "plain-" + attempt))).Status);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await LoginAsync(factory, Sender, Body(ApiFactory.AdminEmail, ApiFactory.AdminPassword))).Status);
    }

    [Fact]
    public async Task Case_and_space_variants_of_one_email_share_one_budget()
    {
        using var factory = new ApiFactory.RateLimited();
        var variants = new[] { "admin@digitalhub.test", "ADMIN@DIGITALHUB.TEST", "  Admin@DigitalHub.Test  ", "aDmIn@digitalhub.TEST" };
        for (var attempt = 0; attempt < ApiFactory.RateLimited.Limit; attempt++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(factory, Sender, Body(variants[attempt % variants.Length], "wrong-" + attempt))).Status);

        Assert.Equal(HttpStatusCode.TooManyRequests, (await LoginAsync(factory, Sender, Body("  ADMIN@digitalhub.test", ApiFactory.AdminPassword))).Status);
    }

    [Fact]
    public async Task Failed_sign_ins_across_many_emails_from_one_address_hit_the_address_ceiling()
    {
        using var factory = new ApiFactory.RateLimited();
        for (var attempt = 0; attempt < ApiFactory.RateLimited.FailureLimit; attempt++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(factory, Sender, Body($"spray-{attempt}@digitalhub.test", "wrong"))).Status);

        // The next attempt from that address is refused whatever the email, even with the right password.
        var blocked = await LoginAsync(factory, Sender, Body(ApiFactory.AdminEmail, ApiFactory.AdminPassword));
        Assert.Equal(HttpStatusCode.TooManyRequests, blocked.Status);
        Assert.Equal("rate_limited", blocked.Code);

        // Another address is not affected.
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(factory, IPAddress.Parse("203.0.113.22"), Body(ApiFactory.AdminEmail, ApiFactory.AdminPassword))).Status);
    }

    [Fact]
    public async Task Successful_sign_ins_do_not_count_toward_the_address_ceiling()
    {
        using var factory = new ApiFactory.RateLimited();
        for (var attempt = 0; attempt < ApiFactory.RateLimited.Limit; attempt++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(factory, Sender, Body($"other-{attempt}@digitalhub.test", "wrong"))).Status);
        for (var attempt = 0; attempt < ApiFactory.RateLimited.Limit; attempt++)
            Assert.Equal(HttpStatusCode.OK, (await LoginAsync(factory, Sender, Body(ApiFactory.AdminEmail, ApiFactory.AdminPassword))).Status);
    }

    internal static string Body(string email, string password) => JsonSerializer.Serialize(new { email, password });

    internal static async Task<(HttpStatusCode Status, string? Code, string Body)> LoginAsync(ApiFactory factory, IPAddress remote, string json)
    {
        var context = await factory.Server.SendAsync(ctx =>
        {
            ctx.Connection.RemoteIpAddress = remote;
            ctx.Request.Method = HttpMethods.Post;
            ctx.Request.Path = "/api/v1/auth/login";
            ctx.Request.ContentType = "application/json";
            ctx.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(json));
        });
        var body = await new StreamReader(context.Response.Body).ReadToEndAsync();
        string? code = null;
        if (body.Length > 0 && body.TrimStart().StartsWith('{'))
        {
            using var document = JsonDocument.Parse(body);
            if (document.RootElement.TryGetProperty("code", out var value))
                code = value.GetString();
        }

        return ((HttpStatusCode)context.Response.StatusCode, code, body);
    }
}
