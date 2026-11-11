using System.Globalization;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using DigitalHub.Api.Content;
using DigitalHub.Api.Data;
using DigitalHub.Images;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace DigitalHub.ContentImport;

/// <summary>
/// The content bundle: every row that makes up the site's content, and the media
/// files those rows point at, in one zip (content.json and media/). It moves the
/// content Ali enters in the Studio to a database built fresh from the migrations.
///
/// What it never carries: user accounts, roles, passwords, refresh tokens, the
/// audit log, contact requests, and the user ids that rows record (who uploaded,
/// who published, who made a redirect). Those columns are left out of the rows.
///
/// Export only reads. Import runs in one transaction: every row is written, then
/// every document is checked with the same checks a Studio save applies
/// (ContentStore.CheckDocumentAsync, AdminStore's settings, navigation and
/// redirect checks, MediaLibrary's alt-text check); one failure undoes it all.
/// Rows are matched by id, so importing the same bundle twice changes nothing.
/// Import never deletes a row, and never a file it did not create: if it fails after
/// writing a new media file, it removes exactly the files it wrote.
/// </summary>
static class ContentBundle
{
    public const string Format = "digitalhub-content-bundle";
    public const int FormatVersion = 1;
    private const string ContentEntry = "content.json";
    private const string MediaFolder = "media/";

    /// <summary>Zip entries carry this time, so two exports of the same content are the same bytes.</summary>
    private static readonly DateTimeOffset EntryTime = new(2000, 1, 1, 0, 0, 0, TimeSpan.Zero);

    /// <summary>A field name containing one of these is refused: bundles carry content, never credentials.</summary>
    private static readonly string[] ForbiddenNames = ["password", "token", "secret", "connectionstring"];

    private static readonly string[] RootKeys = ["format", "formatVersion", "exportedAt", "migration", "counts", "checksums", "files", "tables"];

