using System.Net;
using DigitalHub.Forms;
using DigitalHub.PublicApi.Data;
using DigitalHub.PublicApi.Infrastructure;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Serilog;

// ISO-2 (ADR 0001, point 1): the public forms API. Its own process, with only
// POST /api/v1/public/contact and POST /api/v1/public/apply. No authentication,
// no Identity, no signing key, no refresh cookie and no Studio controllers.
var builder = WebApplication.CreateBuilder(args);

// Finding 9 (GAP-12): no server banner. Kestrel writes Server itself, after
// any middleware, so it is turned off here and not removed in a middleware.
builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false);

builder.Host.UseSerilog((context, services, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    // Sinks registered as services too; the tests use one to read the log.
    .ReadFrom.Services(services)
    .Enrich.FromLogContext()
    .Destructure.With<SensitiveDestructuringPolicy>()
    .WriteTo.Console(outputTemplate: "[{Timestamp:O} {Level:u3}] {CorrelationId} {Message:lj}{NewLine}{Exception}"));

// Fail closed (P-5). Its own key, so the public site's connection string is
// never confused with the admin's. ISO-3 points it at dh_public_forms.
var connectionString = builder.Configuration.GetConnectionString("PublicForms");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException("ConnectionStrings:PublicForms is not configured.");
}

// The Auth section holds the admin's signing key and initial admin credentials.
// A copied admin configuration fails here instead of putting them in this process.
if (builder.Configuration.GetSection("Auth").Exists())
{
    throw new InvalidOperationException("The public forms API must not be given Auth settings (ADR 0001).");
}

builder.Services.AddDbContext<PublicFormsDbContext>(options => options.UseSqlServer(connectionString));
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddDigitalHubForms();
builder.Services.AddScoped<IFormsData, PublicFormsData>();

var knownProxies = new List<IPAddress>();
foreach (var value in builder.Configuration.GetSection("ForwardedHeaders:KnownProxies").GetChildren())
{
    if (IPAddress.TryParse(value.Value, out var address))
        knownProxies.Add(address);
}

// An empty or missing KnownProxies list must not trust X-Forwarded-For.
// ASP.NET Core treats an empty KnownProxies list as every sender, so a forged
// header would dodge the contact rate limit. With no proxy configured, the
// middleware is not applied and RemoteIpAddress stays the connection address.
// With entries, only those proxies are trusted.
var trustForwardedHeaders = knownProxies.Count > 0;
if (trustForwardedHeaders)
{
    builder.Services.Configure<ForwardedHeadersOptions>(options =>
    {
        options.ForwardedHeaders = ForwardedHeaders.XForwardedFor;
        options.KnownIPNetworks.Clear();
        options.KnownProxies.Clear();
        foreach (var address in knownProxies)
            options.KnownProxies.Add(address);
    });
}

var contactPermitLimit = builder.Configuration.GetValue("Contact:PermitLimit", 10);
var contactWindowHours = builder.Configuration.GetValue("Contact:WindowHours", 1);
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = (context, token) =>
    {
        var policy = context.HttpContext.GetEndpoint()?.Metadata.GetMetadata<EnableRateLimitingAttribute>()?.PolicyName;
        RateLimitLog.Refused(context.HttpContext, policy ?? "unknown");
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        return new ValueTask(ProblemResults.WriteAsync(
            context.HttpContext.Response,
            StatusCodes.Status429TooManyRequests,
            "rate_limited",
            "Too many contact submissions.",
            token));
    };
    options.AddPolicy(ContactRateLimit.PolicyName, httpContext =>
        ContactRateLimit.Partition(httpContext, contactPermitLimit, contactWindowHours));
});

builder.Services.AddExceptionHandler<UnhandledExceptionHandler>();
builder.Services.AddProblemDetails();

// No ApiV1RouteConvention: both routes are written out in full. No
// AddAuthentication, no authorization policy, no Identity, no health checks.
builder.Services.AddControllers()
.ConfigureApiBehaviorOptions(options =>
{
        options.InvalidModelStateResponseFactory = context =>
        {
            if (ApplyPage.IsApply(context.HttpContext.Request))
            {
                return new ContentResult
                {
                    StatusCode = StatusCodes.Status400BadRequest,
                    ContentType = "text/html; charset=utf-8",
                    Content = ApplyPage.Html("invalid_form", ApplicationIntake.Rejected),
                };
            }

            var problem = new ValidationProblemDetails(context.ModelState)
        {
            Status = StatusCodes.Status400BadRequest,
            Title = "One or more fields are invalid.",
            Type = "https://tools.ietf.org/html/rfc7807",
        };
        problem.Extensions["code"] = "validation_failed";
        return new BadRequestObjectResult(problem)
        {
            ContentTypes = { "application/problem+json" },
        };
    };
});

var app = builder.Build();

if (trustForwardedHeaders)
    app.UseForwardedHeaders();
app.UseMiddleware<CorrelationIdMiddleware>();
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseExceptionHandler();
app.UseSerilogRequestLogging(options =>
{
    options.MessageTemplate = "HTTP {RequestMethod} {RequestPath} responded {StatusCode} in {Elapsed:0.0000} ms";
});
app.UseMiddleware<ExceptionShieldMiddleware>();
app.UseMiddleware<RequestBodyLimitMiddleware>();
app.UseRateLimiter();

app.MapControllers();

app.Run();

public partial class Program;
