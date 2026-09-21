namespace DigitalHub.Api.Infrastructure;

public sealed class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;
    private readonly bool _hstsEnabled;

    public SecurityHeadersMiddleware(RequestDelegate next, IConfiguration configuration)
    {
        _next = next;
        _hstsEnabled = configuration.GetValue("Security:HstsEnabled", false);
    }

    public Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(() =>
        {
            var headers = context.Response.Headers;
            headers["X-Content-Type-Options"] = "nosniff";
            headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
            headers["X-Frame-Options"] = "DENY";
            if (_hstsEnabled && context.Request.IsHttps)
            {
                headers["Strict-Transport-Security"] = "max-age=86400";
            }

            return Task.CompletedTask;
        });

        return _next(context);
    }
}
