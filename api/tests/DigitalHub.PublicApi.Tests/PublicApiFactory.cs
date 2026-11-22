using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace DigitalHub.PublicApi.Tests;

[CollectionDefinition("PublicFormsSql", DisableParallelization = true)]
public sealed class PublicFormsSqlCollection;

/// <summary>
/// The public forms API under test (ISO-2). Its one connection setting is
/// ConnectionStrings:PublicForms, pointed at DigitalHubContent_Test with the
/// dh_public_forms login (ISO-3), a member of dh_public_forms_role only. It is
/// given no Auth setting. The user-secrets store is read into a standalone
/// configuration here and only the rewritten connection string reaches the host.
/// </summary>
public class PublicApiFactory : WebApplicationFactory<Program>
{
    private readonly string _connectionString = PublicFormsTestConnectionString();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        // ISO-3: the host runs as dh_public_forms; the fixtures keep the restricted test login.
        builder.UseSetting("ConnectionStrings:PublicForms", _connectionString);
        builder.UseSetting("Apply:IpPermitLimit", "1000");
        builder.UseSetting("Apply:EmailPermitLimit", "1000");
    }

    /// <summary>
    /// Test configuration: environment variables when set (CI sets
    /// ConnectionStrings__Content), otherwise the API's user-secrets, as on the
    /// local machine. Environment variables are added last, so they win.
    /// </summary>
    internal static IConfiguration TestConfiguration() =>
        new ConfigurationBuilder()
            .AddUserSecrets(typeof(PublicApiFactory).Assembly)
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
    /// application login may not do: create and drop a trigger. From
    /// ConnectionStrings:ContentAdmin when configured (an environment variable
    /// in CI, using SQL authentication); otherwise derived from
    /// ConnectionStrings:Content with Windows authentication, as on the local
    /// machine.
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

    /// <summary>
    /// The public forms login, dh_public_forms, on DigitalHubContent_Test (ISO-3).
    /// Read from ConnectionStrings:PublicForms; there is no fallback to
    /// ConnectionStrings:Content, which would quietly run the suite on the wide
    /// login (P-5). Windows authentication and any other login are refused.
    /// </summary>
    internal static string PublicFormsTestConnectionString()
    {
        var forms = TestConfiguration().GetConnectionString("PublicForms");
        if (string.IsNullOrWhiteSpace(forms))
        {
            throw new InvalidOperationException("ConnectionStrings:PublicForms is not configured (the dh_public_forms login).");
        }

        var test = ToTestCatalog(forms);
        var builder = new Microsoft.Data.SqlClient.SqlConnectionStringBuilder(test);
        if (builder.IntegratedSecurity
            || test.Contains("Trusted_Connection=true", StringComparison.OrdinalIgnoreCase)
            || string.IsNullOrEmpty(builder.UserID)
            || !string.Equals(builder.UserID, "dh_public_forms", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("The public forms tests must connect as the dh_public_forms SQL login.");
        }

        return test;
    }

    /// <summary>The restricted login on DigitalHubContent_Test; Windows authentication is refused.</summary>
    internal static string TestConnectionString()
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
