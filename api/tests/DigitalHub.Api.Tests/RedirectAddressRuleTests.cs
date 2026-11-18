using System.Text.RegularExpressions;
using DigitalHub.Api.Content;

namespace DigitalHub.Api.Tests;

/// <summary>
/// ADM-02: the API compares redirect paths by the address the website build gives
/// them (web-config.ts). This reads web-config.ts and fails if the build's key
/// changes without RedirectPaths.Key. No database.
/// </summary>
public sealed class RedirectAddressRuleTests
{
    [Fact]
    public void The_api_address_is_the_website_builds_address()
    {
        var source = File.ReadAllText(WebConfigSource());

        var rules = Body(source, @"function redirectRules\(redirects: readonly Redirect\[\]\): string \{");
        Assert.Contains("const key = row.fromPath.replace(/\\/+$/, \"\") || \"/\";", rules, StringComparison.Ordinal);
        var match = Body(source, @"function matchPattern\(fromPath: string\): string \{");
        Assert.Contains("const body = fromPath.slice(1).replace(/\\/+$/, \"\");", match, StringComparison.Ordinal);

        Assert.Equal("/", RedirectPaths.Key("/"));
        Assert.Equal("/x", RedirectPaths.Key("/x"));
        Assert.Equal("/x", RedirectPaths.Key("/x/"));
        Assert.Equal("/a/b", RedirectPaths.Key("/a/b/"));

        Assert.Equal(["/"], RedirectPaths.Spellings("/"));
        Assert.Equal(["/x", "/x/"], RedirectPaths.Spellings("/x"));
        Assert.Equal(["/x", "/x/"], RedirectPaths.Spellings("/x/"));
    }

    private static string Body(string source, string signature)
    {
        var body = Regex.Match(source, signature + @"(?<body>.*?)\n\}", RegexOptions.Singleline).Groups["body"].Value;
        Assert.False(string.IsNullOrEmpty(body), "Not found in web-config.ts: " + signature);
        return body;
    }

    /// <summary>Found as RedirectPathRuleTests finds it.</summary>
    private static string WebConfigSource()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
        {
            var candidate = Path.Combine(directory.FullName, "website", "src", "iis", "web-config.ts");
            if (File.Exists(candidate))
                return candidate;
        }

        throw new FileNotFoundException("website/src/iis/web-config.ts was not found above the test output.");
    }
}
