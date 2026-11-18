using System.Text.RegularExpressions;
using Json.Schema;

namespace DigitalHub.Api.Content;

/// <summary>
/// The schema formats the website build asserts (ADM-02). The build registers one
/// format, "uuid", in website/src/content/validate.ts and refuses content that
/// does not match it; its lookups then compare ids as exact lower-case strings.
/// So the API asserts "uuid" on published content as the website's pattern
/// without its /i flag: a lower-case UUID, the form the API always writes.
/// SchemaFormatTests reads validate.ts and fails if the two drift apart.
/// </summary>
public static class SchemaFormats
{
    /// <summary>The website's expression, exactly as validate.ts writes it.</summary>
    public const string WebsiteUuidSource = "/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i";

    /// <summary>
    /// The website's pattern in lower case only. Explicit ranges, not \d, so no other
    /// digit matches; \A and \z, because .NET's $ also matches before a final newline
    /// and JavaScript's does not.
    /// </summary>
    public static readonly Regex Uuid = new(
        @"\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z",
        RegexOptions.CultureInvariant);

    /// <summary>
    /// Formats asserted, with "uuid" from a registry of these options' own. A new
    /// EvaluationOptions hands out FormatRegistry.Global by default, so the registry
    /// is replaced, never registered into, and the global one is not changed. A
    /// format not registered here would fall back to the global one; SchemaFormatTests
    /// fails if a schema starts to use another format.
    /// </summary>
    public static EvaluationOptions Asserting()
    {
        var registry = new FormatRegistry();
        registry.Register(new RegexFormat("uuid", Uuid));
        return new EvaluationOptions
        {
            OutputFormat = OutputFormat.List,
            RequireFormatValidation = true,
            FormatRegistry = registry,
        };
    }

    /// <summary>Formats as annotations only: what every check used before ADM-02, and what a draft still gets.</summary>
    public static EvaluationOptions Annotating() => new() { OutputFormat = OutputFormat.List };
}
