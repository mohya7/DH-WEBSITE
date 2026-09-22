using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DigitalHub.Api.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DigitalHub.Api.Tests;

[Collection("SqlServer")]
public sealed class ContentPublishTests : IClassFixture<ApiFactory>
{
    private const string Description = "A description for publish.";

    private static readonly SemaphoreSlim Gate = new(1, 1);
    private static AuthSession? _editor;
    private static AuthSession? _admin;

    private readonly ApiFactory _factory;
    private readonly HttpClient _client;

    public ContentPublishTests(ApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Publish_succeeds_for_an_editor_and_an_admin()
    {
        var editor = await Editor();
        var admin = await Admin();
        var first = await CreatePageAsync(editor);
        var second = await CreatePageAsync(admin);
        var editorPublish = await SendAsync(editor, HttpMethod.Post, PublishUrl(first), new { version = first.Version });
        var adminPublish = await SendAsync(admin, HttpMethod.Post, PublishUrl(second), new { version = second.Version });
        Assert.Equal(HttpStatusCode.OK, editorPublish.Status);
        Assert.Equal(HttpStatusCode.OK, adminPublish.Status);
        Assert.Equal("published", Text(editorPublish.Body, "state"));
        Assert.Equal("Published changes appear on the website at the next build.", Text(editorPublish.Body, "notice"));
        await RemoveAsync(editorPublish.Body);
        await RemoveAsync(adminPublish.Body);
    }

    [Fact]
    public async Task Publish_rejects_a_missing_version()
    {
        var editor = await Editor();
        var response = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages/" + Guid.NewGuid() + "/publish", new { version = 0 });
        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Equal("validation_failed", Code(response.Body));
    }

    [Fact]
    public async Task Publish_returns_409_for_a_stale_version()
    {
        var page = await CreatePageAsync(await Editor());
        var response = await SendAsync(await Admin(), HttpMethod.Post, PublishUrl(page), new { version = page.Version + 3 });
        Assert.Equal(HttpStatusCode.Conflict, response.Status);
        Assert.Equal("concurrency_conflict", Code(response.Body));
        await RemoveAsync(page);
    }

    [Fact]
    public async Task Publish_reports_every_failure_at_once()
    {
        var editor = await Editor();
        var mediaId = Guid.NewGuid();
        using (var scope = _factory.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            database.Media.Add(new MediaAsset
            {
                Id = mediaId,
                Path = "tests/" + mediaId.ToString("N") + ".webp",
                OriginalName = "empty-alt.webp",
                ContentType = "image/webp",
                GeneratedSizes = "[]",
                ContentHash = mediaId.ToString("N"),
                Alt = "",
                CreatedAt = DateTime.UtcNow,
            });
            await database.SaveChangesAsync();
        }

        var slug = Slug();
        var created = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages", new { slug, title = "Blocked", shareImageId = mediaId });
        Assert.Equal(HttpStatusCode.Created, created.Status);
        var page = ReadPage(created.Body, slug);
        var hero = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages/" + page.Id + "/sections", new
        {
            version = page.Version,
            type = "hero",
            fields = new
            {
                heading = "Hero",
                back = new { label = "Missing", href = "/no-such-page" },
                logos = new[]
                {
                    new
                    {
                        image = new { mediaId, alt = "", decorative = true },
                        reference = new { type = "service", slug = "no-such-service" },
                    },
                },
            },
        });
        Assert.Equal(HttpStatusCode.OK, hero.Status);
        var withHero = ReadPage(hero.Body, slug);
        var action = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages/" + page.Id + "/sections", new
        {
            version = withHero.Version,
            type = "call_to_action",
            fields = new { heading = "Valid" },
        });
        Assert.Equal(HttpStatusCode.OK, action.Status);
        var ready = ReadPage(action.Body, slug);

        using (var scope = _factory.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            var section = await database.Sections.SingleAsync(item => item.PageId == page.Id && item.Type == "call_to_action");
            section.Fields = """{"nope":1}""";
            await database.SaveChangesAsync();
        }

        var response = await SendAsync(editor, HttpMethod.Post, PublishUrl(ready), new { version = ready.Version });
        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Equal("publish_blocked", Code(response.Body));
        var errors = JsonDocument.Parse(response.Body).RootElement.GetProperty("errors");
        Assert.True(errors.TryGetProperty("metaDescription", out _));
        Assert.True(errors.TryGetProperty("shareImage", out _));
        Assert.True(errors.TryGetProperty("links", out _));
        Assert.True(errors.TryGetProperty("references", out _));
        Assert.True(errors.TryGetProperty("sections[1]", out _));

        var unchanged = await SendAsync(editor, HttpMethod.Get, "/api/v1/pages/" + page.Id);
        Assert.Equal("draft", Text(unchanged.Body, "status"));
        Assert.Equal(ready.Version, JsonDocument.Parse(unchanged.Body).RootElement.GetProperty("version").GetInt32());
        await RemoveAsync(ready);

