using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DigitalHub.Api.Data;
using DigitalHub.Api.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace DigitalHub.Api.Tests;

/// <summary>
/// Item 14: a password that is common, a folded variant of a common one, or
/// contains the email name or "digitalhub" is refused wherever a password is set,
/// with one message. The length and character rules stay as they were.
/// </summary>
[Collection("SqlServer")]
public sealed class CommonPasswordTests : IClassFixture<ApiFactory>
{
    private const string Good = "Granite-Lantern-Velvet-Orbit-73";
    private readonly ApiFactory _factory;
    private readonly HttpClient _client;

    public CommonPasswordTests(ApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Theory]
    // (a) on the list, any case
    [InlineData("Unbelievable", "someone@example.test")]
    [InlineData("SCANDINAVIAN", "someone@example.test")]
    // (b) after folding: case, trailing digits and symbols, leetspeak
    [InlineData("Password123!", "someone@example.test")]
    [InlineData("P@ssw0rd2026!", "someone@example.test")]
    [InlineData("Sunshine2026!!", "someone@example.test")]
    [InlineData("Dr4g0n-123456", "someone@example.test")]
    [InlineData("Qwertyu1op#99", "someone@example.test")]
    [InlineData("1l0vey0u!2026", "someone@example.test")]
    // (c) the email name (4 characters or more) or the site name, any case
    [InlineData("Ali.Mohi1234!", "ali.mohi@digitalhub.test")]
    [InlineData("xx-ALI.MOHI-Quartz9", "ali.mohi@example.test")]
    [InlineData("Digitalhub2026!", "someone@example.test")]
    [InlineData("My-DIGITALHUB-key-9", "someone@example.test")]
    [InlineData("D1g1t4lHub-Key-99", "someone@example.test")]
    public async Task A_common_password_is_refused_with_the_one_message(string password, string email)
    {
        // Some listed words also miss Identity's character rules; those errors are unchanged.
        var result = await ValidateAsync(password, email);
        var error = Assert.Single(result.Errors, candidate => candidate.Code == CommonPasswordValidator.ErrorCode);
        Assert.Equal(CommonPasswordValidator.Message, error.Description);
    }

    [Theory]
    [InlineData("Granite-Lantern-Velvet-Orbit-73", "someone@example.test")]
    [InlineData("vT9#qLm2$wXr8!Kp", "someone@example.test")]
    // An email name under 4 characters is not checked.
    [InlineData("Granite-ali-Velvet-73", "ali@example.test")]
    public async Task An_uncommon_password_passes(string password, string email)
    {
        var result = await ValidateAsync(password, email);
        Assert.True(result.Succeeded, string.Join(", ", result.Errors.Select(error => error.Code)));
    }

    [Fact]
    public async Task The_length_rule_applies_first_and_alone()
    {
        // Short and common: only Identity's length error, not the common-password one.
        var result = await ValidateAsync("Password1!", "someone@example.test");
        Assert.Contains(result.Errors, error => error.Code == nameof(IdentityErrorDescriber.PasswordTooShort));
        Assert.DoesNotContain(result.Errors, error => error.Code == CommonPasswordValidator.ErrorCode);
    }

    [Fact]
    public async Task The_character_rules_are_unchanged()
    {
        var result = await ValidateAsync("granite-lantern-velvet", "someone@example.test");
        Assert.Contains(result.Errors, error => error.Code == nameof(IdentityErrorDescriber.PasswordRequiresUpper));
        Assert.Contains(result.Errors, error => error.Code == nameof(IdentityErrorDescriber.PasswordRequiresDigit));
        Assert.DoesNotContain(result.Errors, error => error.Code == CommonPasswordValidator.ErrorCode);
    }

    [Fact]
    public async Task The_list_is_read_once_not_per_request()
    {
        await ValidateAsync(Good, "someone@example.test");
        var loads = CommonPasswordValidator.Loads;
        for (var i = 0; i < 50; i++)
            await ValidateAsync("Password123!", "someone@example.test");
        await CreateUserAsync($"once-{Guid.NewGuid():N}"[..20] + "@example.test", "Password123!");
        Assert.Equal(1, loads);
        Assert.Equal(1, CommonPasswordValidator.Loads);
    }

