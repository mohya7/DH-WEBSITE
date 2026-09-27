using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DigitalHub.Api.Content;
using DigitalHub.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DigitalHub.Api.Tests;

/// <summary>
/// The build content endpoint: who may read it, and that it hands over published
/// content and nothing else.
/// </summary>
[Collection("SqlServer")]
public sealed class BuildContentTests : IClassFixture<ApiFactory>
{
    private const string Url = "/api/v1/build/content";
    private const string Header = "X-Build-Token";

    private readonly ApiFactory _factory;
    private readonly HttpClient _client;

    public BuildContentTests(ApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Missing_or_wrong_token_is_refused()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.GetAsync(Url)).StatusCode);

        foreach (var wrong in new[] { "", " ", "wrong", ApiFactory.BuildTokenValue + "x", ApiFactory.BuildTokenValue[..^1] })
        {
            var request = new HttpRequestMessage(HttpMethod.Get, Url);
            request.Headers.TryAddWithoutValidation(Header, wrong);
            var response = await _client.SendAsync(request);
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
    }

    [Fact]
    public async Task A_user_login_does_not_open_the_build_endpoint()
    {
        // The token is not a role, so an admin's bearer token is not a way in.
        var admin = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var response = await _client.SendAsync(admin.Authorized(HttpMethod.Get, Url));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task The_endpoint_is_not_under_the_public_prefix()
    {
        Assert.DoesNotContain("/public/", Url, StringComparison.Ordinal);

        /* Nothing answers under the public prefix, even holding the token: an
           unmatched path is refused rather than served. */
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/public/build/content");
        request.Headers.TryAddWithoutValidation(Header, ApiFactory.BuildTokenValue);
        var response = await _client.SendAsync(request);
        Assert.NotEqual(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains(response.StatusCode, new[] { HttpStatusCode.NotFound, HttpStatusCode.Unauthorized });
    }

    [Fact]
    public async Task Drafts_are_never_included()
    {
        var admin = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var suffix = Guid.NewGuid().ToString("N")[..8];

        // A draft that was never published.
        var draft = await CreateAsync(admin, "pages", "build-draft-" + suffix, "Build draft " + suffix);

        // A published page, then an edit saved but not published.
        var published = await CreateAsync(admin, "pages", "build-live-" + suffix, "Build live " + suffix);
        await DescribeAsync(admin, "pages", published.Id);
        var ready = await GetAsync(admin, "pages", published.Id);
        await PublishAsync(admin, "pages", published.Id, ready.GetProperty("version").GetInt32());
        var reloaded = await GetAsync(admin, "pages", published.Id);
        await SaveAsync(admin, "pages", published.Id, reloaded, "Build live edited " + suffix);

        var body = await ReadBuildAsync();
        var pages = body.GetProperty("pages").EnumerateArray().ToList();

        Assert.DoesNotContain(pages, page => page.GetProperty("id").GetGuid() == draft.Id);
        var live = Assert.Single(pages, page => page.GetProperty("id").GetGuid() == published.Id);
        // The published title, not the unpublished edit.
        Assert.Equal("Build live " + suffix, live.GetProperty("title").GetString());

        Assert.DoesNotContain("build-draft-" + suffix, body.GetRawText(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task An_unpublished_reference_is_omitted_and_listed()
    {
        var admin = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var suffix = Guid.NewGuid().ToString("N")[..8];

        // A draft case study, referenced from a published page's section.
        var target = await CreateAsync(admin, "case-studies", "build-ref-" + suffix, "Build ref " + suffix);

        var host = await CreateAsync(admin, "pages", "build-host-" + suffix, "Build host " + suffix);
        var loaded = await GetAsync(admin, "pages", host.Id);
        await SaveWithSectionAsync(admin, host.Id, loaded, target.Id);
        var afterSave = await GetAsync(admin, "pages", host.Id);
        await PublishAsync(admin, "pages", host.Id, afterSave.GetProperty("version").GetInt32());

        var body = await ReadBuildAsync();

        // Not resolvable, so no path is offered for it.
        Assert.False(body.GetProperty("references").TryGetProperty("case_study:" + target.Id.ToString("D"), out _));

        // And it is reported, with where it was used.
        var listed = body.GetProperty("unresolvedReferences").EnumerateArray()
            .Where(entry => entry.GetProperty("id").GetGuid() == target.Id)
            .ToList();
        var entry = Assert.Single(listed);
        Assert.Equal("case_study", entry.GetProperty("type").GetString());
        Assert.Contains("build-host-" + suffix, entry.GetProperty("usedBy").GetString());
    }

    [Fact]
    public async Task A_published_reference_resolves_to_its_path()
    {
        var admin = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var suffix = Guid.NewGuid().ToString("N")[..8];

        var target = await CreateAsync(admin, "case-studies", "build-live-ref-" + suffix, "Build live ref " + suffix);
        await DescribeAsync(admin, "case-studies", target.Id);
        var ready = await GetAsync(admin, "case-studies", target.Id);
        await PublishAsync(admin, "case-studies", target.Id, ready.GetProperty("version").GetInt32());

        var body = await ReadBuildAsync();
        var path = body.GetProperty("references").GetProperty("case_study:" + target.Id.ToString("D")).GetString();
        Assert.Equal("/cases/build-live-ref-" + suffix, path);
    }

    [Fact]
    public async Task Nothing_from_users_audit_contact_requests_or_secrets_is_included()
    {
        var admin = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var marker = "build-probe-" + Guid.NewGuid().ToString("N")[..8];

        // A contact request and an audit entry both exist when the build runs.
        var contact = await _client.PostAsJsonAsync("/api/v1/public/contact", new
        {
            situation = "gov",
            name = marker,
            organization = "Digital Hub",
            role = "Buyer",
            email = marker + "@example.com",
            message = "A contact request that must not reach a build.",
        });
        Assert.Equal(HttpStatusCode.Created, contact.StatusCode);

        var raw = (await ReadBuildRawAsync()).ToLowerInvariant();

        // Nothing identifying a person or a credential.
        foreach (var forbidden in new[]
                 {
                     marker,
                     ApiFactory.AdminEmail,
                     ApiFactory.AdminPassword,
                     ApiFactory.SigningKey,
                     ApiFactory.BuildTokenValue,
                     "passwordhash",
                     "securitystamp",
                     "refreshtoken",
                     "contactrequest",
                     "auditlog",
                     "connectionstring",
                 })
        {
            Assert.DoesNotContain(forbidden.ToLowerInvariant(), raw, StringComparison.Ordinal);
        }

        // And the tables really do hold rows, so the check above is not vacuous.
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        Assert.True(await db.ContactRequests.AnyAsync());
        Assert.True(await db.AuditLog.AnyAsync());
        Assert.True(await db.Users.AnyAsync());
    }

    [Fact]
    public async Task The_response_carries_what_a_build_needs()
    {
        var body = await ReadBuildAsync();
        foreach (var property in new[]
                 {
                     "generatedAt", "counts", "pages", "collections", "errorPages",
                     "media", "navigation", "settings", "redirects", "references", "unresolvedReferences",
                 })
        {
            Assert.True(body.TryGetProperty(property, out _), property + " is missing");
        }

        foreach (var collection in new[] { "services", "partners", "case-studies", "blog-posts", "vacancies", "team-members", "news-items" })
            Assert.True(body.GetProperty("collections").TryGetProperty(collection, out _), collection + " is missing");

        foreach (var type in new[] { "404", "500" })
            Assert.True(body.GetProperty("errorPages").TryGetProperty(type, out _), "error page " + type + " is missing");

        // Error pages are handed over separately, not as routable pages.
        Assert.DoesNotContain(
            body.GetProperty("pages").EnumerateArray(),
            page => page.GetProperty("slug").GetString()?.StartsWith("error-", StringComparison.Ordinal) == true);
    }

    private async Task<JsonElement> ReadBuildAsync() => JsonDocument.Parse(await ReadBuildRawAsync()).RootElement.Clone();

    private async Task<string> ReadBuildRawAsync()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, Url);
        request.Headers.TryAddWithoutValidation(Header, ApiFactory.BuildTokenValue);
        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadAsStringAsync();
    }

    private async Task<(Guid Id, int Version)> CreateAsync(AuthSession session, string collection, string slug, string title)
    {
        var response = await SendAsync(session, HttpMethod.Post, "/api/v1/" + collection, new { slug, title });
        Ok(response, HttpStatusCode.Created);
        var created = JsonDocument.Parse(response.Body).RootElement;
        return (created.GetProperty("id").GetGuid(), created.GetProperty("version").GetInt32());
    }

    private async Task<JsonElement> GetAsync(AuthSession session, string collection, Guid id)
    {
        var response = await SendAsync(session, HttpMethod.Get, $"/api/v1/{collection}/{id}");
        Ok(response);
        return JsonDocument.Parse(response.Body).RootElement.Clone();
    }

    private async Task PublishAsync(AuthSession session, string collection, Guid id, int version)
    {
        var response = await SendAsync(session, HttpMethod.Post, $"/api/v1/{collection}/{id}/publish", new { version });
        Ok(response);
    }

    /// <summary>
    /// Publishing needs a description. A collection with sections must send them
    /// all back on every save, so echo whatever the item already has.
    /// </summary>
    private async Task DescribeAsync(AuthSession session, string collection, Guid id)
    {
        var loaded = await GetAsync(session, collection, id);
        var content = loaded.GetProperty("content");
        var response = await SendAsync(session, HttpMethod.Put, $"/api/v1/{collection}/{id}/save", new
        {
            version = loaded.GetProperty("version").GetInt32(),
            slug = content.GetProperty("slug").GetString(),
            title = content.GetProperty("title").GetString(),
            metaDescription = "A description long enough to satisfy the publish check for this item.",
            sortOrder = 0,
            sections = Sections(content),
        });
        Ok(response);
    }

    /// <summary>The item's own sections, or null for a collection that has none.</summary>
    private static object? Sections(JsonElement content) =>
        content.TryGetProperty("sections", out var sections) && sections.ValueKind == JsonValueKind.Array
            ? sections.EnumerateArray().Select(section => (object)new
            {
                id = section.GetProperty("id").GetGuid(),
                type = section.GetProperty("type").GetString(),
                visible = section.GetProperty("visible").GetBoolean(),
                fields = section.GetProperty("fields"),
            }).ToList()
            : null;

    private async Task SaveAsync(AuthSession session, string collection, Guid id, JsonElement loaded, string title)
    {
        var content = loaded.GetProperty("content");
        var response = await SendAsync(session, HttpMethod.Put, $"/api/v1/{collection}/{id}/save", new
        {
            version = loaded.GetProperty("version").GetInt32(),
            slug = content.GetProperty("slug").GetString(),
            title,
            metaDescription = content.TryGetProperty("metaDescription", out var description) && description.ValueKind == JsonValueKind.String
                ? description.GetString()
                : "A description long enough to satisfy the publish check for this item.",
            sortOrder = 0,
            sections = Sections(content),
        });
        Ok(response);
    }

    private async Task SaveWithSectionAsync(AuthSession session, Guid id, JsonElement loaded, Guid referencedCaseStudy)
    {
        var content = loaded.GetProperty("content");
        var response = await SendAsync(session, HttpMethod.Put, $"/api/v1/pages/{id}/save", new
        {
            version = loaded.GetProperty("version").GetInt32(),
            slug = content.GetProperty("slug").GetString(),
            title = content.GetProperty("title").GetString(),
            metaDescription = "A page whose case cards point at an unpublished case study.",
            sortOrder = 0,
            sections = new object[]
            {
                new
                {
                    type = "case_cards",
                    visible = true,
                    fields = new
                    {
                        heading = "Selected work",
                        items = new object[]
                        {
                            new
                            {
                                title = "A card pointing at an unpublished case study",
                                reference = new { type = "case_study", id = referencedCaseStudy },
                            },
                        },
                    },
                },
            },
        });
        Ok(response);
    }

    private async Task<(HttpStatusCode Status, string Body)> SendAsync(AuthSession session, HttpMethod method, string url, object? body = null)
    {
        var request = session.Authorized(method, url);
        if (body is not null)
            request.Content = JsonContent.Create(body);
        var response = await _client.SendAsync(request);
        return (response.StatusCode, await response.Content.ReadAsStringAsync());
    }

    /// <summary>Asserts the status and puts the response body in the failure message.</summary>
    private static void Ok((HttpStatusCode Status, string Body) response, HttpStatusCode expected = HttpStatusCode.OK) =>
        Assert.True(response.Status == expected, $"expected {expected}, got {response.Status}: {response.Body}");
}
