using System.Text.Json;
using DigitalHub.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace DigitalHub.Api.Content;

public static class PublishChecks
{
    private static readonly Dictionary<string, string> ReferenceCollections = new(StringComparer.Ordinal)
    {
        ["service"] = "services",
        ["partner"] = "partners",
        ["case_study"] = "case-studies",
        ["blog_post"] = "blog-posts",
        ["page"] = "pages",
        ["vacancy"] = "vacancies",
    };

    public static async Task AddAsync(
        ContentDbContext db,
        string collection,
        Guid id,
        DraftDocument draft,
        Dictionary<string, List<string>> errors,
        Dictionary<string, List<string>> warnings,
        CancellationToken cancellationToken)
    {
        if (ContentPaths.PublicPath(collection, draft.Slug) is not null)
            AddDescription(draft, errors);
        await AddImagesAsync(db, draft, errors, cancellationToken);
        await AddLinksAndReferencesAsync(db, collection, id, draft, errors, warnings, cancellationToken);
    }

    public static string? EffectiveDescription(DraftDocument draft)
    {
        string? summary = null;
        if (draft.Fields.TryGetValue("summary", out var value) && value.ValueKind == JsonValueKind.String)
            summary = value.GetString();
        return First(draft.MetaDescription, summary);
    }

    private static void AddDescription(DraftDocument draft, Dictionary<string, List<string>> errors)
    {
        if (string.IsNullOrWhiteSpace(EffectiveDescription(draft)))
            Add(errors, "metaDescription", "Add a meta description. It falls back to the summary when the item has one.");
    }

    private static async Task AddImagesAsync(
        ContentDbContext db,
        DraftDocument draft,
        Dictionary<string, List<string>> errors,
        CancellationToken cancellationToken)
    {
        var json = JsonSerializer.Serialize(draft, ContentJson.Options);
        var ids = MediaUsage.ReferencedIds(json).ToList();
        Guid? imageId = null;
        if (draft.Fields.TryGetValue("imageId", out var image) && image.ValueKind == JsonValueKind.String && Guid.TryParse(image.GetString(), out var parsed))
        {
            imageId = parsed;
            ids.Add(parsed);
        }

        if (draft.ShareImageId is Guid share)
            ids.Add(share);

        var distinct = ids.Distinct().ToList();
        var assets = distinct.Count == 0
            ? new Dictionary<Guid, MediaAsset>()
            : await db.Media.AsNoTracking()
                .Where(asset => distinct.Contains(asset.Id))
                .ToDictionaryAsync(asset => asset.Id, cancellationToken);

        if (draft.ShareImageId is Guid shareId && assets.TryGetValue(shareId, out var shareAsset) && EffectiveAlt(draft.ShareImageAltOverride, shareAsset.Alt) is null)
            Add(errors, "shareImage", "Add alt text for the share image.");

        if (imageId is Guid fieldId && assets.TryGetValue(fieldId, out var fieldAsset))
        {
            string? over = null;
            if (draft.Fields.TryGetValue("imageAltOverride", out var alt) && alt.ValueKind == JsonValueKind.String)
                over = alt.GetString();
            if (EffectiveAlt(over, fieldAsset.Alt) is null)
                Add(errors, "image", "Add alt text for the image.");
        }

        using var document = JsonDocument.Parse(json);
        WalkMedia(document.RootElement, "content", assets, errors);
    }

    private static async Task AddLinksAndReferencesAsync(
        ContentDbContext db,
        string collection,
        Guid id,
        DraftDocument draft,
        Dictionary<string, List<string>> errors,
        Dictionary<string, List<string>> warnings,
        CancellationToken cancellationToken)
    {
        var paths = await PublicPathsAsync(db, collection, id, draft.Slug, cancellationToken);
        var ids = await IdsAsync(db, cancellationToken);
        if (ReferenceCollections.ContainsValue(collection))
            ids[collection][id] = ContentStatus.Published;

        var json = JsonSerializer.Serialize(draft, ContentJson.Options);
        using var document = JsonDocument.Parse(json);
        WalkLinks(document.RootElement, paths, ids, errors, warnings);
    }

