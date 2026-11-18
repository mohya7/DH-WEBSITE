using System.Text.Json;
using DigitalHub.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace DigitalHub.Api.Content;

/// <summary>
/// Assembles everything a website build needs in one response: published content
/// only, with references already resolved to paths.
///
/// Published means the record's own status. Working copies are never read, so a
/// draft of a published item contributes nothing. Nothing here touches users,
/// audit entries, contact requests, refresh tokens, or configuration.
/// </summary>
public sealed class BuildContentStore(ContentDbContext db)
{
    /// <summary>Collections with a routable public path, in build order.</summary>
    private static readonly string[] Collections =
    [
        "pages", "services", "partners", "case-studies",
        "blog-posts", "vacancies", "team-members", "news-items",
    ];

    /// <summary>Reference type as stored in content, to its collection.</summary>
    private static readonly Dictionary<string, string> ReferenceCollections = new(StringComparer.Ordinal)
    {
        ["page"] = "pages",
        ["service"] = "services",
        ["partner"] = "partners",
        ["case_study"] = "case-studies",
        ["blog_post"] = "blog-posts",
        ["vacancy"] = "vacancies",
    };

    /* The error pages are ordinary page records under reserved slugs. They are
       handed over separately because they are not routable content: the build
       renders them at /404 and /500, not at /error-404. */
    internal static readonly Dictionary<string, string> ErrorSlugs = new(StringComparer.Ordinal)
    {
        ["404"] = "error-404",
        ["500"] = "error-500",
    };

    public async Task<object> BuildAsync(CancellationToken cancellationToken)
    {
        var loaded = new Dictionary<string, List<Item>>(StringComparer.Ordinal);
        foreach (var collection in Collections)
            loaded[collection] = await LoadAsync(collection, cancellationToken);

        /* Every published item that can be linked to, by reference key: a page
           reference { type: "page", id } resolves to the page's path like any
           other. The error pages are pages too, but the build serves them at
           /404 and /500, never at /error-404, so a reference to one has no path
           and is listed as unresolved rather than linked to an address that
           does not exist. */
        var paths = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var (type, collection) in ReferenceCollections)
        {
            foreach (var item in loaded[collection])
            {
                if (item.Path is not null && !(collection == "pages" && ErrorSlugs.ContainsValue(item.Slug)))
                    paths[Key(type, item.Id)] = item.Path;
            }
        }

