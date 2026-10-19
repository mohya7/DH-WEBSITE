using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DigitalHub.Api.Content;
using DigitalHub.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DigitalHub.Api.Tests;

/// <summary>
/// Finding O1: a section's link field (x-dh-kind "url") accepts only a site path,
/// a #fragment, or http, https, mailto and tel addresses, on save and on publish.
/// A javascript: or data: address used to be saved and published as a live link.
/// </summary>
[Collection("SqlServer")]
public sealed class SectionLinkTests : IClassFixture<ApiFactory>
{
    private const string Description = "A description for publish.";
    private readonly ApiFactory _factory;
    private readonly HttpClient _client;

    public SectionLinkTests(ApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    public static TheoryData<string> Refused => new()
    {
        "javascript:alert(document.domain)",
        "data:text/html,<script>alert(1)</script>",
        "vbscript:msgbox(1)",
        "JaVaScRiPt:alert(1)",
        "DATA:text/html,x",
        "java\tscript:alert(1)",
        " javascript:alert(1)",
        "java\nscript:alert(1)",
        "\u0001javascript:alert(1)",
        "&#106;avascript:alert(1)",
        "//evil.example/",
        "/\\evil.example",
        "file:///etc/passwd",
        "contact",
        "",
    };

    public static TheoryData<string> Accepted => new()
    {
        "https://www.digitalhubgroup.com/",
        "http://example.com/page",
        "mailto:sales@digitalhubgroup.com",
        "tel:+201555553064",
        "/contact",
        "/cases/nexthink-dex-bank",
        "/",
        "#cookie-settings",
    };

    [Fact]
    public void Every_link_field_of_every_section_is_checked()
    {
        var schemas = _factory.Services.GetRequiredService<SectionSchemaSet>();
        var types = new[]
        {
            "blog_list", "call_to_action", "case_cards", "contact_details", "delivery_flow", "faq", "feature_grid", "hero",
            "hub_hero", "industries", "logo_bar", "methodology", "news_carousel", "partner_focus", "partner_grid",
            "partner_overview", "pillars", "problem", "profile", "related_items", "rich_text", "service_cards",
            "service_hero", "stats", "team_grid", "timeline", "vacancy_list", "values",
        };
        var found = types
            .SelectMany(type => schemas.UrlPaths(type).Select(path => type + ":" + string.Join('/', path)))
            .Order(StringComparer.Ordinal)
            .ToList();
        Assert.Equal(
        [
            "blog_list:action/href",
            "call_to_action:action/href",
            "case_cards:action/href",
            "case_cards:items/*/action/href",
            "contact_details:channels/*/href",
            "hero:actions/*/href",
            "hero:back/href",
            "hero:logos/*/href",
            "news_carousel:action/href",
            "partner_grid:action/href",
            "partner_grid:items/*/action/href",
            "partner_overview:action/href",
            "service_cards:items/*/action/href",
            "service_hero:action/href",
        ], found);
    }

    [Theory]
    [MemberData(nameof(Refused))]
    public void A_dangerous_or_malformed_address_is_refused(string href) => Assert.False(SectionLinks.IsAllowed(href));

    [Theory]
    [MemberData(nameof(Accepted))]
    public void An_ordinary_address_is_accepted(string href) => Assert.True(SectionLinks.IsAllowed(href));

    [Theory]
    [MemberData(nameof(Refused))]
    public async Task Saving_a_call_to_action_with_a_refused_href_is_a_400(string href)
    {
        var (editor, page) = await NewPageAsync();
        var response = await AddCallToActionAsync(editor, page, href);
        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Contains(SectionLinks.Message, response.Body, StringComparison.Ordinal);
    }

    [Theory]
    [MemberData(nameof(Accepted))]
    public async Task Saving_a_call_to_action_with_an_ordinary_href_works(string href)
    {
        var (editor, page) = await NewPageAsync();
        Assert.Equal(HttpStatusCode.OK, (await AddCallToActionAsync(editor, page, href)).Status);
    }

    [Fact]
    public async Task A_nested_link_is_checked_too()
    {
        // contact_details holds a list of links (channels); one bad item is enough to refuse.
        var (editor, page) = await NewPageAsync();
        var response = await SendAsync(editor, HttpMethod.Post, $"/api/v1/pages/{page.Id}/sections", new
        {
            version = page.Version,
            type = "contact_details",
            fields = new
            {
                heading = "Reach us",
                channels = new object[]
                {
                    new { label = "Call", href = "tel:+201555553064" },
                    new { label = "Bad", href = "data:text/html,x" },
                },
                form = new { situationLabel = "Topic", buttonText = "Send", successMessage = "Thanks." },
            },
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Contains("/channels/1/href", response.Body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task A_page_whose_stored_link_is_bad_is_refused_at_publish()
    {
        var (editor, page) = await NewPageAsync();
        var added = await AddCallToActionAsync(editor, page, "/contact");
        Assert.Equal(HttpStatusCode.OK, added.Status);
        var version = JsonDocument.Parse(added.Body).RootElement.GetProperty("version").GetInt32();

        // A value the API refuses today but could already be stored: write it directly.
        await using (var scope = _factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            var section = await db.Sections.SingleAsync(item => item.PageId == page.Id && item.Type == "call_to_action");
            section.Fields = JsonSerializer.Serialize(new { heading = "Stored", action = new { label = "Open", href = "data:text/html,<script>alert(1)</script>" } });
            await db.SaveChangesAsync();
        }

        var publish = await SendAsync(editor, HttpMethod.Post, $"/api/v1/pages/{page.Id}/publish", new { version });
        Assert.Equal(HttpStatusCode.BadRequest, publish.Status);
        Assert.Equal("publish_blocked", JsonDocument.Parse(publish.Body).RootElement.GetProperty("code").GetString());
        Assert.Contains(SectionLinks.Message, publish.Body, StringComparison.Ordinal);

        // Put an ordinary external link back and the same page publishes. (A site path
        // would also need its page to exist: publish checks that separately.)
        await using (var scope = _factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            var section = await db.Sections.SingleAsync(item => item.PageId == page.Id && item.Type == "call_to_action");
            section.Fields = JsonSerializer.Serialize(new { heading = "Stored", action = new { label = "Open", href = "https://www.digitalhubgroup.com/" } });
            await db.SaveChangesAsync();
        }

        var republish = await SendAsync(editor, HttpMethod.Post, $"/api/v1/pages/{page.Id}/publish", new { version });
        Assert.True(republish.Status == HttpStatusCode.OK, republish.Body);
    }

    [Fact]
    public async Task A_full_save_with_a_bad_link_is_refused_and_stores_nothing()
    {
        var (editor, page) = await NewPageAsync();
        var save = await SendAsync(editor, HttpMethod.Put, $"/api/v1/pages/{page.Id}/save", new
        {
            version = page.Version,
            slug = page.Slug,
            title = "Coverage",
            metaDescription = Description,
            fields = new { },
            sections = new object[]
            {
                new { type = "call_to_action", visible = true, fields = new { heading = "Go", action = new { label = "Go", href = "javascript:alert(1)" } } },
            },
        });
        Assert.Equal(HttpStatusCode.BadRequest, save.Status);
        Assert.Contains(SectionLinks.Message, save.Body, StringComparison.Ordinal);

        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        Assert.False(await db.Sections.AnyAsync(item => item.PageId == page.Id));
    }

    private async Task<(AuthSession Editor, PageRef Page)> NewPageAsync()
    {
        var editor = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var slug = "link-" + Guid.NewGuid().ToString("N")[..10];
        var created = await SendAsync(editor, HttpMethod.Post, "/api/v1/pages", new { slug, title = "Coverage", metaDescription = Description });
        Assert.Equal(HttpStatusCode.Created, created.Status);
        var json = JsonDocument.Parse(created.Body).RootElement;
        return (editor, new PageRef(json.GetProperty("id").GetGuid(), slug, json.GetProperty("version").GetInt32()));
    }

    private Task<(HttpStatusCode Status, string Body)> AddCallToActionAsync(AuthSession editor, PageRef page, string href) =>
        SendAsync(editor, HttpMethod.Post, $"/api/v1/pages/{page.Id}/sections", new
        {
            version = page.Version,
            type = "call_to_action",
            fields = new { heading = "Next step", action = new { label = "Go", href } },
        });

    private async Task<(HttpStatusCode Status, string Body)> SendAsync(AuthSession session, HttpMethod method, string url, object? body = null)
    {
        var request = session.Authorized(method, url);
        if (body is not null)
            request.Content = JsonContent.Create(body);
        var response = await _client.SendAsync(request);
        return (response.StatusCode, await response.Content.ReadAsStringAsync());
    }

    private sealed record PageRef(Guid Id, string Slug, int Version);
}
