using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using DigitalHub.Api.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DigitalHub.Api.Tests;

[Collection("SqlServer")]
public sealed class ContentEndpointCoverageTests : IClassFixture<ApiFactory>
{
    private static readonly SemaphoreSlim Gate = new(1, 1);
    private static AuthSession? _editor;
    private static AuthSession? _admin;
    private static AuthSession? _unknown;

    private readonly ApiFactory _factory;
    private readonly HttpClient _client;

    public ContentEndpointCoverageTests(ApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Theory]
    [InlineData("GET", "/api/v1/pages")]
    [InlineData("GET", "/api/v1/pages/11111111-1111-4111-8111-111111111111")]
    [InlineData("POST", "/api/v1/pages")]
    [InlineData("PUT", "/api/v1/pages/11111111-1111-4111-8111-111111111111")]
    [InlineData("DELETE", "/api/v1/pages/11111111-1111-4111-8111-111111111111?version=1")]
    [InlineData("POST", "/api/v1/pages/11111111-1111-4111-8111-111111111111/discard")]
    [InlineData("POST", "/api/v1/pages/11111111-1111-4111-8111-111111111111/sections")]
    [InlineData("PUT", "/api/v1/pages/11111111-1111-4111-8111-111111111111/sections/22222222-2222-4222-8222-222222222222")]
    [InlineData("POST", "/api/v1/pages/11111111-1111-4111-8111-111111111111/sections/reorder")]
    [InlineData("POST", "/api/v1/pages/11111111-1111-4111-8111-111111111111/sections/22222222-2222-4222-8222-222222222222/visibility")]
    [InlineData("DELETE", "/api/v1/pages/11111111-1111-4111-8111-111111111111/sections/22222222-2222-4222-8222-222222222222?version=1")]
    [InlineData("POST", "/api/v1/pages/11111111-1111-4111-8111-111111111111/publish")]
    [InlineData("POST", "/api/v1/pages/11111111-1111-4111-8111-111111111111/unpublish")]
    [InlineData("GET", "/api/v1/pages/11111111-1111-4111-8111-111111111111/revisions")]
    [InlineData("GET", "/api/v1/pages/11111111-1111-4111-8111-111111111111/revisions/33333333-3333-4333-8333-333333333333")]
    [InlineData("POST", "/api/v1/pages/11111111-1111-4111-8111-111111111111/revisions/33333333-3333-4333-8333-333333333333/restore")]
    [InlineData("GET", "/api/v1/media")]
    [InlineData("GET", "/api/v1/media/44444444-4444-4444-8444-444444444444")]
    [InlineData("POST", "/api/v1/media")]
    [InlineData("PUT", "/api/v1/media/44444444-4444-4444-8444-444444444444")]
    [InlineData("DELETE", "/api/v1/media/44444444-4444-4444-8444-444444444444")]
    public async Task Anonymous_request_is_unauthorized(string method, string url)
    {
        var response = await _client.SendAsync(new HttpRequestMessage(new HttpMethod(method), url));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("GET", "/api/v1/pages")]
    [InlineData("GET", "/api/v1/pages/11111111-1111-4111-8111-111111111111")]
    [InlineData("POST", "/api/v1/pages")]
    [InlineData("PUT", "/api/v1/pages/11111111-1111-4111-8111-111111111111")]
    [InlineData("DELETE", "/api/v1/pages/11111111-1111-4111-8111-111111111111?version=1")]
    [InlineData("POST", "/api/v1/pages/11111111-1111-4111-8111-111111111111/discard")]
    [InlineData("POST", "/api/v1/pages/11111111-1111-4111-8111-111111111111/sections")]
    [InlineData("PUT", "/api/v1/pages/11111111-1111-4111-8111-111111111111/sections/22222222-2222-4222-8222-222222222222")]
    [InlineData("POST", "/api/v1/pages/11111111-1111-4111-8111-111111111111/sections/reorder")]
    [InlineData("POST", "/api/v1/pages/11111111-1111-4111-8111-111111111111/sections/22222222-2222-4222-8222-222222222222/visibility")]
    [InlineData("DELETE", "/api/v1/pages/11111111-1111-4111-8111-111111111111/sections/22222222-2222-4222-8222-222222222222?version=1")]
    [InlineData("POST", "/api/v1/pages/11111111-1111-4111-8111-111111111111/publish")]
    [InlineData("POST", "/api/v1/pages/11111111-1111-4111-8111-111111111111/unpublish")]
    [InlineData("GET", "/api/v1/pages/11111111-1111-4111-8111-111111111111/revisions")]
    [InlineData("GET", "/api/v1/pages/11111111-1111-4111-8111-111111111111/revisions/33333333-3333-4333-8333-333333333333")]
    [InlineData("POST", "/api/v1/pages/11111111-1111-4111-8111-111111111111/revisions/33333333-3333-4333-8333-333333333333/restore")]
    [InlineData("GET", "/api/v1/media")]
    [InlineData("GET", "/api/v1/media/44444444-4444-4444-8444-444444444444")]
    [InlineData("POST", "/api/v1/media")]
    [InlineData("PUT", "/api/v1/media/44444444-4444-4444-8444-444444444444")]
    [InlineData("DELETE", "/api/v1/media/44444444-4444-4444-8444-444444444444")]
    public async Task Unknown_role_is_forbidden(string method, string url)
    {
        var guest = await Unknown();
        var response = await SendAsync(guest, new HttpMethod(method), url);
        Assert.Equal(HttpStatusCode.Forbidden, response.Status);
    }

