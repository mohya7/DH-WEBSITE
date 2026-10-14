extern alias importer;

using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using DigitalHub.Api.Content;
using DigitalHub.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using ContentBundle = importer::DigitalHub.ContentImport.ContentBundle;
using ImportOptions = importer::DigitalHub.ContentImport.ImportOptions;
using ImportResult = importer::DigitalHub.ContentImport.ImportResult;

namespace DigitalHub.Api.Tests;

/// <summary>
/// The content bundle (docs/content-bundle.md). Each test runs inside one
/// transaction on DigitalHubContent_Test that is rolled back at the end: it
/// empties the content tables, writes a small known site, and works on that, so
/// the shared catalog is never changed.
/// </summary>
[Collection("SqlServer")]
public sealed class ContentBundleTests : IClassFixture<ApiFactory>, IDisposable
{
    private static readonly DateTime Made = new(2026, 10, 1, 9, 0, 0);
    private static readonly Guid MediaId = Guid.Parse("10000000-0000-0000-0000-000000000001");
    private static readonly Guid PageId = Guid.Parse("20000000-0000-0000-0000-000000000001");
    private static readonly Guid SectionId = Guid.Parse("30000000-0000-0000-0000-000000000001");
    private static readonly Guid CaseId = Guid.Parse("40000000-0000-0000-0000-000000000001");
    private static readonly Guid PostId = Guid.Parse("50000000-0000-0000-0000-000000000001");
    private const string MediaName = "b1d1e7a5c0ffee00b1d1e7a5c0ffee00b1d1e7a5c0ffee00b1d1e7a5c0ffee00.webp";

    /// <summary>A content word, not a field: the bundle must carry it.</summary>
    private const string PasswordSentence = "Reset your password with the IT help desk.";

    private readonly ApiFactory _factory;
    private readonly string _source = Directory.CreateTempSubdirectory("bundle-source-").FullName;
    private readonly string _target = Directory.CreateTempSubdirectory("bundle-target-").FullName;

    public ContentBundleTests(ApiFactory factory)
    {
        _factory = factory;
        _ = factory.CreateClient();
        File.WriteAllBytes(Path.Combine(_source, MediaName), Encoding.ASCII.GetBytes("not really an image, only bytes to carry"));
    }

    public void Dispose()
    {
        Directory.Delete(_source, recursive: true);
        Directory.Delete(_target, recursive: true);
    }

    [Fact]
    public async Task Export_then_import_into_an_empty_database_gives_the_same_content()
    {
        await InTransactionAsync(async db =>
        {
            await SeedAsync(db);
            var first = await ExportAsync(db, _source);

            await EmptyAsync(db);
            var imported = await ImportAsync(db, _target, first);
            Assert.True(imported.Ok, string.Join("\n", imported.Problems));
            Assert.Equal(1, imported.Plan["pages"].Created);
            Assert.Equal(1, imported.Plan["sections"].Created);
            Assert.Equal(1, imported.NewFiles);
            Assert.True(File.Exists(Path.Combine(_target, MediaName)));

            var second = await ExportAsync(db, _target);
            Assert.Equal(WithoutTime(first), WithoutTime(second));
            Assert.Equal(Files(first), Files(second));
            Assert.Equal("careers@example.com", (await db.SiteSettings.SingleAsync()).CareersEmail);
            Assert.Equal("orange", (await db.CaseStudies.SingleAsync()).Theme);
        });
    }

    [Fact]
    public async Task Importing_the_same_bundle_twice_changes_nothing()
    {
        await InTransactionAsync(async db =>
        {
            await SeedAsync(db);
            var bundle = await ExportAsync(db, _source);
            await EmptyAsync(db);

            Assert.True((await ImportAsync(db, _target, bundle)).Ok);
            var again = await ImportAsync(db, _target, bundle);
            Assert.True(again.Ok, string.Join("\n", again.Problems));
            Assert.All(again.Plan.Values, count => Assert.Equal((0, 0), (count.Created, count.Updated)));
            Assert.Equal(0, again.NewFiles);
            Assert.Equal(1, await db.Pages.CountAsync());
            Assert.Equal(WithoutTime(bundle), WithoutTime(await ExportAsync(db, _target)));
        });
    }

