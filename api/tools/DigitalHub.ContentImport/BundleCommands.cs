using System.Text.RegularExpressions;
using DigitalHub.Api.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace DigitalHub.ContentImport;

/// <summary>
/// The command line for the content bundle (docs/content-bundle.md):
///   export --out bundle.zip [--database DigitalHubContent_Name]
///   import --in bundle.zip --dry-run [--force] [--database DigitalHubContent_Name]
///   import --in bundle.zip --confirm-catalog &lt;catalog&gt; [--force] [--database DigitalHubContent_Name]
/// The connection string and the media folder come from configuration
/// (ConnectionStrings:Content and Media:Root, from user-secrets or environment
/// variables), never from the command line, and are never printed. Every failure
/// ends as one line and a non-zero exit code, never a stack trace.
/// </summary>
static class BundleCommands
{
    /// <summary>--database may only name a DigitalHubContent_ catalog; the plain name comes from configuration alone.</summary>
    private static readonly Regex DatabaseName = new("^DigitalHubContent_[A-Za-z0-9]+$", RegexOptions.CultureInvariant);

    public static async Task<int> RunAsync(string[] args, IConfiguration? configuration = null, TextWriter? output = null, TextWriter? errors = null)
    {
        var stdout = output ?? Console.Out;
        var stderr = errors ?? Console.Error;
        var command = args[0];
        var known = command == "export" ? new[] { "--out", "--database" } : ["--in", "--dry-run", "--force", "--database", "--confirm-catalog"];
        for (var index = 1; index < args.Length; index++)
        {
            var arg = args[index];
            if (!known.Contains(arg))
                return Usage(stderr, "Unknown argument: " + arg);
            if (arg is "--out" or "--in" or "--database" or "--confirm-catalog")
                index++;
        }

        var file = Value(args, command == "export" ? "--out" : "--in");
        if (file is null)
            return Usage(stderr, (command == "export" ? "--out" : "--in") + " needs a file path.");

        var database = Value(args, "--database");
        if (args.Contains("--database") && (database is null || !DatabaseName.IsMatch(database)))
            return Usage(stderr, "--database must name a catalog like DigitalHubContent_Staging. Without it, the catalog in ConnectionStrings:Content is used.");

        configuration ??= new ConfigurationBuilder()
            .AddUserSecrets(Catalog.SecretsId)
            .AddEnvironmentVariables()
            .Build();
        var connectionString = configuration.GetConnectionString("Content");
        if (string.IsNullOrWhiteSpace(connectionString)
            || connectionString.Contains("Integrated Security=true", StringComparison.OrdinalIgnoreCase)
            || connectionString.Contains("Trusted_Connection=true", StringComparison.OrdinalIgnoreCase))
        {
            stderr.WriteLine("ConnectionStrings:Content must be set, and must use the application's SQL login (not Windows sign-in).");
            return 2;
        }

        string server;
        string catalog;
        try
        {
            if (database is not null)
                connectionString = new SqlConnectionStringBuilder(connectionString) { InitialCatalog = database }.ConnectionString;
            var parsed = new SqlConnectionStringBuilder(connectionString);
            server = parsed.DataSource;
            catalog = parsed.InitialCatalog;
        }
        catch (Exception exception) when (exception is ArgumentException or FormatException or KeyNotFoundException)
        {
            stderr.WriteLine("ConnectionStrings:Content is not a valid SQL Server connection string.");
            return 2;
        }

        var mediaRoot = configuration["Media:Root"];
        stdout.WriteLine($"Server: {server}");
        stdout.WriteLine($"Catalog: {catalog}");
        stdout.WriteLine($"Media:Root: {(string.IsNullOrWhiteSpace(mediaRoot) ? "(not set)" : mediaRoot)}");

        // A real import writes whichever catalog the settings name. It must be confirmed by name,
        // so a setting that still points at another database cannot be written by accident.
        var dryRun = args.Contains("--dry-run");
        if (command == "import" && !dryRun)
        {
            var confirmed = Value(args, "--confirm-catalog");
            if (confirmed is null || !string.Equals(confirmed, catalog, StringComparison.Ordinal))
            {
                stderr.WriteLine($"This import would write catalog {catalog} on server {server}. Take a backup first, then repeat the command with --confirm-catalog {catalog}. Nothing was changed.");
                return 2;
            }
        }

        try
        {
            await using var db = new ContentDbContext(new DbContextOptionsBuilder<ContentDbContext>().UseSqlServer(connectionString).Options);
            return command == "export"
                ? await ExportAsync(db, mediaRoot, Path.GetFullPath(file), stdout, stderr)
                : await ImportAsync(db, mediaRoot, Path.GetFullPath(file), dryRun, args.Contains("--force"), stdout, stderr);
        }
        catch (SqlException exception)
        {
            stderr.WriteLine(exception.Number == 18456
                ? $"Could not sign in to the database server {server} (login failed). Nothing was changed."
                : $"The database server {server} could not be reached or refused the command (SQL error {exception.Number}). Nothing was changed.");
            return 1;
        }
        catch (Exception exception) when (exception is not OutOfMemoryException)
        {
            stderr.WriteLine($"The {command} stopped: {exception.GetType().Name}: {exception.Message} Nothing was changed.");
            return 1;
        }
    }