    [Fact]
    public async Task Creating_a_user_with_a_common_password_gets_the_message_as_the_title()
    {
        var response = await CreateUserAsync($"common-{Guid.NewGuid():N}"[..22] + "@example.test", "Password123!");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal(CommonPasswordValidator.Message, body.GetProperty("title").GetString());
        Assert.True(body.GetProperty("errors").TryGetProperty(CommonPasswordValidator.ErrorCode, out _));

        Assert.Equal(HttpStatusCode.Created, (await CreateUserAsync($"good-{Guid.NewGuid():N}"[..20] + "@example.test", Good)).StatusCode);
    }

    [Fact]
    public async Task Changing_to_a_common_password_gets_the_message_and_keeps_the_old_one()
    {
        var email = $"change-{Guid.NewGuid():N}"[..22] + "@example.test";
        Assert.Equal(HttpStatusCode.Created, (await CreateUserAsync(email, Good)).StatusCode);
        var session = await AuthSession.LoginAsync(_client, email, Good);

        var change = session.Authorized(HttpMethod.Post, "/api/v1/auth/change-password");
        change.Content = JsonContent.Create(new { currentPassword = Good, newPassword = "Digitalhub2026!" });
        var response = await _client.SendAsync(change);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(CommonPasswordValidator.Message, JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.GetProperty("title").GetString());
        Assert.Equal(HttpStatusCode.OK, (await AuthSession.LoginAsync(_client, email, Good)).Status);

        // A wrong current password still gets the generic answer: the new password is never judged.
        var wrong = session.Authorized(HttpMethod.Post, "/api/v1/auth/change-password");
        wrong.Content = JsonContent.Create(new { currentPassword = "not-the-password-1A!", newPassword = "Digitalhub2026!" });
        var wrongResponse = await _client.SendAsync(wrong);
        Assert.Equal("The password could not be changed.", JsonDocument.Parse(await wrongResponse.Content.ReadAsStringAsync()).RootElement.GetProperty("title").GetString());
    }

    [Fact]
    public async Task A_reset_still_gives_a_temporary_password_the_rules_accept()
    {
        var email = $"reset-{Guid.NewGuid():N}"[..21] + "@example.test";
        var created = await CreateUserAsync(email, Good);
        var id = JsonDocument.Parse(await created.Content.ReadAsStringAsync()).RootElement.GetProperty("id").GetString();
        var admin = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        for (var i = 0; i < 5; i++)
        {
            var reset = await _client.SendAsync(admin.Authorized(HttpMethod.Post, $"/api/v1/users/{id}/reset-password"));
            Assert.Equal(HttpStatusCode.OK, reset.StatusCode);
            var temporary = JsonDocument.Parse(await reset.Content.ReadAsStringAsync()).RootElement.GetProperty("temporaryPassword").GetString()!;
            Assert.False(CommonPasswordValidator.IsCommon(temporary, email));
            Assert.Equal(HttpStatusCode.OK, (await AuthSession.LoginAsync(_client, email, temporary)).Status);
        }
    }

    private async Task<IdentityResult> ValidateAsync(string password, string email)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = new ApplicationUser { UserName = email, Email = email };
        var errors = new List<IdentityError>();
        foreach (var validator in users.PasswordValidators)
            errors.AddRange((await validator.ValidateAsync(users, user, password)).Errors);
        return errors.Count == 0 ? IdentityResult.Success : IdentityResult.Failed([.. errors]);
    }

    private async Task<HttpResponseMessage> CreateUserAsync(string email, string password)
    {
        var admin = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var create = admin.Authorized(HttpMethod.Post, "/api/v1/users");
        create.Content = JsonContent.Create(new { email, role = "editor", password });
        return await _client.SendAsync(create);
    }
}
