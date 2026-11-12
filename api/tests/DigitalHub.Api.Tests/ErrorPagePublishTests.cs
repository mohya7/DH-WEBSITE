using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DigitalHub.Api.Content;
using DigitalHub.Api.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DigitalHub.Api.Tests;

/// <summary>
/// ADM-05: the 404 and 500 pages go through the same draft and publish flow as
/// every other page, and their screen can publish them.
///
/// Each test seeds both error pages itself (ErrorPagesAsync), whatever the test
/// database held before: none, drafts or published pages, since other classes
/// leave them in different states. The pages found are saved, removed, and put
/// back in finally. The audit rows stay: the app login cannot delete from
/// audit_log, so T7 finds its own row by the freshly seeded page id and a time.
/// </summary>
[Collection("SqlServer")]
public sealed class ErrorPagePublishTests : IClassFixture<ApiFactory>
{
    private const string BuildUrl = "/api/v1/build/content";
    private const string BuildHeader = "X-Build-Token";
    private const string EditorEmail = "error-pages-editor@digitalhub.test";
    private const string HrEmail = "error-pages-hr@digitalhub.test";

    private static readonly SemaphoreSlim Gate = new(1, 1);
    private static AuthSession? _editor;
    private static AuthSession? _admin;
    private static AuthSession? _hr;

    private readonly ApiFactory _factory;
    private readonly HttpClient _client;

