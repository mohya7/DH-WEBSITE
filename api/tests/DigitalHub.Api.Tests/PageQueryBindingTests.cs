using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DigitalHub.Api.Conventions;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.Extensions.DependencyInjection;

namespace DigitalHub.Api.Tests;

/// <summary>
/// ADM-06: <c>[FromQuery] PageQuery page</c> made <c>page</c> a binding prefix, so
/// <c>?page=2&amp;pageSize=5</c> returned page 1 of 20 and the [Range] limits were
/// never checked. These tests need no database.
/// </summary>
[Collection("SqlServer")]
public sealed class PageQueryBindingTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    private readonly HttpClient _client;

    public PageQueryBindingTests(ApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public void Every_paged_list_binds_page_and_page_size_from_the_query_root()
    {
        var actions = _factory.Services.GetRequiredService<IActionDescriptorCollectionProvider>().ActionDescriptors.Items;
        var metadata = _factory.Services.GetRequiredService<IModelMetadataProvider>();
        var typeName = metadata.GetMetadataForType(typeof(PageQuery)).BinderModelName;

        var paged = actions
            .OfType<ControllerActionDescriptor>()
            .Where(action => action.ControllerTypeInfo.Assembly == typeof(PageQuery).Assembly)
            .SelectMany(action => action.Parameters
                .Where(parameter => parameter.ParameterType == typeof(PageQuery))
                .Select(parameter => (
                    Action: action.ControllerTypeInfo.Name + "." + action.MethodInfo.Name,
                    ModelName: parameter.BindingInfo?.BinderModelName ?? typeName)))
            .OrderBy(item => item.Action, StringComparer.Ordinal)
            .ToList();

        // The exact set, so the test cannot pass with no paged actions found, and a
        // new paged list has to be added here on purpose.
        Assert.Equal(
            [
                "AuditController.List",
                "ContactRequestsController.List",
                "ContentController.List",
                "MediaController.List",
                "RedirectsController.List",
            ],
            paged.Select(item => item.Action).ToList());

        var notFromRoot = paged
            .Where(item => item.ModelName != "")
            .Select(item => item.Action + " (model name: " + (item.ModelName is null ? "<null>" : "'" + item.ModelName + "'") + ")")
            .ToList();
        Assert.Empty(notFromRoot);
    }

    [Fact]
    public async Task Page_two_returns_the_second_slice_with_the_requested_size()
    {
        for (var i = 0; i < 5; i++)
        {
            var created = await _client.PostAsJsonAsync("/api/v1/examples/notes", new { name = $"Adm06 {i}" });
            Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        }

        var all = await _client.GetAsync("/api/v1/examples/notes?page=1&pageSize=100");
        Assert.Equal(HttpStatusCode.OK, all.StatusCode);
        var allIds = Ids(await all.Content.ReadAsStringAsync());

        var response = await _client.GetAsync("/api/v1/examples/notes?page=2&pageSize=2");
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = JsonDocument.Parse(body).RootElement;
        Assert.Equal(2, json.GetProperty("page").GetInt32());
        Assert.Equal(2, json.GetProperty("pageSize").GetInt32());
        Assert.Equal(2, json.GetProperty("items").GetArrayLength());
        Assert.True(allIds.Count >= 5, "Page 1 of size 100 returned " + allIds.Count + " notes, expected at least 5.");
        Assert.Equal(allIds.Skip(2).Take(2).ToList(), Ids(body));
    }

    [Theory]
    [InlineData("page=0&pageSize=5", "Page")]
    [InlineData("page=2&pageSize=101", "PageSize")]
    [InlineData("page=10001", "Page")]
    [InlineData("pageSize=0", "PageSize")]
    public async Task Out_of_range_page_or_page_size_is_rejected(string query, string field)
    {
        var response = await _client.GetAsync("/api/v1/examples/notes?" + query);
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = JsonDocument.Parse(body).RootElement.GetProperty("errors");
        Assert.True(errors.TryGetProperty(field, out _), "Expected an errors." + field + " entry in: " + body);
    }

    private static List<string> Ids(string body) =>
        JsonDocument.Parse(body).RootElement.GetProperty("items").EnumerateArray()
            .Select(item => item.GetProperty("id").GetString()!)
            .ToList();
}
