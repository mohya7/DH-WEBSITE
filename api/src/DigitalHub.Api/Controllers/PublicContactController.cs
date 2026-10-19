using DigitalHub.Api.Content;
using DigitalHub.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace DigitalHub.Api.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/v1/public/contact")]
public sealed class PublicContactController(PublicContactStore store) : ControllerBase
{
    /// <summary>
    /// The form's fields together are under 5,000 characters; 16 KB leaves room
    /// for JSON and non-Latin text and refuses anything far larger (finding L7).
    /// </summary>
    public const long BodyLimit = 16 * 1024;

    [HttpPost]
    [EnableRateLimiting("public-contact")]
    [RequestBodyLimit(BodyLimit)]
    public async Task<IActionResult> Post([FromBody] PublicContactRequest request, CancellationToken cancellationToken)
    {
        var outcome = await store.SubmitAsync(request, cancellationToken);
        if (outcome.Code is null)
            return StatusCode(outcome.Status, outcome.Body);

        if (outcome.Errors is { Count: > 0 })
        {
            var problem = new ValidationProblemDetails(outcome.Errors)
            {
                Status = outcome.Status,
                Title = outcome.Title,
                Type = "https://tools.ietf.org/html/rfc7807",
            };
            problem.Extensions["code"] = outcome.Code;
            return new ObjectResult(problem)
            {
                StatusCode = outcome.Status,
                ContentTypes = { "application/problem+json" },
            };
        }

        return ProblemResults.Create(outcome.Status, outcome.Code, outcome.Title ?? "The request failed.");
    }
}
