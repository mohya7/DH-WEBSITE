using DigitalHub.Api.Content;
using DigitalHub.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace DigitalHub.Api.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/v1/public/apply")]
public sealed class PublicApplyController(ApplicationIntake intake) : ControllerBase
{
    [HttpPost]
    [RequestBodyLimit(CvFile.BodyLimit)]
    [RequestFormLimits(MultipartBodyLengthLimit = CvFile.BodyLimit)]
    [RequestSizeLimit(CvFile.BodyLimit)]
    public async Task<IResult> Post(CancellationToken cancellationToken)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return await intake.SubmitAsync(Request, ip, cancellationToken);
    }
}
