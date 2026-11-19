using DigitalHub.Forms;
using DigitalHub.PublicApi.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace DigitalHub.PublicApi.Controllers;

/// <summary>
/// The contact form (ADR 0001, point 1): the same route, verb, rate limit, body
/// limit and body as the admin API's copy, which ISO-4 removes. There is no
/// [AllowAnonymous]: this process has no authorization to opt out of.
/// </summary>
[ApiController]
[Route("api/v1/public/contact")]
public sealed class PublicContactController(PublicContactStore store) : ControllerBase
{
    /// <summary>
    /// The form's fields together are under 5,000 characters; 16 KB leaves room
    /// for JSON and non-Latin text and refuses anything far larger (finding L7).
    /// </summary>
    public const long BodyLimit = 16 * 1024;

    [HttpPost]
    [EnableRateLimiting(ContactRateLimit.PolicyName)]
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
