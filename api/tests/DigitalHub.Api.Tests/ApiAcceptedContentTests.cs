using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using DigitalHub.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SkiaSharp;
using Xunit.Abstractions;

namespace DigitalHub.Api.Tests;

/// <summary>
/// ADM-02, fix 3: content the API accepted is fed to the website build's own
/// schema, media and redirect checks (website/scripts/check-content.ts), so an
/// API that accepts what the build stops on fails here, not in a build.
/// </summary>
[Collection("SqlServer")]
public sealed class ApiAcceptedContentTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    private readonly HttpClient _client;
    private readonly ITestOutputHelper _output;

    public ApiAcceptedContentTests(ApiFactory factory, ITestOutputHelper output)
    {
        _factory = factory;
        _client = factory.CreateClient();
        _output = output;
    }

    [Fact]
    public async Task Content_the_api_accepted_passes_the_website_checks()
    {
        await using var run = await Adm02Run.StartAsync(_factory, _client);
        var m = run.Marker;
        var sent = new List<string>();

        // Through the API, as the Studio or a hand-made call would. The API's answers are not asserted:
        // whatever it accepted is what the website must be able to build.
        await run.CreateRedirectAsync("/" + m + "-x", "/");
        await run.CreateRedirectAsync("/" + m + "-x/", "/");

        var bad = await run.CreateItemAsync("pages", m + "-bad");
        await run.SaveSectionsAsync("pages", bad, Adm02Run.CaseCards(new { title = "T", reference = new { type = "case_study", id = "not-a-uuid" } }));
        await run.PublishAsync("pages", bad);

        var mediaId = await run.UploadMediaAsync();
        var upper = mediaId.ToString("D").ToUpperInvariant();
        sent.Add(upper);
        var upperPage = await run.CreateItemAsync("pages", m + "-upper");
        await run.SaveSectionsAsync("pages", upperPage, Adm02Run.CaseCards(new { title = "T", image = new { mediaId = upper, alt = "A", decorative = false } }));
        await run.PublishAsync("pages", upperPage);

        var target = await run.PublishedAsync("case-studies", m + "-target");
        sent.Add(target.ToString("D"));
        var good = await run.CreateItemAsync("pages", m + "-good");
        await run.SaveSectionsAsync("pages", good, Adm02Run.CaseCards(new { title = "T", reference = new { type = "case_study", id = target.ToString("D") } }));
        await run.PublishAsync("pages", good);

        var scoped = Scope(JsonNode.Parse(await run.ReadBuildRawAsync())!.AsObject(), m);
        var file = Path.Combine(Path.GetTempPath(), "adm02-content-" + m + ".json");
        try
        {
            await File.WriteAllTextAsync(file, scoped.ToJsonString());
            var result = await WebsiteCheck.RunAsync(file);
            var lines = WebsiteCheck.ProblemLines(result.Stdout);
            foreach (var line in lines)
                _output.WriteLine("website check: " + line);
            if (result.Stderr.Length > 0)
                _output.WriteLine("website check stderr: " + result.Stderr);

            var thisRun = lines.Where(line => line.Contains(m, StringComparison.Ordinal) || sent.Any(id => line.Contains(id, StringComparison.Ordinal))).ToList();
            Assert.True(thisRun.Count == 0, "The website's checks refuse content the API accepted:\n" + string.Join("\n", thisRun));
            if (lines.Count == 0)
                Assert.True(result.ExitCode == 0, $"exit {result.ExitCode}: {result.Stdout}{result.Stderr}");
        }
        finally
        {
            File.Delete(file);
        }
    }

    [Fact]
    public async Task The_website_check_fails_on_a_bad_file()
    {
        // The canary: the runner the test above relies on can fail (P-6). No database.
        var content = JsonNode.Parse(await File.ReadAllTextAsync(Path.Combine(WebsiteCheck.WebsiteDirectory(), "fixtures", "snapshot", "content.json")))!.AsObject();
        content["redirects"] = new JsonArray(
            new JsonObject { ["fromPath"] = "/x", ["toPath"] = "/", ["statusCode"] = 301 },
            new JsonObject { ["fromPath"] = "/x/", ["toPath"] = "/about", ["statusCode"] = 301 });
        var reference = content["pages"]!.AsArray()
            .SelectMany(page => page!["sections"]!.AsArray())
            .Where(section => section!["type"]!.GetValue<string>() == "case_cards")
            .SelectMany(section => section!["fields"]!["items"]!.AsArray())
            .Select(item => item!["reference"])
            .First(item => item is not null)!;
        reference["id"] = "not-a-uuid";

        var file = Path.Combine(Path.GetTempPath(), "adm02-canary-" + Guid.NewGuid().ToString("N")[..8] + ".json");
        try
        {
            await File.WriteAllTextAsync(file, content.ToJsonString());
            var result = await WebsiteCheck.RunAsync(file);
            Assert.True(result.ExitCode == 1, $"exit {result.ExitCode}: {result.Stdout}{result.Stderr}");
            var lines = WebsiteCheck.ProblemLines(result.Stdout);
            Assert.Contains("Two redirects start at /x/.", lines);
            Assert.Contains(lines, line => line.Contains("must match format \"uuid\"", StringComparison.Ordinal));
        }
        finally
        {
            File.Delete(file);
        }
    }

    /// <summary>
    /// Only this run's content, as a build would receive it: items whose slug starts with the
    /// marker and redirects whose from path starts with /marker. The shared test database holds
    /// other tests' rows, which are not this test's subject, and the web.config check stops at
    /// the first bad redirect, so theirs would hide this run's.
    /// </summary>
    private static JsonObject Scope(JsonObject content, string marker)
    {
        bool Ours(JsonNode? item) => item!["slug"]!.GetValue<string>().StartsWith(marker, StringComparison.Ordinal);

        var pages = new JsonArray(content["pages"]!.AsArray().Where(Ours).Select(item => item!.DeepClone()).ToArray());
        content["pages"] = pages;
        var counts = new JsonObject { ["pages"] = pages.Count };
        var collections = new JsonObject();
        foreach (var (name, items) in content["collections"]!.AsObject().ToList())
        {
            var kept = new JsonArray(items!.AsArray().Where(Ours).Select(item => item!.DeepClone()).ToArray());
            collections[name] = kept;
            counts[name] = kept.Count;
        }

        content["collections"] = collections;
        content["counts"] = counts;
        content["errorPages"] = new JsonObject { ["404"] = null, ["500"] = null };
        content["redirects"] = new JsonArray(content["redirects"]!.AsArray()
            .Where(row => row!["fromPath"]!.GetValue<string>().StartsWith("/" + marker, StringComparison.Ordinal))
            .Select(row => row!.DeepClone())
            .ToArray());
        return content;
    }
}

