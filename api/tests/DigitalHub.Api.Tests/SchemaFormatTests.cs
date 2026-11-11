using System.Net;
using System.Text.Json;
using DigitalHub.Api.Content;

namespace DigitalHub.Api.Tests;

/// <summary>
/// ADM-02 part 2: the website build asserts the schemas' "uuid" format
/// (website/src/content/validate.ts), and its lookups compare ids as exact
/// lower-case strings. So a published "uuid" value must be a lower-case UUID,
/// checked at publish. A draft may still hold an unfinished value (save is not
/// publish).
/// </summary>
[Collection("SqlServer")]
public sealed class SchemaFormatTests : IClassFixture<ApiFactory>
{
    /// <summary>The website's only format, as validate.ts registers it.</summary>
    private const string WebsiteUuidRegex = "/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i";

    private const string WebsiteUuidLine = "ajv.addFormat(\"uuid\", " + WebsiteUuidRegex + ");";

    /// <summary>
    /// Each case with the website's verdict (Node, the validate.ts expression) and the API's
    /// rule: the website's verdict, and no upper case, because the website's lookups would miss it.
    /// </summary>
    private static readonly (string Name, string Value, bool WebsiteAccepts)[] UuidCases =
    [
        ("lower-case valid", "01234567-89ab-cdef-0123-456789abcdef", true),
        ("upper-case valid", "01234567-89AB-CDEF-0123-456789ABCDEF", true),
        ("not-a-uuid", "not-a-uuid", false),
        ("empty", "", false),
        ("32 digits", "0123456789abcdef0123456789abcdef", false),
        ("braces", "{01234567-89ab-cdef-0123-456789abcdef}", false),
        ("leading space", " 01234567-89ab-cdef-0123-456789abcdef", false),
        ("trailing newline", "01234567-89ab-cdef-0123-456789abcdef\n", false),
        ("full-width digit", "０1234567-89ab-cdef-0123-456789abcdef", false),
    ];

    private readonly ApiFactory _factory;
    private readonly HttpClient _client;

