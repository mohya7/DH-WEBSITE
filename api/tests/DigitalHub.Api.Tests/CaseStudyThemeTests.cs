extern alias importer;

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AngleSharp.Html.Parser;
using DigitalHub.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using ContentWriter = importer::DigitalHub.ContentImport.ContentWriter;

namespace DigitalHub.Api.Tests;

/// <summary>
/// A case study's accent is orange, teal, or empty. The collections JSON rejects
/// anything else, and the column stores the accepted value.
/// </summary>
[Collection("SqlServer")]
public sealed class CaseStudyThemeTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    private readonly HttpClient _client;

    public CaseStudyThemeTests(ApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public void The_importer_reads_the_old_body_class_and_leaves_every_other_page_blue()
    {
        var parser = new HtmlParser();
        Assert.Equal("orange", ContentWriter.CaseTheme(parser.ParseDocument("<html><body class=\"theme-orange page-case\"></body></html>")));
        Assert.Equal("teal", ContentWriter.CaseTheme(parser.ParseDocument("<html><body class=\"theme-teal page-case\"></body></html>")));
        Assert.Null(ContentWriter.CaseTheme(parser.ParseDocument("<html><body class=\"page-case\"></body></html>")));
        Assert.Null(ContentWriter.CaseTheme(parser.ParseDocument("<html><body class=\"theme-blue page-case\"></body></html>")));
        Assert.Null(ContentWriter.CaseTheme(null));
    }

    [Fact]
    public async Task Theme_is_stored_and_returned_and_a_bad_value_is_rejected()
    {
        var admin = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        Assert.Equal(HttpStatusCode.OK, admin.Status);
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var slug = "theme-" + suffix;
        Guid id = Guid.Empty;
        try
        {
            var created = await SendAsync(admin, HttpMethod.Post, "/api/v1/case-studies", new { slug, title = "Theme " + suffix });
            Ok(created, HttpStatusCode.Created);
            var item = JsonDocument.Parse(created.Body).RootElement;
            id = item.GetProperty("id").GetGuid();
            var version = item.GetProperty("version").GetInt32();

            version = await SaveThemeAsync(admin, id, slug, version, "orange");
            Assert.Equal("orange", await StoredThemeAsync(id));
            version = await SaveThemeAsync(admin, id, slug, version, "teal");
            Assert.Equal("teal", await StoredThemeAsync(id));
            version = await SaveThemeAsync(admin, id, slug, version, null);
            Assert.Null(await StoredThemeAsync(id));

            var rejected = await SaveAsync(admin, id, slug, version, "blue");
            Assert.Equal(HttpStatusCode.BadRequest, rejected.Status);
            Assert.Contains("validation_failed", rejected.Body, StringComparison.Ordinal);
            Assert.Contains("theme", rejected.Body, StringComparison.Ordinal);
            Assert.Null(await StoredThemeAsync(id));

            var empty = await SaveAsync(admin, id, slug, version, "");
            Assert.Equal(HttpStatusCode.BadRequest, empty.Status);
            Assert.Null(await StoredThemeAsync(id));
        }
        finally
        {
            if (id != Guid.Empty)
            {
                using var scope = _factory.Services.CreateScope();
                var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
                var study = await database.CaseStudies.SingleOrDefaultAsync(item => item.Id == id);
                if (study is not null)
                {
                    database.CaseStudies.Remove(study);
                    await database.SaveChangesAsync();
                }
            }
        }
    }

    private async Task<int> SaveThemeAsync(AuthSession admin, Guid id, string slug, int version, string? theme)
    {
        var saved = await SaveAsync(admin, id, slug, version, theme);
        Ok(saved);
        var body = JsonDocument.Parse(saved.Body).RootElement;
        var stored = body.GetProperty("content").GetProperty("fields").GetProperty("theme");
        if (theme is null)
            Assert.Equal(JsonValueKind.Null, stored.ValueKind);
        else
            Assert.Equal(theme, stored.GetString());
        return body.GetProperty("version").GetInt32();
    }

    private async Task<(HttpStatusCode Status, string Body)> SaveAsync(AuthSession admin, Guid id, string slug, int version, string? theme)
    {
        return await SendAsync(admin, HttpMethod.Put, "/api/v1/case-studies/" + id + "/save", new
        {
            version,
            slug,
            title = "Theme",
            sortOrder = 0,
            sections = Array.Empty<object>(),
            fields = new { theme },
        });
    }

    private async Task<string?> StoredThemeAsync(Guid id)
    {
        using var scope = _factory.Services.CreateScope();
        var database = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        return await database.CaseStudies.Where(item => item.Id == id).Select(item => item.Theme).SingleAsync();
    }

    private async Task<(HttpStatusCode Status, string Body)> SendAsync(AuthSession session, HttpMethod method, string url, object? body = null)
    {
        var request = session.Authorized(method, url);
        if (body is not null)
            request.Content = JsonContent.Create(body);
        var response = await _client.SendAsync(request);
        return (response.StatusCode, await response.Content.ReadAsStringAsync());
    }

    private static void Ok((HttpStatusCode Status, string Body) response, HttpStatusCode expected = HttpStatusCode.OK) =>
        Assert.True(response.Status == expected, $"expected {expected}, got {response.Status}: {response.Body}");
}
