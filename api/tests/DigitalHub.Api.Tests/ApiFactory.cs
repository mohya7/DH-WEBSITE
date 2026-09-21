using DigitalHub.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace DigitalHub.Api.Tests;

public class ApiFactory : WebApplicationFactory<Program>
{
    public const string SigningKey = "test-signing-key-do-not-use-outside-tests-0123456789";
    public const string AdminEmail = "admin@digitalhub.test";
    public const string AdminPassword = "Test-Only-Passw0rd!";

    private readonly SqliteConnection _connection = new($"Data Source=file:dh{Guid.NewGuid():N}?mode=memory&cache=shared");

    public ApiFactory()
    {
        _connection.Open();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Content", "Server=127.0.0.1,1;Database=DigitalHubContent;Connect Timeout=1;Encrypt=True;TrustServerCertificate=True");
        builder.UseSetting("Auth:SigningKey", SigningKey);
        builder.UseSetting("Auth:Issuer", "digitalhub");
        builder.UseSetting("Auth:Audience", "digitalhub-api");
        builder.UseSetting("Auth:InitialAdminEmail", AdminEmail);
        builder.UseSetting("Auth:InitialAdminPassword", AdminPassword);
        builder.UseSetting("Database:EnsureCreated", "true");
        builder.ConfigureTestServices(services =>
        {
            var databaseServices = services.Where(service =>
                service.ServiceType.Name.Contains("DbContextOptions", StringComparison.Ordinal)
                || service.ServiceType.Name.Contains("IDbContextOptionsConfiguration", StringComparison.Ordinal)
                || service.ServiceType == typeof(ContentDbContext)).ToList();
            foreach (var service in databaseServices)
            {
                services.Remove(service);
            }

            services.AddDbContext<ContentDbContext>(options => options.UseSqlite(_connection));
            services.AddSingleton<NoteStore>();
            services.AddControllers().AddApplicationPart(typeof(ConventionProbeController).Assembly);
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
        {
            _connection.Dispose();
        }
    }
}
