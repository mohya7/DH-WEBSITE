namespace DigitalHub.Api.Infrastructure;

/// <summary>
/// Handles controller exceptions before Serilog's request logger can record the exception
/// message. That message can contain SQL. Only the exception type is logged.
/// </summary>
public sealed class ExceptionShieldMiddleware
{
    /// <summary>The status nginx and others use for a request the client abandoned.</summary>
    public const int ClientClosedRequest = 499;

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
            // The client went away, mid-body or before the answer: not a server
            // error. There is no one to answer; record 499 (client closed request)
            // instead of letting the request log a 500 (P3 b).
            _logger.LogInformation("Client closed the request before it finished");
            if (!context.Response.HasStarted)
                context.Response.StatusCode = ClientClosedRequest;
        }
        catch (BadHttpRequestException bad) when (!context.Response.HasStarted)
        {
            // Kestrel's own verdict on a malformed request, such as a chunked body
            // that ends before its last chunk because the client went away: the
            // client's error, with Kestrel's status (400, 413...), not a 500.
            _logger.LogInformation("Bad request from the client: {StatusCode}", bad.StatusCode);
            context.Response.Clear();
            context.Response.StatusCode = bad.StatusCode;
            try
            {
                await ProblemResults.WriteAsync(context.Response, bad.StatusCode, "bad_request", "The request could not be read.", context.RequestAborted);
            }
            catch (Exception) when (context.RequestAborted.IsCancellationRequested)
            {
                // The client is already gone.
            }
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
