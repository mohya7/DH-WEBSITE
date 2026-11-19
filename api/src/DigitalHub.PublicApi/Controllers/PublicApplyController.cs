using DigitalHub.Forms;
using DigitalHub.PublicApi.Infrastructure;
using Microsoft.AspNetCore.Mvc;

namespace DigitalHub.PublicApi.Controllers;

/// <summary>
/// The apply form (ADR 0001, point 1): the same route, verb, body limits and body
/// as the admin API's copy, which ISO-4 removes. There is no [AllowAnonymous]:
/// this process has no authorization to opt out of.
/// </summary>
[ApiController]
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
