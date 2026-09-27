using DigitalHub.ContentImport;
using Microsoft.Extensions.Configuration;

if (args.Contains("--convert-references"))
{
    if (args.Contains("--dry-run") || args.Contains("--apply") || args.Contains("--source"))
    {
        Console.Error.WriteLine("--convert-references rewrites stored references only. Do not combine it with --source, --dry-run, or --apply.");
        return 2;
    }

    var convertConnection = ReadConnectionString();
    if (convertConnection.Error is not null)
    {
        Console.Error.WriteLine(convertConnection.Error);
        return 2;
    }

    return await ReferenceConverter.ApplyAsync(convertConnection.Value!);
}

if (args.Contains("--apply") && args.Contains("--dry-run"))
{
    Console.Error.WriteLine("Pass either --dry-run or --apply, not both.");
    return 2;
}

if (!args.Contains("--dry-run") && !args.Contains("--apply"))
{
    Console.Error.WriteLine("Usage: DigitalHub.ContentImport --source <DH-WEBSITE-main> --dry-run");
    Console.Error.WriteLine("       DigitalHub.ContentImport --source <DH-WEBSITE-main> --apply");
    return 2;
}

var sourceFlag = Array.IndexOf(args, "--source");
if (sourceFlag < 0 || sourceFlag + 1 >= args.Length)
{
    Console.Error.WriteLine("Pass --source with the path to DH-WEBSITE-main.");
    return 2;
}

var sourceRoot = Path.GetFullPath(args[sourceFlag + 1]);
if (!File.Exists(Path.Combine(sourceRoot, "content", "admin-content.json")))
{
    Console.Error.WriteLine("The source path does not contain content/admin-content.json.");
    return 2;
}

var sourceRevision = ReadSourceRevision(sourceRoot);
if (sourceRevision.Error is not null)
{
    Console.Error.WriteLine(sourceRevision.Error);
    return 2;
}

Console.WriteLine("Source: feature/interviewer-portal at " + sourceRevision.Commit);

var connectionString = ReadConnectionString();
if (connectionString.Error is not null)
{
    Console.Error.WriteLine(connectionString.Error);
    return 2;
}

var databaseFlag = Array.IndexOf(args, "--database");
var database = databaseFlag >= 0 && databaseFlag + 1 < args.Length ? args[databaseFlag + 1] : null;
/* An explicit allow-list rather than a pattern: the point of this guard is that
   the tool can only ever write to a catalog someone named here on purpose.
   DigitalHubContent_Parity is the throwaway the Phase C snapshot is built from. */
string[] allowedDatabases = ["DigitalHubNavImport", "DigitalHubContent_Parity"];
if (database is not null && !allowedDatabases.Contains(database, StringComparer.Ordinal))
{
    Console.Error.WriteLine(
        "--database may only name " + string.Join(" or ", allowedDatabases) + ". DigitalHubContent is the default.");
    return 2;
}

var mediaFlag = Array.IndexOf(args, "--media-root");
var mediaRoot = mediaFlag >= 0 && mediaFlag + 1 < args.Length ? Path.GetFullPath(args[mediaFlag + 1]) : null;
var applyConnection = connectionString.Value!;
if (database is not null)
{
    var builder = new Microsoft.Data.SqlClient.SqlConnectionStringBuilder(applyConnection)
    {
        InitialCatalog = database,
    };
    applyConnection = builder.ConnectionString;
}

if (args.Contains("--apply"))
    return await ContentWriter.ApplyAsync(sourceRoot, applyConnection, mediaRoot);

return await ContentWriter.PreviewAsync(sourceRoot, connectionString.Value!);

static (string? Commit, string? Error) ReadSourceRevision(string root)
{
    if (!Directory.Exists(Path.Combine(root, ".git")) && !File.Exists(Path.Combine(root, ".git")))
        return (null, "The source folder is not a git checkout.");

    var branch = Git(root, "rev-parse", "--abbrev-ref", "HEAD");
    if (branch != "feature/interviewer-portal")
        return (null, "The source folder must be on feature/interviewer-portal. It is on " + branch + ".");

    /* Compare content, not the index. git status reports a file as modified when
       only its line endings differ from the blob, which autocrlf produces just by
       checking the branch out on Windows. git diff normalises before comparing,
       so it stays silent for that and still reports a real edit. The guard is
       about the commit being the content that was read, and a line ending that
       git itself rewrites on checkout does not change that. */
    if (GitExitCode(root, "diff", "--quiet", "HEAD") != 0)
        return (null, "The source folder has uncommitted changes, so the commit would not be the content that was read.");

    var untracked = Git(root, "ls-files", "--others", "--exclude-standard");
    if (!string.IsNullOrWhiteSpace(untracked))
        return (null, "The source folder has untracked files, so the commit would not be the content that was read.");

    var commit = Git(root, "rev-parse", "HEAD");
    if (commit is null || commit.Length != 40)
        return (null, "Could not read the source commit.");

    return (commit, null);
}

static string? Git(string root, params string[] arguments)
{
    var start = new System.Diagnostics.ProcessStartInfo("git")
    {
        WorkingDirectory = root,
        RedirectStandardOutput = true,
        RedirectStandardError = true,
        UseShellExecute = false,
    };
    foreach (var argument in arguments)
        start.ArgumentList.Add(argument);
    using var process = System.Diagnostics.Process.Start(start);
    if (process is null)
        return null;
    var output = process.StandardOutput.ReadToEnd().Trim();
    process.WaitForExit();
    return process.ExitCode == 0 ? output : null;
}

/// <summary>Runs git for its exit code. -1 when it could not be started.</summary>
static int GitExitCode(string root, params string[] arguments)
{
    var start = new System.Diagnostics.ProcessStartInfo("git")
    {
        WorkingDirectory = root,
        RedirectStandardOutput = true,
        RedirectStandardError = true,
        UseShellExecute = false,
    };
    foreach (var argument in arguments)
        start.ArgumentList.Add(argument);
    using var process = System.Diagnostics.Process.Start(start);
    if (process is null)
        return -1;
    process.StandardOutput.ReadToEnd();
    process.StandardError.ReadToEnd();
    process.WaitForExit();
    return process.ExitCode;
}

static (string? Value, string? Error) ReadConnectionString()
{
    var connectionString = new ConfigurationBuilder()
        .AddUserSecrets(Catalog.SecretsId)
        .Build()
        .GetConnectionString("Content");
    if (string.IsNullOrWhiteSpace(connectionString)
        || connectionString.Contains("Integrated Security=true", StringComparison.OrdinalIgnoreCase)
        || connectionString.Contains("Trusted_Connection=true", StringComparison.OrdinalIgnoreCase))
    {
        return (null, "ConnectionStrings:Content must use the restricted SQL login.");
    }

    return (connectionString, null);
}
