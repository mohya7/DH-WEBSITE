using System.Text.Json;
using Json.Schema;

namespace DigitalHub.Api.Content;

public sealed class SectionSchemaSet
{
    private readonly Dictionary<string, JsonSchema> _byType;
    private readonly Dictionary<string, HashSet<string>> _inlineTextByType;
    private readonly Dictionary<string, List<string[]>> _urlPathsByType;
    private readonly EvaluationOptions _asserting;
    private readonly EvaluationOptions _annotating;

    public SectionSchemaSet()
    {
        var directory = FindDirectory();
        _inlineTextByType = ReadInlineTextFields(directory);
        _urlPathsByType = ReadUrlPaths(directory);
        var registry = new SchemaRegistry();
        var build = new BuildOptions
        {
            SchemaRegistry = registry,
            Dialect = Dialect.Draft202012,
        };
        JsonSchema.FromFile(Path.Combine(directory, "defs.json"), build);
        _byType = new Dictionary<string, JsonSchema>(StringComparer.Ordinal);
        foreach (var file in Directory.GetFiles(directory, "*.json"))
        {
            var name = Path.GetFileNameWithoutExtension(file);
            if (name.Equals("defs", StringComparison.OrdinalIgnoreCase))
                continue;
            _byType[name] = JsonSchema.FromFile(file, build);
        }

        _asserting = SchemaFormats.Asserting();
        _annotating = SchemaFormats.Annotating();
    }

    public bool Knows(string type) => _byType.ContainsKey(type);

    /// <summary>
    /// The fields of a section type that hold inline text. Read from the schemas
    /// themselves, so a field becomes inline text by being declared one and
    /// nothing else has to be kept in step.
    /// </summary>
    public IReadOnlyCollection<string> InlineTextFields(string type) =>
        _inlineTextByType.TryGetValue(type, out var fields) ? fields : [];

    private static Dictionary<string, HashSet<string>> ReadInlineTextFields(string directory)
    {
        var byType = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);
        foreach (var file in Directory.GetFiles(directory, "*.json"))
        {
            var name = Path.GetFileNameWithoutExtension(file);
            if (name.Equals("defs", StringComparison.OrdinalIgnoreCase))
                continue;

            using var document = JsonDocument.Parse(File.ReadAllText(file));
            if (!document.RootElement.TryGetProperty("properties", out var properties) || properties.ValueKind != JsonValueKind.Object)
                continue;

            var fields = new HashSet<string>(StringComparer.Ordinal);
            foreach (var property in properties.EnumerateObject())
            {
                if (IsInlineText(property.Value))
                    fields.Add(property.Name);
            }

            if (fields.Count > 0)
                byType[name] = fields;
        }

        return byType;
    }

    /// <summary>Declared directly, or by reference to the shared definition.</summary>
    private static bool IsInlineText(JsonElement schema)
    {
        if (schema.ValueKind != JsonValueKind.Object)
            return false;
        if (schema.TryGetProperty("x-dh-kind", out var kind) && kind.ValueKind == JsonValueKind.String)
            return kind.GetString() == "inlineText";
        return schema.TryGetProperty("$ref", out var reference)
            && reference.ValueKind == JsonValueKind.String
            && reference.GetString()?.EndsWith("/inlineText", StringComparison.Ordinal) == true;
    }

    /// <summary>
    /// Where a section type holds a link address (x-dh-kind "url"), directly or
    /// through the shared link definition: one path per place, "*" for every item
    /// of an array. Read from the schemas, so a new link field is checked by
    /// being declared one.
    /// </summary>
    public IReadOnlyList<string[]> UrlPaths(string type) =>
        _urlPathsByType.TryGetValue(type, out var paths) ? paths : [];

    private static Dictionary<string, List<string[]>> ReadUrlPaths(string directory)
    {
        using var defsDocument = JsonDocument.Parse(File.ReadAllText(Path.Combine(directory, "defs.json")));
        var defs = new Dictionary<string, JsonElement>(StringComparer.Ordinal);
        foreach (var definition in defsDocument.RootElement.GetProperty("$defs").EnumerateObject())
            defs[definition.Name] = definition.Value.Clone();

        var byType = new Dictionary<string, List<string[]>>(StringComparer.Ordinal);
        foreach (var file in Directory.GetFiles(directory, "*.json"))
        {
            var name = Path.GetFileNameWithoutExtension(file);
            if (name.Equals("defs", StringComparison.OrdinalIgnoreCase))
                continue;
            using var document = JsonDocument.Parse(File.ReadAllText(file));
            var paths = new List<string[]>();
            SchemaLinks.FindUrls(document.RootElement, [], defs, paths, depth: 0);
            if (paths.Count > 0)
                byType[name] = paths;
        }

        return byType;
    }

    /// <summary>Every link address in the fields that SectionLinks refuses, with where it is.</summary>
    private IEnumerable<string> LinkProblems(string type, JsonElement fields)
    {
        foreach (var path in UrlPaths(type))
        {
            foreach (var (location, value) in SchemaLinks.Values(fields, path, 0, ""))
            {
                if (value.ValueKind == JsonValueKind.String && !SectionLinks.IsAllowed(value.GetString()!))
                    yield return location + ": " + SectionLinks.Message;
            }
        }
    }

    /// <summary>
    /// The check for content that is published or about to be: schema formats are
    /// asserted (SchemaFormats), so nothing the website build refuses gets through.
    /// Every caller gets this unless it asks for the draft check.
    /// </summary>
    public IReadOnlyList<string> Validate(string type, string fieldsJson) => Validate(type, fieldsJson, _asserting);

    /// <summary>
    /// The check for a draft: formats are annotations only, so a value the Studio saves
    /// before it is finished (an empty reference or image id) still saves. Save is not publish.
    /// </summary>
    public IReadOnlyList<string> ValidateDraft(string type, string fieldsJson) => Validate(type, fieldsJson, _annotating);

    private IReadOnlyList<string> Validate(string type, string fieldsJson, EvaluationOptions options)
    {
        if (!_byType.TryGetValue(type, out var schema))
            return ["Unknown section type."];

        using var document = JsonDocument.Parse(fieldsJson);
        var result = schema.Evaluate(document.RootElement, options);
        if (result.IsValid)
            return [.. LinkProblems(type, document.RootElement)];

        var errors = new List<string>();
        Collect(result, errors);
        return errors.Count == 0 ? ["is invalid."] : errors;
    }

    private static void Collect(EvaluationResults result, List<string> errors)
    {
        if (errors.Count > 20)
            return;
        if (result.Errors is not null)
        {
            foreach (var error in result.Errors)
                errors.Add(result.InstanceLocation + " " + error.Key + ": " + error.Value);
        }

        if (result.Details is null)
            return;
        foreach (var detail in result.Details)
            Collect(detail, errors);
    }

    private static string FindDirectory()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            var candidate = Path.Combine(dir.FullName, "packages", "sections");
            if (File.Exists(Path.Combine(candidate, "defs.json")))
                return candidate;
        }

        throw new InvalidOperationException("Could not find packages/sections.");
    }
}
