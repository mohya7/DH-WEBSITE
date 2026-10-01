using System.Text.Json;
using Json.Schema;

namespace DigitalHub.Api.Content;

public sealed class SectionSchemaSet
{
    private readonly Dictionary<string, JsonSchema> _byType;
    private readonly Dictionary<string, HashSet<string>> _inlineTextByType;
    private readonly EvaluationOptions _options;

    public SectionSchemaSet()
    {
        var directory = FindDirectory();
        _inlineTextByType = ReadInlineTextFields(directory);
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

        _options = new EvaluationOptions { OutputFormat = OutputFormat.List };
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

    public IReadOnlyList<string> Validate(string type, string fieldsJson)
    {
        if (!_byType.TryGetValue(type, out var schema))
            return ["Unknown section type."];

        using var document = JsonDocument.Parse(fieldsJson);
        var result = schema.Evaluate(document.RootElement, _options);
        if (result.IsValid)
            return [];

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
