using System.Text.Json;
using System.Text.Json.Nodes;
using AngleSharp.Dom;

namespace DigitalHub.ContentImport;

/// <summary>
/// What the old site actually showed.
///
/// The pages on feature/interviewer-portal are shells: content-runtime.js reads
/// content/site-content.js on load and overwrites parts of the markup. Reading
/// the HTML alone therefore imports text no visitor ever saw -- a hero eyebrow
/// that was replaced, a stat that was counted from a different number, a lead
/// the runtime shortened, team portraits that were swapped for uploads.
///
/// This reads the same file the runtime read, so the import stores what was on
/// the screen.
/// </summary>
static partial class ContentWriter
{
    private static JsonNode? _runtime;

    private static JsonNode? Runtime
    {
        get
        {
            if (_runtime is not null)
                return _runtime;
            var file = Path.Combine(_sourceRoot ?? "", "content", "site-content.json");
            if (!File.Exists(file))
                return null;
            _runtime = JsonNode.Parse(File.ReadAllText(file));
            return _runtime;
        }
    }

    private static JsonNode? RuntimePage(string page) => Runtime?["pages"]?[page];

    /// <summary>A page's runtime value, or null when the runtime did not set one.</summary>
    private static string? RuntimeText(string page, string key)
    {
        var value = RuntimePage(page)?[key];
        return value?.GetValueKind() == JsonValueKind.String ? value.GetValue<string>() : null;
    }

    /// <summary>The home stats as the counter displayed them: value plus suffix.</summary>
    private static List<(string Value, string Label)> RuntimeHomeStats()
    {
        var stats = new List<(string, string)>();
        if (RuntimePage("home")?["numbers"]?["stats"] is not JsonArray array)
            return stats;
        foreach (var entry in array)
        {
            var value = entry?["value"]?.ToString() ?? "";
            var suffix = entry?["suffix"]?.ToString() ?? "";
            stats.Add((value + suffix, entry?["label"]?.ToString() ?? ""));
        }

        return stats;
    }

    /// <summary>The runtime's key for a page, from the file it was imported from.</summary>
    private static string RuntimePageOf(string fromPage)
    {
        var path = fromPage.Replace('\\', '/').ToLowerInvariant();
        if (path.Contains("/partners", StringComparison.Ordinal)) return "partners";
        if (path.Contains("/blogs", StringComparison.Ordinal)) return "blogs";
        if (path.Contains("/cases", StringComparison.Ordinal)) return "cases";
        if (path.Contains("/careers", StringComparison.Ordinal)) return "careers";
        if (path.Contains("/news", StringComparison.Ordinal)) return "news";
        if (path.Contains("about", StringComparison.Ordinal)) return "about";
        return "home";
    }

    /// <summary>
    /// The value the counter animated to, matched on the stat's own label. The
    /// number in the markup was the starting figure, not what a visitor read.
    /// </summary>
    private static string? RuntimeStatValue(string? label)
    {
        var wanted = Collapse(label);
        if (string.IsNullOrEmpty(wanted))
            return null;
        foreach (var (value, statLabel) in RuntimeHomeStats())
        {
            if (string.Equals(Collapse(statLabel), wanted, StringComparison.Ordinal))
                return value;
        }

        return null;
    }

    /// <summary>The portrait and alt text the runtime showed for a team member.</summary>
    private static (string Image, string Alt)? RuntimePortrait(string name)
    {
        if (Runtime?["collections"]?["team"] is not JsonArray team)
            return null;
        foreach (var entry in team)
        {
            if (!string.Equals(entry?["name"]?.ToString(), name, StringComparison.Ordinal))
                continue;
            var image = entry?["image"]?.ToString();
            if (string.IsNullOrWhiteSpace(image))
                return null;
            return (image, entry?["alt"]?.ToString() ?? "");
        }

        return null;
    }

    /// <summary>The blog posts the old site listed. Anything else was never linked.</summary>
    private static HashSet<string> RuntimeBlogTitles()
    {
        var titles = new HashSet<string>(StringComparer.Ordinal);
        if (Runtime?["collections"]?["blogs"] is not JsonArray blogs)
            return titles;
        foreach (var entry in blogs)
        {
            var title = entry?["title"]?.ToString();
            if (!string.IsNullOrWhiteSpace(title))
                titles.Add(title);
        }

        return titles;
    }

