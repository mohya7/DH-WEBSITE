using System.Text.Json;
using Json.Schema;

namespace DigitalHub.Api.Content;

public sealed class CollectionSchemaSet
{
    private readonly Dictionary<string, JsonSchema> _byCollection;
    private readonly Dictionary<string, JsonElement> _documents;
    private readonly EvaluationOptions _options;

    public CollectionSchemaSet()
    {
        var directory = FindDirectory("packages", "collections");
        var registry = new SchemaRegistry();
        var build = new BuildOptions
        {
            SchemaRegistry = registry,
            Dialect = Dialect.Draft202012,
        };
        _byCollection = new Dictionary<string, JsonSchema>(StringComparer.Ordinal);
        _documents = new Dictionary<string, JsonElement>(StringComparer.Ordinal);
        foreach (var file in Directory.GetFiles(directory, "*.json"))
        {
            var name = Path.GetFileNameWithoutExtension(file);
            _byCollection[name] = JsonSchema.FromFile(file, build);
            using var document = JsonDocument.Parse(File.ReadAllText(file));
            _documents[name] = document.RootElement.Clone();
        }

        _options = new EvaluationOptions { OutputFormat = OutputFormat.List };
    }

    public IReadOnlyDictionary<string, JsonElement> Documents => _documents;

    public JsonElement Catalog()
    {
        var bundled = SectionDocuments();
        return JsonSerializer.SerializeToElement(new
        {
            defs = bundled.GetProperty("defs"),
            sections = bundled.GetProperty("sections"),
            collections = _documents,
        }, ContentJson.Options);
    }

    public IReadOnlyList<string> Validate(string collection, string fieldsJson)
    {
        if (!_byCollection.TryGetValue(collection, out var schema))
            return ["Unknown collection."];

        using var document = JsonDocument.Parse(fieldsJson);
        var result = schema.Evaluate(document.RootElement, _options);
        if (result.IsValid)
            return [];

        var errors = new List<string>();
        Collect(result, errors);
        return errors.Count == 0 ? ["is invalid."] : errors;
    }

    public static JsonElement SectionDocuments()
    {
        var directory = FindDirectory("packages", "sections");
        var sections = new Dictionary<string, JsonElement>(StringComparer.Ordinal);
        JsonElement defs;
        using (var defsDocument = JsonDocument.Parse(File.ReadAllText(Path.Combine(directory, "defs.json"))))
            defs = defsDocument.RootElement.Clone();
        foreach (var file in Directory.GetFiles(directory, "*.json"))
        {
            var name = Path.GetFileNameWithoutExtension(file);
            if (name.Equals("defs", StringComparison.OrdinalIgnoreCase))
                continue;
            using var document = JsonDocument.Parse(File.ReadAllText(file));
            sections[name] = document.RootElement.Clone();
        }

        return JsonSerializer.SerializeToElement(new { defs, sections }, ContentJson.Options);
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

    private static string FindDirectory(string packages, string folder)
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            var candidate = Path.Combine(dir.FullName, packages, folder);
            if (Directory.Exists(candidate))
                return candidate;
        }

        throw new InvalidOperationException("Could not find " + packages + "/" + folder + ".");
    }
}