    private static async Task<int> ExportAsync(ContentDbContext db, string? mediaRoot, string path, TextWriter stdout, TextWriter stderr)
    {
        if (File.Exists(path))
        {
            stderr.WriteLine("The output file already exists. Choose a new name; an export never overwrites a file.");
            return 2;
        }

        var temporary = path + ".partial";
        ExportResult result;
        try
        {
            await using (var output = File.Create(temporary))
                result = await ContentBundle.ExportAsync(db, mediaRoot, output, DateTime.UtcNow, CancellationToken.None);
        }
        catch
        {
            File.Delete(temporary);
            throw;
        }

        if (result.Error is not null)
        {
            File.Delete(temporary);
            stderr.WriteLine("Export refused: " + result.Error);
            return 1;
        }

        File.Move(temporary, path);
        stdout.WriteLine($"Migration: {result.Migration}");
        foreach (var (table, count) in result.Counts)
            stdout.WriteLine($"  {table,-16} {count,6}");
        stdout.WriteLine($"  {"rows in total",-16} {result.Counts.Values.Sum(),6}");
        stdout.WriteLine($"  {"media files",-16} {result.Files,6}  ({result.FileBytes:N0} bytes)");
        stdout.WriteLine($"Wrote {path} ({new FileInfo(path).Length:N0} bytes).");
        return 0;
    }

    private static async Task<int> ImportAsync(ContentDbContext db, string? mediaRoot, string path, bool dryRun, bool force, TextWriter stdout, TextWriter stderr)
    {
        if (!File.Exists(path))
        {
            stderr.WriteLine("The bundle file does not exist.");
            return 2;
        }

        ImportResult result;
        await using (var input = File.OpenRead(path))
            result = await ContentBundle.ImportAsync(db, mediaRoot, input, new ImportOptions(dryRun, force), CancellationToken.None);

        if (result.Plan.Count > 0)
        {
            stdout.WriteLine($"  {"table",-16} {"create",7} {"update",7} {"same",7}");
            foreach (var (table, count) in result.Plan)
                stdout.WriteLine($"  {table,-16} {count.Created,7} {count.Updated,7} {count.Unchanged,7}");
            stdout.WriteLine($"  {"rows in total",-16} {result.Plan.Values.Sum(count => count.Created),7} {result.Plan.Values.Sum(count => count.Updated),7} {result.Plan.Values.Sum(count => count.Unchanged),7}");
        }

        foreach (var conflict in result.Conflicts)
            stdout.WriteLine((force ? "  overwritten: " : "  would overwrite: ") + conflict);

        if (!result.Ok)
        {
            stderr.WriteLine((dryRun ? "Dry run: the import would be refused. " : "Import refused. ") + "Nothing was changed.");
            foreach (var problem in result.Problems)
                stderr.WriteLine("  " + problem);
            return 1;
        }

        stdout.WriteLine($"  {"media files",-16} {result.NewFiles,7} {"",7} {result.ExistingFiles,7}");
        foreach (var warning in result.Warnings)
            stdout.WriteLine("  note: " + warning);
        stdout.WriteLine(result.DryRun
            ? "Dry run: every document passed the Studio's checks. Nothing was changed."
            : "Imported. Every document passed the Studio's checks, and every table matches the bundle's checksum.");
        return 0;
    }

    private static string? Value(string[] args, string flag)
    {
        var index = Array.IndexOf(args, flag);
        return index >= 0 && index + 1 < args.Length && !args[index + 1].StartsWith("--", StringComparison.Ordinal) ? args[index + 1] : null;
    }

    private static int Usage(TextWriter stderr, string problem)
    {
        stderr.WriteLine(problem);
        stderr.WriteLine("Usage: DigitalHub.ContentImport export --out <bundle.zip> [--database DigitalHubContent_Name]");
        stderr.WriteLine("       DigitalHub.ContentImport import --in <bundle.zip> --dry-run [--force] [--database DigitalHubContent_Name]");
        stderr.WriteLine("       DigitalHub.ContentImport import --in <bundle.zip> --confirm-catalog <catalog> [--force] [--database DigitalHubContent_Name]");
        return 2;
    }
}