        using (var scope = _factory.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            var media = await database.Media.SingleAsync(item => item.Id == mediaId);
            database.Media.Remove(media);
            await database.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task Publish_copies_the_working_copy_and_writes_a_revision()
    {
        var editor = await Editor();
        var page = await CreatePageAsync(editor);
        var published = await SendAsync(editor, HttpMethod.Post, PublishUrl(page), new { version = page.Version });
        Assert.Equal(HttpStatusCode.OK, published.Status);
        var live = ReadPage(published.Body, page.Slug);
        var edited = await SendAsync(editor, HttpMethod.Put, "/api/v1/pages/" + page.Id, new
        {
            version = live.Version,
            slug = page.Slug,
            title = "Changed title",
            metaDescription = Description,
        });
        Assert.Equal(HttpStatusCode.OK, edited.Status);
        Assert.Equal("changed", Text(edited.Body, "state"));
        Assert.Equal("Coverage", Text(edited.Body, "live", "title"));
        Assert.Equal("Changed title", Text(edited.Body, "content", "title"));

        var again = await SendAsync(editor, HttpMethod.Post, PublishUrl(page), new { version = ReadPage(edited.Body, page.Slug).Version });
        Assert.Equal(HttpStatusCode.OK, again.Status);
        Assert.Equal("published", Text(again.Body, "state"));
        Assert.Equal("Changed title", Text(again.Body, "live", "title"));
        Assert.False(JsonDocument.Parse(again.Body).RootElement.GetProperty("hasWorkingCopy").GetBoolean());
        Assert.NotEqual(JsonValueKind.Null, JsonDocument.Parse(again.Body).RootElement.GetProperty("publishedAt").ValueKind);

        var revisions = await SendAsync(editor, HttpMethod.Get, "/api/v1/pages/" + page.Id + "/revisions");
        Assert.Equal(2, JsonDocument.Parse(revisions.Body).RootElement.GetProperty("items").GetArrayLength());
        using (var scope = _factory.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            Assert.True(await database.AuditLog.AnyAsync(item => item.Action == "publish" && item.EntityId == page.Id.ToString()));
        }

        await RemoveAsync(ReadPage(again.Body, page.Slug));
    }

    [Fact]
    public async Task Publish_renames_a_published_item_and_collapses_redirect_chains()
    {
        var editor = await Editor();
        var page = await CreatePageAsync(editor);
        var published = await SendAsync(editor, HttpMethod.Post, PublishUrl(page), new { version = page.Version });
        var live = ReadPage(published.Body, page.Slug);
        var former = "/former-" + page.Slug;
        using (var scope = _factory.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            database.Redirects.Add(new Redirect
            {
                Id = Guid.NewGuid(),
                FromPath = former,
                ToPath = "/" + page.Slug,
                StatusCode = 301,
                Source = "manual",
                CreatedAt = DateTime.UtcNow,
            });
            await database.SaveChangesAsync();
        }

        var renamed = "renamed-" + page.Slug["pub-".Length..];
        var edited = await SendAsync(editor, HttpMethod.Put, "/api/v1/pages/" + page.Id, new
        {
            version = live.Version,
            slug = renamed,
            title = "Coverage",
            metaDescription = Description,
        });
        Assert.Equal(HttpStatusCode.OK, edited.Status);
        var draft = ReadPage(edited.Body, renamed);
        var response = await SendAsync(editor, HttpMethod.Post, PublishUrl(draft), new { version = draft.Version });
        Assert.Equal(HttpStatusCode.OK, response.Status);
        Assert.Equal(renamed, Text(response.Body, "live", "slug"));

        using (var scope = _factory.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            var redirects = await database.Redirects.AsNoTracking().Where(item => item.ToPath == "/" + renamed).ToListAsync();
            Assert.Contains(redirects, item => item.FromPath == "/" + page.Slug && item.Source == "slug");
            Assert.Contains(redirects, item => item.FromPath == former && item.ToPath == "/" + renamed);
            Assert.True(await database.AuditLog.AnyAsync(item => item.Action == "create_redirect" && item.Detail == "/" + page.Slug + " -> /" + renamed));
            Assert.True(await database.AuditLog.AnyAsync(item => item.Action == "update_redirect" && item.Detail == former + " -> /" + renamed));
        }

        await RemoveAsync(ReadPage(response.Body, renamed));
    }

    [Fact]
    public async Task Publish_refuses_a_rename_that_would_loop()
    {
        var editor = await Editor();
        var page = await CreatePageAsync(editor);
        var published = await SendAsync(editor, HttpMethod.Post, PublishUrl(page), new { version = page.Version });
        var live = ReadPage(published.Body, page.Slug);
        var blocked = "blocked-" + page.Slug["pub-".Length..];
        using (var scope = _factory.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            database.Redirects.Add(new Redirect
            {
                Id = Guid.NewGuid(),
                FromPath = "/" + blocked,
                ToPath = "/somewhere-else",
                StatusCode = 301,
                Source = "manual",
                CreatedAt = DateTime.UtcNow,
            });
            database.WorkingCopies.Add(new WorkingCopy
            {
                Id = Guid.NewGuid(),
                PageId = page.Id,
                Document = "{\"slug\":\"" + blocked + "\",\"title\":\"Coverage\",\"metaDescription\":\"" + Description + "\",\"sections\":[]}",
                SavedAt = DateTime.UtcNow,
            });
            await database.SaveChangesAsync();
        }

        var response = await SendAsync(editor, HttpMethod.Post, PublishUrl(live), new { version = live.Version });
        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Equal("publish_blocked", Code(response.Body));
        Assert.Contains("source of a redirect", response.Body, StringComparison.Ordinal);

        using (var scope = _factory.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            var row = await database.Pages.SingleAsync(item => item.Id == page.Id);
            Assert.Equal(page.Slug, row.Slug);
            Assert.Equal(ContentStatus.Published, row.Status);
            Assert.False(await database.Redirects.AnyAsync(item => item.FromPath == "/" + page.Slug));
            database.WorkingCopies.RemoveRange(database.WorkingCopies.Where(item => item.PageId == page.Id));
            database.Redirects.RemoveRange(database.Redirects.Where(item => item.FromPath == "/" + blocked));
            row.Status = ContentStatus.Draft;
            await database.SaveChangesAsync();
        }

        await RemoveAsync(live);
    }

    [Fact]
    public async Task Slug_cannot_match_a_redirect_source()
    {
        var editor = await Editor();
        var slug = Slug();
        var redirectId = Guid.NewGuid();
        using (var scope = _factory.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            database.Redirects.Add(new Redirect
            {
                Id = redirectId,
                FromPath = "/" + slug,
                ToPath = "/kept",
                StatusCode = 301,
                Source = "manual",
                CreatedAt = DateTime.UtcNow,
            });
            await database.SaveChangesAsync();
        }

        var response = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages", new { slug, title = "Taken", metaDescription = Description });
        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Equal("validation_failed", Code(response.Body));
        Assert.True(JsonDocument.Parse(response.Body).RootElement.GetProperty("errors").TryGetProperty("slug", out _));

        using (var scope = _factory.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            database.Redirects.RemoveRange(database.Redirects.Where(item => item.Id == redirectId));
            await database.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task Unpublish_succeeds_for_an_editor_and_an_admin()
    {
        var editor = await Editor();
        var admin = await Admin();
        var first = await PublishNewAsync(editor);
        var second = await PublishNewAsync(admin);
        var editorResult = await SendAsync(editor, HttpMethod.Post, UnpublishUrl(first), new { version = first.Version });
        var adminResult = await SendAsync(admin, HttpMethod.Post, UnpublishUrl(second), new { version = second.Version });
        Assert.Equal(HttpStatusCode.OK, editorResult.Status);
        Assert.Equal(HttpStatusCode.OK, adminResult.Status);
        Assert.Equal("draft", Text(editorResult.Body, "state"));
        using (var scope = _factory.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            Assert.True(await database.AuditLog.AnyAsync(item => item.Action == "unpublish" && item.EntityId == first.Id.ToString()));
        }

        await RemoveAsync(ReadPage(editorResult.Body, first.Slug));
        await RemoveAsync(ReadPage(adminResult.Body, second.Slug));
    }

    [Fact]
    public async Task Unpublish_rejects_a_missing_version()
    {
        var editor = await Editor();
        var response = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages/" + Guid.NewGuid() + "/unpublish", new { version = 0 });
        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Equal("validation_failed", Code(response.Body));
    }

    [Fact]
    public async Task Unpublish_returns_409_for_a_stale_version()
    {
        var page = await PublishNewAsync(await Editor());
        var response = await SendAsync(await Admin(), HttpMethod.Post, UnpublishUrl(page), new { version = page.Version + 4 });
        Assert.Equal(HttpStatusCode.Conflict, response.Status);
        Assert.Equal("concurrency_conflict", Code(response.Body));
        await RemoveAsync(page);
    }

    [Fact]
    public async Task Unpublish_returns_409_when_the_item_is_not_published()
    {
        var page = await CreatePageAsync(await Editor());
        var response = await SendAsync(await Editor(), HttpMethod.Post, UnpublishUrl(page), new { version = page.Version });
        Assert.Equal(HttpStatusCode.Conflict, response.Status);
        Assert.Equal("not_published", Code(response.Body));
        await RemoveAsync(page);
    }

    [Fact]
    public async Task List_revisions_succeeds_for_an_editor_and_an_admin()
    {
        var page = await PublishNewAsync(await Editor());
        var editor = await Editor();
        var admin = await Admin();
        Assert.Equal(HttpStatusCode.OK, (await SendAsync(editor, HttpMethod.Get, "/api/v1/pages/" + page.Id + "/revisions")).Status);
        Assert.Equal(HttpStatusCode.OK, (await SendAsync(admin, HttpMethod.Get, "/api/v1/pages/" + page.Id + "/revisions")).Status);
        await RemoveAsync(page);
    }

    [Fact]
    public async Task List_revisions_returns_not_found_for_a_missing_item()
    {
        var response = await SendAsync(await Editor(), HttpMethod.Get, "/api/v1/pages/" + Guid.NewGuid() + "/revisions");
        Assert.Equal(HttpStatusCode.NotFound, response.Status);
        Assert.Equal("not_found", Code(response.Body));
    }

    [Fact]
    public async Task Get_revision_succeeds_for_an_editor_and_an_admin()
    {
        var editor = await Editor();
        var page = await PublishNewAsync(editor);
        var list = await SendAsync(editor, HttpMethod.Get, "/api/v1/pages/" + page.Id + "/revisions");
        var revisionId = JsonDocument.Parse(list.Body).RootElement.GetProperty("items")[0].GetProperty("id").GetGuid();
        var editorResult = await SendAsync(editor, HttpMethod.Get, RevisionUrl(page, revisionId));
        var adminResult = await SendAsync(await Admin(), HttpMethod.Get, RevisionUrl(page, revisionId));
        Assert.Equal(HttpStatusCode.OK, editorResult.Status);
        Assert.Equal(HttpStatusCode.OK, adminResult.Status);
        Assert.Equal(page.Slug, Text(editorResult.Body, "snapshot", "slug"));
        await RemoveAsync(page);
    }

    [Fact]
    public async Task Get_revision_returns_not_found()
    {
        var page = await PublishNewAsync(await Editor());
        var response = await SendAsync(await Editor(), HttpMethod.Get, RevisionUrl(page, Guid.NewGuid()));
        Assert.Equal(HttpStatusCode.NotFound, response.Status);
        Assert.Equal("not_found", Code(response.Body));
        await RemoveAsync(page);
    }

    [Fact]
    public async Task Restore_succeeds_for_an_editor_and_an_admin()
    {
        var editor = await Editor();
        var admin = await Admin();
        var first = await PublishNewAsync(editor);
        var second = await PublishNewAsync(admin);
        var firstId = await FirstRevisionIdAsync(editor, first);
        var secondId = await FirstRevisionIdAsync(admin, second);
        var editorResult = await SendAsync(editor, HttpMethod.Post, RevisionUrl(first, firstId) + "/restore", new { version = first.Version });
        var adminResult = await SendAsync(admin, HttpMethod.Post, RevisionUrl(second, secondId) + "/restore", new { version = second.Version });
        Assert.Equal(HttpStatusCode.OK, editorResult.Status);
        Assert.Equal(HttpStatusCode.OK, adminResult.Status);
        Assert.Equal("published", Text(editorResult.Body, "item", "status"));
        Assert.Equal("changed", Text(editorResult.Body, "item", "state"));
        await RemoveAsync(first);
        await RemoveAsync(second);
    }

    [Fact]
    public async Task Restore_rejects_a_missing_version()
    {
        var response = await SendAsync(await Editor(), HttpMethod.Post, "/api/v1/pages/" + Guid.NewGuid() + "/revisions/" + Guid.NewGuid() + "/restore", new { version = 0 });
        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Equal("validation_failed", Code(response.Body));
    }

    [Fact]
    public async Task Restore_returns_409_for_a_stale_version()
    {
        var editor = await Editor();
        var page = await PublishNewAsync(editor);
        var revisionId = await FirstRevisionIdAsync(editor, page);
        var response = await SendAsync(editor, HttpMethod.Post, RevisionUrl(page, revisionId) + "/restore", new { version = page.Version + 5 });
        Assert.Equal(HttpStatusCode.Conflict, response.Status);
        Assert.Equal("concurrency_conflict", Code(response.Body));
        await RemoveAsync(page);
    }

    [Fact]
    public async Task Restore_rejects_a_snapshot_with_an_invalid_slug()
    {
        var editor = await Editor();
        var page = await PublishNewAsync(editor);
        var revisionId = Guid.NewGuid();
        using (var scope = _factory.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            database.Revisions.Add(new Revision
            {
                Id = revisionId,
                EntityType = "page",
                EntityId = page.Id,
                Version = 1,
                Snapshot = "{\"slug\":\"Bad Slug\",\"title\":\"Coverage\",\"metaDescription\":\"" + Description + "\",\"sections\":[]}",
                PublishedAt = DateTime.UtcNow,
            });
            await database.SaveChangesAsync();
        }

        var response = await SendAsync(editor, HttpMethod.Post, RevisionUrl(page, revisionId) + "/restore", new { version = page.Version });
        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Equal("validation_failed", Code(response.Body));
        using (var scope = _factory.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            var row = await database.Pages.AsNoTracking().SingleAsync(item => item.Id == page.Id);
            Assert.Equal(page.Slug, row.Slug);
            Assert.Equal(ContentStatus.Published, row.Status);
        }

        await RemoveAsync(page);
    }

    [Fact]
    public async Task Restore_reports_missing_media_and_does_not_publish()
    {
        var editor = await Editor();
        var page = await CreatePageAsync(editor);
        var firstPublish = await SendAsync(editor, HttpMethod.Post, PublishUrl(page), new { version = page.Version });
        var published = ReadPage(firstPublish.Body, page.Slug);
        var edited = await SendAsync(editor, HttpMethod.Put, "/api/v1/pages/" + page.Id, new
        {
            version = published.Version,
            slug = page.Slug,
            title = "Second publish",
            metaDescription = Description,
        });
        var second = await SendAsync(editor, HttpMethod.Post, PublishUrl(page), new { version = ReadPage(edited.Body, page.Slug).Version });
        var current = ReadPage(second.Body, page.Slug);
        var list = await SendAsync(editor, HttpMethod.Get, "/api/v1/pages/" + page.Id + "/revisions");
        var older = JsonDocument.Parse(list.Body).RootElement.GetProperty("items").EnumerateArray().Last();
        var olderId = older.GetProperty("id").GetGuid();

        var restored = await SendAsync(editor, HttpMethod.Post, RevisionUrl(current, olderId) + "/restore", new { version = current.Version });
        Assert.Equal(HttpStatusCode.OK, restored.Status);
        Assert.Equal("published", Text(restored.Body, "item", "status"));
        Assert.Equal("Second publish", Text(restored.Body, "item", "live", "title"));
        Assert.Equal("Coverage", Text(restored.Body, "item", "content", "title"));
        Assert.Equal(0, JsonDocument.Parse(restored.Body).RootElement.GetProperty("missingMedia").GetArrayLength());

        var missingId = Guid.NewGuid();
        var revisionId = Guid.NewGuid();
        var after = ReadItemVersion(restored.Body);
        using (var scope = _factory.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            database.Revisions.Add(new Revision
            {
                Id = revisionId,
                EntityType = "page",
                EntityId = page.Id,
                Version = 9,
                Snapshot = "{\"slug\":\"" + page.Slug + "\",\"title\":\"Missing media\",\"metaDescription\":\"" + Description + "\",\"shareImageId\":\"" + missingId + "\",\"sections\":[]}",
                PublishedAt = DateTime.UtcNow.AddMinutes(1),
            });
            await database.SaveChangesAsync();
        }

        var withMissing = await SendAsync(editor, HttpMethod.Post, RevisionUrl(current, revisionId) + "/restore", new { version = after });
        Assert.Equal(HttpStatusCode.OK, withMissing.Status);
        Assert.Equal("published", Text(withMissing.Body, "item", "status"));
        var missing = JsonDocument.Parse(withMissing.Body).RootElement.GetProperty("missingMedia");
        Assert.Equal(missingId, missing[0].GetGuid());
        Assert.Equal("Second publish", Text(withMissing.Body, "item", "live", "title"));

        using (var scope = _factory.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            Assert.True(await database.AuditLog.AnyAsync(item => item.Action == "restore" && item.EntityId == page.Id.ToString()));
            database.WorkingCopies.RemoveRange(database.WorkingCopies.Where(item => item.PageId == page.Id));
            var row = await database.Pages.SingleAsync(item => item.Id == page.Id);
            row.Status = ContentStatus.Draft;
            await database.SaveChangesAsync();
        }

        await RemoveAsync(current with { Version = ReadItemVersion(withMissing.Body) });
    }

    [Fact]
    public async Task Publish_does_not_require_a_description_for_a_team_member_or_a_news_item()
    {
        var editor = await Editor();
        var team = await SendAsync(editor, HttpMethod.Post, "/api/v1/team-members", new { slug = Slug(), title = "Nada Younes" });
        var news = await SendAsync(editor, HttpMethod.Post, "/api/v1/news-items", new { slug = Slug(), title = "A mention", fields = new { summary = "" } });
        Assert.Equal(HttpStatusCode.Created, team.Status);
        Assert.Equal(HttpStatusCode.Created, news.Status);
        var teamRef = ReadPage(team.Body, "");
        var newsRef = ReadPage(news.Body, "");
        var teamPublish = await SendAsync(editor, HttpMethod.Post, "/api/v1/team-members/" + teamRef.Id + "/publish", new { version = teamRef.Version });
        var newsPublish = await SendAsync(editor, HttpMethod.Post, "/api/v1/news-items/" + newsRef.Id + "/publish", new { version = newsRef.Version });
        Assert.Equal(HttpStatusCode.OK, teamPublish.Status);
        Assert.Equal(HttpStatusCode.OK, newsPublish.Status);
        Assert.Equal("published", Text(teamPublish.Body, "state"));
        Assert.Equal("published", Text(newsPublish.Body, "state"));

        var page = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages", new { slug = Slug(), title = "Needs a description" });
        var pageRef = ReadPage(page.Body, "");
        var blocked = await SendAsync(editor, HttpMethod.Post, PublishUrl(pageRef), new { version = pageRef.Version });
        Assert.Equal(HttpStatusCode.BadRequest, blocked.Status);
        Assert.Equal("publish_blocked", Code(blocked.Body));
        Assert.True(JsonDocument.Parse(blocked.Body).RootElement.GetProperty("errors").TryGetProperty("metaDescription", out _));

        await RemoveItemAsync("team-members", teamRef.Id);
        await RemoveItemAsync("news-items", newsRef.Id);
        await RemoveItemAsync("pages", pageRef.Id);
    }

    [Fact]
    public async Task Publish_redirects_from_the_last_published_path_after_unpublish()
    {
        var editor = await Editor();
        var page = await CreatePageAsync(editor);
        var published = await SendAsync(editor, HttpMethod.Post, PublishUrl(page), new { version = page.Version });
        var live = ReadPage(published.Body, page.Slug);
        var former = "/former-" + page.Slug;
        using (var scope = _factory.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            database.Redirects.Add(new Redirect
            {
                Id = Guid.NewGuid(),
                FromPath = former,
                ToPath = "/" + page.Slug,
                StatusCode = 301,
                Source = "manual",
                CreatedAt = DateTime.UtcNow,
            });
            await database.SaveChangesAsync();
        }

        var unpublished = await SendAsync(editor, HttpMethod.Post, UnpublishUrl(live), new { version = live.Version });
        Assert.Equal(HttpStatusCode.OK, unpublished.Status);
        var renamed = "renamed-" + page.Slug["pub-".Length..];
        var edited = await SendAsync(editor, HttpMethod.Put, "/api/v1/pages/" + page.Id, new
        {
            version = ReadPage(unpublished.Body, page.Slug).Version,
            slug = renamed,
            title = "Coverage",
            metaDescription = Description,
        });
        Assert.Equal(HttpStatusCode.OK, edited.Status);
        var response = await SendAsync(editor, HttpMethod.Post, PublishUrl(page), new { version = ReadPage(edited.Body, renamed).Version });
        Assert.Equal(HttpStatusCode.OK, response.Status);

        using (var scope = _factory.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            var redirects = await database.Redirects.AsNoTracking().Where(item => item.ToPath == "/" + renamed).ToListAsync();
            Assert.Contains(redirects, item => item.FromPath == "/" + page.Slug && item.Source == "slug");
            Assert.Contains(redirects, item => item.FromPath == former);
        }

        await RemoveAsync(ReadPage(response.Body, renamed));
    }

    [Fact]
    public async Task Publish_is_blocked_when_media_is_missing()
    {
        var editor = await Editor();
        var page = await CreatePageAsync(editor);
        var missingImage = Guid.NewGuid();
        var missingInBody = Guid.NewGuid();
        var section = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages/" + page.Id + "/sections", new
        {
            version = page.Version,
            type = "hero",
            fields = new { heading = "Hero" },
        });
        Assert.Equal(HttpStatusCode.OK, section.Status);
        var ready = ReadPage(section.Body, page.Slug);
        var article = await SendAsync(editor, HttpMethod.Post, "/api/v1/blog-posts", new { slug = Slug(), title = "Missing image", metaDescription = Description });
        Assert.Equal(HttpStatusCode.Created, article.Status);
        var articleRef = ReadPage(article.Body, "");
        using (var scope = _factory.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            var hero = await database.Sections.SingleAsync(item => item.PageId == page.Id);
            hero.Fields = "{\"heading\":\"Hero\",\"image\":{\"mediaId\":\"" + missingImage + "\",\"alt\":\"\",\"decorative\":false}}";
            var post = await database.BlogPosts.SingleAsync(item => item.Id == articleRef.Id);
            post.Body = "{\"type\":\"doc\",\"content\":[{\"type\":\"image\",\"attrs\":{\"mediaId\":\"" + missingInBody + "\"}}]}";
            await database.SaveChangesAsync();
        }

        var response = await SendAsync(editor, HttpMethod.Post, PublishUrl(ready), new { version = ready.Version });
        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Equal("publish_blocked", Code(response.Body));
        Assert.Contains(missingImage.ToString(), response.Body, StringComparison.OrdinalIgnoreCase);
        var articlePublish = await SendAsync(editor, HttpMethod.Post, "/api/v1/blog-posts/" + articleRef.Id + "/publish", new { version = articleRef.Version });
        Assert.Equal(HttpStatusCode.BadRequest, articlePublish.Status);
        Assert.Equal("publish_blocked", Code(articlePublish.Body));
        Assert.Contains(missingInBody.ToString(), articlePublish.Body, StringComparison.OrdinalIgnoreCase);
        var unchanged = await SendAsync(editor, HttpMethod.Get, "/api/v1/pages/" + page.Id);
        Assert.Equal("draft", Text(unchanged.Body, "status"));
        Assert.Equal(ready.Version, JsonDocument.Parse(unchanged.Body).RootElement.GetProperty("version").GetInt32());
        await RemoveAsync(ready);
        await RemoveItemAsync("blog-posts", articleRef.Id);
    }

    [Fact]
    public async Task Publish_warns_for_an_unpublished_reference_and_still_publishes()
    {
        var editor = await Editor();
        var caseSlug = Slug();
        var blogSlug = Slug();
        var serviceSlug = Slug();
        var study = await SendAsync(editor, HttpMethod.Post, "/api/v1/case-studies", new { slug = caseSlug, title = "Draft case" });
        var blog = await SendAsync(editor, HttpMethod.Post, "/api/v1/blog-posts", new { slug = blogSlug, title = "Draft blog", metaDescription = Description });
        var service = await SendAsync(editor, HttpMethod.Post, "/api/v1/services", new { slug = serviceSlug, title = "Live service", metaDescription = Description });
        Assert.Equal(HttpStatusCode.Created, study.Status);
        Assert.Equal(HttpStatusCode.Created, blog.Status);
        Assert.Equal(HttpStatusCode.Created, service.Status);
        var serviceRef = ReadPage(service.Body, serviceSlug);
        var servicePublish = await SendAsync(editor, HttpMethod.Post, "/api/v1/services/" + serviceRef.Id + "/publish", new { version = serviceRef.Version });
        Assert.Equal(HttpStatusCode.OK, servicePublish.Status);

        var page = await CreatePageAsync(editor);
        var related = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages/" + page.Id + "/sections", new
        {
            version = page.Version,
            type = "related_items",
            fields = new
            {
                heading = "Work",
                items = new object[]
                {
                    new { type = "case_study", slug = caseSlug, title = "", text = "" },
                    new { type = "blog_post", slug = blogSlug, title = "", text = "" },
                    new { type = "service", slug = serviceSlug, title = "", text = "" },
                },
            },
        });
        Assert.Equal(HttpStatusCode.OK, related.Status);
        var withRelated = ReadPage(related.Body, page.Slug);
        var link = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages/" + page.Id + "/sections", new
        {
            version = withRelated.Version,
            type = "call_to_action",
            fields = new { heading = "See the case", action = new { label = "Case", href = "/cases/" + caseSlug } },
        });
        Assert.Equal(HttpStatusCode.OK, link.Status);
        var ready = ReadPage(link.Body, page.Slug);
        var response = await SendAsync(editor, HttpMethod.Post, PublishUrl(ready), new { version = ready.Version });
        Assert.Equal(HttpStatusCode.OK, response.Status);
        Assert.Equal("published", Text(response.Body, "state"));
        var warnings = JsonDocument.Parse(response.Body).RootElement.GetProperty("warnings");
        var references = warnings.GetProperty("references").EnumerateArray().Select(item => item.GetString()).ToList();
        Assert.Contains("case_study " + caseSlug + " is not published, so it will not show.", references);
        Assert.Contains("blog_post " + blogSlug + " is not published, so it will not show.", references);
        Assert.DoesNotContain(references, item => item != null && item.Contains(serviceSlug, StringComparison.Ordinal));
        var links = warnings.GetProperty("links").EnumerateArray().Select(item => item.GetString()).ToList();
        Assert.Contains("/cases/" + caseSlug + " is not published, so it will not show.", links);

        var body = "{\"type\":\"doc\",\"content\":[],\"relatedItems\":[{\"type\":\"case_study\",\"slug\":\"" + caseSlug + "\"}]}";
        var article = await SendAsync(editor, HttpMethod.Post, "/api/v1/blog-posts", new
        {
            slug = Slug(),
            title = "With related items",
            metaDescription = Description,
            fields = new { body },
        });
        Assert.Equal(HttpStatusCode.Created, article.Status);
        var articleRef = ReadPage(article.Body, "");
        var articlePublish = await SendAsync(editor, HttpMethod.Post, "/api/v1/blog-posts/" + articleRef.Id + "/publish", new { version = articleRef.Version });
        Assert.Equal(HttpStatusCode.OK, articlePublish.Status);
        var articleWarnings = JsonDocument.Parse(articlePublish.Body).RootElement.GetProperty("warnings").GetProperty("references").EnumerateArray().Select(item => item.GetString());
        Assert.Contains("case_study " + caseSlug + " is not published, so it will not show.", articleWarnings);

        await RemoveItemAsync("pages", page.Id);
        await RemoveItemAsync("services", serviceRef.Id);
        await RemoveItemAsync("case-studies", ReadPage(study.Body, caseSlug).Id);
        await RemoveItemAsync("blog-posts", ReadPage(blog.Body, blogSlug).Id);
        await RemoveItemAsync("blog-posts", articleRef.Id);
    }

