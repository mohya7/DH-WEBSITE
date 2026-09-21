using Microsoft.AspNetCore.Diagnostics;

namespace DigitalHub.Api.Infrastructure;

/// <summary>
/// Same body in every environment. The response never includes the exception message, stack, or SQL.
/// </summary>
public sealed class UnhandledExceptionHandler : IExceptionHandler
{
    private readonly ILogger<UnhandledExceptionHandler> _logger;

    public UnhandledExceptionHandler(ILogger<UnhandledExceptionHandler> logger)
    {
        _logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        _logger.LogError("Unhandled {ExceptionType}", exception.GetType().Name);
        httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await ProblemResults.WriteAsync(
            httpContext.Response,
            StatusCodes.Status500InternalServerError,
            "internal_error",
            "An unexpected error occurred.",
            cancellationToken);
        return true;
    }
}
