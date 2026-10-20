using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace DigitalHub.Api.Tests;

/// <summary>
/// P3 a from the PR #31 check: the duplicate-field guard, first on login (H1),
/// also covers creating a user and changing a password. A body that names a
/// field twice, in any case, is refused before anything reads it.
/// </summary>
[Collection("SqlServer")]
public sealed class DuplicateFieldTests : IClassFixture<ApiFactory>
{
    private static readonly string Password = TestPassphrase.New();
    private readonly HttpClient _client;

    public DuplicateFieldTests(ApiFactory factory) => _client = factory.CreateClient();

    [Fact]
    public async Task Creating_a_user_with_two_email_keys_is_refused_and_creates_nobody()
    {
        var admin = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var first = $"dup-a-{Guid.NewGuid():N}"[..20] + "@example.test";
        var second = $"dup-b-{Guid.NewGuid():N}"[..20] + "@example.test";
        var request = admin.Authorized(HttpMethod.Post, "/api/v1/users");
        request.Content = Json($$"""{"email":"{{first}}","Email":"{{second}}","role":"editor","password":"{{Password}}"}""");

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("duplicate_field", Code(await response.Content.ReadAsStringAsync()));
        Assert.Equal(HttpStatusCode.Unauthorized, (await AuthSession.LoginAsync(_client, first, Password)).Status);
        Assert.Equal(HttpStatusCode.Unauthorized, (await AuthSession.LoginAsync(_client, second, Password)).Status);
    }

    [Fact]
    public async Task Changing_a_password_with_two_current_password_keys_is_refused_and_changes_nothing()
    {
        var email = await CreateEditorAsync();
        var session = await AuthSession.LoginAsync(_client, email, Password);
        var request = session.Authorized(HttpMethod.Post, "/api/v1/auth/change-password");
        // The binder would take the last key, the right password, and the change would go through.
        request.Content = Json($$"""{"currentPassword":"wrong-one-Aa1!","CurrentPassword":"{{Password}}","newPassword":"Basalt-Meadow-Quartz-58"}""");

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("duplicate_field", Code(await response.Content.ReadAsStringAsync()));
        Assert.Equal(HttpStatusCode.OK, (await AuthSession.LoginAsync(_client, email, Password)).Status);
        Assert.Equal(HttpStatusCode.Unauthorized, (await AuthSession.LoginAsync(_client, email, "Basalt-Meadow-Quartz-58")).Status);
    }

    [Fact]
    public async Task A_user_create_body_over_4_KB_is_refused_before_it_is_read()
    {
        var admin = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var request = admin.Authorized(HttpMethod.Post, "/api/v1/users");
        request.Content = JsonContent.Create(new { email = "big@example.test", role = "editor", password = Password, padding = new string('x', 5000) });
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, (await _client.SendAsync(request)).StatusCode);
    }

    private async Task<string> CreateEditorAsync()
    {
        var email = $"dupcp-{Guid.NewGuid():N}"[..20] + "@example.test";
        var admin = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var create = admin.Authorized(HttpMethod.Post, "/api/v1/users");
        create.Content = JsonContent.Create(new { email, role = "editor", password = Password });
        Assert.Equal(HttpStatusCode.Created, (await _client.SendAsync(create)).StatusCode);
        return email;
    }

    private static StringContent Json(string body) => new(body, Encoding.UTF8, "application/json");

    private static string? Code(string body) => JsonDocument.Parse(body).RootElement.GetProperty("code").GetString();
}
