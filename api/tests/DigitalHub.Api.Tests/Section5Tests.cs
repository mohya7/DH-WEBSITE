extern alias importer;

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AngleSharp.Html.Parser;
using DigitalHub.Api.Content;
using DigitalHub.Api.Data;
using DigitalHub.Api.Data.Migrations;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Microsoft.Extensions.DependencyInjection;
using ContentWriter = importer::DigitalHub.ContentImport.ContentWriter;

namespace DigitalHub.Api.Tests;

/// <summary>
/// Section 5: blog editorial calendar dates (API validation, both importer paths, and
/// the migration guard) and the careers email setting.
/// </summary>
[Collection("SqlServer")]
public sealed class Section5Tests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    private readonly HttpClient _client;

    public Section5Tests(ApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    // ---- Editorial calendar dates: API ----

    [Fact]
    public async Task Blog_calendar_dates_round_trip_exactly_as_YYYY_MM_DD()
    {
        var editor = await EditorAsync();
        var (id, version) = await CreateBlogAsync(editor);

        var saved = await SendAsync(editor, HttpMethod.Put, "/api/v1/blog-posts/" + id, new
        {
            version,
            slug = "dates-" + id.ToString("N")[..8],
            title = "Dates",
            fields = new { datePublished = "2024-02-29", dateModified = "2026-08-12" },
        });
        Assert.Equal(HttpStatusCode.OK, saved.Status);

        var read = await SendAsync(editor, HttpMethod.Get, "/api/v1/blog-posts/" + id);
        Assert.Equal(HttpStatusCode.OK, read.Status);
        var fields = JsonDocument.Parse(read.Body).RootElement.GetProperty("content").GetProperty("fields");
        Assert.Equal("2024-02-29", fields.GetProperty("datePublished").GetString());
        Assert.Equal("2026-08-12", fields.GetProperty("dateModified").GetString());

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        var post = await db.BlogPosts.AsNoTracking().SingleAsync(item => item.Id == id);
        Assert.Equal(new DateOnly(2024, 2, 29), post.DatePublished);
        Assert.Equal(new DateOnly(2026, 8, 12), post.DateModified);

        var cleared = await SendAsync(editor, HttpMethod.Put, "/api/v1/blog-posts/" + id, new
        {
            version = JsonDocument.Parse(saved.Body).RootElement.GetProperty("version").GetInt32(),
            slug = "dates-" + id.ToString("N")[..8],
            title = "Dates",
            fields = new { datePublished = (string?)null, dateModified = (string?)null },
        });
        Assert.Equal(HttpStatusCode.OK, cleared.Status);
        var after = JsonDocument.Parse((await SendAsync(editor, HttpMethod.Get, "/api/v1/blog-posts/" + id)).Body).RootElement.GetProperty("content").GetProperty("fields");
        Assert.Equal(JsonValueKind.Null, after.GetProperty("datePublished").ValueKind);
        Assert.Equal(JsonValueKind.Null, after.GetProperty("dateModified").ValueKind);
    }

    [Theory]
    [InlineData("2026-02-30")]
    [InlineData("2026-02-29")]
    [InlineData("2026-13-01")]
    [InlineData("2026-6-15")]
    [InlineData("2026-06-15T00:00:00")]
    [InlineData("2026-06-15T00:00:00Z")]
    [InlineData("2026-06-15Z")]
    [InlineData("2026-06-15+02:00")]
    [InlineData("15 Jun 2026")]
    [InlineData("")]
    public async Task Blog_calendar_dates_reject_anything_but_a_real_day(string value)
    {
        var editor = await EditorAsync();
        var (id, version) = await CreateBlogAsync(editor);
        foreach (var field in new[] { "datePublished", "dateModified" })
        {
            var response = await SendAsync(editor, HttpMethod.Put, "/api/v1/blog-posts/" + id, new
            {
                version,
                slug = "bad-date-" + id.ToString("N")[..8],
                title = "Bad date",
                fields = new Dictionary<string, object?> { [field] = value },
            });
            Assert.Equal(HttpStatusCode.BadRequest, response.Status);
            Assert.Contains(field, response.Body, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void Calendar_date_parser_accepts_only_exact_YYYY_MM_DD()
    {
        Assert.Equal(new DateOnly(2026, 6, 15), ContentFields.ParseCalendarDate("2026-06-15"));
        Assert.Equal(new DateOnly(2024, 2, 29), ContentFields.ParseCalendarDate("2024-02-29"));
        foreach (var bad in new[] { null, "", " 2026-06-15", "2026-06-15 ", "2026-02-30", "2026-06-15T00:00", "20260615", "2026/06/15" })
            Assert.Null(ContentFields.ParseCalendarDate(bad));
    }

    // ---- Editorial calendar dates: importer ----

    [Fact]
    public void Importer_reads_listed_article_dates_from_their_own_json_fields()
    {
        using var both = JsonDocument.Parse("""{ "datePublished": "2026-06-15", "dateModified": "2026-08-12" }""");
        Assert.Equal((new DateOnly(2026, 6, 15), new DateOnly(2026, 8, 12)), ContentWriter.BlogDates(both.RootElement, null, "content/admin-content.json", htmlOnly: false));

        // A missing date stays null: never copied from the other field or a system time.
        using var onlyModified = JsonDocument.Parse("""{ "dateModified": "2026-08-12" }""");
        Assert.Equal(((DateOnly?)null, (DateOnly?)new DateOnly(2026, 8, 12)), ContentWriter.BlogDates(onlyModified.RootElement, null, "x", htmlOnly: false));
        using var blank = JsonDocument.Parse("""{ "datePublished": "  ", "dateModified": null }""");
        Assert.Equal(((DateOnly?)null, (DateOnly?)null), ContentWriter.BlogDates(blank.RootElement, null, "x", htmlOnly: false));
    }

    [Theory]
    [InlineData("2026-02-30")]
    [InlineData("2026-08-12T21:00:00Z")]
    [InlineData("12 Aug 2026")]
    public void Importer_stops_on_an_invalid_listed_article_date_and_names_it(string value)
    {
        using var item = JsonDocument.Parse(JsonSerializer.Serialize(new { datePublished = "2026-06-15", dateModified = value }));
        var error = Assert.Throws<InvalidOperationException>(() => ContentWriter.BlogDates(item.RootElement, null, "content/admin-content.json", htmlOnly: false));
        Assert.Contains("content/admin-content.json", error.Message, StringComparison.Ordinal);
        Assert.Contains("dateModified", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void Importer_reads_html_only_article_dates_from_the_byline()
    {
        using var empty = JsonDocument.Parse("{}");
        var document = Html("""<p class="blog-view-byline">Published 15 Jun 2026 · Updated 2 Aug 2026 · 6 min read</p>""");
        Assert.Equal((new DateOnly(2026, 6, 15), new DateOnly(2026, 8, 2)), ContentWriter.BlogDates(empty.RootElement, document, "blogs/a.html", htmlOnly: true));

        var publishedOnly = Html("""<p class="blog-view-byline">Published 15 Jun 2026 · 6 min read</p>""");
        Assert.Equal(((DateOnly?)new DateOnly(2026, 6, 15), (DateOnly?)null), ContentWriter.BlogDates(empty.RootElement, publishedOnly, "blogs/a.html", htmlOnly: true));

        var unreadable = Html("""<p class="blog-view-byline">Published 31 Feb 2026</p>""");
        var error = Assert.Throws<InvalidOperationException>(() => ContentWriter.BlogDates(empty.RootElement, unreadable, "blogs/a.html", htmlOnly: true));
        Assert.Contains("blogs/a.html", error.Message, StringComparison.Ordinal);
    }

    // ---- Editorial calendar dates: migration guard ----

    [Fact]
    public async Task Blog_date_migration_guard_passes_unedited_posts_and_refuses_any_edited_one()
    {
        var guard = Assert.IsType<SqlOperation>(new BlogEditorialCalendarDates().UpOperations[0]).Sql;
        Assert.Contains("THROW 50001", guard, StringComparison.Ordinal);

        // Every case runs in its own transaction and is rolled back.
        await GuardCaseAsync(guard, null, refuses: false);
        await GuardCaseAsync(guard, "UPDATE blog_posts SET version = 2 WHERE id = @id;", refuses: true);
        await GuardCaseAsync(guard, "INSERT INTO working_copies (id, blog_post_id, document, saved_at) VALUES (NEWID(), @id, N'{{}}', SYSUTCDATETIME());", refuses: true);
        await GuardCaseAsync(guard, "INSERT INTO revisions (id, entity_type, entity_id, version, snapshot, published_at) VALUES (NEWID(), N'blog_post', @id, 1, N'{{}}', SYSUTCDATETIME());", refuses: true);
    }

    private async Task GuardCaseAsync(string guard, string? edit, bool refuses)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        await using var transaction = await db.Database.BeginTransactionAsync();
        try
        {
            // Start from a database where no blog post has been edited, with one post in it.
            await db.Database.ExecuteSqlRawAsync("""
                DELETE FROM working_copies WHERE blog_post_id IS NOT NULL;
                DELETE FROM revisions WHERE entity_type = N'blog_post';
                UPDATE blog_posts SET version = 1;
                """);
            var id = Guid.NewGuid();
            db.BlogPosts.Add(new BlogPost
            {
                Id = id,
                Slug = "guard-" + id.ToString("N")[..8],
                Title = "Guard",
                Status = ContentStatus.Draft,
                Version = 1,
                Category = "guard",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
            if (edit is not null)
                await db.Database.ExecuteSqlRawAsync(edit, new SqlParameter("@id", id));

            if (refuses)
            {
                var error = await Assert.ThrowsAsync<SqlException>(() => db.Database.ExecuteSqlRawAsync(guard));
                Assert.Equal(50001, error.Number);
                Assert.Contains("A blog post has been edited", error.Message, StringComparison.Ordinal);
            }
            else
            {
                await db.Database.ExecuteSqlRawAsync(guard);
            }
        }
        finally
        {
            await transaction.RollbackAsync();
        }
    }

    // ---- Careers email ----

    [Fact]
    public async Task Careers_email_is_saved_validated_and_given_to_the_build()
    {
        var admin = await AdminAsync();
        var current = JsonDocument.Parse((await SendAsync(admin, HttpMethod.Get, "/api/v1/settings")).Body).RootElement;
        var payload = current.EnumerateObject()
            .Where(property => property.Value.ValueKind is JsonValueKind.String or JsonValueKind.Null)
            .ToDictionary(property => property.Name, property => property.Value.ValueKind == JsonValueKind.Null ? null : (object?)property.Value.GetString());
        payload.Remove("defaultShareImageId");

        payload["careersEmail"] = "not-an-email";
        var invalid = await SendAsync(admin, HttpMethod.Put, "/api/v1/settings", payload);
        Assert.Equal(HttpStatusCode.BadRequest, invalid.Status);
        Assert.Contains("careersEmail", invalid.Body, StringComparison.Ordinal);

        payload["email"] = "main@digitalhub.test";
        payload["careersEmail"] = "  jobs@digitalhub.test  ";
        var saved = await SendAsync(admin, HttpMethod.Put, "/api/v1/settings", payload);
        Assert.Equal(HttpStatusCode.OK, saved.Status);
        Assert.Equal("jobs@digitalhub.test", JsonDocument.Parse(saved.Body).RootElement.GetProperty("careersEmail").GetString());
        var reread = JsonDocument.Parse((await SendAsync(admin, HttpMethod.Get, "/api/v1/settings")).Body).RootElement;
        Assert.Equal("jobs@digitalhub.test", reread.GetProperty("careersEmail").GetString());
        Assert.Equal("main@digitalhub.test", reread.GetProperty("email").GetString());

        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/build/content");
        request.Headers.TryAddWithoutValidation("X-Build-Token", ApiFactory.BuildTokenValue);
        var build = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, build.StatusCode);
        var settings = JsonDocument.Parse(await build.Content.ReadAsStringAsync()).RootElement.GetProperty("settings");
        Assert.Equal("jobs@digitalhub.test", settings.GetProperty("careersEmail").GetString());
        Assert.Equal("main@digitalhub.test", settings.GetProperty("email").GetString());

        payload["careersEmail"] = null;
        var cleared = await SendAsync(admin, HttpMethod.Put, "/api/v1/settings", payload);
        Assert.Equal(HttpStatusCode.OK, cleared.Status);
        Assert.Equal(JsonValueKind.Null, JsonDocument.Parse(cleared.Body).RootElement.GetProperty("careersEmail").ValueKind);
    }

    [Fact]
    public async Task Editors_cannot_change_the_careers_email()
    {
        var editor = await EditorAsync();
        Assert.Equal(HttpStatusCode.Forbidden, (await SendAsync(editor, HttpMethod.Put, "/api/v1/settings", new { careersEmail = "jobs@digitalhub.test" })).Status);
    }

    // ---- Chrome content: importer ----

    [Fact]
    public void Importer_takes_each_email_from_its_source_footer()
    {
        var documents = new Dictionary<string, AngleSharp.Html.Dom.IHtmlDocument>
        {
            ["news/index.html"] = Html("""<footer class="footer"><div class="footer-contact"><h4>Contact</h4><a href="mailto:sales@digitalhub.com.eg">sales@digitalhub.com.eg</a><a href="tel:+20">+20</a></div></footer>"""),
            ["careers/index.html"] = Html("""<footer class="footer"><div class="footer-contact"><a href="mailto:careers@digitalhub.com.eg">careers@digitalhub.com.eg</a></div></footer>"""),
            ["about-us.html"] = Html("""<main><a href="mailto:not-the-footer@example.invalid">x</a></main><footer class="footer"></footer>"""),
        };
        Assert.Equal("sales@digitalhub.com.eg", ContentWriter.FooterEmail(documents, "news/index.html"));
        Assert.Equal("careers@digitalhub.com.eg", ContentWriter.FooterEmail(documents, "careers/index.html"));
        Assert.Throws<InvalidOperationException>(() => ContentWriter.FooterEmail(documents, "about-us.html"));
    }

    [Fact]
    public void Importer_builds_the_company_column_as_about_partners_careers_news()
    {
        var documents = new Dictionary<string, AngleSharp.Html.Dom.IHtmlDocument>
        {
            ["index.html"] = Html("""<footer class="footer"><div class="footer-col"><h4>Company</h4><a href="about-us.html">About Us</a><a href="cases/index.html">Case Studies</a><a href="blogs/index.html">Blogs</a><a href="partners/index.html">Partners</a><a href="careers/index.html">Careers</a></div></footer>"""),
            ["news/index.html"] = Html("""<footer class="footer"><div class="footer-col"><h4>Company</h4><a href="../about-us.html">About Us</a><a href="index.html">News</a></div></footer>"""),
        };
        var links = ContentWriter.CompanyLinks(documents).ToList();
        Assert.Equal(["about-us.html", "partners/index.html", "careers/index.html", "news/index.html"], links.Select(link => link.Target));
        Assert.Equal(["About Us", "Partners", "Careers", "News"], links.Select(link => link.Anchor.TextContent));
        Assert.Equal(["index.html", "index.html", "index.html", "news/index.html"], links.Select(link => link.From));

        documents["news/index.html"] = Html("""<footer class="footer"><div class="footer-col"><a href="../about-us.html">About Us</a></div></footer>""");
        Assert.Throws<InvalidOperationException>(() => ContentWriter.CompanyLinks(documents).ToList());
    }

    // ---- Helpers ----

    private static AngleSharp.Html.Dom.IHtmlDocument Html(string body) =>
        new HtmlParser().ParseDocument("<!doctype html><html><body>" + body + "</body></html>");

    private async Task<(Guid Id, int Version)> CreateBlogAsync(AuthSession editor)
    {
        var slug = "section5-" + Guid.NewGuid().ToString("N")[..8];
        var created = await SendAsync(editor, HttpMethod.Post, "/api/v1/blog-posts", new { slug, title = "Section 5", fields = new { } });
        Assert.Equal(HttpStatusCode.Created, created.Status);
        var root = JsonDocument.Parse(created.Body).RootElement;
        return (root.GetProperty("id").GetGuid(), root.GetProperty("version").GetInt32());
    }

    private async Task<AuthSession> AdminAsync()
    {
        var session = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        Assert.NotNull(session.AccessToken);
        return session;
    }

    private async Task<AuthSession> EditorAsync()
    {
        const string email = "section5-editor@digitalhub.test";
        using (var scope = _factory.Services.CreateScope())
        {
            var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            if (await users.FindByEmailAsync(email) is null)
            {
                var user = new ApplicationUser { UserName = email, Email = email, EmailConfirmed = true };
                Assert.True((await users.CreateAsync(user, ApiFactory.AdminPassword)).Succeeded);
                Assert.True((await users.AddToRoleAsync(user, "editor")).Succeeded);
            }
        }

        var session = await AuthSession.LoginAsync(_client, email, ApiFactory.AdminPassword);
        Assert.NotNull(session.AccessToken);
        return session;
    }

    private async Task<(HttpStatusCode Status, string Body)> SendAsync(AuthSession session, HttpMethod method, string url, object? body = null)
    {
        var request = session.Authorized(method, url);
        if (body is not null)
            request.Content = JsonContent.Create(body);
        var response = await _client.SendAsync(request);
        return (response.StatusCode, await response.Content.ReadAsStringAsync());
    }
}
