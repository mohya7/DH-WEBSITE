using System.Text.Json;
using System.Text.RegularExpressions;
using AngleSharp.Html.Parser;

namespace DigitalHub.ContentImport;

static class Catalog
{
    public const string SecretsId = "41335d15-4f42-410a-bf90-41068117e45a";

    internal static readonly string[] ArticlePages =
    [
        "blogs/digital-employee-experience.html",
        "blogs/azure-digital-egypt-2030.html",
        "blogs/enterprise-ai-production.html",
        "blogs/digital-transformation-signs.html",
        "blogs/augment-vs-outsource-tech-team.html",
    ];

    private static readonly string[] HeldCareerPages =
    [
        "careers/data-analyst.html",
        "careers/dotnet-backend-developer.html",
        "careers/full-stack-developer.html",
    ];

    public static ImportPlan Build(string root)
    {
        var jsonPath = Path.Combine(root, "content", "admin-content.json");
        using var json = JsonDocument.Parse(File.ReadAllText(jsonPath));
        var collections = json.RootElement.GetProperty("collections");
        var plan = new ImportPlan();
        var parser = new HtmlParser();
        var images = new Dictionary<string, ImageLine>(StringComparer.OrdinalIgnoreCase);

        AddCollection(plan, "services", collections.GetProperty("services"), ImportService, "published");
        AddCollection(plan, "partners", collections.GetProperty("partners"), ImportPartner, "published");
        AddCollection(plan, "case_studies", collections.GetProperty("caseStudies"), ImportCase, "draft");
        AddBlogs(plan, collections.GetProperty("blogs"));
        AddCollection(plan, "vacancies", collections.GetProperty("jobs"), HoldJob, "not imported");
        AddCollection(plan, "team_members", collections.GetProperty("team"), ImportTeam, "published");
        AddCollection(plan, "news_items", collections.GetProperty("news"), ImportNews, "published");
        ScanSuspects(plan, collections);

        foreach (var page in PageList())
        {
            var document = parser.ParseDocument(File.ReadAllText(Path.Combine(root, page.Source)));
            plan.Pages.Add(ExtractPage(document, page, plan));
            CollectImages(document, page.Source, root, images);
            RecordLinks(document.QuerySelector("main"), page.Source, plan);
        }

        foreach (var source in ArticlePages)
        {
            var fullPath = Path.Combine(root, source.Replace('/', Path.DirectorySeparatorChar));
            var document = parser.ParseDocument(File.ReadAllText(fullPath));
            var slug = Path.GetFileNameWithoutExtension(source);
            var blog = plan.Blogs.First(item => item.Slug == slug);
            ReadArticle(document, blog, plan);
            CollectImages(document, source, root, images);
            RecordLinks(document.QuerySelector("main"), source, plan);
            plan.Pages.Add(new PageLine
            {
                Source = source,
                Owner = "blog_posts." + slug,
                Notes =
                {
                    "Blog posts do not own sections. The hero is columns, the article is body, and related posts are related_slugs.",
                },
            });
        }

        foreach (var source in HeldCareerPages)
        {
            plan.Suspects.Add(new Suspect
            {
                Collection = "vacancies",
                Id = Path.GetFileNameWithoutExtension(source),
                Reason = "Not imported. The vacancies table stays empty.",
            });
        }

        var index = parser.ParseDocument(File.ReadAllText(Path.Combine(root, "index.html")));
        plan.HeaderLinks = index.QuerySelectorAll("nav.nav .nav-links a").Length;
        plan.FooterLinks = index.QuerySelectorAll("footer.footer a").Length;
        RecordLinks(index.QuerySelector("nav.nav"), "index.html", plan);
        RecordLinks(index.QuerySelector("footer.footer"), "index.html", plan);
        plan.Pages.Add(new PageLine
        {
            Source = "(no designed page)",
            Owner = "case_studies.national-portal",
            Notes =
            {
                "Status draft. JSON only: summary, image, categories, and metric. The href get-in-touch.html is not its URL.",
            },
        });
        ReadSiteSettings(json.RootElement, plan);

        foreach (var item in collections.GetProperty("services").EnumerateArray())
            CollectJsonImages(item, root, images);
        foreach (var item in collections.GetProperty("partners").EnumerateArray())
            CollectJsonImages(item, root, images);
        foreach (var item in collections.GetProperty("caseStudies").EnumerateArray())
            CollectJsonImages(item, root, images);
        foreach (var item in collections.GetProperty("team").EnumerateArray())
            CollectJsonImages(item, root, images);
        foreach (var item in collections.GetProperty("news").EnumerateArray())
            CollectJsonImages(item, root, images);

        foreach (var image in images.Values.OrderBy(item => item.Path, StringComparer.OrdinalIgnoreCase))
        {
            Measure(root, image);
            plan.Images.Add(image);
        }

        return plan;
    }

