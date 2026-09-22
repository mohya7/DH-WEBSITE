using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using DigitalHub.Api.Content;
using DigitalHub.Api.Conventions;
using DigitalHub.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalHub.Api.Controllers;

[ApiController]
[Authorize(Policy = "studio")]
[Route("api/v1/{collection}")]
public sealed class ContentController(ContentStore store) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(string collection, [FromQuery] PageQuery page, [FromQuery] string? search, [FromQuery] string? status, CancellationToken cancellationToken) =>
        Respond(await store.ListAsync(collection, page.Page, page.PageSize, search, status, cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(string collection, Guid id, CancellationToken cancellationToken) =>
        Respond(await store.GetAsync(collection, id, cancellationToken));

    [HttpPost]
    public async Task<IActionResult> Create(string collection, [FromBody] ContentWrite request, CancellationToken cancellationToken) =>
        Respond(await store.CreateAsync(collection, request, UserId(), cancellationToken));

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(string collection, Guid id, [FromBody] ContentUpdate request, CancellationToken cancellationToken) =>
        Respond(await store.UpdateAsync(collection, id, request.Version, request, UserId(), cancellationToken));

    [HttpPut("{id:guid}/save")]
    public async Task<IActionResult> Save(string collection, Guid id, [FromBody] ContentSave request, CancellationToken cancellationToken) =>
        Respond(await store.SaveAsync(collection, id, request, UserId(), cancellationToken));

    [HttpPost("order")]
    public async Task<IActionResult> Order(string collection, [FromBody] CollectionOrderRequest request, CancellationToken cancellationToken) =>
        Respond(await store.OrderAsync(collection, request.Items, UserId(), cancellationToken));

    [HttpPost("{id:guid}/end")]
    public async Task<IActionResult> End(string collection, Guid id, [FromBody] VersionBody request, CancellationToken cancellationToken) =>
        Respond(await store.EndAsync(collection, id, request.Version, UserId(), cancellationToken));

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "studio-admin")]
    public async Task<IActionResult> Delete(string collection, Guid id, [FromQuery][Range(1, int.MaxValue)] int version, CancellationToken cancellationToken)
    {
        var outcome = await store.DeleteAsync(collection, id, version, UserId(), cancellationToken);
        if (outcome.Status == StatusCodes.Status204NoContent && outcome.Code is null)
            return NoContent();
        return Respond(outcome);
    }

    [HttpPost("{id:guid}/discard")]
    public async Task<IActionResult> Discard(string collection, Guid id, [FromBody] VersionBody request, CancellationToken cancellationToken) =>
        Respond(await store.DiscardAsync(collection, id, request.Version, UserId(), cancellationToken));

    [HttpPost("{id:guid}/publish")]
    public async Task<IActionResult> Publish(string collection, Guid id, [FromBody] VersionBody request, CancellationToken cancellationToken) =>
        Respond(await store.PublishAsync(collection, id, request.Version, UserId(), cancellationToken));

    [HttpPost("{id:guid}/unpublish")]
    public async Task<IActionResult> Unpublish(string collection, Guid id, [FromBody] VersionBody request, CancellationToken cancellationToken) =>
        Respond(await store.UnpublishAsync(collection, id, request.Version, UserId(), cancellationToken));

    [HttpGet("{id:guid}/revisions")]
    public async Task<IActionResult> Revisions(string collection, Guid id, CancellationToken cancellationToken) =>
        Respond(await store.ListRevisionsAsync(collection, id, cancellationToken));

    [HttpGet("{id:guid}/revisions/{revisionId:guid}")]
    public async Task<IActionResult> Revision(string collection, Guid id, Guid revisionId, CancellationToken cancellationToken) =>
        Respond(await store.GetRevisionAsync(collection, id, revisionId, cancellationToken));

    [HttpPost("{id:guid}/revisions/{revisionId:guid}/restore")]
    public async Task<IActionResult> Restore(string collection, Guid id, Guid revisionId, [FromBody] VersionBody request, CancellationToken cancellationToken) =>
        Respond(await store.RestoreAsync(collection, id, revisionId, request.Version, UserId(), cancellationToken));

    [HttpPost("{id:guid}/sections")]
    public async Task<IActionResult> AddSection(string collection, Guid id, [FromBody] SectionCreate request, CancellationToken cancellationToken) =>
        Respond(await store.AddSectionAsync(collection, id, request.Version, request.Type, request.Visible, request.Fields, UserId(), cancellationToken));

    [HttpPut("{id:guid}/sections/{sectionId:guid}")]
    public async Task<IActionResult> UpdateSection(string collection, Guid id, Guid sectionId, [FromBody] SectionUpdate request, CancellationToken cancellationToken) =>
        Respond(await store.UpdateSectionAsync(collection, id, sectionId, request.Version, request.Fields, UserId(), cancellationToken));

    [HttpPost("{id:guid}/sections/reorder")]
    public async Task<IActionResult> Reorder(string collection, Guid id, [FromBody] SectionReorder request, CancellationToken cancellationToken) =>
        Respond(await store.ReorderAsync(collection, id, request.Version, request.SectionIds, UserId(), cancellationToken));

    [HttpPost("{id:guid}/sections/{sectionId:guid}/visibility")]
    public async Task<IActionResult> Visibility(string collection, Guid id, Guid sectionId, [FromBody] SectionVisibility request, CancellationToken cancellationToken) =>
        Respond(await store.VisibilityAsync(collection, id, sectionId, request.Version, request.Visible, UserId(), cancellationToken));

    [HttpDelete("{id:guid}/sections/{sectionId:guid}")]
    public async Task<IActionResult> RemoveSection(string collection, Guid id, Guid sectionId, [FromQuery][Range(1, int.MaxValue)] int version, CancellationToken cancellationToken) =>
        Respond(await store.RemoveSectionAsync(collection, id, sectionId, version, UserId(), cancellationToken));

    private string? UserId() => User.FindFirst("sub")?.Value;

    private IActionResult Respond(ContentOutcome outcome)
    {
        if (outcome.Code is null)
        {
            return StatusCode(outcome.Status, outcome.Body);
        }

        if (outcome.Errors is { Count: > 0 })
        {
            var problem = new ValidationProblemDetails(outcome.Errors)
            {
                Status = outcome.Status,
                Title = outcome.Title,
                Type = "https://tools.ietf.org/html/rfc7807",
            };
            problem.Extensions["code"] = outcome.Code;
            if (outcome.Warnings is { Count: > 0 })
                problem.Extensions["warnings"] = outcome.Warnings;
            return new ObjectResult(problem)
            {
                StatusCode = outcome.Status,
                ContentTypes = { "application/problem+json" },
            };
        }

        return ProblemResults.Create(outcome.Status, outcome.Code, outcome.Title ?? "The request failed.");
    }
}

public sealed class VersionBody
{
    [Range(1, int.MaxValue)]
    public int Version { get; set; }
}

public sealed class SectionCreate
{
    [Range(1, int.MaxValue)]
    public int Version { get; set; }

    public string Type { get; set; } = "";

    public bool Visible { get; set; } = true;

    public JsonElement Fields { get; set; }
}

public sealed class SectionUpdate
{
    [Range(1, int.MaxValue)]
    public int Version { get; set; }

    public JsonElement Fields { get; set; }
}

public sealed class SectionReorder
{
    [Range(1, int.MaxValue)]
    public int Version { get; set; }

    public List<Guid> SectionIds { get; set; } = [];
}

public sealed class SectionVisibility
{
    [Range(1, int.MaxValue)]
    public int Version { get; set; }

    public bool Visible { get; set; }
}