/// <summary>Runs website/scripts/check-content.ts with the website's own tsx, from website/.</summary>
internal static class WebsiteCheck
{
    public sealed record Result(int ExitCode, string Stdout, string Stderr);

    public static string WebsiteDirectory()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
        {
            var candidate = Path.Combine(directory.FullName, "website");
            if (File.Exists(Path.Combine(candidate, "package.json")) && File.Exists(Path.Combine(candidate, "scripts", "check-content.ts")))
                return candidate;
        }

        throw new FileNotFoundException("website/scripts/check-content.ts was not found above the test output.");
    }

    public static async Task<Result> RunAsync(string contentFile)
    {
        var website = WebsiteDirectory();
        // The tsx bin as package-lock.json names it ("tsx": "dist/cli.mjs"). Missing means no npm ci: fail, never skip.
        var tsx = Path.Combine(website, "node_modules", "tsx", "dist", "cli.mjs");
        Assert.True(File.Exists(tsx), "Run npm ci in website/ first.");

        var start = new ProcessStartInfo("node")
        {
            WorkingDirectory = website,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };
        start.ArgumentList.Add(tsx);
        start.ArgumentList.Add(Path.Combine("scripts", "check-content.ts"));
        start.ArgumentList.Add(contentFile);

        using var process = Process.Start(start)!;
        var stdout = process.StandardOutput.ReadToEndAsync();
        var stderr = process.StandardError.ReadToEndAsync();
        using var timeout = new CancellationTokenSource(TimeSpan.FromMinutes(2));
        try
        {
            await process.WaitForExitAsync(timeout.Token);
        }
        catch (OperationCanceledException)
        {
            process.Kill(entireProcessTree: true);
            throw new TimeoutException("The website check did not finish in two minutes.");
        }

        return new Result(process.ExitCode, await stdout, await stderr);
    }

    /// <summary>Every line the check printed, other than its pass line.</summary>
    public static List<string> ProblemLines(string stdout) =>
        stdout.Split('\n').Select(line => line.TrimEnd('\r')).Where(line => line.Length > 0 && line != PassLine).ToList();

    private const string PassLine = "The content passed the website's schema, media and redirect checks (not the route or output checks).";
}

/// <summary>
/// One ADM-02 test run against the shared test database: a marker that every path, slug and
/// title starts with, the admin session, and cleanup of everything the run made when it is
/// disposed (the tests' finally).
/// </summary>
internal sealed class Adm02Run : IAsyncDisposable
{
    private const string BuildUrl = "/api/v1/build/content";

    private readonly ApiFactory _factory;
    private readonly HttpClient _client;
    private readonly List<(string Collection, Guid Id)> _items = [];
    private readonly List<Guid> _media = [];

    private Adm02Run(ApiFactory factory, HttpClient client, AuthSession admin)
    {
        _factory = factory;
        _client = client;
        Admin = admin;
    }