    [Fact]
    public async Task A_dry_run_reports_the_plan_and_changes_nothing()
    {
        await InTransactionAsync(async db =>
        {
            await SeedAsync(db);
            var bundle = await ExportAsync(db, _source);
            await EmptyAsync(db);

            var dry = await ImportAsync(db, _target, bundle, dryRun: true);
            Assert.True(dry.Ok, string.Join("\n", dry.Problems));
            Assert.True(dry.DryRun);
            Assert.Equal(1, dry.Plan["case-studies"].Created);
            Assert.Equal(0, await db.Pages.CountAsync());
            Assert.Equal(0, await db.Media.CountAsync());
            Assert.Empty(Directory.GetFiles(_target));
        });
    }

    [Fact]
    public async Task A_bundle_with_one_invalid_document_changes_nothing()
    {
        await InTransactionAsync(async db =>
        {
            await SeedAsync(db);
            var bundle = Edit(await ExportAsync(db, _source), root =>
                root["tables"]!["case-studies"]![0]!["theme"] = "blue");
            await EmptyAsync(db);

            var result = await ImportAsync(db, _target, bundle);
            Assert.False(result.Ok);
            Assert.Contains(result.Problems, problem => problem.StartsWith("case-studies " + CaseId, StringComparison.Ordinal) && problem.Contains("theme", StringComparison.Ordinal));
            Assert.Equal(0, await db.Pages.CountAsync());
            Assert.Equal(0, await db.Media.CountAsync());
            Assert.Equal(0, await db.Sections.CountAsync());
            Assert.Equal(0, await db.SiteSettings.CountAsync());
            Assert.Empty(Directory.GetFiles(_target));

            // One the database accepts and only the Studio's section schema refuses: a rich_text section without its heading.
            var noHeading = Edit(await ExportFreshAsync(db), root =>
                root["tables"]!["sections"]![0]!["fields"] = JsonSerializer.Serialize(new { body = Doc("No heading.") }));
            await EmptyAsync(db);
            result = await ImportAsync(db, _target, noHeading);
            Assert.False(result.Ok);
            Assert.Contains(result.Problems, problem => problem.StartsWith("pages " + PageId + ": sections[0]", StringComparison.Ordinal));
            Assert.Equal(0, await db.Pages.CountAsync());
            Assert.Equal(0, await db.Sections.CountAsync());
            Assert.Empty(Directory.GetFiles(_target));
        });
    }

    [Fact]
    public async Task A_bundle_made_at_another_migration_is_refused()
    {
        await InTransactionAsync(async db =>
        {
            await SeedAsync(db);
            var bundle = Edit(await ExportAsync(db, _source), root => root["migration"] = "20990101000000_SomethingElse");
            await EmptyAsync(db);

            var result = await ImportAsync(db, _target, bundle);
            Assert.False(result.Ok);
            var message = Assert.Single(result.Problems);
            Assert.Contains("20990101000000_SomethingElse", message, StringComparison.Ordinal);
            Assert.Contains(ContentBundle.CodeMigration(db), message, StringComparison.Ordinal);
            Assert.Equal(0, await db.Pages.CountAsync());
        });
    }

