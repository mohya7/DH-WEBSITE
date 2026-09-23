namespace DigitalHub.Api.Tests;

public sealed class StudioConventionTests
{
    [Fact]
    public void DangerouslySetInnerHTML_appears_nowhere_in_the_studio_source()
    {
        var root = FindStudioSrc();
        var hits = Directory.EnumerateFiles(root, "*.*", SearchOption.AllDirectories)
            .Where(path => path.EndsWith(".ts", StringComparison.OrdinalIgnoreCase)
                || path.EndsWith(".tsx", StringComparison.OrdinalIgnoreCase))
            .Where(path => File.ReadAllText(path).Contains("dangerouslySetInnerHTML", StringComparison.Ordinal))
            .Select(path => Path.GetRelativePath(root, path))
            .ToList();

        Assert.True(hits.Count == 0, "dangerouslySetInnerHTML appears in: " + string.Join(", ", hits));
    }

    private static string FindStudioSrc()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            var candidate = Path.Combine(dir.FullName, "studio", "src");
            if (Directory.Exists(candidate))
                return candidate;
        }

        throw new InvalidOperationException("Could not find studio/src.");
    }
}
