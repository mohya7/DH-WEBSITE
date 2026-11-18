using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DigitalHub.Api.Content;
using DigitalHub.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DigitalHub.Api.Tests;

/// <summary>
/// ADM-07 part 3: a redirect must land on a page. The API still creates a redirect
/// whose target has no page (the audit's fix "warns"), but says so with targetLive,
/// in the 201 body and in every list row. Deleting or renaming an item finds the
/// redirects to its address however their target was spelled. And (F-2, O-ADM07-2)
/// an ended vacancy's page, which the build still writes, cannot be taken over.
/// Each test uses its own adm07- marker, so no path or slug is fixed.
/// </summary>
[Collection("SqlServer")]
public sealed class RedirectTargetTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    private readonly HttpClient _client;

    public RedirectTargetTests(ApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task A_redirect_to_an_address_with_no_page_is_created_and_flagged()
    {
        await using var run = await Adm07Run.StartAsync(_factory, _client);
        var from = "/" + run.Marker + "-old";

        var created = await run.CreateRedirectAsync(from, "/" + run.Marker + "-nowhere");
        Assert.True(created.Status == HttpStatusCode.Created, $"{created.Status} {created.Body}");
        Assert.False(Adm07Run.TargetLive(created.Body), "targetLive should be false: " + created.Body);

        Assert.False(await run.ListedTargetLiveAsync(from), "the list row's targetLive should be false");
    }

    [Theory]
    [InlineData("")]
    [InlineData("/")]
    public async Task A_redirect_to_a_live_page_is_not_flagged(string suffix)
    {
        await using var run = await Adm07Run.StartAsync(_factory, _client);
        await run.PublishedAsync("pages", run.Marker + "-live");
        var from = "/" + run.Marker + "-in";

        var created = await run.CreateRedirectAsync(from, "/" + run.Marker + "-live" + suffix);
        Assert.True(created.Status == HttpStatusCode.Created, $"{created.Status} {created.Body}");
        Assert.True(Adm07Run.TargetLive(created.Body), "targetLive should be true: " + created.Body);

        Assert.True(await run.ListedTargetLiveAsync(from), "the list row's targetLive should be true");
    }

    [Theory]
    [InlineData("ended-vacancy", true)]
    [InlineData("privacy-careers", true)]
    [InlineData("draft-page", false)]
    [InlineData("html-spelling", false)]
    [InlineData("upper-case", false)]
    [InlineData("error-page", false)]
    public async Task Targets_count_as_pages_exactly_where_the_build_writes_one(string target, bool expected)
    {
        await using var run = await Adm07Run.StartAsync(_factory, _client);
        var live = run.Marker + "-live";
        string toPath;
        switch (target)
        {
            case "ended-vacancy":
                await run.EndedVacancyAsync(run.Marker + "-ended");
                toPath = "/careers/" + run.Marker + "-ended";
                break;
            case "privacy-careers":
                toPath = "/privacy-careers";
                break;
            case "draft-page":
                await run.CreateItemAsync("pages", run.Marker + "-draft");
                toPath = "/" + run.Marker + "-draft";
                break;
            case "html-spelling":
                await run.PublishedAsync("pages", live);
                toPath = "/" + live + ".html";
                break;
            case "upper-case":
                await run.PublishedAsync("pages", live);
                toPath = "/" + live.ToUpperInvariant();
                break;
            case "error-page":
                toPath = "/404";
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(target), target, null);
        }

        var from = "/" + run.Marker + "-in";
        var created = await run.CreateRedirectAsync(from, toPath);
        Assert.True(created.Status == HttpStatusCode.Created, $"{created.Status} {created.Body}");
        Assert.True(Adm07Run.TargetLive(created.Body) == expected, $"targetLive for {toPath} should be {expected}: {created.Body}");
        Assert.True(await run.ListedTargetLiveAsync(from) == expected, $"the list row's targetLive for {toPath} should be {expected}");
    }

    [Fact]
    public async Task Unpublishing_a_page_flags_the_redirects_that_point_at_it()
    {
        await using var run = await Adm07Run.StartAsync(_factory, _client);
        var page = await run.PublishedAsync("pages", run.Marker + "-p");
        var from = "/" + run.Marker + "-in";

        var created = await run.CreateRedirectAsync(from, "/" + run.Marker + "-p");
        Assert.True(created.Status == HttpStatusCode.Created, $"{created.Status} {created.Body}");
        Assert.True(Adm07Run.TargetLive(created.Body), "targetLive should be true while the page is live: " + created.Body);

        var unpublished = await run.UnpublishAsync("pages", page);
        Assert.True(unpublished.Status == HttpStatusCode.OK, $"{unpublished.Status} {unpublished.Body}");

        Assert.False(await run.ListedTargetLiveAsync(from), "the list row's targetLive should be false once the page is unpublished");
    }

    [Fact]
    public async Task Deleting_an_item_removes_redirects_to_its_address_with_a_trailing_slash()
    {
        await using var run = await Adm07Run.StartAsync(_factory, _client);
        var page = await run.PublishedAsync("pages", run.Marker + "-p");
        var from = "/" + run.Marker + "-in";

        var created = await run.CreateRedirectAsync(from, "/" + run.Marker + "-p/");
        Assert.True(created.Status == HttpStatusCode.Created, $"{created.Status} {created.Body}");
        var redirectId = JsonDocument.Parse(created.Body).RootElement.GetProperty("id").GetGuid();

        var unpublished = await run.UnpublishAsync("pages", page);
        Assert.True(unpublished.Status == HttpStatusCode.OK, $"{unpublished.Status} {unpublished.Body}");
        var deleted = await run.DeleteItemAsync("pages", page);
        Assert.True(deleted.Status == HttpStatusCode.NoContent, $"{deleted.Status} {deleted.Body}");

        var listed = await run.SendAsync(HttpMethod.Get, "/api/v1/redirects?search=" + Uri.EscapeDataString(run.Marker + "-in"));
        Assert.Equal(HttpStatusCode.OK, listed.Status);
        Assert.True(JsonDocument.Parse(listed.Body).RootElement.GetProperty("total").GetInt32() == 0, "The redirect to /<m>-p/ survived the delete: " + listed.Body);

        using var scope = _factory.Services.CreateScope();
        var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        var entityId = redirectId.ToString();
        Assert.True(
            await database.AuditLog.AsNoTracking().AnyAsync(entry => entry.Action == "delete_redirect" && entry.EntityId == entityId),
            "No delete_redirect audit row for " + entityId);
    }

    [Fact]
    public async Task A_rename_retargets_redirects_to_the_old_address_with_a_trailing_slash()
    {
        await using var run = await Adm07Run.StartAsync(_factory, _client);
        var oldSlug = run.Marker + "-p";
        var newSlug = run.Marker + "-q";
        var page = await run.PublishedAsync("pages", oldSlug);
        var from = "/" + run.Marker + "-in";

        var created = await run.CreateRedirectAsync(from, "/" + oldSlug + "/");
        Assert.True(created.Status == HttpStatusCode.Created, $"{created.Status} {created.Body}");

        var loaded = await run.GetAsync("pages", page);
        var edited = await run.SendAsync(HttpMethod.Put, "/api/v1/pages/" + page, new
        {
            version = loaded.GetProperty("version").GetInt32(),
            slug = newSlug,
            title = oldSlug,
            metaDescription = "A description for " + oldSlug + ".",
        });
        Assert.True(edited.Status == HttpStatusCode.OK, $"{edited.Status} {edited.Body}");
        var published = await run.PublishAsync("pages", page);
        Assert.True(published.Status == HttpStatusCode.OK, $"{published.Status} {published.Body}");

        using var scope = _factory.Services.CreateScope();
        var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        var prefix = "/" + run.Marker;
        var rows = await database.Redirects.AsNoTracking().Where(item => item.FromPath.StartsWith(prefix)).ToListAsync();
        var described = JsonSerializer.Serialize(rows.Select(item => item.FromPath + " -> " + item.ToPath));

        var incoming = Assert.Single(rows, item => item.FromPath == from);
        Assert.True(incoming.ToPath == "/" + newSlug, $"{from} should point at /{newSlug}: {described}");

        var atOldAddress = rows.Where(item => RedirectPaths.Key(item.FromPath) == "/" + oldSlug).ToList();
        Assert.True(atOldAddress.Count == 1, $"Exactly one redirect should start at /{oldSlug}: {described}");
        Assert.Equal("/" + newSlug, atOldAddress[0].ToPath);
    }

    [Theory]
    [InlineData("")]
    [InlineData("/")]
    public async Task A_redirect_cannot_take_over_an_ended_vacancy(string suffix)
    {
        await using var run = await Adm07Run.StartAsync(_factory, _client);
        var slug = run.Marker + "-v";
        await run.EndedVacancyAsync(slug);

        var response = await run.CreateRedirectAsync("/careers/" + slug + suffix, "/careers");
        Assert.True(response.Status == HttpStatusCode.BadRequest, $"{response.Status} {response.Body}");
        Assert.Equal("redirect_live_path", Adm02Run.Code(response.Body));

        // As the content bundle import calls it, after it has written the row.
        var row = new Redirect
        {
            Id = Guid.NewGuid(),
            FromPath = "/careers/" + slug + suffix,
            ToPath = "/careers",
            StatusCode = 301,
            Source = "manual",
            CreatedAt = DateTime.UtcNow,
        };
        using var scope = _factory.Services.CreateScope();
        var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        database.Redirects.Add(row);
        await database.SaveChangesAsync();
        try
        {
            var errors = await AdminStore.CheckRedirectAsync(database, row, CancellationToken.None);
            Assert.True(
                errors.TryGetValue("fromPath", out var messages) && messages.Contains("A redirect source cannot equal the path of a live page."),
                "No live-path error for " + row.FromPath + ": " + JsonSerializer.Serialize(errors));
        }
        finally
        {
            database.Redirects.Remove(row);
            await database.SaveChangesAsync();
        }
    }
}

