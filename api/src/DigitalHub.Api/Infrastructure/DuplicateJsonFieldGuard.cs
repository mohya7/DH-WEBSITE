using System.Text;
using System.Text.Json;

namespace DigitalHub.Api.Infrastructure;

/// <summary>
/// Marks an action whose JSON body must not name the same top-level field twice,
/// compared case-insensitively. The model binder is case-insensitive and keeps
/// the last of "email" and "Email"; anything else that reads the body could see
/// the first. Refusing the body removes the disagreement (finding H1).
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public sealed class RejectDuplicateJsonFieldsAttribute : Attribute;

public sealed class DuplicateJsonFieldGuardMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        if (context.GetEndpoint()?.Metadata.GetMetadata<RejectDuplicateJsonFieldsAttribute>() is not null
            && context.Request.HasJsonContentType())
        {
            context.Request.EnableBuffering();
            string body;
            using (var reader = new StreamReader(context.Request.Body, Encoding.UTF8, detectEncodingFromByteOrderMarks: false, bufferSize: 1024, leaveOpen: true))
            {
                body = await reader.ReadToEndAsync(context.RequestAborted);
            }

            context.Request.Body.Position = 0;
            if (DuplicateField(body) is string field)
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                await ProblemResults.WriteAsync(
                    context.Response,
                    StatusCodes.Status400BadRequest,
                    "duplicate_field",
                    $"The field \"{field}\" appears more than once.",
                    context.RequestAborted);
                return;
            }
        }

        await next(context);
    }

    /// <summary>The first top-level field name that repeats, ignoring case; null when none does or the body is not a JSON object.</summary>
    public static string? DuplicateField(string body)
    {
        if (string.IsNullOrWhiteSpace(body))
            return null;
        try
        {
            using var document = JsonDocument.Parse(body);
            if (document.RootElement.ValueKind != JsonValueKind.Object)
                return null;
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var property in document.RootElement.EnumerateObject())
            {
                if (!seen.Add(property.Name))
                    return property.Name.ToLowerInvariant();
            }
        }
        catch (JsonException)
        {
            // Malformed JSON is the model binder's to refuse.
        }

        return null;
    }
}