    public SchemaFormatTests(ApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public void The_api_checks_uuid_as_the_website_build_does_and_refuses_upper_case()
    {
        // (a) The website registers exactly one format, and it is this one.
        var validate = File.ReadAllLines(Find("website", "src", "content", "validate.ts"));
        var formats = validate.Where(line => line.Contains("addFormat(", StringComparison.Ordinal)).Select(line => line.Trim()).ToList();
        Assert.Equal([WebsiteUuidLine], formats);

        // (b) The schemas use no other format.
        var used = new SortedSet<string>(StringComparer.Ordinal);
        foreach (var folder in new[] { "sections", "collections" })
        {
            foreach (var file in Directory.GetFiles(Find("packages", folder), "*.json"))
            {
                using var document = JsonDocument.Parse(File.ReadAllText(file));
                CollectFormats(document.RootElement, used);
            }
        }

        Assert.Equal(["uuid"], used);

        // (c) The API refuses exactly what the website refuses, and upper case as well;
        // (d) so whenever the website refuses, the API refuses.
        var schemas = new SectionSchemaSet();
        var disagreements = new List<string>();
        foreach (var (name, value, websiteAccepts) in UuidCases)
        {
            var fields = JsonSerializer.Serialize(new { heading = "H", items = new[] { new { title = "T", reference = new { type = "case_study", id = value } } } });
            var apiRefuses = schemas.Validate("case_cards", fields).Count > 0;
            var expected = !websiteAccepts || value.Any(char.IsUpper);
            if (apiRefuses != expected)
                disagreements.Add($"{name} {JsonSerializer.Serialize(value)}: website {(websiteAccepts ? "accepts" : "refuses")}, API {(apiRefuses ? "refuses" : "accepts")}, expected the API to {(expected ? "refuse" : "accept")}");
            if (!websiteAccepts && !apiRefuses)
                disagreements.Add($"{name}: the website refuses it and the API does not");
        }

        Assert.True(disagreements.Count == 0, string.Join("\n", disagreements));
    }

    [Theory]
    [InlineData("reference-not-a-uuid")]
    [InlineData("reference-empty")]
    [InlineData("reference-32-digits")]
    [InlineData("image-not-a-uuid")]
    [InlineData("related-not-a-uuid")]
    public async Task Publishing_refuses_an_id_the_website_would_refuse(string kind)
    {
        await using var run = await Adm02Run.StartAsync(_factory, _client);
        var target = await run.PublishedAsync("case-studies", run.Marker + "-target");
        var section = kind switch
        {
            "reference-not-a-uuid" => Adm02Run.CaseCards(new { title = "T", reference = new { type = "case_study", id = "not-a-uuid" } }),
            "reference-empty" => Adm02Run.CaseCards(new { title = "T", reference = new { type = "case_study", id = "" } }),
            "reference-32-digits" => Adm02Run.CaseCards(new { title = "T", reference = new { type = "case_study", id = target.ToString("N") } }),
            "image-not-a-uuid" => Adm02Run.CaseCards(new { title = "T", image = new { mediaId = "not-a-uuid", alt = "A", decorative = false } }),
            "related-not-a-uuid" => Adm02Run.Section("related_items", new { heading = "H", items = new[] { new { type = "case_study", id = "not-a-uuid", title = "T", text = "T" } } }),
            _ => throw new ArgumentOutOfRangeException(nameof(kind)),
        };

        await AssertSavedButNotPublishedAsync(run, section);
    }

    [Theory]
    [InlineData("reference")]
    [InlineData("image")]
    public async Task A_draft_with_an_unchosen_reference_or_image_still_saves(string kind)
    {
        // What the Studio sends after a reference's type is changed, or alt text is typed before an image is chosen.
        await using var run = await Adm02Run.StartAsync(_factory, _client);
        var page = await run.CreateItemAsync("pages", run.Marker + "-draft");
        var item = kind == "reference"
            ? (object)new { title = "T", reference = new { type = "service", id = "" } }
            : new { title = "T", image = new { mediaId = "", alt = "A", decorative = false } };

        var saved = await run.SaveSectionsAsync("pages", page, Adm02Run.CaseCards(item));
        Assert.True(saved.Status == HttpStatusCode.OK, $"{saved.Status} {saved.Body}");
    }

    [Theory]
    [InlineData("reference")]
    [InlineData("image")]
    public async Task Publishing_refuses_an_upper_case_id(string kind)
    {
        // The website's format accepts upper case, but its lookups compare exact lower-case ids:
        // a media id stops the build, and a reference silently resolves to nothing.
        await using var run = await Adm02Run.StartAsync(_factory, _client);
        object section;
        if (kind == "reference")
        {
            var target = await run.PublishedAsync("case-studies", run.Marker + "-target");
            section = Adm02Run.CaseCards(new { title = "T", reference = new { type = "case_study", id = target.ToString("D").ToUpperInvariant() } });
        }
        else
        {
            var media = await run.UploadMediaAsync();
            section = Adm02Run.CaseCards(new { title = "T", image = new { mediaId = media.ToString("D").ToUpperInvariant(), alt = "A", decorative = false } });
        }

        await AssertSavedButNotPublishedAsync(run, section);
    }

    private static async Task AssertSavedButNotPublishedAsync(Adm02Run run, object section)
    {
        var page = await run.CreateItemAsync("pages", run.Marker + "-page");
        var saved = await run.SaveSectionsAsync("pages", page, section);
        Assert.True(saved.Status == HttpStatusCode.OK, $"save: {saved.Status} {saved.Body}");

        var published = await run.PublishAsync("pages", page);
        Assert.True(published.Status == HttpStatusCode.BadRequest, $"publish: {published.Status} {published.Body}");
        Assert.Equal("publish_blocked", Adm02Run.Code(published.Body));
        Assert.Contains(Adm02Run.Strings(published.Body), message => message.Contains("format 'uuid'", StringComparison.Ordinal));
    }

    private static void CollectFormats(JsonElement element, SortedSet<string> used)
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in element.EnumerateObject())
            {
                if (property.Name == "format" && property.Value.ValueKind == JsonValueKind.String)
                    used.Add(property.Value.GetString()!);
                else
                    CollectFormats(property.Value, used);
            }
        }
        else if (element.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in element.EnumerateArray())
                CollectFormats(item, used);
        }
    }

    private static string Find(params string[] parts)
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
        {
            var candidate = Path.Combine([directory.FullName, .. parts]);
            if (File.Exists(candidate) || Directory.Exists(candidate))
                return candidate;
        }

        throw new FileNotFoundException(string.Join("/", parts) + " was not found above the test output.");
    }
}