    [Fact]
    public async Task List_succeeds_for_an_editor()
    {
        var editor = await Editor();
        var response = await SendAsync(editor, HttpMethod.Get, "/api/v1/pages?search=studio");
        Assert.Equal(HttpStatusCode.OK, response.Status);
        Assert.True(JsonDocument.Parse(response.Body).RootElement.TryGetProperty("items", out _));
    }

    [Fact]
    public async Task List_succeeds_for_an_admin()
    {
        var admin = await Admin();
        var response = await SendAsync(admin, HttpMethod.Get, "/api/v1/pages");
        Assert.Equal(HttpStatusCode.OK, response.Status);
    }

    [Fact]
    public async Task List_rejects_an_invalid_status()
    {
        var editor = await Editor();
        var response = await SendAsync(editor, HttpMethod.Get, "/api/v1/pages?status=later");
        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Equal("validation_failed", Code(response.Body));
    }

    [Fact]
    public async Task Get_succeeds_for_an_editor_and_an_admin()
    {
        var page = await CreatePageAsync();
        var editor = await Editor();
        var admin = await Admin();
        Assert.Equal(HttpStatusCode.OK, (await SendAsync(editor, HttpMethod.Get, "/api/v1/pages/" + page.Id)).Status);
        Assert.Equal(HttpStatusCode.OK, (await SendAsync(admin, HttpMethod.Get, "/api/v1/pages/" + page.Id)).Status);
        await DeleteDraftAsync(page.Id, page.Version);
    }

    [Fact]
    public async Task Get_returns_not_found_for_a_missing_item()
    {
        var editor = await Editor();
        var response = await SendAsync(editor, HttpMethod.Get, "/api/v1/pages/" + Guid.NewGuid());
        Assert.Equal(HttpStatusCode.NotFound, response.Status);
        Assert.Equal("not_found", Code(response.Body));
    }

    [Fact]
    public async Task Create_succeeds_for_an_editor_and_an_admin()
    {
        var editor = await Editor();
        var admin = await Admin();
        var first = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages", new { slug = Slug(), title = "Editor page" });
        var second = await SendAsync(admin, HttpMethod.Post, "/api/v1/pages", new { slug = Slug(), title = "Admin page" });
        Assert.Equal(HttpStatusCode.Created, first.Status);
        Assert.Equal(HttpStatusCode.Created, second.Status);
        await DeleteDraftAsync(Id(first.Body), 1);
        await DeleteDraftAsync(Id(second.Body), 1);
    }

    [Fact]
    public async Task Create_rejects_an_invalid_slug()
    {
        var editor = await Editor();
        var response = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages", new { slug = "Not A Slug", title = "Bad" });
        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Equal("validation_failed", Code(response.Body));
    }

