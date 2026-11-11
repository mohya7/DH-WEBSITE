using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DigitalHub.Api.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DigitalHub.Api.Tests;

/// <summary>
/// ADM-06: one page-2 test per paged list endpoint. Each test seeds three rows made
/// unique by a suffix, filters to exactly those rows, asks for page 2 of size 2, and
/// deletes what it created.
/// </summary>
[Collection("SqlServer")]
public sealed class ListPagingTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    private readonly HttpClient _client;

    public ListPagingTests(ApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Redirects_list_returns_page_two()
    {
        var admin = await AdminAsync();
        var suffix = Suffix();
        var ids = new List<Guid>();
        try
        {
            foreach (var letter in new[] { "a", "b", "c" })
                ids.Add(await CreateRedirectAsync(admin, "/adm06-" + suffix + "-" + letter));

            var page = await SendAsync(admin, HttpMethod.Get, "/api/v1/redirects?search=" + Uri.EscapeDataString("adm06-" + suffix) + "&page=2&pageSize=2");

            var item = AssertPageTwoOfThree(page);
            Assert.Equal("/adm06-" + suffix + "-c", item.GetProperty("fromPath").GetString());
        }
        finally
        {
            foreach (var id in ids)
                await SendAsync(admin, HttpMethod.Delete, "/api/v1/redirects/" + id);
        }
    }

    [Fact]
    public async Task Contact_requests_list_returns_page_two()
    {
        var admin = await AdminAsync();
        var suffix = Suffix();
        var now = DateTime.UtcNow;
        var rows = new[] { ("A", 3), ("B", 2), ("C", 1) }
            .Select(row => new ContactRequest
            {
                Id = Guid.NewGuid(),
                Name = "ADM06 " + suffix + " " + row.Item1,
                Organization = "Digital Hub",
                Role = "Editor",
                Email = "adm06-" + suffix + "-" + row.Item1.ToLowerInvariant() + "@example.com",
                Situation = "question",
                Message = "Paging test enquiry.",
                Status = "new",
                CreatedAt = now.AddMinutes(-row.Item2),
            })
            .ToList();
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            db.ContactRequests.AddRange(rows);
            await db.SaveChangesAsync();
        }

        try
        {
            var page = await SendAsync(admin, HttpMethod.Get, "/api/v1/contact-requests?search=" + suffix + "&page=2&pageSize=2");

            // Newest first, so page 2 holds the oldest.
            var item = AssertPageTwoOfThree(page);
            Assert.Equal(rows[0].Id, item.GetProperty("id").GetGuid());
        }
        finally
        {
            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            var ids = rows.Select(row => row.Id).ToList();
            db.ContactRequests.RemoveRange(await db.ContactRequests.Where(row => ids.Contains(row.Id)).ToListAsync());
            await db.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task Media_list_returns_page_two()
    {
        var admin = await AdminAsync();
        var suffix = Suffix();
        var now = DateTime.UtcNow;
        // Seeded through the database, not the upload route, which is limited to
        // 20 uploads an hour per user across the whole suite.
        var rows = new[] { ("a", 3), ("b", 2), ("c", 1) }
            .Select(row => new MediaAsset
            {
                Id = Guid.NewGuid(),
                Path = "/media/" + Guid.NewGuid().ToString("N") + ".webp",
                OriginalName = "adm06-" + suffix + "-" + row.Item1 + ".webp",
                ContentType = "image/webp",
                GeneratedSizes = "[]",
                ContentHash = Guid.NewGuid().ToString("N"),
                CreatedAt = now.AddMinutes(-row.Item2),
            })
            .ToList();
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            db.Media.AddRange(rows);
            await db.SaveChangesAsync();
        }

        try
        {
            var page = await SendAsync(admin, HttpMethod.Get, "/api/v1/media?search=" + suffix + "&page=2&pageSize=2");

            // Newest first, so page 2 holds the oldest.
            var item = AssertPageTwoOfThree(page);
            Assert.Equal(rows[0].Id, item.GetProperty("id").GetGuid());
        }
        finally
        {
            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            var ids = rows.Select(row => row.Id).ToList();
            db.Media.RemoveRange(await db.Media.Where(row => ids.Contains(row.Id)).ToListAsync());
            await db.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task Audit_list_returns_page_two()
    {
        var admin = await AdminAsync();
        var suffix = Suffix();
        var ids = new List<Guid>();
        try
        {
            // No padding on either side: a wider window could take in the
            // create_redirect entries another test in this class wrote moments earlier.
            var before = DateTime.UtcNow;
            foreach (var letter in new[] { "a", "b", "c" })
                ids.Add(await CreateRedirectAsync(admin, "/adm06-" + suffix + "-" + letter));
            var after = DateTime.UtcNow;

            var window = "/api/v1/audit?action=create_redirect"
                + "&from=" + Uri.EscapeDataString(before.ToString("O"))
                + "&to=" + Uri.EscapeDataString(after.ToString("O"));

            var second = await SendAsync(admin, HttpMethod.Get, window + "&page=2&pageSize=2");
            // Newest first, so page 2 holds the first redirect's entry.
            var item = AssertPageTwoOfThree(second);
            Assert.Equal(ids[0].ToString(), item.GetProperty("entityId").GetString());

            var first = await SendAsync(admin, HttpMethod.Get, window + "&page=1&pageSize=2");
            Assert.Equal(HttpStatusCode.OK, first.Status);
            var firstItems = Items(first.Body);
            Assert.Equal(
                [ids[2].ToString(), ids[1].ToString()],
                firstItems.Select(entry => entry.GetProperty("entityId").GetString()).ToList());
            var firstEntryIds = firstItems.Select(entry => entry.GetProperty("id").GetString()).ToList();
            Assert.DoesNotContain(item.GetProperty("id").GetString(), firstEntryIds);
        }
        finally
        {
            // The audit rows stay: the app login cannot delete from audit_log.
            foreach (var id in ids)
                await SendAsync(admin, HttpMethod.Delete, "/api/v1/redirects/" + id);
        }
    }

    [Fact]
    public async Task Collection_list_returns_page_two()
    {
        var admin = await AdminAsync();
        var suffix = Suffix();
        var ids = new List<Guid>();
        try
        {
            foreach (var letter in new[] { "A", "B", "C" })
            {
                var created = await SendAsync(admin, HttpMethod.Post, "/api/v1/pages", new
                {
                    slug = "adm06-" + suffix + "-" + letter.ToLowerInvariant(),
                    title = "ADM06 " + suffix + " " + letter,
                });
                Assert.Equal(HttpStatusCode.Created, created.Status);
                ids.Add(JsonDocument.Parse(created.Body).RootElement.GetProperty("id").GetGuid());
            }

            var page = await SendAsync(admin, HttpMethod.Get, "/api/v1/pages?search=" + suffix + "&page=2&pageSize=2");

            // Pages are not a sort-ordered collection, so the order is by title.
            var item = AssertPageTwoOfThree(page);
            Assert.Equal("ADM06 " + suffix + " C", item.GetProperty("title").GetString());
            Assert.Equal(ids[2], item.GetProperty("id").GetGuid());
        }
        finally
        {
            foreach (var id in ids)
                await SendAsync(admin, HttpMethod.Delete, "/api/v1/pages/" + id + "?version=1");
        }
    }

    private static JsonElement AssertPageTwoOfThree((HttpStatusCode Status, string Body) response)
    {
        Assert.Equal(HttpStatusCode.OK, response.Status);
        var json = JsonDocument.Parse(response.Body).RootElement;
        Assert.Equal(2, json.GetProperty("page").GetInt32());
        Assert.Equal(2, json.GetProperty("pageSize").GetInt32());
        Assert.Equal(3, json.GetProperty("total").GetInt32());
        return Assert.Single(json.GetProperty("items").EnumerateArray());
    }

    private async Task<Guid> CreateRedirectAsync(AuthSession admin, string fromPath)
    {
        var created = await SendAsync(admin, HttpMethod.Post, "/api/v1/redirects", new { fromPath, toPath = "/" });
        Assert.Equal(HttpStatusCode.Created, created.Status);
        return JsonDocument.Parse(created.Body).RootElement.GetProperty("id").GetGuid();
    }

    private static string Suffix() => Guid.NewGuid().ToString("N")[..8];

    private async Task<AuthSession> AdminAsync()
    {
        await EnsurePrimaryAdminActiveAsync();
        var session = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        Assert.Equal(HttpStatusCode.OK, session.Status);
        return session;
    }

    private async Task EnsurePrimaryAdminActiveAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var primary = await users.FindByEmailAsync(ApiFactory.AdminEmail);
        Assert.NotNull(primary);
        if (!primary.LockoutEnabled && primary.LockoutEnd is null)
            return;
        primary.LockoutEnabled = false;
        primary.LockoutEnd = null;
        Assert.True((await users.UpdateAsync(primary)).Succeeded);
    }

    private async Task<(HttpStatusCode Status, string Body)> SendAsync(AuthSession session, HttpMethod method, string url, object? body = null)
    {
        var request = session.Authorized(method, url);
        if (body is not null)
            request.Content = JsonContent.Create(body);
        var response = await _client.SendAsync(request);
        return (response.StatusCode, await response.Content.ReadAsStringAsync());
    }

    private static List<JsonElement> Items(string body) =>
        JsonDocument.Parse(body).RootElement.GetProperty("items").EnumerateArray().ToList();
}