    public string Marker { get; } = "adm02-" + Guid.NewGuid().ToString("N")[..8];

    public AuthSession Admin { get; }

    public static async Task<Adm02Run> StartAsync(ApiFactory factory, HttpClient client)
    {
        var admin = await AuthSession.LoginAsync(client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        Assert.Equal(HttpStatusCode.OK, admin.Status);
        return new Adm02Run(factory, client, admin);
    }

    public async Task<(HttpStatusCode Status, string Body)> SendAsync(HttpMethod method, string url, object? body = null)
    {
        var request = Admin.Authorized(method, url);
        if (body is not null)
            request.Content = JsonContent.Create(body);
        var response = await _client.SendAsync(request);
        return (response.StatusCode, await response.Content.ReadAsStringAsync());
    }

    public Task<(HttpStatusCode Status, string Body)> CreateRedirectAsync(string from, string to) =>
        SendAsync(HttpMethod.Post, "/api/v1/redirects", new { fromPath = from, toPath = to });

    /// <summary>A draft item with a description, so it can be published as it is.</summary>
    public async Task<Guid> CreateItemAsync(string collection, string slug)
    {
        object body = collection == "blog-posts"
            ? new { slug, title = slug, metaDescription = "A description for " + slug + ".", fields = new { body = Doc("The article body.") } }
            : new { slug, title = slug, metaDescription = "A description for " + slug + "." };
        var response = await SendAsync(HttpMethod.Post, "/api/v1/" + collection, body);
        Assert.True(response.Status == HttpStatusCode.Created, $"create {collection} {slug}: {response.Status} {response.Body}");
        var id = JsonDocument.Parse(response.Body).RootElement.GetProperty("id").GetGuid();
        _items.Add((collection, id));
        return id;
    }

    /// <summary>A created and published item; the publish must succeed.</summary>
    public async Task<Guid> PublishedAsync(string collection, string slug)
    {
        var id = await CreateItemAsync(collection, slug);
        var published = await PublishAsync(collection, id);
        Assert.True(published.Status == HttpStatusCode.OK, $"publish {collection} {slug}: {published.Status} {published.Body}");
        return id;
    }

    public async Task<JsonElement> GetAsync(string collection, Guid id)
    {
        var response = await SendAsync(HttpMethod.Get, $"/api/v1/{collection}/{id}");
        Assert.True(response.Status == HttpStatusCode.OK, $"get {collection} {id}: {response.Status} {response.Body}");
        return JsonDocument.Parse(response.Body).RootElement.Clone();
    }

    public async Task<(HttpStatusCode Status, string Body)> PublishAsync(string collection, Guid id)
    {
        var loaded = await GetAsync(collection, id);
        return await SendAsync(HttpMethod.Post, $"/api/v1/{collection}/{id}/publish", new { version = loaded.GetProperty("version").GetInt32() });
    }

    /// <summary>Saves the item with exactly these sections, keeping its slug, title and description.</summary>
    public async Task<(HttpStatusCode Status, string Body)> SaveSectionsAsync(string collection, Guid id, params object[] sections)
    {
        var loaded = await GetAsync(collection, id);
        var content = loaded.GetProperty("content");
        return await SendAsync(HttpMethod.Put, $"/api/v1/{collection}/{id}/save", new
        {
            version = loaded.GetProperty("version").GetInt32(),
            slug = content.GetProperty("slug").GetString(),
            title = content.GetProperty("title").GetString(),
            metaDescription = content.GetProperty("metaDescription").GetString(),
            sortOrder = 0,
            sections,
        });
    }

    /// <summary>A case_cards section holding one item.</summary>
    public static object CaseCards(object item) => Section("case_cards", new { heading = "H", items = new[] { item } });

    public static object Section(string type, object fields) => new { type, visible = true, fields };

    /// <summary>An image uploaded through the media route, with alt text. Unique bytes, so it is this run's own.</summary>
    public async Task<Guid> UploadMediaAsync()
    {
        var colour = Guid.NewGuid().ToByteArray();
        var info = new SKImageInfo(16, 16, SKColorType.Rgba8888, SKAlphaType.Opaque);
        using var bitmap = new SKBitmap(info);
        bitmap.Erase(new SKColor(colour[0], colour[1], colour[2]));
        bitmap.SetPixel(0, 0, new SKColor(colour[3], colour[4], colour[5]));
        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(SKEncodedImageFormat.Png, 100);

        var request = Admin.Authorized(HttpMethod.Post, "/api/v1/media");
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(data.ToArray());
        file.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        form.Add(file, "file", Marker + ".png");
        form.Add(new StringContent(Marker + " image"), "alt");
        form.Add(new StringContent("false"), "decorative");
        request.Content = form;
        var response = await _client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode is HttpStatusCode.Created or HttpStatusCode.OK, $"upload: {response.StatusCode} {body}");
        var id = JsonDocument.Parse(body).RootElement.GetProperty("id").GetGuid();
        _media.Add(id);
        return id;
    }

