using System.Net;
using System.Text.Json;
using DigitalHub.Api.Content;
using DigitalHub.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DigitalHub.Api.Tests;

/// <summary>
/// ADM-02 part 1 and ADM-07 parts 1 and 2: the website build gives /x and /x/ one
/// address (web-config.ts), so every redirect check in the API must too. Each test
/// uses its own marker, so no path or slug is fixed.
/// </summary>
[Collection("SqlServer")]
public sealed class RedirectAddressTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    private readonly HttpClient _client;

    public RedirectAddressTests(ApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Theory]
    [InlineData("", "/")]
    [InlineData("/", "")]
    public async Task A_trailing_slash_does_not_make_a_second_redirect(string firstSuffix, string secondSuffix)
    {
        await using var run = await Adm02Run.StartAsync(_factory, _client);
        var path = "/" + run.Marker;

        var first = await run.CreateRedirectAsync(path + firstSuffix, "/");
        Assert.True(first.Status == HttpStatusCode.Created, $"{first.Status} {first.Body}");

        var second = await run.CreateRedirectAsync(path + secondSuffix, "/");
        Assert.True(second.Status == HttpStatusCode.Conflict, $"{second.Status} {second.Body}");
        Assert.Equal("redirect_exists", Adm02Run.Code(second.Body));

        var listed = await run.SendAsync(HttpMethod.Get, "/api/v1/redirects?search=" + run.Marker);
        Assert.Equal(HttpStatusCode.OK, listed.Status);
        Assert.Equal(1, JsonDocument.Parse(listed.Body).RootElement.GetProperty("total").GetInt32());
    }

    [Theory]
    [InlineData("", "/")]
    [InlineData("/", "")]
    public async Task A_redirect_to_its_own_address_is_refused_with_or_without_a_slash(string fromSuffix, string toSuffix)
    {
        await using var run = await Adm02Run.StartAsync(_factory, _client);
        var path = "/" + run.Marker + "-a";

        var response = await run.CreateRedirectAsync(path + fromSuffix, path + toSuffix);
        Assert.True(response.Status == HttpStatusCode.BadRequest, $"{response.Status} {response.Body}");
        Assert.Equal("redirect_loop", Adm02Run.Code(response.Body));
    }

    [Fact]
    public async Task Loops_and_chains_are_seen_through_a_trailing_slash()
    {
        await using var run = await Adm02Run.StartAsync(_factory, _client);
        var p = "/" + run.Marker + "-p";
        var q = "/" + run.Marker + "-q";
        var c = "/" + run.Marker + "-c";

        var chain = await run.CreateRedirectAsync(p, q);
        Assert.True(chain.Status == HttpStatusCode.Created, $"{chain.Status} {chain.Body}");

        // /q/ -> /p/ -> /q is a loop the build would write.
        var loop = await run.CreateRedirectAsync(q + "/", p + "/");
        Assert.True(loop.Status == HttpStatusCode.BadRequest, $"{loop.Status} {loop.Body}");
        Assert.Equal("redirect_loop", Adm02Run.Code(loop.Body));

        // A redirect to /p/ collapses through /p's redirect, as a redirect to /p does (design 4.5).
        var collapsed = await run.CreateRedirectAsync(c, p + "/");
        Assert.True(collapsed.Status == HttpStatusCode.Created, $"{collapsed.Status} {collapsed.Body}");
        Assert.Equal(q, JsonDocument.Parse(collapsed.Body).RootElement.GetProperty("toPath").GetString());
    }

    [Theory]
    [InlineData("pages", "/")]
    [InlineData("case-studies", "/cases/")]
    [InlineData("blog-posts", "/blogs/")]
    public async Task A_redirect_cannot_take_over_a_live_address_with_a_trailing_slash(string collection, string prefix)
    {
        await using var run = await Adm02Run.StartAsync(_factory, _client);
        var slug = run.Marker;
        await run.PublishedAsync(collection, slug);

        var response = await run.CreateRedirectAsync(prefix + slug + "/", "/" + run.Marker + "-elsewhere");
        Assert.True(response.Status == HttpStatusCode.BadRequest, $"{response.Status} {response.Body}");
        Assert.Equal("redirect_live_path", Adm02Run.Code(response.Body));
    }

    [Fact]
    public async Task Publishing_is_refused_where_a_redirect_with_a_slash_starts()
    {
        await using var run = await Adm02Run.StartAsync(_factory, _client);
        var page = await run.CreateItemAsync("pages", run.Marker);

        // The page is not live yet, so the redirect is accepted.
        var redirect = await run.CreateRedirectAsync("/" + run.Marker + "/", "/" + run.Marker + "-elsewhere");
        Assert.True(redirect.Status == HttpStatusCode.Created, $"{redirect.Status} {redirect.Body}");

        var published = await run.PublishAsync("pages", page);
        Assert.True(published.Status == HttpStatusCode.BadRequest, $"{published.Status} {published.Body}");
        Assert.Equal("publish_blocked", Adm02Run.Code(published.Body));
        Assert.Contains(Adm02Run.Strings(published.Body), message => message.Contains("source of a redirect", StringComparison.Ordinal));
    }

    [Fact]
    public async Task A_rename_reuses_the_redirect_that_starts_at_the_old_address_with_a_slash()
    {
        await using var run = await Adm02Run.StartAsync(_factory, _client);
        var slug = run.Marker;
        var page = await run.PublishedAsync("pages", slug);

        // A legacy row, stored with a trailing slash before the API compared addresses.
        using (var scope = _factory.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            database.Redirects.Add(new Redirect
            {
                Id = Guid.NewGuid(),
                FromPath = "/" + slug + "/",
                ToPath = "/" + slug + "-x",
                StatusCode = 301,
                Source = "manual",
                CreatedAt = DateTime.UtcNow,
            });
            await database.SaveChangesAsync();
        }

        var loaded = await run.GetAsync("pages", page);
        var renamed = slug + "-new";
        var edited = await run.SendAsync(HttpMethod.Put, "/api/v1/pages/" + page, new
        {
            version = loaded.GetProperty("version").GetInt32(),
            slug = renamed,
            title = slug,
            metaDescription = "A description for " + slug + ".",
        });
        Assert.True(edited.Status == HttpStatusCode.OK, $"{edited.Status} {edited.Body}");
        var published = await run.PublishAsync("pages", page);
        Assert.True(published.Status == HttpStatusCode.OK, $"{published.Status} {published.Body}");

        using (var scope = _factory.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            var atOldAddress = await database.Redirects.AsNoTracking()
                .Where(item => item.FromPath == "/" + slug || item.FromPath == "/" + slug + "/")
                .ToListAsync();
            var row = Assert.Single(atOldAddress);
            Assert.Equal("/" + renamed, row.ToPath);
        }
    }

    [Fact]
    public async Task The_import_check_refuses_a_shared_address_and_a_self_redirect()
    {
        await using var run = await Adm02Run.StartAsync(_factory, _client);
        var i = "/" + run.Marker + "-i";
        var j = "/" + run.Marker + "-j";
        var plain = new Redirect { Id = Guid.NewGuid(), FromPath = i, ToPath = "/" + run.Marker + "-k", StatusCode = 301, Source = "manual", CreatedAt = DateTime.UtcNow };
        var slashed = new Redirect { Id = Guid.NewGuid(), FromPath = i + "/", ToPath = "/" + run.Marker + "-l", StatusCode = 301, Source = "manual", CreatedAt = DateTime.UtcNow };
        var self = new Redirect { Id = Guid.NewGuid(), FromPath = j, ToPath = j + "/", StatusCode = 301, Source = "manual", CreatedAt = DateTime.UtcNow };

        using var scope = _factory.Services.CreateScope();
        var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        database.Redirects.AddRange(plain, slashed, self);
        await database.SaveChangesAsync();

        // As the content bundle import calls it, after it has written the rows.
        var shared = await AdminStore.CheckRedirectAsync(database, slashed, CancellationToken.None);
        Assert.True(shared.ContainsKey("fromPath"), "No fromPath error for " + slashed.FromPath + ": " + JsonSerializer.Serialize(shared));

        var loop = await AdminStore.CheckRedirectAsync(database, self, CancellationToken.None);
        Assert.True(loop.ContainsKey("toPath"), "No toPath error for " + self.FromPath + " -> " + self.ToPath + ": " + JsonSerializer.Serialize(loop));
    }
}
