using System.Text.Json;
using Microsoft.AspNetCore.Mvc;

namespace DigitalHub.Api.Infrastructure;

public static class ProblemResults
{
    public static IActionResult Create(int status, string code, string title)
    {
        var problem = new ProblemDetails
        {
            Status = status,
            Title = title,
            Type = "https://tools.ietf.org/html/rfc7807",
        };
        problem.Extensions["code"] = code;
        return new ObjectResult(problem)
        {
            StatusCode = status,
            ContentTypes = { "application/problem+json" },
        };
    }

    public static Task WriteAsync(HttpResponse response, int status, string code, string title, CancellationToken cancellationToken)
    {
        response.ContentType = "application/problem+json";
        var json = JsonSerializer.Serialize(new
        {
            type = "https://tools.ietf.org/html/rfc7807",
            title,
            status,
            code,
        });
        return response.WriteAsync(json, cancellationToken);
    }
}