    internal static readonly JsonSerializerOptions Json = new()
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };

    private static readonly JsonSerializerOptions Indented = new(Json) { WriteIndented = true };

    /// <summary>A stored draft (revision snapshot, working copy): the API's own shape, and no member it does not know.</summary>
    private static readonly JsonSerializerOptions StrictDraft = new(ContentJson.Options) { UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow };

    /// <summary>The tables in import order: media before the rows that use it, owners before their sections.</summary>
    internal static readonly ITable[] Tables =
    [
        new Table<MediaAsset>("media", db => db.Media, exclude: ["UploaderId"]),
        new Table<Page>("pages", db => db.Pages, collection: "pages"),
        new Table<Service>("services", db => db.Services, collection: "services"),
        new Table<Partner>("partners", db => db.Partners, collection: "partners"),
        new Table<CaseStudy>("case-studies", db => db.CaseStudies, collection: "case-studies"),
        new Table<BlogPost>("blog-posts", db => db.BlogPosts, collection: "blog-posts"),
        new Table<Vacancy>("vacancies", db => db.Vacancies, collection: "vacancies"),
        new Table<TeamMember>("team-members", db => db.TeamMembers, collection: "team-members"),
        new Table<NewsItem>("news-items", db => db.NewsItems, collection: "news-items"),
        new Table<Section>("sections", db => db.Sections),
        new Table<WorkingCopy>("working-copies", db => db.WorkingCopies),
        new Table<Revision>("revisions", db => db.Revisions, exclude: ["PublishedById"]),
        new Table<NavigationItem>("navigation", db => db.NavigationItems),
        new Table<Redirect>("redirects", db => db.Redirects, exclude: ["CreatedById"]),
        new Table<SiteSettings>("settings", db => db.SiteSettings, singleton: true),
    ];

    /// <summary>The newest migration this build of the tool knows. Export and import both require the database to be at it.</summary>
    public static string CodeMigration(ContentDbContext db) => db.Database.GetMigrations().Last();

    public static async Task<string?> DatabaseMigrationAsync(ContentDbContext db, CancellationToken cancellationToken) =>
        (await db.Database.GetAppliedMigrationsAsync(cancellationToken)).LastOrDefault();

    // ---------------------------------------------------------------- export

    public static async Task<ExportResult> ExportAsync(ContentDbContext db, string? mediaRoot, Stream output, DateTime exportedAt, CancellationToken cancellationToken)
    {
        var applied = await DatabaseMigrationAsync(db, cancellationToken);
        var code = CodeMigration(db);
        if (applied != code)
            return ExportResult.Refused($"The database is at migration {applied ?? "(none)"}, but this tool is built for {code}. Export with the tool from the same code as the database.");

        var tables = new JsonObject();
        var counts = new JsonObject();
        var checksums = new JsonObject();
        var countValues = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var table in Tables)
        {
            var rows = await table.ExportAsync(db, cancellationToken);
            counts[table.Name] = rows.Count;
            countValues[table.Name] = rows.Count;
            checksums[table.Name] = Sha256(rows.ToJsonString(Json));
            tables[table.Name] = rows;
        }

        var names = MediaFileNames(tables["media"]!.AsArray(), out var badPaths);
        if (badPaths.Count > 0)
            return ExportResult.Refused("Media rows point at paths outside /media/: " + string.Join(", ", badPaths));
        if (names.Count > 0 && string.IsNullOrWhiteSpace(mediaRoot))
            return ExportResult.Refused("Media:Root is not set, and the content uses " + names.Count + " media files.");

        var missing = names.Where(name => !File.Exists(Path.Combine(mediaRoot!, name))).ToList();
        if (missing.Count > 0)
            return ExportResult.Refused($"{missing.Count} media files are missing from Media:Root: {string.Join(", ", missing.Take(10))}{(missing.Count > 10 ? ", ..." : "")}");

        var files = new JsonArray();
        long bytes = 0;
        foreach (var name in names)
        {
            var data = await File.ReadAllBytesAsync(Path.Combine(mediaRoot!, name), cancellationToken);
            bytes += data.Length;
            files.Add(new JsonObject { ["name"] = name, ["bytes"] = data.Length, ["sha256"] = Sha256(data) });
        }

        var document = new JsonObject
        {
            ["format"] = Format,
            ["formatVersion"] = FormatVersion,
            ["exportedAt"] = exportedAt.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ"),
            ["migration"] = applied,
            ["counts"] = counts,
            ["checksums"] = checksums,
            ["files"] = files,
            ["tables"] = tables,
        };

        // The export checks itself with the rule the import applies.
        var forbidden = ForbiddenFieldNames(document, out var tooLarge);
        if (tooLarge is not null)
            return ExportResult.Refused("The export is refused: " + tooLarge);
        if (forbidden.Count > 0)
            return ExportResult.Refused("The export would contain fields that look like credentials: " + string.Join(", ", forbidden));

        using (var zip = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true))
        {
            await WriteEntryAsync(zip, ContentEntry, Encoding.UTF8.GetBytes(document.ToJsonString(Indented)), cancellationToken);
            foreach (var name in names)
                await WriteEntryAsync(zip, MediaFolder + name, await File.ReadAllBytesAsync(Path.Combine(mediaRoot!, name), cancellationToken), cancellationToken);
        }

        return new ExportResult(null, applied!, countValues, names.Count, bytes);
    }

    private static async Task WriteEntryAsync(ZipArchive zip, string name, byte[] data, CancellationToken cancellationToken)
    {
        var entry = zip.CreateEntry(name, CompressionLevel.Optimal);
        entry.LastWriteTime = EntryTime;
        await using var stream = entry.Open();
        await stream.WriteAsync(data, cancellationToken);
    }

    // ---------------------------------------------------------------- import

    public static async Task<ImportResult> ImportAsync(ContentDbContext db, string? mediaRoot, Stream input, ImportOptions options, CancellationToken cancellationToken)
    {
        var read = await ReadAsync(db, input, options.Limits, cancellationToken);
        if (read.Error is not null)
            return ImportResult.Refused(read.Error);
        var bundle = read.Bundle!;

        var applied = await DatabaseMigrationAsync(db, cancellationToken);
        var code = CodeMigration(db);
        if (bundle.Migration != applied || applied != code)
        {
            return ImportResult.Refused(
                $"The bundle was made at migration {bundle.Migration}, but the database is at {applied ?? "(none)"}"
                + (applied != code ? $" and this tool is built for {code}" : "")
                + ". Migrate the database to the bundle's version first, with the tool from the same code.");
        }

        if (bundle.Files.Count > 0 && string.IsNullOrWhiteSpace(mediaRoot))
            return ImportResult.Refused("Media:Root is not set, and the bundle has " + bundle.Files.Count + " media files.");

        var plan = new Dictionary<string, TableCount>(StringComparer.Ordinal);
        var problems = new List<string>();
        var conflicts = new List<string>();

        // Media files first, outside the database: a file of the same name must hold the same bytes.
        var newFiles = new List<string>();
        foreach (var (name, data) in bundle.Files)
        {
            var target = Path.Combine(mediaRoot!, name);
            if (!File.Exists(target))
                newFiles.Add(name);
            else if (Sha256(await File.ReadAllBytesAsync(target, cancellationToken)) != Sha256(data))
                problems.Add($"media file {name}: a different file of that name is already in Media:Root.");
        }

        if (problems.Count > 0)
            return ImportResult.Failed(problems, plan, conflicts, options.DryRun);

        var outer = db.Database.CurrentTransaction;
        IDbContextTransaction? own = null;
        const string savepoint = "content_bundle_import";
        if (outer is null)
            own = await db.Database.BeginTransactionAsync(cancellationToken);
        else
            await outer.CreateSavepointAsync(savepoint, cancellationToken);

        var committed = false;
        var written = new List<string>();
        try
        {
            var owners = await OwnerDecisionsAsync(db, bundle, cancellationToken);
            foreach (var table in Tables)
            {
                var count = await table.ImportAsync(db, bundle.Tables[table.Name], owners, conflicts, problems, cancellationToken);
                plan[table.Name] = count;
                if (problems.Count > 0)
                    break;
                await db.SaveChangesAsync(cancellationToken);
            }

            if (problems.Count == 0 && conflicts.Count > 0 && !options.Force)
                problems.Add($"{conflicts.Count} rows on the target differ from the bundle and are not older than it. Nothing was imported. Pass --force to overwrite them.");

            var warnings = new List<string>();
            if (problems.Count == 0)
                problems.AddRange(await CheckAsync(db, bundle, warnings, cancellationToken));

            if (problems.Count == 0)
            {
                foreach (var table in Tables)
                {
                    var stored = await table.ReadBackAsync(db, bundle.Tables[table.Name], cancellationToken);
                    if (Sha256(stored.ToJsonString(Json)) != bundle.Checksums[table.Name])
                        problems.Add($"{table.Name}: after import the rows do not match the bundle checksum.");
                }
            }

            if (problems.Count > 0 || options.DryRun)
            {
                await UndoAsync(db, own, outer, savepoint, cancellationToken);
                return problems.Count > 0
                    ? ImportResult.Failed(problems, plan, conflicts, options.DryRun)
                    : new ImportResult(true, [], plan, conflicts, true, newFiles.Count, bundle.Files.Count - newFiles.Count) { Warnings = warnings };
            }

            // Files are written last, after every check, then the database is committed. Nothing can
            // fail after the commit. Every file written here is recorded first, so a failure on a
            // later file, or in the commit itself, removes exactly these files and nothing else.
            foreach (var name in newFiles)
            {
                var target = Path.Combine(mediaRoot!, name);
                var temporary = target + ".import-" + Guid.NewGuid().ToString("N");
                written.Add(temporary);
                await File.WriteAllBytesAsync(temporary, bundle.Files[name], cancellationToken);
                written.Add(target);
                File.Move(temporary, target);
                written.Remove(temporary);
            }

            if (own is not null)
                await own.CommitAsync(cancellationToken);
            else
                await outer!.ReleaseSavepointAsync(savepoint, cancellationToken);
            committed = true;
            return new ImportResult(true, [], plan, conflicts, false, newFiles.Count, bundle.Files.Count - newFiles.Count) { Warnings = warnings };
        }
        catch (DbUpdateException exception)
        {
            RemoveWritten(written);
            await UndoAsync(db, own, outer, savepoint, cancellationToken);
            var reason = exception.InnerException?.Message ?? exception.Message;
            var rows = exception.Entries
                .Select(entry => (Table: Tables.FirstOrDefault(table => table.Type == entry.Metadata.ClrType)?.Name ?? entry.Metadata.ClrType.Name, Id: entry.Property("Id").CurrentValue))
                .ToList();
            if (rows.Count == 0)
                problems.Add("The database refused a row: " + reason);
            foreach (var (table, id) in rows)
                problems.Add($"{table} {id}: the database refused the row: {reason}");
            return ImportResult.Failed(problems, plan, conflicts, options.DryRun);
        }
        catch (Exception exception) when (!committed && exception is not OperationCanceledException)
        {
            var removed = RemoveWritten(written);
            await UndoAsync(db, own, outer, savepoint, cancellationToken);
            problems.Add($"The import stopped: {exception.Message}{(removed > 0 ? $" The {removed} media file(s) it had written were removed." : "")}");
            return ImportResult.Failed(problems, plan, conflicts, options.DryRun);
        }
        catch when (!committed)
        {
            RemoveWritten(written);
            await UndoAsync(db, own, outer, savepoint, cancellationToken);
            throw;
        }
        finally
        {
            if (own is not null)
                await own.DisposeAsync();
        }
    }

    private static async Task UndoAsync(ContentDbContext db, IDbContextTransaction? own, IDbContextTransaction? outer, string savepoint, CancellationToken cancellationToken)
    {
        try
        {
            if (own is not null)
                await own.RollbackAsync(cancellationToken);
            else
                await outer!.RollbackToSavepointAsync(savepoint, cancellationToken);
        }
        catch (Exception) when (own is not null)
        {
            /* A failed commit has already ended the transaction; disposing it is the rollback. */
        }

        db.ChangeTracker.Clear();
    }

    /// <summary>Deletes exactly the files this import wrote (never one that was there before). Returns how many.</summary>
    private static int RemoveWritten(List<string> written)
    {
        var removed = 0;
        foreach (var path in written)
        {
            try
            {
                if (File.Exists(path))
                {
                    File.Delete(path);
                    removed++;
                }
            }
            catch (IOException)
            {
            }
            catch (UnauthorizedAccessException)
            {
            }
        }

        written.Clear();
        return removed;
    }

    /// <summary>
    /// Whether each owner in the bundle may be updated: it is new on the target, or
    /// the target's copy was not edited after the bundle's. Sections follow their owner.
    /// </summary>
    private static async Task<Dictionary<Guid, bool>> OwnerDecisionsAsync(ContentDbContext db, Bundle bundle, CancellationToken cancellationToken)
    {
        var decisions = new Dictionary<Guid, bool>();
        foreach (var table in Tables.Where(table => table.Collection is not null))
        {
            foreach (var row in bundle.Tables[table.Name])
            {
                var id = row!["id"]!.GetValue<Guid>();
                var updated = row["updatedAt"]!.Deserialize<DateTime>(Json);
                var target = await table.UpdatedAtAsync(db, id, cancellationToken);
                decisions[id] = target is null || target <= updated;
            }
        }

        return decisions;
    }

    /// <summary>Every imported document through the checks the Studio's own writes apply.</summary>
    private static async Task<List<string>> CheckAsync(ContentDbContext db, Bundle bundle, List<string> warnings, CancellationToken cancellationToken)
    {
        var problems = new List<string>();
        var store = new ContentStore(db, new SectionSchemaSet(), new CollectionSchemaSet());

        foreach (var table in Tables.Where(table => table.Collection is not null))
        {
            foreach (var row in bundle.Tables[table.Name])
            {
                var id = row!["id"]!.GetValue<Guid>();
                var record = await table.FindRecordAsync(db, id, cancellationToken);
                var sections = await db.Sections.AsNoTracking()
                    .Where(section => section.PageId == id || section.ServiceId == id || section.PartnerId == id || section.CaseStudyId == id)
                    .ToListAsync(cancellationToken);
                var draft = ContentFields.FromRecord(table.Collection!, record, sections);
                /* Strict where the website builds the row: published items and ended
                   vacancies (BuildContentStore). A draft holds what the Studio saved (ADM-02). */
                var built = record.Status is ContentStatus.Published or ContentStatus.Ended;
                Report(problems, table.Name, id, await store.CheckDocumentAsync(table.Collection!, id, draft, publishing: built, cancellationToken));
            }
        }

        foreach (var row in bundle.Tables["working-copies"])
        {
            var copy = row!.Deserialize<WorkingCopy>(Json)!;
            var (collection, ownerId) = CopyOwner(copy);
            DraftDocument? draft = null;
            try
            {
                draft = JsonSerializer.Deserialize<DraftDocument>(copy.Document, ContentJson.Options);
            }
            catch (JsonException)
            {
            }

            if (collection is null || ownerId is null || draft is null)
            {
                problems.Add($"working-copies {copy.Id}: document: is not a draft of one content item.");
                continue;
            }

            // A working copy is a draft, even of a published item: it is not built until it is published.
            Report(problems, "working-copies", copy.Id, await store.CheckDocumentAsync(collection, ownerId.Value, draft, publishing: false, cancellationToken));
        }

        foreach (var row in bundle.Tables["revisions"])
        {
            var revision = row!.Deserialize<Revision>(Json)!;
            try
            {
                if (JsonSerializer.Deserialize<DraftDocument>(revision.Snapshot, ContentJson.Options) is null)
                    problems.Add($"revisions {revision.Id}: snapshot: is empty.");
            }
            catch (JsonException)
            {
                problems.Add($"revisions {revision.Id}: snapshot: is not a published document.");
            }
        }

        var files = bundle.Files.Keys.ToHashSet(StringComparer.Ordinal);
        foreach (var row in bundle.Tables["media"])
        {
            var asset = row!.Deserialize<MediaAsset>(Json)!;
            // A warning, not a refusal: the Studio applies this check when an image is uploaded or
            // edited, and keeps rows that predate it (the old site's images without alt text).
            var error = MediaLibrary.MetadataError(asset.Alt, asset.Decorative, asset.Caption);
            if (error is not null)
                warnings.Add($"media {asset.Id} ({asset.OriginalName}): {error}");
            // Safety checks, for new and existing rows alike; --force never bypasses them.
            if (asset.ContentType != ImageFiles.StoredContentType)
                problems.Add($"media {asset.Id}: content type {asset.ContentType} is not {ImageFiles.StoredContentType}, the only type the upload stores.");
            var referenced = MediaFileNames(new JsonArray(row!.DeepClone()), out var badPaths);
            foreach (var name in referenced)
            {
                if (!files.Contains(name))
                    problems.Add($"media {asset.Id}: file {name} is not in the bundle.");
            }

            foreach (var path in badPaths)
                problems.Add($"media {asset.Id}: path {path} is not /media/ followed by a safe file name.");
        }

        foreach (var row in bundle.Tables["settings"])
        {
            var settings = row!.Deserialize<SiteSettings>(Json)!;
            Report(problems, "settings", settings.Id, AdminStore.CheckSettings(SettingsRequest(settings)));
        }

        var menus = bundle.Tables["navigation"].Select(row => row!["menu"]!.GetValue<string>()).Distinct(StringComparer.Ordinal);
        foreach (var menu in menus)
        {
            var rows = await db.NavigationItems.AsNoTracking().Where(item => item.Menu == menu).ToListAsync(cancellationToken);
            var errors = await AdminStore.CheckNavigationAsync(db, menu, NavigationTree(rows), cancellationToken);
            foreach (var (field, messages) in errors)
                problems.AddRange(messages.Select(message => $"navigation {menu}: {field}: {message}"));
        }

        foreach (var row in bundle.Tables["redirects"])
        {
            var redirect = row!.Deserialize<Redirect>(Json)!;
            Report(problems, "redirects", redirect.Id, await AdminStore.CheckRedirectAsync(db, redirect, cancellationToken));
        }

        return problems;
    }

    private static void Report(List<string> problems, string table, Guid id, Dictionary<string, List<string>> errors)
    {
        foreach (var (field, messages) in errors)
            problems.AddRange(messages.Select(message => $"{table} {id}: {field}: {message}"));
    }

    private static (string? Collection, Guid? OwnerId) CopyOwner(WorkingCopy copy) =>
        copy.PageId is { } page ? ("pages", page)
        : copy.ServiceId is { } service ? ("services", service)
        : copy.PartnerId is { } partner ? ("partners", partner)
        : copy.CaseStudyId is { } study ? ("case-studies", study)
        : copy.BlogPostId is { } post ? ("blog-posts", post)
        : copy.VacancyId is { } vacancy ? ("vacancies", vacancy)
        : copy.TeamMemberId is { } member ? ("team-members", member)
        : copy.NewsItemId is { } news ? ("news-items", news)
        : (null, null);

    private static List<NavigationNode> NavigationTree(List<NavigationItem> rows)
    {
        NavigationNode Node(NavigationItem item) => new()
        {
            Id = item.Id,
            Label = item.Label,
            LinkKind = item.LinkKind,
            TargetType = item.TargetType,
            TargetId = item.TargetId,
            Url = item.Url,
            Children = rows.Where(child => child.ParentId == item.Id).OrderBy(child => child.SortOrder).Select(Node).ToList(),
        };

        return rows.Where(item => item.ParentId is null).OrderBy(item => item.SortOrder).Select(Node).ToList();
    }

    private static SiteSettingsUpdate SettingsRequest(SiteSettings settings)
    {
        var request = new SiteSettingsUpdate();
        foreach (var property in typeof(SiteSettingsUpdate).GetProperties())
            property.SetValue(request, typeof(SiteSettings).GetProperty(property.Name)!.GetValue(settings));
        return request;
    }

    // ---------------------------------------------------------------- reading a bundle

    private sealed record Bundle(string Migration, Dictionary<string, JsonArray> Tables, Dictionary<string, string> Checksums, Dictionary<string, byte[]> Files);

    private static async Task<(Bundle? Bundle, string? Error)> ReadAsync(ContentDbContext db, Stream input, BundleLimits limits, CancellationToken cancellationToken)
    {
        ZipArchive zip;
        try
        {
            zip = new ZipArchive(input, ZipArchiveMode.Read, leaveOpen: true);
        }
        catch (InvalidDataException)
        {
            return (null, "The file is not a content bundle (not a zip).");
        }

        try
        {
            using (zip)
                return await ReadZipAsync(db, zip, limits, cancellationToken);
        }
        catch (InvalidDataException exception)
        {
            return (null, "The bundle is damaged: " + exception.Message);
        }
        catch (Exception exception) when (exception is JsonException or InvalidOperationException or FormatException or OverflowException)
        {
            return (null, "content.json has a value of the wrong type: " + exception.Message);
        }
    }

    private static async Task<(Bundle? Bundle, string? Error)> ReadZipAsync(ContentDbContext db, ZipArchive zip, BundleLimits limits, CancellationToken cancellationToken)
    {
        {
            // Size limits first, on what each entry declares, before anything is read.
            if (zip.Entries.Count > limits.MaxEntries)
                return (null, $"The bundle has {zip.Entries.Count:N0} entries; at most {limits.MaxEntries:N0} are allowed.");
            long declaredTotal = 0;
            foreach (var entry in zip.Entries)
            {
                var cap = entry.FullName == ContentEntry ? limits.MaxContentBytes : limits.MaxFileBytes;
                if (entry.Length > cap)
                    return (null, $"{entry.FullName} declares {entry.Length:N0} bytes, over the limit of {cap:N0}.");
                if (entry.CompressedLength > 0 && (double)entry.Length / entry.CompressedLength > limits.MaxRatio)
                    return (null, $"{entry.FullName} expands {(double)entry.Length / entry.CompressedLength:N0} times, over the limit of {limits.MaxRatio:N0}.");
                declaredTotal += entry.Length;
                if (declaredTotal > limits.MaxTotalBytes)
                    return (null, $"The bundle's entries declare more than {limits.MaxTotalBytes:N0} bytes in total.");
            }

            var content = zip.GetEntry(ContentEntry);
            if (content is null)
                return (null, "The bundle has no content.json.");

            var (contentBytes, contentError) = await ReadEntryAsync(content, limits.MaxContentBytes, limits.MaxRatio, cancellationToken);
            if (contentError is not null)
                return (null, contentError);

            // Measured without recursion first, so a deeply nested file is one refusal, not a crash.
            if (Nesting(contentBytes).Nesting > MaxWalkDepth)
                return (null, TooDeep);

            JsonObject root;
            try
            {
                root = JsonNode.Parse(contentBytes, documentOptions: ParseOptions)?.AsObject() ?? throw new JsonException("empty");
            }
            catch (Exception exception) when (exception is JsonException or InvalidOperationException)
            {
                return (null, "content.json is not a JSON object.");
            }

            var forbidden = ForbiddenFieldNames(root, out var walkRefusal);
            if (walkRefusal is not null)
                return (null, walkRefusal);
            if (forbidden.Count > 0)
            {
                return (null, "The bundle has fields that look like users or credentials (" + string.Join(", ", forbidden)
                    + "). A content bundle never carries users, passwords, tokens, secrets, or connection strings.");
            }

            var unknownRoot = root.Select(pair => pair.Key).Except(RootKeys, StringComparer.Ordinal).ToList();
            if (unknownRoot.Count > 0)
                return (null, "content.json has unknown fields: " + string.Join(", ", unknownRoot));
            if (root["format"]?.GetValue<string>() != Format || root["formatVersion"]?.GetValue<int>() != FormatVersion)
                return (null, $"This is not a {Format} version {FormatVersion} file.");
            if (root["migration"]?.GetValue<string>() is not { Length: > 0 } migration)
                return (null, "The bundle does not say which migration it was made at.");
            if (root["tables"] is not JsonObject tables || root["counts"] is not JsonObject counts || root["checksums"] is not JsonObject checksums || root["files"] is not JsonArray fileList)
                return (null, "content.json is missing tables, counts, checksums, or files.");

            var known = Tables.Select(table => table.Name).ToHashSet(StringComparer.Ordinal);
            var unknownTables = tables.Select(pair => pair.Key).Where(name => !known.Contains(name)).ToList();
            if (unknownTables.Count > 0)
                return (null, "The bundle has tables this tool does not move: " + string.Join(", ", unknownTables));

            var byName = new Dictionary<string, JsonArray>(StringComparer.Ordinal);
            var sums = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var table in Tables)
            {
                if (tables[table.Name] is not JsonArray rows)
                    return (null, $"The bundle has no {table.Name} table.");
                if (counts[table.Name]?.GetValue<int>() != rows.Count)
                    return (null, $"{table.Name}: the bundle says {counts[table.Name]} rows but holds {rows.Count}. The file is damaged.");
                var sum = checksums[table.Name]?.GetValue<string>();
                if (sum != Sha256(rows.ToJsonString(Json)))
                    return (null, $"{table.Name}: the checksum does not match. The file is damaged or was edited.");
                var shape = table.ShapeError(db, rows);
                if (shape is not null)
                    return (null, shape);
                byName[table.Name] = rows;
                sums[table.Name] = sum!;
            }

            // Drafts kept as JSON text: the API's own shape, nothing it does not know.
            foreach (var (tableName, column) in new[] { ("revisions", "snapshot"), ("working-copies", "document") })
            {
                foreach (var row in byName[tableName])
                {
                    var text = row![column]!.GetValue<string>();
                    try
                    {
                        if (JsonSerializer.Deserialize<DraftDocument>(text, StrictDraft) is null)
                            return (null, $"{tableName} {row["id"]}: {column}: is empty.");
                    }
                    catch (JsonException exception)
                    {
                        return (null, $"{tableName} {row["id"]}: {column}: is not a draft document ({exception.Message})");
                    }
                }
            }

            var files = new Dictionary<string, byte[]>(StringComparer.Ordinal);
            long readTotal = contentBytes.Length;
            foreach (var item in fileList)
            {
                var name = item?["name"]?.GetValue<string>();
                var sha = item?["sha256"]?.GetValue<string>();
                if (name is null || sha is null || !SafeFileName(name))
                    return (null, "The bundle lists a media file with a missing or unsafe name.");
                var entry = zip.GetEntry(MediaFolder + name);
                if (entry is null)
                    return (null, $"media file {name} is listed but not in the bundle.");
                var (data, error) = await ReadEntryAsync(entry, limits.MaxFileBytes, limits.MaxRatio, cancellationToken);
                if (error is not null)
                    return (null, error);
                readTotal += data.Length;
                if (readTotal > limits.MaxTotalBytes)
                    return (null, $"The bundle's files hold more than {limits.MaxTotalBytes:N0} bytes in total.");
                if (Sha256(data) != sha)
                    return (null, $"media file {name}: the checksum does not match. The file is damaged or was edited.");
                // The upload path's own rule: a stored image name, WebP bytes, not SVG, within its limits.
                var stored = ImageFiles.StoredFileProblem(name, data);
                if (stored is not null)
                    return (null, $"media file {name}: {stored}.");
                files[name] = data;
            }

            var extra = zip.Entries
                .Select(entry => entry.FullName)
                .Where(name => name != ContentEntry && !(name.StartsWith(MediaFolder, StringComparison.Ordinal) && files.ContainsKey(name[MediaFolder.Length..])))
                .ToList();
            if (extra.Count > 0)
                return (null, "The bundle holds files it does not list: " + string.Join(", ", extra.Take(10)));

            return (new Bundle(migration, byName, sums, files), null);
        }
    }

    /// <summary>
    /// One zip entry, read up to its cap: the bytes actually read are checked, not only what
    /// the entry declares. Reading stops one byte past the smaller of the two.
    /// </summary>
    private static async Task<(byte[] Data, string? Error)> ReadEntryAsync(ZipArchiveEntry entry, long cap, double maxRatio, CancellationToken cancellationToken)
    {
        var limit = Math.Min(cap, entry.Length);
        using var buffer = new MemoryStream();
        var chunk = new byte[81920];
        await using (var stream = entry.Open())
        {
            while (true)
            {
                var read = await stream.ReadAsync(chunk, cancellationToken);
                if (read == 0)
                    break;
                buffer.Write(chunk, 0, read);
                if (buffer.Length > limit)
                {
                    return buffer.Length > cap
                        ? ([], $"{entry.FullName} holds more than the limit of {cap:N0} bytes.")
                        : ([], $"{entry.FullName} holds more bytes than it declares ({entry.Length:N0}). The file is damaged or was edited.");
                }
            }
        }

        if (entry.CompressedLength > 0 && (double)buffer.Length / entry.CompressedLength > maxRatio)
            return ([], $"{entry.FullName} expands {(double)buffer.Length / entry.CompressedLength:N0} times, over the limit of {maxRatio:N0}.");
        return (buffer.ToArray(), null);
    }

    /// <summary>How deep the credential walk goes, counting JSON kept as text. A deeper document is refused, never skipped.</summary>
    internal const int MaxWalkDepth = 64;

    /// <summary>How many JSON values the credential walk visits. More is refused (Parity: about 30,000).</summary>
    internal const int MaxWalkNodes = 5_000_000;

    /// <summary>How many bytes of JSON kept as text the walk reads again. More is refused.</summary>
    internal const long MaxWalkTextBytes = 1L << 30;

    internal static string TooDeep => $"A document is nested more than {MaxWalkDepth} levels deep; the bundle is refused.";

    /// <summary>
    /// Every field name that looks like a credential, at any depth: the bundle's own keys,
    /// and the keys inside JSON kept as text in a column (section fields, drafts, revision
    /// snapshots, rich text, generated sizes). Text values are not checked, so an article
    /// may say "password". A limit never skips: past the depth, the node count, or the text
    /// budget, <paramref name="refusal"/> is set and the whole bundle is refused.
    /// </summary>
    internal static List<string> ForbiddenFieldNames(JsonNode? node, out string? refusal, int maxNodes = MaxWalkNodes, long maxTextBytes = MaxWalkTextBytes)
    {
        var found = new List<string>();
        var nodes = 0;
        long textBytes = 0;
        string? stop = null;

        bool Walk(JsonNode? current, int depth)
        {
            if (depth > MaxWalkDepth)
            {
                stop = TooDeep;
                return false;
            }

            if (++nodes > maxNodes)
            {
                stop = $"The bundle has more than {maxNodes:N0} JSON values; the bundle is refused.";
                return false;
            }

            switch (current)
            {
                case JsonObject obj:
                    List<KeyValuePair<string, JsonNode?>> members;
                    try
                    {
                        members = obj.ToList();
                    }
                    catch (ArgumentException)
                    {
                        // System.Text.Json reads a repeated name only when the object is first listed.
                        stop = "A document has the same field name twice; the bundle is refused.";
                        return false;
                    }

                    foreach (var (key, value) in members)
                    {
                        if (LooksLikeCredential(key))
                            found.Add(key);
                        if (!Walk(value, depth + 1))
                            return false;
                    }

                    return true;
                case JsonArray array:
                    foreach (var item in array)
                    {
                        if (!Walk(item, depth + 1))
                            return false;
                    }

                    return true;
                case JsonValue value when value.TryGetValue<string>(out var text):
                    var trimmed = text.AsSpan().TrimStart();
                    if (trimmed.Length == 0 || trimmed[0] is not ('{' or '['))
                        return true; // Plain text. Its words are content.

                    var utf8 = Encoding.UTF8.GetBytes(text);
                    textBytes += utf8.Length;
                    if (textBytes > maxTextBytes)
                    {
                        stop = $"The bundle keeps more than {maxTextBytes:N0} bytes of JSON as text; the bundle is refused.";
                        return false;
                    }

                    var (nesting, valid) = Nesting(utf8);
                    if (depth + 1 + nesting > MaxWalkDepth)
                    {
                        // Refused even when the text is not valid JSON: what is readable is already too deep.
                        stop = TooDeep;
                        return false;
                    }

                    if (!valid)
                        return true; // Text that only looks like JSON, such as "[citation needed]". Its words are content.

                    return Walk(JsonNode.Parse(utf8, documentOptions: ParseOptions), depth + 1);
                default:
                    return true; // A number, true, false, or null: no field names.
            }
        }

        Walk(node, 0);
        refusal = stop;
        return found.Distinct(StringComparer.Ordinal).ToList();
    }

    /// <summary>Within the walk's depth, so parsing never throws for depth and never recurses far.</summary>
    internal static readonly JsonDocumentOptions ParseOptions = new() { MaxDepth = MaxWalkDepth + 1 };

    /// <summary>
    /// How deeply JSON nests, read token by token without recursion, so a document nested
    /// 10,000 levels is measured instead of overflowing the stack. Valid is false for text
    /// that is not JSON; the nesting is then what was read before the error.
    /// </summary>
    internal static (int Nesting, bool Valid) Nesting(ReadOnlySpan<byte> utf8)
    {
        var reader = new Utf8JsonReader(utf8, new JsonReaderOptions { MaxDepth = int.MaxValue });
        var deepest = 0;
        try
        {
            while (reader.Read())
                deepest = Math.Max(deepest, reader.CurrentDepth);
            return (deepest, true);
        }
        catch (JsonException)
        {
            return (Math.Max(deepest, reader.CurrentDepth), false);
        }
    }

    /// <summary>
    /// Compatibility decomposition (NFKD), then case folding; format characters (zero-width
    /// spaces, soft hyphens) and combining marks dropped; Cyrillic and Greek letters that look
    /// like the Latin letters of the four words folded to them; "_" and "-" removed. Best effort:
    /// it only ever adds refusals.
    /// </summary>
    internal static bool LooksLikeCredential(string key)
    {
        var folded = new StringBuilder(key.Length);
        foreach (var c in key.Normalize(NormalizationForm.FormKD).ToLowerInvariant())
        {
            var category = char.GetUnicodeCategory(c);
            if (category is UnicodeCategory.Format or UnicodeCategory.NonSpacingMark or UnicodeCategory.EnclosingMark || c is '_' or '-')
                continue;
            folded.Append(Confusables.TryGetValue(c, out var latin) ? latin : c);
        }

        var text = folded.ToString();
        return ForbiddenNames.Any(word => text.Contains(word, StringComparison.Ordinal));
    }

    /// <summary>Lowercase Cyrillic and Greek letters that look like the Latin letters in password, token, secret, connectionstring.</summary>
    private static readonly Dictionary<char, char> Confusables = new()
    {
        ['а'] = 'a', ['с'] = 'c', ['е'] = 'e', ['і'] = 'i', ['к'] = 'k', ['о'] = 'o', ['р'] = 'p', ['ѕ'] = 's', ['т'] = 't', ['ԁ'] = 'd', ['ԝ'] = 'w', ['г'] = 'r',
        ['α'] = 'a', ['ε'] = 'e', ['ι'] = 'i', ['κ'] = 'k', ['ν'] = 'n', ['ο'] = 'o', ['ρ'] = 'p', ['τ'] = 't',
    };

    /// <summary>The files a media row points at: its path and every generated size, by file name.</summary>
    private static List<string> MediaFileNames(JsonArray media, out List<string> badPaths)
    {
        var names = new SortedSet<string>(StringComparer.Ordinal);
        badPaths = [];
        foreach (var node in media)
        {
            var row = node!;
            var paths = new List<string> { row["path"]!.GetValue<string>() };
            var sizes = row["generatedSizes"]!.GetValue<string>();
            try
            {
                using var document = JsonDocument.Parse(string.IsNullOrWhiteSpace(sizes) ? "[]" : sizes);
                foreach (var size in document.RootElement.EnumerateArray())
                {
                    if (size.TryGetProperty("path", out var path) && path.GetString() is { } value)
                        paths.Add(value);
                }
            }
            catch (Exception exception) when (exception is JsonException or InvalidOperationException)
            {
                badPaths.Add("(generatedSizes is not a list of sizes)");
            }

            foreach (var path in paths)
            {
                var name = path.StartsWith("/media/", StringComparison.Ordinal) ? path["/media/".Length..] : null;
                if (name is null || !SafeFileName(name))
                    badPaths.Add(path);
                else
                    names.Add(name);
            }
        }

        return names.ToList();
    }

    private static bool SafeFileName(string name) =>
        name.Length is > 0 and <= 200
        && name.All(ch => char.IsAsciiLetterOrDigit(ch) || ch is '-' or '_' or '.')
        && !name.StartsWith('.')
        && !name.Contains("..", StringComparison.Ordinal);

    internal static string Sha256(string text) => Sha256(Encoding.UTF8.GetBytes(text));

    internal static string Sha256(byte[] data) => Convert.ToHexStringLower(SHA256.HashData(data));
}

