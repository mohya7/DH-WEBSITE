using DigitalHub.Api.Content;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalHub.Api.Controllers;

[ApiController]
[Authorize(Policy = "studio")]
[Route("api/v1/schemas")]
public sealed class SchemaController(CollectionSchemaSet schemas) : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(schemas.Catalog());
}