    private static void AddBlogs(ImportPlan plan, JsonElement blogs)
    {
        var line = new CollectionLine { Name = "blog_posts", SourceCount = blogs.GetArrayLength(), Status = "draft" };
        foreach (var item in blogs.EnumerateArray())
        {
            var href = item.GetProperty("href").GetString() ?? "";
            var slug = Path.GetFileNameWithoutExtension(href);
            line.Importing.Add(slug);
            line.ImportCount++;
            plan.Blogs.Add(new BlogLine
            {
                Slug = slug,
                Source = href.Replace('\\', '/'),
                HtmlOnly = false,
                JsonTextLength = TextLength(item.GetProperty("body").GetString()),
            });
        }

        foreach (var source in ArticlePages)
        {
            var slug = Path.GetFileNameWithoutExtension(source);
            if (line.Importing.Contains(slug))
                continue;
            line.Importing.Add(slug);
            line.ImportCount++;
            plan.Blogs.Add(new BlogLine
            {
                Slug = slug,
                Source = source,
                HtmlOnly = true,
            });
        }

        plan.Collections.Add(line);
    }

    private static void AddCollection(ImportPlan plan, string name, JsonElement items, Func<JsonElement, ItemDecision> decide, string status)
    {
        var line = new CollectionLine { Name = name, SourceCount = items.GetArrayLength(), Status = status };
        foreach (var item in items.EnumerateArray())
        {
            var decision = decide(item);
            if (decision.Import)
            {
                line.Importing.Add(decision.Label);
                line.ImportCount++;
            }
            else
            {
                line.Held.Add(decision.Label);
                line.HeldCount++;
                plan.Suspects.Add(new Suspect
                {
                    Collection = name,
                    Id = decision.Label,
                    Reason = decision.Reason,
                });
            }
        }

        plan.Collections.Add(line);
    }

    private static ItemDecision ImportService(JsonElement item) =>
        new(true, SlugFromHref(item), "");

    private static ItemDecision ImportPartner(JsonElement item) =>
        new(true, SlugFromHref(item), "");

    private static ItemDecision ImportCase(JsonElement item)
    {
        var id = item.GetProperty("id").GetString() ?? "";
        if (id == "case-national-portal")
            return new ItemDecision(true, "national-portal", "");

        return new ItemDecision(true, SlugFromHref(item), "");
    }

    private static ItemDecision HoldJob(JsonElement item)
    {
        var title = item.GetProperty("title").GetString() ?? item.GetProperty("id").GetString() ?? "";
        return new ItemDecision(false, title, "Not imported. The vacancies table stays empty.");
    }

    private static ItemDecision ImportTeam(JsonElement item)
    {
        var id = item.GetProperty("id").GetString() ?? "";
        return new ItemDecision(true, id.StartsWith("team-", StringComparison.Ordinal) ? id["team-".Length..] : id, "");
    }

    private static ItemDecision ImportNews(JsonElement item)
    {
        var id = item.GetProperty("id").GetString() ?? "";
        return new ItemDecision(true, id.StartsWith("news-", StringComparison.Ordinal) ? id["news-".Length..] : id, "");
    }

    private static void ScanSuspects(ImportPlan plan, JsonElement collections)
    {
        foreach (var property in collections.EnumerateObject())
        {
            foreach (var item in property.Value.EnumerateArray())
            {
                var id = item.TryGetProperty("id", out var idValue) ? idValue.GetString() ?? "" : "";
                if (property.Name == "jobs")
                    continue;
                var blob = item.GetRawText();
                if (blob.Contains("asdasd", StringComparison.OrdinalIgnoreCase)
                    || blob.Contains("— Copy", StringComparison.Ordinal)
                    || blob.Contains(" - Copy", StringComparison.Ordinal)
                    || blob.Contains("lorem ipsum", StringComparison.OrdinalIgnoreCase)
                    || blob.Contains("placeholder", StringComparison.OrdinalIgnoreCase))
                {
                    plan.Suspects.Add(new Suspect
                    {
                        Collection = property.Name,
                        Id = id,
                        Reason = "Text looks like placeholder or copy data.",
                    });
                }
            }
        }
    }

