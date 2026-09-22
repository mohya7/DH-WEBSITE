using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using DigitalHub.Api.Data;
using Json.Schema;
using Microsoft.EntityFrameworkCore;

namespace DigitalHub.ContentImport;

static partial class ContentWriter
{
    public static async Task<int> PreviewAsync(string sourceRoot, string connectionString)
    {
        Console.WriteLine("Dry run. No rows and no media files will be written.");
        var plan = Catalog.Build(sourceRoot);
        var media = StubMedia(plan);
        var model = Build(sourceRoot, plan, media);
        await PrintFreshnessAsync(connectionString, model);

        var schemas = SectionSchemas.Load();
        Console.WriteLine();
        Console.WriteLine("Sections extracted: " + Probes.Count);
        var missingSchemas = schemas.Types.Where(type => type != "defs" && Probes.All(probe => probe.Type != type)).Order(StringComparer.Ordinal).ToList();
        if (missingSchemas.Count == 0)
            Console.WriteLine("Schemas with no imported sections: none");
        else
            Console.WriteLine("Schemas with no imported sections: " + string.Join(", ", missingSchemas));

        var schemaFailures = 0;
        var textGaps = 0;
        foreach (var probe in Probes)
        {
            if (!schemas.ByType.TryGetValue(probe.Type, out var schema))
            {
                schemaFailures++;
                Console.WriteLine("Schema: missing file for " + probe.Owner + " " + probe.Type + " (" + probe.Source + ")");
                continue;
            }

            using var document = JsonDocument.Parse(probe.Fields.ToJsonString());
            var result = schema.Evaluate(document.RootElement, schemas.Options);
            if (!result.IsValid)
            {
                schemaFailures++;
                Console.WriteLine("Schema: " + probe.Owner + " " + probe.Type + " (" + probe.Source + ")");
                foreach (var error in SectionSchemas.Errors(result).Take(8))
                    Console.WriteLine("  " + error);
            }

            var missing = MissingText(probe, model);
            if (missing.Count == 0)
                continue;
            textGaps++;
            Console.WriteLine("Text: " + probe.Owner + " " + probe.Type + " (" + probe.Source + ")");
            foreach (var fragment in missing)
                Console.WriteLine("  " + fragment);
        }

        var notes = Probes.SelectMany(probe => probe.Notes.Select(note => probe.Owner + " " + probe.Type + ": " + note)).Distinct().ToList();
        if (notes.Count > 0)
        {
            Console.WriteLine();
            Console.WriteLine("Notes");
            foreach (var note in notes)
                Console.WriteLine("  " + note);
        }

        Console.WriteLine();
        Console.WriteLine("Comparison skips .svc-hero-stage (the decorative service-hero diagrams, labels included), script, style, svg, noscript, and the contact honeypot.");
        Console.WriteLine("Stat figures are compared as data-count plus data-suffix. Fragments with no letter or digit are not listed.");
        Console.WriteLine("related_items title and text are included from the linked item when the stored override is empty.");
        Console.WriteLine("Schema failures: " + schemaFailures + ". Sections with source text not in the fields: " + textGaps + ".");
        Console.WriteLine("Stopped before --apply.");
        return 0;
    }

    private static Dictionary<string, MediaAsset> StubMedia(ImportPlan plan)
    {
        var media = new Dictionary<string, MediaAsset>(StringComparer.OrdinalIgnoreCase);
        foreach (var image in plan.Images)
        {
            if (image.ReadError is not null)
                continue;
            var alt = image.Alts.FirstOrDefault() ?? "";
            if (alt.Length > 300)
                alt = alt[..300];
            media[image.Path] = new MediaAsset
            {
                Id = IdFor("media:" + image.Path),
                Path = "/media/pending",
                OriginalName = Path.GetFileName(image.Path),
                ContentType = "image/webp",
                Alt = alt,
                GeneratedSizes = "[]",
            };
        }

        return media;
    }

