using DigitalHub.Api.Content;
using DigitalHub.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalHub.Api.Controllers;

/// <summary>
/// ADM-04: change a user's role, and reactivate a deactivated user. The same prefix and
/// policy as UsersController (attribute routes may share a prefix), in a file of its own
/// because AdminControllers.cs was held by ADM-05. ADM-04b may move UsersController's
/// actions here.
/// </summary>
[ApiController]
[Authorize(Policy = "studio-admin")]
[Route("api/v1/users")]
public sealed class UserAccessController(UserAccessStore store) : ControllerBase
{
    // Two "role" keys would otherwise apply the last one; the guard reads the body
    // before authentication, so the body is capped too.
    [RequestBodyLimit(AuthController.AuthBodyLimit)]
    [RejectDuplicateJsonFields]
    [HttpPut("{id}/role")]
    public async Task<IActionResult> ChangeRole(string id, [FromBody] UserRoleChange request, CancellationToken cancellationToken) =>
        Respond(await store.ChangeRoleAsync(id, request, UserId(), cancellationToken));

    // No body is read; the cap stops a large one being buffered for nothing (F-7).
    [RequestBodyLimit(AuthController.AuthBodyLimit)]
    [HttpPost("{id}/reactivate")]
    public async Task<IActionResult> Reactivate(string id, CancellationToken cancellationToken)
    {
        var outcome = await store.ReactivateAsync(id, UserId(), cancellationToken);
        // The answer carries a temporary password: no proxy or browser may keep it (F-9).
        if (outcome.Code is null && outcome.Status == StatusCodes.Status200OK)
            Response.Headers.CacheControl = "no-store";
        return Respond(outcome);
    }

    private string? UserId() => User.FindFirst("sub")?.Value;

    private IActionResult Respond(ContentOutcome outcome) => AdminResponse.From(outcome);
}