    private static PageLine ExtractPage(AngleSharp.Html.Dom.IHtmlDocument document, PageSpec page, ImportPlan plan)
    {
        var line = new PageLine { Source = page.Source, Owner = page.Owner };
        var main = document.QuerySelector("main");
        if (main is null)
        {
            line.Unmapped.Add("No main element.");
            return line;
        }

        var sawProblem = false;
        foreach (var section in main.Children.Where(child => child.LocalName == "section"))
        {
            var classes = section.ClassName ?? "";
            var heading = Heading(section);
            var mapped = MapSection(classes, page.Kind);
            if (mapped is null && IsBareSection(classes))
            {
                mapped = ClassifyBare(heading, ref sawProblem);
            }

            if (mapped is null)
            {
                if (classes.Contains("careers-detail", StringComparison.Ordinal))
                {
                    line.Unmapped.Add("Application form posts to /api/careers/applications. It is not a content section.");
                }
                else
                {
                    line.Unmapped.Add(string.IsNullOrWhiteSpace(classes) ? "(section without a class)" : classes);
                }

                continue;
            }

            line.Sections.Add(string.IsNullOrWhiteSpace(heading) ? mapped : mapped + " — " + heading);
            if (mapped == "related_items")
            {
                foreach (var anchor in section.QuerySelectorAll("a[href]"))
                {
                    var result = Links.Rewrite(anchor.GetAttribute("href"), page.Source);
                    var reference = Links.Reference(result.Clean);
                    if (reference is { } item)
                        line.Related.Add(item.Type + ":" + item.Slug);
                }
            }
        }

        if (document.QuerySelector(".pp-node--consult") is not null)
        {
            line.Notes.Add("Consultation is a card linking to the contact page, not a fifth service.");
        }

        if (document.QuerySelector(".svc-hero-stage[aria-hidden='true']") is not null)
        {
            line.Notes.Add("The hero stage diagram is aria-hidden decoration and is not imported as text.");
        }

        if (page.Kind == "careers")
        {
            line.Notes.Add("The vacancy list is imported with no openings.");
        }

        return line;
    }

    private static void ReadArticle(AngleSharp.Html.Dom.IHtmlDocument document, BlogLine blog, ImportPlan plan)
    {
        var article = document.QuerySelector("article.blog-view-article");
        if (article is null)
        {
            blog.Unsupported.Add("No article.blog-view-article.");
            return;
        }

        var toc = article.QuerySelector("nav.blog-view-toc");
        blog.TocItems = toc?.QuerySelectorAll("li").Length ?? 0;
        if (blog.TocItems > 0)
        {
            blog.Notes.Add("Table of contents is derived from headings at publish and is not stored.");
        }

        foreach (var node in article.Children)
        {
            if (node == toc)
                continue;
            WalkBlock(node, blog);
        }

        var articleText = article.TextContent ?? "";
        if (toc is not null)
            articleText = articleText.Replace(toc.TextContent ?? "", "", StringComparison.Ordinal);
        blog.HtmlTextLength = TextLength(articleText);
        foreach (var link in document.QuerySelectorAll(".blog-view-related__grid a"))
        {
            var href = link.GetAttribute("href") ?? "";
            if (href.Contains("/blogs/", StringComparison.Ordinal) || href.Contains("blogs/", StringComparison.Ordinal))
            {
                blog.RelatedSlugs.Add(Path.GetFileNameWithoutExtension(href));
            }
        }

        var pillar = document.QuerySelector("a.blog-view-pillar");
        if (pillar is not null)
        {
            var result = Links.Rewrite(pillar.GetAttribute("href"), blog.Source);
            var reference = Links.Reference(result.Clean);
            if (reference is { } item)
                blog.RelatedItems.Add(item.Type + ":" + item.Slug);
            blog.Notes.Add("The related block is stored as related_items. It points at a service or partner, not another post.");
        }

        if (!blog.HtmlOnly && blog.HtmlTextLength > blog.JsonTextLength * 1.2)
        {
            blog.Notes.Add("The JSON body is shorter (" + blog.JsonTextLength + " characters) than the designed HTML (" + blog.HtmlTextLength + " characters). The HTML is the source.");
        }
    }

