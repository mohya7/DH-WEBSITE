using System.Net;
using System.Net.Http.Json;
using DigitalHub.PublicApi.Data;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace DigitalHub.PublicApi.Tests;

/// <summary>
/// ISO-2 (ADR 0001, points 1 and 4): no authentication, no Identity, no signing
/// key, start-up fails closed, and the context maps only the four tables.
/// </summary>
[Collection("PublicFormsSql")]
public sealed class PublicApiIsolationTests
{
    private static readonly string[] ForbiddenServicePrefixes =
    [
        "Microsoft.AspNetCore.Identity",
        "Microsoft.Extensions.Identity",
        "Microsoft.AspNetCore.Authentication.JwtBearer",
        "Microsoft.AspNetCore.Authentication.BearerToken",
        "Microsoft.AspNetCore.Authentication.Cookies",
    ];

    [Fact]
    public async Task The_public_api_registers_no_authentication_scheme_or_identity()
    {
        // Control: the same checks reject a collection that has a scheme.
        var control = new ServiceCollection();
        control.AddLogging();
        control.AddAuthentication().AddBearerToken();
        await using (var controlProvider = control.BuildServiceProvider())
        {
            Assert.NotEmpty(await ViolationsAsync(control, controlProvider, endpoints: null));
        }

        await using var factory = new RecordingFactory();
        _ = factory.Services;
        var endpoints = factory.Services.GetService<EndpointDataSource>();
        Assert.Empty(await ViolationsAsync(factory.Descriptors, factory.Services, endpoints));
    }

    [Fact]
    public void The_public_api_holds_no_signing_key()
    {
        using var factory = new PublicApiFactory();
        var configuration = factory.Services.GetRequiredService<IConfiguration>();

        Assert.False(configuration.GetSection("Auth").Exists());
        Assert.Null(configuration["Auth:SigningKey"]);
    }

    [Fact]
    public void The_public_api_refuses_to_start_with_auth_settings()
    {
        using var factory = new SettingFactory("Auth:SigningKey", "x");
        var exception = Record.Exception(() => factory.CreateClient());

        Assert.NotNull(exception);
        Assert.Contains("The public forms API must not be given Auth settings (ADR 0001).", Messages(exception));
    }

    [Fact]
    public void The_public_api_refuses_to_start_without_its_connection_string()
    {
        using var factory = new SettingFactory("ConnectionStrings:PublicForms", "");
        var exception = Record.Exception(() => factory.CreateClient());

        Assert.NotNull(exception);
        Assert.Contains("ConnectionStrings:PublicForms is not configured.", Messages(exception));
    }

    [Fact]
    public async Task The_public_api_starts_under_the_development_host_checks()
    {
        // Development turns on scope validation and ValidateOnBuild, and would load
        // a user-secrets store if the public API had one (T-I3 would then refuse it).
        await using var factory = new DevelopmentFactory();
        var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/v1/public/contact", new { });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public void The_forms_context_maps_only_the_four_tables()
    {
        using var factory = new PublicApiFactory();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PublicFormsDbContext>();
        var entities = db.Model.GetEntityTypes().ToList();

        Assert.Equal(
            new[] { "application_counts", "contact_requests", "site_settings", "vacancies" },
            entities.Select(entity => entity.GetTableName()).OrderBy(name => name, StringComparer.Ordinal));
        Assert.All(entities, entity =>
        {
            Assert.Empty(entity.GetNavigations());
            Assert.Empty(entity.GetSkipNavigations());
            Assert.Empty(entity.GetForeignKeys());
        });
        var contact = db.Model.FindEntityType(typeof(ContactRequest))!;
        Assert.All(contact.GetProperties(), property => Assert.Equal(Microsoft.EntityFrameworkCore.Metadata.ValueGenerated.Never, property.ValueGenerated));
    }

    [Fact]
    public void The_public_api_has_no_migrations()
    {
        var types = typeof(PublicFormsDbContext).Assembly.GetTypes();

        Assert.DoesNotContain(types, type => typeof(Migration).IsAssignableFrom(type));
        Assert.DoesNotContain(types, type => typeof(ModelSnapshot).IsAssignableFrom(type));
    }

    /// <summary>What T-I1 rejects: a scheme, a handler, an Identity or token service, a fallback policy, endpoint authorization.</summary>
    private static async Task<List<string>> ViolationsAsync(IEnumerable<ServiceDescriptor> descriptors, IServiceProvider services, EndpointDataSource? endpoints)
    {
        var violations = new List<string>();

        var schemes = services.GetService<IAuthenticationSchemeProvider>();
        if (schemes is not null)
        {
            foreach (var scheme in await schemes.GetAllSchemesAsync())
                violations.Add("scheme " + scheme.Name);
        }

        foreach (var descriptor in descriptors)
        {
            var implementation = descriptor.IsKeyedService
                ? descriptor.KeyedImplementationType ?? descriptor.KeyedImplementationInstance?.GetType()
                : descriptor.ImplementationType ?? descriptor.ImplementationInstance?.GetType();
            foreach (var type in new[] { descriptor.ServiceType, implementation })
            {
                if (type is null)
                    continue;
                if (typeof(IAuthenticationHandler).IsAssignableFrom(type))
                    violations.Add("handler " + type.FullName);
                var name = type.FullName ?? type.Name;
                if (ForbiddenServicePrefixes.Any(prefix => name.StartsWith(prefix, StringComparison.Ordinal)))
                    violations.Add("service " + name);
            }
        }

        var authorization = services.GetService<IOptions<AuthorizationOptions>>();
        if (authorization?.Value.FallbackPolicy is not null)
            violations.Add("fallback policy");

        if (endpoints is not null)
        {
            foreach (var endpoint in endpoints.Endpoints)
            {
                if (endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>().Count > 0
                    || endpoint.Metadata.GetOrderedMetadata<IAuthorizationRequirementData>().Count > 0)
                    violations.Add("authorization metadata on " + endpoint.DisplayName);
            }
        }

        return violations;
    }

    private static string Messages(Exception exception)
    {
        var messages = new List<string>();
        var pending = new Stack<Exception>([exception]);
        while (pending.Count > 0)
        {
            var current = pending.Pop();
            messages.Add(current.Message);
            if (current is AggregateException aggregate)
            {
                foreach (var inner in aggregate.InnerExceptions)
                    pending.Push(inner);
            }
            else if (current.InnerException is not null)
            {
                pending.Push(current.InnerException);
            }
        }

        return string.Join('\n', messages);
    }

    /// <summary>Records the final service collection, after Program.cs registered everything.</summary>
    private sealed class RecordingFactory : PublicApiFactory
    {
        public List<ServiceDescriptor> Descriptors { get; } = [];

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.ConfigureTestServices(services => Descriptors.AddRange(services));
        }
    }

    private sealed class SettingFactory(string key, string value) : PublicApiFactory
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.UseSetting(key, value);
        }
    }

    private sealed class DevelopmentFactory : PublicApiFactory
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.UseEnvironment("Development");
        }
    }
}