    public ErrorPagePublishTests(ApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task A_save_on_a_published_error_page_does_not_reach_the_build()
    {
        var pages = await ErrorPagesAsync(ContentStatus.Published);
        try
        {
            var saved = await SaveAsync(await Editor(), "404", pages.Version404, "Page not found", Doc("Body B"));
            Assert.True(saved.Status == HttpStatusCode.OK, saved.Body);

            var build = await ReadBuildAsync();
            var body = BuildBody(build, "404");
            Assert.Contains("Body A", body, StringComparison.Ordinal);
            Assert.DoesNotContain("Body B", body, StringComparison.Ordinal);

            var fields = await RecordFieldsAsync(pages.Id404);
            Assert.Contains("Body A", fields, StringComparison.Ordinal);
            Assert.DoesNotContain("Body B", fields, StringComparison.Ordinal);

            Assert.Equal(1, await WorkingCopyCountAsync(pages.Id404));
        }
        finally
        {
            await pages.RestoreAsync();
        }
    }

    [Fact]
    public async Task The_list_shows_the_draft_and_its_state()
    {
        var pages = await ErrorPagesAsync(ContentStatus.Published);
        try
        {
            var editor = await Editor();
            var saved = await SaveAsync(editor, "404", pages.Version404, "Page not found", Doc("Body B"));
            Assert.True(saved.Status == HttpStatusCode.OK, saved.Body);

            var listed = await SendAsync(editor, HttpMethod.Get, "/api/v1/error-pages");
            Assert.Equal(HttpStatusCode.OK, listed.Status);
            var notFound = ListItem(listed.Body, "404");
            Assert.Contains("Body B", notFound.GetProperty("body").GetString(), StringComparison.Ordinal);
            Assert.Equal("changed", notFound.GetProperty("state").GetString());
            Assert.Equal("published", notFound.GetProperty("status").GetString());
            Assert.True(notFound.GetProperty("hasWorkingCopy").GetBoolean());
            Assert.NotEqual(JsonValueKind.Null, notFound.GetProperty("publishedAt").ValueKind);

            var serverError = ListItem(listed.Body, "500");
            Assert.Equal("published", serverError.GetProperty("state").GetString());
        }
        finally
        {
            await pages.RestoreAsync();
        }
    }

    [Fact]
    public async Task An_editor_publishes_a_saved_error_page_draft()
    {
        var pages = await ErrorPagesAsync(ContentStatus.Draft);
        try
        {
            var editor = await Editor();
            var saved = await SaveAsync(editor, "404", pages.Version404, "Page not found", Doc("Body B"));
            Assert.True(saved.Status == HttpStatusCode.OK, saved.Body);

            var published = await SendAsync(editor, HttpMethod.Post, PublishUrl(pages.Id404), new { version = Version(saved.Body) });
            Assert.True(published.Status == HttpStatusCode.OK, published.Body);
            Assert.Equal("published", JsonDocument.Parse(published.Body).RootElement.GetProperty("state").GetString());

            var build = await ReadBuildAsync();
            var live = build.GetProperty("errorPages").GetProperty("404");
            Assert.NotEqual(JsonValueKind.Null, live.ValueKind);
            Assert.NotEqual(JsonValueKind.Null, live.GetProperty("publishedAt").ValueKind);
            Assert.Contains("Body B", BuildBody(build, "404"), StringComparison.Ordinal);

            var listed = await SendAsync(editor, HttpMethod.Get, "/api/v1/error-pages");
            Assert.Equal(HttpStatusCode.OK, listed.Status);
            var notFound = ListItem(listed.Body, "404");
            Assert.Equal("published", notFound.GetProperty("state").GetString());
            Assert.False(notFound.GetProperty("hasWorkingCopy").GetBoolean());
        }
        finally
        {
            await pages.RestoreAsync();
        }
    }

    [Fact]
    public async Task A_published_error_page_goes_live_only_at_publish()
    {
        var pages = await ErrorPagesAsync(ContentStatus.Published);
        try
        {
            var editor = await Editor();
            var saved = await SaveAsync(editor, "404", pages.Version404, "Page not found", Doc("Body B"));
            Assert.True(saved.Status == HttpStatusCode.OK, saved.Body);
            Assert.Contains("Body A", BuildBody(await ReadBuildAsync(), "404"), StringComparison.Ordinal);

            var published = await SendAsync(editor, HttpMethod.Post, PublishUrl(pages.Id404), new { version = Version(saved.Body) });
            Assert.True(published.Status == HttpStatusCode.OK, published.Body);

            var body = BuildBody(await ReadBuildAsync(), "404");
            Assert.Contains("Body B", body, StringComparison.Ordinal);
            Assert.DoesNotContain("Body A", body, StringComparison.Ordinal);
            Assert.Equal(0, await WorkingCopyCountAsync(pages.Id404));

            using var scope = _factory.Services.CreateScope();
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            Assert.Equal(1, await database.Revisions.AsNoTracking().CountAsync(revision => revision.EntityType == "page" && revision.EntityId == pages.Id404));
        }
        finally
        {
            await pages.RestoreAsync();
        }
    }

    [Fact]
    public async Task An_error_page_save_refuses_an_image_not_in_the_library()
    {
        var pages = await ErrorPagesAsync(ContentStatus.Draft);
        try
        {
            var missing = Guid.NewGuid().ToString("D");
            var image = "{\"type\":\"doc\",\"content\":[{\"type\":\"image\",\"attrs\":{\"mediaId\":\"" + missing + "\",\"alt\":\"Diagram\"}}]}";
            var refused = await SaveAsync(await Editor(), "404", pages.Version404, "Page not found", image);
            Assert.True(refused.Status == HttpStatusCode.BadRequest, refused.Body);
            Assert.Equal("validation_failed", Code(refused.Body));
            var media = JsonDocument.Parse(refused.Body).RootElement.GetProperty("errors").GetProperty("media")
                .EnumerateArray().Select(item => item.GetString()).ToList();
            Assert.Contains(missing + " is not in the library.", media);

            var (version, fields) = await RecordAsync(pages.Id404);
            Assert.Equal(pages.Version404, version);
            Assert.Contains("Body A", fields, StringComparison.Ordinal);
            Assert.DoesNotContain(missing, fields, StringComparison.OrdinalIgnoreCase);
            Assert.Equal(0, await WorkingCopyCountAsync(pages.Id404));
        }
        finally
        {
            await pages.RestoreAsync();
        }
    }

    [Fact]
    public async Task An_error_page_save_keeps_the_section_s_other_fields()
    {
        var pages = await ErrorPagesAsync(ContentStatus.Draft, eyebrow: "Oops");
        try
        {
            var saved = await SaveAsync(await Editor(), "404", pages.Version404, "Still not found", Doc("Body B"));
            Assert.True(saved.Status == HttpStatusCode.OK, saved.Body);

            using var fields = JsonDocument.Parse(await RecordFieldsAsync(pages.Id404));
            Assert.True(fields.RootElement.TryGetProperty("eyebrow", out var eyebrow), "eyebrow was dropped: " + fields.RootElement.GetRawText());
            Assert.Equal("Oops", eyebrow.GetString());
            Assert.Equal("Still not found", fields.RootElement.GetProperty("heading").GetString());
            Assert.Contains("Body B", fields.RootElement.GetProperty("body").GetString(), StringComparison.Ordinal);
        }
        finally
        {
            await pages.RestoreAsync();
        }
    }

    [Fact]
    public async Task An_error_page_save_is_audited_as_a_page_save()
    {
        var pages = await ErrorPagesAsync(ContentStatus.Draft);
        try
        {
            // A second's margin for the column's rounding; the page id is new to this test anyway.
            var started = DateTime.UtcNow.AddSeconds(-1);
            var saved = await SaveAsync(await Editor(), "404", pages.Version404, "Page not found", Doc("Body B"));
            Assert.True(saved.Status == HttpStatusCode.OK, saved.Body);

            using var scope = _factory.Services.CreateScope();
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            var entityId = pages.Id404.ToString();
            var rows = await database.AuditLog.AsNoTracking()
                .Where(entry => entry.EntityId == entityId && entry.At >= started)
                .ToListAsync();
            var row = Assert.Single(rows);
            Assert.Equal("update_error_page", row.Action);
            Assert.Equal("page", row.EntityType);
        }
        finally
        {
            await pages.RestoreAsync();
        }
    }

    [Fact]
    public async Task An_ordinary_page_still_needs_a_meta_description()
    {
        /* Guards the scope of the error-page exemption (O-ADM05-1). Written for the
           recommended answer (a): a noindex page that is not an error page keeps the
           rule. Under (b) this page is sent with noIndex false instead. */
        var editor = await Editor();
        var slug = "adm05-" + Guid.NewGuid().ToString("N")[..10];
        var created = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages", new { slug, title = "Ordinary page", noIndex = true });
        Assert.True(created.Status == HttpStatusCode.Created, created.Body);
        var id = JsonDocument.Parse(created.Body).RootElement.GetProperty("id").GetGuid();
        try
        {
            var refused = await SendAsync(editor, HttpMethod.Post, PublishUrl(id), new { version = Version(created.Body) });
            Assert.True(refused.Status == HttpStatusCode.BadRequest, refused.Body);
            Assert.Equal("publish_blocked", Code(refused.Body));
            Assert.True(JsonDocument.Parse(refused.Body).RootElement.GetProperty("errors").TryGetProperty("metaDescription", out _), refused.Body);
        }
        finally
        {
            await RemovePageAsync(id);
        }
    }

    [Fact]
    public async Task An_item_in_another_collection_with_an_error_page_slug_still_needs_a_meta_description()
    {
        /* Test report round 1, Minor 3: pins the collection half of the exemption.
           Only the pages error-404 and error-500 are exempt; a service with the slug
           error-404 lives at /services/error-404, an address of its own. */
        const string slug = "error-404";
        await RemoveServicesAsync(slug);
        var editor = await Editor();
        var created = await SendAsync(editor, HttpMethod.Post, "/api/v1/services", new { slug, title = "A service named like an error page" });
        Assert.True(created.Status == HttpStatusCode.Created, created.Body);
        var id = JsonDocument.Parse(created.Body).RootElement.GetProperty("id").GetGuid();
        try
        {
            var refused = await SendAsync(editor, HttpMethod.Post, "/api/v1/services/" + id + "/publish", new { version = Version(created.Body) });
            Assert.True(refused.Status == HttpStatusCode.BadRequest, refused.Body);
            Assert.Equal("publish_blocked", Code(refused.Body));
            Assert.True(JsonDocument.Parse(refused.Body).RootElement.GetProperty("errors").TryGetProperty("metaDescription", out _), refused.Body);
        }
        finally
        {
            await RemoveServicesAsync(slug);
        }
    }

    [Fact]
    public async Task A_save_on_a_draft_error_page_stays_out_of_the_build()
    {
        var pages = await ErrorPagesAsync(ContentStatus.Draft);
        try
        {
            var saved = await SaveAsync(await Editor(), "404", pages.Version404, "Page not found", Doc("Body B"));
            Assert.True(saved.Status == HttpStatusCode.OK, saved.Body);
            Assert.Equal("draft", JsonDocument.Parse(saved.Body).RootElement.GetProperty("state").GetString());

            var build = await ReadBuildAsync();
            Assert.Equal(JsonValueKind.Null, build.GetProperty("errorPages").GetProperty("404").ValueKind);
        }
        finally
        {
            await pages.RestoreAsync();
        }
    }

    [Fact]
    public async Task A_stale_version_is_a_conflict()
    {
        var pages = await ErrorPagesAsync(ContentStatus.Published);
        try
        {
            var stale = await SaveAsync(await Editor(), "404", pages.Version404 + 3, "Page not found", Doc("Body B"));
            Assert.True(stale.Status == HttpStatusCode.Conflict, stale.Body);
            Assert.Equal("concurrency_conflict", Code(stale.Body));

            var (version, fields) = await RecordAsync(pages.Id404);
            Assert.Equal(pages.Version404, version);
            Assert.Contains("Body A", fields, StringComparison.Ordinal);
            Assert.Equal(0, await WorkingCopyCountAsync(pages.Id404));
            Assert.Contains("Body A", BuildBody(await ReadBuildAsync(), "404"), StringComparison.Ordinal);
        }
        finally
        {
            await pages.RestoreAsync();
        }
    }

    [Fact]
    public async Task HR_cannot_read_save_or_publish_error_pages()
    {
        var pages = await ErrorPagesAsync(ContentStatus.Draft);
        try
        {
            var hr = await Hr();
            var read = await SendAsync(hr, HttpMethod.Get, "/api/v1/error-pages");
            Assert.Equal(HttpStatusCode.Forbidden, read.Status);
            var save = await SaveAsync(hr, "404", pages.Version404, "Page not found", Doc("Body B"));
            Assert.Equal(HttpStatusCode.Forbidden, save.Status);
            var publish = await SendAsync(hr, HttpMethod.Post, PublishUrl(pages.Id404), new { version = pages.Version404 });
            Assert.Equal(HttpStatusCode.Forbidden, publish.Status);

            var (version, fields) = await RecordAsync(pages.Id404);
            Assert.Equal(pages.Version404, version);
            Assert.Contains("Body A", fields, StringComparison.Ordinal);
        }
        finally
        {
            await pages.RestoreAsync();
        }
    }

    /// <summary>
    /// Seeds error-404 and error-500 with the given status, noindex, no meta
    /// description, and one rich_text section { heading, body: "Body A" } (plus an
    /// eyebrow on the 404 when asked). Every error-* page found first is saved with
    /// its sections and working copies, removed, and put back by RestoreAsync, which
    /// also removes what the test made: the seeded pages (their sections and working
    /// copies go with them) and their revisions.
    /// </summary>
    private async Task<SeededErrorPages> ErrorPagesAsync(ContentStatus status, string? eyebrow = null)
    {
        List<Page> found;
        List<WorkingCopy> copies;
        using (var scope = _factory.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            found = await database.Pages.AsNoTracking().Include(page => page.Sections)
                .Where(page => page.Slug.StartsWith("error-")).ToListAsync();
            var foundIds = found.Select(page => page.Id).ToList();
            copies = await database.WorkingCopies.AsNoTracking()
                .Where(copy => copy.PageId != null && foundIds.Contains(copy.PageId.Value)).ToListAsync();
            if (found.Count > 0)
            {
                database.Pages.RemoveRange(await database.Pages.Where(page => foundIds.Contains(page.Id)).ToListAsync());
                await database.SaveChangesAsync();
            }
        }

        var now = DateTime.UtcNow;
        var seeded = new Dictionary<string, Guid>(StringComparer.Ordinal);
        using (var scope = _factory.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            foreach (var (type, title) in new[] { ("404", "Page not found"), ("500", "Something went wrong") })
            {
                var page = new Page
                {
                    Id = Guid.NewGuid(),
                    Slug = "error-" + type,
                    Title = title,
                    Status = status,
                    Version = 1,
                    NoIndex = true,
                    CreatedAt = now,
                    UpdatedAt = now,
                    PublishedAt = status == ContentStatus.Published ? now : null,
                };
                object fields = type == "404" && eyebrow is not null
                    ? new { eyebrow, heading = title, body = Doc("Body A") }
                    : new { heading = title, body = Doc("Body A") };
                database.Pages.Add(page);
                database.Sections.Add(new Section
                {
                    Id = Guid.NewGuid(),
                    PageId = page.Id,
                    Type = SectionTypes.RichText,
                    SortOrder = 0,
                    Visible = true,
                    Fields = JsonSerializer.Serialize(fields, ContentJson.Options),
                });
                seeded[type] = page.Id;
            }

            await database.SaveChangesAsync();
        }

        return new SeededErrorPages(seeded["404"], seeded["500"], 1, async () =>
        {
            using var scope = _factory.Services.CreateScope();
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            var ids = seeded.Values.ToList();
            database.Pages.RemoveRange(await database.Pages.Where(page => ids.Contains(page.Id)).ToListAsync());
            database.Revisions.RemoveRange(await database.Revisions.Where(revision => revision.EntityType == "page" && ids.Contains(revision.EntityId)).ToListAsync());
            await database.SaveChangesAsync();

            if (found.Count == 0)
                return;
            foreach (var page in found)
            {
                foreach (var section in page.Sections)
                    section.Page = null;
                database.Pages.Add(page);
            }

            foreach (var copy in copies)
            {
                copy.Page = null;
                database.WorkingCopies.Add(copy);
            }

            await database.SaveChangesAsync();
        });
    }

    private async Task<(HttpStatusCode Status, string Body)> SaveAsync(AuthSession session, string type, int version, string title, string body) =>
        await SendAsync(session, HttpMethod.Put, "/api/v1/error-pages/" + type, new { version, title, body });

    private async Task<(int Version, string Fields)> RecordAsync(Guid id)
    {
        using var scope = _factory.Services.CreateScope();
        var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        var page = await database.Pages.AsNoTracking().Include(item => item.Sections).SingleAsync(item => item.Id == id);
        var section = page.Sections.OrderBy(item => item.SortOrder).First();
        return (page.Version, section.Fields);
    }

    private async Task<string> RecordFieldsAsync(Guid id) => (await RecordAsync(id)).Fields;

    private async Task<int> WorkingCopyCountAsync(Guid id)
    {
        using var scope = _factory.Services.CreateScope();
        var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        return await database.WorkingCopies.AsNoTracking().CountAsync(copy => copy.PageId == id);
    }

    private async Task RemovePageAsync(Guid id)
    {
        int version;
        using (var scope = _factory.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            var row = await database.Pages.SingleOrDefaultAsync(item => item.Id == id);
            if (row is null)
                return;
            if (row.Status == ContentStatus.Published)
            {
                row.Status = ContentStatus.Draft;
                await database.SaveChangesAsync();
            }

            version = row.Version;
        }

        var response = await SendAsync(await Admin(), HttpMethod.Delete, "/api/v1/pages/" + id + "?version=" + version);
        Assert.Equal(HttpStatusCode.NoContent, response.Status);
    }

    /// <summary>Removes services with this slug, their sections with them; one may be left by an earlier failed run.</summary>
    private async Task RemoveServicesAsync(string slug)
    {
        using var scope = _factory.Services.CreateScope();
        var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        var services = await database.Services.Where(service => service.Slug == slug).ToListAsync();
        if (services.Count == 0)
            return;
        database.Services.RemoveRange(services);
        await database.SaveChangesAsync();
    }

    private async Task<JsonElement> ReadBuildAsync()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, BuildUrl);
        request.Headers.TryAddWithoutValidation(BuildHeader, ApiFactory.BuildTokenValue);
        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.Clone();
    }

    /// <summary>The body of the error page's first section, as the build hands it over.</summary>
    private static string BuildBody(JsonElement build, string type)
    {
        var page = build.GetProperty("errorPages").GetProperty(type);
        Assert.True(page.ValueKind == JsonValueKind.Object, "errorPages." + type + " is not in the build: " + page.GetRawText());
        return page.GetProperty("sections")[0].GetProperty("fields").GetProperty("body").ToString();
    }

    private static JsonElement ListItem(string body, string type) =>
        JsonDocument.Parse(body).RootElement.GetProperty("items").EnumerateArray()
            .Single(item => item.GetProperty("type").GetString() == type).Clone();

    private static string Doc(string text) =>
        JsonSerializer.Serialize(new { type = "doc", content = new object[] { new { type = "paragraph", content = new object[] { new { type = "text", text } } } } });

    private static string PublishUrl(Guid id) => "/api/v1/pages/" + id + "/publish";

    private static int Version(string body) => JsonDocument.Parse(body).RootElement.GetProperty("version").GetInt32();

    private static string? Code(string body) =>
        JsonDocument.Parse(body).RootElement.TryGetProperty("code", out var code) ? code.GetString() : null;

    private async Task<AuthSession> Editor() => await Session(EditorEmail, "editor", static () => _editor, value => _editor = value);

    private async Task<AuthSession> Hr() => await Session(HrEmail, "hr", static () => _hr, value => _hr = value);

    private async Task<AuthSession> Admin() => await Session(ApiFactory.AdminEmail, "admin", static () => _admin, value => _admin = value);

    private async Task<AuthSession> Session(string email, string role, Func<AuthSession?> read, Action<AuthSession> write)
    {
        await Gate.WaitAsync();
        try
        {
            var existing = read();
            if (existing is not null && await existing.IsLiveAsync(_client))
                return existing;
            if (role != "admin")
                await CreateUserAsync(email, role);
            var session = await AuthSession.LoginAsync(_client, email, ApiFactory.AdminPassword);
            Assert.Equal(HttpStatusCode.OK, session.Status);
            write(session);
            return session;
        }
        finally
        {
            Gate.Release();
        }
    }

    private async Task CreateUserAsync(string email, string role)
    {
        using var scope = _factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        if (await users.FindByEmailAsync(email) is not null)
            return;
        var user = new ApplicationUser { UserName = email, Email = email, EmailConfirmed = true };
        Assert.True((await users.CreateAsync(user, ApiFactory.AdminPassword)).Succeeded);
        Assert.True((await users.AddToRoleAsync(user, role)).Succeeded);
    }

    private async Task<(HttpStatusCode Status, string Body)> SendAsync(AuthSession session, HttpMethod method, string url, object? body = null)
    {
        var request = session.Authorized(method, url);
        if (body is not null)
            request.Content = JsonContent.Create(body);
        var response = await _client.SendAsync(request);
        return (response.StatusCode, await response.Content.ReadAsStringAsync());
    }

    private sealed record SeededErrorPages(Guid Id404, Guid Id500, int Version404, Func<Task> RestoreAsync);
}
