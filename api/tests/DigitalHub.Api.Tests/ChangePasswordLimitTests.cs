using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DigitalHub.Api.Tests;

/// <summary>
/// Finding L4: change-password allows 5 wrong current passwords per user per
/// hour; then it answers 429 until the window passes.
/// </summary>
[Collection("SqlServer")]
public sealed class ChangePasswordLimitTests
{
    private const string Password = "Change-Limit-Pass-1!";

    [Fact]
    public async Task Wrong_current_passwords_are_limited_per_user()
    {
        using var factory = new ApiFactory.RateLimited();
        using var client = factory.CreateClient();
        var guesser = await SignInNewEditorAsync(client, "guess");
        var other = await SignInNewEditorAsync(client, "other");

        for (var attempt = 0; attempt < ApiFactory.RateLimited.ChangePasswordLimit; attempt++)
            Assert.Equal(HttpStatusCode.BadRequest, (await ChangeAsync(client, guesser, "guess-" + attempt, "Change-Limit-Pass-2!")).Status);

        var limited = await ChangeAsync(client, guesser, "guess-x", "Change-Limit-Pass-2!");
        Assert.Equal(HttpStatusCode.TooManyRequests, limited.Status);
        Assert.Equal("rate_limited", limited.Code);
        // Spent for the hour, even with the right current password.
        Assert.Equal(HttpStatusCode.TooManyRequests, (await ChangeAsync(client, guesser, Password, "Change-Limit-Pass-2!")).Status);

        // Another user is not affected.
        Assert.Equal(HttpStatusCode.NoContent, (await ChangeAsync(client, other, Password, "Change-Limit-Pass-2!")).Status);
    }

    [Fact]
    public async Task A_new_password_the_rules_refuse_does_not_count()
    {
        using var factory = new ApiFactory.RateLimited();
        using var client = factory.CreateClient();
        var user = await SignInNewEditorAsync(client, "weak");

        for (var attempt = 0; attempt < ApiFactory.RateLimited.ChangePasswordLimit + 2; attempt++)
            Assert.Equal(HttpStatusCode.BadRequest, (await ChangeAsync(client, user, Password, "aaaaaaaaaaaa")).Status);

        Assert.Equal(HttpStatusCode.NoContent, (await ChangeAsync(client, user, Password, "Change-Limit-Pass-2!")).Status);
    }

    private static async Task<AuthSession> SignInNewEditorAsync(HttpClient client, string label)
    {
        var email = $"limit-{label}-{Guid.NewGuid():N}"[..24] + "@digitalhub.test";
        var admin = await AuthSession.LoginAsync(client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        Assert.Equal(HttpStatusCode.OK, admin.Status);
        var create = admin.Authorized(HttpMethod.Post, "/api/v1/users");
        create.Content = JsonContent.Create(new { email, role = "editor", password = Password });
        Assert.Equal(HttpStatusCode.Created, (await client.SendAsync(create)).StatusCode);
        var session = await AuthSession.LoginAsync(client, email, Password);
        Assert.Equal(HttpStatusCode.OK, session.Status);
        return session;
    }

    private static async Task<(HttpStatusCode Status, string? Code)> ChangeAsync(HttpClient client, AuthSession session, string current, string next)
    {
        var request = session.Authorized(HttpMethod.Post, "/api/v1/auth/change-password");
        request.Headers.TryAddWithoutValidation("Cookie", session.CookieHeader);
        request.Content = JsonContent.Create(new { currentPassword = current, newPassword = next });
        var response = await client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();
        string? code = null;
        if (body.TrimStart().StartsWith('{') && JsonDocument.Parse(body).RootElement.TryGetProperty("code", out var value))
            code = value.GetString();
        return (response.StatusCode, code);
    }
}
