using System.Text.RegularExpressions;
using DigitalHub.Api.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace DigitalHub.ContentImport;

/// <summary>
/// The command line for the content bundle (docs/content-bundle.md):
///   export --out bundle.zip [--database DigitalHubContent_Name]
///   import --in bundle.zip [--dry-run] [--force] [--database DigitalHubContent_Name]
/// The connection string and the media folder come from configuration
/// (ConnectionStrings:Content and Media:Root, from user-secrets or environment
/// variables), never from the command line, and are never printed.
/// </summary>
static class BundleCommands
{
    /// <summary>--database may only name a DigitalHubContent_ catalog; the plain name comes from configuration alone.</summary>
    private static readonly Regex DatabaseName = new("^DigitalHubContent_[A-Za-z0-9]+$", RegexOptions.CultureInvariant);

    public static async Task<int> RunAsync(string[] args)
    {
        var command = args[0];
        var known = command == "export" ? new[] { "--out", "--database" } : ["--in", "--dry-run", "--force", "--database"];
        for (var index = 1; index < args.Length; index++)
        {
            var arg = args[index];
            if (!known.Contains(arg))
                return Usage("Unknown argument: " + arg);
            if (arg is "--out" or "--in" or "--database")
                index++;
        }

        var file = Value(args, command == "export" ? "--out" : "--in");
        if (file is null)
            return Usage((command == "export" ? "--out" : "--in") + " needs a file path.");

        var database = Value(args, "--database");
        if (args.Contains("--database") && (database is null || !DatabaseName.IsMatch(database)))
            return Usage("--database must name a catalog like DigitalHubContent_Staging. Without it, the catalog in ConnectionStrings:Content is used.");

        var configuration = new ConfigurationBuilder()
            .AddUserSecrets(Catalog.SecretsId)
            .AddEnvironmentVariables()
            .Build();
        var connectionString = configuration.GetConnectionString("Content");
        if (string.IsNullOrWhiteSpace(connectionString)
            || connectionString.Contains("Integrated Security=true", StringComparison.OrdinalIgnoreCase)
            || connectionString.Contains("Trusted_Connection=true", StringComparison.OrdinalIgnoreCase))
        {
            Console.Error.WriteLine("ConnectionStrings:Content must be set, and must use the application's SQL login (not Windows sign-in).");
            return 2;
        }

        if (database is not null)
            connectionString = new SqlConnectionStringBuilder(connectionString) { InitialCatalog = database }.ConnectionString;
        var catalog = new SqlConnectionStringBuilder(connectionString).InitialCatalog;
        var mediaRoot = configuration["Media:Root"];

        await using var db = new ContentDbContext(new DbContextOptionsBuilder<ContentDbContext>().UseSqlServer(connectionString).Options);
        Console.WriteLine($"Catalog: {catalog}");
        Console.WriteLine($"Media:Root: {(string.IsNullOrWhiteSpace(mediaRoot) ? "(not set)" : mediaRoot)}");

        return command == "export"
            ? await ExportAsync(db, mediaRoot, Path.GetFullPath(file))
            : await ImportAsync(db, mediaRoot, Path.GetFullPath(file), args.Contains("--dry-run"), args.Contains("--force"));
    }

    private static async Task<int> ExportAsync(ContentDbContext db, string? mediaRoot, string path)
    {
        if (File.Exists(path))
        {
            Console.Error.WriteLine("The output file already exists. Choose a new name; an export never overwrites a file.");
            return 2;
        }

        var temporary = path + ".partial";
        ExportResult result;
        await using (var output = File.Create(temporary))
            result = await ContentBundle.ExportAsync(db, mediaRoot, output, DateTime.UtcNow, CancellationToken.None);
        if (result.Error is not null)
        {
            File.Delete(temporary);
            Console.Error.WriteLine("Export refused: " + result.Error);
            return 1;
        }

        File.Move(temporary, path);
        Console.WriteLine($"Migration: {result.Migration}");
        foreach (var (table, count) in result.Counts)
            Console.WriteLine($"  {table,-16} {count,6}");
        Console.WriteLine($"  {"media files",-16} {result.Files,6}  ({result.FileBytes:N0} bytes)");
        Console.WriteLine($"Wrote {path} ({new FileInfo(path).Length:N0} bytes).");
        return 0;
    }

    private static async Task<int> ImportAsync(ContentDbContext db, string? mediaRoot, string path, bool dryRun, bool force)
    {
        if (!File.Exists(path))
        {
            Console.Error.WriteLine("The bundle file does not exist.");
            return 2;
        }

        ImportResult result;
        await using (var input = File.OpenRead(path))
            result = await ContentBundle.ImportAsync(db, mediaRoot, input, new ImportOptions(dryRun, force), CancellationToken.None);

        if (result.Plan.Count > 0)
        {
            Console.WriteLine($"  {"table",-16} {"create",7} {"update",7} {"same",7}");
            foreach (var (table, count) in result.Plan)
                Console.WriteLine($"  {table,-16} {count.Created,7} {count.Updated,7} {count.Unchanged,7}");
        }

        foreach (var conflict in result.Conflicts)
            Console.WriteLine((force ? "  overwritten: " : "  would overwrite: ") + conflict);

        if (!result.Ok)
        {
            Console.Error.WriteLine((result.DryRun ? "Dry run: the import would be refused. " : "Import refused. ") + "Nothing was changed.");
            foreach (var problem in result.Problems)
                Console.Error.WriteLine("  " + problem);
            return 1;
        }

        Console.WriteLine($"  {"media files",-16} {result.NewFiles,7} {"",7} {result.ExistingFiles,7}");
        foreach (var warning in result.Warnings)
            Console.WriteLine("  note: " + warning);
        Console.WriteLine(result.DryRun
            ? "Dry run: every document passed the Studio's checks. Nothing was changed."
            : "Imported. Every document passed the Studio's checks, and every table matches the bundle's checksum.");
        return 0;
    }

    private static string? Value(string[] args, string flag)
    {
        var index = Array.IndexOf(args, flag);
        return index >= 0 && index + 1 < args.Length && !args[index + 1].StartsWith("--", StringComparison.Ordinal) ? args[index + 1] : null;
    }

    private static int Usage(string problem)
    {
        Console.Error.WriteLine(problem);
        Console.Error.WriteLine("Usage: DigitalHub.ContentImport export --out <bundle.zip> [--database DigitalHubContent_Name]");
        Console.Error.WriteLine("       DigitalHub.ContentImport import --in <bundle.zip> [--dry-run] [--force] [--database DigitalHubContent_Name]");
        return 2;
    }
}