sealed record ExportResult(string? Error, string Migration, IReadOnlyDictionary<string, int> Counts, int Files, long FileBytes)
{
    public static ExportResult Refused(string error) => new(error, "", new Dictionary<string, int>(), 0, 0);
}

sealed record ImportOptions(bool DryRun, bool Force)
{
    public BundleLimits Limits { get; init; } = BundleLimits.Default;
}

/// <summary>
/// What a bundle may hold. Each media file at most the API's own upload limit
/// (ImagePipeline.MaxBytes); content.json at most 256 MiB (the Parity content is 0.2 MB);
/// at most 2 GiB in total and 20,000 entries (Parity: 3 MB, 109 entries); and no entry
/// that expands more than 100 times (WebP barely compresses; content.json about 5 times).
/// Checked on what each entry declares and on the bytes actually read.
/// </summary>
sealed record BundleLimits(long MaxFileBytes, long MaxContentBytes, long MaxTotalBytes, int MaxEntries, double MaxRatio)
{
    public static readonly BundleLimits Default = new(ImagePipeline.MaxBytes, 256L * 1024 * 1024, 2L * 1024 * 1024 * 1024, 20_000, 100);
}

sealed record TableCount(int Created, int Updated, int Unchanged);

sealed record ImportResult(bool Ok, IReadOnlyList<string> Problems, IReadOnlyDictionary<string, TableCount> Plan, IReadOnlyList<string> Conflicts, bool DryRun, int NewFiles, int ExistingFiles)
{
    /// <summary>Reported, not refused: media rows that an editor would have to fix before saving them again.</summary>
    public IReadOnlyList<string> Warnings { get; init; } = [];

