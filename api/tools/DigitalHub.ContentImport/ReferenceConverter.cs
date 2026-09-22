using System.Text;
using System.Text.Json.Nodes;
using DigitalHub.Api.Content;
using DigitalHub.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace DigitalHub.ContentImport;

static class ReferenceConverter
{
    public static async Task<int> ApplyAsync(string connectionString)
    {
        if (connectionString.Contains("DigitalHubContent_Test", StringComparison.OrdinalIgnoreCase)
            || !connectionString.Contains("Database=DigitalHubContent", StringComparison.OrdinalIgnoreCase))
        {
            Console.Error.WriteLine("Refusing to write. The connection must target DigitalHubContent.");
            return 2;
        }

        var options = new DbContextOptionsBuilder<ContentDbContext>().UseSqlServer(connectionString).Options;
        await using var database = new ContentDbContext(options);
        var index = await IndexAsync(database);
        var report = new List<string>();
        var unresolved = new List<string>();
        var converted = 0;

        foreach (var section in await database.Sections.ToListAsync())
        {
            var count = Rewrite(section.Fields, "section " + section.Id.ToString("D") + " " + section.Type, index, report, unresolved, out var updated);
            if (count > 0)
                section.Fields = updated;
            converted += count;
        }

        foreach (var post in await database.BlogPosts.ToListAsync())
        {
            var count = Rewrite(post.Body, "blog " + post.Slug, index, report, unresolved, out var updated);
            if (count > 0)
                post.Body = updated;
            converted += count;
        }

        foreach (var copy in await database.WorkingCopies.ToListAsync())
        {
            var count = Rewrite(copy.Document, "working copy " + copy.Id.ToString("D"), index, report, unresolved, out var updated);
            if (count > 0)
                copy.Document = updated;
            converted += count;
        }

        foreach (var revision in await database.Revisions.ToListAsync())
        {
            var count = Rewrite(revision.Snapshot, "revision " + revision.Id.ToString("D"), index, report, unresolved, out var updated);
            if (count > 0)
                revision.Snapshot = updated;
            converted += count;
        }

        if (unresolved.Count > 0)
        {
            foreach (var item in unresolved)
                Console.Error.WriteLine("Unresolved: " + item);
            Console.Error.WriteLine("Refusing to write. " + unresolved.Count + " reference(s) do not match a stored item.");
            return 1;
        }

        if (converted == 0)
            Console.WriteLine("References converted: 0. Database unchanged.");
        else
        {
            await database.SaveChangesAsync();
            foreach (var line in report)
                Console.WriteLine(line);
            Console.WriteLine("References converted: " + converted + ".");
        }

        return await ConfirmAsync(database, index);
    }

    private static async Task<Dictionary<string, Dictionary<string, Guid>>> IndexAsync(ContentDbContext database)
    {
        var index = new Dictionary<string, Dictionary<string, Guid>>(StringComparer.Ordinal)
        {
            ["service"] = await database.Services.AsNoTracking().ToDictionaryAsync(item => item.Slug, item => item.Id),
            ["partner"] = await database.Partners.AsNoTracking().ToDictionaryAsync(item => item.Slug, item => item.Id),
            ["case_study"] = await database.CaseStudies.AsNoTracking().ToDictionaryAsync(item => item.Slug, item => item.Id),
            ["blog_post"] = await database.BlogPosts.AsNoTracking().ToDictionaryAsync(item => item.Slug, item => item.Id),
            ["page"] = await database.Pages.AsNoTracking().ToDictionaryAsync(item => item.Slug, item => item.Id),
            ["vacancy"] = await database.Vacancies.AsNoTracking().ToDictionaryAsync(item => item.Slug, item => item.Id),
        };
        return index;
    }

    private static int Rewrite(string json, string place, Dictionary<string, Dictionary<string, Guid>> index, List<string> report, List<string> unresolved, out string updated)
    {
        updated = json;
        if (string.IsNullOrWhiteSpace(json))
            return 0;

        JsonNode? node;
        try
        {
            node = JsonNode.Parse(json);
        }
        catch (System.Text.Json.JsonException)
        {
            return 0;
        }

        var count = Walk(node, place, index, report, unresolved);
        if (count > 0 && node is not null)
            updated = node.ToJsonString();
        return count;
    }

    private static int Walk(JsonNode? node, string place, Dictionary<string, Dictionary<string, Guid>> index, List<string> report, List<string> unresolved)
    {
        switch (node)
        {
            case JsonObject obj:
                var count = ConvertObject(obj, place, index, report, unresolved) ? 1 : 0;
                foreach (var name in obj.Select(property => property.Key).ToList())
                {
                    var value = obj[name];
                    if (value is JsonValue && value.GetValueKind() == System.Text.Json.JsonValueKind.String
                        && value.GetValue<string>() is { } text
                        && text.Length > 1
                        && text[0] is '{' or '[')
                    {
                        JsonNode? inner;
                        try
                        {
                            inner = JsonNode.Parse(text);
                        }
                        catch (System.Text.Json.JsonException)
                        {
                            continue;
                        }

                        var innerCount = Walk(inner, place, index, report, unresolved);
                        if (innerCount > 0 && inner is not null)
                        {
                            obj[name] = inner.ToJsonString();
                            count += innerCount;
                        }
                    }
                    else
                    {
                        count += Walk(value, place, index, report, unresolved);
                    }
                }

                return count;
            case JsonArray array:
                var total = 0;
                foreach (var item in array)
                    total += Walk(item, place, index, report, unresolved);
                return total;
            default:
                return 0;
        }
    }

