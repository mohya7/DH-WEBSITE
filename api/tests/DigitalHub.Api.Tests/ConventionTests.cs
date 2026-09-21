using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace DigitalHub.Api.Tests;

public sealed class ConventionTests : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client;

    public ConventionTests(ApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Clock_returns_utc_timestamp()
    {
        var response = await _client.GetAsync("/api/v1/examples/clock");
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var at = JsonDocument.Parse(body).RootElement.GetProperty("at").GetString();
        Assert.Matches(new Regex(@"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$"), at);
    }

    [Fact]
    public async Task Notes_list_uses_the_page_envelope()
    {
        for (var i = 0; i < 3; i++)
        {
            var created = await _client.PostAsJsonAsync("/api/v1/examples/notes", new { name = $"Page {i}" });
            Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        }

        var response = await _client.GetAsync("/api/v1/examples/notes?page=1&pageSize=2");
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = JsonDocument.Parse(body).RootElement;
        Assert.Equal(2, json.GetProperty("items").GetArrayLength());
        Assert.Equal(1, json.GetProperty("page").GetInt32());
        Assert.Equal(2, json.GetProperty("pageSize").GetInt32());
        Assert.True(json.GetProperty("total").GetInt32() >= 3);
    }

    [Fact]
    public async Task Creating_a_note_without_a_name_returns_validation_problem()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/examples/notes", new { });
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var json = JsonDocument.Parse(body).RootElement;
        Assert.Equal("validation_failed", json.GetProperty("code").GetString());
        Assert.True(json.GetProperty("errors").TryGetProperty("Name", out _));
    }

    [Fact]
    public async Task Stale_note_write_returns_conflict()
    {
        var created = await _client.PostAsJsonAsync("/api/v1/examples/notes", new { name = "Alpha" });
        var createdBody = await created.Content.ReadAsStringAsync();
        var id = JsonDocument.Parse(createdBody).RootElement.GetProperty("id").GetString();

        var response = await _client.PutAsJsonAsync($"/api/v1/examples/notes/{id}", new { name = "Beta", version = 0 });
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("concurrency_conflict", JsonDocument.Parse(body).RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Unhandled_exception_hides_the_exception_text()
    {
        var response = await _client.GetAsync("/api/v1/examples/boom");
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("internal_error", JsonDocument.Parse(body).RootElement.GetProperty("code").GetString());
        Assert.DoesNotContain("SELECT", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("password", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("admin_users", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("at DigitalHub", body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Endpoint_without_an_auth_attribute_requires_a_user()
    {
        var response = await _client.GetAsync("/api/v1/examples/private");
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("unauthorized", JsonDocument.Parse(body).RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Admin_endpoint_without_a_token_requires_a_user()
    {
        var response = await _client.GetAsync("/api/v1/examples/admin");
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("unauthorized", JsonDocument.Parse(body).RootElement.GetProperty("code").GetString());
    }
}
