using System.ComponentModel.DataAnnotations;
using DigitalHub.Api.Conventions;
using DigitalHub.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace DigitalHub.Api.Tests;

/// <summary>
/// Exercises API conventions. Registered only by the test host.
/// </summary>
[ApiController]
[Route("api/v1/examples")]
public sealed class ConventionProbeController : ControllerBase
{
    private readonly NoteStore _notes;

    public ConventionProbeController(NoteStore notes)
    {
        _notes = notes;
    }

    [AllowAnonymous]
    [HttpGet("clock")]
    public ActionResult<ClockResponse> Clock()
    {
        return Ok(new ClockResponse(DateTime.UtcNow));
    }

    [AllowAnonymous]
    [HttpGet("notes")]
    public ActionResult<PageResult<NoteResponse>> List([FromQuery] PageQuery page)
    {
        var all = _notes.List();
        var items = all.Skip((page.Page - 1) * page.PageSize).Take(page.PageSize).ToArray();
        return Ok(new PageResult<NoteResponse>(items, page.Page, page.PageSize, all.Count));
    }

    [AllowAnonymous]
    [HttpPost("notes")]
    public ActionResult<NoteResponse> Create([FromBody] CreateNoteRequest request)
    {
        var note = _notes.Add(request.Name);
        return Created($"/api/v1/examples/notes/{note.Id}", note);
    }

    [AllowAnonymous]
    [HttpPut("notes/{id:guid}")]
    public IActionResult Update(Guid id, [FromBody] UpdateNoteRequest request)
    {
        var result = _notes.Update(id, request.Name, request.Version);
        if (result == UpdateOutcome.Missing)
        {
            return ProblemResults.Create(StatusCodes.Status404NotFound, "not_found", "Note was not found.");
        }

        if (result == UpdateOutcome.Stale)
        {
            return ProblemResults.Create(StatusCodes.Status409Conflict, "concurrency_conflict", "The note was changed by someone else.");
        }

        return Ok(_notes.Get(id));
    }

    [AllowAnonymous]
    [HttpGet("boom")]
    public IActionResult Boom()
    {
        throw new InvalidOperationException("SELECT password FROM dbo.admin_users WHERE 1=1");
    }

    [HttpGet("private")]
    public IActionResult Private()
    {
        return Ok(new { ok = true });
    }

    [Authorize(Policy = "admin")]
    [HttpGet("admin")]
    public IActionResult AdminOnly()
    {
        return Ok(new { ok = true });
    }

    public sealed record ClockResponse(DateTime At);

    public sealed class CreateNoteRequest
    {
        [Required]
        [MaxLength(80)]
        public string Name { get; set; } = "";
    }

    public sealed class UpdateNoteRequest
    {
        [Required]
        [MaxLength(80)]
        public string Name { get; set; } = "";

        [Required]
        public int Version { get; set; }
    }
}