    private static void WalkBlock(AngleSharp.Dom.IElement node, BlogLine blog)
    {
        switch (node.LocalName)
        {
            case "p":
                blog.Paragraphs++;
                CountInline(node, blog);
                return;
            case "h2" or "h3" or "h4":
                blog.Headings++;
                CountInline(node, blog);
                return;
            case "ul":
                blog.BulletLists++;
                return;
            case "ol":
                blog.OrderedLists++;
                return;
            case "blockquote":
                blog.Quotes++;
                return;
            case "img":
                blog.Images++;
                return;
            case "table":
                blog.Tables++;
                return;
            case "pre":
                blog.CodeBlocks++;
                return;
            case "div" or "section":
                foreach (var child in node.Children)
                    WalkBlock(child, blog);
                return;
            default:
                var text = Regex.Replace(node.TextContent ?? "", @"\s+", " ").Trim();
                if (text.Length > 80)
                    text = text[..80] + "...";
                blog.Unsupported.Add("<" + node.LocalName + ">" + (text.Length == 0 ? "" : " " + text));
                return;
        }
    }

    private static void CountInline(AngleSharp.Dom.IElement node, BlogLine blog)
    {
        blog.Links += node.QuerySelectorAll("a").Length;
        if (node.QuerySelector("img") is not null)
            blog.Images += node.QuerySelectorAll("img").Length;
        foreach (var child in node.QuerySelectorAll("*"))
        {
            if (child.LocalName is not ("a" or "strong" or "b" or "em" or "i" or "code" or "span" or "br"))
            {
                blog.Unsupported.Add("inline <" + child.LocalName + "> inside <" + node.LocalName + ">");
            }
        }
    }

    private static void CollectImages(AngleSharp.Html.Dom.IHtmlDocument document, string source, string root, Dictionary<string, ImageLine> images)
    {
        foreach (var image in document.QuerySelectorAll("img"))
        {
            var src = image.GetAttribute("src");
            if (string.IsNullOrWhiteSpace(src))
                continue;
            var path = NormalizeAsset(src, source, root);
            if (path is null)
                continue;
            var alt = image.GetAttribute("alt");
            var decorative = string.IsNullOrWhiteSpace(alt) || image.GetAttribute("aria-hidden") == "true" || HiddenAncestor(image);
            var sectionName = SectionName(image);
            AddUsage(images, path, alt, decorative, source + " / " + sectionName);
        }
    }

    private static void CollectJsonImages(JsonElement item, string root, Dictionary<string, ImageLine> images)
    {
        WalkJsonImages(item, root, images);
    }

    private static void WalkJsonImages(JsonElement element, string root, Dictionary<string, ImageLine> images)
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            string? image = null;
            string? alt = null;
            foreach (var property in element.EnumerateObject())
            {
                if (property.Name is "image" && property.Value.ValueKind == JsonValueKind.String)
                    image = property.Value.GetString();
                else if (property.Name is "alt" && property.Value.ValueKind == JsonValueKind.String)
                    alt = property.Value.GetString();
                else
                    WalkJsonImages(property.Value, root, images);
            }

