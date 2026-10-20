using System.Text.Json;

namespace DigitalHub.Api.Content;

/// <summary>
/// Finds the link fields (x-dh-kind "url") in a JSON Schema, following $ref into
/// the given definitions, and the values at those places in a document. Shared
/// by the section and collection validators (finding O1).
/// </summary>
public static class SchemaLinks
{
    /// <summary>Adds one path per x-dh-kind "url" place to found; "*" stands for every item of an array.</summary>
    public static void FindUrls(JsonElement schema, List<string> path, Dictionary<string, JsonElement> defs, List<string[]> found, int depth)
    {
        if (schema.ValueKind != JsonValueKind.Object || depth > 32)
            return;
        if (schema.TryGetProperty("x-dh-kind", out var kind) && kind.ValueKind == JsonValueKind.String && kind.GetString() == "url")
            found.Add([.. path]);
        if (schema.TryGetProperty("$ref", out var reference) && reference.ValueKind == JsonValueKind.String
            && reference.GetString() is { } target && target.IndexOf("#/$defs/", StringComparison.Ordinal) is var at and >= 0
            && defs.TryGetValue(target[(at + "#/$defs/".Length)..], out var definition))
            FindUrls(definition, path, defs, found, depth + 1);
        if (schema.TryGetProperty("properties", out var properties) && properties.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in properties.EnumerateObject())
                FindUrls(property.Value, [.. path, property.Name], defs, found, depth + 1);
        }

        if (schema.TryGetProperty("items", out var items))
            FindUrls(items, [.. path, "*"], defs, found, depth + 1);
        foreach (var combinator in new[] { "oneOf", "anyOf", "allOf" })
        {
            if (schema.TryGetProperty(combinator, out var branches) && branches.ValueKind == JsonValueKind.Array)
            {
                foreach (var branch in branches.EnumerateArray())
                    FindUrls(branch, path, defs, found, depth + 1);
            }
        }
    }

    /// <summary>Every value at a path, with its location ("/channels/1/href").</summary>
    public static IEnumerable<(string Location, JsonElement Value)> Values(JsonElement node, string[] path, int index, string location)
    {
        if (index == path.Length)
        {
            yield return (location, node);
            yield break;
        }

        if (path[index] == "*")
        {
            if (node.ValueKind != JsonValueKind.Array)
                yield break;
            var position = 0;
            foreach (var item in node.EnumerateArray())
            {
                foreach (var found in Values(item, path, index + 1, $"{location}/{position}"))
                    yield return found;
                position++;
            }
        }
        else if (node.ValueKind == JsonValueKind.Object && node.TryGetProperty(path[index], out var child))
        {
            foreach (var found in Values(child, path, index + 1, $"{location}/{path[index]}"))
                yield return found;
        }
    }
}
