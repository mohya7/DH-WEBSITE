using DigitalHub.Api.Content;
using DigitalHub.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace DigitalHub.Api.Controllers;

/// <summary>
/// Everything a website build needs, in one response.
///
/// Deliberately not under /api/v1/public/*: that prefix is what the website's
/// own routing exposes, so keeping this outside it means the build endpoint is
/// never reachable through the public site however the front end is proxied.
///
/// AllowAnonymous opts out of the fallback policy, which requires a user with a
/// role. The build token replaces it, checked below before anything is read.
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/v1/build")]
public sealed class BuildContentController(BuildContentStore store, BuildToken token) : ControllerBase
{
    public const string HeaderName = "X-Build-Token";

    [HttpGet("content")]
    [EnableRateLimiting("build-content")]
    public async Task<IActionResult> Content(CancellationToken cancellationToken)
    {
        /* Same answer whether the token is absent, wrong, or not configured at
           all, so the response never says which. */
        if (!token.Configured || !token.Matches(Request.Headers[HeaderName]))
            return Problem("A valid build token is required.", statusCode: StatusCodes.Status401Unauthorized);

        return Ok(await store.BuildAsync(cancellationToken));
    }
}
