using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using AngleSharp.Dom;
using AngleSharp.Html.Parser;
using DigitalHub.Api.Content;
using DigitalHub.Api.Data;
using DigitalHub.Images;
using Microsoft.EntityFrameworkCore;

namespace DigitalHub.ContentImport;

static partial class ContentWriter
{
    public static Task<int> ApplyAsync(string sourceRoot, string connectionString, string? mediaRoot = null) =>
        ApplyCore(sourceRoot, connectionString, mediaRoot);

    private static async Task<int> PrintDatabaseAsync(string connectionString, ImportPlan plan, MediaWrite written, int changes, int sectionsReplaced)
    {
        var options = new DbContextOptionsBuilder<ContentDbContext>().UseSqlServer(connectionString).Options;
        await using var db = new ContentDbContext(options);
        Console.WriteLine();
        Console.WriteLine(changes == 0 ? "Database unchanged." : "Database rows inserted or updated: " + changes);
        Console.WriteLine("Sections replaced: " + sectionsReplaced);
        Console.WriteLine("Media files written: " + written.FilesWritten + "; reused: " + written.FilesReused + "; sizes generated: " + written.Sizes + "; variant files written this run: " + written.Variants + "; metadata stripped: " + written.MetadataStripped);
        if (written.Failures.Count == 0)
            Console.WriteLine("Media failures: none");
        else
            foreach (var failure in written.Failures)
                Console.WriteLine("Media failure: " + failure);

        var counts = new (string Name, int Count)[]
        {
            ("pages", await db.Pages.CountAsync()),
            ("services", await db.Services.CountAsync()),
            ("partners", await db.Partners.CountAsync()),
            ("case_studies", await db.CaseStudies.CountAsync()),
            ("blog_posts", await db.BlogPosts.CountAsync()),
            ("vacancies", await db.Vacancies.CountAsync()),
            ("team_members", await db.TeamMembers.CountAsync()),
            ("news_items", await db.NewsItems.CountAsync()),
            ("sections", await db.Sections.CountAsync()),
            ("media", await db.Media.CountAsync()),
            ("navigation_items", await db.NavigationItems.CountAsync()),
            ("site_settings", await db.SiteSettings.CountAsync()),
            ("contact_requests", await db.ContactRequests.CountAsync()),
            ("redirects", await db.Redirects.CountAsync()),
        };
        Console.WriteLine("Rows:");
        foreach (var count in counts)
            Console.WriteLine("  " + count.Name + ": " + count.Count);

        Console.WriteLine("Draft case studies: " + await db.CaseStudies.CountAsync(item => item.Status == ContentStatus.Draft) + " of " + await db.CaseStudies.CountAsync());
        Console.WriteLine("Draft blog posts: " + await db.BlogPosts.CountAsync(item => item.Status == ContentStatus.Draft) + " of " + await db.BlogPosts.CountAsync());
        Console.WriteLine("Published services: " + await db.Services.CountAsync(item => item.Status == ContentStatus.Published));
        Console.WriteLine("Published partners: " + await db.Partners.CountAsync(item => item.Status == ContentStatus.Published));
        Console.WriteLine("Published team members: " + await db.TeamMembers.CountAsync(item => item.Status == ContentStatus.Published));
        Console.WriteLine("Published news: " + await db.NewsItems.CountAsync(item => item.Status == ContentStatus.Published));
        Console.WriteLine("Published pages: " + await db.Pages.CountAsync(item => item.Status == ContentStatus.Published));
        Console.WriteLine("Catalog sections: " + plan.Pages.Sum(page => page.Sections.Count) + "; stored sections: " + counts.First(item => item.Name == "sections").Count);
        Console.WriteLine("Catalog images: " + plan.Images.Count(image => image.ReadError is null) + "; stored media: " + counts.First(item => item.Name == "media").Count);
        var duplicateHashes = await db.Media.GroupBy(item => item.ContentHash).CountAsync(group => group.Count() > 1);
        Console.WriteLine("Media rows that share a content hash: " + duplicateHashes);
        var sample = await db.Sections.AsNoTracking().Where(section => section.Type == "related_items").Select(section => section.Fields).FirstAsync();
        Console.WriteLine("Sample related_items: " + sample);
        var vacancy = await db.Sections.AsNoTracking().Where(section => section.Type == "vacancy_list").Select(section => section.Fields).FirstAsync();
        Console.WriteLine("Vacancy list: " + vacancy);
        var blog = await db.BlogPosts.AsNoTracking().Where(post => post.Slug == "digital-employee-experience").Select(post => post.Body).FirstAsync();
        var relatedAt = blog.IndexOf("relatedItems", StringComparison.Ordinal);
        Console.WriteLine("Blog relatedItems: " + (relatedAt < 0 ? "(missing)" : blog[relatedAt..]));
        var portraits = await db.TeamMembers.AsNoTracking()
            .OrderBy(member => member.SortOrder)
            .Select(member => member.Title + " -> " + member.Image!.OriginalName)
            .ToListAsync();
        foreach (var portrait in portraits)
            Console.WriteLine("Portrait: " + portrait);
        var alternates = await db.Media.AsNoTracking().CountAsync(item => item.OriginalName.Contains("headsss"));
        var alternateUse = await db.TeamMembers.CountAsync(member => member.Image!.OriginalName.Contains("headsss"));
        Console.WriteLine("Taller uploads in the library: " + alternates + "; used as a team portrait: " + alternateUse);
        return await ValidateStoredSectionsAsync(db);
    }

    private static async Task<int> ValidateStoredSectionsAsync(ContentDbContext db)
    {
        var schemas = SectionSchemas.Load();
        var rows = await db.Sections.AsNoTracking().Select(section => new { section.Type, section.Fields }).ToListAsync();
        var failures = 0;
        foreach (var row in rows)
        {
            if (!schemas.ByType.TryGetValue(row.Type, out var schema))
            {
                failures++;
                Console.WriteLine("Schema: no file for stored type " + row.Type);
                continue;
            }

            using var document = JsonDocument.Parse(row.Fields);
            if (schema.Evaluate(document.RootElement, schemas.Options).IsValid)
                continue;
            failures++;
            Console.WriteLine("Schema: stored " + row.Type + " failed");
        }

        Console.WriteLine("Stored sections: " + rows.Count + ". Schema failures: " + failures + ".");
        return failures;
    }

