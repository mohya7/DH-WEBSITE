using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DigitalHub.Api.Content;
using DigitalHub.Api.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DigitalHub.Api.Tests;

[Collection("SqlServer")]
public sealed class ContentApiTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    private readonly HttpClient _client;

    public ContentApiTests(ApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Editor_and_admin_cover_pages_sections_drafts_and_roles()
    {
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var editor = await LoginAsync("content-editor@digitalhub.test", "editor");
        var admin = await LoginAsync(ApiFactory.AdminEmail, "admin", ApiFactory.AdminPassword);
        var anonymous = await _client.GetAsync("/api/v1/pages");
        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);

        await CreateUserAsync("content-guest@digitalhub.test", "guest");
        var guest = await AuthSession.LoginAsync(_client, "content-guest@digitalhub.test", ApiFactory.AdminPassword);
        var unknown = await _client.SendAsync(guest.Authorized(HttpMethod.Get, "/api/v1/pages"));
        Assert.Equal(HttpStatusCode.Forbidden, unknown.StatusCode);

        var invalid = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages", new { slug = "Not A Slug", title = "Bad" });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.Status);
        Assert.Equal("validation_failed", Code(invalid.Body));

        var created = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages", new { slug = "studio-" + suffix, title = "Studio page" });
        Assert.Equal(HttpStatusCode.Created, created.Status);
        var page = JsonDocument.Parse(created.Body).RootElement;
        var id = page.GetProperty("id").GetGuid();
        Assert.Equal(1, page.GetProperty("version").GetInt32());
        Assert.Equal("draft", page.GetProperty("status").GetString());
        Assert.False(page.GetProperty("hasWorkingCopy").GetBoolean());
        Assert.Equal(JsonValueKind.Null, page.GetProperty("live").ValueKind);

        var listed = await SendAsync(editor, HttpMethod.Get, "/api/v1/pages?search=studio-" + suffix);
        Assert.Equal(HttpStatusCode.OK, listed.Status);
        Assert.Equal(1, JsonDocument.Parse(listed.Body).RootElement.GetProperty("total").GetInt32());

        var renamed = await SendAsync(editor, HttpMethod.Put, "/api/v1/pages/" + id, new { version = 1, slug = "studio-" + suffix, title = "Renamed draft" });
        Assert.Equal(HttpStatusCode.OK, renamed.Status);
        Assert.Equal(2, JsonDocument.Parse(renamed.Body).RootElement.GetProperty("version").GetInt32());

        var stale = await SendAsync(editor, HttpMethod.Put, "/api/v1/pages/" + id, new { version = 1, slug = "studio-" + suffix, title = "Too late" });
        Assert.Equal(HttpStatusCode.Conflict, stale.Status);
        Assert.Equal("concurrency_conflict", Code(stale.Body));

        var section = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages/" + id + "/sections", new
        {
            version = 2,
            type = "call_to_action",
            fields = new { heading = "Talk to us" },
        });
        Assert.Equal(HttpStatusCode.OK, section.Status);
        var withSection = JsonDocument.Parse(section.Body).RootElement;
        Assert.Equal(3, withSection.GetProperty("version").GetInt32());
        var sectionId = withSection.GetProperty("content").GetProperty("sections")[0].GetProperty("id").GetGuid();

        var badSection = await SendAsync(editor, HttpMethod.Put, "/api/v1/pages/" + id + "/sections/" + sectionId, new
        {
            version = 3,
            fields = new { notAField = "no" },
        });
        Assert.Equal(HttpStatusCode.BadRequest, badSection.Status);
        Assert.Equal("validation_failed", Code(badSection.Body));

        var staleSection = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages/" + id + "/sections/" + sectionId + "/visibility", new { version = 2, visible = false });
        Assert.Equal(HttpStatusCode.Conflict, staleSection.Status);

        var hidden = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages/" + id + "/sections/" + sectionId + "/visibility", new { version = 3, visible = false });
        Assert.Equal(HttpStatusCode.OK, hidden.Status);
        Assert.False(JsonDocument.Parse(hidden.Body).RootElement.GetProperty("content").GetProperty("sections")[0].GetProperty("visible").GetBoolean());

        var shown = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages/" + id + "/sections/" + sectionId + "/visibility", new { version = 4, visible = true });
        Assert.Equal(HttpStatusCode.OK, shown.Status);

        var edited = await SendAsync(editor, HttpMethod.Put, "/api/v1/pages/" + id + "/sections/" + sectionId, new
        {
            version = 5,
            fields = new { heading = "Talk to the team" },
        });
        Assert.Equal(HttpStatusCode.OK, edited.Status);

        var reordered = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages/" + id + "/sections/reorder", new { version = 6, sectionIds = new[] { sectionId } });
        Assert.Equal(HttpStatusCode.OK, reordered.Status);

        var removed = await SendAsync(editor, HttpMethod.Delete, "/api/v1/pages/" + id + "/sections/" + sectionId + "?version=7");
        Assert.Equal(HttpStatusCode.OK, removed.Status);
        Assert.Equal(0, JsonDocument.Parse(removed.Body).RootElement.GetProperty("content").GetProperty("sections").GetArrayLength());

        using (var scope = _factory.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            var row = await database.Pages.SingleAsync(item => item.Id == id);
            var stamp = row.UpdatedAt;
            row.Status = ContentStatus.Published;
            row.PublishedAt = DateTime.UtcNow;
            await database.SaveChangesAsync();

            var before = await SendAsync(admin, HttpMethod.Get, "/api/v1/pages/" + id);
            var liveTitle = JsonDocument.Parse(before.Body).RootElement.GetProperty("live").GetProperty("title").GetString();
            var version = JsonDocument.Parse(before.Body).RootElement.GetProperty("version").GetInt32();
            var redirects = await database.Redirects.CountAsync();

            var draftTitle = await SendAsync(editor, HttpMethod.Put, "/api/v1/pages/" + id, new { version, slug = "studio-live-" + suffix, title = "Draft title" });
            Assert.Equal(HttpStatusCode.OK, draftTitle.Status);
            var drafted = JsonDocument.Parse(draftTitle.Body).RootElement;
            Assert.True(drafted.GetProperty("hasWorkingCopy").GetBoolean());
            Assert.Equal("Draft title", drafted.GetProperty("content").GetProperty("title").GetString());
            Assert.Equal(liveTitle, drafted.GetProperty("live").GetProperty("title").GetString());
            Assert.Equal("studio-" + suffix, drafted.GetProperty("live").GetProperty("slug").GetString());
            Assert.Equal(stamp.ToString("yyyy-MM-dd HH:mm:ss"), DateTime.Parse(drafted.GetProperty("updatedAt").GetString()!).ToUniversalTime().ToString("yyyy-MM-dd HH:mm:ss"));
            Assert.Equal(redirects, await database.Redirects.CountAsync());

            var draftSection = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages/" + id + "/sections", new
            {
                version = drafted.GetProperty("version").GetInt32(),
                type = "call_to_action",
                fields = new { heading = "Still a draft" },
            });
            Assert.Equal(HttpStatusCode.OK, draftSection.Status);
            var afterSection = JsonDocument.Parse(draftSection.Body).RootElement;
            Assert.Equal(0, afterSection.GetProperty("live").GetProperty("sections").GetArrayLength());
            Assert.Equal(1, afterSection.GetProperty("content").GetProperty("sections").GetArrayLength());

            var invalidDraft = await SendAsync(editor, HttpMethod.Put, "/api/v1/pages/" + id + "/sections/" + afterSection.GetProperty("content").GetProperty("sections")[0].GetProperty("id").GetGuid(), new
            {
                version = afterSection.GetProperty("version").GetInt32(),
                fields = new { heading = 12 },
            });
            Assert.Equal(HttpStatusCode.BadRequest, invalidDraft.Status);

            var discard = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages/" + id + "/discard", new { version = afterSection.GetProperty("version").GetInt32() });
            Assert.Equal(HttpStatusCode.OK, discard.Status);
            var discarded = JsonDocument.Parse(discard.Body).RootElement;
            Assert.False(discarded.GetProperty("hasWorkingCopy").GetBoolean());
            Assert.Equal(liveTitle, discarded.GetProperty("content").GetProperty("title").GetString());
            Assert.Equal("discard_draft", await database.AuditLog.Where(entry => entry.EntityId == id.ToString()).OrderByDescending(entry => entry.At).Select(entry => entry.Action).FirstAsync());
        }

        var editorDelete = await SendAsync(editor, HttpMethod.Delete, "/api/v1/pages/" + id + "?version=1");
        Assert.Equal(HttpStatusCode.Forbidden, editorDelete.Status);

        var current = await SendAsync(admin, HttpMethod.Get, "/api/v1/pages/" + id);
        var deleteVersion = JsonDocument.Parse(current.Body).RootElement.GetProperty("version").GetInt32();
        var refused = await SendAsync(admin, HttpMethod.Delete, "/api/v1/pages/" + id + "?version=" + deleteVersion);
        Assert.Equal(HttpStatusCode.Conflict, refused.Status);
        Assert.Equal("published", Code(refused.Body));

        using (var scope = _factory.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            var row = await database.Pages.SingleAsync(item => item.Id == id);
            row.Status = ContentStatus.Draft;
            await database.SaveChangesAsync();
        }

        var adminDelete = await SendAsync(admin, HttpMethod.Delete, "/api/v1/pages/" + id + "?version=" + deleteVersion);
        Assert.Equal(HttpStatusCode.NoContent, adminDelete.Status);
        var gone = await SendAsync(admin, HttpMethod.Get, "/api/v1/pages/" + id);
        Assert.Equal(HttpStatusCode.NotFound, gone.Status);
    }

    [Theory]
    [InlineData("services")]
    [InlineData("partners")]
    [InlineData("case-studies")]
    [InlineData("blog-posts")]
    [InlineData("vacancies")]
    [InlineData("team-members")]
    [InlineData("news-items")]
    public async Task Editor_creates_and_updates_every_collection(string collection)
    {
        var editor = await LoginAsync("content-editor@digitalhub.test", "editor");
        var slug = collection + "-" + Guid.NewGuid().ToString("N")[..8];
        object fields = collection switch
        {
            "vacancies" => new { department = "Engineering", location = "Cairo" },
            "team-members" => new { role = "Editor" },
            "news-items" => new { year = "2026", month = "September" },
            _ => new { },
        };
        var created = await SendAsync(editor, HttpMethod.Post, "/api/v1/" + collection, new { slug, title = "Item", fields });
        Assert.Equal(HttpStatusCode.Created, created.Status);
        var id = JsonDocument.Parse(created.Body).RootElement.GetProperty("id").GetGuid();
        var updated = await SendAsync(editor, HttpMethod.Put, "/api/v1/" + collection + "/" + id, new { version = 1, slug, title = "Item updated" });
        Assert.Equal(HttpStatusCode.OK, updated.Status);
        var version = JsonDocument.Parse(updated.Body).RootElement.GetProperty("version").GetInt32();
        Assert.Equal(2, version);

        if (collection is "services" or "partners" or "case-studies")
        {
            var section = await SendAsync(editor, HttpMethod.Post, "/api/v1/" + collection + "/" + id + "/sections", new { version, type = "call_to_action", fields = new { heading = "Next" } });
            Assert.Equal(HttpStatusCode.OK, section.Status);
            version = JsonDocument.Parse(section.Body).RootElement.GetProperty("version").GetInt32();
        }

        if (collection == "vacancies")
        {
            var sections = await SendAsync(editor, HttpMethod.Post, "/api/v1/vacancies/" + id + "/sections", new { version, type = "call_to_action", fields = new { heading = "No" } });
            Assert.Equal(HttpStatusCode.NotFound, sections.Status);
            Assert.Equal("sections_not_supported", Code(sections.Body));
        }

        var admin = await LoginAsync(ApiFactory.AdminEmail, "admin", ApiFactory.AdminPassword);
        var deleted = await SendAsync(admin, HttpMethod.Delete, "/api/v1/" + collection + "/" + id + "?version=" + version);
        Assert.Equal(HttpStatusCode.NoContent, deleted.Status);
    }

    [Fact]
    public async Task Media_in_use_includes_working_copies_and_skips_revisions()
    {
        using var scope = _factory.Services.CreateScope();
        var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        var live = NewMedia();
        var drafted = NewMedia();
        var retiredId = Guid.NewGuid();
        database.Media.AddRange(live, drafted);
        var page = new Page
        {
            Id = Guid.NewGuid(),
            Slug = "media-" + Guid.NewGuid().ToString("N")[..8],
            Title = "Media",
            Status = ContentStatus.Published,
            Version = 1,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            ShareImageId = live.Id,
        };
        database.Pages.Add(page);
        database.WorkingCopies.Add(new WorkingCopy
        {
            Id = Guid.NewGuid(),
            PageId = page.Id,
            SavedAt = DateTime.UtcNow,
            Document = "{\"shareImageId\":\"" + drafted.Id + "\"}",
        });
        database.Revisions.Add(new Revision
        {
            Id = Guid.NewGuid(),
            EntityType = "page",
            EntityId = page.Id,
            Version = 1,
            PublishedAt = DateTime.UtcNow,
            Snapshot = "{\"shareImageId\":\"" + retiredId + "\"}",
        });
        await database.SaveChangesAsync();

        Assert.True(await MediaUsage.IsInUseAsync(database, live.Id, CancellationToken.None));
        Assert.True(await MediaUsage.IsInUseAsync(database, drafted.Id, CancellationToken.None));
        Assert.False(await MediaUsage.IsInUseAsync(database, retiredId, CancellationToken.None));
        var missing = await MediaUsage.MissingAsync(database, "{\"mediaId\":\"" + retiredId + "\",\"shareImageId\":\"" + live.Id + "\"}", CancellationToken.None);
        Assert.Equal([retiredId], missing);

        database.Revisions.RemoveRange(database.Revisions.Where(item => item.EntityId == page.Id));
        database.WorkingCopies.RemoveRange(database.WorkingCopies.Where(item => item.PageId == page.Id));
        database.Pages.Remove(page);
        database.Media.RemoveRange(live, drafted);
        await database.SaveChangesAsync();
    }

    [Fact]
    public async Task An_import_is_refused_once_studio_editing_has_started()
    {
        using var scope = _factory.Services.CreateScope();
        var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        var id = Guid.NewGuid();
        database.AuditLog.Add(new AuditLogEntry
        {
            Id = id,
            Action = "update",
            EntityType = "page",
            EntityId = id.ToString("D"),
            At = DateTime.UtcNow,
            Success = true,
        });
        await database.SaveChangesAsync();
        try
        {
            Assert.True(await StudioEdits.HasStartedAsync(database, CancellationToken.None));
        }
        finally
        {
            var entry = await database.AuditLog.SingleAsync(item => item.Id == id);
            database.AuditLog.Remove(entry);
            await database.SaveChangesAsync();
        }
    }

    private async Task<AuthSession> LoginAsync(string email, string role, string? password = null)
    {
        if (role != "admin")
            await CreateUserAsync(email, role);
        return await AuthSession.LoginAsync(_client, email, password ?? ApiFactory.AdminPassword);
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
        if (role != "guest")
            Assert.True((await users.AddToRoleAsync(user, role)).Succeeded);
        else
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

    private static string? Code(string body) =>
        JsonDocument.Parse(body).RootElement.TryGetProperty("code", out var code) ? code.GetString() : null;

    private static MediaAsset NewMedia() => new()
    {
        Id = Guid.NewGuid(),
        Path = "/media/" + Guid.NewGuid().ToString("N") + ".webp",
        OriginalName = "image.webp",
        ContentType = "image/webp",
        GeneratedSizes = "[]",
        ContentHash = Guid.NewGuid().ToString("N"),
        CreatedAt = DateTime.UtcNow,
    };
}
