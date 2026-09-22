using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace DigitalHub.Api.Content;

public static class RichText
{
    public const int MaxBytes = 1_048_576;

    public const int MaxDepth = 32;

    private static readonly HashSet<string> ReferenceTypes = new(StringComparer.Ordinal)
    {
        "service", "partner", "case_study", "blog_post", "page", "vacancy",
    };

    public static IReadOnlyList<string> Validate(string? json)
    {
        var errors = new List<string>();
        if (string.IsNullOrWhiteSpace(json))
            return errors;
        if (Encoding.UTF8.GetByteCount(json) > MaxBytes)
        {
            errors.Add("This document is larger than " + MaxBytes.ToString(System.Globalization.CultureInfo.InvariantCulture) + " bytes.");
            return errors;
        }

        JsonDocument document;
        try
        {
            document = JsonDocument.Parse(json, new JsonDocumentOptions { MaxDepth = 128 });
        }
        catch (JsonException ex) when (ex.Message.Contains("depth", StringComparison.OrdinalIgnoreCase))
        {
            errors.Add("This document is nested deeper than " + MaxDepth.ToString(System.Globalization.CultureInfo.InvariantCulture) + ".");
            return errors;
        }
        catch (JsonException)
        {
            errors.Add("The body is not valid JSON.");
            return errors;
        }

        using (document)
        {
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object || Kind(root) != "doc")
            {
                errors.Add("The body must be a document.");
                return errors;
            }

            RejectUnknown(root, ["type", "content", "relatedItems"], errors, "document");
            RelatedItems(root, errors);
            if (root.TryGetProperty("content", out var content))
                Children(content, "doc", 1, errors, "content");
        }