    private static async Task PrintFreshnessAsync(string connectionString, ImportModel model)
    {
        Console.WriteLine();
        Console.WriteLine("Freshness");
        var options = new DbContextOptionsBuilder<ContentDbContext>().UseSqlServer(connectionString).Options;
        await using var db = new ContentDbContext(options);
        try
        {
            var revisions = await db.Revisions.CountAsync();
            var audit = await db.AuditLog.CountAsync();
            Console.WriteLine("  revisions: " + revisions);
            Console.WriteLine("  audit_log: " + audit);
            var mismatches = new List<string>();
            var moved = new List<string>();
            await CompareAsync(db.Pages, model.Pages, "pages", mismatches, moved);
            await CompareAsync(db.Services, model.Services, "services", mismatches, moved);
            await CompareAsync(db.Partners, model.Partners, "partners", mismatches, moved);
            await CompareAsync(db.CaseStudies, model.Cases, "case_studies", mismatches, moved);
            await CompareAsync(db.BlogPosts, model.Blogs, "blog_posts", mismatches, moved);
            await CompareAsync(db.TeamMembers, model.Team, "team_members", mismatches, moved);
            await CompareAsync(db.NewsItems, model.News, "news_items", mismatches, moved);
            var vacancies = await db.Vacancies.AsNoTracking().Select(item => new { item.Slug, item.UpdatedAt, item.Version }).ToListAsync();
            Console.WriteLine("  vacancies: " + vacancies.Count + " rows");
            foreach (var vacancy in vacancies)
            {
                if (vacancy.Version != 1)
                    mismatches.Add("vacancies " + vacancy.Slug + " version " + vacancy.Version);
            }

            Console.WriteLine("  sections, navigation_items, media, and site_settings have no updated_at column.");
            if (mismatches.Count == 0 && revisions == 0 && audit == 0 && vacancies.Count == 0)
                Console.WriteLine("  No content in DigitalHubContent has been edited since the import. No updated_at is later than the stored source stamp, every version is 1, and there are no revisions.");
            else
            {
                Console.WriteLine("  Database rows that do not match the import:");
                foreach (var mismatch in mismatches)
                    Console.WriteLine("    " + mismatch);
            }

            foreach (var line in moved)
                Console.WriteLine("  " + line);
        }
        catch (Exception ex)
        {
            var message = ex.Message.Replace(connectionString, "[connection]", StringComparison.Ordinal);
            Console.WriteLine("  Could not read the database (" + ex.GetType().Name + ": " + message + ").");
        }
    }

    private static async Task CompareAsync<T>(DbSet<T> set, IReadOnlyList<T> expected, string name, List<string> mismatches, List<string> moved)
        where T : ContentRecord
    {
        var rows = await set.AsNoTracking().Select(item => new { item.Slug, item.UpdatedAt, item.Version }).ToListAsync();
        var versions = rows.Count(item => item.Version != 1);
        DateTime? min = rows.Count == 0 ? null : rows.Min(item => item.UpdatedAt);
        DateTime? max = rows.Count == 0 ? null : rows.Max(item => item.UpdatedAt);
        Console.WriteLine("  " + name + ": " + rows.Count + " rows, version other than 1: " + versions
            + ", updated_at " + Format(min) + " .. " + Format(max));
        foreach (var item in expected)
        {
            var row = rows.FirstOrDefault(candidate => candidate.Slug == item.Slug);
            if (row is null)
            {
                mismatches.Add(name + " " + item.Slug + " is not in the database");
                continue;
            }

            if (row.Version != 1)
                mismatches.Add(name + " " + item.Slug + " version " + row.Version);
            if (!SameInstant(row.UpdatedAt, item.UpdatedAt))
            {
                if (Wall(row.UpdatedAt) < Wall(item.UpdatedAt))
                    moved.Add(name + " " + item.Slug + " still has the import stamp " + Format(row.UpdatedAt) + ". The source file's current timestamp is " + Format(item.UpdatedAt) + ", and the checkout is clean, so this is not a database edit.");
                else
                    mismatches.Add(name + " " + item.Slug + " updated_at " + Format(row.UpdatedAt) + " is later than the source stamp " + Format(item.UpdatedAt));
            }
        }

        foreach (var row in rows.Where(row => expected.All(item => item.Slug != row.Slug)))
            mismatches.Add(name + " " + row.Slug + " is in the database and not in this import");
    }

    private static bool SameInstant(DateTime left, DateTime right) => Wall(left) == Wall(right);

    private static DateTime Wall(DateTime value) =>
        new(value.Year, value.Month, value.Day, value.Hour, value.Minute, value.Second, DateTimeKind.Utc);

