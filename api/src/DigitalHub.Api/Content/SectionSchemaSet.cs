using System.Text.Json;
using Json.Schema;

namespace DigitalHub.Api.Content;

public sealed class SectionSchemaSet
{
    private readonly Dictionary<string, JsonSchema> _byType;
    private readonly EvaluationOptions _options;

    public SectionSchemaSet()
    {
        var directory = FindDirectory();
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