    private static string FindMediaRoot()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            var project = Path.Combine(dir.FullName, "src", "DigitalHub.Api", "DigitalHub.Api.csproj");
            if (File.Exists(project))
                return Path.Combine(dir.FullName, "src", "DigitalHub.Api", "media");
        }

        throw new InvalidOperationException("Could not find the API media folder.");
    }

    private static MediaWrite WriteMedia(string sourceRoot, string mediaRoot, ImportPlan plan)
    {
        Directory.CreateDirectory(mediaRoot);
        var result = new MediaWrite();
        foreach (var image in plan.Images)
        {
            if (image.ReadError is not null)
            {
                result.Failures.Add(image.Path + ": " + image.ReadError);
                continue;
            }

            var source = Path.Combine(sourceRoot, image.Path.Replace('/', Path.DirectorySeparatorChar));
            try
            {
                var processed = ImagePipeline.Process(File.ReadAllBytes(source));
                if (!processed.Succeeded)
                {
                    result.Failures.Add(image.Path + ": " + Describe(processed.Code));
                    continue;
                }

                result.MetadataStripped++;
                if (ImageFiles.WriteIfChanged(mediaRoot, processed.MainFileName, processed.Webp))
                    result.FilesWritten++;
                else
                    result.FilesReused++;

                foreach (var variant in processed.Variants)
                {
                    result.Sizes++;
                    if (ImageFiles.WriteIfChanged(mediaRoot, variant.FileName, variant.Webp))
                        result.Variants++;
                }

                var alt = image.Alts.FirstOrDefault() ?? "";
                if (alt.Length > 300)
                    alt = alt[..300];
                result.Assets[image.Path] = new MediaAsset
                {
                    Id = IdFor("media:" + image.Path),
                    Path = "/media/" + processed.MainFileName,
                    OriginalName = Path.GetFileName(image.Path),
                    ContentType = "image/webp",
                    Width = processed.Width,
                    Height = processed.Height,
                    Size = processed.Webp.Length,
                    GeneratedSizes = processed.GeneratedSizesJson(),
                    ContentHash = processed.Hash,
                    Alt = alt,
                    Decorative = image.Usages > 0 && image.DecorativeUsages == image.Usages,
                    CreatedAt = default,
                };
            }
            catch (Exception ex)
            {
                result.Failures.Add(image.Path + ": " + ex.GetType().Name);
            }
        }

        return result;
    }

    private static string Describe(string? code) => code switch
    {
        "too_large" => "file is over 5 MB",
        "svg_refused" => "SVG is not allowed",
        "unsupported_type" => "file is not a JPEG, PNG, or WebP",
        "too_many_pixels" => "image is over the pixel cap",
        "metadata" => "encoded WebP still contains metadata",
        _ => "SkiaSharp could not decode the file",
    };

    private static ImportModel Build(string sourceRoot, ImportPlan plan, Dictionary<string, MediaAsset> media)
    {
        _sourceRoot = sourceRoot;
        Probes.Clear();
        using var json = JsonDocument.Parse(File.ReadAllText(Path.Combine(sourceRoot, "content", "admin-content.json")));
        var collections = json.RootElement.GetProperty("collections");
        var parser = new HtmlParser();
        var documents = new Dictionary<string, AngleSharp.Html.Dom.IHtmlDocument>(StringComparer.OrdinalIgnoreCase);
        foreach (var page in Catalog.PageList())
            documents[page.Source] = parser.ParseDocument(File.ReadAllText(Path.Combine(sourceRoot, page.Source.Replace('/', Path.DirectorySeparatorChar))));
        foreach (var source in Catalog.ArticlePages)
            documents[source] = parser.ParseDocument(File.ReadAllText(Path.Combine(sourceRoot, source.Replace('/', Path.DirectorySeparatorChar))));

        var warnings = new List<string>();
        var model = new ImportModel();
        var sort = 0;
        foreach (var item in collections.GetProperty("services").EnumerateArray())
        {
            var slug = Path.GetFileNameWithoutExtension(Text(item, "href"));
            var stamp = Editorial(Text(item, "updatedAt"));
            model.Services.Add(new Service
            {
                Id = IdFor("service:" + slug),
                Slug = slug,
                Title = Required(Text(item, "title"), 300),
                Summary = Text(item, "summary"),
                Icon = Required(Text(item, "icon"), 80),
                Visual = Required(Text(item, "visual"), 80),
                Featured = Bool(item, "featured"),
                Status = ContentStatus.Published,
                SortOrder = Int(item, "order"),
                PublishedAt = stamp,
                CreatedAt = stamp ?? default,
                UpdatedAt = stamp ?? default,
                Version = 1,
            });
            sort++;
        }

        foreach (var item in collections.GetProperty("partners").EnumerateArray())
            model.Partners.Add(PartnerFrom(item, media, sourceRoot));
        foreach (var item in collections.GetProperty("caseStudies").EnumerateArray())
            model.Cases.Add(CaseFrom(item, media, sourceRoot));
        foreach (var item in collections.GetProperty("news").EnumerateArray())
            model.News.Add(NewsFrom(item, media, sourceRoot));
        foreach (var item in collections.GetProperty("team").EnumerateArray())
            model.Team.Add(TeamFrom(item, media, documents["about-us.html"], sourceRoot, warnings));

        AddBlogs(model, collections.GetProperty("blogs"), documents, media, sourceRoot, warnings);
        AddPages(model, documents, media, warnings);
        AddErrorPages(model);
        AddSections(model, documents, media, sourceRoot, warnings);
        AddNavigation(model, documents["index.html"], warnings);
        model.Settings = Settings(json.RootElement, documents);
        model.Warnings = warnings;
        foreach (var warning in warnings)
            Console.WriteLine("Warning: " + warning);
        _ = sort;
        _ = plan;
        return model;
    }

    private static void AddPages(ImportModel model, Dictionary<string, AngleSharp.Html.Dom.IHtmlDocument> documents, Dictionary<string, MediaAsset> media, List<string> warnings)
    {
        var order = 10;
        foreach (var page in Catalog.PageList())
        {
            if (!page.Owner.StartsWith("page.", StringComparison.Ordinal))
                continue;
            var slug = page.Owner["page.".Length..];
            var document = documents[page.Source];
            var record = new Page
            {
                Id = IdFor("page:" + slug),
                Slug = slug,
                Title = Required(HeadingText(document) ?? Meta(document, "og:title") ?? slug, 300),
                Status = ContentStatus.Published,
                SortOrder = order,
                Version = 1,
            };
            ApplySeo(record, document, media, page.Source, warnings);
            model.Pages.Add(record);
            order += 10;
        }
    }

    private static void AddErrorPages(ImportModel model)
    {
        var now = Stamp(DateTime.UtcNow);
        AddErrorPage(model, "404", "Page not found", Error404Body(), now, sortOrder: 900);
        AddErrorPage(model, "500", "Something went wrong", Error500Body(), now, sortOrder: 910);
    }

    private static void AddErrorPage(ImportModel model, string type, string title, string body, DateTime now, int sortOrder)
    {
        var slug = "error-" + type;
        var page = new Page
        {
            Id = IdFor("page:" + slug),
            Slug = slug,
            Title = title,
            Status = ContentStatus.Draft,
            SortOrder = sortOrder,
            Version = 1,
            NoIndex = true,
            CreatedAt = now,
            UpdatedAt = now,
        };
        model.Pages.Add(page);
        model.Sections.Add(new Section
        {
            Id = IdFor("section:page." + slug + ":0"),
            PageId = page.Id,
            Type = SectionTypes.RichText,
            SortOrder = 0,
            Visible = true,
            Fields = JsonSerializer.Serialize(new { heading = title, body }, ContentJson.Options),
        });
    }

    private static string Error404Body()
    {
        var links = new (string Label, string Slug)[]
        {
            ("Home", "home"),
            ("About", "about"),
            ("Partners", "partners"),
            ("Cases", "cases"),
            ("Blogs", "blogs"),
            ("Careers", "careers"),
            ("Contact", "contact"),
        };
        var nodes = new List<object>
        {
            new
            {
                type = "paragraph",
                content = new object[]
                {
                    new { type = "text", text = "That page is not here. These main sections still are:" },
                },
            },
        };
        foreach (var (label, slug) in links)
        {
            nodes.Add(new
            {
                type = "paragraph",
                content = new object[]
                {
                    new
                    {
                        type = "text",
                        text = label,
                        marks = new object[]
                        {
                            new
                            {
                                type = "link",
                                attrs = new
                                {
                                    type = "page",
                                    id = IdFor("page:" + slug).ToString("D"),
                                },
                            },
                        },
                    },
                },
            });
        }

        return JsonSerializer.Serialize(new { type = "doc", content = nodes }, ContentJson.Options);
    }

    private static string Error500Body() =>
        JsonSerializer.Serialize(new
        {
            type = "doc",
            content = new object[]
            {
                new
                {
                    type = "paragraph",
                    content = new object[]
                    {
                        new { type = "text", text = "Something went wrong on our side. Try again in a moment." },
                    },
                },
            },
        }, ContentJson.Options);

    private static void AddSections(ImportModel model, Dictionary<string, AngleSharp.Html.Dom.IHtmlDocument> documents, Dictionary<string, MediaAsset> media, string sourceRoot, List<string> warnings)
    {
        foreach (var page in Catalog.PageList())
        {
            var ownerId = OwnerId(page.Owner);
            if (ownerId is null)
                continue;
            var document = documents[page.Source];
            var main = document.QuerySelector("main");
            if (main is null)
                continue;
            var sawProblem = false;
            var sort = 0;
            foreach (var section in main.Children.Where(child => child.LocalName == "section"))
            {
                var classes = section.ClassName ?? "";
                var mapped = Catalog.MapSection(classes, page.Kind);
                if (mapped is null && Catalog.IsBareSection(classes))
                {
                    var heading = Collapse(section.QuerySelector("h1, h2")?.TextContent);
                    mapped = Catalog.ClassifyBare(heading, ref sawProblem);
                }

                if (mapped is null)
                    continue;

                var notes = new List<string>();
                var fields = Extract(mapped, section, page.Source, media, model, warnings, notes);
                Probes.Add(new SectionProbe
                {
                    Owner = page.Owner,
                    Type = mapped,
                    Source = page.Source,
                    Element = section,
                    Fields = fields,
                    Notes = notes,
                });
                var row = new Section
                {
                    Id = IdFor("section:" + page.Owner + ":" + sort),
                    Type = mapped,
                    SortOrder = sort * 10,
                    Visible = true,
                    Fields = fields.ToJsonString(),
                };
                AssignOwner(row, page.Owner, ownerId.Value);
                model.Sections.Add(row);
                sort++;
            }
        }

        _ = sourceRoot;
    }

    private static void AddBlogs(ImportModel model, JsonElement blogs, Dictionary<string, AngleSharp.Html.Dom.IHtmlDocument> documents, Dictionary<string, MediaAsset> media, string sourceRoot, List<string> warnings)
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in blogs.EnumerateArray())
        {
            var source = (Text(item, "href") ?? "").Replace('\\', '/');
            var slug = Path.GetFileNameWithoutExtension(source);
            seen.Add(slug);
            documents.TryGetValue(source, out var document);
            model.Blogs.Add(BlogFrom(item, document, slug, source, media, sourceRoot, warnings, htmlOnly: false));
        }

        var order = 50;
        foreach (var source in Catalog.ArticlePages)
        {
            var slug = Path.GetFileNameWithoutExtension(source);
            if (!seen.Add(slug))
                continue;
            var document = documents[source];
            var synthetic = JsonDocument.Parse("{}").RootElement;
            var blog = BlogFrom(synthetic, document, slug, source, media, sourceRoot, warnings, htmlOnly: true);
            blog.SortOrder = order;
            order += 10;
            model.Blogs.Add(blog);
        }
    }

    private static BlogPost BlogFrom(JsonElement item, AngleSharp.Html.Dom.IHtmlDocument? document, string slug, string source, Dictionary<string, MediaAsset> media, string sourceRoot, List<string> warnings, bool htmlOnly)
    {
        var title = htmlOnly ? HeadingText(document!) ?? slug : Text(item, "title");
        var summary = htmlOnly ? Meta(document!, "description") ?? "" : Text(item, "summary");
        var modified = htmlOnly ? BylineDate(document!, "Updated") : ParseDate(Text(item, "dateModified"));
        var created = htmlOnly ? BylineDate(document!, "Published") ?? modified : ParseDate(Text(item, "datePublished")) ?? modified;
        modified ??= created;
        var imagePath = htmlOnly
            ? Catalog.NormalizeAsset(document!.QuerySelector(".blog-view-media img")?.GetAttribute("src") ?? "", source, sourceRoot)
            : Catalog.NormalizeAsset(Text(item, "image"), "index.html", sourceRoot);
        var blog = new BlogPost
        {
            Id = IdFor("blog:" + slug),
            Slug = slug,
            Title = Required(title, 300),
            Summary = summary,
            Status = ContentStatus.Draft,
            SortOrder = htmlOnly ? 0 : Int(item, "order"),
            PublishedAt = null,
            CreatedAt = created ?? default,
            UpdatedAt = modified ?? created ?? default,
            DateModified = modified,
            Version = 1,
            Category = Required(htmlOnly ? Slugify(document!.QuerySelector(".blog-view-tag")?.TextContent) : Text(item, "category"), 80),
            CategoryLabel = Required(htmlOnly ? Collapse(document!.QuerySelector(".blog-view-tag")?.TextContent) : Text(item, "categoryLabel"), 80),
            ReadTime = htmlOnly ? ReadTime(document!) : Int(item, "readTime"),
            Accent = Required(htmlOnly ? Accent(document!) : Text(item, "accent"), 40),
            Cluster = htmlOnly ? "" : Required(Text(item, "cluster"), 80),
            Body = ArticleBody(document, source, media, warnings),
            AnswerBlock = Blank(Text(item, "answerBlock")),
            Faq = """{"items":[]}""",
            Featured = !htmlOnly && Bool(item, "featured"),
        };
        if (imagePath is not null && media.TryGetValue(imagePath, out var asset))
        {
            blog.ImageId = asset.Id;
            var alt = htmlOnly
                ? document!.QuerySelector(".blog-view-media img")?.GetAttribute("alt")
                : Text(item, "alt");
            if (!string.IsNullOrWhiteSpace(alt) && !string.Equals(alt.Trim(), asset.Alt, StringComparison.Ordinal))
                blog.ImageAltOverride = Cut(alt.Trim(), 300);
        }

        if (document is not null)
            ApplySeo(blog, document, media, source, warnings);
        return blog;
    }

    private static string ArticleBody(AngleSharp.Html.Dom.IHtmlDocument? document, string source, Dictionary<string, MediaAsset> media, List<string> warnings)
    {
        var content = new JsonArray();
        var article = document?.QuerySelector("article.blog-view-article");
        if (article is not null)
        {
            var toc = article.QuerySelector("nav.blog-view-toc");
            foreach (var child in article.Children)
            {
                if (child == toc)
                    continue;
                Walk(child, content, source, media, warnings, includeHeadings: true);
            }
        }

        var body = new JsonObject
        {
            ["type"] = "doc",
            ["content"] = content,
        };
        var pillar = document?.QuerySelector("a.blog-view-pillar");
        var reference = Links.Reference(Links.Rewrite(pillar?.GetAttribute("href"), source).Clean);
        if (reference is { } item)
        {
            body["relatedItems"] = new JsonArray
            {
                new JsonObject { ["type"] = item.Type, ["id"] = ReferenceId(item.Type, item.Slug).ToString("D") },
            };
        }

        return body.ToJsonString();
    }

    private static Partner PartnerFrom(JsonElement item, Dictionary<string, MediaAsset> media, string sourceRoot)
    {
        var slug = Path.GetFileNameWithoutExtension(Text(item, "href"));
        var stamp = Editorial(Text(item, "updatedAt"));
        var partner = new Partner
        {
            Id = IdFor("partner:" + slug),
            Slug = slug,
            Title = Required(Text(item, "name"), 300),
            Summary = Text(item, "summary"),
            Variant = Required(Text(item, "variant"), 40),
            Featured = Bool(item, "featured"),
            Status = ContentStatus.Published,
            SortOrder = Int(item, "order"),
            PublishedAt = stamp,
            CreatedAt = stamp ?? default,
            UpdatedAt = stamp ?? default,
            Version = 1,
        };
        AttachImage(partner, item, media, sourceRoot, (row, id) => row.ImageId = id, (row, alt) => row.ImageAltOverride = alt);
        return partner;
    }

    private static CaseStudy CaseFrom(JsonElement item, Dictionary<string, MediaAsset> media, string sourceRoot)
    {
        var id = Text(item, "id");
        var slug = id == "case-national-portal" ? "national-portal" : Path.GetFileNameWithoutExtension(Text(item, "href"));
        var stamp = Editorial(Text(item, "updatedAt"));
        var study = new CaseStudy
        {
            Id = IdFor("case:" + slug),
            Slug = slug,
            Title = Required(Text(item, "title"), 300),
            Summary = Text(item, "summary"),
            Metric = Required(Text(item, "metric"), 200),
            Categories = item.TryGetProperty("categories", out var categories)
                ? categories.EnumerateArray().Select(category => category.GetString() ?? "").Where(category => category.Length > 0).ToList()
                : [],
            Featured = Bool(item, "featured"),
            Status = ContentStatus.Draft,
            SortOrder = Int(item, "order"),
            PublishedAt = null,
            CreatedAt = stamp ?? default,
            UpdatedAt = stamp ?? default,
            Version = 1,
        };
        AttachImage(study, item, media, sourceRoot, (row, imageId) => row.ImageId = imageId, (row, alt) => row.ImageAltOverride = alt);
        return study;
    }

    private static NewsItem NewsFrom(JsonElement item, Dictionary<string, MediaAsset> media, string sourceRoot)
    {
        var slug = (Text(item, "id") ?? "").Replace("news-", "", StringComparison.Ordinal);
        var stamp = Editorial(Text(item, "updatedAt"));
        var news = new NewsItem
        {
            Id = IdFor("news:" + slug),
            Slug = slug,
            Title = Required(Text(item, "title"), 300),
            Summary = Text(item, "summary"),
            Details = Text(item, "details"),
            Category = Required(Text(item, "category"), 80),
            Location = Required(Text(item, "location"), 120),
            Year = Required(Text(item, "year"), 8),
            Month = Required(Text(item, "month"), 16),
            Featured = Bool(item, "featured"),
            Status = ContentStatus.Published,
            SortOrder = Int(item, "order"),
            PublishedAt = stamp,
            CreatedAt = stamp ?? default,
            UpdatedAt = stamp ?? default,
            Version = 1,
        };
        AttachImage(news, item, media, sourceRoot, (row, imageId) => row.ImageId = imageId, (row, alt) => row.ImageAltOverride = alt);
        return news;
    }

    private static TeamMember TeamFrom(JsonElement item, Dictionary<string, MediaAsset> media, AngleSharp.Html.Dom.IHtmlDocument about, string sourceRoot, List<string> warnings)
    {
        var slug = (Text(item, "id") ?? "").Replace("team-", "", StringComparison.Ordinal);
        var stamp = Editorial(Text(item, "updatedAt"));
        var portrait = "assets/team/" + slug + ".webp";
        var member = new TeamMember
        {
            Id = IdFor("team:" + slug),
            Slug = slug,
            Title = Required(Text(item, "name"), 300),
            Role = Required(Text(item, "role"), 160),
            Email = Blank(Text(item, "email")),
            LinkedIn = Blank(Text(item, "linkedin")),
            Featured = Bool(item, "featured"),
            Status = ContentStatus.Published,
            SortOrder = Int(item, "order"),
            PublishedAt = stamp,
            CreatedAt = stamp ?? default,
            UpdatedAt = stamp ?? default,
            Version = 1,
        };
        if (media.TryGetValue(portrait, out var asset))
        {
            member.ImageId = asset.Id;
            var shown = about.QuerySelectorAll(".about-leaders img")
                .FirstOrDefault(img => (Catalog.NormalizeAsset(img.GetAttribute("src") ?? "", "about-us.html", sourceRoot) ?? "")
                    .Equals(portrait, StringComparison.OrdinalIgnoreCase))
                ?.GetAttribute("alt");
            if (!string.IsNullOrWhiteSpace(shown) && !string.Equals(shown.Trim(), asset.Alt, StringComparison.Ordinal))
                member.ImageAltOverride = Cut(shown.Trim(), 300);
        }
        else
        {
            warnings.Add("Missing About-page portrait for " + slug);
        }

        return member;
    }

    private static void AttachImage<T>(T row, JsonElement item, Dictionary<string, MediaAsset> media, string sourceRoot, Action<T, Guid> setId, Action<T, string?> setAlt)
    {
        var path = Catalog.NormalizeAsset(Text(item, "image"), "index.html", sourceRoot);
        if (path is null || !media.TryGetValue(path, out var asset))
            return;
        setId(row, asset.Id);
        var alt = Text(item, "alt");
        setAlt(row, !string.IsNullOrWhiteSpace(alt) && !string.Equals(alt.Trim(), asset.Alt, StringComparison.Ordinal) ? Cut(alt.Trim(), 300) : null);
    }

    private static void AddNavigation(ImportModel model, AngleSharp.Html.Dom.IHtmlDocument index, List<string> warnings)
    {
        var sort = 0;
        var list = index.QuerySelector("ul.nav-links");
        if (list is not null)
        {
            foreach (var item in list.Children.Where(child => child.LocalName == "li"))
            {
                var anchor = item.Children.FirstOrDefault(child => child.LocalName is "a");
                var label = Collapse(anchor?.TextContent) ?? "";
                var parent = Nav("header", label, anchor?.GetAttribute("href"), "index.html", sort, null, warnings);
                if (parent is not null)
                    model.Navigation.Add(parent);
                sort += 10;
                if (parent is null)
                    continue;
                var childSort = 0;
                foreach (var child in item.QuerySelectorAll(".dd a"))
                {
                    var link = Nav("header", Collapse(child.TextContent) ?? "", child.GetAttribute("href"), "index.html", childSort, parent.Id, warnings);
                    if (link is not null)
                        model.Navigation.Add(link);
                    childSort += 10;
                }
            }
        }

        var cta = index.QuerySelector("a.nav-cta");
        if (cta is not null)
        {
            var link = Nav("header", Collapse(cta.TextContent) ?? "", cta.GetAttribute("href"), "index.html", sort, null, warnings);
            if (link is not null)
                model.Navigation.Add(link);
        }

        sort = 0;
        foreach (var column in index.QuerySelectorAll("footer.footer .footer-col"))
        {
            var parent = Nav("footer", Collapse(column.QuerySelector("h4")?.TextContent) ?? "Column", null, "index.html", sort, null, warnings);
            if (parent is not null)
                model.Navigation.Add(parent);
            sort += 10;
            if (parent is null)
                continue;
            var childSort = 0;
            foreach (var anchor in column.QuerySelectorAll("a"))
            {
                var link = Nav("footer", Collapse(anchor.TextContent) ?? "", anchor.GetAttribute("href"), "index.html", childSort, parent.Id, warnings);
                if (link is not null)
                    model.Navigation.Add(link);
                childSort += 10;
            }
        }

        var contact = index.QuerySelector("footer.footer .footer-contact");
        if (contact is not null)
        {
            var parent = Nav("footer", Collapse(contact.QuerySelector("h4")?.TextContent) ?? "Contact", null, "index.html", sort, null, warnings);
            if (parent is null)
                return;
            model.Navigation.Add(parent);
            var childSort = 0;
            foreach (var anchor in contact.QuerySelectorAll("a"))
            {
                var label = Collapse(anchor.TextContent);
                if (string.IsNullOrWhiteSpace(label))
                    label = anchor.GetAttribute("aria-label") ?? anchor.GetAttribute("href") ?? "";
                var link = Nav("footer", label, anchor.GetAttribute("href"), "index.html", childSort, parent.Id, warnings);
                if (link is not null)
                    model.Navigation.Add(link);
                childSort += 10;
            }
        }
    }

    private static NavigationItem? Nav(string menu, string label, string? href, string fromPage, int sort, Guid? parentId, List<string> warnings)
    {
        var id = IdFor("nav:" + menu + ":" + (parentId?.ToString("D") ?? "root") + ":" + sort + ":" + label);
        var text = Required(label, 160);
        if (string.IsNullOrWhiteSpace(href))
        {
            return new NavigationItem
            {
                Id = id,
                Menu = menu,
                ParentId = parentId,
                Label = text,
                LinkKind = "group",
                SortOrder = sort,
            };
        }

        var result = Links.Rewrite(href, fromPage);
        if (BelongsInSiteSettings(href, result))
        {
            warnings.Add("Navigation omits \"" + text + "\"; the footer reads it from site settings.");
            return null;
        }

        var reference = Links.Reference(result.Clean);
        if (reference is { } item)
        {
            return InternalNav(id, menu, parentId, text, sort, item.Type, ReferenceId(item.Type, item.Slug));
        }

        if (PageSlug(result.Clean) is string page)
            return InternalNav(id, menu, parentId, text, sort, "page", ReferenceId("page", page));

        warnings.Add("Navigation link \"" + text + "\" (" + href + ") is not an internal target and was not imported.");
        return null;
    }

    private static bool BelongsInSiteSettings(string href, LinkResult result)
    {
        var raw = href.Trim();
        if (raw.StartsWith("mailto:", StringComparison.OrdinalIgnoreCase)
            || raw.StartsWith("tel:", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return !result.Internal
            && (raw.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
                || raw.StartsWith("https://", StringComparison.OrdinalIgnoreCase));
    }

    private static NavigationItem InternalNav(Guid id, string menu, Guid? parentId, string label, int sort, string targetType, Guid targetId) =>
        new()
        {
            Id = id,
            Menu = menu,
            ParentId = parentId,
            Label = label,
            LinkKind = "internal",
            TargetType = targetType,
            TargetId = targetId,
            SortOrder = sort,
        };

    private static SiteSettings Settings(JsonElement root, Dictionary<string, AngleSharp.Html.Dom.IHtmlDocument> documents)
    {
        var home = documents["index.html"];
        var contact = documents["get-in-touch.html"];
        var social = root.GetProperty("pages").GetProperty("home").GetProperty("social");
        var phone = contact.QuerySelector("a[href^='tel:']");
        var mail = contact.QuerySelector("a[href^='mailto:']");
        var whatsApp = contact.QuerySelector("a[href^='https://wa.me/']")?.GetAttribute("href");
        var bottom = string.Join(" ", home.QuerySelectorAll("footer.footer .footer-bottom span").Select(span => Collapse(span.TextContent)));
        var address = ReadPostalAddress(contact);
        return new SiteSettings
        {
            Id = IdFor("site-settings"),
            Phone = Cut(Collapse(phone?.TextContent), 40),
            WhatsApp = Cut(whatsApp, 40),
            Email = Cut(mail?.GetAttribute("href")?.Replace("mailto:", "", StringComparison.OrdinalIgnoreCase), 320),
            LinkedIn = Cut(Text(social, "linkedin"), 300),
            Facebook = Cut(Text(social, "facebook"), 300),
            Instagram = Cut(Text(social, "instagram"), 300),
            TikTok = Cut(Text(social, "tiktok"), 300),
            FooterText = string.IsNullOrWhiteSpace(bottom) ? null : bottom,
            StreetAddress = Cut(address?.Street, 300),
            Locality = Cut(address?.Locality, 120),
            Region = Cut(address?.Region, 120),
            PostalCode = Cut(address?.PostalCode, 20),
            Country = Cut(address?.Country, 80),
            DefaultMetaTitle = Cut(Meta(home, "og:title") ?? home.Title, 300),
            DefaultMetaDescription = Cut(Meta(home, "description"), 500),
            OrganizationName = "Digital Hub",
            LegalName = "Digital Hub S.A.E.",
        };
    }

    private static PostalAddressParts? ReadPostalAddress(AngleSharp.Html.Dom.IHtmlDocument contact)
    {
        foreach (var script in contact.QuerySelectorAll("script[type='application/ld+json']"))
        {
            try
            {
                using var json = JsonDocument.Parse(script.TextContent);
                var address = FindAddress(json.RootElement);
                if (address is not null)
                    return address;
            }
            catch (JsonException)
            {
                continue;
            }
        }

        return null;
    }

    private static PostalAddressParts? FindAddress(JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            if (element.TryGetProperty("streetAddress", out _))
            {
                return new PostalAddressParts(
                    Text(element, "streetAddress"),
                    Text(element, "addressLocality"),
                    Text(element, "addressRegion"),
                    Text(element, "postalCode"),
                    Text(element, "addressCountry"));
            }

            foreach (var property in element.EnumerateObject())
            {
                var found = FindAddress(property.Value);
                if (found is not null)
                    return found;
            }
        }
        else if (element.ValueKind == JsonValueKind.Array)
        {
            foreach (var child in element.EnumerateArray())
            {
                var found = FindAddress(child);
                if (found is not null)
                    return found;
            }
        }

        return null;
    }

    private static JsonObject RelatedFields(IElement section, string fromPage)
    {
        var items = new JsonArray();
        foreach (var anchor in section.QuerySelectorAll("a[href]"))
        {
            var reference = Links.Reference(Links.Rewrite(anchor.GetAttribute("href"), fromPage).Clean);
            if (reference is null)
                continue;
            var card = Card(anchor);
            var title = Collapse(card.QuerySelector("h3")?.TextContent) ?? Collapse(anchor.TextContent) ?? "";
            var text = string.Join(" ", card.QuerySelectorAll("p").Select(paragraph => Collapse(paragraph.TextContent)).Where(paragraph => paragraph is not null));
            items.Add(new JsonObject
            {
                ["type"] = reference.Value.Type,
                ["id"] = ReferenceId(reference.Value.Type, reference.Value.Slug).ToString("D"),
                ["title"] = title,
                ["text"] = text,
            });
        }

        return new JsonObject
        {
            ["heading"] = Collapse(section.QuerySelector("h1, h2")?.TextContent) ?? "",
            ["items"] = items,
        };
    }

    private static JsonObject VacancyFields(IElement section) => new()
    {
        ["heading"] = Collapse(section.QuerySelector("h1, h2")?.TextContent) ?? "",
        ["lead"] = Collapse(section.QuerySelector("p")?.TextContent) ?? "",
        ["items"] = new JsonArray(),
    };

    private static JsonObject BodyFields(IElement section, string fromPage, Dictionary<string, MediaAsset> media, List<string> warnings)
    {
        var content = new JsonArray();
        var heading = "";
        var tookHeading = false;
        WalkSection(section, content, fromPage, media, warnings, ref heading, ref tookHeading);
        var fields = new JsonObject
        {
            ["heading"] = heading,
            ["body"] = new JsonObject { ["type"] = "doc", ["content"] = content },
        };
        return fields;
    }

    private static void WalkSection(IElement element, JsonArray content, string fromPage, Dictionary<string, MediaAsset> media, List<string> warnings, ref string heading, ref bool tookHeading, bool captureHeading = true)
    {
        if (element.GetAttribute("aria-hidden") == "true")
            return;
        if (element.LocalName is "script" or "style" or "svg" or "noscript")
            return;
        if (element.LocalName == "form")
        {
            content.Add(FormNode(element));
            return;
        }

        switch (element.LocalName)
        {
            case "h1" or "h2" when captureHeading && !tookHeading:
                heading = Collapse(element.TextContent) ?? "";
                tookHeading = true;
                return;
            case "h1":
                content.Add(HeadingNode(element, 2, fromPage));
                return;
            case "h2" or "h3" or "h4":
                content.Add(HeadingNode(element, element.LocalName[1] - '0', fromPage));
                return;
            case "p":
                var paragraph = Paragraph(element, fromPage);
                if (paragraph is not null)
                    content.Add(paragraph);
                return;
            case "ul" or "ol":
                content.Add(ListNode(element, fromPage));
                return;
            case "blockquote":
                var quote = Paragraph(element, fromPage);
                if (quote is not null)
                    content.Add(new JsonObject { ["type"] = "blockquote", ["content"] = new JsonArray { quote } });
                return;
            case "img":
                var image = ImageNode(element, fromPage, media, warnings);
                if (image is not null)
                    content.Add(image);
                return;
            case "a":
                if (Links.IsDroppedCareer(element.GetAttribute("href")))
                    return;
                var linkParagraph = Paragraph(element, fromPage);
                if (linkParagraph is not null)
                    content.Add(linkParagraph);
                return;
            default:
                foreach (var child in element.Children)
                    WalkSection(child, content, fromPage, media, warnings, ref heading, ref tookHeading, captureHeading);
                return;
        }
    }

    private static void Walk(IElement element, JsonArray content, string fromPage, Dictionary<string, MediaAsset> media, List<string> warnings, bool includeHeadings)
    {
        var heading = "";
        var took = false;
        WalkSection(element, content, fromPage, media, warnings, ref heading, ref took, captureHeading: !includeHeadings);
        if (includeHeadings && heading.Length > 0)
        {
            content.Insert(0, new JsonObject
            {
                ["type"] = "heading",
                ["attrs"] = new JsonObject { ["level"] = 2 },
                ["content"] = new JsonArray { new JsonObject { ["type"] = "text", ["text"] = heading } },
            });
        }
    }

    private static JsonObject HeadingNode(IElement element, int level, string fromPage) => new()
    {
        ["type"] = "heading",
        ["attrs"] = new JsonObject { ["level"] = level },
        ["content"] = Inline(element, fromPage),
    };

    private static JsonObject? Paragraph(IElement element, string fromPage)
    {
        var content = Inline(element, fromPage);
        if (content.Count == 0)
            return null;
        return new JsonObject { ["type"] = "paragraph", ["content"] = content };
    }

    private static JsonObject ListNode(IElement element, string fromPage)
    {
        var items = new JsonArray();
        foreach (var item in element.Children.Where(child => child.LocalName == "li"))
        {
            var paragraph = Paragraph(item, fromPage) ?? new JsonObject
            {
                ["type"] = "paragraph",
                ["content"] = new JsonArray(),
            };
            items.Add(new JsonObject { ["type"] = "listItem", ["content"] = new JsonArray { paragraph } });
        }

        return new JsonObject
        {
            ["type"] = element.LocalName == "ol" ? "orderedList" : "bulletList",
            ["content"] = items,
        };
    }

    private static JsonObject FormNode(IElement form)
    {
        var names = new JsonArray();
        foreach (var field in form.QuerySelectorAll("input[name], select[name], textarea[name]"))
        {
            var name = field.GetAttribute("name");
            if (string.IsNullOrWhiteSpace(name) || name == "website")
                continue;
            names.Add(name);
        }

        return new JsonObject
        {
            ["type"] = "form",
            ["attrs"] = new JsonObject
            {
                ["fields"] = names,
                ["note"] = "The form belongs to this section. Submission handling is not imported.",
            },
        };
    }

    private static JsonArray Inline(IElement element, string fromPage)
    {
        var output = new JsonArray();
        AppendInline(element, output, fromPage, []);
        TrimEdges(output);
        return output;
    }

    private static void AppendInline(INode node, JsonArray output, string fromPage, IReadOnlyList<JsonObject> marks)
    {
        foreach (var child in node.ChildNodes)
        {
            if (child.NodeType == NodeType.Text)
            {
                var text = Regex.Replace(child.TextContent, @"\s+", " ");
                if (string.IsNullOrEmpty(text) || text == " " && output.Count == 0)
                    continue;
                var textNode = new JsonObject { ["type"] = "text", ["text"] = text };
                if (marks.Count > 0)
                {
                    var copied = new JsonArray();
                    foreach (var mark in marks)
                        copied.Add(mark.DeepClone());
                    textNode["marks"] = copied;
                }

                output.Add(textNode);
                continue;
            }

            if (child is not IElement element)
                continue;
            if (element.GetAttribute("aria-hidden") == "true")
                continue;
            var className = element.ClassName ?? "";
            if (className.Contains("ti ", StringComparison.Ordinal) || className is "ti")
                continue;
            switch (element.LocalName)
            {
                case "strong" or "b":
                    AppendInline(element, output, fromPage, [.. marks, new JsonObject { ["type"] = "bold" }]);
                    break;
                case "em" or "i":
                    AppendInline(element, output, fromPage, [.. marks, new JsonObject { ["type"] = "italic" }]);
                    break;
                case "code":
                    AppendInline(element, output, fromPage, [.. marks, new JsonObject { ["type"] = "code" }]);
                    break;
                case "br":
                    output.Add(new JsonObject { ["type"] = "text", ["text"] = " " });
                    break;
                case "a":
                    if (Links.IsDroppedCareer(element.GetAttribute("href")))
                        break;
                    var rewritten = Links.Rewrite(element.GetAttribute("href"), fromPage);
                    var href = rewritten.Clean ?? element.GetAttribute("href") ?? "";
                    var link = LinkMark(href);
                    if (link is null)
                        AppendInline(element, output, fromPage, marks);
                    else
                        AppendInline(element, output, fromPage, [.. marks, link]);
                    break;
                default:
                    AppendInline(element, output, fromPage, marks);
                    break;
            }
        }
    }

    private static void TrimEdges(JsonArray content)
    {
        if (content.Count == 0)
            return;
        TrimOne(content[0] as JsonObject, leading: true);
        TrimOne(content[^1] as JsonObject, leading: false);
        for (var i = content.Count - 1; i >= 0; i--)
        {
            if (content[i] is JsonObject node && node["text"]?.GetValue<string>() is "")
                content.RemoveAt(i);
        }
    }

    private static void TrimOne(JsonObject? node, bool leading)
    {
        if (node?["text"]?.GetValue<string>() is not string text)
            return;
        node["text"] = leading ? text.TrimStart() : text.TrimEnd();
    }

    private static JsonObject? ImageNode(IElement img, string fromPage, Dictionary<string, MediaAsset> media, List<string> warnings)
    {
        if (img.GetAttribute("aria-hidden") == "true")
            return null;
        var path = Catalog.NormalizeAsset(img.GetAttribute("src") ?? "", fromPage, SourceRoot(media));
        if (path is null)
            return null;
        if (!media.TryGetValue(path, out var asset))
        {
            warnings.Add("No media row for " + path);
            return null;
        }

        var alt = (img.GetAttribute("alt") ?? "").Trim();
        var attrs = new JsonObject
        {
            ["mediaId"] = asset.Id.ToString("D"),
            ["decorative"] = string.IsNullOrWhiteSpace(alt),
        };
        if (!string.IsNullOrWhiteSpace(alt) && !string.Equals(alt, asset.Alt, StringComparison.Ordinal))
            attrs["altOverride"] = Cut(alt, 300);
        return new JsonObject { ["type"] = "image", ["attrs"] = attrs };
    }

    private static string SourceRoot(Dictionary<string, MediaAsset> media)
    {
        _ = media;
        return _sourceRoot;
    }

    private static string _sourceRoot = "";

    private static void ApplySeo(ContentRecord record, AngleSharp.Html.Dom.IHtmlDocument document, Dictionary<string, MediaAsset> media, string source, List<string> warnings)
    {
        record.MetaTitle = Cut(document.Title, 300);
        record.MetaDescription = Cut(Meta(document, "description"), 500);
        var image = document.QuerySelector("meta[property='og:image']")?.GetAttribute("content");
        if (string.IsNullOrWhiteSpace(image))
            return;
        if (image.StartsWith("https://digitalhub.com.eg/", StringComparison.OrdinalIgnoreCase))
            image = image["https://digitalhub.com.eg/".Length..].TrimStart('/');
        var path = image.StartsWith("assets/", StringComparison.OrdinalIgnoreCase)
            ? image
            : Catalog.NormalizeAsset(image, source, _sourceRoot);
        if (path is not null && media.TryGetValue(path, out var asset))
            record.ShareImageId = asset.Id;
        else if (path is not null)
            warnings.Add("Share image was not imported for " + source);
    }

    private static async Task<(int Changes, int Sections)> SaveAsync(string connectionString, ImportModel model)
    {
        var options = new DbContextOptionsBuilder<ContentDbContext>().UseSqlServer(connectionString).Options;
        await using var db = new ContentDbContext(options);
        var changes = 0;
        changes += UpsertMedia(db, model.Media, await db.Media.AsNoTracking().ToDictionaryAsync(item => item.Id));
        changes += UpsertRecord(db, model.Services, await db.Services.AsNoTracking().ToDictionaryAsync(item => item.Id), SameService);
        changes += UpsertRecord(db, model.Partners, await db.Partners.AsNoTracking().ToDictionaryAsync(item => item.Id), SamePartner);
        changes += UpsertRecord(db, model.Cases, await db.CaseStudies.AsNoTracking().ToDictionaryAsync(item => item.Id), SameCase);
        changes += UpsertRecord(db, model.Blogs, await db.BlogPosts.AsNoTracking().ToDictionaryAsync(item => item.Id), SameBlog);
        changes += UpsertRecord(db, model.Team, await db.TeamMembers.AsNoTracking().ToDictionaryAsync(item => item.Id), SameTeam);
        changes += UpsertRecord(db, model.News, await db.NewsItems.AsNoTracking().ToDictionaryAsync(item => item.Id), SameNews);
        changes += UpsertRecord(db, model.Pages, await db.Pages.AsNoTracking().ToDictionaryAsync(item => item.Id), SamePage);
        var sections = Upsert(db, model.Sections, await db.Sections.AsNoTracking().ToDictionaryAsync(item => item.Id), SameSection);
        changes += sections;
        changes += Upsert(db, model.Navigation, await db.NavigationItems.AsNoTracking().ToDictionaryAsync(item => item.Id), SameNav);
        changes += Upsert(db, [model.Settings], await db.SiteSettings.AsNoTracking().ToDictionaryAsync(item => item.Id), SameSettings);
        await db.SaveChangesAsync();
        return (changes, sections);
    }

    private static int Upsert<T>(ContentDbContext db, IReadOnlyList<T> desired, Dictionary<Guid, T> current, Func<T, T, bool> same)
        where T : class
    {
        var changes = 0;
        foreach (var item in desired)
        {
            var id = IdOf(item);
            if (!current.TryGetValue(id, out var existing))
            {
                db.Add(item);
                changes++;
                continue;
            }

            if (same(existing, item))
                continue;
            db.Update(item);
            changes++;
        }

        return changes;
    }

    private static int UpsertMedia(ContentDbContext db, IReadOnlyList<MediaAsset> desired, Dictionary<Guid, MediaAsset> current)
    {
        var changes = 0;
        var now = Stamp(DateTime.UtcNow);
        foreach (var item in desired)
        {
            if (!current.TryGetValue(item.Id, out var existing))
            {
                if (item.CreatedAt == default)
                    item.CreatedAt = now;
                db.Add(item);
                changes++;
                continue;
            }

            item.CreatedAt = existing.CreatedAt;
            if (SameMedia(existing, item))
                continue;
            db.Update(item);
            changes++;
        }

        return changes;
    }

    private static int UpsertRecord<T>(ContentDbContext db, IReadOnlyList<T> desired, Dictionary<Guid, T> current, Func<T, T, bool> same)
        where T : ContentRecord
    {
        var changes = 0;
        var now = Stamp(DateTime.UtcNow);
        foreach (var item in desired)
        {
            var editorialCreated = item.CreatedAt;
            var editorialUpdated = item.UpdatedAt;
            var editorialPublished = item.PublishedAt;
            if (!current.TryGetValue(item.Id, out var existing))
            {
                if (item.CreatedAt == default)
                    item.CreatedAt = now;
                if (item.UpdatedAt == default)
                    item.UpdatedAt = now;
                if (item.Status == ContentStatus.Published && item.PublishedAt is null)
                    item.PublishedAt = item.UpdatedAt;
                db.Add(item);
                changes++;
                continue;
            }

            item.Version = existing.Version;
            if (item.CreatedAt == default)
                item.CreatedAt = existing.CreatedAt;
            if (item.UpdatedAt == default)
                item.UpdatedAt = existing.UpdatedAt;
            if (item.PublishedAt is null)
                item.PublishedAt = existing.PublishedAt;
            if (same(existing, item))
                continue;

            item.CreatedAt = editorialCreated == default ? existing.CreatedAt : editorialCreated;
            item.UpdatedAt = editorialUpdated == default ? now : editorialUpdated;
            item.PublishedAt = editorialPublished ?? existing.PublishedAt;
            db.Update(item);
            changes++;
        }

        return changes;
    }

    private static Guid IdOf<T>(T item) => item switch
    {
        MediaAsset media => media.Id,
        Service service => service.Id,
        Partner partner => partner.Id,
        CaseStudy study => study.Id,
        BlogPost blog => blog.Id,
        TeamMember member => member.Id,
        NewsItem news => news.Id,
        Page page => page.Id,
        Section section => section.Id,
        NavigationItem navigation => navigation.Id,
        SiteSettings settings => settings.Id,
        _ => throw new InvalidOperationException("No id for " + typeof(T).Name),
    };

    private static bool SameRecord(ContentRecord left, ContentRecord right) =>
        left.Slug == right.Slug && left.Title == right.Title && left.Status == right.Status && left.SortOrder == right.SortOrder
        && T(left.PublishedAt) == T(right.PublishedAt) && T(left.CreatedAt) == T(right.CreatedAt) && T(left.UpdatedAt) == T(right.UpdatedAt)
        && left.Version == right.Version && left.MetaTitle == right.MetaTitle && left.MetaDescription == right.MetaDescription
        && left.ShareImageId == right.ShareImageId && left.ShareImageAltOverride == right.ShareImageAltOverride
        && left.CanonicalOverride == right.CanonicalOverride && left.NoIndex == right.NoIndex;

    private static bool SameService(Service left, Service right) =>
        SameRecord(left, right) && left.Summary == right.Summary && left.Icon == right.Icon && left.Visual == right.Visual && left.Featured == right.Featured;

    private static bool SamePartner(Partner left, Partner right) =>
        SameRecord(left, right) && left.Summary == right.Summary && left.ImageId == right.ImageId && left.ImageAltOverride == right.ImageAltOverride && left.Variant == right.Variant && left.Featured == right.Featured;

    private static bool SameCase(CaseStudy left, CaseStudy right) =>
        SameRecord(left, right) && left.Summary == right.Summary && left.ImageId == right.ImageId && left.ImageAltOverride == right.ImageAltOverride
        && left.Metric == right.Metric && left.Featured == right.Featured && left.Categories.SequenceEqual(right.Categories);

    private static bool SameBlog(BlogPost left, BlogPost right) =>
        SameRecord(left, right) && left.Summary == right.Summary && left.ImageId == right.ImageId && left.ImageAltOverride == right.ImageAltOverride
        && left.Category == right.Category && left.CategoryLabel == right.CategoryLabel && left.ReadTime == right.ReadTime
        && left.Accent == right.Accent && left.Cluster == right.Cluster && left.Body == right.Body && left.AnswerBlock == right.AnswerBlock
        && left.Faq == right.Faq && left.Featured == right.Featured && T(left.DateModified) == T(right.DateModified);

    private static bool SameTeam(TeamMember left, TeamMember right) =>
        SameRecord(left, right) && left.Role == right.Role && left.ImageId == right.ImageId && left.ImageAltOverride == right.ImageAltOverride
        && left.Email == right.Email && left.LinkedIn == right.LinkedIn && left.Featured == right.Featured;

    private static bool SameNews(NewsItem left, NewsItem right) =>
        SameRecord(left, right) && left.Summary == right.Summary && left.Details == right.Details && left.ImageId == right.ImageId
        && left.ImageAltOverride == right.ImageAltOverride && left.Category == right.Category && left.Location == right.Location
        && left.Year == right.Year && left.Month == right.Month && left.Featured == right.Featured;

    private static bool SamePage(Page left, Page right) => SameRecord(left, right);

    private static bool SameSection(Section left, Section right) =>
        left.PageId == right.PageId && left.ServiceId == right.ServiceId && left.PartnerId == right.PartnerId && left.CaseStudyId == right.CaseStudyId
        && left.Type == right.Type && left.SortOrder == right.SortOrder && left.Visible == right.Visible && left.Fields == right.Fields;

    private static bool SameMedia(MediaAsset left, MediaAsset right) =>
        left.Path == right.Path && left.OriginalName == right.OriginalName && left.ContentType == right.ContentType
        && left.Width == right.Width && left.Height == right.Height && left.Size == right.Size && left.GeneratedSizes == right.GeneratedSizes
        && left.ContentHash == right.ContentHash && left.Alt == right.Alt && left.Decorative == right.Decorative
        && left.Caption == right.Caption && left.UploaderId == right.UploaderId && T(left.CreatedAt) == T(right.CreatedAt);

    private static bool SameNav(NavigationItem left, NavigationItem right) =>
        left.Menu == right.Menu && left.ParentId == right.ParentId && left.Label == right.Label
        && left.LinkKind == right.LinkKind && left.TargetType == right.TargetType && left.TargetId == right.TargetId
        && left.Url == right.Url && left.SortOrder == right.SortOrder;

    private static bool SameSettings(SiteSettings left, SiteSettings right) =>
        left.Phone == right.Phone && left.WhatsApp == right.WhatsApp && left.Email == right.Email && left.LinkedIn == right.LinkedIn
        && left.Facebook == right.Facebook && left.Instagram == right.Instagram && left.TikTok == right.TikTok && left.FooterText == right.FooterText
        && left.DefaultMetaTitle == right.DefaultMetaTitle && left.DefaultMetaDescription == right.DefaultMetaDescription
        && left.DefaultShareImageId == right.DefaultShareImageId && left.DefaultShareImageAltOverride == right.DefaultShareImageAltOverride
        && left.OrganizationName == right.OrganizationName && left.LegalName == right.LegalName
        && left.StreetAddress == right.StreetAddress && left.Locality == right.Locality && left.Region == right.Region
        && left.PostalCode == right.PostalCode && left.Country == right.Country
        && left.AnalyticsContainerId == right.AnalyticsContainerId && left.CookieBannerText == right.CookieBannerText;

    private static string T(DateTime? value) => value is null ? "" : value.Value.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture);

    private static void AssignOwner(Section section, string owner, Guid id)
    {
        if (owner.StartsWith("page.", StringComparison.Ordinal))
            section.PageId = id;
        else if (owner.StartsWith("services.", StringComparison.Ordinal))
            section.ServiceId = id;
        else if (owner.StartsWith("partners.", StringComparison.Ordinal))
            section.PartnerId = id;
        else if (owner.StartsWith("case_studies.", StringComparison.Ordinal))
            section.CaseStudyId = id;
    }

    private static Guid? OwnerId(string owner)
    {
        var split = owner.Split('.', 2);
        if (split.Length != 2)
            return null;
        return split[0] switch
        {
            "page" => IdFor("page:" + split[1]),
            "services" => IdFor("service:" + split[1]),
            "partners" => IdFor("partner:" + split[1]),
            "case_studies" => IdFor("case:" + split[1]),
            _ => null,
        };
    }

    private static IElement Card(IElement anchor)
    {
        if (anchor.QuerySelector("h3") is not null)
            return anchor;
        for (var node = anchor.ParentElement; node is not null; node = node.ParentElement)
        {
            if (node.LocalName is "article" or "li")
                return node;
            if (node.QuerySelector("h3") is not null && node.LocalName != "a")
                return node;
        }

        return anchor;
    }

    internal static Guid ReferenceId(string type, string slug) => type switch
    {
        "service" => IdFor("service:" + slug),
        "partner" => IdFor("partner:" + slug),
        "case_study" => IdFor("case:" + slug),
        "blog_post" => IdFor("blog:" + slug),
        "page" => IdFor("page:" + slug),
        "vacancy" => IdFor("vacancy:" + slug),
        _ => IdFor(type + ":" + slug),
    };

    private static JsonObject? LinkMark(string href)
    {
        var reference = Links.Reference(href);
        if (reference is { } item)
        {
            return new JsonObject
            {
                ["type"] = "link",
                ["attrs"] = new JsonObject
                {
                    ["type"] = item.Type,
                    ["id"] = ReferenceId(item.Type, item.Slug).ToString("D"),
                },
            };
        }

        if (PageSlug(href) is string page)
        {
            return new JsonObject
            {
                ["type"] = "link",
                ["attrs"] = new JsonObject
                {
                    ["type"] = "page",
                    ["id"] = IdFor("page:" + page).ToString("D"),
                },
            };
        }

        if (!RichText.IsAllowedExternal(href))
            return null;
        return new JsonObject
        {
            ["type"] = "link",
            ["attrs"] = new JsonObject { ["href"] = href.Trim() },
        };
    }

    private static string? PageSlug(string? clean)
    {
        if (string.IsNullOrWhiteSpace(clean) || !clean.StartsWith('/'))
            return null;
        var path = clean.Split('?', '#')[0].TrimEnd('/');
        return path switch
        {
            "" => "home",
            "/about" => "about",
            "/contact" => "contact",
            "/news" => "news",
            "/careers" => "careers",
            "/careers/apply" => "apply",
            _ when path.Count(character => character == '/') == 1 => path[1..],
            _ => null,
        };
    }

    private static Guid IdFor(string key)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes("dh-import\u001f" + key));
        var bytes = new byte[16];
        Array.Copy(hash, bytes, 16);
        bytes[7] = (byte)((bytes[7] & 0x0F) | 0x50);
        bytes[8] = (byte)((bytes[8] & 0x3F) | 0x80);
        return new Guid(bytes);
    }

    private static DateTime? Editorial(string? iso) => ParseDate(iso);

    private static DateTime Stamp(DateTime value) =>
        new(value.Year, value.Month, value.Day, value.Hour, value.Minute, value.Second, DateTimeKind.Utc);

    private static DateTime? ParseDate(string? iso)
    {
        if (string.IsNullOrWhiteSpace(iso))
            return null;
        return DateTime.TryParse(iso, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var parsed)
            ? Stamp(parsed)
            : null;
    }

    private static string? Text(JsonElement item, string name) =>
        item.ValueKind == JsonValueKind.Object && item.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private static bool Bool(JsonElement item, string name) =>
        item.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.True;

    private static int Int(JsonElement item, string name) =>
        item.TryGetProperty(name, out var value) && value.TryGetInt32(out var number) ? number : 0;

    private static string Required(string? value, int max) => Cut(value, max) ?? "";

    private static string? Cut(string? value, int max)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;
        var trimmed = value.Trim();
        return trimmed.Length <= max ? trimmed : trimmed[..max];
    }

    private static string? Blank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string? Collapse(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;
        var collapsed = Regex.Replace(value, @"\s+", " ").Trim();
        return collapsed.Length == 0 ? null : collapsed;
    }

    private static string? Meta(AngleSharp.Html.Dom.IHtmlDocument document, string name)
    {
        var selector = name.Contains(':') ? "meta[property='" + name + "']" : "meta[name='" + name + "']";
        return document.QuerySelector(selector)?.GetAttribute("content");
    }

    private static string? HeadingText(AngleSharp.Html.Dom.IHtmlDocument document) =>
        Collapse(document.QuerySelector("main h1")?.TextContent);

    private static string Slugify(string? value)
    {
        var collapsed = Collapse(value)?.ToLowerInvariant() ?? "";
        var builder = new StringBuilder();
        var dash = false;
        foreach (var character in collapsed)
        {
            if (char.IsLetterOrDigit(character))
            {
                builder.Append(character);
                dash = false;
            }
            else if (!dash && builder.Length > 0)
            {
                builder.Append('-');
                dash = true;
            }
        }

        return builder.ToString().Trim('-');
    }

    private static string Accent(AngleSharp.Html.Dom.IHtmlDocument document)
    {
        var className = document.QuerySelector(".blog-view-tag")?.ClassName ?? "";
        return className.Contains("orange", StringComparison.Ordinal) ? "orange" : "blue";
    }

    private static int ReadTime(AngleSharp.Html.Dom.IHtmlDocument document)
    {
        var byline = document.QuerySelector(".blog-view-byline")?.TextContent ?? "";
        var match = Regex.Match(byline, @"(\d+)\s+min");
        return match.Success ? int.Parse(match.Groups[1].Value, CultureInfo.InvariantCulture) : 0;
    }

    private static DateTime? BylineDate(AngleSharp.Html.Dom.IHtmlDocument document, string label)
    {
        var byline = document.QuerySelector(".blog-view-byline")?.TextContent ?? "";
        var match = Regex.Match(byline, label + @"\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})");
        return match.Success && DateTime.TryParse(match.Groups[1].Value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsed)
            ? Stamp(parsed)
            : null;
    }

    private static ImportModel Prepare(string sourceRoot, ImportPlan plan, MediaWrite written)
    {
        _sourceRoot = sourceRoot;
        var model = Build(sourceRoot, plan, written.Assets);
        model.Media = written.Assets.Values.ToList();
        return model;
    }

    private static async Task<int> ApplyCore(string sourceRoot, string connectionString, string? mediaRoot)
    {
        var catalog = new Microsoft.Data.SqlClient.SqlConnectionStringBuilder(connectionString).InitialCatalog;
        /* DigitalHubContent_Parity is the throwaway the Phase C snapshot is built
           from: rebuilt from nothing on every run, never a place anyone edits. */
        string[] writable = ["DigitalHubContent", "DigitalHubNavImport", "DigitalHubContent_Parity"];
        if (!writable.Contains(catalog, StringComparer.OrdinalIgnoreCase))
        {
            Console.Error.WriteLine("Refusing to write. The connection must target " + string.Join(", ", writable) + ".");
            return 2;
        }

        // Only the real database may write media into the API's own folder.
        if (!string.Equals(catalog, "DigitalHubContent", StringComparison.OrdinalIgnoreCase)
            && string.IsNullOrWhiteSpace(mediaRoot))
        {
            Console.Error.WriteLine("Refusing to write media into the API folder for " + catalog + ". Pass --media-root.");
            return 2;
        }

        var options = new DbContextOptionsBuilder<ContentDbContext>().UseSqlServer(connectionString).Options;
        await using (var database = new ContentDbContext(options))
        {
            if (await StudioEdits.HasStartedAsync(database, CancellationToken.None))
            {
                Console.Error.WriteLine("Refusing to write. Content has been edited in the Studio, so the import will not overwrite it or recreate a renamed item under its old slug.");
                return 2;
            }
        }

        _sourceRoot = sourceRoot;
        var plan = Catalog.Build(sourceRoot);
        var written = WriteMedia(sourceRoot, mediaRoot ?? FindMediaRoot(), plan);
        var model = Prepare(sourceRoot, plan, written);
        var saved = await SaveAsync(connectionString, model);
        var schemaFailures = await PrintDatabaseAsync(connectionString, plan, written, saved.Changes, saved.Sections);
        return written.Failures.Count == 0 && schemaFailures == 0 ? 0 : 1;
    }
}

sealed class MediaWrite
{
    public Dictionary<string, MediaAsset> Assets { get; } = new(StringComparer.OrdinalIgnoreCase);

    public int FilesWritten { get; set; }

    public int FilesReused { get; set; }

    public int Variants { get; set; }

    public int Sizes { get; set; }

    public int MetadataStripped { get; set; }

    public List<string> Failures { get; } = [];
}

readonly record struct PostalAddressParts(string? Street, string? Locality, string? Region, string? PostalCode, string? Country);

sealed class ImportModel
{
    public List<MediaAsset> Media { get; set; } = [];

    public List<Service> Services { get; } = [];

    public List<Partner> Partners { get; } = [];

    public List<CaseStudy> Cases { get; } = [];

    public List<BlogPost> Blogs { get; } = [];

    public List<TeamMember> Team { get; } = [];

    public List<NewsItem> News { get; } = [];

    public List<Page> Pages { get; } = [];

    public List<Section> Sections { get; } = [];

    public List<NavigationItem> Navigation { get; } = [];

    public SiteSettings Settings { get; set; } = new();

    public List<string> Warnings { get; set; } = [];
}