/// <summary>
/// One ADM-07 test run against the shared test database: an adm07- marker that every
/// path, slug and title starts with, the admin session, and cleanup of everything the
/// run made when it is disposed (the tests' finally). Adm02Run's own marker is fixed
/// to adm02-, so this is its ADM-07 counterpart; Adm02Run itself is unchanged.
/// </summary>
internal sealed class Adm07Run : IAsyncDisposable
{
    private readonly ApiFactory _factory;
    private readonly HttpClient _client;
    private readonly List<(string Collection, Guid Id)> _items = [];

    private Adm07Run(ApiFactory factory, HttpClient client, AuthSession admin)
    {
        _factory = factory;
        _client = client;
        Admin = admin;
    }

    public string Marker { get; } = NewMarker();

    public AuthSession Admin { get; }

    public static string NewMarker() => "adm07-" + Guid.NewGuid().ToString("N")[..8];

    public static async Task<Adm07Run> StartAsync(ApiFactory factory, HttpClient client)
    {
        var admin = await AuthSession.LoginAsync(client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        Assert.Equal(HttpStatusCode.OK, admin.Status);
        return new Adm07Run(factory, client, admin);
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

    /// <summary>targetLive from a redirect body; fails, printing the body, when the API gives none.</summary>
    public static bool TargetLive(string body) => TargetLive(JsonDocument.Parse(body).RootElement, body);

    private static bool TargetLive(JsonElement row, string shown)
    {
        if (!row.TryGetProperty("targetLive", out var value) || value.ValueKind is not (JsonValueKind.True or JsonValueKind.False))
            Assert.Fail("The redirect has no targetLive: " + shown);
        return value.GetBoolean();
    }

    /// <summary>targetLive on the list row that starts at this path.</summary>
    public async Task<bool> ListedTargetLiveAsync(string fromPath)
    {
        var listed = await SendAsync(HttpMethod.Get, "/api/v1/redirects?pageSize=100&search=" + Uri.EscapeDataString(Marker));
        Assert.True(listed.Status == HttpStatusCode.OK, $"list: {listed.Status} {listed.Body}");
        var rows = JsonDocument.Parse(listed.Body).RootElement.GetProperty("items").EnumerateArray()
            .Where(row => row.GetProperty("fromPath").GetString() == fromPath)
            .ToList();
        Assert.True(rows.Count == 1, $"Expected one list row from {fromPath}: {listed.Body}");
        return TargetLive(rows[0], listed.Body);
    }

    /// <summary>A draft item with a description, so it can be published as it is.</summary>
    public async Task<Guid> CreateItemAsync(string collection, string slug)
    {
        object body = collection == "vacancies"
            ? new { slug, title = slug, metaDescription = "A description for " + slug + ".", fields = new { summary = "A role." } }
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

    /// <summary>A vacancy published, then ended, as CareersTests.EndedVacancyAsync does.</summary>
    public async Task<Guid> EndedVacancyAsync(string slug)
    {
        var id = await PublishedAsync("vacancies", slug);
        var loaded = await GetAsync("vacancies", id);
        var ended = await SendAsync(HttpMethod.Post, $"/api/v1/vacancies/{id}/end", new { version = loaded.GetProperty("version").GetInt32() });
        Assert.True(ended.Status == HttpStatusCode.OK, $"end vacancy {slug}: {ended.Status} {ended.Body}");
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

    public async Task<(HttpStatusCode Status, string Body)> UnpublishAsync(string collection, Guid id)
    {
        var loaded = await GetAsync(collection, id);
        return await SendAsync(HttpMethod.Post, $"/api/v1/{collection}/{id}/unpublish", new { version = loaded.GetProperty("version").GetInt32() });
    }

    public async Task<(HttpStatusCode Status, string Body)> DeleteItemAsync(string collection, Guid id)
    {
        var loaded = await GetAsync(collection, id);
        return await SendAsync(HttpMethod.Delete, $"/api/v1/{collection}/{id}?version={loaded.GetProperty("version").GetInt32()}");
    }

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
                var loaded = await SendAsync(HttpMethod.Get, $"/api/v1/{collection}/{id}");
                if (loaded.Status != HttpStatusCode.OK)
                    continue;
                var item = JsonDocument.Parse(loaded.Body).RootElement;
                var version = item.GetProperty("version").GetInt32();
                if (item.GetProperty("status").GetString() == "published")
                {
                    var unpublished = await SendAsync(HttpMethod.Post, $"/api/v1/{collection}/{id}/unpublish", new { version });
                    if (unpublished.Status != HttpStatusCode.OK)
                        continue;
                    version = JsonDocument.Parse(unpublished.Body).RootElement.GetProperty("version").GetInt32();
                }

                await SendAsync(HttpMethod.Delete, $"/api/v1/{collection}/{id}?version={version}");
            }
            catch (Exception)
            {
                // Best effort.
            }
        }

        try
        {
            // Rows a test inserted straight into the database, or that the API left behind.
            using var scope = _factory.Services.CreateScope();
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            var marker = Marker;
            database.Redirects.RemoveRange(await database.Redirects
                .Where(item => item.FromPath.Contains(marker) || item.ToPath.Contains(marker))
                .ToListAsync());
            await database.SaveChangesAsync();
        }
        catch (Exception)
        {
            // Best effort.
        }
    }
}
