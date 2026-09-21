using System.Text;
using System.Text.Json;

namespace DigitalHub.Api.Infrastructure;

/// <summary>
/// Stores the login email so the rate limiter can key on IP and username together.
/// The address comes from the connection, not from a forwarded header.
/// </summary>
public sealed class LoginRateLimitKeyMiddleware(RequestDelegate next)
{
    public const string EmailItem = "login-email";

    public async Task InvokeAsync(HttpContext context)
    {
        if (HttpMethods.IsPost(context.Request.Method)
            && context.Request.Path.Equals("/api/v1/auth/login", StringComparison.OrdinalIgnoreCase))
        {
            context.Request.EnableBuffering();
            using var reader = new StreamReader(context.Request.Body, Encoding.UTF8, detectEncodingFromByteOrderMarks: false, bufferSize: 1024, leaveOpen: true);
            var body = await reader.ReadToEndAsync(context.RequestAborted);
            context.Request.Body.Position = 0;
            context.Items[EmailItem] = ReadEmail(body);
        }

        await next(context);
    }

    private static string ReadEmail(string body)
    {
        if (string.IsNullOrWhiteSpace(body))
        {
            return "";
        }

        try
        {
            using var document = JsonDocument.Parse(body);
            if (document.RootElement.TryGetProperty("email", out var email) && email.ValueKind == JsonValueKind.String)
            {
                return email.GetString()?.Trim().ToLowerInvariant() ?? "";
            }
        }
        catch (JsonException)
        {
            return "";
        }

        return "";
    }
}
