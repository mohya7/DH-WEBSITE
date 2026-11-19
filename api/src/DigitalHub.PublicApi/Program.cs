using DigitalHub.Forms;
using DigitalHub.PublicApi.Data;
using DigitalHub.PublicApi.Infrastructure;
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

builder.Services.AddDbContext<PublicFormsDbContext>(options => options.UseSqlServer(connectionString));
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddDigitalHubForms();
builder.Services.AddScoped<IFormsData, PublicFormsData>();

var app = builder.Build();

app.Run();

public partial class Program;
