using System.Text;
using DigitalHub.Api.Conventions;
using DigitalHub.Api.Data;
using DigitalHub.Api.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, _, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .Enrich.FromLogContext()
    .Destructure.With<SensitiveDestructuringPolicy>()
    .WriteTo.Console(outputTemplate: "[{Timestamp:O} {Level:u3}] {CorrelationId} {Message:lj}{NewLine}{Exception}"));

var connectionString = builder.Configuration.GetConnectionString("Content");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException("ConnectionStrings:Content is not configured.");
}

var signingKey = builder.Configuration["Auth:SigningKey"];
if (string.IsNullOrWhiteSpace(signingKey))
{
    throw new InvalidOperationException("Auth:SigningKey is not configured.");
}

builder.Services.AddDbContext<ContentDbContext>(options => options.UseSqlServer(connectionString));

builder.Services.AddExceptionHandler<UnhandledExceptionHandler>();
builder.Services.AddProblemDetails();

builder.Services.AddControllers(options =>
{
    options.Conventions.Add(new ApiV1RouteConvention());
})
.AddJsonOptions(options =>
{
    options.JsonSerializerOptions.Converters.Add(new UtcDateTimeJsonConverter());
})
.ConfigureApiBehaviorOptions(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
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

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Auth:Issuer"],
            ValidAudience = builder.Configuration["Auth:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
            ClockSkew = TimeSpan.FromSeconds(30),
        };
        options.Events = new JwtBearerEvents
        {
            OnChallenge = async context =>
            {
                context.HandleResponse();
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await ProblemResults.WriteAsync(context.Response, StatusCodes.Status401Unauthorized, "unauthorized", "Authentication is required.", context.HttpContext.RequestAborted);
            },
            OnForbidden = async context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await ProblemResults.WriteAsync(context.Response, StatusCodes.Status403Forbidden, "forbidden", "You do not have access to this resource.", context.HttpContext.RequestAborted);
            },
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();

    foreach (var role in new[] { "admin", "editor", "hr", "marketing", "interviewer" })
    {
        options.AddPolicy(role, policy => policy.RequireRole(role));
    }
});

builder.Services.AddHealthChecks()
    .AddDbContextCheck<ContentDbContext>("database");

builder.Services.AddSingleton<ExampleNoteStore>();

var app = builder.Build();

app.UseMiddleware<CorrelationIdMiddleware>();
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseExceptionHandler();
app.UseSerilogRequestLogging(options =>
{
    options.MessageTemplate = "HTTP {RequestMethod} {RequestPath} responded {StatusCode} in {Elapsed:0.0000} ms";
});
app.UseMiddleware<ExceptionShieldMiddleware>();

var mediaRoot = Path.Combine(app.Environment.ContentRootPath, "media");
Directory.CreateDirectory(mediaRoot);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(mediaRoot),
    RequestPath = "/media",
});

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = async (context, report) =>
    {
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new
        {
            status = report.Status.ToString(),
            checks = report.Entries.Select(entry => new
            {
                name = entry.Key,
                status = entry.Value.Status.ToString(),
            }),
        });
    },
    ResultStatusCodes =
    {
        [HealthStatus.Healthy] = StatusCodes.Status200OK,
        [HealthStatus.Degraded] = StatusCodes.Status200OK,
        [HealthStatus.Unhealthy] = StatusCodes.Status503ServiceUnavailable,
    },
}).AllowAnonymous();

app.Run();

public partial class Program;
