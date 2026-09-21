using DigitalHub.Api.Data;
using DigitalHub.ContentImport;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

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

if (args.Contains("--apply"))
    return await ContentWriter.ApplyAsync(sourceRoot, connectionString.Value!);

var plan = Catalog.Build(sourceRoot);
var database = await ReadDatabaseAsync(connectionString.Value!);
Report.Write(plan, database);
return database.Connected ? 0 : 1;

static (string? Commit, string? Error) ReadSourceRevision(string root)
{
    if (!Directory.Exists(Path.Combine(root, ".git")) && !File.Exists(Path.Combine(root, ".git")))
        return (null, "The source folder is not a git checkout.");

    var branch = Git(root, "rev-parse", "--abbrev-ref", "HEAD");
    if (branch != "feature/interviewer-portal")
        return (null, "The source folder must be on feature/interviewer-portal. It is on " + branch + ".");

    var porcelain = Git(root, "status", "--porcelain");
    if (!string.IsNullOrWhiteSpace(porcelain))
        return (null, "The source folder has uncommitted changes, so the commit would not be the content that was read.");

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

static async Task<DatabaseSnapshot> ReadDatabaseAsync(string connectionString)
{
    var options = new DbContextOptionsBuilder<ContentDbContext>()
        .UseSqlServer(connectionString)
        .Options;
    await using var db = new ContentDbContext(options);
    try
    {
        var counts = new (string Table, int Count)[]
        {
            ("pages", await db.Pages.CountAsync()),
            ("services", await db.Services.CountAsync()),
            ("partners", await db.Partners.CountAsync()),
            ("case_studies", await db.CaseStudies.CountAsync()),
            ("blog_posts", await db.BlogPosts.CountAsync()),
            ("vacancies", await db.Vacancies.CountAsync()),
            ("team_members", await db.TeamMembers.CountAsync()),
            ("news_items", await db.NewsItems.CountAsync()),
            ("sections", await db.Sections.CountAsync()),
            ("media", await db.Media.CountAsync()),
        };
        return new DatabaseSnapshot(true, null, counts);
    }
    catch (Exception ex)
    {
        var message = ex.Message.Replace(connectionString, "[connection]", StringComparison.Ordinal);
        return new DatabaseSnapshot(false, ex.GetType().Name + ": " + message, []);
    }
}