    private static async Task<Dictionary<string, ContentStatus>> PublicPathsAsync(
        ContentDbContext db,
        string publishingCollection,
        Guid publishingId,
        string publishingSlug,
        CancellationToken cancellationToken)
    {
        var paths = new Dictionary<string, ContentStatus>(StringComparer.Ordinal);
        await Add("pages", db.Pages.AsNoTracking().Select(item => new ItemRef(item.Id, item.Slug, item.Status)));
        await Add("services", db.Services.AsNoTracking().Select(item => new ItemRef(item.Id, item.Slug, item.Status)));
        await Add("partners", db.Partners.AsNoTracking().Select(item => new ItemRef(item.Id, item.Slug, item.Status)));
        await Add("case-studies", db.CaseStudies.AsNoTracking().Select(item => new ItemRef(item.Id, item.Slug, item.Status)));
        await Add("blog-posts", db.BlogPosts.AsNoTracking().Select(item => new ItemRef(item.Id, item.Slug, item.Status)));
        await Add("vacancies", db.Vacancies.AsNoTracking().Select(item => new ItemRef(item.Id, item.Slug, item.Status)));
        return paths;

        async Task Add(string itemCollection, IQueryable<ItemRef> query)
        {
            var rows = await query.ToListAsync(cancellationToken);
            foreach (var row in rows)
            {
                var publishing = itemCollection == publishingCollection && row.Id == publishingId;
                var slug = publishing ? publishingSlug : row.Slug;
                var path = ContentPaths.PublicPath(itemCollection, slug);
                if (path is null)
                    continue;
                var status = publishing ? ContentStatus.Published : row.Status;
                if (!paths.TryGetValue(path, out var current) || current != ContentStatus.Published)
                    paths[path] = status;
            }
        }
    }

    private static async Task<Dictionary<string, Dictionary<Guid, ContentStatus>>> IdsAsync(ContentDbContext db, CancellationToken cancellationToken)
    {
        return new Dictionary<string, Dictionary<Guid, ContentStatus>>(StringComparer.Ordinal)
        {
            ["services"] = await Set(db.Services.AsNoTracking().Select(item => new IdStatus(item.Id, item.Status))),
            ["partners"] = await Set(db.Partners.AsNoTracking().Select(item => new IdStatus(item.Id, item.Status))),
            ["case-studies"] = await Set(db.CaseStudies.AsNoTracking().Select(item => new IdStatus(item.Id, item.Status))),
            ["blog-posts"] = await Set(db.BlogPosts.AsNoTracking().Select(item => new IdStatus(item.Id, item.Status))),
            ["pages"] = await Set(db.Pages.AsNoTracking().Select(item => new IdStatus(item.Id, item.Status))),
            ["vacancies"] = await Set(db.Vacancies.AsNoTracking().Select(item => new IdStatus(item.Id, item.Status))),
        };

        async Task<Dictionary<Guid, ContentStatus>> Set(IQueryable<IdStatus> query)
        {
            var rows = await query.ToListAsync(cancellationToken);
            return rows.ToDictionary(row => row.Id, row => row.Status);
        }
    }

    private static void WalkMedia(JsonElement element, string path, Dictionary<Guid, MediaAsset> assets, Dictionary<string, List<string>> errors)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                if (element.TryGetProperty("mediaId", out var mediaId)
                    && mediaId.ValueKind == JsonValueKind.String
                    && Guid.TryParse(mediaId.GetString(), out var id)
                    && assets.TryGetValue(id, out var asset))
                {
                    var decorative = element.TryGetProperty("decorative", out var flag) && flag.ValueKind == JsonValueKind.True;
                    var alt = element.TryGetProperty("alt", out var altValue) && altValue.ValueKind == JsonValueKind.String
                        ? altValue.GetString()
                        : null;
                    if (!decorative && EffectiveAlt(alt, asset.Alt) is null)
                        Add(errors, path, "Add alt text or mark this image as decorative.");
                }

                foreach (var property in element.EnumerateObject())
                    WalkMedia(property.Value, path + "." + property.Name, assets, errors);
                break;
            case JsonValueKind.Array:
                var index = 0;
                foreach (var item in element.EnumerateArray())
                {
                    WalkMedia(item, path + "[" + index + "]", assets, errors);
                    index++;
                }

