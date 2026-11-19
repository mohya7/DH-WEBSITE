using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace DigitalHub.PublicApi.Tests;

/// <summary>
/// ISO-2 (ADR 0001, point 1; refinement plan Track G2, "Done when"): the public
/// forms API answers only POST /api/v1/public/contact and POST /api/v1/public/apply.
/// T-R1 is its endpoint inventory, and so its role matrix: two anonymous POST
/// routes and nothing else. T-R2 proves every other path and method gets 404.
/// </summary>
[Collection("PublicFormsSql")]
public sealed class PublicRouteTests : IClassFixture<PublicApiFactory>
{
    private const string Contact = "/api/v1/public/contact";
    private const string Apply = "/api/v1/public/apply";
    private const string AnyGuid = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

    private static readonly HttpMethod[] Methods =
    [
        HttpMethod.Get, HttpMethod.Head, HttpMethod.Post, HttpMethod.Put, HttpMethod.Patch, HttpMethod.Delete, HttpMethod.Options,
    ];

    private readonly PublicApiFactory _factory;
    private readonly HttpClient _client;

    public PublicRouteTests(PublicApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public void Only_the_two_form_routes_are_mapped()
    {
        var endpoints = _factory.Services.GetRequiredService<EndpointDataSource>().Endpoints;

        Assert.Equal(2, endpoints.Count);
        var routes = endpoints.Select(endpoint => Assert.IsType<RouteEndpoint>(endpoint))
            .OrderBy(endpoint => endpoint.RoutePattern.RawText, StringComparer.Ordinal)
            .ToList();
        Assert.Equal(new[] { "api/v1/public/apply", "api/v1/public/contact" }, routes.Select(route => route.RoutePattern.RawText));
        foreach (var route in routes)
        {
            var methods = route.Metadata.GetMetadata<IHttpMethodMetadata>();
            Assert.NotNull(methods);
            Assert.Equal(new[] { "POST" }, methods.HttpMethods);
        }
    }

    [Fact]
    public async Task Every_other_path_and_method_returns_404()
    {
        var mismatches = new List<string>();

        foreach (var path in OtherPaths())
        {
            foreach (var method in Methods)
                await ExpectNotFoundAsync(method, path, mismatches);
        }

        foreach (var path in new[] { Contact, Apply, Contact.ToUpperInvariant(), Apply.ToUpperInvariant() })
        {
            foreach (var method in Methods.Where(method => method != HttpMethod.Post))
                await ExpectNotFoundAsync(method, path, mismatches);
        }

        // Positive controls: the two routes themselves are not 404.
        var contact = await _client.SendAsync(Request(HttpMethod.Post, Contact));
        var contactBody = await contact.Content.ReadAsStringAsync();
        if (contact.StatusCode != HttpStatusCode.BadRequest || Code(contactBody) != "validation_failed")
            mismatches.Add($"control POST {Contact} {{}}: {(int)contact.StatusCode} {Code(contactBody) ?? "(no code)"}, expected 400 validation_failed");

        var upper = await _client.SendAsync(Request(HttpMethod.Post, Contact.ToUpperInvariant()));
        if (upper.StatusCode != HttpStatusCode.BadRequest)
            mismatches.Add($"control POST {Contact.ToUpperInvariant()} {{}}: {(int)upper.StatusCode}, expected 400");

        var apply = await _client.SendAsync(new HttpRequestMessage(HttpMethod.Post, Apply));
        var applyBody = await apply.Content.ReadAsStringAsync();
        if (apply.StatusCode != HttpStatusCode.BadRequest || !applyBody.Contains("<!DOCTYPE html>", StringComparison.Ordinal))
            mismatches.Add($"control POST {Apply} (no form): {(int)apply.StatusCode} {apply.Content.Headers.ContentType?.MediaType ?? "(no type)"}, expected 400 and the HTML page");

        Assert.True(mismatches.Count == 0, mismatches.Count + " mismatches:\n" + string.Join('\n', mismatches));
    }

    private async Task ExpectNotFoundAsync(HttpMethod method, string path, List<string> mismatches)
    {
        using var response = await _client.SendAsync(Request(method, path));
        var body = await response.Content.ReadAsStringAsync();
        var problems = new List<string>();
        if (response.StatusCode != HttpStatusCode.NotFound)
            problems.Add("status " + (int)response.StatusCode);
        if (method != HttpMethod.Head)
        {
            var type = response.Content.Headers.ContentType?.MediaType;
            if (type != "application/problem+json")
                problems.Add("type " + (type ?? "(none)"));
            else if (Code(body) != "not_found")
                problems.Add("code " + (Code(body) ?? "(none)"));
        }

        // Allow is a content header in HttpClient's model.
        if (response.Content.Headers.Allow.Count > 0)
            problems.Add("Allow " + string.Join(",", response.Content.Headers.Allow));
        if (response.Headers.Contains("Set-Cookie"))
            problems.Add("Set-Cookie");
        if (problems.Count > 0)
            mismatches.Add($"{method} {path}: {string.Join("; ", problems)}");
    }

    private static HttpRequestMessage Request(HttpMethod method, string path)
    {
        var request = new HttpRequestMessage(method, path);
        if (method == HttpMethod.Post)
            request.Content = new StringContent("{}", Encoding.UTF8, "application/json");
        return request;
    }

    private static string? Code(string body)
    {
        if (!body.TrimStart().StartsWith('{'))
            return null;
        try
        {
            using var document = JsonDocument.Parse(body);
            return document.RootElement.TryGetProperty("code", out var code) && code.ValueKind == JsonValueKind.String ? code.GetString() : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static IEnumerable<string> OtherPaths()
    {
        // Outside the API.
        string[] outside =
        [
            "/", "/index.html", "/health", "/healthz", "/metrics", "/swagger", "/swagger/index.html",
            "/openapi/v1.json", "/favicon.ico", "/web.config", "/media/x.webp",
        ];

        // Near the form routes.
        string[] near =
        [
            "/api", "/api/v1", "/api/v1/public", "/api/v1/public/", "/api/v1/public/contact/", "/api/v1/public/apply/",
            "/api/v1/public/contact/1", "/api/v1/public/apply/extra", "/api/v1/public/contacts", "/api/v1/public/applyx",
            "/api/v1/public/contact.json", "/api/v2/public/contact",
        ];

        // One concrete path for every admin route template.
        var page = "/api/v1/pages/" + AnyGuid;
        string[] admin =
        [
            "/api/v1/auth/login", "/api/v1/auth/refresh", "/api/v1/auth/logout", "/api/v1/auth/me", "/api/v1/auth/change-password",
            "/api/v1/build/content",
            "/api/v1/pages", "/api/v1/services", "/api/v1/partners", "/api/v1/case-studies", "/api/v1/blog-posts",
            "/api/v1/vacancies", "/api/v1/team-members", "/api/v1/news-items",
            "/api/v1/pages/order", page, page + "/save", page + "/publish", page + "/unpublish", page + "/discard", page + "/end",
            page + "/sections", page + "/sections/reorder", page + "/sections/" + AnyGuid, page + "/sections/" + AnyGuid + "/visibility",
            page + "/revisions", page + "/revisions/" + AnyGuid, page + "/revisions/" + AnyGuid + "/restore",
            "/api/v1/media", "/api/v1/media/" + AnyGuid,
            "/api/v1/users", "/api/v1/users/x/role", "/api/v1/users/x/reactivate", "/api/v1/users/x/deactivate", "/api/v1/users/x/reset-password",
            "/api/v1/settings", "/api/v1/settings/x", "/api/v1/navigation", "/api/v1/redirects", "/api/v1/redirects/" + AnyGuid,
            "/api/v1/error-pages", "/api/v1/error-pages/404",
            "/api/v1/audit",
            "/api/v1/contact-requests", "/api/v1/contact-requests/new-count", "/api/v1/contact-requests/" + AnyGuid,
            "/api/v1/contact-requests/" + AnyGuid + "/handled",
            "/api/v1/applications", "/api/v1/schemas", "/api/v1/rich-text/paste",
        ];

        // Generated paths: 50 paths of 1 to 5 lower-case segments, from a fixed seed.
        var random = new Random(20261119);
        var generated = new List<string>();
        while (generated.Count < 50)
        {
            var segments = Enumerable.Range(0, random.Next(1, 6))
                .Select(_ => new string(Enumerable.Range(0, random.Next(1, 9)).Select(_ => (char)('a' + random.Next(26))).ToArray()));
            var path = "/" + string.Join('/', segments);
            if (string.Equals(path, Contact, StringComparison.OrdinalIgnoreCase) || string.Equals(path, Apply, StringComparison.OrdinalIgnoreCase))
                continue;
            generated.Add(path);
        }

        return outside.Concat(near).Concat(admin).Concat(generated);
    }
}
