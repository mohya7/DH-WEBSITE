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

    public static async Task<bool> IsInUseAsync(ContentDbContext db, Guid mediaId, CancellationToken cancellationToken) =>
        (await FindPlacesAsync(db, mediaId, cancellationToken)).Count > 0;

    public static async Task<IReadOnlyList<string>> FindPlacesAsync(ContentDbContext db, Guid mediaId, CancellationToken cancellationToken)
    {
        var places = new List<string>();
        var text = mediaId.ToString();
        await AddSharesAsync(db.Pages, "pages", mediaId, places, cancellationToken);
        await AddSharesAsync(db.Services, "services", mediaId, places, cancellationToken);
        await AddSharesAsync(db.Partners, "partners", mediaId, places, cancellationToken);
        await AddSharesAsync(db.CaseStudies, "case-studies", mediaId, places, cancellationToken);
        await AddSharesAsync(db.BlogPosts, "blog-posts", mediaId, places, cancellationToken);
        await AddSharesAsync(db.Vacancies, "vacancies", mediaId, places, cancellationToken);
        await AddSharesAsync(db.TeamMembers, "team-members", mediaId, places, cancellationToken);
        await AddSharesAsync(db.NewsItems, "news-items", mediaId, places, cancellationToken);
        await AddImagesAsync(db.Partners, "partners", mediaId, places, cancellationToken);
        await AddImagesAsync(db.CaseStudies, "case-studies", mediaId, places, cancellationToken);
        await AddImagesAsync(db.BlogPosts, "blog-posts", mediaId, places, cancellationToken);
        await AddImagesAsync(db.TeamMembers, "team-members", mediaId, places, cancellationToken);
        await AddImagesAsync(db.NewsItems, "news-items", mediaId, places, cancellationToken);

        foreach (var id in await db.SiteSettings.AsNoTracking().Where(item => item.DefaultShareImageId == mediaId).Select(item => item.Id).ToListAsync(cancellationToken))
            places.Add("site-settings " + id.ToString("D") + " default share image");

        foreach (var id in await db.BlogPosts.AsNoTracking().Where(item => item.Body.Contains(text)).Select(item => item.Id).ToListAsync(cancellationToken))
            places.Add("blog-posts " + id.ToString("D") + " body");

        var sections = await db.Sections.AsNoTracking()
            .Where(section => section.Fields.Contains(text))
            .Select(section => new { section.Id, section.PageId, section.ServiceId, section.PartnerId, section.CaseStudyId })
            .ToListAsync(cancellationToken);
        foreach (var section in sections)
        {
            var owner = section.PageId ?? section.ServiceId ?? section.PartnerId ?? section.CaseStudyId;
            var collection = section.PageId is not null ? "pages"
                : section.ServiceId is not null ? "services"
                : section.PartnerId is not null ? "partners"
                : "case-studies";
            if (owner is Guid ownerId)
                places.Add(collection + " " + ownerId.ToString("D") + " section " + section.Id.ToString("D"));
        }

        var copies = await db.WorkingCopies.AsNoTracking()
            .Where(copy => copy.Document.Contains(text))
            .Select(copy => new
            {
                copy.PageId,
                copy.ServiceId,
                copy.PartnerId,
                copy.CaseStudyId,
                copy.BlogPostId,
                copy.VacancyId,
                copy.TeamMemberId,
                copy.NewsItemId,
            })
            .ToListAsync(cancellationToken);
        foreach (var copy in copies)
        {
            var (collection, owner) = copy.PageId is Guid page ? ("pages", page)
                : copy.ServiceId is Guid service ? ("services", service)
                : copy.PartnerId is Guid partner ? ("partners", partner)
                : copy.CaseStudyId is Guid study ? ("case-studies", study)
                : copy.BlogPostId is Guid blog ? ("blog-posts", blog)
                : copy.VacancyId is Guid vacancy ? ("vacancies", vacancy)
                : copy.TeamMemberId is Guid member ? ("team-members", member)
                : copy.NewsItemId is Guid news ? ("news-items", news)
                : ("", Guid.Empty);
            if (collection.Length > 0)
                places.Add(collection + " " + owner.ToString("D") + " working copy");
        }

        return places;
    }

    private static async Task AddSharesAsync<T>(DbSet<T> set, string collection, Guid mediaId, List<string> places, CancellationToken cancellationToken)
        where T : ContentRecord
    {
        foreach (var id in await set.AsNoTracking().Where(item => item.ShareImageId == mediaId).Select(item => item.Id).ToListAsync(cancellationToken))
            places.Add(collection + " " + id.ToString("D") + " share image");
    }

    private static async Task AddImagesAsync<T>(DbSet<T> set, string collection, Guid mediaId, List<string> places, CancellationToken cancellationToken)
        where T : ContentRecord
    {
        foreach (var id in await set.AsNoTracking().Where(item => EF.Property<Guid?>(item, "ImageId") == mediaId).Select(item => item.Id).ToListAsync(cancellationToken))
            places.Add(collection + " " + id.ToString("D") + " image");
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
