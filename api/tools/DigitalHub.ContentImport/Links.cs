namespace DigitalHub.ContentImport;

static class Links
{
    public static LinkResult Rewrite(string? href, string fromPage)
    {
        if (string.IsNullOrWhiteSpace(href))
            return new LinkResult(null, null, false);

        var raw = href.Trim();
        if (raw.StartsWith("mailto:", StringComparison.OrdinalIgnoreCase)
            || raw.StartsWith("tel:", StringComparison.OrdinalIgnoreCase)
            || raw.StartsWith('#'))
        {
            return new LinkResult(raw, null, false);
        }

        if (raw.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            || raw.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            if (!raw.Contains("digitalhub.com.eg", StringComparison.OrdinalIgnoreCase)
                && !raw.Contains("127.0.0.1", StringComparison.Ordinal)
                && !raw.Contains("localhost", StringComparison.OrdinalIgnoreCase))
            {
                return new LinkResult(raw, null, false);
            }

            raw = new Uri(raw).PathAndQuery + (raw.Contains('#') ? raw[raw.IndexOf('#')..] : "");
        }

        var hash = "";
        var hashAt = raw.IndexOf('#');
        if (hashAt >= 0)
        {
            hash = raw[hashAt..];
            raw = raw[..hashAt];
        }

        raw = raw.Split('?')[0];
        var normalized = Normalize(raw, fromPage);
        if (normalized is "" or "index.html")
            return new LinkResult("/" + hash, null, true);

        var clean = normalized switch
        {
            "about-us.html" => "/about",
            "get-in-touch.html" => "/contact",
            "news/index.html" => "/news",
            "partners/index.html" => "/partners",
            "cases/index.html" => "/cases",
            "blogs/index.html" => "/blogs",
            "careers/index.html" => "/careers",
            "careers/apply.html" => "/careers/apply",
            _ => null,
        };
        if (clean is not null)
            return new LinkResult(clean + hash, null, true);

        if (normalized.EndsWith("/index.html", StringComparison.Ordinal))
            return new LinkResult("/" + normalized[..^"/index.html".Length] + hash, null, true);

        clean = normalized switch
        {
            "news" or "news/" => "/news",
            "partners" => "/partners",
            "cases" => "/cases",
            "blogs" => "/blogs",
            "careers" => "/careers",
            "about-us" => "/about",
            "get-in-touch" => "/contact",
            _ => null,
        };
        if (clean is not null)
            return new LinkResult(clean + hash, null, true);

        if (normalized.EndsWith(".html", StringComparison.Ordinal))
        {
            var without = normalized[..^5];
            if (without.StartsWith("careers/", StringComparison.Ordinal))
            {
                if (IsDroppedCareer(normalized))
                    return new LinkResult(null, null, false);
                return new LinkResult(null, normalized, true);
            }

            return new LinkResult("/" + without + hash, null, true);
        }

        return new LinkResult(null, normalized, true);
    }

    private static string Normalize(string href, string fromPage)
    {
        var baseDir = Path.GetDirectoryName(fromPage.Replace('\\', '/'))?.Replace('\\', '/') ?? "";
        var combined = href.StartsWith('/')
            ? href.TrimStart('/')
            : (string.IsNullOrEmpty(baseDir) ? href : baseDir + "/" + href);
        var parts = new List<string>();
        foreach (var part in combined.Split('/', StringSplitOptions.RemoveEmptyEntries))
        {
            if (part == ".")
                continue;
            if (part == "..")
            {
                if (parts.Count > 0)
                    parts.RemoveAt(parts.Count - 1);
                continue;
            }

            parts.Add(part);
        }

        return string.Join('/', parts);
    }

    internal static bool IsDroppedCareer(string? path)
    {
        var name = Path.GetFileName((path ?? "").Replace('\\', '/'));
        return name is "data-analyst.html" or "dotnet-backend-developer.html" or "full-stack-developer.html";
    }

    internal static (string Type, string Slug)? Reference(string? clean)
    {
        if (string.IsNullOrWhiteSpace(clean))
            return null;
        var path = clean.Split('#')[0].Trim('/');
        var parts = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        /* A page is one segment: /contact, /about, or / for the home page. Without
           this a link to a page resolved to nothing, which is how the About
           constellation's Consultation node lost its link to the contact page. */
        if (parts.Length == 0)
            return ("page", "home");
        if (parts.Length == 1)
            return ("page", parts[0]);
        if (parts.Length != 2)
            return null;
        return parts[0] switch
        {
            "services" => ("service", parts[1]),
            "partners" => ("partner", parts[1]),
            "cases" => ("case_study", parts[1]),
            "blogs" => ("blog_post", parts[1]),
            _ => null,
        };
    }
}

readonly record struct LinkResult(string? Clean, string? Unresolved, bool Internal);
