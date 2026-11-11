using DigitalHub.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace DigitalHub.Api.Content;

/// <summary>
/// Whether a page answers at a redirect's target (ADM-07). A target resolves when its
/// address (RedirectPaths.Key) is one the website build writes as a page: the public
/// path of every item BuildContentStore emits, except the two error pages, which the
/// build serves at /404 and /500, plus the website's own fixed pages. The comparison is
/// ordinal, because website routes are lower-case clean paths, so /About, /about.html,
/// media and the error pages do not count.
///
/// The build's own report (redirectTargetReport in website/scripts/check-output.ts)
/// applies the same rule to the files it wrote. RedirectTargetRuleTests locks the fixed
/// pages and the error pages of the two together.
/// </summary>
public static class RedirectTargets
{
    /// <summary>
    /// The website's fixed pages, which are not content items: staticFiles in
    /// website/scripts/check-output.ts, as addresses.
    /// </summary>
    public static readonly IReadOnlyList<string> StaticPaths = ["/privacy-careers"];

    /// <summary>The error pages the build renders (BuildContentStore's ErrorSlugs), by key: 404 and 500. Never a target.</summary>
    public static IReadOnlyCollection<string> ErrorPageKeys => BuildContentStore.ErrorSlugs.Keys;

    /// <summary>Every address at which the next build writes a page. One slug-only query per collection.</summary>
    public static async Task<IReadOnlySet<string>> LivePathsAsync(ContentDbContext db, CancellationToken cancellationToken)
    {
        var live = new HashSet<string>(StaticPaths, StringComparer.Ordinal);
        var published = ContentStatus.Published;
        var ended = ContentStatus.Ended;
        var errorSlugs = BuildContentStore.ErrorSlugs.Values.ToList();

        Add("pages", await db.Pages.AsNoTracking()
            .Where(item => item.Status == published && !errorSlugs.Contains(item.Slug))
            .Select(item => item.Slug).ToListAsync(cancellationToken));
        Add("services", await db.Services.AsNoTracking()
            .Where(item => item.Status == published)
            .Select(item => item.Slug).ToListAsync(cancellationToken));
        Add("partners", await db.Partners.AsNoTracking()
            .Where(item => item.Status == published)
            .Select(item => item.Slug).ToListAsync(cancellationToken));
        Add("case-studies", await db.CaseStudies.AsNoTracking()
            .Where(item => item.Status == published)
            .Select(item => item.Slug).ToListAsync(cancellationToken));
        Add("blog-posts", await db.BlogPosts.AsNoTracking()
            .Where(item => item.Status == published)
            .Select(item => item.Slug).ToListAsync(cancellationToken));
        // The build writes a page for an ended vacancy too ("no longer open"; BuildContentStore).
        Add("vacancies", await db.Vacancies.AsNoTracking()
            .Where(item => item.Status == published || item.Status == ended)
            .Select(item => item.Slug).ToListAsync(cancellationToken));
        return live;

        void Add(string collection, List<string> slugs)
        {
            foreach (var slug in slugs)
            {
                var path = ContentPaths.PublicPath(collection, slug);
                if (path is not null)
                    live.Add(RedirectPaths.Key(path));
            }
        }
    }

    /// <summary>Whether a page answers at this target's address.</summary>
    public static bool Resolves(string toPath, IReadOnlySet<string> live) => live.Contains(RedirectPaths.Key(toPath));
}