    [Fact]
    public async Task Update_succeeds_for_an_editor_and_an_admin()
    {
        var page = await CreatePageAsync();
        var editor = await Editor();
        var admin = await Admin();
        var edited = await SendAsync(editor, HttpMethod.Put, "/api/v1/pages/" + page.Id, new { version = page.Version, slug = page.Slug, title = "Editor edit" });
        Assert.Equal(HttpStatusCode.OK, edited.Status);
        var version = JsonDocument.Parse(edited.Body).RootElement.GetProperty("version").GetInt32();
        var again = await SendAsync(admin, HttpMethod.Put, "/api/v1/pages/" + page.Id, new { version, slug = page.Slug, title = "Admin edit" });
        Assert.Equal(HttpStatusCode.OK, again.Status);
        await DeleteDraftAsync(page.Id, version + 1);
    }

    [Fact]
    public async Task Update_rejects_an_invalid_slug()
    {
        var page = await CreatePageAsync();
        var editor = await Editor();
        var response = await SendAsync(editor, HttpMethod.Put, "/api/v1/pages/" + page.Id, new { version = page.Version, slug = "Bad Slug", title = "Title" });
        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Equal("validation_failed", Code(response.Body));
        await DeleteDraftAsync(page.Id, page.Version);
    }

    [Fact]
    public async Task Update_returns_409_for_a_stale_version()
    {
        var page = await CreatePageAsync();
        var editor = await Editor();
        var response = await SendAsync(editor, HttpMethod.Put, "/api/v1/pages/" + page.Id, new { version = page.Version + 5, slug = page.Slug, title = "Late" });
        Assert.Equal(HttpStatusCode.Conflict, response.Status);
        Assert.Equal("concurrency_conflict", Code(response.Body));
        await DeleteDraftAsync(page.Id, page.Version);
    }

    [Fact]
    public async Task Discard_succeeds_for_an_editor_and_an_admin()
    {
        var page = await PublishedPageAsync();
        var editor = await Editor();
        var admin = await Admin();
        var drafted = await SendAsync(editor, HttpMethod.Put, "/api/v1/pages/" + page.Id, new { version = page.Version, slug = page.Slug, title = "Drafted" });
        var version = JsonDocument.Parse(drafted.Body).RootElement.GetProperty("version").GetInt32();
        var discarded = await SendAsync(admin, HttpMethod.Post, "/api/v1/pages/" + page.Id + "/discard", new { version });
        Assert.Equal(HttpStatusCode.OK, discarded.Status);
        Assert.False(JsonDocument.Parse(discarded.Body).RootElement.GetProperty("hasWorkingCopy").GetBoolean());

        var again = await SendAsync(editor, HttpMethod.Put, "/api/v1/pages/" + page.Id, new { version = version + 1, slug = page.Slug, title = "Drafted again" });
        var editorDiscard = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages/" + page.Id + "/discard", new { version = version + 2 });
        Assert.Equal(HttpStatusCode.OK, again.Status);
        Assert.Equal(HttpStatusCode.OK, editorDiscard.Status);
        await ForceDraftAndDeleteAsync(page.Id);
    }

    [Fact]
    public async Task Discard_rejects_a_missing_version()
    {
        var editor = await Editor();
        var response = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages/" + Guid.NewGuid() + "/discard", new { version = 0 });
        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Equal("validation_failed", Code(response.Body));
    }

    [Fact]
    public async Task Discard_returns_409_for_a_stale_version()
    {
        var page = await PublishedPageAsync();
        var editor = await Editor();
        await SendAsync(editor, HttpMethod.Put, "/api/v1/pages/" + page.Id, new { version = page.Version, slug = page.Slug, title = "Drafted" });
        var response = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages/" + page.Id + "/discard", new { version = page.Version });
        Assert.Equal(HttpStatusCode.Conflict, response.Status);
        Assert.Equal("concurrency_conflict", Code(response.Body));
        await ForceDraftAndDeleteAsync(page.Id);
    }

    [Fact]
    public async Task Add_section_succeeds_for_an_editor_and_an_admin()
    {
        var page = await CreatePageAsync();
        var editor = await Editor();
        var admin = await Admin();
        var added = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages/" + page.Id + "/sections", new { version = page.Version, type = "call_to_action", fields = new { heading = "Hello" } });
        Assert.Equal(HttpStatusCode.OK, added.Status);
        var version = JsonDocument.Parse(added.Body).RootElement.GetProperty("version").GetInt32();
        var second = await SendAsync(admin, HttpMethod.Post, "/api/v1/pages/" + page.Id + "/sections", new { version, type = "call_to_action", fields = new { heading = "Again" } });
        Assert.Equal(HttpStatusCode.OK, second.Status);
        await DeleteDraftAsync(page.Id, version + 1);
    }

