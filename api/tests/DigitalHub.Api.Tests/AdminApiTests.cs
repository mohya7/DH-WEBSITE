using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using DigitalHub.Api.Content;
using DigitalHub.Api.Data;
using DigitalHub.Api.Infrastructure;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Serilog;
using Serilog.Core;
using Serilog.Events;

namespace DigitalHub.Api.Tests;

[Collection("SqlServer")]
public sealed class AdminApiTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    private readonly HttpClient _client;

    public AdminApiTests(ApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Navigation_limits_nesting_to_one_level_and_reordering_saves()
    {
        var admin = await AdminAsync();
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var page = await SendAsync(admin, HttpMethod.Post, "/api/v1/pages", new
        {
            slug = "nav-target-" + suffix,
            title = "Nav target",
            metaDescription = "A page used as a navigation target for nesting and reorder checks.",
        });
        Assert.Equal(HttpStatusCode.Created, page.Status);
        var pageId = JsonDocument.Parse(page.Body).RootElement.GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.OK, (await SendAsync(admin, HttpMethod.Post, "/api/v1/pages/" + pageId + "/publish", new { version = 1 })).Status);

        var deep = await SendAsync(admin, HttpMethod.Put, "/api/v1/navigation", new
        {
            menu = "header",
            items = new object[]
            {
                new
                {
                    label = "Too deep",
                    linkKind = "group",
                    children = new object[]
                    {
                        new
                        {
                            label = "Child",
                            linkKind = "group",
                            children = new object[]
                            {
                                new { label = "Grandchild", linkKind = "external", url = "https://example.com/" },
                            },
                        },
                    },
                },
            },
        });
        Assert.Equal(HttpStatusCode.BadRequest, deep.Status);
        Assert.Equal("validation_failed", Code(deep.Body));

        var parentId = Guid.NewGuid();
        var firstId = Guid.NewGuid();
        var secondId = Guid.NewGuid();
        var payload = $$"""
            {
              "menu": "header",
              "items": [
                {
                  "id": "{{parentId}}",
                  "label": "Group {{suffix}}",
                  "linkKind": "group",
                  "children": [
                    {
                      "id": "{{firstId}}",
                      "label": "First",
                      "linkKind": "internal",
                      "targetType": "page",
                      "targetId": "{{pageId}}"
                    },
                    {
                      "id": "{{secondId}}",
                      "label": "Second",
                      "linkKind": "external",
                      "url": "https://example.com/{{suffix}}"
                    }
                  ]
                }
              ]
            }
            """;
        var saved = await SendRawAsync(admin, HttpMethod.Put, "/api/v1/navigation", payload);
        Assert.Equal(HttpStatusCode.OK, saved.Status);
        Assert.True(
            JsonDocument.Parse(saved.Body).RootElement.GetProperty("items")[0].GetProperty("children").GetArrayLength() == 2,
            saved.Body);

        var reorderPayload = $$"""
            {
              "menu": "header",
              "items": [
                {
                  "id": "{{parentId}}",
                  "label": "Group {{suffix}}",
                  "linkKind": "group",
                  "children": [
                    {
                      "id": "{{secondId}}",
                      "label": "Second",
                      "linkKind": "external",
                      "url": "https://example.com/{{suffix}}"
                    },
                    {
                      "id": "{{firstId}}",
                      "label": "First",
                      "linkKind": "internal",
                      "targetType": "page",
                      "targetId": "{{pageId}}"
                    }
                  ]
                }
              ]
            }
            """;
        var reordered = await SendRawAsync(admin, HttpMethod.Put, "/api/v1/navigation", reorderPayload);
        Assert.Equal(HttpStatusCode.OK, reordered.Status);
        var children = JsonDocument.Parse(reordered.Body).RootElement.GetProperty("items")[0].GetProperty("children");
        Assert.Equal(2, children.GetArrayLength());
        Assert.Equal("Second", children[0].GetProperty("label").GetString());
        Assert.Equal("First", children[1].GetProperty("label").GetString());

        await SendAsync(admin, HttpMethod.Put, "/api/v1/navigation", new { menu = "header", items = Array.Empty<object>() });
        var unpublished = await SendAsync(admin, HttpMethod.Post, "/api/v1/pages/" + pageId + "/unpublish", new { version = 2 });
        Assert.Equal(HttpStatusCode.OK, unpublished.Status);
        var version = JsonDocument.Parse(unpublished.Body).RootElement.GetProperty("version").GetInt32();
        Assert.Equal(HttpStatusCode.NoContent, (await SendAsync(admin, HttpMethod.Delete, "/api/v1/pages/" + pageId + "?version=" + version)).Status);
    }

    [Fact]
    public async Task Settings_validation_rejects_bad_email_phone_social_and_gtm()
    {
        var admin = await AdminAsync();
        await EnsureSettingsAsync();
        var current = await SendAsync(admin, HttpMethod.Get, "/api/v1/settings");
        Assert.Equal(HttpStatusCode.OK, current.Status);
        var settings = JsonDocument.Parse(current.Body).RootElement;
        var payload = SettingsPayload(settings);

        payload["email"] = "not-an-email";
        Assert.Equal(HttpStatusCode.BadRequest, (await SendAsync(admin, HttpMethod.Put, "/api/v1/settings", payload)).Status);

        payload["email"] = settings.TryGetProperty("email", out var email) ? email.GetString() : null;
        payload["phone"] = "abc";
        Assert.Equal(HttpStatusCode.BadRequest, (await SendAsync(admin, HttpMethod.Put, "/api/v1/settings", payload)).Status);

        payload["phone"] = settings.TryGetProperty("phone", out var phone) ? phone.GetString() : null;
        payload["linkedIn"] = "http://linkedin.com/company/digitalhub";
        Assert.Equal(HttpStatusCode.BadRequest, (await SendAsync(admin, HttpMethod.Put, "/api/v1/settings", payload)).Status);

        payload["linkedIn"] = settings.TryGetProperty("linkedIn", out var linkedIn) ? linkedIn.GetString() : null;
        payload["analyticsContainerId"] = "GTM-SHORT";
        Assert.Equal(HttpStatusCode.BadRequest, (await SendAsync(admin, HttpMethod.Put, "/api/v1/settings", payload)).Status);
    }

    [Fact]
    public async Task Settings_read_returns_defaults_when_no_row_exists_and_never_writes()
    {
        var admin = await AdminAsync();
        await ClearSettingsAsync();

        var empty = await SendAsync(admin, HttpMethod.Get, "/api/v1/settings");
        Assert.Equal(HttpStatusCode.OK, empty.Status);
        var body = JsonDocument.Parse(empty.Body).RootElement;
        Assert.Equal(JsonValueKind.Null, body.GetProperty("email").ValueKind);
        Assert.Equal(JsonValueKind.Null, body.GetProperty("organizationName").ValueKind);

        // Reading, twice, must not create the row.
        Assert.Equal(HttpStatusCode.OK, (await SendAsync(admin, HttpMethod.Get, "/api/v1/settings")).Status);
        Assert.Equal(0, await CountSettingsAsync());
    }

    [Fact]
    public async Task Settings_first_save_creates_the_row_and_later_saves_update_it()
    {
        var admin = await AdminAsync();
        await ClearSettingsAsync();

        var created = await SendAsync(admin, HttpMethod.Put, "/api/v1/settings", new
        {
            version = 0,
            email = "first@digitalhub.test",
            organizationName = "Digital Hub",
        });
        Assert.Equal(HttpStatusCode.OK, created.Status);
        Assert.Equal(1, await CountSettingsAsync());
        Assert.Equal("first@digitalhub.test", JsonDocument.Parse(created.Body).RootElement.GetProperty("email").GetString());

        var reread = await SendAsync(admin, HttpMethod.Get, "/api/v1/settings");
        Assert.Equal("first@digitalhub.test", JsonDocument.Parse(reread.Body).RootElement.GetProperty("email").GetString());

        // A second save updates that row rather than adding another.
        var updated = await SendAsync(admin, HttpMethod.Put, "/api/v1/settings", new
        {
            version = JsonDocument.Parse(created.Body).RootElement.GetProperty("version").GetInt32(),
            email = "second@digitalhub.test",
            organizationName = "Digital Hub",
        });
        Assert.Equal(HttpStatusCode.OK, updated.Status);
        Assert.Equal(1, await CountSettingsAsync());
        Assert.Equal("second@digitalhub.test", JsonDocument.Parse(updated.Body).RootElement.GetProperty("email").GetString());
    }

    [Fact]
    public async Task Editor_is_forbidden_on_settings_write_users_and_audit()
    {
        var editor = await EditorAsync();
        Assert.Equal(HttpStatusCode.Forbidden, (await SendAsync(editor, HttpMethod.Put, "/api/v1/settings", new { email = "a@b.com" })).Status);
        Assert.Equal(HttpStatusCode.Forbidden, (await SendAsync(editor, HttpMethod.Get, "/api/v1/users")).Status);
        Assert.Equal(HttpStatusCode.Forbidden, (await SendAsync(editor, HttpMethod.Get, "/api/v1/audit")).Status);
    }

    [Fact]
    public async Task Redirect_refuses_loops_collapses_chains_and_blocks_live_paths()
    {
        var admin = await AdminAsync();
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var page = await SendAsync(admin, HttpMethod.Post, "/api/v1/pages", new
        {
            slug = "live-path-" + suffix,
            title = "Live path",
            metaDescription = "A published page that occupies a public path.",
        });
        Assert.Equal(HttpStatusCode.Created, page.Status);
        var pageId = JsonDocument.Parse(page.Body).RootElement.GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.OK, (await SendAsync(admin, HttpMethod.Post, "/api/v1/pages/" + pageId + "/publish", new { version = 1 })).Status);

        var live = await SendAsync(admin, HttpMethod.Post, "/api/v1/redirects", new
        {
            fromPath = "/live-path-" + suffix,
            toPath = "/elsewhere-" + suffix,
        });
        Assert.Equal(HttpStatusCode.BadRequest, live.Status);
        Assert.Equal("redirect_live_path", Code(live.Body));

        var first = await SendAsync(admin, HttpMethod.Post, "/api/v1/redirects", new
        {
            fromPath = "/old-a-" + suffix,
            toPath = "/old-b-" + suffix,
        });
        Assert.Equal(HttpStatusCode.Created, first.Status);

        var loop = await SendAsync(admin, HttpMethod.Post, "/api/v1/redirects", new
        {
            fromPath = "/old-b-" + suffix,
            toPath = "/old-a-" + suffix,
        });
        Assert.Equal(HttpStatusCode.BadRequest, loop.Status);
        Assert.Equal("redirect_loop", Code(loop.Body));

        var chain = await SendAsync(admin, HttpMethod.Post, "/api/v1/redirects", new
        {
            fromPath = "/old-c-" + suffix,
            toPath = "/old-a-" + suffix,
        });
        Assert.Equal(HttpStatusCode.Created, chain.Status);
        Assert.Equal("/old-b-" + suffix, JsonDocument.Parse(chain.Body).RootElement.GetProperty("toPath").GetString());

        var aId = JsonDocument.Parse(first.Body).RootElement.GetProperty("id").GetGuid();
        var cId = JsonDocument.Parse(chain.Body).RootElement.GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.NoContent, (await SendAsync(admin, HttpMethod.Delete, "/api/v1/redirects/" + aId)).Status);
        Assert.Equal(HttpStatusCode.NoContent, (await SendAsync(admin, HttpMethod.Delete, "/api/v1/redirects/" + cId)).Status);
        var unpublished = await SendAsync(admin, HttpMethod.Post, "/api/v1/pages/" + pageId + "/unpublish", new { version = 2 });
        Assert.Equal(HttpStatusCode.OK, unpublished.Status);
        var version = JsonDocument.Parse(unpublished.Body).RootElement.GetProperty("version").GetInt32();
        Assert.Equal(HttpStatusCode.NoContent, (await SendAsync(admin, HttpMethod.Delete, "/api/v1/pages/" + pageId + "?version=" + version)).Status);
    }

    [Fact]
    public async Task Users_enforce_roles_password_length_self_and_last_admin_and_revoke_sessions()
    {
        var admin = await AdminAsync();
        var suffix = Guid.NewGuid().ToString("N")[..8];

        var badRole = await SendAsync(admin, HttpMethod.Post, "/api/v1/users", new
        {
            email = "viewer-" + suffix + "@digitalhub.test",
            role = "viewer",
            password = "Long-Enough-Pass1!",
        });
        Assert.Equal(HttpStatusCode.BadRequest, badRole.Status);

        var shortPassword = await SendAsync(admin, HttpMethod.Post, "/api/v1/users", new
        {
            email = "short-" + suffix + "@digitalhub.test",
            role = "editor",
            password = "TooShort1!",
        });
        Assert.Equal(HttpStatusCode.BadRequest, shortPassword.Status);

        var created = await SendAsync(admin, HttpMethod.Post, "/api/v1/users", new
        {
            email = "session-" + suffix + "@digitalhub.test",
            role = "editor",
            password = "Session-Passw0rd!",
        });
        Assert.Equal(HttpStatusCode.Created, created.Status);
        var userId = JsonDocument.Parse(created.Body).RootElement.GetProperty("id").GetString();
        var session = await AuthSession.LoginAsync(_client, "session-" + suffix + "@digitalhub.test", "Session-Passw0rd!");
        Assert.Equal(HttpStatusCode.OK, session.Status);

        using (var scope = _factory.Services.CreateScope())
        {
            var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var me = await users.FindByEmailAsync(ApiFactory.AdminEmail);
            Assert.NotNull(me);
            var self = await SendAsync(admin, HttpMethod.Post, "/api/v1/users/" + me.Id + "/deactivate");
            Assert.Equal(HttpStatusCode.BadRequest, self.Status);
            Assert.Equal("cannot_deactivate_self", Code(self.Body));
        }

        var deactivated = await SendAsync(admin, HttpMethod.Post, "/api/v1/users/" + userId + "/deactivate");
        Assert.Equal(HttpStatusCode.OK, deactivated.Status);
        var refresh = await _client.SendAsync(session.RefreshRequest());
        Assert.Equal(HttpStatusCode.Unauthorized, refresh.StatusCode);

        var secondAdmin = await SendAsync(admin, HttpMethod.Post, "/api/v1/users", new
        {
            email = "second-admin-" + suffix + "@digitalhub.test",
            role = "admin",
            password = "Second-Admin-Pass1!",
        });
        Assert.Equal(HttpStatusCode.Created, secondAdmin.Status);
        var secondId = JsonDocument.Parse(secondAdmin.Body).RootElement.GetProperty("id").GetString();

        string primaryAdminId;
        using (var scope = _factory.Services.CreateScope())
        {
            var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            primaryAdminId = (await users.FindByEmailAsync(ApiFactory.AdminEmail))!.Id;
            foreach (var extra in await users.GetUsersInRoleAsync("admin"))
            {
                if (extra.Id == primaryAdminId || extra.Id == secondId)
                    continue;
                extra.LockoutEnabled = true;
                extra.LockoutEnd = DateTimeOffset.MaxValue;
                Assert.True((await users.UpdateAsync(extra)).Succeeded);
            }
        }

        var secondSession = await AuthSession.LoginAsync(_client, "second-admin-" + suffix + "@digitalhub.test", "Second-Admin-Pass1!");
        Assert.Equal(HttpStatusCode.OK, secondSession.Status);
        Assert.Equal(HttpStatusCode.OK, (await SendAsync(secondSession, HttpMethod.Post, "/api/v1/users/" + primaryAdminId + "/deactivate")).Status);

        // The deactivated admin's token is refused on its next request (finding M2),
        // so through the API the last active admin can only be asked to deactivate
        // themselves. The last-admin guard is still the store's to enforce.
        var last = await SendAsync(admin, HttpMethod.Post, "/api/v1/users/" + secondId + "/deactivate");
        Assert.Equal(HttpStatusCode.Unauthorized, last.Status);
        using (var scope = _factory.Services.CreateScope())
        {
            var store = scope.ServiceProvider.GetRequiredService<AdminStore>();
            var outcome = await store.DeactivateUserAsync(secondId!, primaryAdminId, CancellationToken.None);
            Assert.Equal(StatusCodes.Status400BadRequest, outcome.Status);
            Assert.Equal("last_admin", outcome.Code);
        }

        await EnsurePrimaryAdminActiveAsync();
    }

    [Fact]
    public async Task Temporary_password_does_not_appear_in_application_logs()
    {
        var admin = await AdminAsync();
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var created = await SendAsync(admin, HttpMethod.Post, "/api/v1/users", new
        {
            email = "temp-" + suffix + "@digitalhub.test",
            role = "editor",
            password = "Initial-Passw0rd!",
        });
        Assert.Equal(HttpStatusCode.Created, created.Status);
        var userId = JsonDocument.Parse(created.Body).RootElement.GetProperty("id").GetString();

        var reset = await SendAsync(admin, HttpMethod.Post, "/api/v1/users/" + userId + "/reset-password");
        Assert.Equal(HttpStatusCode.OK, reset.Status);
        var temporary = JsonDocument.Parse(reset.Body).RootElement.GetProperty("temporaryPassword").GetString();
        Assert.False(string.IsNullOrWhiteSpace(temporary));
        Assert.True(temporary!.Length >= 12);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            var entry = await db.AuditLog.AsNoTracking()
                .Where(item => item.Action == "reset_password" && item.EntityId == userId)
                .OrderByDescending(item => item.At)
                .FirstAsync();
            Assert.DoesNotContain(temporary, entry.Detail ?? "", StringComparison.Ordinal);
        }

        var sink = new CollectingSink();
        using var logger = new LoggerConfiguration()
            .Destructure.With<SensitiveDestructuringPolicy>()
            .WriteTo.Sink(sink)
            .CreateLogger();
        logger.Information("Password reset response {@Result}", new { id = userId, temporaryPassword = temporary });
        var rendered = string.Join('\n', sink.Lines);
        Assert.DoesNotContain(temporary, rendered, StringComparison.Ordinal);
        Assert.Contains("[redacted]", rendered, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Audit_filters_by_user_action_content_type_and_date()
    {
        var admin = await AdminAsync();
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var before = DateTime.UtcNow.AddSeconds(-2);
        var created = await SendAsync(admin, HttpMethod.Post, "/api/v1/pages", new { slug = "audit-" + suffix, title = "Audit page" });
        Assert.Equal(HttpStatusCode.Created, created.Status);
        var pageId = JsonDocument.Parse(created.Body).RootElement.GetProperty("id").GetGuid();
        var after = DateTime.UtcNow.AddSeconds(2);

        string? adminId;
        using (var scope = _factory.Services.CreateScope())
        {
            var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            adminId = (await users.FindByEmailAsync(ApiFactory.AdminEmail))!.Id;
        }

        var byUser = await SendAsync(admin, HttpMethod.Get, "/api/v1/audit?userId=" + Uri.EscapeDataString(adminId!) + "&pageSize=100");
        Assert.Equal(HttpStatusCode.OK, byUser.Status);
        Assert.All(Items(byUser.Body), item => Assert.Equal(adminId, item.GetProperty("userId").GetString()));

        var byAction = await SendAsync(admin, HttpMethod.Get, "/api/v1/audit?action=create&pageSize=100");
        Assert.Equal(HttpStatusCode.OK, byAction.Status);
        Assert.All(Items(byAction.Body), item => Assert.Equal("create", item.GetProperty("action").GetString()));

        var byType = await SendAsync(admin, HttpMethod.Get, "/api/v1/audit?entityType=page&pageSize=100");
        Assert.Equal(HttpStatusCode.OK, byType.Status);
        Assert.All(Items(byType.Body), item => Assert.Equal("page", item.GetProperty("entityType").GetString()));

        var byDate = await SendAsync(admin, HttpMethod.Get,
            "/api/v1/audit?from=" + Uri.EscapeDataString(before.ToString("O"))
            + "&to=" + Uri.EscapeDataString(after.ToString("O"))
            + "&pageSize=100");
        Assert.Equal(HttpStatusCode.OK, byDate.Status);
        Assert.Contains(Items(byDate.Body), item =>
            item.GetProperty("action").GetString() == "create"
            && item.GetProperty("entityId").GetString() == pageId.ToString());

        Assert.Equal(HttpStatusCode.NoContent, (await SendAsync(admin, HttpMethod.Delete, "/api/v1/pages/" + pageId + "?version=1")).Status);
    }

    [Fact]
    public async Task Auth_audits_sign_in_failure_success_password_change_and_sign_out_but_not_refresh()
    {
        var email = "auth-audit-" + Guid.NewGuid().ToString("N")[..8] + "@digitalhub.test";
        await EnsureUserAsync(email, "editor", "Auth-Audit-Pass1!");

        var failed = await AuthSession.LoginAsync(_client, email, "Wrong-Passw0rd!");
        Assert.Equal(HttpStatusCode.Unauthorized, failed.Status);

        var session = await AuthSession.LoginAsync(_client, email, "Auth-Audit-Pass1!");
        Assert.Equal(HttpStatusCode.OK, session.Status);

        var change = session.Authorized(HttpMethod.Post, "/api/v1/auth/change-password");
        // The browser sends the refresh cookie on /api/v1/auth/*; it keeps this
        // session alive while the user's other sessions end (finding M1).
        change.Headers.TryAddWithoutValidation("Cookie", session.CookieHeader);
        change.Content = JsonContent.Create(new { currentPassword = "Auth-Audit-Pass1!", newPassword = "Auth-Audit-Pass2!" });
        Assert.Equal(HttpStatusCode.NoContent, (await _client.SendAsync(change)).StatusCode);

        var refreshed = await _client.SendAsync(session.RefreshRequest());
        Assert.Equal(HttpStatusCode.OK, refreshed.StatusCode);
        var refreshBody = await refreshed.Content.ReadAsStringAsync();
        var newCsrf = JsonDocument.Parse(refreshBody).RootElement.GetProperty("csrfToken").GetString();
        var newCookie = refreshed.Headers.GetValues("Set-Cookie").Single(value => value.StartsWith("dh_refresh=", StringComparison.Ordinal)).Split(';', 2)[0];
        var newCsrfCookie = refreshed.Headers.GetValues("Set-Cookie").Single(value => value.StartsWith("dh_csrf=", StringComparison.Ordinal)).Split(';', 2)[0];

        var logout = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/logout");
        logout.Headers.TryAddWithoutValidation("Cookie", newCookie + "; " + newCsrfCookie);
        logout.Headers.TryAddWithoutValidation("X-CSRF-Token", newCsrf);
        Assert.Equal(HttpStatusCode.NoContent, (await _client.SendAsync(logout)).StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        var rows = await db.AuditLog.AsNoTracking()
            .Where(entry => entry.EntityType == "auth" && (entry.Detail == email || entry.UserId != null))
            .OrderBy(entry => entry.At)
            .ToListAsync();
        Assert.Contains(rows, row => row.Action == "sign_in_failed" && row.Success == false && row.Detail == email);
        Assert.Contains(rows, row => row.Action == "sign_in" && row.Success && row.Detail == email);
        Assert.Contains(rows, row => row.Action == "change_password" && row.Success);
        Assert.Contains(rows, row => row.Action == "sign_out" && row.Success);
        Assert.DoesNotContain(rows, row => row.Action.Contains("refresh", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Contact_handled_records_who_and_when()
    {
        var admin = await AdminAsync();
        Guid id;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            var request = new ContactRequest
            {
                Id = Guid.NewGuid(),
                Name = "Handled Tester",
                Organization = "Digital Hub",
                Role = "Editor",
                Email = "handled-" + Guid.NewGuid().ToString("N")[..8] + "@example.com",
                Situation = "question",
                Message = "Please mark this handled.",
                Status = "new",
                CreatedAt = DateTime.UtcNow,
            };
            db.ContactRequests.Add(request);
            await db.SaveChangesAsync();
            id = request.Id;
        }

        var handled = await SendAsync(admin, HttpMethod.Post, "/api/v1/contact-requests/" + id + "/handled");
        Assert.Equal(HttpStatusCode.OK, handled.Status);
        var json = JsonDocument.Parse(handled.Body).RootElement;
        Assert.Equal("handled", json.GetProperty("status").GetString());
        Assert.False(string.IsNullOrWhiteSpace(json.GetProperty("handledById").GetString()));
        Assert.True(json.TryGetProperty("handledAt", out var at) && at.ValueKind != JsonValueKind.Null);
    }

    [Fact]
    public async Task Error_pages_are_editable_and_get_does_not_create_them()
    {
        var admin = await AdminAsync();
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            var existing = await db.Pages.Where(page => page.Slug.StartsWith("error-")).ToListAsync();
            if (existing.Count > 0)
            {
                var ids = existing.Select(page => page.Id).ToList();
                db.Sections.RemoveRange(await db.Sections.Where(section => section.PageId != null && ids.Contains(section.PageId.Value)).ToListAsync());
                db.Pages.RemoveRange(existing);
                await db.SaveChangesAsync();
            }
        }

        var empty = await SendAsync(admin, HttpMethod.Get, "/api/v1/error-pages");
        Assert.Equal(HttpStatusCode.OK, empty.Status);
        Assert.Empty(JsonDocument.Parse(empty.Body).RootElement.GetProperty("items").EnumerateArray());

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            Assert.False(await db.Pages.AnyAsync(page => page.Slug == "error-404" || page.Slug == "error-500"));
            SeedErrorPages(db);
            await db.SaveChangesAsync();
        }

        var listed = await SendAsync(admin, HttpMethod.Get, "/api/v1/error-pages");
        Assert.Equal(HttpStatusCode.OK, listed.Status);
        var items = JsonDocument.Parse(listed.Body).RootElement.GetProperty("items");
        Assert.Equal(2, items.GetArrayLength());
        var notFound = items.EnumerateArray().Single(item => item.GetProperty("type").GetString() == "404");
        Assert.Contains("\"type\":\"page\"", notFound.GetProperty("body").GetString(), StringComparison.Ordinal);
        Assert.Contains("Home", notFound.GetProperty("body").GetString(), StringComparison.Ordinal);
        Assert.Contains("Partners", notFound.GetProperty("body").GetString(), StringComparison.Ordinal);
        Assert.Contains("Careers", notFound.GetProperty("body").GetString(), StringComparison.Ordinal);

        var updated = await SendAsync(admin, HttpMethod.Put, "/api/v1/error-pages/404", new
        {
            version = notFound.GetProperty("version").GetInt32(),
            title = "Still not found",
            body = """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Updated 404 body."}]}]}""",
        });
        Assert.Equal(HttpStatusCode.OK, updated.Status);
        Assert.Equal("Still not found", JsonDocument.Parse(updated.Body).RootElement.GetProperty("title").GetString());
        Assert.Contains("Updated 404 body.", JsonDocument.Parse(updated.Body).RootElement.GetProperty("body").GetString(), StringComparison.Ordinal);
    }

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

    private async Task<AuthSession> EditorAsync()
    {
        const string email = "admin-api-editor@digitalhub.test";
        await EnsureUserAsync(email, "editor", ApiFactory.AdminPassword);
        var session = await AuthSession.LoginAsync(_client, email, ApiFactory.AdminPassword);
        Assert.Equal(HttpStatusCode.OK, session.Status);
        return session;
    }

    private async Task ClearSettingsAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        db.SiteSettings.RemoveRange(await db.SiteSettings.ToListAsync());
        await db.SaveChangesAsync();
    }

    private async Task<int> CountSettingsAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        return await db.SiteSettings.CountAsync();
    }

    private async Task EnsureSettingsAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        if (await db.SiteSettings.AnyAsync())
            return;
        db.SiteSettings.Add(new SiteSettings
        {
            Id = Guid.NewGuid(),
            Email = "hello@digitalhub.test",
            Phone = "+20 100 000 0000",
            LinkedIn = "https://www.linkedin.com/company/digitalhub",
            AnalyticsContainerId = "GTM-ABCDEF1",
            OrganizationName = "Digital Hub",
        });
        await db.SaveChangesAsync();
    }

    private async Task EnsureUserAsync(string email, string role, string password)
    {
        using var scope = _factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        if (await users.FindByEmailAsync(email) is not null)
            return;
        var user = new ApplicationUser { UserName = email, Email = email, EmailConfirmed = true };
        Assert.True((await users.CreateAsync(user, password)).Succeeded);
        Assert.True((await users.AddToRoleAsync(user, role)).Succeeded);
    }

    private async Task<(HttpStatusCode Status, string Body)> SendAsync(AuthSession session, HttpMethod method, string url, object? body = null)
    {
        var request = session.Authorized(method, url);
        if (body is not null)
            request.Content = JsonContent.Create(body);
        var response = await _client.SendAsync(request);
        return (response.StatusCode, await response.Content.ReadAsStringAsync());
    }

    private async Task<(HttpStatusCode Status, string Body)> SendRawAsync(AuthSession session, HttpMethod method, string url, string json)
    {
        var request = session.Authorized(method, url);
        request.Content = new StringContent(json, Encoding.UTF8, "application/json");
        var response = await _client.SendAsync(request);
        return (response.StatusCode, await response.Content.ReadAsStringAsync());
    }

    private static string? Code(string body) =>
        JsonDocument.Parse(body).RootElement.TryGetProperty("code", out var code) ? code.GetString() : null;

    private static IEnumerable<JsonElement> Items(string body) =>
        JsonDocument.Parse(body).RootElement.GetProperty("items").EnumerateArray();

    private static Dictionary<string, object?> SettingsPayload(JsonElement settings)
    {
        string? Text(string name) => settings.TryGetProperty(name, out var value) && value.ValueKind != JsonValueKind.Null
            ? value.GetString()
            : null;
        return new Dictionary<string, object?>
        {
            ["version"] = settings.GetProperty("version").GetInt32(),
            ["phone"] = Text("phone"),
            ["whatsApp"] = Text("whatsApp"),
            ["email"] = Text("email"),
            ["linkedIn"] = Text("linkedIn"),
            ["facebook"] = Text("facebook"),
            ["instagram"] = Text("instagram"),
            ["tikTok"] = Text("tikTok"),
            ["footerText"] = Text("footerText"),
            ["streetAddress"] = Text("streetAddress"),
            ["locality"] = Text("locality"),
            ["region"] = Text("region"),
            ["postalCode"] = Text("postalCode"),
            ["country"] = Text("country"),
            ["defaultMetaTitle"] = Text("defaultMetaTitle"),
            ["defaultMetaDescription"] = Text("defaultMetaDescription"),
            ["defaultShareImageAltOverride"] = Text("defaultShareImageAltOverride"),
            ["organizationName"] = Text("organizationName"),
            ["legalName"] = Text("legalName"),
            ["analyticsContainerId"] = Text("analyticsContainerId"),
            ["cookieBannerText"] = Text("cookieBannerText"),
        };
    }

    private static void SeedErrorPages(ContentDbContext db)
    {
        var now = DateTime.UtcNow;
        var homeId = Guid.NewGuid();
        foreach (var (type, title, body) in new[]
                 {
                     ("404", "Page not found", Error404Body(homeId)),
                     ("500", "Something went wrong", """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Something went wrong on our side."}]}]}"""),
                 })
        {
            var page = new Page
            {
                Id = Guid.NewGuid(),
                Slug = "error-" + type,
                Title = title,
                Status = ContentStatus.Draft,
                Version = 1,
                NoIndex = true,
                CreatedAt = now,
                UpdatedAt = now,
            };
            db.Pages.Add(page);
            db.Sections.Add(new Section
            {
                Id = Guid.NewGuid(),
                PageId = page.Id,
                Type = SectionTypes.RichText,
                SortOrder = 0,
                Visible = true,
                Fields = JsonSerializer.Serialize(new { heading = title, body }, ContentJson.Options),
            });
        }
    }

    private static string Error404Body(Guid homeId)
    {
        var links = new (string Label, Guid Id)[]
        {
            ("Home", homeId),
            ("About", Guid.NewGuid()),
            ("Partners", Guid.NewGuid()),
            ("Cases", Guid.NewGuid()),
            ("Blogs", Guid.NewGuid()),
            ("Careers", Guid.NewGuid()),
            ("Contact", Guid.NewGuid()),
        };
        var nodes = links.Select(link => new Dictionary<string, object?>
        {
            ["type"] = "paragraph",
            ["content"] = new object[]
            {
                new Dictionary<string, object?>
                {
                    ["type"] = "text",
                    ["text"] = link.Label,
                    ["marks"] = new object[]
                    {
                        new Dictionary<string, object?>
                        {
                            ["type"] = "link",
                            ["attrs"] = new Dictionary<string, object?>
                            {
                                ["type"] = "page",
                                ["id"] = link.Id.ToString("D"),
                            },
                        },
                    },
                },
            },
        }).Cast<object>().ToList();
        nodes.Insert(0, new Dictionary<string, object?>
        {
            ["type"] = "paragraph",
            ["content"] = new object[]
            {
                new Dictionary<string, object?> { ["type"] = "text", ["text"] = "That page is not here." },
            },
        });
        return JsonSerializer.Serialize(new { type = "doc", content = nodes }, ContentJson.Options);
    }

    private sealed class CollectingSink : ILogEventSink
    {
        public List<string> Lines { get; } = [];

        public void Emit(LogEvent logEvent)
        {
            using var writer = new StringWriter();
            writer.Write(logEvent.RenderMessage());
            foreach (var property in logEvent.Properties)
            {
                writer.Write(' ');
                writer.Write(property.Key);
                writer.Write('=');
                property.Value.Render(writer);
            }

            Lines.Add(writer.ToString());
        }
    }
}
