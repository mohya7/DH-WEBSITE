using System.Text;
using System.Text.Json;

namespace DigitalHub.Api.Content;

/// <summary>
/// A single line of text that may carry emphasis, strong, and links: a heading
/// with an emphasised phrase, a lede with a strong clause, a paragraph with one
/// link. Stored as a TipTap document, the same shape rich text uses, so it
/// reuses the renderer, the editor, and reference resolution rather than
/// introducing a second format and a second parser.
///
/// Narrower than <see cref="RichText"/> in both directions: one paragraph and no
/// block content, no code mark, and a link may only be a content reference or a
/// #fragment on the same page -- never an external address, and never a raw
/// internal path, which would not survive a slug change.
/// </summary>
public static class InlineText
{
    /// <summary>A line, not an article. Large enough for a lede, small enough to be a line.</summary>
    public const int MaxBytes = 4096;

    private static readonly HashSet<string> ReferenceTypes = new(StringComparer.Ordinal)
    {
        "service", "partner", "case_study", "blog_post", "page", "vacancy",
    };

    /// <param name="allowMarks">
    /// False where the text must stay plain. The home hero's heading is split
    /// into animated parts by the ported scripts, and a mark there would break
    /// that, so only a case study's hero may carry marks.
    /// </param>
    public static IReadOnlyList<string> Validate(string? json, bool allowMarks)
    {
        var errors = new List<string>();
        if (string.IsNullOrWhiteSpace(json))
            return errors;

        if (Encoding.UTF8.GetByteCount(json) > MaxBytes)
        {
            errors.Add("This text is longer than " + MaxBytes.ToString(System.Globalization.CultureInfo.InvariantCulture) + " bytes.");
            return errors;
        }

        JsonDocument document;
        try
        {
            document = JsonDocument.Parse(json, new JsonDocumentOptions { MaxDepth = 16 });
        }
        catch (JsonException)
        {
            errors.Add("This text must be a document.");
            return errors;
        }

        using (document)
        {
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object || Kind(root) != "doc")
            {
                errors.Add("This text must be a document.");
                return errors;
            }

            RejectUnknown(root, ["type", "content"], errors, "text");
            if (!root.TryGetProperty("content", out var content) || content.ValueKind != JsonValueKind.Array)
                return errors;

            var paragraphs = content.EnumerateArray().ToList();
            if (paragraphs.Count > 1)
            {
                errors.Add("This text must be a single paragraph.");
                return errors;
            }

            foreach (var paragraph in paragraphs)
                Paragraph(paragraph, allowMarks, errors);
        }

        return errors;
    }

    private static void Paragraph(JsonElement paragraph, bool allowMarks, List<string> errors)
    {
        if (paragraph.ValueKind != JsonValueKind.Object || Kind(paragraph) != "paragraph")
        {
            errors.Add("\"" + Kind(paragraph) + "\" is not allowed: this text must be a single paragraph.");
            return;
        }

        RejectUnknown(paragraph, ["type", "content"], errors, "paragraph");
        if (!paragraph.TryGetProperty("content", out var content) || content.ValueKind != JsonValueKind.Array)
            return;

        foreach (var node in content.EnumerateArray())
        {
            if (node.ValueKind != JsonValueKind.Object || Kind(node) != "text")
            {
                errors.Add("\"" + Kind(node) + "\" is not allowed inside this text.");
                continue;
            }

            RejectUnknown(node, ["type", "text", "marks"], errors, "text");
            if (!node.TryGetProperty("text", out var value) || value.ValueKind != JsonValueKind.String)
                errors.Add("Every part of this text must contain text.");
            if (!node.TryGetProperty("marks", out var marks))
                continue;
            if (marks.ValueKind != JsonValueKind.Array)
            {
                errors.Add("Marks must be a list.");
                continue;
            }

            foreach (var mark in marks.EnumerateArray())
                Mark(mark, allowMarks, errors);
        }
    }

    private static void Mark(JsonElement mark, bool allowMarks, List<string> errors)
    {
        if (mark.ValueKind != JsonValueKind.Object)
        {
            errors.Add("Marks must be objects.");
            return;
        }

        var kind = Kind(mark);
        if (!allowMarks)
        {
            errors.Add("\"" + kind + "\" is not allowed here: this text must be plain.");
            return;
        }

        switch (kind)
        {
            case "bold" or "italic":
                RejectUnknown(mark, ["type"], errors, "mark");
                break;
            case "link":
                Link(mark, errors);
                break;
            default:
                errors.Add("\"" + kind + "\" is not allowed.");
                break;
        }
    }

    private static void Link(JsonElement mark, List<string> errors)
    {
        RejectUnknown(mark, ["type", "attrs"], errors, "link");
        if (!mark.TryGetProperty("attrs", out var attrs) || attrs.ValueKind != JsonValueKind.Object)
        {
            errors.Add("A link needs a destination.");
            return;
        }

        var href = attrs.TryGetProperty("href", out var hrefValue) && hrefValue.ValueKind == JsonValueKind.String ? hrefValue.GetString() : null;
        var type = attrs.TryGetProperty("type", out var typeValue) && typeValue.ValueKind == JsonValueKind.String ? typeValue.GetString() : null;
        var id = attrs.TryGetProperty("id", out var idValue) && idValue.ValueKind == JsonValueKind.String ? idValue.GetString() : null;

        if (href is not null)
        {
            RejectUnknown(attrs, ["href"], errors, "link");
            if (type is not null || id is not null)
                errors.Add("A link cannot be both an address and a content reference.");
            else if (!href.StartsWith('#') || href.Length < 2)
                errors.Add("The link \"" + Shown(href) + "\" is not allowed. Use a content reference, or a #fragment on the same page.");
            return;
        }

        RejectUnknown(attrs, ["type", "id"], errors, "link");
        if (type is null || !ReferenceTypes.Contains(type))
            errors.Add("A link must name a content item.");
        if (id is null || !Guid.TryParse(id, out _))
            errors.Add("A link must carry the item id.");
    }

    private static string Kind(JsonElement node) =>
        node.ValueKind == JsonValueKind.Object && node.TryGetProperty("type", out var type) && type.ValueKind == JsonValueKind.String
            ? type.GetString() ?? ""
            : "";

    private static void RejectUnknown(JsonElement node, string[] allowed, List<string> errors, string what)
    {
        foreach (var property in node.EnumerateObject())
        {
            if (!allowed.Contains(property.Name, StringComparer.Ordinal))
                errors.Add("\"" + property.Name + "\" is not allowed on " + what + ".");
        }
    }

    private static string Shown(string value) => value.Length > 60 ? value[..60] + "…" : value;
}