    [Fact]
    public async Task Add_section_rejects_fields_outside_the_schema()
    {
        var page = await CreatePageAsync();
        var editor = await Editor();
        var response = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages/" + page.Id + "/sections", new { version = page.Version, type = "call_to_action", fields = new { notAField = "no" } });
        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Equal("validation_failed", Code(response.Body));
        await DeleteDraftAsync(page.Id, page.Version);
    }

    [Fact]
    public async Task Add_section_returns_409_for_a_stale_version()
    {
        var page = await CreatePageAsync();
        var editor = await Editor();
        var response = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages/" + page.Id + "/sections", new { version = page.Version + 3, type = "call_to_action", fields = new { heading = "Late" } });
        Assert.Equal(HttpStatusCode.Conflict, response.Status);
        Assert.Equal("concurrency_conflict", Code(response.Body));
        await DeleteDraftAsync(page.Id, page.Version);
    }

    [Fact]
    public async Task Update_section_succeeds_for_an_editor_and_an_admin()
    {
        var seeded = await PageWithSectionAsync();
        var editor = await Editor();
        var admin = await Admin();
        var edited = await SendAsync(editor, HttpMethod.Put, SectionUrl(seeded), new { version = seeded.Version, fields = new { heading = "Editor" } });
        Assert.Equal(HttpStatusCode.OK, edited.Status);
        var version = JsonDocument.Parse(edited.Body).RootElement.GetProperty("version").GetInt32();
        var again = await SendAsync(admin, HttpMethod.Put, SectionUrl(seeded), new { version, fields = new { heading = "Admin" } });
        Assert.Equal(HttpStatusCode.OK, again.Status);
        await DeleteDraftAsync(seeded.Id, version + 1);
    }

    [Fact]
    public async Task Update_section_rejects_fields_outside_the_schema()
    {
        var seeded = await PageWithSectionAsync();
        var editor = await Editor();
        var response = await SendAsync(editor, HttpMethod.Put, SectionUrl(seeded), new { version = seeded.Version, fields = new { heading = 4 } });
        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Equal("validation_failed", Code(response.Body));
        await DeleteDraftAsync(seeded.Id, seeded.Version);
    }

    [Fact]
    public async Task Update_section_returns_409_for_a_stale_version()
    {
        var seeded = await PageWithSectionAsync();
        var editor = await Editor();
        var response = await SendAsync(editor, HttpMethod.Put, SectionUrl(seeded), new { version = seeded.Version + 4, fields = new { heading = "Late" } });
        Assert.Equal(HttpStatusCode.Conflict, response.Status);
        Assert.Equal("concurrency_conflict", Code(response.Body));
        await DeleteDraftAsync(seeded.Id, seeded.Version);
    }

    [Fact]
    public async Task Reorder_sections_succeeds_for_an_editor_and_an_admin()
    {
        var seeded = await PageWithSectionAsync();
        var editor = await Editor();
        var admin = await Admin();
        var moved = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages/" + seeded.Id + "/sections/reorder", new { version = seeded.Version, sectionIds = new[] { seeded.SectionId } });
        Assert.Equal(HttpStatusCode.OK, moved.Status);
        var version = JsonDocument.Parse(moved.Body).RootElement.GetProperty("version").GetInt32();
        var again = await SendAsync(admin, HttpMethod.Post, "/api/v1/pages/" + seeded.Id + "/sections/reorder", new { version, sectionIds = new[] { seeded.SectionId } });
        Assert.Equal(HttpStatusCode.OK, again.Status);
        await DeleteDraftAsync(seeded.Id, version + 1);
    }

    [Fact]
    public async Task Reorder_sections_rejects_a_partial_list()
    {
        var seeded = await PageWithSectionAsync();
        var editor = await Editor();
        var response = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages/" + seeded.Id + "/sections/reorder", new { version = seeded.Version, sectionIds = Array.Empty<Guid>() });
        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Equal("validation_failed", Code(response.Body));
        await DeleteDraftAsync(seeded.Id, seeded.Version);
    }