        var unresolved = new List<object>();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var (collection, items) in loaded)
        {
            foreach (var item in items)
                CollectReferences(item.Document, $"{collection}/{item.Slug}", paths, seen, unresolved);
        }

        var errorPages = new Dictionary<string, object?>(StringComparer.Ordinal);
        foreach (var (type, slug) in ErrorSlugs)
        {
            var page = loaded["pages"].FirstOrDefault(item => item.Slug == slug);
            errorPages[type] = page is null ? null : Present(page, path: null);
            if (page is not null)
                CollectReferences(page.Document, "error-pages/" + type, paths, seen, unresolved);
        }

        var routablePages = loaded["pages"]
            .Where(item => !ErrorSlugs.ContainsValue(item.Slug))
            .Select(item => Present(item, item.Path))
            .ToList();

        var collections = new Dictionary<string, object>(StringComparer.Ordinal);
        foreach (var collection in Collections.Where(name => name != "pages"))
            collections[collection] = loaded[collection].Select(item => Present(item, item.Path)).ToList();

        var counts = new Dictionary<string, int>(StringComparer.Ordinal) { ["pages"] = routablePages.Count };
        foreach (var collection in Collections.Where(name => name != "pages"))
            counts[collection] = loaded[collection].Count;

        return new
        {
            generatedAt = DateTime.UtcNow,
            counts,
            pages = routablePages,
            collections,
            errorPages,
            media = await MediaAsync(cancellationToken),
            navigation = await NavigationAsync(paths, cancellationToken),
            settings = await SettingsAsync(cancellationToken),
            redirects = await RedirectsAsync(cancellationToken),
            references = paths,
            unresolvedReferences = unresolved,
        };
    }

    private static string Key(string type, Guid id) => type + ":" + id.ToString("D");

    private static object Present(Item item, string? path) => new
    {
        id = item.Id,
        collection = item.Collection,
        slug = item.Slug,
        path,
        title = item.Document.Title,
        sortOrder = item.Document.SortOrder,
        metaTitle = item.Document.MetaTitle,
        metaDescription = item.Document.MetaDescription,
        canonicalOverride = item.Document.CanonicalOverride,
        noIndex = item.Document.NoIndex,
        shareImageId = item.Document.ShareImageId,
        shareImageAltOverride = item.Document.ShareImageAltOverride,
        publishedAt = item.PublishedAt,
        updatedAt = item.UpdatedAt,
        status = item.Status,
        fields = item.Document.Fields,
        sections = item.Document.Sections
            .Where(section => section.Visible)
            .OrderBy(section => section.SortOrder)
            .Select(section => new { type = section.Type, fields = section.Fields })
            .ToList(),
    };

    private async Task<List<Item>> LoadAsync(string collection, CancellationToken cancellationToken)
    {
        var items = new List<Item>();
        switch (collection)
        {
            case "pages":
                await AddAsync(db.Pages.AsNoTracking().Include(item => item.Sections), item => item.Sections);
                break;
            case "services":
                await AddAsync(db.Services.AsNoTracking().Include(item => item.Sections), item => item.Sections);
                break;
            case "partners":
                await AddAsync(db.Partners.AsNoTracking().Include(item => item.Sections), item => item.Sections);
                break;
            case "case-studies":
                await AddAsync(db.CaseStudies.AsNoTracking().Include(item => item.Sections), item => item.Sections);
                break;
            case "blog-posts":
                await AddAsync(db.BlogPosts.AsNoTracking(), _ => []);
                break;
            case "vacancies":
                await AddAsync(db.Vacancies.AsNoTracking(), _ => []);
                break;
            case "team-members":
                await AddAsync(db.TeamMembers.AsNoTracking(), _ => []);
                break;
            case "news-items":
                await AddAsync(db.NewsItems.AsNoTracking(), _ => []);
                break;
        }

        return items.OrderBy(item => item.SortOrder).ThenBy(item => item.Slug, StringComparer.Ordinal).ToList();

        async Task AddAsync<T>(IQueryable<T> query, Func<T, IEnumerable<Section>> sections) where T : ContentRecord
        {
            // Status on the record itself: a working copy is a draft and is not read here.
            var rows = collection == "vacancies"
                ? await query.Where(item => item.Status == ContentStatus.Published || item.Status == ContentStatus.Ended).ToListAsync(cancellationToken)
                : await query.Where(item => item.Status == ContentStatus.Published).ToListAsync(cancellationToken);
            foreach (var row in rows)
            {
                items.Add(new Item(
                    row.Id,
                    collection,
                    row.Slug,
                    ContentPaths.PublicPath(collection, row.Slug),
                    row.SortOrder,
                    row.PublishedAt,
                    row.UpdatedAt,
                    row.Status == ContentStatus.Ended ? "ended" : "published",
                    ContentFields.FromRecord(collection, row, sections(row))));
            }
        }
    }

    /// <summary>
    /// Walks an item for { type, id } references. Resolvable ones are already in
    /// <paramref name="paths"/>; anything else is reported once, with where it was
    /// found, so the build can render nothing for it and still say what is missing.
    /// </summary>
    private static void CollectReferences(
        DraftDocument document,
        string usedBy,
        Dictionary<string, string> paths,
        HashSet<string> seen,
        List<object> unresolved)
    {
        using var json = JsonDocument.Parse(JsonSerializer.Serialize(document, ContentJson.Options));
        Walk(json.RootElement);

        void Walk(JsonElement element)
        {
            switch (element.ValueKind)
            {
                case JsonValueKind.Object:
                    if (element.TryGetProperty("type", out var type)
                        && type.ValueKind == JsonValueKind.String
                        && element.TryGetProperty("id", out var id)
                        && id.ValueKind == JsonValueKind.String
                        && Guid.TryParse(id.GetString(), out var target)
                        && ReferenceCollections.ContainsKey(type.GetString() ?? ""))
                    {
                        var key = Key(type.GetString()!, target);
                        if (!paths.ContainsKey(key) && seen.Add(key))
                        {
                            unresolved.Add(new
                            {
                                type = type.GetString(),
                                id = target,
                                usedBy,
                                reason = "The target is missing or not published, so it is not linked.",
                            });
                        }
                    }

                    foreach (var property in element.EnumerateObject())
                        Walk(property.Value);
                    break;
                case JsonValueKind.Array:
                    foreach (var entry in element.EnumerateArray())
                        Walk(entry);
                    break;
                case JsonValueKind.String:
                    // Rich text bodies are stored as a JSON string; references live inside.
                    var text = element.GetString();
                    if (string.IsNullOrWhiteSpace(text) || (text[0] != '{' && text[0] != '['))
                        break;
                    try
                    {
                        using var nested = JsonDocument.Parse(text);
                        Walk(nested.RootElement);
                    }
                    catch (JsonException)
                    {
                        // Not JSON. Ordinary text.
                    }

                    break;
            }
        }
    }

    private async Task<List<object>> MediaAsync(CancellationToken cancellationToken)
    {
        var assets = await db.Media.AsNoTracking().OrderBy(asset => asset.Path).ToListAsync(cancellationToken);
        return assets.Select(asset => (object)new
        {
            id = asset.Id,
            path = asset.Path,
            originalName = asset.OriginalName,
            contentType = asset.ContentType,
            width = asset.Width,
            height = asset.Height,
            size = asset.Size,
            widths = Widths(asset.GeneratedSizes),
            alt = asset.Alt,
            decorative = asset.Decorative,
            caption = asset.Caption,
        }).ToList();
    }

    private static List<int> Widths(string generated)
    {
        try
        {
            using var document = JsonDocument.Parse(string.IsNullOrWhiteSpace(generated) ? "[]" : generated);
            if (document.RootElement.ValueKind != JsonValueKind.Array)
                return [];
            var widths = new List<int>();
            foreach (var entry in document.RootElement.EnumerateArray())
            {
                if (entry.ValueKind == JsonValueKind.Number && entry.TryGetInt32(out var width))
                    widths.Add(width);
                else if (entry.ValueKind == JsonValueKind.Object && entry.TryGetProperty("width", out var nested) && nested.TryGetInt32(out var value))
                    widths.Add(value);
            }

            return widths.Distinct().OrderBy(width => width).ToList();
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private async Task<List<object>> NavigationAsync(Dictionary<string, string> paths, CancellationToken cancellationToken)
    {
        var rows = await db.NavigationItems.AsNoTracking().OrderBy(item => item.SortOrder).ToListAsync(cancellationToken);
        return rows.Where(item => item.ParentId is null).Select(item => Node(item, rows, paths)).ToList();
    }

    private static object Node(NavigationItem item, List<NavigationItem> all, Dictionary<string, string> paths)
    {
        /* An internal link whose target is not published resolves to nothing. The
           build drops it rather than linking somewhere that will not exist. */
        string? path = null;
        if (item.LinkKind == "internal" && item.TargetType is not null && item.TargetId is Guid target)
            paths.TryGetValue(Key(item.TargetType, target), out path);

        return new
        {
            id = item.Id,
            menu = item.Menu,
            label = item.Label,
            kind = item.LinkKind,
            path,
            url = item.LinkKind == "external" ? item.Url : null,
            sortOrder = item.SortOrder,
            children = all.Where(child => child.ParentId == item.Id)
                .OrderBy(child => child.SortOrder)
                .Select(child => Node(child, all, paths))
                .ToList(),
        };
    }

    private async Task<object> SettingsAsync(CancellationToken cancellationToken)
    {
        var settings = await db.SiteSettings.AsNoTracking().FirstOrDefaultAsync(cancellationToken) ?? new SiteSettings();
        return new
        {
            settings.Phone,
            settings.WhatsApp,
            settings.Email,
            settings.CareersEmail,
            settings.LinkedIn,
            settings.Facebook,
            settings.Instagram,
            settings.TikTok,
            settings.FooterText,
            settings.StreetAddress,
            settings.Locality,
            settings.Region,
            settings.PostalCode,
            settings.Country,
            settings.DefaultMetaTitle,
            settings.DefaultMetaDescription,
            settings.DefaultShareImageId,
            settings.DefaultShareImageAltOverride,
            settings.OrganizationName,
            settings.LegalName,
            settings.AnalyticsContainerId,
            settings.CookieBannerText,
            settings.CookieBannerTitle,
            settings.CookieAcceptLabel,
            settings.CookieRejectLabel,
            settings.CookieAnalyticsLabel,
            settings.CookieSettingsLabel,
        };
    }

    private async Task<List<object>> RedirectsAsync(CancellationToken cancellationToken)
    {
        var rows = await db.Redirects.AsNoTracking().OrderBy(item => item.FromPath).ToListAsync(cancellationToken);
        return rows.Select(item => (object)new
        {
            fromPath = item.FromPath,
            toPath = item.ToPath,
            statusCode = item.StatusCode,
        }).ToList();
    }

    private sealed record Item(
        Guid Id,
        string Collection,
        string Slug,
        string? Path,
        int SortOrder,
        DateTime? PublishedAt,
        DateTime UpdatedAt,
        string Status,
        DraftDocument Document);
}