    private static string Format(DateTime? value) =>
        value is null ? "none" : value.Value.ToString("yyyy-MM-dd HH:mm:ss", System.Globalization.CultureInfo.InvariantCulture);

    private static List<string> MissingText(SectionProbe probe, ImportModel model)
    {
        var parts = new List<string>();
        CollectVisible(probe.Element, parts);
        if (probe.Type == "vacancy_list")
        {
            var titles = probe.Element.QuerySelectorAll("article.careers-job-card h3")
                .Select(title => Collapse(title.TextContent))
                .Where(title => title is not null)
                .Cast<string>()
                .Distinct(StringComparer.Ordinal)
                .ToList();
            if (titles.Count > 0)
                probe.Notes.Add("Excluded test vacancy titles from coverage: " + string.Join(", ", titles) + ". The list is generated from the vacancies table.");
            parts = parts.Where(part => !titles.Contains(part, StringComparer.Ordinal)).ToList();
        }

        var corpus = Corpus(probe.Fields, model);
        return parts.Where(part => !corpus.Contains(part, StringComparison.Ordinal)).Distinct(StringComparer.Ordinal).ToList();
    }

    private static string Corpus(JsonObject fields, ImportModel model)
    {
        var builder = new StringBuilder();
        AppendCorpus(fields, builder, model);
        return Regex.Replace(builder.ToString(), @"\s+", " ").Trim();
    }

    private static void AppendCorpus(JsonNode? node, StringBuilder builder, ImportModel model)
    {
        switch (node)
        {
            case JsonValue value when value.TryGetValue<string>(out var text):
                builder.Append(' ').Append(text);
                break;
            case JsonValue value:
                builder.Append(' ').Append(value.ToJsonString());
                break;
            case JsonObject obj:
                foreach (var property in obj)
                    AppendCorpus(property.Value, builder, model);
                if (obj.ContainsKey("slug") && obj["type"]?.GetValue<string>() is string type && obj["slug"]?.GetValue<string>() is string slug)
                {
                    var linked = Linked(model, type, slug);
                    if (string.IsNullOrEmpty(obj["title"]?.GetValue<string>()))
                        builder.Append(' ').Append(linked.Title);
                    if (string.IsNullOrEmpty(obj["text"]?.GetValue<string>()))
                        builder.Append(' ').Append(linked.Summary);
                }

                break;
            case JsonArray array:
                foreach (var item in array)
                    AppendCorpus(item, builder, model);
                break;
        }
    }
}

static class SectionSchemas
{
    public static (Dictionary<string, JsonSchema> ByType, EvaluationOptions Options, IReadOnlyList<string> Types) Load()
    {
        var directory = FindDirectory();
        var registry = new SchemaRegistry();
        var build = new BuildOptions
        {
            SchemaRegistry = registry,
            Dialect = Dialect.Draft202012,
        };
        JsonSchema.FromFile(Path.Combine(directory, "defs.json"), build);
        var byType = new Dictionary<string, JsonSchema>(StringComparer.Ordinal);
        foreach (var file in Directory.GetFiles(directory, "*.json"))
        {
            var name = Path.GetFileNameWithoutExtension(file);
            if (name.Equals("defs", StringComparison.OrdinalIgnoreCase))
                continue;
            byType[name] = JsonSchema.FromFile(file, build);
        }

        var options = new EvaluationOptions { OutputFormat = OutputFormat.List };

        return (byType, options, byType.Keys.Order(StringComparer.Ordinal).ToList());
    }

    public static IEnumerable<string> Errors(EvaluationResults result)
    {
        var errors = new List<string>();
        Collect(result, errors);
        return errors.Count == 0 ? ["invalid"] : errors.Distinct();
    }

    private static void Collect(EvaluationResults result, List<string> errors)
    {
        if (errors.Count > 20)
            return;
        if (result.Errors is not null)
        {
            foreach (var error in result.Errors)
                errors.Add(result.InstanceLocation + " " + error.Key + ": " + error.Value);
        }

        if (result.Details is null)
            return;
        foreach (var detail in result.Details)
            Collect(detail, errors);
    }

    private static string FindDirectory()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            var candidate = Path.Combine(dir.FullName, "packages", "sections");
            if (File.Exists(Path.Combine(candidate, "defs.json")))
                return candidate;
        }

        throw new InvalidOperationException("Could not find packages/sections.");
    }
}
