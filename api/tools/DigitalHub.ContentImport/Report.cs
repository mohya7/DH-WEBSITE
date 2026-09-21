namespace DigitalHub.ContentImport;

static class Report
{
    public static void Write(ImportPlan plan, DatabaseSnapshot database)
    {
        Console.WriteLine("Dry run. Nothing was written.");
        Console.WriteLine("Images are measured with SkiaSharp.");
        Console.WriteLine("The redirects table stays empty. The old live site is out of scope.");
        Console.WriteLine();
        if (database.Connected)
        {
            Console.WriteLine("DigitalHubContent, read with the restricted login:");
            foreach (var (table, count) in database.Counts)
                Console.WriteLine($"  {table}: {count}");
        }
        else
        {
            Console.WriteLine("Database read failed: " + database.Error);
        }

        Console.WriteLine();
        Console.WriteLine("6.1 Collections");
        foreach (var collection in plan.Collections)
        {
            var source = collection.Name == "blog_posts"
                ? $"JSON {collection.SourceCount} plus {collection.ImportCount - collection.SourceCount} HTML-only"
                : $"source {collection.SourceCount}";
            Console.WriteLine($"{collection.Name}: {source}, import {collection.ImportCount}, held {collection.HeldCount}, status {collection.Status}");
            if (collection.Importing.Count > 0)
                Console.WriteLine("  import: " + string.Join(", ", collection.Importing));
            if (collection.Held.Count > 0)
                Console.WriteLine("  held: " + string.Join(", ", collection.Held));
        }

        Console.WriteLine();
        Console.WriteLine("6.2 Pages");
        Console.WriteLine($"Shared chrome, imported once: {plan.HeaderLinks} header links, {plan.FooterLinks} footer links.");
        if (plan.SiteSettings.Count > 0)
            Console.WriteLine("Site settings: " + string.Join("; ", plan.SiteSettings) + ".");
        foreach (var page in plan.Pages)
        {
            Console.WriteLine();
            Console.WriteLine(page.Source + " → " + page.Owner);
            if (page.Sections.Count == 0)
                Console.WriteLine("  sections: none");
            foreach (var section in page.Sections)
                Console.WriteLine("  " + section);
            foreach (var related in page.Related)
                Console.WriteLine("  related_items: " + related);
            foreach (var note in page.Notes)
                Console.WriteLine("  note: " + note);
            foreach (var unmapped in page.Unmapped)
                Console.WriteLine("  unmapped: " + unmapped);
        }

        Console.WriteLine();
        Console.WriteLine("6.3 Images");
        foreach (var image in plan.Images)
        {
            var size = image.Width is null ? image.ReadError ?? "unmeasured" : $"{image.Width}x{image.Height}";
            var alt = image.Alts.Count == 0
                ? "no alt text"
                : "alt: " + string.Join(" | ", image.Alts);
            var decorative = image.DecorativeUsages > 0
                ? $"; decorative on {image.DecorativeUsages} of {image.Usages} usages"
                : "";
            Console.WriteLine($"{image.Path}  {size}  {alt}{decorative}");
        }

        Console.WriteLine();
        Console.WriteLine("6.4 Blog bodies");
        foreach (var blog in plan.Blogs)
        {
            Console.WriteLine();
            Console.WriteLine(blog.Slug + (blog.HtmlOnly ? " (HTML only)" : "") + "  " + blog.Source);
            Console.WriteLine($"  TipTap: {blog.Paragraphs} paragraphs, {blog.Headings} headings, {blog.BulletLists} bullet lists, {blog.OrderedLists} ordered lists, {blog.Quotes} quotes, {blog.Links} links, {blog.Images} images, {blog.Tables} tables, {blog.CodeBlocks} code blocks");
            Console.WriteLine($"  contents nav items (not stored): {blog.TocItems}; related posts: {(blog.RelatedSlugs.Count == 0 ? "none" : string.Join(", ", blog.RelatedSlugs))}; related_items: {(blog.RelatedItems.Count == 0 ? "none" : string.Join(", ", blog.RelatedItems))}");
            foreach (var note in blog.Notes)
                Console.WriteLine("  note: " + note);
            if (blog.Unsupported.Count == 0)
                Console.WriteLine("  unsupported HTML: none");
            foreach (var item in blog.Unsupported)
                Console.WriteLine("  unsupported: " + item);
        }

        Console.WriteLine();
        Console.WriteLine("A. Fixes");
        Console.WriteLine($"Internal links rewritten to clean URLs: {plan.RewrittenLinks}.");
        if (plan.UnresolvedLinks.Count == 0)
            Console.WriteLine("Unresolved internal links: none.");
        foreach (var link in plan.UnresolvedLinks)
            Console.WriteLine("  unresolved: " + link);
        Console.WriteLine("Empty-alt and aria-hidden image usages are decorative for that usage. The asset keeps its default alt.");
        Console.WriteLine();
        Console.WriteLine("D. Leader portraits");
        foreach (var image in plan.Images.Where(item => item.Path.Contains("assets/team/", StringComparison.Ordinal) || item.Path.Contains("headsss-for-the-website", StringComparison.Ordinal)))
        {
            Console.WriteLine(image.Path);
            foreach (var place in image.Places)
                Console.WriteLine("  " + place);
        }

        Console.WriteLine();
        Console.WriteLine("6.5 Redirects");
        Console.WriteLine("None. The old live site is out of scope, so the importer creates no redirects.");

        Console.WriteLine();
        Console.WriteLine("6.6 Suspected test data");
        if (plan.Suspects.Count == 0)
            Console.WriteLine("None.");
        foreach (var suspect in plan.Suspects)
            Console.WriteLine($"{suspect.Collection} / {suspect.Id}: {suspect.Reason}");
    }
}
