using System.Text.Json;
using DigitalHub.Api.Content;

namespace DigitalHub.Api.Tests;

public sealed class RichTextTests
{
    [Fact]
    public void A_document_of_allowed_nodes_passes()
    {
        var id = Guid.NewGuid().ToString("D");
        var media = Guid.NewGuid().ToString("D");
        var json = Doc(
            Heading(2, "Section"),
            Paragraph(Text("Hello", Link("https://digitalhub.example/a"), Internal("service", id))),
            Image(media),
            "{\"type\":\"bulletList\",\"content\":[{\"type\":\"listItem\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"One\"}]}]}]}");
        Assert.Empty(RichText.Validate(json));
    }

    [Fact]
    public void A_disallowed_node_is_rejected()
    {
        var errors = RichText.Validate(Doc("{\"type\":\"iframe\"}"));
        Assert.Contains(errors, error => error.Contains("iframe", StringComparison.Ordinal));
    }

    [Theory]
    [InlineData("javascript:alert(1)")]
    [InlineData(" JavaScript:alert(1)")]
    [InlineData("java\nscript:alert(1)")]
    [InlineData("JaVaScRiPt:alert(1)")]
    [InlineData("data:text/html,hi")]
    [InlineData("DATA:text/html,hi")]
    [InlineData("vbscript:msgbox(1)")]
    [InlineData("  VbScript:msgbox(1)")]
    [InlineData("//evil.example/a")]
    [InlineData("  //evil.example/a")]
    public void Disallowed_link_schemes_are_rejected(string href)
    {
        var errors = RichText.Validate(Doc(Paragraph(Text("Go", Link(href)))));
        Assert.Contains(errors, error => error.Contains(href.Trim(), StringComparison.Ordinal));
    }

    [Theory]
    [InlineData("https://digitalhub.example/a")]
    [InlineData("http://digitalhub.example/a")]
    [InlineData("mailto:sales@digitalhub.example")]
    [InlineData("tel:+2020000000")]
    public void Allowed_external_links_pass(string href)
    {
        Assert.Empty(RichText.Validate(Doc(Paragraph(Text("Go", Link(href))))));
    }

    [Fact]
    public void An_h1_is_rejected()
    {
        var errors = RichText.Validate(Doc(Heading(1, "Title")));
        Assert.Contains(errors, error => error.Contains("h1", StringComparison.Ordinal));
    }

    [Fact]
    public void An_image_url_is_rejected()
    {
        var errors = RichText.Validate(Doc("{\"type\":\"image\",\"attrs\":{\"src\":\"https://evil.example/a.png\"}}"));
        Assert.Contains(errors, error => error.Contains("URL", StringComparison.Ordinal));
    }

    [Fact]
    public void A_document_over_the_size_cap_is_rejected()
    {
        var json = Doc(Paragraph(Text(new string('a', RichText.MaxBytes))));
        var errors = RichText.Validate(json);
        Assert.Contains(errors, error => error.Contains(RichText.MaxBytes.ToString(System.Globalization.CultureInfo.InvariantCulture), StringComparison.Ordinal));
    }

    [Fact]
    public void Paste_from_Word_and_a_web_page_keeps_only_allowed_nodes()
    {
        var media = Guid.NewGuid().ToString("D");
        var word = Doc(
            Heading(1, "Memo from Word"),
            Paragraph(Text("Kept", "{\"type\":\"bold\"}", "{\"type\":\"textStyle\",\"attrs\":{\"fontFamily\":\"Calibri\"}}") + "," + Text(" body", "{\"type\":\"italic\"}")),
            "{\"type\":\"oMath\"}",
            "{\"type\":\"image\",\"attrs\":{\"src\":\"file:///C:/Users/word/image.png\"}}",
            Image(media),
            "{\"type\":\"bulletList\",\"content\":[{\"type\":\"listItem\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"First\"}]}]}]}",
            "{\"type\":\"table\",\"content\":[{\"type\":\"tableRow\",\"content\":[{\"type\":\"tableHeader\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"Name\"}]}]},{\"type\":\"tableCell\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"Ada\"}]}]}]}]}",
            "{\"type\":\"blockquote\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"Quoted\"}]}]}",
            "{\"type\":\"codeBlock\",\"attrs\":{\"language\":\"text\"},\"content\":[{\"type\":\"text\",\"text\":\"kept-code\"}]}");
        var web = Doc(
            "{\"type\":\"div\",\"attrs\":{\"class\":\"page\"},\"content\":["
            + Heading(1, "Site title") + ","
            + "{\"type\":\"style\",\"content\":[{\"type\":\"text\",\"text\":\"body{color:red}\"}]},"
            + "{\"type\":\"script\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"alert(1)\"}]}]},"
            + "{\"type\":\"iframe\",\"attrs\":{\"src\":\"https://evil.example\"}},"
            + Paragraph(
                Text("Read", Link("javascript:alert(1)")) + ","
                + Text(" more", Link("https://example.com/a")) + ","
                + Text(" call", Link("  //evil.example/a"))) + ","
            + "{\"type\":\"image\",\"attrs\":{\"src\":\"https://cdn.example/a.png\"}},"
            + Heading(2, "Section")
            + "]}");

        var pastedWord = RichText.Paste(word);
        var pastedWeb = RichText.Paste(web);
        Assert.Empty(RichText.Validate(pastedWord));
        Assert.Empty(RichText.Validate(pastedWeb));
        AssertOnlyAllowed(pastedWord);
        AssertOnlyAllowed(pastedWeb);

        Assert.Contains("Kept", pastedWord, StringComparison.Ordinal);
        Assert.Contains("\"bold\"", pastedWord, StringComparison.Ordinal);
        Assert.Contains("Quoted", pastedWord, StringComparison.Ordinal);
        Assert.Contains("Ada", pastedWord, StringComparison.Ordinal);
        Assert.Contains("kept-code", pastedWord, StringComparison.Ordinal);
        Assert.Contains(media, pastedWord, StringComparison.Ordinal);
        Assert.DoesNotContain("Memo from Word", pastedWord, StringComparison.Ordinal);
        Assert.DoesNotContain("Calibri", pastedWord, StringComparison.Ordinal);
        Assert.DoesNotContain("file://", pastedWord, StringComparison.Ordinal);
        Assert.DoesNotContain("oMath", pastedWord, StringComparison.Ordinal);
        Assert.DoesNotContain("\"level\":1", pastedWord, StringComparison.Ordinal);

        Assert.Contains("Read", pastedWeb, StringComparison.Ordinal);
        Assert.Contains("https://example.com/a", pastedWeb, StringComparison.Ordinal);
        Assert.Contains("Section", pastedWeb, StringComparison.Ordinal);
        Assert.DoesNotContain("Site title", pastedWeb, StringComparison.Ordinal);
        Assert.DoesNotContain("javascript:", pastedWeb, StringComparison.Ordinal);
        Assert.DoesNotContain("alert(1)", pastedWeb, StringComparison.Ordinal);
        Assert.DoesNotContain("//evil.example", pastedWeb, StringComparison.Ordinal);
        Assert.DoesNotContain("cdn.example", pastedWeb, StringComparison.Ordinal);
        Assert.DoesNotContain("iframe", pastedWeb, StringComparison.Ordinal);
        Assert.DoesNotContain("color:red", pastedWeb, StringComparison.Ordinal);
    }