                break;
            case JsonValueKind.String:
                if (TryParse(element.GetString(), out var nested))
                {
                    using (nested)
                        WalkMedia(nested.RootElement, path, assets, errors);
                }

                break;
        }
    }

    private static void WalkLinks(
        JsonElement element,
        Dictionary<string, ContentStatus> paths,
        Dictionary<string, Dictionary<Guid, ContentStatus>> ids,
        Dictionary<string, List<string>> errors,
        Dictionary<string, List<string>> warnings)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                if (element.TryGetProperty("href", out var href) && href.ValueKind == JsonValueKind.String && InternalPath(href.GetString(), out var path))
                {
                    if (!paths.TryGetValue(path, out var status))
                        Add(errors, "links", "No page exists at " + path + ".");
                    else if (status != ContentStatus.Published)
                        Add(warnings, "links", path + " is not published, so it will not show.");
                }

                if (element.TryGetProperty("type", out var type)
                    && type.ValueKind == JsonValueKind.String
                    && element.TryGetProperty("id", out var referencedId)
                    && referencedId.ValueKind == JsonValueKind.String
                    && Guid.TryParse(referencedId.GetString(), out var target)
                    && ReferenceCollections.TryGetValue(type.GetString() ?? "", out var referenced))
                {
                    var name = type.GetString() ?? "";
                    var label = target.ToString("D");
                    if (!ids[referenced].TryGetValue(target, out var status))
                        Add(errors, "references", name + " " + label + " does not exist.");
                    else if (status != ContentStatus.Published)
                        Add(warnings, "references", name + " " + label + " is not published, so it will not show.");
                }

                foreach (var property in element.EnumerateObject())
                    WalkLinks(property.Value, paths, ids, errors, warnings);
                break;
            case JsonValueKind.Array:
                foreach (var item in element.EnumerateArray())
                    WalkLinks(item, paths, ids, errors, warnings);
                break;
            case JsonValueKind.String:
                if (TryParse(element.GetString(), out var nested))
                {
                    using (nested)
                        WalkLinks(nested.RootElement, paths, ids, errors, warnings);
                }

                break;
        }
    }

    private static bool TryParse(string? json, out JsonDocument document)
    {
        document = null!;
        if (string.IsNullOrWhiteSpace(json))
            return false;
        var text = json.Trim();
        if (text.Length < 2 || text[0] is not ('{' or '['))
            return false;
        try
        {
            document = JsonDocument.Parse(text);
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static bool InternalPath(string? href, out string path)
    {
        path = "";
        if (string.IsNullOrWhiteSpace(href))
            return false;
        var raw = href.Trim();
        if (raw.StartsWith('#')
            || raw.StartsWith("//", StringComparison.Ordinal)
            || raw.StartsWith("mailto:", StringComparison.OrdinalIgnoreCase)
            || raw.StartsWith("tel:", StringComparison.OrdinalIgnoreCase)
            || raw.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            || raw.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (!raw.StartsWith('/'))
            return false;

        var cut = raw.Split('?', '#')[0];
        if (cut.Length > 1)
            cut = cut.TrimEnd('/');
        path = cut.Length == 0 ? "/" : cut;
        return true;
    }

    private static string? EffectiveAlt(string? usageAlt, string? assetAlt) => First(usageAlt, assetAlt);

    private static string? First(string? primary, string? fallback)
    {
        if (!string.IsNullOrWhiteSpace(primary))
            return primary.Trim();
        if (!string.IsNullOrWhiteSpace(fallback))
            return fallback.Trim();
        return null;
    }

    private static void Add(Dictionary<string, List<string>> errors, string key, string message)
    {
        if (!errors.TryGetValue(key, out var list))
        {
            list = [];
            errors[key] = list;
        }

        if (!list.Contains(message))
            list.Add(message);
    }

    private sealed record ItemRef(Guid Id, string Slug, ContentStatus Status);

    private sealed record IdStatus(Guid Id, ContentStatus Status);
}