    [Fact]
    public async Task A_bundle_carrying_a_user_or_a_password_field_is_refused()
    {
        await InTransactionAsync(async db =>
        {
            await SeedAsync(db);
            var bundle = await ExportAsync(db, _source);
            await EmptyAsync(db);

            var withPassword = Edit(bundle, root => root["tables"]!["pages"]![0]!["passwordHash"] = "AQAAAAIAAYagAAAAE");
            var refused = await ImportAsync(db, _target, withPassword);
            Assert.False(refused.Ok);
            Assert.Contains("passwordHash", Assert.Single(refused.Problems), StringComparison.Ordinal);

            var withUsers = Edit(bundle, root =>
            {
                root["tables"]!["users"] = new JsonArray(new JsonObject { ["id"] = "u1", ["email"] = "someone@example.com" });
                root["counts"]!["users"] = 1;
            });
            refused = await ImportAsync(db, _target, withUsers);
            Assert.False(refused.Ok);
            Assert.Contains("users", Assert.Single(refused.Problems), StringComparison.Ordinal);

            var withUserId = Edit(bundle, root => root["tables"]!["media"]![0]!["uploaderId"] = "some-user");
            refused = await ImportAsync(db, _target, withUserId);
            Assert.False(refused.Ok);
            Assert.Contains("uploaderId", Assert.Single(refused.Problems), StringComparison.Ordinal);

            Assert.Equal(0, await db.Pages.CountAsync());
        });
    }

    [Fact]
    public async Task The_export_has_no_credential_fields_but_keeps_the_word_password_in_text()
    {
        await InTransactionAsync(async db =>
        {
            await SeedAsync(db);
            var bundle = await ExportAsync(db, _source);
            var root = Content(bundle);

            var names = new List<string>();
            void Walk(JsonNode? node)
            {
                if (node is JsonObject obj)
                {
                    foreach (var (key, value) in obj)
                    {
                        names.Add(key);
                        Walk(value);
                    }
                }
                else if (node is JsonArray array)
                {
                    foreach (var item in array)
                        Walk(item);
                }
            }

            Walk(root);
            foreach (var word in new[] { "password", "token", "secret", "connectionstring" })
                Assert.DoesNotContain(names, name => name.Replace("_", "").Contains(word, StringComparison.OrdinalIgnoreCase));

            // The content word is there, in a text value, and it imports.
            Assert.Contains(PasswordSentence, root["tables"]!["blog-posts"]![0]!["body"]!.GetValue<string>(), StringComparison.Ordinal);
            await EmptyAsync(db);
            var imported = await ImportAsync(db, _target, bundle);
            Assert.True(imported.Ok, string.Join("\n", imported.Problems));
            Assert.Contains(PasswordSentence, (await db.BlogPosts.SingleAsync()).Body, StringComparison.Ordinal);
        });
    }

    [Fact]
    public async Task A_newer_edit_on_the_target_is_kept_unless_forced()
    {
        await InTransactionAsync(async db =>
        {
            await SeedAsync(db);
            var bundle = await ExportAsync(db, _source);

            var page = await db.Pages.SingleAsync();
            page.Title = "Edited on the target";
            page.UpdatedAt = Made.AddDays(5);
            await db.SaveChangesAsync();
            db.ChangeTracker.Clear();

            var refused = await ImportAsync(db, _target, bundle);
            Assert.False(refused.Ok);
            Assert.Contains(refused.Conflicts, conflict => conflict.StartsWith("pages " + PageId, StringComparison.Ordinal));
            Assert.Equal("Edited on the target", (await db.Pages.AsNoTracking().SingleAsync()).Title);

            var forced = await ImportAsync(db, _target, bundle, force: true);
            Assert.True(forced.Ok, string.Join("\n", forced.Problems));
            Assert.Equal(1, forced.Plan["pages"].Updated);
            Assert.Equal("Bundle test page", (await db.Pages.AsNoTracking().SingleAsync()).Title);
        });
    }

    // ---------------------------------------------------------------- helpers

