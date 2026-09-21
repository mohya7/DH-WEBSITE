namespace DigitalHub.Api.Infrastructure;

/// <summary>
/// Handles controller exceptions before Serilog's request logger can record the exception
/// message. That message can contain SQL. Only the exception type is logged.
/// </summary>
public sealed class ExceptionShieldMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionShieldMiddleware> _logger;

    public ExceptionShieldMiddleware(RequestDelegate next, ILogger<ExceptionShieldMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception)
        {
            if (context.Response.HasStarted)
            {
                throw;
            }

            _logger.LogError("Unhandled {ExceptionType}", exception.GetType().Name);
            context.Response.Clear();
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            await ProblemResults.WriteAsync(
                context.Response,
                StatusCodes.Status500InternalServerError,
                "internal_error",
                "An unexpected error occurred.",
                context.RequestAborted);
        }
    }
}
