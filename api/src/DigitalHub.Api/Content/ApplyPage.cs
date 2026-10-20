namespace DigitalHub.Api.Content;

/// <summary>The small HTML page every apply refusal and acceptance uses.</summary>
public static class ApplyPage
{
    public static bool IsApply(HttpRequest request) =>
        request.Path.StartsWithSegments("/api/v1/public/apply");

    public static string Html(string code, string message) =>
        "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>Application</title></head><body data-code=\""
        + code + "\"><p>"
        + System.Net.WebUtility.HtmlEncode(message)
        + "</p><p><a href=\"/careers\">Back to careers</a></p></body></html>";

    public static IResult Result(int status, string code, string message) =>
        Results.Content(Html(code, message), "text/html; charset=utf-8", statusCode: status);

    public static Task WriteAsync(HttpResponse response, int status, string code, string message, CancellationToken cancellationToken)
    {
        response.StatusCode = status;
        response.ContentType = "text/html; charset=utf-8";
        return response.WriteAsync(Html(code, message), cancellationToken);
    }
}