    private async Task InTransactionAsync(Func<ContentDbContext, Task> body)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        await using var transaction = await db.Database.BeginTransactionAsync();
        try
        {
            await EmptyAsync(db);
            await body(db);
        }
        finally
        {
            await transaction.RollbackAsync();
        }
    }

    /// <summary>Every content row, children first. Inside the test's transaction only.</summary>
    private static async Task EmptyAsync(ContentDbContext db)
    {
        db.ChangeTracker.Clear();
        await db.WorkingCopies.ExecuteDeleteAsync();
        await db.Sections.ExecuteDeleteAsync();
        await db.Revisions.ExecuteDeleteAsync();
        await db.NavigationItems.Where(item => item.ParentId != null).ExecuteDeleteAsync();
        await db.NavigationItems.ExecuteDeleteAsync();
        await db.Redirects.ExecuteDeleteAsync();
        await db.SiteSettings.ExecuteDeleteAsync();
        await db.Pages.ExecuteDeleteAsync();
        await db.Services.ExecuteDeleteAsync();
        await db.Partners.ExecuteDeleteAsync();
        await db.CaseStudies.ExecuteDeleteAsync();
        await db.BlogPosts.ExecuteDeleteAsync();
        await db.Vacancies.ExecuteDeleteAsync();
        await db.TeamMembers.ExecuteDeleteAsync();
        await db.NewsItems.ExecuteDeleteAsync();
        await db.Media.ExecuteDeleteAsync();
    }

    private static string Doc(string text) =>
        JsonSerializer.Serialize(new
        {
            type = "doc",
            content = new[] { new { type = "paragraph", content = new[] { new { type = "text", text } } } },
        });

    /// <summary>A small site that passes every Studio check: one of each kind of row the bundle moves.</summary>
    private static async Task SeedAsync(ContentDbContext db)
    {
        db.Media.Add(new MediaAsset
        {
            Id = MediaId,
            Path = "/media/" + MediaName,
            OriginalName = "team.webp",
            ContentType = "image/webp",
            Width = 640,
            Height = 480,
            Size = 40,
            GeneratedSizes = "[]",
            ContentHash = "b1d1e7a5c0ffee00b1d1e7a5c0ffee00b1d1e7a5c0ffee00b1d1e7a5c0ffee00",
            Alt = "The team at work",
            UploaderId = "a-studio-user",
            CreatedAt = Made,
        });
        var page = new Page { Id = PageId, Slug = "bundle-test-page", Title = "Bundle test page", Status = ContentStatus.Published, PublishedAt = Made, CreatedAt = Made, UpdatedAt = Made, Version = 2 };
        db.Pages.Add(page);
        db.Sections.Add(new Section
        {
            Id = SectionId,
            PageId = PageId,
            Type = SectionTypes.RichText,
            SortOrder = 0,
            Fields = JsonSerializer.Serialize(new { heading = "About the bundle", body = Doc("Content moves in one file.") }),
        });
        var study = new CaseStudy { Id = CaseId, Slug = "bundle-test-case", Title = "Bundle test case", Status = ContentStatus.Published, PublishedAt = Made, CreatedAt = Made, UpdatedAt = Made, Version = 1, Summary = "A case.", ImageId = MediaId, Metric = "40%", Categories = ["Cloud"], Theme = "orange" };
        db.CaseStudies.Add(study);
        db.BlogPosts.Add(new BlogPost { Id = PostId, Slug = "bundle-test-post", Title = "Bundle test post", Status = ContentStatus.Draft, CreatedAt = Made, UpdatedAt = Made, Version = 1, Body = Doc(PasswordSentence), DatePublished = new DateOnly(2026, 9, 30) });
        db.NavigationItems.Add(new NavigationItem { Id = Guid.Parse("60000000-0000-0000-0000-000000000001"), Menu = "header", Label = "Bundle", LinkKind = "internal", TargetType = "page", TargetId = PageId, SortOrder = 0 });
        db.Redirects.Add(new Redirect { Id = Guid.Parse("70000000-0000-0000-0000-000000000001"), FromPath = "/old-bundle-page", ToPath = "/bundle-test-page", Source = "manual", CreatedById = "a-studio-user", CreatedAt = Made });
        db.SiteSettings.Add(new SiteSettings { Id = Guid.Parse("80000000-0000-0000-0000-000000000001"), Email = "sales@example.com", CareersEmail = "careers@example.com", OrganizationName = "Digital Hub" });
        await db.SaveChangesAsync();

        var draft = ContentFields.FromRecord("case-studies", study, []);
        draft.Title = "Bundle test case, edited";
        db.WorkingCopies.Add(new WorkingCopy { Id = Guid.Parse("90000000-0000-0000-0000-000000000001"), CaseStudyId = CaseId, Document = JsonSerializer.Serialize(draft, ContentJson.Options), SavedAt = Made.AddHours(1) });
        db.Revisions.Add(new Revision { Id = Guid.Parse("a0000000-0000-0000-0000-000000000001"), EntityType = "page", EntityId = PageId, Version = 2, Snapshot = JsonSerializer.Serialize(ContentFields.FromRecord("pages", page, []), ContentJson.Options), PublishedAt = Made, PublishedById = "a-studio-user" });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
    }

    private async Task<byte[]> ExportFreshAsync(ContentDbContext db)
    {
        await EmptyAsync(db);
        await SeedAsync(db);
        return await ExportAsync(db, _source);
    }

    private static async Task<byte[]> ExportAsync(ContentDbContext db, string mediaRoot)
    {
        using var output = new MemoryStream();
        var result = await ContentBundle.ExportAsync(db, mediaRoot, output, DateTime.UtcNow, CancellationToken.None);
        Assert.True(result.Error is null, result.Error);
        return output.ToArray();
    }

    private static async Task<ImportResult> ImportAsync(ContentDbContext db, string mediaRoot, byte[] bundle, bool dryRun = false, bool force = false)
    {
        using var input = new MemoryStream(bundle);
        var result = await ContentBundle.ImportAsync(db, mediaRoot, input, new ImportOptions(dryRun, force), CancellationToken.None);
        db.ChangeTracker.Clear();
        return result;
    }

    private static JsonObject Content(byte[] bundle)
    {
        using var zip = new ZipArchive(new MemoryStream(bundle), ZipArchiveMode.Read);
        using var reader = new StreamReader(zip.GetEntry("content.json")!.Open());
        return JsonNode.Parse(reader.ReadToEnd())!.AsObject();
    }

    private static string WithoutTime(byte[] bundle)
    {
        var root = Content(bundle);
        root.Remove("exportedAt");
        return root.ToJsonString();
    }

    private static Dictionary<string, string> Files(byte[] bundle)
    {
        using var zip = new ZipArchive(new MemoryStream(bundle), ZipArchiveMode.Read);
        return zip.Entries.Where(entry => entry.FullName.StartsWith("media/", StringComparison.Ordinal)).ToDictionary(
            entry => entry.FullName,
            entry =>
            {
                using var stream = entry.Open();
                using var buffer = new MemoryStream();
                stream.CopyTo(buffer);
                return Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(buffer.ToArray()));
            });
    }

    /// <summary>
    /// A changed copy of a bundle, with the table checksums brought up to date, as
    /// someone editing the file on purpose would. The import's own checks must refuse it.
    /// </summary>
    private static byte[] Edit(byte[] bundle, Action<JsonObject> change)
    {
        var root = Content(bundle);
        change(root);
        foreach (var (name, rows) in root["tables"]!.AsObject())
            root["checksums"]![name] = ContentBundle.Sha256(rows!.ToJsonString(ContentBundle.Json));

        using var output = new MemoryStream();
        using (var zip = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true))
        using (var source = new ZipArchive(new MemoryStream(bundle), ZipArchiveMode.Read))
        {
            foreach (var entry in source.Entries)
            {
                var copy = zip.CreateEntry(entry.FullName);
                using var to = copy.Open();
                if (entry.FullName == "content.json")
                {
                    to.Write(Encoding.UTF8.GetBytes(root.ToJsonString()));
                    continue;
                }

                using var from = entry.Open();
                from.CopyTo(to);
            }
        }

        return output.ToArray();
    }
}