    public async Task<string> ReadBuildRawAsync()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, BuildUrl);
        request.Headers.TryAddWithoutValidation("X-Build-Token", ApiFactory.BuildTokenValue);
        var response = await _client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == HttpStatusCode.OK, $"build content: {response.StatusCode} {body}");
        return body;
    }

    public static string? Code(string body) =>
        JsonDocument.Parse(body).RootElement.TryGetProperty("code", out var code) ? code.GetString() : null;

    /// <summary>Every string value in a JSON body, unescaped, so a message can be searched as written.</summary>
    public static List<string> Strings(string body)
    {
        var found = new List<string>();
        void Walk(JsonElement element)
        {
            switch (element.ValueKind)
            {
                case JsonValueKind.String:
                    found.Add(element.GetString()!);
                    break;
                case JsonValueKind.Array:
                    foreach (var item in element.EnumerateArray())
                        Walk(item);
                    break;
                case JsonValueKind.Object:
                    foreach (var property in element.EnumerateObject())
                        Walk(property.Value);
                    break;
            }
        }

        Walk(JsonDocument.Parse(body).RootElement);
        return found;
    }

    public static string Doc(string text) =>
        JsonSerializer.Serialize(new { type = "doc", content = new object[] { new { type = "paragraph", content = new object[] { new { type = "text", text } } } } });

    /// <summary>
    /// Best effort, and never throws: an exception here would hide the test's own failure. Every
    /// row carries the marker, so anything left behind cannot collide with a later run.
    /// </summary>
    public async ValueTask DisposeAsync()
    {
        try
        {
            var listed = await SendAsync(HttpMethod.Get, "/api/v1/redirects?pageSize=100&search=" + Uri.EscapeDataString(Marker));
            if (listed.Status == HttpStatusCode.OK)
            {
                foreach (var row in JsonDocument.Parse(listed.Body).RootElement.GetProperty("items").EnumerateArray())
                    await SendAsync(HttpMethod.Delete, "/api/v1/redirects/" + row.GetProperty("id").GetGuid());
            }
        }
        catch (Exception)
        {
            // Left to the database sweep below.
        }

        foreach (var (collection, id) in Enumerable.Reverse(_items))
        {
            try
            {
                await RemoveItemAsync(collection, id);
            }
            catch (Exception)
            {
                // Best effort.
            }
        }

        foreach (var id in _media)
        {
            try
            {
                await SendAsync(HttpMethod.Delete, "/api/v1/media/" + id);
            }
            catch (Exception)
            {
                // Best effort.
            }
        }

        try
        {
            // Rows a test inserted straight into the database, removed as ContentPublishTests removes them.
            using var scope = _factory.Services.CreateScope();
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            var prefix = "/" + Marker;
            database.Redirects.RemoveRange(await database.Redirects.Where(item => item.FromPath.StartsWith(prefix)).ToListAsync());
            await database.SaveChangesAsync();
        }
        catch (Exception)
        {
            // Best effort.
        }
    }

    /// <summary>Unpublished, then deleted, as AdminApiTests does; by the database if the unpublish is refused.</summary>
    private async Task RemoveItemAsync(string collection, Guid id)
    {
        var loaded = await SendAsync(HttpMethod.Get, $"/api/v1/{collection}/{id}");
        if (loaded.Status != HttpStatusCode.OK)
            return;
        var item = JsonDocument.Parse(loaded.Body).RootElement;
        var version = item.GetProperty("version").GetInt32();
        if (item.GetProperty("status").GetString() == "published")
        {
            var unpublished = await SendAsync(HttpMethod.Post, $"/api/v1/{collection}/{id}/unpublish", new { version });
            if (unpublished.Status == HttpStatusCode.OK)
            {
                version = JsonDocument.Parse(unpublished.Body).RootElement.GetProperty("version").GetInt32();
            }
            else
            {
                using var scope = _factory.Services.CreateScope();
                var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
                ContentRecord? row = collection switch
                {
                    "pages" => await database.Pages.SingleOrDefaultAsync(entry => entry.Id == id),
                    "case-studies" => await database.CaseStudies.SingleOrDefaultAsync(entry => entry.Id == id),
                    "blog-posts" => await database.BlogPosts.SingleOrDefaultAsync(entry => entry.Id == id),
                    _ => null,
                };
                if (row is null)
                    return;
                row.Status = ContentStatus.Draft;
                await database.SaveChangesAsync();
                version = row.Version;
            }
        }

        await SendAsync(HttpMethod.Delete, $"/api/v1/{collection}/{id}?version={version}");
    }
}
