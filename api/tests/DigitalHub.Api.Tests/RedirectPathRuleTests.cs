using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using DigitalHub.Api.Content;

namespace DigitalHub.Api.Tests;

/// <summary>
/// Finding L5: the API accepts only redirect paths the website build can write
/// into web.config, and the two rules are checked against each other.
/// </summary>
[Collection("SqlServer")]
public sealed class RedirectPathRuleTests : IClassFixture<ApiFactory>
{
    private static readonly string[] Cases =
    [
        "/ok", "/a/b-c_d.html", "/news/2024/item", "/", "/x.y",
        "//evil.example/", "/\\evil.example", "/ok/../../x", "/a\r\nSet-Cookie: x=1", "/a b", "/a?b", "/a#b",
        "/a<b", "/a>b", "/a\"b", "/a'b", "/a\tb", "/a\u007fb", "/a\u0000b", "relative", "/" + new string('a', 300), "/" + new string('a', 299),
    ];

    private readonly HttpClient _client;

    public RedirectPathRuleTests(ApiFactory factory) => _client = factory.CreateClient();

    [Fact]
    public void The_api_rule_is_the_website_builds_rule()
    {
        var source = File.ReadAllText(WebConfigSource());
        var body = Regex.Match(source, @"function assertPath\(path: string, label: string\): void \{(?<body>.*?)\n\}", RegexOptions.Singleline).Groups["body"].Value;
        Assert.False(string.IsNullOrEmpty(body), "assertPath was not found in web-config.ts.");

        Assert.Contains("!path.startsWith(\"/\")", body, StringComparison.Ordinal);
        Assert.Equal(RedirectPaths.MaxLength, int.Parse(Regex.Match(body, @"path\.length > (\d+)").Groups[1].Value));
        var sequences = Regex.Matches(body, @"path\.includes\(""([^""]+)""\)").Select(match => match.Groups[1].Value).ToList();
        Assert.Equal(RedirectPaths.ForbiddenSequences.Order(), sequences.Order());
        var characters = Regex.Match(body, @"/(\[[^\n]*?\])/\.test\(path\)").Groups[1].Value;
        Assert.Equal(RedirectPaths.ForbiddenCharacters, characters);

        // The same verdict on every case, using the website's own expression.
        var website = new Regex(characters, RegexOptions.CultureInvariant);
        foreach (var path in Cases)
        {
            var websiteRefuses = !path.StartsWith('/') || path.Length > 300 || sequences.Any(path.Contains) || website.IsMatch(path);
            Assert.True(websiteRefuses == (RedirectPaths.Problem(path) is not null), "Rules disagree on " + JsonSerializer.Serialize(path));
        }
    }

    [Theory]
    [InlineData("//evil.example/")]
    [InlineData("/\\evil.example")]
    [InlineData("/ok/../../x")]
    [InlineData("/a\r\nSet-Cookie: x=1")]
    [InlineData("/a b")]
    [InlineData("/a?b=1")]
    public async Task A_path_the_build_cannot_write_is_refused_on_both_sides(string bad)
    {
        var admin = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var asTo = await CreateAsync(admin, "/l5-" + Guid.NewGuid().ToString("N")[..8], bad);
        Assert.Equal(HttpStatusCode.BadRequest, asTo.Status);
        Assert.Contains("toPath", asTo.Body, StringComparison.Ordinal);

        var asFrom = await CreateAsync(admin, bad, "/");
        Assert.Equal(HttpStatusCode.BadRequest, asFrom.Status);
        Assert.Contains("fromPath", asFrom.Body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task An_ordinary_redirect_is_still_created()
    {
        var admin = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var created = await CreateAsync(admin, "/l5-ok-" + Guid.NewGuid().ToString("N")[..8], "/about-us.html");
        Assert.Equal(HttpStatusCode.Created, created.Status);
    }

    private async Task<(HttpStatusCode Status, string Body)> CreateAsync(AuthSession admin, string from, string to)
    {
        var request = admin.Authorized(HttpMethod.Post, "/api/v1/redirects");
        request.Content = JsonContent.Create(new { fromPath = from, toPath = to });
        var response = await _client.SendAsync(request);
        return (response.StatusCode, await response.Content.ReadAsStringAsync());
    }

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
