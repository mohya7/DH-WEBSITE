using System.Net;
using System.Text;
using System.Threading.RateLimiting;
using DigitalHub.Api.Auth;
using DigitalHub.Api.Content;
using DigitalHub.Api.Conventions;
using DigitalHub.Api.Data;
using DigitalHub.Api.Identity;
using DigitalHub.Api.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.StaticFiles;
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

if (string.IsNullOrWhiteSpace(builder.Configuration["Auth:InitialAdminPassword"]))
{
    throw new InvalidOperationException("Auth:InitialAdminPassword is not configured.");
}

if (string.IsNullOrWhiteSpace(builder.Configuration["Auth:InitialAdminEmail"]))
{
    throw new InvalidOperationException("Auth:InitialAdminEmail is not configured.");
}

builder.Services.AddDbContext<ContentDbContext>(options => options.UseSqlServer(connectionString));
builder.Services.AddIdentityCore<ApplicationUser>(options =>
{
    options.User.RequireUniqueEmail = true;
    options.Lockout.AllowedForNewUsers = false;
    options.Password.RequiredLength = 12;
})
.AddRoles<IdentityRole>()
.AddEntityFrameworkStores<ContentDbContext>();
builder.Services.AddScoped<TokenService>();
builder.Services.AddSingleton<SectionSchemaSet>();
builder.Services.AddSingleton<CollectionSchemaSet>();
builder.Services.AddScoped<ContentStore>();
builder.Services.AddScoped<MediaLibrary>();
builder.Services.AddScoped<AdminStore>();
builder.Services.AddScoped<PublicContactStore>();
builder.Services.AddHostedService<IdentitySeeder>();

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
    foreach (var value in builder.Configuration.GetSection("ForwardedHeaders:KnownProxies").GetChildren())
    {
        if (IPAddress.TryParse(value.Value, out var address))
            options.KnownProxies.Add(address);
    }
});

var loginPermitLimit = builder.Configuration.GetValue("Auth:LoginPermitLimit", 8);
var loginWindowHours = builder.Configuration.GetValue("Auth:LoginWindowHours", 1);
var uploadPermitLimit = builder.Configuration.GetValue("Media:UploadPermitLimit", 20);
var contactPermitLimit = builder.Configuration.GetValue("Contact:PermitLimit", 10);
var contactWindowHours = builder.Configuration.GetValue("Contact:WindowHours", 1);
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = (context, token) =>
    {
        var policy = context.HttpContext.GetEndpoint()?.Metadata.GetMetadata<EnableRateLimitingAttribute>()?.PolicyName;
        var title = policy switch
        {
            "media-upload" => "Too many uploads.",
            "public-contact" => "Too many contact submissions.",
            _ => "Too many login attempts.",
        };
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        return new ValueTask(ProblemResults.WriteAsync(
            context.HttpContext.Response,
            StatusCodes.Status429TooManyRequests,
            "rate_limited",
            title,
            token));
    };
    options.AddPolicy("login", httpContext =>
    {
        var ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var email = httpContext.Items[LoginRateLimitKeyMiddleware.EmailItem] as string ?? "";
        return RateLimitPartition.GetFixedWindowLimiter($"{ip}\n{email}", _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = loginPermitLimit,
            Window = TimeSpan.FromHours(loginWindowHours),
            QueueLimit = 0,
        });
    });
    options.AddPolicy("media-upload", httpContext =>
    {
        var userId = httpContext.User.FindFirst("sub")?.Value ?? "anonymous";
        return RateLimitPartition.GetFixedWindowLimiter("media\n" + userId, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = uploadPermitLimit,
            Window = TimeSpan.FromHours(1),
            QueueLimit = 0,
        });
    });
    options.AddPolicy("public-contact", httpContext =>
    {
        var ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter("contact\n" + ip, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = contactPermitLimit,
            Window = TimeSpan.FromHours(contactWindowHours),
            QueueLimit = 0,
        });
    });
});

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
        options.MapInboundClaims = false;
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
            RoleClaimType = "role",
            NameClaimType = "sub",
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
        .RequireRole(Roles.All)
        .Build();

    foreach (var role in new[] { "admin", "editor", "hr", "marketing", "interviewer" })
    {
        options.AddPolicy(role, policy => policy.RequireRole(role));
    }

    options.AddPolicy("studio", policy => policy.RequireRole(Roles.Admin, Roles.Editor));
    options.AddPolicy("studio-admin", policy => policy.RequireRole(Roles.Admin));
});

builder.Services.AddHealthChecks()
    .AddDbContextCheck<ContentDbContext>("database");

var app = builder.Build();

app.UseForwardedHeaders();
app.UseMiddleware<CorrelationIdMiddleware>();
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseExceptionHandler();
app.UseSerilogRequestLogging(options =>
{
    options.MessageTemplate = "HTTP {RequestMethod} {RequestPath} responded {StatusCode} in {Elapsed:0.0000} ms";
});
app.UseMiddleware<ExceptionShieldMiddleware>();
app.UseMiddleware<LoginRateLimitKeyMiddleware>();
app.UseAuthentication();
app.UseRateLimiter();

var mediaRoot = app.Configuration["Media:Root"];
if (string.IsNullOrWhiteSpace(mediaRoot))
    mediaRoot = Path.Combine(app.Environment.ContentRootPath, "media");
Directory.CreateDirectory(mediaRoot);
var mediaTypes = new FileExtensionContentTypeProvider();
mediaTypes.Mappings[".webp"] = "image/webp";
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(mediaRoot),
    RequestPath = "/media",
    ContentTypeProvider = mediaTypes,
    OnPrepareResponse = context =>
    {
        var headers = context.Context.Response.Headers;
        headers["X-Content-Type-Options"] = "nosniff";
        headers["Content-Security-Policy"] = MediaLibrary.ContentSecurityPolicy;
    },
});

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
