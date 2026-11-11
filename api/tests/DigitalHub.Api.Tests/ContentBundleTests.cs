extern alias importer;

using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using DigitalHub.Api.Content;
using DigitalHub.Api.Data;
using DigitalHub.Images;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using BundleCommands = importer::DigitalHub.ContentImport.BundleCommands;
using BundleLimits = importer::DigitalHub.ContentImport.BundleLimits;
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
    /// <summary>A real stored image, made by the upload path's own pipeline from a 1x1 PNG.</summary>
    private static readonly ImageResult Image = ImagePipeline.Process(Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="));
    private static readonly string MediaName = Image.MainFileName;

    /// <summary>A generated size of the same image (sorted before MediaName, so it is written first).</summary>
    private static readonly string VariantName = Image.Hash + "-w640.webp";

    /// <summary>A content word, not a field: the bundle must carry it.</summary>
    private const string PasswordSentence = "Reset your password with the IT help desk.";

    private readonly ApiFactory _factory;
    private readonly string _source = Directory.CreateTempSubdirectory("bundle-source-").FullName;
    private readonly string _target = Directory.CreateTempSubdirectory("bundle-target-").FullName;

    public ContentBundleTests(ApiFactory factory)
    {
        _factory = factory;
        _ = factory.CreateClient();
        Assert.True(Image.Succeeded);
        File.WriteAllBytes(Path.Combine(_source, MediaName), Image.Webp);
        File.WriteAllBytes(Path.Combine(_source, VariantName), Image.Webp);
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
            Assert.Equal(2, imported.NewFiles);
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
    public async Task A_published_row_with_an_id_the_website_would_refuse_is_not_imported()
    {
        // ADM-02: the website build refuses a published "uuid" value that is not a lower-case UUID.
        await InTransactionAsync(async db =>
        {
            await SeedAsync(db);
            var bundle = Edit(await ExportAsync(db, _source), root => CaseCardsSection(root, new { title = "T", reference = new { type = "case_study", id = "not-a-uuid" } }));
            await EmptyAsync(db);

            var result = await ImportAsync(db, _target, bundle);
            Assert.False(result.Ok);
            Assert.Contains(result.Problems, problem => problem.StartsWith("pages " + PageId + ": sections[0]", StringComparison.Ordinal) && problem.Contains("format 'uuid'", StringComparison.Ordinal));
            Assert.Equal(0, await db.Pages.CountAsync());
        });
    }

    [Fact]
    public async Task A_draft_row_or_working_copy_with_an_unchosen_id_still_imports()
    {
        // Save is not publish: a draft, and a working copy of a published item, may hold what the Studio saved.
        await InTransactionAsync(async db =>
        {
            await SeedAsync(db);
            var bundle = Edit(await ExportAsync(db, _source), root =>
            {
                CaseCardsSection(root, new { title = "T", reference = new { type = "case_study", id = "" } });
                root["tables"]!["pages"]![0]!["status"] = "draft";
                var copy = root["tables"]!["working-copies"]![0]!;
                var draft = JsonSerializer.Deserialize<DraftDocument>(copy["document"]!.GetValue<string>(), ContentJson.Options)!;
                draft.Sections.Add(new DraftSection
                {
                    Id = Guid.Parse("b0000000-0000-0000-0000-000000000001"),
                    Type = "case_cards",
                    SortOrder = 0,
                    Visible = true,
                    Fields = JsonSerializer.SerializeToElement(new { heading = "H", items = new[] { new { title = "T", image = new { mediaId = "", alt = "A", decorative = false } } } }),
                });
                copy["document"] = JsonSerializer.Serialize(draft, ContentJson.Options);
            });
            await EmptyAsync(db);

            var result = await ImportAsync(db, _target, bundle);
            Assert.True(result.Ok, string.Join("\n", result.Problems));
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

    // ---------------------------------------------------------------- round 2: claude-fix-pr-30.md

    [Fact]
    public async Task A_failed_file_write_removes_the_files_it_wrote_and_changes_nothing()
    {
        await InTransactionAsync(async db =>
        {
            await SeedAsync(db);
            var bundle = await ExportAsync(db, _source);
            await EmptyAsync(db);

            // The second new file name is a directory, so writing it fails after the first file was written.
            Directory.CreateDirectory(Path.Combine(_target, MediaName));
            var result = await ImportAsync(db, _target, bundle);

            Assert.False(result.Ok);
            var message = Assert.Single(result.Problems);
            Assert.StartsWith("The import stopped: ", message, StringComparison.Ordinal);
            // The first file, and the second file's temporary copy written before its rename failed.
            Assert.Contains("The 2 media file(s) it had written were removed.", message, StringComparison.Ordinal);
            Assert.False(File.Exists(Path.Combine(_target, VariantName)));
            Assert.Empty(Directory.GetFiles(_target));
            Assert.True(Directory.Exists(Path.Combine(_target, MediaName)));
            Assert.Equal(0, await db.Pages.CountAsync());
            Assert.Equal(0, await db.Media.CountAsync());
        });
    }

    [Fact]
    public async Task Size_limits_refuse_a_large_file_a_lying_size_a_high_ratio_and_too_many_entries()
    {
        await InTransactionAsync(async db =>
        {
            await SeedAsync(db);
            var bundle = await ExportAsync(db, _source);
            await EmptyAsync(db);
            var extra = Image.Hash[..60] + "ffff.webp";

            var large = Edit(bundle, _ => { }, new() { [extra] = RandomBytes(5_000_000) });
            var refused = await ImportAsync(db, _target, large, limits: BundleLimits.Default with { MaxFileBytes = 1_000_000 });
            Assert.Contains("declares 5,000,000 bytes, over the limit of 1,000,000", Assert.Single(refused.Problems), StringComparison.Ordinal);

            var lying = Declare(Edit(bundle, _ => { }, new() { [extra] = RandomBytes(200_000) }, CompressionLevel.Optimal), "media/" + extra, 1_000);
            refused = await ImportAsync(db, _target, lying);
            Assert.False(refused.Ok);
            // ZipArchive stops at the declared size, so the file arrives truncated and its checksum refuses it.
            Assert.Equal($"media file {extra}: the checksum does not match. The file is damaged or was edited.", Assert.Single(refused.Problems));

            var zeros = Edit(bundle, _ => { }, new() { [extra] = new byte[3_000_000] });
            refused = await ImportAsync(db, _target, zeros);
            Assert.Matches(@"expands [\d,]+ times, over the limit of 100", Assert.Single(refused.Problems));

            refused = await ImportAsync(db, _target, bundle, limits: BundleLimits.Default with { MaxEntries = 2 });
            Assert.Contains("The bundle has 3 entries; at most 2 are allowed.", Assert.Single(refused.Problems), StringComparison.Ordinal);

            Assert.Equal(0, await db.Pages.CountAsync());
            Assert.Empty(Directory.GetFiles(_target));
        });
    }

    [Fact]
    public async Task Svg_and_any_file_the_upload_would_refuse_is_refused()
    {
        await InTransactionAsync(async db =>
        {
            await SeedAsync(db);
            var bundle = await ExportAsync(db, _source);
            await EmptyAsync(db);
            var svg = Encoding.UTF8.GetBytes("<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>");

            var svgBytes = Edit(bundle, _ => { }, new() { [VariantName] = svg });
            var refused = await ImportAsync(db, _target, svgBytes);
            Assert.Equal($"media file {VariantName}: it is SVG, which the upload refuses.", Assert.Single(refused.Problems));

            var svgName = Edit(bundle, root =>
            {
                var row = root["tables"]!["media"]![0]!;
                row["generatedSizes"] = JsonSerializer.Serialize(new[] { new { width = 640, height = 480, path = "/media/evil.svg", bytes = svg.Length } });
            }, new() { ["evil.svg"] = svg });
            refused = await ImportAsync(db, _target, svgName);
            Assert.Contains("media file evil.svg: its name is not a stored image name", Assert.Single(refused.Problems), StringComparison.Ordinal);

            var svgType = Edit(bundle, root => root["tables"]!["media"]![0]!["contentType"] = "image/svg+xml");
            refused = await ImportAsync(db, _target, svgType);
            Assert.Contains(refused.Problems, problem => problem == $"media {MediaId}: content type image/svg+xml is not image/webp, the only type the upload stores.");

            var notWebp = Edit(bundle, _ => { }, new() { [VariantName] = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==") });
            refused = await ImportAsync(db, _target, notWebp);
            Assert.Equal($"media file {VariantName}: its bytes are not WebP, the only format the upload stores.", Assert.Single(refused.Problems));

            Assert.Equal(0, await db.Media.CountAsync());
            Assert.Empty(Directory.GetFiles(_target));
        });
    }

    [Fact]
    public async Task A_media_path_outside_media_is_refused_with_and_without_force()
    {
        await InTransactionAsync(async db =>
        {
            await SeedAsync(db);
            var outside = Edit(await ExportAsync(db, _source), root => root["tables"]!["media"]![0]!["path"] = "../secret.txt");

            // Existing row, with --force: the safety check still refuses.
            var forced = await ImportAsync(db, _source, outside, force: true);
            Assert.False(forced.Ok);
            Assert.Contains($"media {MediaId}: path ../secret.txt is not /media/ followed by a safe file name.", forced.Problems);
            Assert.Equal("/media/" + MediaName, (await db.Media.AsNoTracking().SingleAsync()).Path);

            // New row, without --force.
            await EmptyAsync(db);
            var refused = await ImportAsync(db, _target, outside);
            Assert.Contains($"media {MediaId}: path ../secret.txt is not /media/ followed by a safe file name.", refused.Problems);
            Assert.Equal(0, await db.Media.CountAsync());
            Assert.Empty(Directory.GetFiles(_target));
        });
    }

    [Fact]
    public async Task A_credential_key_inside_json_text_is_refused_with_and_without_force()
    {
        await InTransactionAsync(async db =>
        {
            await SeedAsync(db);
            var bundle = await ExportAsync(db, _source);
            JsonNode Snapshot(JsonObject root) => JsonNode.Parse(root["tables"]!["revisions"]![0]!["snapshot"]!.GetValue<string>())!;

            // A key beside the draft's own members: refused by the credential walk (and the strict draft shape).
            var topLevel = Edit(bundle, root =>
            {
                var snapshot = Snapshot(root);
                snapshot["password"] = "hunter2";
                root["tables"]!["revisions"]![0]!["snapshot"] = snapshot.ToJsonString();
            });

            // A key inside a section's fields in the snapshot: only the credential walk sees it.
            var nested = Edit(bundle, root =>
            {
                var snapshot = Snapshot(root);
                snapshot["sections"] = new JsonArray(new JsonObject { ["id"] = Guid.NewGuid().ToString(), ["type"] = "rich_text", ["sortOrder"] = 0, ["visible"] = true, ["fields"] = new JsonObject { ["heading"] = "x", ["Pass-Word"] = "hunter2" } });
                root["tables"]!["revisions"]![0]!["snapshot"] = snapshot.ToJsonString();
            });

            // A key inside generated sizes: only the credential walk sees it.
            var inSizes = Edit(bundle, root => root["tables"]!["media"]![0]!["generatedSizes"] = JsonSerializer.Serialize(new[] { new { width = 640, height = 480, path = "/media/" + VariantName, bytes = Image.Webp.Length, accessToken = "abc" } }));

            foreach (var (tampered, key) in new[] { (topLevel, "password"), (nested, "Pass-Word"), (inSizes, "accessToken") })
            {
                foreach (var force in new[] { false, true })
                {
                    var refused = await ImportAsync(db, _source, tampered, force: force);
                    Assert.False(refused.Ok);
                    Assert.Contains($"fields that look like users or credentials ({key})", Assert.Single(refused.Problems), StringComparison.Ordinal);
                }
            }

            Assert.DoesNotContain("hunter2", (await db.Revisions.AsNoTracking().SingleAsync()).Snapshot, StringComparison.Ordinal);
            // The word as text in an article still imports (see The_export_has_no_credential_fields_but_keeps_the_word_password_in_text).
        });
    }

    [Fact]
    public async Task A_credential_key_at_or_past_the_depth_limit_is_refused_with_and_without_force()
    {
        await InTransactionAsync(async db =>
        {
            await SeedAsync(db);
            var bundle = await ExportAsync(db, _source);
            await EmptyAsync(db);

            // The object holding "password" sits at walk depth 63, 64, or 65. Depth 65 used to be
            // skipped silently and imported into an empty catalog.
            foreach (var (holderDepth, expected) in new[]
            {
                (63, "fields that look like users or credentials (password)"),
                (64, ContentBundle.TooDeep),
                (65, ContentBundle.TooDeep),
            })
            {
                var deep = Edit(bundle, root => root["tables"]!["revisions"]![0]!["snapshot"] = SnapshotWithKeyAt(root, holderDepth));
                foreach (var force in new[] { false, true })
                {
                    var refused = await ImportAsync(db, _target, deep, force: force);
                    Assert.False(refused.Ok, $"depth {holderDepth}, force {force}");
                    Assert.Contains(expected, Assert.Single(refused.Problems), StringComparison.Ordinal);
                }
            }

            Assert.Equal(0, await db.Revisions.CountAsync());
            Assert.Equal(0, await db.Pages.CountAsync());
            Assert.Empty(Directory.GetFiles(_target));

            // A normal bundle is unaffected.
            Assert.True((await ImportAsync(db, _target, bundle)).Ok);
        });
    }

    [Fact]
    public async Task A_bundle_nested_ten_thousand_levels_is_one_refusal_line()
    {
        await InTransactionAsync(async db =>
        {
            await SeedAsync(db);
            var bundle = await ExportAsync(db, _source);
            await EmptyAsync(db);
            var nested = new string('[', 10_000) + new string(']', 10_000);

            // content.json itself, and a snapshot kept as text, each 10,000 levels deep.
            // Stored, not compressed: brackets compress so well that the ratio limit would refuse first.
            var deepFile = RawBundle("{\"format\":\"digitalhub-content-bundle\",\"tables\":" + nested + "}");
            var deepText = Edit(bundle, root => root["tables"]!["revisions"]![0]!["snapshot"] = nested, level: CompressionLevel.NoCompression);
            var deepBroken = Edit(bundle, root => root["tables"]!["revisions"]![0]!["snapshot"] = new string('[', 10_000) + "not json", level: CompressionLevel.NoCompression);
            foreach (var deep in new[] { deepFile, deepText, deepBroken })
            {
                foreach (var force in new[] { false, true })
                    Assert.Equal(ContentBundle.TooDeep, Assert.Single((await ImportAsync(db, _target, deep, force: force)).Problems));
            }

            Assert.Equal(0, await db.Pages.CountAsync());
        });

        // The command line: exit 1, the refusal, no stack trace. The bundle is refused before
        // the server (unreachable on purpose) is contacted.
        var settings = new Dictionary<string, string?> { ["ConnectionStrings:Content"] = "Server=127.0.0.1,1;Database=DigitalHubContent_Nowhere;User ID=bundle-test;Password=canary-not-a-secret;Connect Timeout=2;Encrypt=False" };
        var path = Path.Combine(_target, "deep.zip");
        File.WriteAllBytes(path, RawBundle("{\"tables\":" + new string('[', 10_000) + new string(']', 10_000) + "}"));
        var (code, output) = await RunAsync(settings, "import", "--in", path, "--dry-run");
        Assert.Equal(1, code);
        Assert.Contains("Dry run: the import would be refused. Nothing was changed.", output, StringComparison.Ordinal);
        Assert.Contains(ContentBundle.TooDeep, output, StringComparison.Ordinal);
        Assert.DoesNotContain("   at ", output, StringComparison.Ordinal);
        Assert.DoesNotContain("could not be reached", output, StringComparison.Ordinal);
        Assert.DoesNotContain("canary", output, StringComparison.Ordinal);
    }

    [Fact]
    public void Every_limit_in_the_credential_walk_refuses_instead_of_skipping()
    {
        // Node count.
        ContentBundle.ForbiddenFieldNames(JsonNode.Parse("[1,2,3,4,5,6,7,8,9,10,11]"), out var refusal, maxNodes: 10);
        Assert.Equal("The bundle has more than 10 JSON values; the bundle is refused.", refusal);

        // Bytes of JSON kept as text, read again.
        ContentBundle.ForbiddenFieldNames(JsonNode.Parse("""["{\"a\":1}","{\"b\":2}"]"""), out refusal, maxTextBytes: 10);
        Assert.Equal("The bundle keeps more than 10 bytes of JSON as text; the bundle is refused.", refusal);

        // Depth, in the tree and in text that is not even valid JSON.
        // 65 arrays: the innermost is at depth 64, the limit. 66: refused.
        ContentBundle.ForbiddenFieldNames(JsonNode.Parse(new string('[', 65) + new string(']', 65), new JsonNodeOptions(), new JsonDocumentOptions { MaxDepth = 100 }), out refusal);
        Assert.Null(refusal);
        ContentBundle.ForbiddenFieldNames(JsonNode.Parse(new string('[', 66) + new string(']', 66), new JsonNodeOptions(), new JsonDocumentOptions { MaxDepth = 100 }), out refusal);
        Assert.Equal(ContentBundle.TooDeep, refusal);
        ContentBundle.ForbiddenFieldNames(new JsonArray(new string('[', 70) + "broken"), out refusal);
        Assert.Equal(ContentBundle.TooDeep, refusal);

        // Text that only looks like JSON stays content: no refusal, no key.
        Assert.Empty(ContentBundle.ForbiddenFieldNames(new JsonArray("[citation needed]", "{ not json"), out refusal));
        Assert.Null(refusal);

        // A duplicate key does not hide a credential key or crash the walk.
        ContentBundle.ForbiddenFieldNames(new JsonArray("""{"a":1,"a":{"password":"x"}}"""), out refusal);
        Assert.Equal("A document has the same field name twice; the bundle is refused.", refusal);
        ContentBundle.ForbiddenFieldNames(JsonNode.Parse("""{"a":1,"a":2}"""), out refusal);
        Assert.Equal("A document has the same field name twice; the bundle is refused.", refusal);
    }

    [Theory]
    [InlineData("pаssword")] // Cyrillic а
    [InlineData("pass​word")] // zero-width space
    [InlineData("pass­word")] // soft hyphen
    [InlineData("pässword")] // a with diaeresis
    [InlineData("τοκεν")] // Greek τοκεν
    [InlineData("ЅЕСГЕТ")] // Cyrillic capitals ЅЕСГЕТ, lowercased to ѕесгет
    [InlineData("ｐａｓｓｗｏｒｄ")] // fullwidth
    public void Lookalike_letters_and_invisible_characters_do_not_hide_a_credential_name(string key) =>
        Assert.True(ContentBundle.LooksLikeCredential(key), key);

    [Fact]
    public void Ordinary_field_names_are_not_credentials()
    {
        foreach (var key in new[] { "heading", "lead", "cards", "outcomes", "keywords", "сards", "αlt" })
            Assert.False(ContentBundle.LooksLikeCredential(key), key);
    }

    [Fact]
    public async Task A_compressed_entry_that_declares_too_few_bytes_is_not_read_past_its_declared_size()
    {
        await InTransactionAsync(async db =>
        {
            // 400 MB of zeros, compressed to well under 1 MB, declaring 1,000 bytes. The declared size
            // and the declared ratio pass, so only the read itself can stop it.
            using var zip = new MemoryStream();
            using (var archive = new ZipArchive(zip, ZipArchiveMode.Create, leaveOpen: true))
            await using (var stream = archive.CreateEntry("content.json", CompressionLevel.Optimal).Open())
            {
                var zeros = new byte[1 << 20];
                for (var i = 0; i < 400; i++)
                    stream.Write(zeros);
            }

            var lying = Declare(zip.ToArray(), "content.json", 1_000);
            using var input = new CountingStream(new MemoryStream(lying));
            var refused = await ContentBundle.ImportAsync(db, _target, input, new ImportOptions(false, false), CancellationToken.None);

            Assert.False(refused.Ok);
            Assert.Single(refused.Problems);
            Assert.True(input.BytesRead < lying.Length / 4, $"read {input.BytesRead:N0} of {lying.Length:N0} compressed bytes");
            Assert.Equal(0, await db.Pages.CountAsync());
        });
    }
    [Fact]
    public async Task A_draft_with_an_unknown_member_is_refused()
    {
        await InTransactionAsync(async db =>
        {
            await SeedAsync(db);
            var bundle = Edit(await ExportAsync(db, _source), root =>
            {
                var document = JsonNode.Parse(root["tables"]!["working-copies"]![0]!["document"]!.GetValue<string>())!;
                document["owner"] = "someone";
                root["tables"]!["working-copies"]![0]!["document"] = document.ToJsonString();
            });
            await EmptyAsync(db);
            var refused = await ImportAsync(db, _target, bundle);
            Assert.StartsWith("working-copies 90000000-0000-0000-0000-000000000001: document: is not a draft document", Assert.Single(refused.Problems), StringComparison.Ordinal);
        });
    }

    [Fact]
    public async Task A_value_of_the_wrong_type_is_a_refusal_not_a_crash()
    {
        await InTransactionAsync(async db =>
        {
            await SeedAsync(db);
            var bundle = Edit(await ExportAsync(db, _source), root => root["tables"]!["pages"]![0]!["version"] = JsonNode.Parse("99999999999999999999"));
            await EmptyAsync(db);
            var refused = await ImportAsync(db, _target, bundle);
            Assert.Equal($"pages {PageId}: version: the value is not a valid Int32.", Assert.Single(refused.Problems));
            Assert.Equal(0, await db.Pages.CountAsync());
        });
    }

    [Fact]
    public async Task Rows_that_do_not_read_back_as_the_bundle_are_refused()
    {
        await InTransactionAsync(async db =>
        {
            await SeedAsync(db);
            // The same page twice: every other check passes, and only one row can be stored.
            var bundle = Edit(await ExportAsync(db, _source), root => root["tables"]!["pages"]!.AsArray().Add(root["tables"]!["pages"]![0]!.DeepClone()));
            await EmptyAsync(db);
            var refused = await ImportAsync(db, _target, bundle);
            Assert.Equal("pages: after import the rows do not match the bundle checksum.", Assert.Single(refused.Problems));
            Assert.Equal(0, await db.Pages.CountAsync());
        });
    }

    [Fact]
    public async Task The_command_line_refuses_instead_of_crashing()
    {
        // No connection setting.
        var (code, output) = await RunAsync(new(), "export", "--out", Path.Combine(_target, "x.zip"));
        Assert.Equal(2, code);
        Assert.Contains("ConnectionStrings:Content must be set", output, StringComparison.Ordinal);

        // A real import must name the catalog it writes.
        var settings = new Dictionary<string, string?> { ["ConnectionStrings:Content"] = "Server=127.0.0.1,1;Database=DigitalHubContent_Nowhere;User ID=bundle-test;Password=canary-not-a-secret;Connect Timeout=2;Encrypt=False" };
        var bundlePath = Path.Combine(_target, "in.zip");
        File.WriteAllBytes(bundlePath, [1, 2, 3]);
        (code, output) = await RunAsync(settings, "import", "--in", bundlePath);
        Assert.Equal(2, code);
        Assert.Contains("This import would write catalog DigitalHubContent_Nowhere on server 127.0.0.1,1. Take a backup first, then repeat the command with --confirm-catalog DigitalHubContent_Nowhere. Nothing was changed.", output, StringComparison.Ordinal);
        (code, _) = await RunAsync(settings, "import", "--in", bundlePath, "--confirm-catalog", "DigitalHubContent");
        Assert.Equal(2, code);

        // A server that cannot be reached: one line, no stack trace, no password.
        (code, output) = await RunAsync(settings, "export", "--out", Path.Combine(_target, "y.zip"));
        Assert.Equal(1, code);
        Assert.Contains("The database server 127.0.0.1,1 could not be reached or refused the command", output, StringComparison.Ordinal);
        Assert.DoesNotContain("canary", output, StringComparison.Ordinal);
        Assert.DoesNotContain("   at ", output, StringComparison.Ordinal);
        Assert.False(File.Exists(Path.Combine(_target, "y.zip")));
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

    /// <summary>The seeded page's only section, made a case_cards section holding one item.</summary>
    private static void CaseCardsSection(JsonObject root, object item)
    {
        var section = root["tables"]!["sections"]![0]!;
        section["type"] = "case_cards";
        section["fields"] = JsonSerializer.Serialize(new { heading = "H", items = new[] { item } });
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
            Size = Image.Webp.Length,
            GeneratedSizes = JsonSerializer.Serialize(new[] { new { width = 640, height = 480, path = "/media/" + VariantName, bytes = Image.Webp.Length } }),
            ContentHash = Image.Hash,
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

    private static async Task<ImportResult> ImportAsync(ContentDbContext db, string mediaRoot, byte[] bundle, bool dryRun = false, bool force = false, BundleLimits? limits = null)
    {
        using var input = new MemoryStream(bundle);
        var options = new ImportOptions(dryRun, force) { Limits = limits ?? BundleLimits.Default };
        var result = await ContentBundle.ImportAsync(db, mediaRoot, input, options, CancellationToken.None);
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
    private static byte[] Edit(byte[] bundle, Action<JsonObject> change, Dictionary<string, byte[]>? files = null, CompressionLevel level = CompressionLevel.Optimal)
    {
        var root = Content(bundle);
        change(root);
        foreach (var (name, rows) in root["tables"]!.AsObject())
        {
            root["checksums"]![name] = ContentBundle.Sha256(rows!.ToJsonString(ContentBundle.Json));
            root["counts"]![name] = rows!.AsArray().Count;
        }

        files ??= [];
        var list = root["files"]!.AsArray();
        foreach (var (name, data) in files)
        {
            var listed = list.FirstOrDefault(item => item!["name"]!.GetValue<string>() == name);
            if (listed is null)
                list.Add(new JsonObject { ["name"] = name, ["bytes"] = data.Length, ["sha256"] = ContentBundle.Sha256(data) });
            else
            {
                listed["bytes"] = data.Length;
                listed["sha256"] = ContentBundle.Sha256(data);
            }
        }

        using var output = new MemoryStream();
        using (var zip = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true))
        using (var source = new ZipArchive(new MemoryStream(bundle), ZipArchiveMode.Read))
        {
            foreach (var entry in source.Entries)
            {
                var copy = zip.CreateEntry(entry.FullName, level);
                using var to = copy.Open();
                if (entry.FullName == "content.json")
                {
                    to.Write(Encoding.UTF8.GetBytes(root.ToJsonString()));
                    continue;
                }

                if (entry.FullName.StartsWith("media/", StringComparison.Ordinal) && files.TryGetValue(entry.FullName["media/".Length..], out var replaced))
                {
                    to.Write(replaced);
                    continue;
                }

                using var from = entry.Open();
                from.CopyTo(to);
            }

            foreach (var (name, data) in files.Where(pair => source.GetEntry("media/" + pair.Key) is null))
            {
                using var to = zip.CreateEntry("media/" + name, level).Open();
                to.Write(data);
            }
        }

        return output.ToArray();
    }

    /// <summary>
    /// A revision snapshot whose first section's fields nest "x" objects until the object holding
    /// "password" sits at the given walk depth. content.json is depth 0, the snapshot text 4,
    /// the snapshot object 5, its sections 6, the section 7, and its fields 8.
    /// </summary>
    private static string SnapshotWithKeyAt(JsonObject root, int holderDepth)
    {
        var snapshot = JsonNode.Parse(root["tables"]!["revisions"]![0]!["snapshot"]!.GetValue<string>())!;
        var holder = new JsonObject { ["password"] = "hunter2" };
        JsonNode fields = holder;
        for (var depth = holderDepth; depth > 8; depth--)
            fields = new JsonObject { ["x"] = fields };
        snapshot["sections"] = new JsonArray(new JsonObject { ["id"] = Guid.NewGuid().ToString(), ["type"] = "rich_text", ["sortOrder"] = 0, ["visible"] = true, ["fields"] = fields });
        return snapshot.ToJsonString();
    }

    /// <summary>A zip holding only content.json with exactly this text.</summary>
    private static byte[] RawBundle(string contentJson)
    {
        using var output = new MemoryStream();
        using (var zip = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true))
        using (var to = zip.CreateEntry("content.json", CompressionLevel.NoCompression).Open())
            to.Write(Encoding.UTF8.GetBytes(contentJson));
        return output.ToArray();
    }

    /// <summary>A seekable stream that counts the bytes read through it.</summary>
    private sealed class CountingStream(Stream inner) : Stream
    {
        public long BytesRead { get; private set; }
        public override bool CanRead => true;
        public override bool CanSeek => inner.CanSeek;
        public override bool CanWrite => false;
        public override long Length => inner.Length;
        public override long Position { get => inner.Position; set => inner.Position = value; }
        public override void Flush() { }
        public override int Read(byte[] buffer, int offset, int count)
        {
            var read = inner.Read(buffer, offset, count);
            BytesRead += read;
            return read;
        }

        public override long Seek(long offset, SeekOrigin origin) => inner.Seek(offset, origin);
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        protected override void Dispose(bool disposing)
        {
            if (disposing)
                inner.Dispose();
            base.Dispose(disposing);
        }
    }

    /// <summary>Rewrites the uncompressed size a zip entry declares, in its local header and the central directory.</summary>
    private static byte[] Declare(byte[] zip, string entryName, uint size)
    {
        var bytes = (byte[])zip.Clone();
        var name = Encoding.UTF8.GetBytes(entryName);
        for (var i = 0; i + 46 < bytes.Length; i++)
        {
            if (bytes[i] == 0x50 && bytes[i + 1] == 0x4B && bytes[i + 2] == 0x03 && bytes[i + 3] == 0x04
                && BitConverter.ToUInt16(bytes, i + 26) == name.Length && bytes.AsSpan(i + 30, name.Length).SequenceEqual(name))
                BitConverter.GetBytes(size).CopyTo(bytes, i + 22);
            if (bytes[i] == 0x50 && bytes[i + 1] == 0x4B && bytes[i + 2] == 0x01 && bytes[i + 3] == 0x02
                && BitConverter.ToUInt16(bytes, i + 28) == name.Length && bytes.AsSpan(i + 46, name.Length).SequenceEqual(name))
                BitConverter.GetBytes(size).CopyTo(bytes, i + 24);
        }

        return bytes;
    }

    private static byte[] RandomBytes(int length)
    {
        var data = new byte[length];
        new Random(30).NextBytes(data);
        return data;
    }

    /// <summary>The command line, with settings in memory instead of user-secrets.</summary>
    private static async Task<(int Code, string Output)> RunAsync(Dictionary<string, string?> settings, params string[] args)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
        using var output = new StringWriter();
        var code = await BundleCommands.RunAsync(args, configuration, output, output);
        return (code, output.ToString());
    }
}