    [Fact]
    public void A_document_over_the_depth_cap_is_rejected()
    {
        var nested = "{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"deep\"}]}";
        for (var level = 0; level < RichText.MaxDepth; level++)
            nested = "{\"type\":\"blockquote\",\"content\":[" + nested + "]}";
        var errors = RichText.Validate(Doc(nested));
        Assert.Contains(errors, error => error.Contains(RichText.MaxDepth.ToString(System.Globalization.CultureInfo.InvariantCulture), StringComparison.Ordinal));
    }

    private static string Doc(params string[] blocks) =>
        "{\"type\":\"doc\",\"content\":[" + string.Join(',', blocks) + "]}";

    private static string Heading(int level, string text) =>
        "{\"type\":\"heading\",\"attrs\":{\"level\":" + level + "},\"content\":[" + Text(text) + "]}";

    private static string Paragraph(string content) =>
        "{\"type\":\"paragraph\",\"content\":[" + content + "]}";

    private static string Text(string text, params string[] marks)
    {
        var encoded = JsonSerializer.Serialize(text);
        return marks.Length == 0
            ? "{\"type\":\"text\",\"text\":" + encoded + "}"
            : "{\"type\":\"text\",\"text\":" + encoded + ",\"marks\":[" + string.Join(',', marks) + "]}";
    }

    private static string Link(string href) =>
        "{\"type\":\"link\",\"attrs\":{\"href\":" + JsonSerializer.Serialize(href) + "}}";

    private static string Internal(string type, string id) =>
        "{\"type\":\"link\",\"attrs\":{\"type\":\"" + type + "\",\"id\":\"" + id + "\"}}";

    private static string Image(string mediaId) =>
        "{\"type\":\"image\",\"attrs\":{\"mediaId\":\"" + mediaId + "\",\"alt\":\"Diagram\"}}";

    private static void AssertOnlyAllowed(string json)
    {
        var allowedNodes = new HashSet<string>(StringComparer.Ordinal)
        {
            "doc", "paragraph", "heading", "bulletList", "orderedList", "listItem", "blockquote",
            "image", "table", "tableRow", "tableCell", "tableHeader", "codeBlock", "text",
        };
        var allowedMarks = new HashSet<string>(StringComparer.Ordinal) { "bold", "italic", "code", "link" };
        using var document = JsonDocument.Parse(json);
        WalkAllowed(document.RootElement, allowedNodes, allowedMarks, inMarks: false);
    }

    private static void WalkAllowed(JsonElement node, HashSet<string> nodes, HashSet<string> marks, bool inMarks)
    {
        if (node.ValueKind != JsonValueKind.Object)
            return;
        if (node.TryGetProperty("type", out var type))
        {
            var kind = type.GetString() ?? "";
            Assert.Contains(kind, inMarks ? marks : nodes);
        }

        foreach (var property in node.EnumerateObject())
        {
            if (property.Value.ValueKind == JsonValueKind.Object)
                WalkAllowed(property.Value, nodes, marks, inMarks || property.Name == "marks");
            else if (property.Value.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in property.Value.EnumerateArray())
                    WalkAllowed(item, nodes, marks, inMarks || property.Name == "marks");
            }
        }
    }
}
