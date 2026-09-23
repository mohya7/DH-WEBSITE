using DigitalHub.Api.Content;
using DigitalHub.Api.Conventions;
using DigitalHub.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalHub.Api.Controllers;

[ApiController]
[Authorize(Policy = "studio")]
[Route("api/v1/navigation")]
public sealed class NavigationController(AdminStore store) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string? menu, CancellationToken cancellationToken) =>
        Respond(await store.GetNavigationAsync(menu, cancellationToken));

    [HttpPut]
    public async Task<IActionResult> Put([FromBody] NavigationReplaceRequest request, CancellationToken cancellationToken) =>
        Respond(await store.ReplaceNavigationAsync(request, UserId(), cancellationToken));

    private string? UserId() => User.FindFirst("sub")?.Value;

    private IActionResult Respond(ContentOutcome outcome) => AdminResponse.From(outcome);
}

[ApiController]
[Authorize(Policy = "studio")]
[Route("api/v1/redirects")]
public sealed class RedirectsController(AdminStore store) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] PageQuery page, [FromQuery] string? search, CancellationToken cancellationToken) =>
        Respond(await store.ListRedirectsAsync(page.Page, page.PageSize, search, cancellationToken));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] RedirectCreateRequest request, CancellationToken cancellationToken) =>
        Respond(await store.CreateRedirectAsync(request, UserId(), cancellationToken));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var outcome = await store.DeleteRedirectAsync(id, UserId(), cancellationToken);
        if (outcome.Status == StatusCodes.Status204NoContent && outcome.Code is null)
            return NoContent();
        return Respond(outcome);
    }

    private string? UserId() => User.FindFirst("sub")?.Value;

    private IActionResult Respond(ContentOutcome outcome) => AdminResponse.From(outcome);
}

[ApiController]
[Authorize(Policy = "studio")]
[Route("api/v1/settings")]
public sealed class SettingsController(AdminStore store) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken) =>
        Respond(await store.GetSettingsAsync(cancellationToken));

    [HttpPut]
    [Authorize(Policy = "studio-admin")]
    public async Task<IActionResult> Put([FromBody] SiteSettingsUpdate request, CancellationToken cancellationToken) =>
        Respond(await store.UpdateSettingsAsync(request, UserId(), cancellationToken));

    private string? UserId() => User.FindFirst("sub")?.Value;

    private IActionResult Respond(ContentOutcome outcome) => AdminResponse.From(outcome);
}

[ApiController]
[Authorize(Policy = "studio-admin")]
[Route("api/v1/users")]
public sealed class UsersController(AdminStore store) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken cancellationToken) =>
        Respond(await store.ListUsersAsync(cancellationToken));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] UserCreateRequest request, CancellationToken cancellationToken) =>
        Respond(await store.CreateUserAsync(request, UserId(), cancellationToken));

    [HttpPost("{id}/deactivate")]
    public async Task<IActionResult> Deactivate(string id, CancellationToken cancellationToken) =>
        Respond(await store.DeactivateUserAsync(id, UserId(), cancellationToken));

    [HttpPost("{id}/reset-password")]
    public async Task<IActionResult> ResetPassword(string id, CancellationToken cancellationToken) =>
        Respond(await store.ResetPasswordAsync(id, UserId(), cancellationToken));

    private string? UserId() => User.FindFirst("sub")?.Value;

    private IActionResult Respond(ContentOutcome outcome) => AdminResponse.From(outcome);
}

[ApiController]
[Authorize(Policy = "studio-admin")]
[Route("api/v1/audit")]
public sealed class AuditController(AdminStore store) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] PageQuery page,
        [FromQuery] string? userId,
        [FromQuery] string? action,
        [FromQuery] string? entityType,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken cancellationToken) =>
        Respond(await store.ListAuditAsync(userId, action, entityType, from, to, page.Page, page.PageSize, cancellationToken));

    private IActionResult Respond(ContentOutcome outcome) => AdminResponse.From(outcome);
}

[ApiController]
[Authorize(Policy = "studio")]
[Route("api/v1/contact-requests")]
public sealed class ContactRequestsController(AdminStore store) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] PageQuery page, [FromQuery] string? search, CancellationToken cancellationToken) =>
        Respond(await store.ListContactRequestsAsync(page.Page, page.PageSize, search, cancellationToken));

    [HttpGet("new-count")]
    public async Task<IActionResult> NewCount(CancellationToken cancellationToken) =>
        Respond(await store.CountNewContactRequestsAsync(cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken cancellationToken) =>
        Respond(await store.GetContactRequestAsync(id, cancellationToken));

    [HttpPost("{id:guid}/handled")]
    public async Task<IActionResult> Handled(Guid id, CancellationToken cancellationToken) =>
        Respond(await store.HandleContactRequestAsync(id, UserId(), cancellationToken));

    private string? UserId() => User.FindFirst("sub")?.Value;

    private IActionResult Respond(ContentOutcome outcome) => AdminResponse.From(outcome);
}

[ApiController]
[Authorize(Policy = "studio")]
[Route("api/v1/error-pages")]
public sealed class ErrorPagesController(AdminStore store) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken cancellationToken) =>
        Respond(await store.ListErrorPagesAsync(cancellationToken));

    [HttpPut("{type}")]
    public async Task<IActionResult> Put(string type, [FromBody] ErrorPageUpdate request, CancellationToken cancellationToken) =>
        Respond(await store.UpdateErrorPageAsync(type, request, UserId(), cancellationToken));

    private string? UserId() => User.FindFirst("sub")?.Value;

    private IActionResult Respond(ContentOutcome outcome) => AdminResponse.From(outcome);
}

internal static class AdminResponse
{
    public static IActionResult From(ContentOutcome outcome)
    {
        if (outcome.Code is null)
            return new ObjectResult(outcome.Body) { StatusCode = outcome.Status };

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