    public static ImportResult Refused(string problem) => new(false, [problem], new Dictionary<string, TableCount>(), [], false, 0, 0);

    public static ImportResult Failed(List<string> problems, Dictionary<string, TableCount> plan, List<string> conflicts, bool dryRun) =>
        new(false, problems, plan, conflicts, dryRun, 0, 0);
}

interface ITable
{
    string Name { get; }

    Type Type { get; }

    /// <summary>The Studio collection whose save checks apply to this table's rows, if any.</summary>
    string? Collection { get; }

    Task<JsonArray> ExportAsync(ContentDbContext db, CancellationToken cancellationToken);

    string? ShapeError(ContentDbContext db, JsonArray rows);

    Task<TableCount> ImportAsync(ContentDbContext db, JsonArray rows, Dictionary<Guid, bool> owners, List<string> conflicts, List<string> problems, CancellationToken cancellationToken);

    Task<JsonArray> ReadBackAsync(ContentDbContext db, JsonArray rows, CancellationToken cancellationToken);

    Task<DateTime?> UpdatedAtAsync(ContentDbContext db, Guid id, CancellationToken cancellationToken);

    Task<ContentRecord> FindRecordAsync(ContentDbContext db, Guid id, CancellationToken cancellationToken);
}

/// <summary>
/// One table, read and written through the EF model, so every mapped column moves
/// and a column added by a later migration moves too. The columns in `exclude`
/// record a user id and never travel.
/// </summary>
sealed class Table<T>(string name, Func<ContentDbContext, DbSet<T>> set, string[]? exclude = null, string? collection = null, bool singleton = false) : ITable
    where T : class, new()
{
    private readonly HashSet<string> _exclude = new(exclude ?? [], StringComparer.Ordinal);

    public string Name => name;

    public Type Type => typeof(T);

    public string? Collection => collection;

    private List<(string Key, System.Reflection.PropertyInfo Property)> Columns(ContentDbContext db) =>
        db.Model.FindEntityType(typeof(T))!.GetProperties()
            .Where(property => property.PropertyInfo is not null && !_exclude.Contains(property.Name))
            .Select(property => (JsonNamingPolicy.CamelCase.ConvertName(property.Name), property.PropertyInfo!))
            .OrderBy(column => column.Item1, StringComparer.Ordinal)
            .ToList();

    private JsonObject ToJson(ContentDbContext db, T row)
    {
        var json = new JsonObject();
        foreach (var (key, property) in Columns(db))
            json[key] = JsonSerializer.SerializeToNode(property.GetValue(row), property.PropertyType, ContentBundle.Json);
        return json;
    }

    private static Guid IdOf(JsonNode row) => row["id"]!.GetValue<Guid>();

    public async Task<JsonArray> ExportAsync(ContentDbContext db, CancellationToken cancellationToken)
    {
        var rows = await set(db).AsNoTracking().ToListAsync(cancellationToken);
        var array = new JsonArray();
        foreach (var row in rows.Select(row => ToJson(db, row)).OrderBy(row => IdOf(row).ToString("D"), StringComparer.Ordinal))
            array.Add(row);
        return array;
    }

    public string? ShapeError(ContentDbContext db, JsonArray rows)
    {
        if (singleton && rows.Count > 1)
            return $"{name}: a bundle holds at most one settings row.";
        var expected = Columns(db).Select(column => column.Key).ToHashSet(StringComparer.Ordinal);
        foreach (var row in rows)
        {
            if (row is not JsonObject obj || obj["id"] is not JsonValue idValue || !idValue.TryGetValue<string>(out var idText) || !Guid.TryParse(idText, out _))
                return $"{name}: a row is not an object with an id.";
            var keys = obj.Select(pair => pair.Key).ToHashSet(StringComparer.Ordinal);
            var unknown = keys.Except(expected).ToList();
            var missing = expected.Except(keys).ToList();
            if (unknown.Count > 0 || missing.Count > 0)
            {
                return $"{name} {obj["id"]}: the row does not match this tool's columns"
                    + (unknown.Count > 0 ? "; unknown: " + string.Join(", ", unknown) : "")
                    + (missing.Count > 0 ? "; missing: " + string.Join(", ", missing) : "") + ".";
            }

            // Every value must convert to its column's type before anything is written.
            foreach (var (key, property) in Columns(db))
            {
                try
                {
                    var value = obj[key].Deserialize(property.PropertyType, ContentBundle.Json);
                    if (value is null && property.PropertyType.IsValueType && Nullable.GetUnderlyingType(property.PropertyType) is null)
                        return $"{name} {obj["id"]}: {key}: a value is required.";
                }
                catch (Exception exception) when (exception is JsonException or InvalidOperationException or FormatException or OverflowException or NotSupportedException)
                {
                    return $"{name} {obj["id"]}: {key}: the value is not a valid {Nullable.GetUnderlyingType(property.PropertyType)?.Name ?? property.PropertyType.Name}.";
                }
            }
        }

        return null;
    }

    public async Task<TableCount> ImportAsync(ContentDbContext db, JsonArray rows, Dictionary<Guid, bool> owners, List<string> conflicts, List<string> problems, CancellationToken cancellationToken)
    {
        int created = 0, updated = 0, unchanged = 0;
        var columns = Columns(db);
        var timestamp = columns.FirstOrDefault(column => column.Key is "updatedAt" or "savedAt");
        foreach (var node in rows)
        {
            var incoming = node!.AsObject();
            var id = IdOf(incoming);
            T? existing = singleton
                ? await set(db).FirstOrDefaultAsync(cancellationToken)
                : await set(db).FindAsync([id], cancellationToken);

            if (existing is null)
            {
                var clash = await SlugClashAsync(db, incoming, id, cancellationToken);
                if (clash is not null)
                {
                    problems.Add(clash);
                    continue;
                }

                var row = new T();
                Assign(columns, row, incoming, keepId: false);
                set(db).Add(row);
                created++;
                continue;
            }

            var current = ToJson(db, existing);
            if (singleton)
                current["id"] = incoming["id"]!.DeepClone();
            if (JsonNode.DeepEquals(current, incoming))
            {
                unchanged++;
                continue;
            }

            var older = Older(db, existing, incoming, owners, timestamp);
            if (older is not null)
                conflicts.Add(older);
            var slugClash = await SlugClashAsync(db, incoming, id, cancellationToken);
            if (slugClash is not null)
            {
                problems.Add(slugClash);
                continue;
            }

            Assign(columns, existing, incoming, keepId: true);
            updated++;
        }

        return new TableCount(created, updated, unchanged);
    }

    /// <summary>Why the target's row must not be overwritten without --force, or null when the bundle's copy is not older.</summary>
    private string? Older(ContentDbContext db, T existing, JsonObject incoming, Dictionary<Guid, bool> owners, (string Key, System.Reflection.PropertyInfo Property) timestamp)
    {
        var id = IdOf(incoming);
        if (timestamp.Property is not null)
        {
            var target = (DateTime)timestamp.Property.GetValue(existing)!;
            var bundle = incoming[timestamp.Key]!.Deserialize<DateTime>(ContentBundle.Json);
            return target > bundle
                ? $"{name} {id}: edited on the target at {target:yyyy-MM-dd HH:mm:ss}, after the bundle's {bundle:yyyy-MM-dd HH:mm:ss}."
                : null;
        }

        if (existing is Section section)
        {
            var owner = section.PageId ?? section.ServiceId ?? section.PartnerId ?? section.CaseStudyId;
            if (owner is { } ownerId && owners.TryGetValue(ownerId, out var allowed))
                return allowed ? null : $"{name} {id}: its item was edited on the target after the bundle was made.";
        }

        return $"{name} {id}: differs on the target, and has no edit time to show which is newer.";
    }

    private async Task<string?> SlugClashAsync(ContentDbContext db, JsonObject incoming, Guid id, CancellationToken cancellationToken)
    {
        if (collection is null)
            return null;
        var slug = incoming["slug"]!.GetValue<string>();
        var other = await db.Set<T>().AsNoTracking()
            .Where(row => EF.Property<string>(row, "Slug") == slug && EF.Property<Guid>(row, "Id") != id)
            .Select(row => EF.Property<Guid>(row, "Id"))
            .FirstOrDefaultAsync(cancellationToken);
        return other == Guid.Empty ? null : $"{name} {id}: slug '{slug}' is used on the target by another item ({other}).";
    }

    private static void Assign(List<(string Key, System.Reflection.PropertyInfo Property)> columns, T row, JsonObject incoming, bool keepId)
    {
        foreach (var (key, property) in columns)
        {
            if (keepId && key == "id")
                continue;
            property.SetValue(row, incoming[key].Deserialize(property.PropertyType, ContentBundle.Json));
        }
    }

    public async Task<JsonArray> ReadBackAsync(ContentDbContext db, JsonArray rows, CancellationToken cancellationToken)
    {
        var ids = rows.Select(row => IdOf(row!)).ToList();
        List<T> stored;
        if (singleton)
        {
            stored = rows.Count == 0 ? [] : await set(db).AsNoTracking().Take(1).ToListAsync(cancellationToken);
        }
        else
        {
            stored = await set(db).AsNoTracking()
                .Where(row => ids.Contains(EF.Property<Guid>(row, "Id")))
                .ToListAsync(cancellationToken);
        }

        var array = new JsonArray();
        foreach (var json in stored.Select(row => ToJson(db, row)).OrderBy(row => IdOf(row).ToString("D"), StringComparer.Ordinal))
        {
            if (singleton)
                json["id"] = rows[0]!["id"]!.DeepClone();
            array.Add(json);
        }

        return array;
    }

    public async Task<DateTime?> UpdatedAtAsync(ContentDbContext db, Guid id, CancellationToken cancellationToken) =>
        await db.Set<T>().AsNoTracking()
            .Where(row => EF.Property<Guid>(row, "Id") == id)
            .Select(row => (DateTime?)EF.Property<DateTime>(row, "UpdatedAt"))
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<ContentRecord> FindRecordAsync(ContentDbContext db, Guid id, CancellationToken cancellationToken) =>
        (ContentRecord)(object)(await set(db).AsNoTracking().FirstAsync(row => EF.Property<Guid>(row, "Id") == id, cancellationToken));
}