            if (!string.IsNullOrWhiteSpace(image))
            {
                var path = NormalizeAsset(image, "index.html", root);
                if (path is not null)
                    AddUsage(images, path, alt, string.IsNullOrWhiteSpace(alt), "admin-content.json");
            }
        }
        else if (element.ValueKind == JsonValueKind.Array)
        {
            foreach (var child in element.EnumerateArray())
                WalkJsonImages(child, root, images);
        }
    }

    private static void AddUsage(Dictionary<string, ImageLine> images, string path, string? alt, bool decorative, string place)
    {
        if (!images.TryGetValue(path, out var line))
        {
            line = new ImageLine { Path = path };
            images.Add(path, line);
        }

        line.Usages++;
        if (decorative)
            line.DecorativeUsages++;
        if (string.IsNullOrWhiteSpace(alt))
            line.EmptyAltUsages++;
        else if (!line.Alts.Contains(alt))
            line.Alts.Add(alt);
        if ((path.Contains("assets/team/", StringComparison.Ordinal) || path.Contains("headsss-for-the-website", StringComparison.Ordinal))
            && !line.Places.Contains(place))
        {
            line.Places.Add(place + (decorative ? " (decorative)" : ""));
        }
    }

    private static void RecordLinks(AngleSharp.Dom.IElement? root, string fromPage, ImportPlan plan)
    {
        if (root is null)
            return;
        foreach (var anchor in root.QuerySelectorAll("a[href]"))
        {
            var result = Links.Rewrite(anchor.GetAttribute("href"), fromPage);
            if (!result.Internal)
                continue;
            if (result.Unresolved is not null)
            {
                var label = fromPage + " → " + result.Unresolved;
                if (!plan.UnresolvedLinks.Contains(label))
                    plan.UnresolvedLinks.Add(label);
                continue;
            }

            if (result.Clean is not null)
                plan.RewrittenLinks++;
        }
    }

    private static bool HiddenAncestor(AngleSharp.Dom.IElement element)
    {
        for (var node = element.ParentElement; node is not null; node = node.ParentElement)
        {
            if (node.GetAttribute("aria-hidden") == "true")
                return true;
        }

        return false;
    }

    private static string SectionName(AngleSharp.Dom.IElement element)
    {
        for (var node = element.ParentElement; node is not null; node = node.ParentElement)
        {
            if (node.LocalName == "section")
                return string.IsNullOrWhiteSpace(node.ClassName) ? "section" : node.ClassName;
            if (node.LocalName is "nav" or "footer")
                return node.LocalName;
        }

        return "page";
    }

    private static void Measure(string root, ImageLine image)
    {
        var full = Path.Combine(root, image.Path.Replace('/', Path.DirectorySeparatorChar));
        if (!File.Exists(full))
        {
            image.ReadError = "file not found";
            return;
        }

        try
        {
            using var codec = SkiaSharp.SKCodec.Create(full);
            if (codec is null)
            {
                image.ReadError = "SkiaSharp could not decode the file";
                return;
            }

            image.Width = codec.Info.Width;
            image.Height = codec.Info.Height;
        }
        catch (Exception ex)
        {
            image.ReadError = ex.GetType().Name;
        }
    }

    private static void ReadSiteSettings(JsonElement root, ImportPlan plan)
    {
        var social = root.GetProperty("pages").GetProperty("home").GetProperty("social");
        foreach (var property in social.EnumerateObject())
        {
            plan.SiteSettings.Add(property.Name);
        }

        plan.SiteSettings.Add("phone, email, and address from the contact page and the career-page organization markup");
    }

    internal static string? MapSection(string classes, string kind)
    {
        var set = new HashSet<string>(classes.Split(' ', StringSplitOptions.RemoveEmptyEntries), StringComparer.Ordinal);
        if (set.Contains("hero--svc-split")) return "service_hero";
        if (set.Contains("about-hero") || set.Contains("cs-hero")) return "hero";
        if (set.Contains("partner-view-hero")) return "hero";
        if (set.Contains("hub-hero")) return "hub_hero";
        if (set.Contains("hero")) return "hero";
        if (set.Contains("about-services") || (set.Contains("services") && set.Contains("section"))) return "service_cards";
        if (set.Contains("delivery-flow")) return "delivery_flow";
        if (set.Contains("trust-logos")) return "logo_bar";
        if (set.Contains("numbers")) return "stats";
        if (set.Contains("partners") && set.Contains("section")) return "partner_grid";
        if (set.Contains("cases") && set.Contains("section")) return "case_cards";
        if (set.Contains("news") && set.Contains("section")) return "news_carousel";
        if (set.Contains("blogs") && set.Contains("section")) return "blog_list";
        if (set.Contains("about-pillars")) return "pillars";
        if (set.Contains("about-history")) return "timeline";
        if (set.Contains("about-ceo")) return "profile";
        if (set.Contains("about-leaders")) return "team_grid";
        if (set.Contains("problem")) return "problem";
        if (set.Contains("eswd-section")) return "feature_grid";
        if (set.Contains("method")) return "methodology";
        if (set.Contains("industries")) return "industries";
        if (set.Contains("partner-view-body")) return "partner_overview";
        if (set.Contains("partner-focus")) return "partner_focus";
        if (set.Contains("partner-view-related")) return "related_items";
        if (set.Contains("hub-cta")) return "call_to_action";
        if (set.Contains("contact-page")) return "contact_details";
        if (set.Contains("careers-values")) return "values";
        if (set.Contains("careers-opps")) return "vacancy_list";
        if (set.Contains("hub-section"))
        {
            return kind switch
            {
                "partners" => "partner_grid",
                "cases" => "case_cards",
                "blogs" => "blog_list",
                "news" => "news_carousel",
                _ => null,
            };
        }

        return null;
    }

    internal static bool IsBareSection(string classes)
    {
        var tokens = classes.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return tokens.Length == 0 || (tokens.Length == 1 && tokens[0] == "section");
    }

    internal static string ClassifyBare(string heading, ref bool sawProblem)
    {
        if (heading.Contains("Related", StringComparison.OrdinalIgnoreCase))
            return "related_items";
        if (heading.TrimEnd().EndsWith('?'))
            return "call_to_action";
        if (!sawProblem)
        {
            sawProblem = true;
            return "problem";
        }

        return "rich_text";
    }

    private static string Heading(AngleSharp.Dom.IElement section)
    {
        var heading = section.QuerySelector("h1, h2");
        var text = Regex.Replace(heading?.TextContent ?? "", @"\s+", " ").Trim();
        return text.Length <= 90 ? text : text[..90] + "...";
    }

    internal static string? NormalizeAsset(string src, string htmlSource, string root)
    {
        if (src.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
            return null;
        if (src.StartsWith("http://127.0.0.1", StringComparison.OrdinalIgnoreCase)
            || src.StartsWith("http://localhost", StringComparison.OrdinalIgnoreCase))
        {
            src = new Uri(src).AbsolutePath.TrimStart('/');
        }
        else if (src.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            || src.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var baseDir = Path.Combine(root, Path.GetDirectoryName(htmlSource.Replace('/', Path.DirectorySeparatorChar)) ?? "");
        var full = Path.GetFullPath(Path.Combine(baseDir, src.Replace('/', Path.DirectorySeparatorChar)));
        var relative = Path.GetRelativePath(root, full).Replace('\\', '/');
        if (relative.StartsWith("..", StringComparison.Ordinal))
            return null;
        return relative;
    }

    private static int TextLength(string? value) =>
        Regex.Replace(value ?? "", "<[^>]+>", " ").Trim().Length;

    private static string SlugFromHref(JsonElement item)
    {
        var href = item.GetProperty("href").GetString() ?? "";
        return Path.GetFileNameWithoutExtension(href.Replace('\\', '/'));
    }

    internal static IEnumerable<PageSpec> PageList()
    {
        yield return new("index.html", "page.home", "home");
        yield return new("about-us.html", "page.about", "about");
        yield return new("get-in-touch.html", "page.contact", "contact");
        yield return new("services/enterprise-software.html", "services.enterprise-software", "service");
        yield return new("services/data-analytics.html", "services.data-analytics", "service");
        yield return new("services/ai-automation.html", "services.ai-automation", "service");
        yield return new("services/outsourcing.html", "services.outsourcing", "service");
        yield return new("partners/index.html", "page.partners", "partners");
        yield return new("partners/microsoft.html", "partners.microsoft", "partner");
        yield return new("partners/huawei.html", "partners.huawei", "partner");
        yield return new("partners/nexthink.html", "partners.nexthink", "partner");
        yield return new("partners/efinance.html", "partners.efinance", "partner");
        yield return new("partners/vodafone.html", "partners.vodafone", "partner");
        yield return new("cases/index.html", "page.cases", "cases");
        yield return new("cases/ministry-planning.html", "case_studies.ministry-planning", "case");
        yield return new("cases/data-center-transformation.html", "case_studies.data-center-transformation", "case");
        yield return new("cases/nexthink-dex-bank.html", "case_studies.nexthink-dex-bank", "case");
        yield return new("blogs/index.html", "page.blogs", "blogs");
        yield return new("careers/index.html", "page.careers", "careers");
        yield return new("careers/apply.html", "page.apply", "apply");
        yield return new("news/index.html", "page.news", "news");
    }

    internal readonly record struct PageSpec(string Source, string Owner, string Kind);

    private readonly record struct ItemDecision(bool Import, string Label, string Reason);
}
