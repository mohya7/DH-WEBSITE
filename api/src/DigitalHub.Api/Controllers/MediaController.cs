using DigitalHub.Api.Content;
using DigitalHub.Api.Conventions;
using DigitalHub.Api.Infrastructure;
using DigitalHub.Images;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace DigitalHub.Api.Controllers;

[ApiController]
[Authorize(Policy = "studio")]
[Route("api/v1/media")]
public sealed class MediaController(MediaLibrary library) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] PageQuery page, [FromQuery] string? search, CancellationToken cancellationToken) =>
        Respond(await library.ListAsync(page.Page, page.PageSize, search, cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken cancellationToken) =>
        Respond(await library.GetAsync(id, cancellationToken));

    [HttpPost]
    [EnableRateLimiting("media-upload")]
    [RequestSizeLimit(ImagePipeline.MaxBytes + (256 * 1024))]
    [RequestFormLimits(MultipartBodyLengthLimit = ImagePipeline.MaxBytes + (256 * 1024))]
    public async Task<IActionResult> Upload([FromForm] MediaUpload request, CancellationToken cancellationToken)
    {
        if (request.File is null || request.File.Length == 0)
            return ProblemResults.Create(StatusCodes.Status400BadRequest, "validation_failed", "Choose an image to upload.");
        await using var stream = request.File.OpenReadStream();
        return Respond(await library.UploadAsync(stream, request.File.Length, request.File.FileName, request.Alt, request.Decorative, request.Caption, UserId(), cancellationToken));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] MediaEdit request, CancellationToken cancellationToken) =>
        Respond(await library.UpdateAsync(id, request.Alt, request.Decorative, request.Caption, UserId(), cancellationToken));

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "studio-admin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var outcome = await library.DeleteAsync(id, UserId(), cancellationToken);
        if (outcome.Status == StatusCodes.Status204NoContent && outcome.Code is null)
            return NoContent();
        return Respond(outcome);
    }

    private string? UserId() => User.FindFirst("sub")?.Value;

    private IActionResult Respond(MediaOutcome outcome)
    {
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

        if (outcome.Usages is { Count: > 0 })
        {
            var problem = new ProblemDetails
            {
                Status = outcome.Status,
                Title = outcome.Title,
                Type = "https://tools.ietf.org/html/rfc7807",
            };
            problem.Extensions["code"] = outcome.Code;
            problem.Extensions["usages"] = outcome.Usages;
            return new ObjectResult(problem)
            {
                StatusCode = outcome.Status,
                ContentTypes = { "application/problem+json" },
            };
        }

        return ProblemResults.Create(outcome.Status, outcome.Code, outcome.Title ?? "The request failed.");
    }
}

public sealed class MediaUpload
{
    public IFormFile? File { get; set; }

    public string? Alt { get; set; }

    public bool Decorative { get; set; }

    public string? Caption { get; set; }
}

public sealed class MediaEdit
{
    public string? Alt { get; set; }

    public bool Decorative { get; set; }

    public string? Caption { get; set; }
}
