using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DigitalHub.Api.Content;
using DigitalHub.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DigitalHub.Api.Tests;

/// <summary>
/// Finding O1, part 2: a collection's link field (x-dh-kind "url"; today the
/// team-members linkedIn) follows the section rule on create, update and
/// publish. An empty value is no link and stays allowed, as the schema allows.
/// </summary>
[Collection("SqlServer")]
public sealed class CollectionLinkTests : IClassFixture<ApiFactory>
{
    private const string Message = SectionLinks.Message;
    private readonly ApiFactory _factory;
    private readonly HttpClient _client;

    public CollectionLinkTests(ApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    public static TheoryData<string> Refused => new()
    {
        "javascript:alert(document.domain)",
        "data:text/html,<script>alert(1)</script>",
        "vbscript:msgbox(1)",
        "JaVaScRiPt:alert(1)",
        "java\tscript:alert(1)",
        "java\nscript:alert(1)",
        " javascript:alert(1)",
        "\u0001javascript:alert(1)",
        "//evil.example/in/someone",
        "linkedin.com/in/someone",
    };

    [Fact]
    public void Every_link_field_of_every_collection_is_checked()
    {
        var schemas = _factory.Services.GetRequiredService<CollectionSchemaSet>();
        var found = schemas.Documents.Keys
            .SelectMany(collection => schemas.UrlPaths(collection).Select(path => collection + ":" + string.Join('/', path)))
            .Order(StringComparer.Ordinal)
            .ToList();
        Assert.Equal(["team-members:linkedIn"], found);
    }

    [Theory]
    [MemberData(nameof(Refused))]
    public async Task Creating_a_team_member_with_a_refused_linkedIn_is_a_400(string linkedIn)
    {
        var response = await CreateAsync(new { role = "Engineer", linkedIn });
        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Contains("/linkedIn: " + Message, response.Body, StringComparison.Ordinal);
    }

    [Theory]
    [MemberData(nameof(Refused))]
    public async Task Updating_a_team_member_to_a_refused_linkedIn_is_a_400_and_changes_nothing(string linkedIn)
    {
        var (id, slug, version) = await CreateOkAsync(new { role = "Engineer", linkedIn = "https://www.linkedin.com/in/someone" });
        var editor = await AdminAsync();
        var response = await SendAsync(editor, HttpMethod.Put, $"/api/v1/team-members/{id}", new { version, slug, title = "Member", fields = new { role = "Engineer", linkedIn } });
        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Contains("/linkedIn: " + Message, response.Body, StringComparison.Ordinal);

        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        Assert.Equal("https://www.linkedin.com/in/someone", (await db.TeamMembers.AsNoTracking().SingleAsync(member => member.Id == id)).LinkedIn);
    }

    [Theory]
    [InlineData("https://www.linkedin.com/in/someone")]
    [InlineData("https://linkedin.com/in/someone")]
    [InlineData("")]
    [InlineData("   ")]
    public async Task An_ordinary_or_empty_linkedIn_still_saves(string linkedIn)
    {
        var response = await CreateAsync(new { role = "Engineer", linkedIn });
        Assert.True(response.Status == HttpStatusCode.Created, response.Body);
    }

    [Fact]
    public async Task A_null_or_absent_linkedIn_still_saves()
    {
        Assert.Equal(HttpStatusCode.Created, (await CreateAsync(new { role = "Engineer", linkedIn = (string?)null })).Status);
        Assert.Equal(HttpStatusCode.Created, (await CreateAsync(new { role = "Engineer" })).Status);
    }

    [Fact]
    public async Task A_team_member_whose_stored_linkedIn_is_bad_is_refused_at_publish()
    {
        var (id, _, version) = await CreateOkAsync(new { role = "Engineer", linkedIn = "https://www.linkedin.com/in/someone" });
        await SetLinkedInAsync(id, "javascript:alert(document.domain)");

        var editor = await AdminAsync();
        var publish = await SendAsync(editor, HttpMethod.Post, $"/api/v1/team-members/{id}/publish", new { version });
        Assert.Equal(HttpStatusCode.BadRequest, publish.Status);
        Assert.Equal("publish_blocked", JsonDocument.Parse(publish.Body).RootElement.GetProperty("code").GetString());
        Assert.Contains("/linkedIn: " + Message, publish.Body, StringComparison.Ordinal);

        await SetLinkedInAsync(id, "https://www.linkedin.com/in/someone");
        var republish = await SendAsync(editor, HttpMethod.Post, $"/api/v1/team-members/{id}/publish", new { version });
        Assert.True(republish.Status == HttpStatusCode.OK, republish.Body);
    }

    private async Task SetLinkedInAsync(Guid id, string value)
    {
        // A value the API refuses today but could already be stored: written directly.
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        var member = await db.TeamMembers.SingleAsync(item => item.Id == id);
        member.LinkedIn = value;
        await db.SaveChangesAsync();
    }

    private async Task<(Guid Id, string Slug, int Version)> CreateOkAsync(object fields)
    {
        var slug = "member-" + Guid.NewGuid().ToString("N")[..10];
        var editor = await AdminAsync();
        var created = await SendAsync(editor, HttpMethod.Post, "/api/v1/team-members", new { slug, title = "Member", fields });
        Assert.True(created.Status == HttpStatusCode.Created, created.Body);
        var json = JsonDocument.Parse(created.Body).RootElement;
        return (json.GetProperty("id").GetGuid(), slug, json.GetProperty("version").GetInt32());
    }

    private async Task<(HttpStatusCode Status, string Body)> CreateAsync(object fields)
    {
        var editor = await AdminAsync();
        return await SendAsync(editor, HttpMethod.Post, "/api/v1/team-members", new { slug = "member-" + Guid.NewGuid().ToString("N")[..10], title = "Member", fields });
    }

    private Task<AuthSession> AdminAsync() => AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);

    private async Task<(HttpStatusCode Status, string Body)> SendAsync(AuthSession session, HttpMethod method, string url, object? body = null)
    {
        var request = session.Authorized(method, url);
        if (body is not null)
            request.Content = JsonContent.Create(body);
        var response = await _client.SendAsync(request);
        return (response.StatusCode, await response.Content.ReadAsStringAsync());
    }
}
