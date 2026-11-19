namespace DigitalHub.PublicApi.Infrastructure;

/// <summary>
/// ADR 0001, point 1: "Its fallback policy denies everything else." This process
/// has no authentication scheme, so the deny-by-default is this gate: only POST
/// on the two exact form paths passes, ignoring case as routing does. Any other
/// method on them (routing would answer 405), a trailing slash (routing would
/// match it) and every other path get the same 404 problem, without the body
/// being read. It runs after request logging and the exception shield, and
/// before the body limit and the rate limiter, so a refused probe is logged and
/// costs nothing else.
/// </summary>
public sealed class PublicRouteGate(RequestDelegate next)
{
    public static readonly PathString Contact = "/api/v1/public/contact";
    public static readonly PathString Apply = "/api/v1/public/apply";

    public Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path;
        if (HttpMethods.IsPost(context.Request.Method)
            && (path.Equals(Contact, StringComparison.OrdinalIgnoreCase) || path.Equals(Apply, StringComparison.OrdinalIgnoreCase)))
            return next(context);

        context.Response.StatusCode = StatusCodes.Status404NotFound;
        return ProblemResults.WriteAsync(context.Response, StatusCodes.Status404NotFound, "not_found", "Not found.", context.RequestAborted);
    }
}