    [Fact]
    public async Task Reorder_sections_returns_409_for_a_stale_version()
    {
        var seeded = await PageWithSectionAsync();
        var editor = await Editor();
        var response = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages/" + seeded.Id + "/sections/reorder", new { version = seeded.Version + 2, sectionIds = new[] { seeded.SectionId } });
        Assert.Equal(HttpStatusCode.Conflict, response.Status);
        Assert.Equal("concurrency_conflict", Code(response.Body));
        await DeleteDraftAsync(seeded.Id, seeded.Version);
    }

    [Fact]
    public async Task Section_visibility_succeeds_for_an_editor_and_an_admin()
    {
        var seeded = await PageWithSectionAsync();
        var editor = await Editor();
        var admin = await Admin();
        var hidden = await SendAsync(editor, HttpMethod.Post, SectionUrl(seeded) + "/visibility", new { version = seeded.Version, visible = false });
        Assert.Equal(HttpStatusCode.OK, hidden.Status);
        var version = JsonDocument.Parse(hidden.Body).RootElement.GetProperty("version").GetInt32();
        var shown = await SendAsync(admin, HttpMethod.Post, SectionUrl(seeded) + "/visibility", new { version, visible = true });
        Assert.Equal(HttpStatusCode.OK, shown.Status);
        await DeleteDraftAsync(seeded.Id, version + 1);
    }

    [Fact]
    public async Task Section_visibility_rejects_a_non_boolean()
    {
        var seeded = await PageWithSectionAsync();
        var editor = await Editor();
        var request = editor.Authorized(HttpMethod.Post, SectionUrl(seeded) + "/visibility");
        request.Content = new StringContent("{\"version\":" + seeded.Version + ",\"visible\":\"yes\"}", Encoding.UTF8, "application/json");
        var response = await _client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("validation_failed", Code(body));
        await DeleteDraftAsync(seeded.Id, seeded.Version);
    }

    [Fact]
    public async Task Section_visibility_returns_409_for_a_stale_version()
    {
        var seeded = await PageWithSectionAsync();
        var editor = await Editor();
        var response = await SendAsync(editor, HttpMethod.Post, SectionUrl(seeded) + "/visibility", new { version = seeded.Version + 6, visible = false });
        Assert.Equal(HttpStatusCode.Conflict, response.Status);
        Assert.Equal("concurrency_conflict", Code(response.Body));
        await DeleteDraftAsync(seeded.Id, seeded.Version);
    }

    [Fact]
    public async Task Remove_section_succeeds_for_an_editor_and_an_admin()
    {
        var first = await PageWithSectionAsync();
        var second = await PageWithSectionAsync();
        var editor = await Editor();
        var admin = await Admin();
        Assert.Equal(HttpStatusCode.OK, (await SendAsync(editor, HttpMethod.Delete, SectionUrl(first) + "?version=" + first.Version)).Status);
        Assert.Equal(HttpStatusCode.OK, (await SendAsync(admin, HttpMethod.Delete, SectionUrl(second) + "?version=" + second.Version)).Status);
        await DeleteDraftAsync(first.Id, first.Version + 1);
        await DeleteDraftAsync(second.Id, second.Version + 1);
    }

    [Fact]
    public async Task Remove_section_rejects_a_missing_version()
    {
        var editor = await Editor();
        var response = await SendAsync(editor, HttpMethod.Delete, "/api/v1/pages/" + Guid.NewGuid() + "/sections/" + Guid.NewGuid() + "?version=0");
        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Equal("validation_failed", Code(response.Body));
    }

    [Fact]
    public async Task Remove_section_returns_409_for_a_stale_version()
    {
        var seeded = await PageWithSectionAsync();
        var editor = await Editor();
        var response = await SendAsync(editor, HttpMethod.Delete, SectionUrl(seeded) + "?version=" + (seeded.Version + 1));
        Assert.Equal(HttpStatusCode.Conflict, response.Status);
        Assert.Equal("concurrency_conflict", Code(response.Body));
        await DeleteDraftAsync(seeded.Id, seeded.Version);
    }

    [Fact]
    public async Task Delete_succeeds_for_an_admin()
    {
        var page = await CreatePageAsync();
        var admin = await Admin();
        var response = await SendAsync(admin, HttpMethod.Delete, "/api/v1/pages/" + page.Id + "?version=" + page.Version);
        Assert.Equal(HttpStatusCode.NoContent, response.Status);
    }