        return errors;
    }

    public static bool HasContent(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return false;

        try
        {
            using var document = JsonDocument.Parse(json);
            return NodeHasContent(document.RootElement);
        }
        catch (JsonException)
        {
            return false;
        }
    }

    public static bool IsAllowedExternal(string href)
    {
        var trimmed = href.Trim();
        if (trimmed.Length == 0 || trimmed.StartsWith("//", StringComparison.Ordinal))
            return false;
        var normalized = CollapseScheme(trimmed);
        if (normalized.StartsWith("//", StringComparison.Ordinal))
            return false;
        if (!Uri.TryCreate(normalized, UriKind.Absolute, out var uri))
            return false;
        return uri.Scheme switch
        {
            "http" or "https" => !string.IsNullOrEmpty(uri.IdnHost),
            "mailto" => normalized.Length > "mailto:".Length,
            "tel" => normalized.Length > "tel:".Length,
            _ => false,
        };
    }

    public static (string Document, bool ImagesDropped) FilterPaste(string? json)
    {
        var before = CountKind(json, "image");
        var document = Paste(json);
        return (document, before > CountKind(document, "image"));
    }

    public static string Paste(string? json)
    {
        const string empty = "{\"type\":\"doc\",\"content\":[]}";
        if (string.IsNullOrWhiteSpace(json))
            return empty;

        JsonDocument document;
        try
        {
            document = JsonDocument.Parse(json, new JsonDocumentOptions { MaxDepth = 128 });
        }
        catch (JsonException)
        {
            return empty;
        }

        using (document)
        {
            var blocks = new JsonArray();
            var root = document.RootElement;
            if (root.ValueKind == JsonValueKind.Object && Kind(root) == "doc")
            {
                if (root.TryGetProperty("content", out var content))
                    Take(content, "doc", 1, blocks);
            }
            else if (root.ValueKind == JsonValueKind.Array)
            {
                Take(root, "doc", 1, blocks);
            }

            return new JsonObject { ["type"] = "doc", ["content"] = blocks }.ToJsonString();
        }
    }

    private static readonly HashSet<string> DropWhole = new(StringComparer.Ordinal)
    {
        "script", "style", "iframe", "object", "embed",
    };

    private static void Take(JsonElement content, string parent, int depth, JsonArray into)
    {
        if (content.ValueKind != JsonValueKind.Array || depth > MaxDepth)
            return;
        foreach (var child in content.EnumerateArray())
            Keep(child, parent, depth, into);
    }

    private static void Keep(JsonElement node, string parent, int depth, JsonArray into)
    {
        if (depth > MaxDepth || node.ValueKind != JsonValueKind.Object)
            return;

        var kind = Kind(node);
        if (DropWhole.Contains(kind))
            return;
        if (kind == "heading" && !HeadingLevel(node, out _))
            return;
        if (kind == "image")
        {
            if (AllowedHere(parent, "image") && ImageNode(node) is { } image)
                into.Add(image);
            return;
        }

        if (kind == "text" && BlockParent(parent))
        {
            if (TextNode(node) is not { } text)
                return;
            into.Add(new JsonObject
            {
                ["type"] = "paragraph",
                ["content"] = new JsonArray(text),
            });
            return;
        }

        if (AllowedHere(parent, kind))
        {
            if (Build(node, kind, depth) is { } built)
                into.Add(built);
            return;
        }

        if (node.TryGetProperty("content", out var inner))
            Take(inner, parent, depth, into);
    }

    private static bool BlockParent(string parent) =>
        parent is "doc" or "blockquote" or "listItem" or "tableCell" or "tableHeader";

    private static JsonObject? Build(JsonElement node, string kind, int depth)
    {
        if (kind == "text")
            return TextNode(node);

        var built = new JsonObject { ["type"] = kind };
        switch (kind)
        {
            case "heading":
                if (!HeadingLevel(node, out var level))
                    return null;
                built["attrs"] = new JsonObject { ["level"] = level };
                built["content"] = ChildrenOf(node, "heading", depth + 1);
                break;
            case "codeBlock":
                if (LanguageOf(node) is { } language)
                    built["attrs"] = new JsonObject { ["language"] = language };
                built["content"] = ChildrenOf(node, "codeBlock", depth + 1);
                break;
            case "tableCell" or "tableHeader":
                if (SpanOf(node) is { } span)
                    built["attrs"] = span;
                built["content"] = ChildrenOf(node, kind, depth + 1);
                break;
            default:
                built["content"] = ChildrenOf(node, kind, depth + 1);
                break;
        }

        return built;
    }

    private static JsonArray ChildrenOf(JsonElement node, string parent, int depth)
    {
        var into = new JsonArray();
        if (node.TryGetProperty("content", out var content))
            Take(content, parent, depth, into);
        return into;
    }

    private static JsonObject? TextNode(JsonElement node)
    {
        if (!node.TryGetProperty("text", out var text) || text.ValueKind != JsonValueKind.String)
            return null;

        var built = new JsonObject
        {
            ["type"] = "text",
            ["text"] = text.GetString(),
        };
        if (!node.TryGetProperty("marks", out var marks) || marks.ValueKind != JsonValueKind.Array)
            return built;

        var kept = new JsonArray();
        foreach (var mark in marks.EnumerateArray())
        {
            if (MarkNode(mark) is { } filtered)
                kept.Add(filtered);
        }

        if (kept.Count > 0)
            built["marks"] = kept;
        return built;
    }

    private static JsonObject? MarkNode(JsonElement mark)
    {
        if (mark.ValueKind != JsonValueKind.Object)
            return null;

        var kind = Kind(mark);
        if (kind is "bold" or "italic" or "code")
            return new JsonObject { ["type"] = kind };
        if (kind != "link" || !mark.TryGetProperty("attrs", out var attrs) || attrs.ValueKind != JsonValueKind.Object)
            return null;

        var href = attrs.TryGetProperty("href", out var hrefValue) && hrefValue.ValueKind == JsonValueKind.String
            ? hrefValue.GetString()
            : null;
        if (href is not null)
        {
            if (!IsAllowedExternal(href))
                return null;
            return new JsonObject
            {
                ["type"] = "link",
                ["attrs"] = new JsonObject { ["href"] = href.Trim() },
            };
        }

        var type = attrs.TryGetProperty("type", out var typeValue) && typeValue.ValueKind == JsonValueKind.String
            ? typeValue.GetString()
            : null;
        var id = attrs.TryGetProperty("id", out var idValue) && idValue.ValueKind == JsonValueKind.String
            ? idValue.GetString()
            : null;
        if (type is null || !ReferenceTypes.Contains(type) || id is null || !Guid.TryParse(id, out var parsed))
            return null;

        return new JsonObject
        {
            ["type"] = "link",
            ["attrs"] = new JsonObject
            {
                ["type"] = type,
                ["id"] = parsed.ToString("D"),
            },
        };
    }

    private static JsonObject? ImageNode(JsonElement node)
    {
        if (!node.TryGetProperty("attrs", out var attrs) || attrs.ValueKind != JsonValueKind.Object)
            return null;
        foreach (var property in attrs.EnumerateObject())
        {
            if (property.Name is "src" or "url" or "href")
                return null;
        }

        if (!attrs.TryGetProperty("mediaId", out var mediaId) || mediaId.ValueKind != JsonValueKind.String
            || !Guid.TryParse(mediaId.GetString(), out var parsed))
            return null;

        var decorative = attrs.TryGetProperty("decorative", out var flag) && flag.ValueKind == JsonValueKind.True;
        var alt = attrs.TryGetProperty("alt", out var altValue) && altValue.ValueKind == JsonValueKind.String
            ? altValue.GetString()
            : null;
        if (!decorative && string.IsNullOrWhiteSpace(alt))
            return null;

        var imageAttrs = new JsonObject { ["mediaId"] = parsed.ToString("D") };
        if (!string.IsNullOrWhiteSpace(alt))
            imageAttrs["alt"] = alt.Trim();
        if (decorative)
            imageAttrs["decorative"] = true;
        return new JsonObject
        {
            ["type"] = "image",
            ["attrs"] = imageAttrs,
        };
    }

    private static bool HeadingLevel(JsonElement node, out int level)
    {
        level = 0;
        return node.TryGetProperty("attrs", out var attrs)
            && attrs.ValueKind == JsonValueKind.Object
            && attrs.TryGetProperty("level", out var value)
            && value.ValueKind == JsonValueKind.Number
            && value.TryGetInt32(out level)
            && level is >= 2 and <= 4;
    }

    private static string? LanguageOf(JsonElement node)
    {
        if (!node.TryGetProperty("attrs", out var attrs) || attrs.ValueKind != JsonValueKind.Object)
            return null;
        return attrs.TryGetProperty("language", out var language) && language.ValueKind == JsonValueKind.String
            ? language.GetString()
            : null;
    }

    private static JsonObject? SpanOf(JsonElement node)
    {
        if (!node.TryGetProperty("attrs", out var attrs) || attrs.ValueKind != JsonValueKind.Object)
            return null;

        var span = new JsonObject();
        CopyCount(attrs, span, "colspan");
        CopyCount(attrs, span, "rowspan");
        return span.Count == 0 ? null : span;
    }

    private static void CopyCount(JsonElement attrs, JsonObject span, string name)
    {
        if (attrs.TryGetProperty(name, out var value)
            && value.ValueKind == JsonValueKind.Number
            && value.TryGetInt32(out var count)
            && count >= 1)
            span[name] = count;
    }

    private static void RelatedItems(JsonElement root, List<string> errors)
    {
        if (!root.TryGetProperty("relatedItems", out var items))
            return;
        if (items.ValueKind != JsonValueKind.Array)
        {
            Add(errors, "relatedItems must be a list.");
            return;
        }

        var index = 0;
        foreach (var item in items.EnumerateArray())
        {
            var path = "relatedItems[" + index + "]";
            if (item.ValueKind != JsonValueKind.Object)
            {
                Add(errors, path + " must be a reference.");
            }
            else
            {
                RejectUnknown(item, ["type", "id"], errors, path);
                if (!item.TryGetProperty("type", out var type) || type.ValueKind != JsonValueKind.String
                    || type.GetString() is not ("service" or "partner" or "case_study" or "blog_post"))
                    Add(errors, path + " must name a service, partner, case study, or blog post.");
                if (!item.TryGetProperty("id", out var id) || id.ValueKind != JsonValueKind.String || !Guid.TryParse(id.GetString(), out _))
                    Add(errors, path + " must carry the item id.");
            }

            index++;
        }
    }

    private static void Children(JsonElement content, string parent, int depth, List<string> errors, string path)
    {
        if (content.ValueKind != JsonValueKind.Array)
        {
            Add(errors, path + " must be a list.");
            return;
        }

        var index = 0;
        foreach (var child in content.EnumerateArray())
        {
            Walk(child, parent, depth, errors, path + "[" + index + "]");
            index++;
        }
    }

    private static void Walk(JsonElement node, string parent, int depth, List<string> errors, string path)
    {
        if (depth > MaxDepth)
        {
            Add(errors, "This document is nested deeper than " + MaxDepth.ToString(System.Globalization.CultureInfo.InvariantCulture) + ".");
            return;
        }

        if (node.ValueKind != JsonValueKind.Object)
        {
            Add(errors, path + " must be an object.");
            return;
        }

        var kind = Kind(node);
        if (!AllowedHere(parent, kind))
        {
            Add(errors, "\"" + kind + "\" is not allowed" + (parent == "doc" ? "." : " inside " + parent + "."));
            return;
        }

        switch (kind)
        {
            case "text":
                Text(node, errors, path);
                break;
            case "heading":
                Heading(node, depth, errors, path);
                break;
            case "image":
                Image(node, errors, path);
                break;
            case "codeBlock":
                RejectUnknown(node, ["type", "attrs", "content"], errors, path);
                Language(node, errors, path);
                if (node.TryGetProperty("content", out var code))
                    Children(code, kind, depth + 1, errors, path);
                break;
            case "tableCell" or "tableHeader":
                RejectUnknown(node, ["type", "attrs", "content"], errors, path);
                Span(node, errors, path);
                if (node.TryGetProperty("content", out var cell))
                    Children(cell, kind, depth + 1, errors, path);
                break;
            default:
                RejectUnknown(node, ["type", "content"], errors, path);
                if (node.TryGetProperty("content", out var inner))
                    Children(inner, kind, depth + 1, errors, path);
                break;
        }
    }

    private static bool AllowedHere(string parent, string kind) => parent switch
    {
        "doc" or "blockquote" or "listItem" or "tableCell" or "tableHeader" => kind is "paragraph" or "heading" or "bulletList" or "orderedList" or "blockquote" or "image" or "table" or "codeBlock",
        "paragraph" or "heading" or "codeBlock" => kind == "text",
        "bulletList" or "orderedList" => kind == "listItem",
        "table" => kind == "tableRow",
        "tableRow" => kind is "tableCell" or "tableHeader",
        _ => false,
    };

    private static void Text(JsonElement node, List<string> errors, string path)
    {
        RejectUnknown(node, ["type", "text", "marks"], errors, path);
        if (!node.TryGetProperty("text", out var text) || text.ValueKind != JsonValueKind.String)
            Add(errors, path + " must contain text.");
        if (!node.TryGetProperty("marks", out var marks))
            return;
        if (marks.ValueKind != JsonValueKind.Array)
        {
            Add(errors, path + " marks must be a list.");
            return;
        }

        var index = 0;
        foreach (var mark in marks.EnumerateArray())
        {
            Mark(mark, errors, path + ".marks[" + index + "]");
            index++;
        }
    }

    private static void Mark(JsonElement mark, List<string> errors, string path)
    {
        if (mark.ValueKind != JsonValueKind.Object)
        {
            Add(errors, path + " must be an object.");
            return;
        }

        var kind = Kind(mark);
        switch (kind)
        {
            case "bold" or "italic" or "code":
                RejectUnknown(mark, ["type"], errors, path);
                break;
            case "link":
                Link(mark, errors, path);
                break;
            default:
                Add(errors, "\"" + kind + "\" is not allowed.");
                break;
        }
    }

    private static void Link(JsonElement mark, List<string> errors, string path)
    {
        RejectUnknown(mark, ["type", "attrs"], errors, path);
        if (!mark.TryGetProperty("attrs", out var attrs) || attrs.ValueKind != JsonValueKind.Object)
        {
            Add(errors, path + " needs a destination.");
            return;
        }

        var href = attrs.TryGetProperty("href", out var hrefValue) && hrefValue.ValueKind == JsonValueKind.String ? hrefValue.GetString() : null;
        var type = attrs.TryGetProperty("type", out var typeValue) && typeValue.ValueKind == JsonValueKind.String ? typeValue.GetString() : null;
        var id = attrs.TryGetProperty("id", out var idValue) && idValue.ValueKind == JsonValueKind.String ? idValue.GetString() : null;
        if (href is not null)
        {
            RejectUnknown(attrs, ["href"], errors, path);
            if (type is not null || id is not null)
                Add(errors, path + " cannot be both an address and a content reference.");
            else if (!IsAllowedExternal(href))
                Add(errors, "The link \"" + Shown(href) + "\" is not allowed. Use http, https, mailto, or tel.");
            return;
        }

        RejectUnknown(attrs, ["type", "id"], errors, path);
        if (type is null || !ReferenceTypes.Contains(type))
            Add(errors, path + " must name a content item.");
        if (id is null || !Guid.TryParse(id, out _))
            Add(errors, path + " must carry the item id.");
    }

    private static void Heading(JsonElement node, int depth, List<string> errors, string path)
    {
        RejectUnknown(node, ["type", "attrs", "content"], errors, path);
        if (!node.TryGetProperty("attrs", out var attrs) || attrs.ValueKind != JsonValueKind.Object
            || !attrs.TryGetProperty("level", out var level) || level.ValueKind != JsonValueKind.Number
            || !level.TryGetInt32(out var value) || value is < 2 or > 4)
        {
            Add(errors, "Headings are h2, h3, or h4. The page title is the only h1.");
        }
        else
        {
            RejectUnknown(attrs, ["level"], errors, path);
        }

        if (node.TryGetProperty("content", out var content))
            Children(content, "heading", depth + 1, errors, path);
    }

    private static void Image(JsonElement node, List<string> errors, string path)
    {
        RejectUnknown(node, ["type", "attrs"], errors, path);
        if (node.TryGetProperty("content", out _))
            Add(errors, path + " cannot contain other content.");
        if (!node.TryGetProperty("attrs", out var attrs) || attrs.ValueKind != JsonValueKind.Object)
        {
            Add(errors, path + " must carry a media id.");
            return;
        }

        foreach (var property in attrs.EnumerateObject())
        {
            if (property.Name is "src" or "url" or "href")
                Add(errors, "Images carry a media id, not a URL.");
            else if (property.Name is not ("mediaId" or "alt" or "decorative"))
                Add(errors, path + " cannot include " + property.Name + ".");
        }

        if (!attrs.TryGetProperty("mediaId", out var mediaId) || mediaId.ValueKind != JsonValueKind.String || !Guid.TryParse(mediaId.GetString(), out _))
            Add(errors, path + " must carry a media id.");
        var decorative = false;
        if (attrs.TryGetProperty("decorative", out var flag))
        {
            if (flag.ValueKind is not (JsonValueKind.True or JsonValueKind.False))
                Add(errors, path + " decorative must be true or false.");
            decorative = flag.ValueKind == JsonValueKind.True;
        }

        if (attrs.TryGetProperty("alt", out var alt))
        {
            if (alt.ValueKind != JsonValueKind.String)
                Add(errors, path + " alt text must be text.");
            else if (!decorative && string.IsNullOrWhiteSpace(alt.GetString()))
                Add(errors, path + " needs alt text, or the image must be marked decorative.");
        }
        else if (!decorative)
        {
            Add(errors, path + " needs alt text, or the image must be marked decorative.");
        }
    }

    private static bool NodeHasContent(JsonElement node)
    {
        switch (node.ValueKind)
        {
            case JsonValueKind.Array:
                foreach (var item in node.EnumerateArray())
                {
                    if (NodeHasContent(item))
                        return true;
                }

                return false;
            case JsonValueKind.Object:
                var kind = Kind(node);
                if (kind == "text")
                {
                    return node.TryGetProperty("text", out var text)
                        && text.ValueKind == JsonValueKind.String
                        && !string.IsNullOrWhiteSpace(text.GetString());
                }

                if (kind == "image")
                    return true;
                return node.TryGetProperty("content", out var content) && NodeHasContent(content);
            default:
                return false;
        }
    }

    private static void Language(JsonElement node, List<string> errors, string path)
    {
        if (!node.TryGetProperty("attrs", out var attrs))
            return;
        if (attrs.ValueKind != JsonValueKind.Object)
        {
            Add(errors, path + " attrs must be an object.");
            return;
        }

        RejectUnknown(attrs, ["language"], errors, path);
        if (attrs.TryGetProperty("language", out var language) && language.ValueKind != JsonValueKind.String)
            Add(errors, path + " language must be text.");
    }

    private static void Span(JsonElement node, List<string> errors, string path)
    {
        if (!node.TryGetProperty("attrs", out var attrs))
            return;
        if (attrs.ValueKind != JsonValueKind.Object)
        {
            Add(errors, path + " attrs must be an object.");
            return;
        }

        RejectUnknown(attrs, ["colspan", "rowspan"], errors, path);
        Count(attrs, "colspan", errors, path);
        Count(attrs, "rowspan", errors, path);
    }

    private static void Count(JsonElement attrs, string name, List<string> errors, string path)
    {
        if (attrs.TryGetProperty(name, out var value) && (value.ValueKind != JsonValueKind.Number || !value.TryGetInt32(out var count) || count < 1))
            Add(errors, path + " " + name + " must be a positive number.");
    }

    private static void RejectUnknown(JsonElement element, string[] allowed, List<string> errors, string path)
    {
        foreach (var property in element.EnumerateObject())
        {
            if (!allowed.Contains(property.Name, StringComparer.Ordinal))
                Add(errors, path + " cannot include " + property.Name + ".");
        }
    }

    private static int CountKind(string? json, string kind)
    {
        if (string.IsNullOrWhiteSpace(json))
            return 0;
        try
        {
            using var document = JsonDocument.Parse(json);
            return CountKind(document.RootElement, kind);
        }
        catch (JsonException)
        {
            return 0;
        }
    }

    private static int CountKind(JsonElement node, string kind)
    {
        var count = 0;
        switch (node.ValueKind)
        {
            case JsonValueKind.Object:
                if (Kind(node) == kind)
                    count++;
                foreach (var property in node.EnumerateObject())
                    count += CountKind(property.Value, kind);
                break;
            case JsonValueKind.Array:
                foreach (var item in node.EnumerateArray())
                    count += CountKind(item, kind);
                break;
        }

        return count;
    }

    private static string Kind(JsonElement node) =>
        node.TryGetProperty("type", out var type) && type.ValueKind == JsonValueKind.String
            ? type.GetString() ?? ""
            : "";

    private static string CollapseScheme(string value)
    {
        var colon = value.IndexOf(':');
        if (colon < 0)
            return value;
        var scheme = new string(value[..colon].Where(character => !char.IsWhiteSpace(character) && !char.IsControl(character)).ToArray());
        return scheme + value[colon..];
    }

    private static string Shown(string href)
    {
        var trimmed = href.Trim();
        return trimmed.Length <= 80 ? trimmed : trimmed[..80];
    }

    private static void Add(List<string> errors, string message)
    {
        if (!errors.Contains(message))
            errors.Add(message);
    }
}
