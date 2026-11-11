using System.Text.RegularExpressions;
using DigitalHub.Api.Content;

namespace DigitalHub.Api.Tests;

/// <summary>
/// ADM-07: the API and the website build agree on which addresses are pages. This
/// reads website/scripts/check-output.ts and fails if its fixed pages or error pages
/// change without RedirectTargets, or if the build's target report goes away. No
/// database.
/// </summary>
public sealed class RedirectTargetRuleTests
{
    [Fact]
    public void The_api_counts_the_website_builds_fixed_pages()
    {
        var source = File.ReadAllText(CheckOutputSource());

        var staticFiles = Strings(source, "staticFiles");
        Assert.NotEmpty(staticFiles);
        Assert.All(staticFiles, file => Assert.EndsWith(".html", file, StringComparison.Ordinal));
        Assert.Equal(
            staticFiles.Select(file => "/" + file[..^".html".Length]).Order(StringComparer.Ordinal),
            RedirectTargets.StaticPaths.Order(StringComparer.Ordinal));

        Assert.Equal(["404.html", "500.html"], Strings(source, "errorFiles"));
        Assert.Equal(["404", "500"], RedirectTargets.ErrorPageKeys.Order(StringComparer.Ordinal));

        Assert.Contains("export function redirectTargetReport", source, StringComparison.Ordinal);
    }

    /// <summary>The string literals of a one-line const array in check-output.ts.</summary>
    private static List<string> Strings(string source, string name)
    {
        var list = Regex.Match(source, @"^const " + name + @" = \[(?<items>[^\]\n]*)\];", RegexOptions.Multiline).Groups["items"];
        Assert.True(list.Success, "Not found in check-output.ts: const " + name + " = [...];");
        return Regex.Matches(list.Value, "\"([^\"]*)\"").Select(match => match.Groups[1].Value).ToList();
    }

    /// <summary>Found as RedirectPathRuleTests finds web-config.ts.</summary>
    private static string CheckOutputSource()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
        {
            var candidate = Path.Combine(directory.FullName, "website", "scripts", "check-output.ts");
            if (File.Exists(candidate))
                return candidate;
        }

        throw new FileNotFoundException("website/scripts/check-output.ts was not found above the test output.");
    }
}
