using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace DigitalHub.Api.Tests;

[CollectionDefinition("SqlServer", DisableParallelization = true)]
public sealed class SqlServerCollection;

public class ApiFactory : WebApplicationFactory<Program>
{
    public const string SigningKey = "test-signing-key-do-not-use-outside-tests-0123456789";
    public const string AdminEmail = "admin@digitalhub.test";
    public const string AdminPassword = "Test-Only-Passw0rd!";
    public const string SecretsId = "41335d15-4f42-410a-bf90-41068117e45a";

    private readonly string _connectionString = TestConnectionString();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Content", _connectionString);
        builder.UseSetting("Auth:SigningKey", SigningKey);
        builder.UseSetting("Auth:Issuer", "digitalhub");
        builder.UseSetting("Auth:Audience", "digitalhub-api");
        builder.UseSetting("Auth:InitialAdminEmail", AdminEmail);
        builder.UseSetting("Auth:InitialAdminPassword", AdminPassword);
        builder.UseSetting("Database:EnsureCreated", "false");
        builder.ConfigureTestServices(services =>
        {
            services.AddSingleton<NoteStore>();
            services.AddControllers().AddApplicationPart(typeof(ConventionProbeController).Assembly);
        });
    }

    private static string TestConnectionString()
    {
        var content = new ConfigurationBuilder()
            .AddUserSecrets(SecretsId)
            .Build()
            .GetConnectionString("Content");
        if (string.IsNullOrWhiteSpace(content))
        {
            throw new InvalidOperationException("ConnectionStrings:Content is not configured.");
        }

        const string catalog = "Database=DigitalHubContent";
        var index = content.IndexOf(catalog, StringComparison.OrdinalIgnoreCase);
        if (index < 0)
        {
            throw new InvalidOperationException("The API connection string must name DigitalHubContent.");
        }

        var after = index + catalog.Length;
        if (after < content.Length && content[after] == '_')
        {
            throw new InvalidOperationException("The API connection string must name DigitalHubContent.");
        }

        var test = string.Concat(content.AsSpan(0, after), "_Test", content.AsSpan(after));
        if (test.Contains("Integrated Security=true", StringComparison.OrdinalIgnoreCase)
            || test.Contains("Trusted_Connection=true", StringComparison.OrdinalIgnoreCase)
            || (!test.Contains("User ID=", StringComparison.OrdinalIgnoreCase)
                && !test.Contains("UID=", StringComparison.OrdinalIgnoreCase)))
        {
            throw new InvalidOperationException("Tests must connect with the restricted SQL login.");
        }

        return test;
    }
}
