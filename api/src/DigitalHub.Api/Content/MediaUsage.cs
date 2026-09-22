using System.Text.Json;
using DigitalHub.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace DigitalHub.Api.Content;

public static class MediaUsage
{
    private static readonly string[] ReferenceNames = ["mediaId", "shareImageId", "imageId", "defaultShareImageId"];

    public static IReadOnlyList<Guid> ReferencedIds(string json)
    {
        using var document = JsonDocument.Parse(json);
        return ReferencedIds(document.RootElement);
    }

    public static IReadOnlyList<Guid> ReferencedIds(JsonElement element)
    {
        var ids = new List<Guid>();
        Walk(element, ids);
        return ids.Distinct().ToList();
    }

    public static async Task<bool> IsInUseAsync(ContentDbContext db, Guid mediaId, CancellationToken cancellationToken)
    {
        if (await db.Pages.AsNoTracking().AnyAsync(item => item.ShareImageId == mediaId, cancellationToken)
            || await db.Services.AsNoTracking().AnyAsync(item => item.ShareImageId == mediaId, cancellationToken)
            || await db.Partners.AsNoTracking().AnyAsync(item => item.ShareImageId == mediaId || item.ImageId == mediaId, cancellationToken)
            || await db.CaseStudies.AsNoTracking().AnyAsync(item => item.ShareImageId == mediaId || item.ImageId == mediaId, cancellationToken)
            || await db.BlogPosts.AsNoTracking().AnyAsync(item => item.ShareImageId == mediaId || item.ImageId == mediaId, cancellationToken)
            || await db.Vacancies.AsNoTracking().AnyAsync(item => item.ShareImageId == mediaId, cancellationToken)
            || await db.TeamMembers.AsNoTracking().AnyAsync(item => item.ShareImageId == mediaId || item.ImageId == mediaId, cancellationToken)
            || await db.NewsItems.AsNoTracking().AnyAsync(item => item.ShareImageId == mediaId || item.ImageId == mediaId, cancellationToken)
            || await db.SiteSettings.AsNoTracking().AnyAsync(item => item.DefaultShareImageId == mediaId, cancellationToken))
        {
            return true;
        }

        var text = mediaId.ToString();
        if (await db.Sections.AsNoTracking().AnyAsync(section => section.Fields.Contains(text), cancellationToken))
            return true;
        return await db.WorkingCopies.AsNoTracking().AnyAsync(copy => copy.Document.Contains(text), cancellationToken);
    }

    public static async Task<IReadOnlyList<Guid>> MissingAsync(ContentDbContext db, string snapshot, CancellationToken cancellationToken)
    {
        var referenced = ReferencedIds(snapshot);
        if (referenced.Count == 0)
            return [];

        var existing = await db.Media.AsNoTracking()
            .Where(asset => referenced.Contains(asset.Id))
            .Select(asset => asset.Id)
            .ToListAsync(cancellationToken);
        var known = existing.ToHashSet();
        return referenced.Where(id => !known.Contains(id)).ToList();
    }

    private static void Walk(JsonElement element, List<Guid> ids)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                foreach (var property in element.EnumerateObject())
                {
                    if (ReferenceNames.Contains(property.Name, StringComparer.Ordinal)
                        && property.Value.ValueKind == JsonValueKind.String
                        && Guid.TryParse(property.Value.GetString(), out var id))
                    {
                        ids.Add(id);
                    }

                    Walk(property.Value, ids);
                }

                break;
            case JsonValueKind.Array:
                foreach (var item in element.EnumerateArray())
                    Walk(item, ids);
                break;
            case JsonValueKind.String:
                if (TryParse(element.GetString(), out var nested))
                {
                    using (nested)
                        Walk(nested.RootElement, ids);
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
}