    [Fact]
    public async Task Publish_returns_warnings_alongside_failures()
    {
        var editor = await Editor();
        var caseSlug = Slug();
        var study = await SendAsync(editor, HttpMethod.Post, "/api/v1/case-studies", new { slug = caseSlug, title = "Draft case" });
        Assert.Equal(HttpStatusCode.Created, study.Status);
        var created = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages", new { slug = Slug(), title = "Blocked with a warning" });
        var page = ReadPage(created.Body, "");
        var related = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages/" + page.Id + "/sections", new
        {
            version = page.Version,
            type = "related_items",
            fields = new
            {
                heading = "Work",
                items = new[] { new { type = "case_study", slug = caseSlug, title = "", text = "" } },
            },
        });
        Assert.Equal(HttpStatusCode.OK, related.Status);
        var ready = ReadPage(related.Body, "");
        var response = await SendAsync(editor, HttpMethod.Post, PublishUrl(ready), new { version = ready.Version });
        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Equal("publish_blocked", Code(response.Body));
        var body = JsonDocument.Parse(response.Body).RootElement;
        Assert.True(body.GetProperty("errors").TryGetProperty("metaDescription", out _));
        var references = body.GetProperty("warnings").GetProperty("references").EnumerateArray().Select(item => item.GetString());
        Assert.Contains("case_study " + caseSlug + " is not published, so it will not show.", references);
        var unchanged = await SendAsync(editor, HttpMethod.Get, "/api/v1/pages/" + page.Id);
        Assert.Equal("draft", Text(unchanged.Body, "status"));
        await RemoveItemAsync("pages", page.Id);
        await RemoveItemAsync("case-studies", ReadPage(study.Body, caseSlug).Id);
    }

    private async Task<PageRef> CreatePageAsync(AuthSession session)
    {
        var slug = Slug();
        var response = await SendAsync(session, HttpMethod.Post, "/api/v1/pages", new { slug, title = "Coverage", metaDescription = Description });
        Assert.Equal(HttpStatusCode.Created, response.Status);
        return ReadPage(response.Body, slug);
    }

    private async Task<PageRef> PublishNewAsync(AuthSession session)
    {
        var page = await CreatePageAsync(session);
        var response = await SendAsync(session, HttpMethod.Post, PublishUrl(page), new { version = page.Version });
        Assert.Equal(HttpStatusCode.OK, response.Status);
        return ReadPage(response.Body, page.Slug);
    }

    private async Task<Guid> FirstRevisionIdAsync(AuthSession session, PageRef page)
    {
        var list = await SendAsync(session, HttpMethod.Get, "/api/v1/pages/" + page.Id + "/revisions");
        Assert.Equal(HttpStatusCode.OK, list.Status);
        return JsonDocument.Parse(list.Body).RootElement.GetProperty("items")[0].GetProperty("id").GetGuid();
    }

    private async Task RemoveAsync(PageRef page) => await RemoveAsync(page.Id, page.Version);

    private async Task RemoveAsync(string body)
    {
        var json = JsonDocument.Parse(body).RootElement;
        await RemoveAsync(json.GetProperty("id").GetGuid(), json.GetProperty("version").GetInt32());
    }

    private async Task RemoveItemAsync(string collection, Guid id)
    {
        int version;
        using (var scope = _factory.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            ContentRecord? row = collection switch
            {
                "pages" => await database.Pages.SingleOrDefaultAsync(item => item.Id == id),
                "services" => await database.Services.SingleOrDefaultAsync(item => item.Id == id),
                "case-studies" => await database.CaseStudies.SingleOrDefaultAsync(item => item.Id == id),
                "blog-posts" => await database.BlogPosts.SingleOrDefaultAsync(item => item.Id == id),
                "team-members" => await database.TeamMembers.SingleOrDefaultAsync(item => item.Id == id),
                "news-items" => await database.NewsItems.SingleOrDefaultAsync(item => item.Id == id),
                _ => null,
            };
            if (row is null)
                return;
            if (row.Status == ContentStatus.Published)
                row.Status = ContentStatus.Draft;
            version = row.Version;
            await database.SaveChangesAsync();
        }

        var admin = await Admin();
        var response = await SendAsync(admin, HttpMethod.Delete, "/api/v1/" + collection + "/" + id + "?version=" + version);
        Assert.Equal(HttpStatusCode.NoContent, response.Status);
    }

    private async Task RemoveAsync(Guid id, int version)
    {
        using (var scope = _factory.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            var row = await database.Pages.SingleOrDefaultAsync(item => item.Id == id);
            if (row is null)
                return;
            if (row.Status == ContentStatus.Published)
            {
                row.Status = ContentStatus.Draft;
                version = row.Version;
                await database.SaveChangesAsync();
            }
        }

        var admin = await Admin();
        var response = await SendAsync(admin, HttpMethod.Delete, "/api/v1/pages/" + id + "?version=" + version);
        Assert.Equal(HttpStatusCode.NoContent, response.Status);
    }

    private async Task<AuthSession> Editor() => await Session("content-editor@digitalhub.test", "editor", static () => _editor, value => _editor = value);

    private async Task<AuthSession> Admin() => await Session(ApiFactory.AdminEmail, "admin", static () => _admin, value => _admin = value, ApiFactory.AdminPassword);

    private async Task<AuthSession> Session(string email, string role, Func<AuthSession?> read, Action<AuthSession> write, string? password = null)
    {
        await Gate.WaitAsync();
        try
        {
            var existing = read();
            if (existing is not null)
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

    private static string PublishUrl(PageRef page) => "/api/v1/pages/" + page.Id + "/publish";

    private static string UnpublishUrl(PageRef page) => "/api/v1/pages/" + page.Id + "/unpublish";

    private static string RevisionUrl(PageRef page, Guid revisionId) => "/api/v1/pages/" + page.Id + "/revisions/" + revisionId;

    private static string Slug() => "pub-" + Guid.NewGuid().ToString("N")[..10];

    private static PageRef ReadPage(string body, string slug)
    {
        var json = JsonDocument.Parse(body).RootElement;
        return new PageRef(json.GetProperty("id").GetGuid(), slug, json.GetProperty("version").GetInt32());
    }

    private static int ReadItemVersion(string body) =>
        JsonDocument.Parse(body).RootElement.GetProperty("item").GetProperty("version").GetInt32();

    private static string? Code(string body) =>
        JsonDocument.Parse(body).RootElement.TryGetProperty("code", out var code) ? code.GetString() : null;

    private static string Text(string body, params string[] path)
    {
        JsonElement element = JsonDocument.Parse(body).RootElement;
        foreach (var name in path)
            element = element.GetProperty(name);
        return element.GetString() ?? "";
    }

    private sealed record PageRef(Guid Id, string Slug, int Version);
}