    [Fact]
    public async Task Delete_is_forbidden_for_an_editor()
    {
        var page = await CreatePageAsync();
        var editor = await Editor();
        var response = await SendAsync(editor, HttpMethod.Delete, "/api/v1/pages/" + page.Id + "?version=" + page.Version);
        Assert.Equal(HttpStatusCode.Forbidden, response.Status);
        await DeleteDraftAsync(page.Id, page.Version);
    }

    [Fact]
    public async Task Delete_rejects_a_version_that_is_not_a_number()
    {
        var admin = await Admin();
        var response = await SendAsync(admin, HttpMethod.Delete, "/api/v1/pages/" + Guid.NewGuid() + "?version=nope");
        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Equal("validation_failed", Code(response.Body));
    }

    [Fact]
    public async Task Delete_returns_409_for_a_stale_version()
    {
        var page = await CreatePageAsync();
        var admin = await Admin();
        var response = await SendAsync(admin, HttpMethod.Delete, "/api/v1/pages/" + page.Id + "?version=" + (page.Version + 2));
        Assert.Equal(HttpStatusCode.Conflict, response.Status);
        Assert.Equal("concurrency_conflict", Code(response.Body));
        await DeleteDraftAsync(page.Id, page.Version);
    }

    [Fact]
    public async Task Delete_refuses_a_published_item()
    {
        var page = await PublishedPageAsync();
        var admin = await Admin();
        var response = await SendAsync(admin, HttpMethod.Delete, "/api/v1/pages/" + page.Id + "?version=" + page.Version);
        Assert.Equal(HttpStatusCode.Conflict, response.Status);
        Assert.Equal("published", Code(response.Body));
        var still = await SendAsync(admin, HttpMethod.Get, "/api/v1/pages/" + page.Id);
        Assert.Equal(HttpStatusCode.OK, still.Status);
        await ForceDraftAndDeleteAsync(page.Id);
    }

    [Fact]
    public async Task Delete_removes_working_copy_sections_revisions_and_pointing_redirects()
    {
        var page = await PageWithSectionAsync();
        var kept = Guid.NewGuid();
        var pointing = Guid.NewGuid();
        var revisionId = Guid.NewGuid();
        var copyId = Guid.NewGuid();
        using (var scope = _factory.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            database.WorkingCopies.Add(new WorkingCopy
            {
                Id = copyId,
                PageId = page.Id,
                Document = "{\"slug\":\"" + page.Slug + "\",\"title\":\"Draft\"}",
                SavedAt = DateTime.UtcNow,
            });
            database.Revisions.Add(new Revision
            {
                Id = revisionId,
                EntityType = "page",
                EntityId = page.Id,
                Version = 1,
                Snapshot = "{}",
                PublishedAt = DateTime.UtcNow,
            });
            database.Redirects.Add(new Redirect
            {
                Id = pointing,
                FromPath = "/old-" + page.Slug,
                ToPath = "/" + page.Slug,
                StatusCode = 301,
                Source = "manual",
                CreatedAt = DateTime.UtcNow,
            });
            database.Redirects.Add(new Redirect
            {
                Id = kept,
                FromPath = "/keep-" + page.Slug,
                ToPath = "/somewhere-else",
                StatusCode = 301,
                Source = "manual",
                CreatedAt = DateTime.UtcNow,
            });
            await database.SaveChangesAsync();
        }

        var admin = await Admin();
        var response = await SendAsync(admin, HttpMethod.Delete, "/api/v1/pages/" + page.Id + "?version=" + page.Version);
        Assert.Equal(HttpStatusCode.NoContent, response.Status);

        using var check = _factory.Services.CreateScope();
        var db = check.ServiceProvider.GetRequiredService<ContentDbContext>();
        Assert.False(await db.Pages.AnyAsync(item => item.Id == page.Id));
        Assert.False(await db.Sections.AnyAsync(item => item.PageId == page.Id));
        Assert.False(await db.WorkingCopies.AnyAsync(item => item.Id == copyId));
        Assert.False(await db.Revisions.AnyAsync(item => item.Id == revisionId));
        Assert.False(await db.Redirects.AnyAsync(item => item.Id == pointing));
        Assert.True(await db.Redirects.AnyAsync(item => item.Id == kept));
        Assert.True(await db.AuditLog.AnyAsync(item => item.Action == "delete" && item.EntityId == page.Id.ToString()));
        Assert.True(await db.AuditLog.AnyAsync(item => item.Action == "delete_redirect" && item.EntityId == pointing.ToString()));
        db.Redirects.RemoveRange(db.Redirects.Where(item => item.Id == kept));
        await db.SaveChangesAsync();
    }