    private static bool ConvertObject(JsonObject obj, string place, Dictionary<string, Dictionary<string, Guid>> index, List<string> report, List<string> unresolved)
    {
        if (obj["type"] is not JsonValue typeValue || !typeValue.TryGetValue<string>(out var type) || !index.ContainsKey(type))
            return false;
        if (obj["slug"] is not JsonValue slugValue || !slugValue.TryGetValue<string>(out var slug))
            return false;
        if (!index[type].TryGetValue(slug, out var id))
        {
            unresolved.Add(place + " " + type + " " + slug);
            return false;
        }

        obj.Remove("slug");
        obj["id"] = id.ToString("D");
        report.Add(place + ": " + type + " " + slug + " -> " + id.ToString("D"));
        return true;
    }

    private static async Task<int> ConfirmAsync(ContentDbContext database, Dictionary<string, Dictionary<string, Guid>> index)
    {
        var references = 0;
        var slugs = 0;
        foreach (var fields in await database.Sections.AsNoTracking().Select(section => section.Fields).ToListAsync())
            Count(JsonNode.Parse(fields), index, ref references, ref slugs);
        var largest = 0;
        string? largestSlug = null;
        foreach (var post in await database.BlogPosts.AsNoTracking().Select(post => new { post.Slug, post.Body }).ToListAsync())
        {
            Count(JsonNode.Parse(post.Body), index, ref references, ref slugs);
            var size = Encoding.UTF8.GetByteCount(post.Body);
            if (size > largest)
            {
                largest = size;
                largestSlug = post.Slug;
            }

            foreach (var error in RichText.Validate(post.Body))
                Console.WriteLine("Blog " + post.Slug + ": " + error);
        }

        foreach (var document in await database.WorkingCopies.AsNoTracking().Select(copy => copy.Document).ToListAsync())
            Count(ParseOrNull(document), index, ref references, ref slugs);
        foreach (var snapshot in await database.Revisions.AsNoTracking().Select(revision => revision.Snapshot).ToListAsync())
            Count(ParseOrNull(snapshot), index, ref references, ref slugs);

        var schemas = new SectionSchemaSet();
        var stored = 0;
        var failures = 0;
        foreach (var section in await database.Sections.AsNoTracking().Select(section => new { section.Id, section.Type, section.Fields }).ToListAsync())
        {
            stored++;
            var errors = schemas.Validate(section.Type, section.Fields);
            if (errors.Count == 0)
                continue;
            failures++;
            Console.WriteLine("Schema failure " + section.Type + " " + section.Id.ToString("D") + ": " + errors[0]);
        }

        Console.WriteLine("Stored references: " + references + ". Still using slug: " + slugs + ".");
        Console.WriteLine("Stored sections: " + stored + ". Schema failures: " + failures + ".");
        Console.WriteLine("Largest article body: " + largestSlug + " " + largest + " UTF-8 bytes.");
        return slugs == 0 && failures == 0 ? 0 : 1;
    }

    private static JsonNode? ParseOrNull(string json)
    {
        try
        {
            return JsonNode.Parse(json);
        }
        catch (System.Text.Json.JsonException)
        {
            return null;
        }
    }

    private static void Count(JsonNode? node, Dictionary<string, Dictionary<string, Guid>> index, ref int references, ref int slugs)
    {
        switch (node)
        {
            case JsonObject obj:
                if (obj["type"] is JsonValue typeValue
                    && typeValue.TryGetValue<string>(out var type)
                    && index.ContainsKey(type)
                    && obj["id"] is JsonValue idValue
                    && idValue.TryGetValue<string>(out var id)
                    && Guid.TryParse(id, out _)
                    && obj["slug"] is null)
                    references++;
                if (obj["slug"] is JsonValue && obj["type"] is JsonValue typed && typed.TryGetValue<string>(out var slugType) && index.ContainsKey(slugType))
                    slugs++;
                foreach (var property in obj)
                {
                    if (property.Value is JsonValue && property.Value.GetValueKind() == System.Text.Json.JsonValueKind.String
                        && property.Value.GetValue<string>() is { } text
                        && text.Length > 1
                        && text[0] is '{' or '[')
                        Count(ParseOrNull(text), index, ref references, ref slugs);
                    else
                        Count(property.Value, index, ref references, ref slugs);
                }

                break;
            case JsonArray array:
                foreach (var item in array)
                    Count(item, index, ref references, ref slugs);
                break;
        }
    }
}
