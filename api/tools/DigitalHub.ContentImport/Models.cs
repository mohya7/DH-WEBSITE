namespace DigitalHub.ContentImport;

sealed record DatabaseSnapshot(bool Connected, string? Error, IReadOnlyList<(string Table, int Count)> Counts);

sealed class CollectionLine
{
    public required string Name { get; init; }

    public int SourceCount { get; init; }

    public int ImportCount { get; set; }

    public int HeldCount { get; set; }

    public string Status { get; init; } = "published";

    public List<string> Importing { get; } = [];

    public List<string> Held { get; } = [];
}

sealed class PageLine
{
    public required string Source { get; init; }

    public required string Owner { get; init; }

    public List<string> Sections { get; } = [];

    public List<string> Unmapped { get; } = [];

    public List<string> Notes { get; } = [];

    public List<string> Related { get; } = [];
}

sealed class BlogLine
{
    public required string Slug { get; init; }

    public required string Source { get; init; }

    public bool HtmlOnly { get; init; }

    public int JsonTextLength { get; init; }

    public int HtmlTextLength { get; set; }

    public int Paragraphs { get; set; }

    public int Headings { get; set; }

    public int BulletLists { get; set; }

    public int OrderedLists { get; set; }

    public int Quotes { get; set; }

    public int Links { get; set; }

    public int Images { get; set; }

    public int Tables { get; set; }

    public int CodeBlocks { get; set; }

    public int TocItems { get; set; }

    public List<string> RelatedSlugs { get; } = [];

    public List<string> RelatedItems { get; } = [];

    public List<string> Unsupported { get; } = [];

    public List<string> Notes { get; } = [];
}

sealed class ImageLine
{
    public required string Path { get; init; }

    public int? Width { get; set; }

    public int? Height { get; set; }

    public string? ReadError { get; set; }

    public List<string> Alts { get; } = [];

    public int EmptyAltUsages { get; set; }

    public int DecorativeUsages { get; set; }

    public int Usages { get; set; }

    public List<string> Places { get; } = [];
}

sealed class Suspect
{
    public required string Collection { get; init; }

    public required string Id { get; init; }

    public required string Reason { get; init; }
}

sealed class ImportPlan
{
    public List<CollectionLine> Collections { get; } = [];

    public List<PageLine> Pages { get; } = [];

    public List<BlogLine> Blogs { get; } = [];

    public List<ImageLine> Images { get; } = [];

    public List<Suspect> Suspects { get; } = [];

    public int HeaderLinks { get; set; }

    public int FooterLinks { get; set; }

    public List<string> SiteSettings { get; } = [];

    public int RewrittenLinks { get; set; }

    public List<string> UnresolvedLinks { get; } = [];
}
