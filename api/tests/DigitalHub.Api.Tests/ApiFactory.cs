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
    public const string BuildTokenValue = "test-only-build-token-0123456789abcdef";

    public string MediaRoot { get; } = Path.Combine(Path.GetTempPath(), "dh-platform-media-tests");

    /* The login limiter keys on IP plus email, and every test signs in as the
       same admin from the same address, so the whole suite shares one budget and
       tests start failing with 429 as it grows. Raised for the shared host only;
       the production default stays 8 in appsettings.json, and
       RateLimitedApiFactory puts it back so the limiter itself can be tested. */
    protected virtual int LoginPermitLimit => 1000;

    /* The same for the per-address ceiling on failed sign-ins: the whole suite
       signs in from one test address. Production default 30. */
    protected virtual int LoginFailurePermitLimit => 100_000;

    /* Wrong current passwords on change-password, per user. Production default 5. */
    protected virtual int ChangePasswordFailurePermitLimit => 1000;

    private readonly string _connectionString = TestConnectionString();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        Directory.CreateDirectory(MediaRoot);
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Content", _connectionString);
        builder.UseSetting("Media:Root", MediaRoot);
        builder.UseSetting("Auth:SigningKey", SigningKey);
        builder.UseSetting("Auth:Issuer", "digitalhub");
        builder.UseSetting("Auth:Audience", "digitalhub-api");
        builder.UseSetting("Auth:InitialAdminEmail", AdminEmail);
        builder.UseSetting("Auth:InitialAdminPassword", AdminPassword);
        builder.UseSetting("Database:EnsureCreated", "false");
        builder.UseSetting("Auth:LoginPermitLimit", LoginPermitLimit.ToString());
        builder.UseSetting("Auth:LoginFailurePermitLimit", LoginFailurePermitLimit.ToString());
        builder.UseSetting("Auth:ChangePasswordFailurePermitLimit", ChangePasswordFailurePermitLimit.ToString());
        builder.UseSetting("Build:Token", BuildTokenValue);
        builder.UseSetting("Build:PermitLimit", "1000");
        builder.UseSetting("Apply:IpPermitLimit", "1000");
        builder.UseSetting("Apply:EmailPermitLimit", "1000");
        builder.ConfigureTestServices(services =>
        {
            services.AddSingleton<NoteStore>();
            services.AddControllers().AddApplicationPart(typeof(ConventionProbeController).Assembly);
        });
    }

    /// <summary>
    /// A host that keeps the production login limit, so the limiter can be
    /// exercised without the shared host's raised budget hiding it.
    /// </summary>
    public sealed class RateLimited : ApiFactory
    {
        public const int Limit = 8;
        public const int FailureLimit = 30;
        public const int ChangePasswordLimit = 5;

        protected override int LoginPermitLimit => Limit;

        protected override int LoginFailurePermitLimit => FailureLimit;

        protected override int ChangePasswordFailurePermitLimit => ChangePasswordLimit;
    }

    /// <summary>
    /// Test configuration: environment variables when set (CI sets
    /// ConnectionStrings__Content), otherwise the API's user-secrets, as on the
    /// local machine. Environment variables are added last, so they win.
    /// </summary>
    internal static IConfiguration TestConfiguration() =>
        new ConfigurationBuilder()
            .AddUserSecrets(SecretsId)
            .AddEnvironmentVariables()
            .Build();

    /// <summary>
    /// Rewrites a connection string that names DigitalHubContent to the test
    /// database, DigitalHubContent_Test. Anything else is refused, so a test can
    /// never reach the real database.
    /// </summary>
    internal static string ToTestCatalog(string content)
    {
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

        return string.Concat(content.AsSpan(0, after), "_Test", content.AsSpan(after));
    }

    /// <summary>
    /// The administrator connection to DigitalHubContent_Test, for what the
    /// application login may not do: create and drop a trigger, or remove an
    /// audit row the test wrote (the audit log is append-only for the
    /// application login). From ConnectionStrings:ContentAdmin
    /// when configured (an environment variable in CI, using SQL
    /// authentication); otherwise derived from ConnectionStrings:Content with
    /// Windows authentication, as on the local machine.
    /// </summary>
    internal static string ElevatedTestConnectionString()
    {
        var configuration = TestConfiguration();
        var admin = configuration.GetConnectionString("ContentAdmin");
        if (!string.IsNullOrWhiteSpace(admin))
            return ToTestCatalog(admin);

        var content = configuration.GetConnectionString("Content");
        if (string.IsNullOrWhiteSpace(content))
            throw new InvalidOperationException("ConnectionStrings:Content is not configured.");

        var test = ToTestCatalog(content);
        var stripped = System.Text.RegularExpressions.Regex.Replace(
            test,
            ";?(User ID|UID|Password|PWD)=[^;]*",
            "",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        stripped = stripped.Trim(';');
        if (stripped.Contains("Integrated Security=", StringComparison.OrdinalIgnoreCase)
            || stripped.Contains("Trusted_Connection=", StringComparison.OrdinalIgnoreCase))
        {
            return stripped;
        }

        return stripped + ";Integrated Security=true";
    }

    private static string TestConnectionString()
    {
        var content = TestConfiguration().GetConnectionString("Content");
        if (string.IsNullOrWhiteSpace(content))
        {
            throw new InvalidOperationException("ConnectionStrings:Content is not configured.");
        }

        var test = ToTestCatalog(content);
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
