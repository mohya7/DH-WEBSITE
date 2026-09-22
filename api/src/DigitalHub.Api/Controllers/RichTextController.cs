using DigitalHub.Api.Content;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalHub.Api.Controllers;

[ApiController]
[Authorize(Policy = "studio")]
[Route("api/v1/rich-text")]
public sealed class RichTextController : ControllerBase
{
    [HttpPost("paste")]
    public IActionResult Paste([FromBody] RichTextPaste request)
    {
        var result = RichText.FilterPaste(request.Document);
        return Ok(new { document = result.Document, imagesDropped = result.ImagesDropped });
    }
}

public sealed class RichTextPaste
{
    public string? Document { get; set; }
}