    private async Task<PageRef> CreatePageAsync()
    {
        var editor = await Editor();
        var slug = Slug();
        var response = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages", new { slug, title = "Coverage" });
        Assert.Equal(HttpStatusCode.Created, response.Status);
        var json = JsonDocument.Parse(response.Body).RootElement;
        return new PageRef(json.GetProperty("id").GetGuid(), slug, json.GetProperty("version").GetInt32(), Guid.Empty);
    }

    private async Task<PageRef> PageWithSectionAsync()
    {
        var page = await CreatePageAsync();
        var editor = await Editor();
        var response = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages/" + page.Id + "/sections", new { version = page.Version, type = "call_to_action", fields = new { heading = "Coverage" } });
        Assert.Equal(HttpStatusCode.OK, response.Status);
        var json = JsonDocument.Parse(response.Body).RootElement;
        return page with
        {
            Version = json.GetProperty("version").GetInt32(),
            SectionId = json.GetProperty("content").GetProperty("sections")[0].GetProperty("id").GetGuid(),
        };
    }

    private async Task<PageRef> PublishedPageAsync()
    {
        var page = await CreatePageAsync();
        using var scope = _factory.Services.CreateScope();
        var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        var row = await database.Pages.SingleAsync(item => item.Id == page.Id);
        row.Status = ContentStatus.Published;
        row.PublishedAt = DateTime.UtcNow;
        await database.SaveChangesAsync();
        return page;
    }

    private async Task DeleteDraftAsync(Guid id, int version)
    {
        var admin = await Admin();
        var response = await SendAsync(admin, HttpMethod.Delete, "/api/v1/pages/" + id + "?version=" + version);
        Assert.Equal(HttpStatusCode.NoContent, response.Status);
    }

    private async Task ForceDraftAndDeleteAsync(Guid id)
    {
        int version;
        using (var scope = _factory.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            var row = await database.Pages.SingleAsync(item => item.Id == id);
            row.Status = ContentStatus.Draft;
            version = row.Version;
            await database.SaveChangesAsync();
        }

        await DeleteDraftAsync(id, version);
    }

    private async Task<AuthSession> Editor() => await Session("content-editor@digitalhub.test", "editor", static () => _editor, value => _editor = value);

    private async Task<AuthSession> Admin() => await Session(ApiFactory.AdminEmail, "admin", static () => _admin, value => _admin = value, ApiFactory.AdminPassword);

    private async Task<AuthSession> Unknown() => await Session("content-guest@digitalhub.test", "guest", static () => _unknown, value => _unknown = value);

    private async Task<AuthSession> Session(string email, string role, Func<AuthSession?> read, Action<AuthSession> write, string? password = null)
    {
        await Gate.WaitAsync();
        try
        {
            var existing = read();
            if (existing is not null && await existing.IsLiveAsync(_client))
                return existing;
            if (role != "admin")
                await CreateUserAsync(email, role);
            var session = await AuthSession.LoginAsync(_client, email, password ?? ApiFactory.AdminPassword);
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
        if (role == "guest")
        {
            var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
            if (!await roles.RoleExistsAsync(role))
                Assert.True((await roles.CreateAsync(new IdentityRole(role))).Succeeded);
        }

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

    private static string Slug() => "cov-" + Guid.NewGuid().ToString("N")[..10];

    private static Guid Id(string body) => JsonDocument.Parse(body).RootElement.GetProperty("id").GetGuid();

    private static string? Code(string body) =>
        JsonDocument.Parse(body).RootElement.TryGetProperty("code", out var code) ? code.GetString() : null;

    private static string SectionUrl(PageRef page) => "/api/v1/pages/" + page.Id + "/sections/" + page.SectionId;

    private sealed record PageRef(Guid Id, string Slug, int Version, Guid SectionId);
}