    /* ---------------------------------------------------------------------
       Inline text: a heading or lede that carries emphasis, strong, or a link.
       Stored as a one-paragraph TipTap document so it reuses the rich-text
       renderer, editor, and reference resolution rather than a second format.
       --------------------------------------------------------------------- */

    /// <summary>
    /// An element's inline content as an inline-text document. Only em, strong,
    /// and links become marks; everything else contributes its text.
    /// </summary>
    private static string InlineDocument(IElement? element, string fromPage)
    {
        var parts = new JsonArray();
        if (element is not null)
            InlineParts(element, parts, fromPage, bold: false, italic: false, link: null);

        return new JsonObject
        {
            ["type"] = "doc",
            ["content"] = new JsonArray(new JsonObject { ["type"] = "paragraph", ["content"] = parts }),
        }.ToJsonString();
    }

    /// <summary>Plain text as an inline-text document, for a field with no markup.</summary>
    private static string InlineDocumentFromText(string? text)
    {
        var parts = new JsonArray();
        var value = Collapse(text);
        if (!string.IsNullOrEmpty(value))
            parts.Add(new JsonObject { ["type"] = "text", ["text"] = value });
        return new JsonObject
        {
            ["type"] = "doc",
            ["content"] = new JsonArray(new JsonObject { ["type"] = "paragraph", ["content"] = parts }),
        }.ToJsonString();
    }

    private static void InlineParts(INode node, JsonArray parts, string fromPage, bool bold, bool italic, JsonObject? link)
    {
        foreach (var child in node.ChildNodes)
        {
            if (child.NodeType == NodeType.Text)
            {
                AddInlinePart(parts, child.TextContent, bold, italic, link);
                continue;
            }

            if (child is not IElement element)
                continue;

            var name = element.LocalName;
            if (name is "em" or "i")
                InlineParts(element, parts, fromPage, bold, italic: true, link);
            else if (name is "strong" or "b")
                InlineParts(element, parts, fromPage, bold: true, italic, link);
            else if (name == "a")
                InlineParts(element, parts, fromPage, bold, italic, InlineLink(element, fromPage) ?? link);
            else if (name == "br")
                AddInlinePart(parts, " ", bold, italic, link);
            else
                InlineParts(element, parts, fromPage, bold, italic, link);
        }
    }

    /// <summary>
    /// A link mark: a content reference for an internal page, or the fragment for
    /// an on-page link. An address we cannot resolve becomes no mark at all, so
    /// the text stays rather than turning into a link that goes nowhere.
    /// </summary>
    private static JsonObject? InlineLink(IElement anchor, string fromPage)
    {
        var href = anchor.GetAttribute("href");
        if (string.IsNullOrWhiteSpace(href))
            return null;
        if (href.StartsWith('#') && href.Length > 1)
            return new JsonObject { ["type"] = "link", ["attrs"] = new JsonObject { ["href"] = href } };

        var reference = ReferenceOf(anchor, fromPage);
        return reference is null
            ? null
            : new JsonObject { ["type"] = "link", ["attrs"] = reference.DeepClone() };
    }

    private static void AddInlinePart(JsonArray parts, string? text, bool bold, bool italic, JsonObject? link)
    {
        var value = Collapse(text);
        if (string.IsNullOrEmpty(value))
            return;

        // Keep one space where the markup had one, so words do not run together.
        var needsSpace = text is not null && text.Length > 0 && char.IsWhiteSpace(text[0]) && parts.Count > 0;
        if (needsSpace)
            value = " " + value;
        if (text is not null && text.Length > 0 && char.IsWhiteSpace(text[^1]))
            value += " ";

        var marks = new JsonArray();
        if (bold) marks.Add(new JsonObject { ["type"] = "bold" });
        if (italic) marks.Add(new JsonObject { ["type"] = "italic" });
        if (link is not null) marks.Add(link.DeepClone());

        var part = new JsonObject { ["type"] = "text", ["text"] = value };
        if (marks.Count > 0)
            part["marks"] = marks;
        parts.Add(part);
    }
}
