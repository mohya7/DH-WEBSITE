using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using DigitalHub.Api.Content;
using DigitalHub.Api.Data;
using DigitalHub.Api.Identity;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Routing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace DigitalHub.Api.Tests;

[Collection("SqlServer")]
public sealed class CareersTests : IClassFixture<ApiFactory>, IClassFixture<RecordingApplyFactory>
{
    private readonly ApiFactory _factory;
    private readonly RecordingApplyFactory _recording;
    private readonly HttpClient _client;
    private readonly HttpClient _mail;

    public CareersTests(ApiFactory factory, RecordingApplyFactory recording)
    {
        _factory = factory;
        _recording = recording;
        _client = factory.CreateClient();
        _mail = recording.CreateClient();
    }

    [Fact]
    public async Task An_application_emails_the_cv_and_counts_once()
    {
        await EnsureCareersAddressAsync();
        var vacancy = await PublishedVacancyAsync();
        var pdf = Pdf("one");
        var name = "Ada Lovelace";
        var address = UniqueEmail("ada");
        var first = await PostApplyAsync(_mail, name, address, "hello", pdf, vacancy);
        Assert.Equal(HttpStatusCode.Created, first.Status);
        Assert.DoesNotContain(name, first.Body, StringComparison.Ordinal);
        Assert.DoesNotContain(address, first.Body, StringComparison.Ordinal);

        var sent = _recording.Sender.Sent.Single(message => message.ReplyTo == address);
        Assert.Equal("careers@digitalhub.test", sent.To);
        Assert.StartsWith("Application:", sent.Subject, StringComparison.Ordinal);
        Assert.DoesNotContain(name, sent.Subject, StringComparison.Ordinal);
        Assert.DoesNotContain("\r", sent.Subject, StringComparison.Ordinal);
        Assert.Contains(name, sent.Body, StringComparison.Ordinal);
        Assert.Equal(address, sent.ReplyTo);
        Assert.DoesNotContain("/", sent.Attachment!.FileName, StringComparison.Ordinal);
        Assert.Equal(1, await CountAsync(vacancy));

        var second = await PostApplyAsync(_mail, name, address, "hello", pdf, vacancy);
        Assert.Equal(HttpStatusCode.Created, second.Status);
        Assert.Equal(1, _recording.Sender.Sent.Count(message => message.ReplyTo == address));
        Assert.Equal(1, await CountAsync(vacancy));
    }

    [Fact]
    public async Task The_recipient_is_the_careers_address_or_the_main_email()
    {
        await SetMailboxAsync("jobs@example.test", "sales@example.test");
        var address = UniqueEmail("mailbox");
        var sent = await PostApplyAsync(_mail, "Mailbox", address, "hello", Pdf("box"), null);
        Assert.Equal(HttpStatusCode.Created, sent.Status);
        Assert.Equal("jobs@example.test", _recording.Sender.Sent.Single(message => message.ReplyTo == address).To);

        await SetMailboxAsync(null, "sales@example.test");
        var fallback = UniqueEmail("fallback");
        var second = await PostApplyAsync(_mail, "Fallback", fallback, "hello", Pdf("fall"), null);
        Assert.Equal(HttpStatusCode.Created, second.Status);
        Assert.Equal("sales@example.test", _recording.Sender.Sent.Single(message => message.ReplyTo == fallback).To);
        await SetMailboxAsync("careers@digitalhub.test", null);
    }

    [Fact]
    public async Task A_failed_send_is_not_counted()
    {
        await EnsureCareersAddressAsync();
        _recording.Sender.Fail = true;
        try
        {
            var before = await CountAsync(null);
            var address = UniqueEmail("fail");
            var response = await PostApplyAsync(_mail, "No Send", address, "please", Pdf("fail"), null);
            Assert.Equal(HttpStatusCode.ServiceUnavailable, response.Status);
            Assert.Contains("careers@digitalhub.test", response.Body, StringComparison.Ordinal);
            Assert.DoesNotContain(address, response.Body, StringComparison.Ordinal);
            Assert.Equal(before, await CountAsync(null));
        }
        finally
        {
            _recording.Sender.Fail = false;
        }
    }

    [Fact]
    public async Task Attack_cases_are_refused()
    {
        await EnsureCareersAddressAsync();
        var vacancy = await PublishedVacancyAsync();
        var before = await CountAsync(vacancy);

        var oversize = new byte[CvFile.MaxBytes + 1];
        "%PDF-"u8.CopyTo(oversize);
        Assert.Equal((HttpStatusCode)413, (await PostApplyAsync(_client, "Big", UniqueEmail("big"), "", oversize, vacancy, "cv.pdf")).Status);

        var chunkedBody = new byte[CvFile.BodyLimit + 1024];
        Encoding.ASCII.GetBytes("------dh\r\nContent-Disposition: form-data; name=\"cv\"; filename=\"cv.pdf\"\r\nContent-Type: application/pdf\r\n\r\n%PDF-").CopyTo(chunkedBody, 0);
        var chunkedContent = new OpenEndedContent(chunkedBody);
        chunkedContent.Headers.ContentType = MediaTypeHeaderValue.Parse("multipart/form-data; boundary=----dh");
        var chunked = await _client.SendAsync(new HttpRequestMessage(HttpMethod.Post, "/api/v1/public/apply") { Content = chunkedContent });
        Assert.Equal((HttpStatusCode)413, chunked.StatusCode);

        var lying = new HttpRequestMessage(HttpMethod.Post, "/api/v1/public/apply")
        {
            Content = new ByteArrayContent(Pdf("lie")),
        };
        lying.Content.Headers.ContentType = new MediaTypeHeaderValue("multipart/form-data");
        lying.Content.Headers.ContentLength = CvFile.BodyLimit + 50;
        Assert.Equal((HttpStatusCode)413, (await _client.SendAsync(lying)).StatusCode);

        Assert.Equal(HttpStatusCode.BadRequest, (await PostApplyAsync(_client, "Wrong", UniqueEmail("wrong"), "", Encoding.ASCII.GetBytes("not a pdf"), vacancy, "cv.pdf")).Status);
        Assert.Equal(HttpStatusCode.BadRequest, (await PostApplyAsync(_client, "Bomb", UniqueEmail("bomb"), "", ZipBomb(), vacancy, "cv.docx")).Status);
        Assert.Equal(HttpStatusCode.BadRequest, (await PostApplyAsync(_client, "Ada\r\nBcc: x@y.test", UniqueEmail("name"), "", Pdf("inj"), vacancy)).Status);
        Assert.Equal(HttpStatusCode.BadRequest, (await PostApplyAsync(_client, "Ada", "ada@hub.test\r\nBcc: x@y.test", "", Pdf("mail"), vacancy)).Status);

        var duplicate = new MultipartFormDataContent
        {
            { new StringContent("Ada"), "name" },
            { new StringContent("Other"), "name" },
            { new StringContent(UniqueEmail("dup")), "email" },
            { new StringContent("yes"), "consent" },
        };
        duplicate.Add(new ByteArrayContent(Pdf("dup")), "cv", "cv.pdf");
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.SendAsync(new HttpRequestMessage(HttpMethod.Post, "/api/v1/public/apply") { Content = duplicate })).StatusCode);

        var honeypot = await PostApplyAsync(_client, "Bot", UniqueEmail("bot"), "", Pdf("bot"), vacancy, website: "http://spam.test");
        Assert.Equal(HttpStatusCode.Created, honeypot.Status);
        Assert.Equal(before, await CountAsync(vacancy));
    }

    [Fact]
    public async Task Consent_and_closed_vacancies_are_refused()
    {
        await EnsureCareersAddressAsync();
        var open = await PublishedVacancyAsync();
        var before = await CountAsync(open);
        var general = await CountAsync(null);
        var sent = _recording.Sender.Sent.Count;

        foreach (var consent in new string?[] { null, "false", "no" })
        {
            var refused = await PostFieldsAsync(_mail, "Consent", UniqueEmail("consent"), "hello", Pdf("consent"), open, consent: consent);
            Assert.Equal(HttpStatusCode.BadRequest, refused.Status);
            Assert.Contains("data-code=\"invalid_form\"", refused.Body, StringComparison.Ordinal);
        }

        var unknown = await PostFieldsAsync(_mail, "Unknown", UniqueEmail("unknown"), "hello", Pdf("unknown"), null, vacancyText: Guid.NewGuid().ToString("D"));
        var draft = await DraftVacancyAsync();
        var ended = await EndedVacancyAsync();
        var cases = new[]
        {
            unknown,
            await PostFieldsAsync(_mail, "Draft", UniqueEmail("draft"), "hello", Pdf("draft"), null, vacancyText: draft.ToString("D")),
            await PostFieldsAsync(_mail, "Ended", UniqueEmail("ended"), "hello", Pdf("ended"), null, vacancyText: ended.ToString("D")),
            await PostFieldsAsync(_mail, "Text", UniqueEmail("text"), "hello", Pdf("text"), null, vacancyText: "not-a-guid"),
        };
        Assert.All(cases, refused =>
        {
            Assert.Equal(HttpStatusCode.BadRequest, refused.Status);
            Assert.Contains("data-code=\"closed\"", refused.Body, StringComparison.Ordinal);
        });
        Assert.Equal(before, await CountAsync(open));
        Assert.Equal(general, await CountAsync(null));
        Assert.Equal(sent, _recording.Sender.Sent.Count);
    }

    [Fact]
    public async Task A_failed_count_still_answers_with_the_page_and_does_not_resend()
    {
        await EnsureCareersAddressAsync();
        var before = await CountAsync(null);
        await using var connection = new SqlConnection(ApiFactory.ElevatedTestConnectionString());
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE OR ALTER TRIGGER application_counts_fail_for_test ON application_counts
            AFTER INSERT, UPDATE AS
            BEGIN
                THROW 50001, 'count blocked', 1;
            END
            """;
        await command.ExecuteNonQueryAsync();
        try
        {
            var address = UniqueEmail("countfail");
            var pdf = Pdf("countfail");
            var first = await PostApplyAsync(_mail, "Count Fail", address, "hello", pdf, null);
            Assert.Equal(HttpStatusCode.Created, first.Status);
            Assert.StartsWith("<!DOCTYPE html>", first.Body, StringComparison.Ordinal);
            Assert.Contains("data-code=\"accepted\"", first.Body, StringComparison.Ordinal);
            Assert.DoesNotContain("problem+json", first.Body, StringComparison.Ordinal);
            Assert.Equal(1, _recording.Sender.Sent.Count(message => message.ReplyTo == address));

            var second = await PostApplyAsync(_mail, "Count Fail", address, "hello", pdf, null);
            Assert.Equal(HttpStatusCode.Created, second.Status);
            Assert.Equal(1, _recording.Sender.Sent.Count(message => message.ReplyTo == address));
            Assert.Equal(before, await CountAsync(null));
        }
        finally
        {
            command.CommandText = "DROP TRIGGER IF EXISTS application_counts_fail_for_test";
            await command.ExecuteNonQueryAsync();
        }
    }

    [Fact]
    public async Task The_rate_limit_answers_429()
    {
        await using var factory = new ApplyLimitedFactory();
        var client = factory.CreateClient();
        var address = UniqueEmail("rate");
        HttpStatusCode last = 0;
        for (var i = 0; i < 4; i++)
        {
            last = (await PostApplyAsync(client, "Rate", address, i.ToString(), Pdf("rate" + i), null)).Status;
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, last);
    }

    [Fact]
    public async Task Concurrent_applications_each_count()
    {
        await EnsureCareersAddressAsync();
        var vacancy = await PublishedVacancyAsync();
        var before = await CountAsync(vacancy);
        var tasks = Enumerable.Range(0, 6).Select(index => PostApplyAsync(_client, "Concurrent " + index, UniqueEmail("con" + index), "m", Pdf("con" + index), vacancy)).ToArray();
        var results = await Task.WhenAll(tasks);
        Assert.All(results, result => Assert.Equal(HttpStatusCode.Created, result.Status));
        Assert.Equal(before + 6, await CountAsync(vacancy));
    }

    [Fact]
    public async Task Ended_vacancies_stay_in_the_build_without_an_open_apply()
    {
        var admin = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var created = await _client.SendAsync(Json(admin, HttpMethod.Post, "/api/v1/vacancies", new { slug = "ended-" + suffix, title = "Ended " + suffix, fields = new { summary = "Open." } }));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var createdJson = JsonDocument.Parse(await created.Content.ReadAsStringAsync()).RootElement;
        var id = createdJson.GetProperty("id").GetGuid();
        var published = await _client.SendAsync(Json(admin, HttpMethod.Post, "/api/v1/vacancies/" + id + "/publish", new { version = createdJson.GetProperty("version").GetInt32() }));
        var version = JsonDocument.Parse(await published.Content.ReadAsStringAsync()).RootElement.GetProperty("version").GetInt32();
        var ended = await _client.SendAsync(Json(admin, HttpMethod.Post, "/api/v1/vacancies/" + id + "/end", new { version }));
        Assert.Equal(HttpStatusCode.OK, ended.StatusCode);

        var build = new HttpRequestMessage(HttpMethod.Get, "/api/v1/build/content");
        build.Headers.TryAddWithoutValidation("X-Build-Token", ApiFactory.BuildTokenValue);
        var body = JsonDocument.Parse(await (await _client.SendAsync(build)).Content.ReadAsStringAsync()).RootElement;
        var item = body.GetProperty("collections").GetProperty("vacancies").EnumerateArray().Single(row => row.GetProperty("id").GetGuid() == id);
        Assert.Equal("ended", item.GetProperty("status").GetString());
        Assert.False(string.IsNullOrEmpty(item.GetProperty("path").GetString()));
    }

    [Fact]
    public async Task Hr_sees_counts_and_can_end_a_vacancy_only()
    {
        await EnsureCareersAddressAsync();
        var admin = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var hrEmail = UniqueEmail("hr");
        var createdUser = await _client.SendAsync(Json(admin, HttpMethod.Post, "/api/v1/users", new { email = hrEmail, role = "hr", password = ApiFactory.AdminPassword }));
        Assert.Equal(HttpStatusCode.Created, createdUser.StatusCode);
        var rejected = await _client.SendAsync(Json(admin, HttpMethod.Post, "/api/v1/users", new { email = UniqueEmail("oldrole"), role = "marketing", password = ApiFactory.AdminPassword }));
        Assert.Equal(HttpStatusCode.BadRequest, rejected.StatusCode);

        var hr = await AuthSession.LoginAsync(_client, hrEmail, ApiFactory.AdminPassword);
        Assert.Equal(HttpStatusCode.OK, (await _client.SendAsync(hr.Authorized(HttpMethod.Get, "/api/v1/applications"))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _client.SendAsync(admin.Authorized(HttpMethod.Get, "/api/v1/applications"))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _client.SendAsync(hr.Authorized(HttpMethod.Post, "/api/v1/pages"))).StatusCode);

        var vacancy = await PublishedVacancyAsync();
        var version = await VacancyVersionAsync(admin, vacancy);
        Assert.Equal(HttpStatusCode.OK, (await _client.SendAsync(Json(hr, HttpMethod.Post, "/api/v1/vacancies/" + vacancy + "/end", new { version }))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _client.SendAsync(Json(hr, HttpMethod.Put, "/api/v1/vacancies/" + vacancy, new { version = version + 1, slug = "changed", title = "Changed" }))).StatusCode);
    }

    [Fact]
    public async Task Authorization_matches_for_every_endpoint()
    {
        var admin = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        await EnsureRoleUserAsync("careers-editor@digitalhub.test", Roles.Editor);
        var editor = await AuthSession.LoginAsync(_client, "careers-editor@digitalhub.test", ApiFactory.AdminPassword);
        var hrEmail = "careers-hr@digitalhub.test";
        await EnsureRoleUserAsync(hrEmail, Roles.Hr);
        var hr = await AuthSession.LoginAsync(_client, hrEmail, ApiFactory.AdminPassword);
        await EnsureRoleUserAsync("careers-none@digitalhub.test", null);
        var none = await AuthSession.LoginAsync(_client, "careers-none@digitalhub.test", ApiFactory.AdminPassword);
        await EnsureRoleUserAsync("careers-locked@digitalhub.test", Roles.Editor);
        var locked = await AuthSession.LoginAsync(_client, "careers-locked@digitalhub.test", ApiFactory.AdminPassword);
        await LockAsync("careers-locked@digitalhub.test");
        await EnsureRoleUserAsync("careers-reset@digitalhub.test", Roles.Editor);
        var reset = await AuthSession.LoginAsync(_client, "careers-reset@digitalhub.test", ApiFactory.AdminPassword);
        await FlagPasswordChangeAsync("careers-reset@digitalhub.test");

        var mismatches = new List<string>();
        foreach (var endpoint in _factory.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>())
        {
            var template = endpoint.RoutePattern.RawText ?? "";
            if (!template.Contains("api/v1", StringComparison.Ordinal) || template.Contains("examples", StringComparison.Ordinal))
                continue;
            var methods = endpoint.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods ?? ["GET"];
            var anonymous = endpoint.Metadata.GetMetadata<Microsoft.AspNetCore.Authorization.IAllowAnonymous>() is not null;
            var passwordChangeAllowed = endpoint.Metadata.GetMetadata<DigitalHub.Api.Auth.AllowedBeforePasswordChangeAttribute>() is not null;
            var collections = template.Contains("{collection}", StringComparison.Ordinal) ? new[] { "pages", "vacancies" } : new string?[] { null };
            foreach (var collection in collections)
            {
                var path = "/" + template.TrimStart('/');
                path = System.Text.RegularExpressions.Regex.Replace(path, "\\{[^}]*:guid\\}", "11111111-1111-4111-8111-111111111111");
                path = path.Replace("{collection}", collection ?? "pages", StringComparison.Ordinal);
                path = path.Replace("{id}", "11111111-1111-4111-8111-111111111111", StringComparison.Ordinal);
                path = System.Text.RegularExpressions.Regex.Replace(path, "\\{[^}]+\\}", "x");
                foreach (var method in methods)
                {
                    await Check(admin, "admin", method, path, collection, anonymous, passwordChangeAllowed, mismatches);
                    await Check(editor, "editor", method, path, collection, anonymous, passwordChangeAllowed, mismatches);
                    await Check(hr, "hr", method, path, collection, anonymous, passwordChangeAllowed, mismatches);
                    await Check(none, "none", method, path, collection, anonymous, passwordChangeAllowed, mismatches);
                    await Check(locked, "deactivated", method, path, collection, anonymous, passwordChangeAllowed, mismatches);
                    await Check(reset, "must-change", method, path, collection, anonymous, passwordChangeAllowed, mismatches);
                }
            }
        }

        Assert.True(mismatches.Count == 0, string.Join("\n", mismatches));
    }

    private async Task Check(AuthSession session, string role, string method, string path, string? collection, bool anonymous, bool passwordChangeAllowed, List<string> mismatches)
    {
        var response = await _client.SendAsync(session.Authorized(new HttpMethod(method), path));
        var status = response.StatusCode;
        var body = await response.Content.ReadAsStringAsync();
        var expected = Expected(role, method, path, collection, anonymous, passwordChangeAllowed, status, body);
        if (!expected)
            mismatches.Add($"{role} {method} {path} -> {(int)status} {body}");
    }

    private static bool Expected(string role, string method, string path, string? collection, bool anonymous, bool passwordChangeAllowed, HttpStatusCode status, string body)
    {
        if (path.StartsWith("/api/v1/build", StringComparison.Ordinal))
            return status == HttpStatusCode.Unauthorized;
        if (anonymous)
            return status != HttpStatusCode.Forbidden;
        if (role == "deactivated")
            return status == HttpStatusCode.Unauthorized;
        if (role == "must-change")
        {
            if (passwordChangeAllowed)
                return status != HttpStatusCode.Forbidden || !body.Contains("password_change_required", StringComparison.Ordinal);
            if (EditorBlocked(method, path))
                return status == HttpStatusCode.Forbidden;
            return status == HttpStatusCode.Forbidden && body.Contains("password_change_required", StringComparison.Ordinal);
        }
        if (role == "none")
            return status == HttpStatusCode.Forbidden;
        if (role == "hr")
            return HrAllowed(method, path) ? status != HttpStatusCode.Forbidden : status == HttpStatusCode.Forbidden;
        if (role == "editor")
            return EditorBlocked(method, path) ? status == HttpStatusCode.Forbidden : status != HttpStatusCode.Forbidden;
        if (path.StartsWith("/api/v1/applications", StringComparison.Ordinal))
            return status == HttpStatusCode.Forbidden;
        return status != HttpStatusCode.Forbidden;
    }

    private static bool HrAllowed(string method, string path)
    {
        if (method == "GET" && path is "/api/v1/applications" or "/api/v1/vacancies" or "/api/v1/auth/me")
            return true;
        if (method == "POST" && path == "/api/v1/auth/change-password")
            return true;
        if (method == "GET" && VacancyItem.IsMatch(path))
            return true;
        return method == "POST" && path.EndsWith("/end", StringComparison.Ordinal) && path.StartsWith("/api/v1/vacancies/", StringComparison.Ordinal);
    }

    private static bool EditorBlocked(string method, string path) =>
        path.StartsWith("/api/v1/users", StringComparison.Ordinal)
        || path.StartsWith("/api/v1/audit", StringComparison.Ordinal)
        || path.StartsWith("/api/v1/applications", StringComparison.Ordinal)
        || (method == "PUT" && path == "/api/v1/settings")
        || (method == "DELETE" && (MediaItem.IsMatch(path) || ContentItem.IsMatch(path)));

    private static readonly System.Text.RegularExpressions.Regex VacancyItem = new("^/api/v1/vacancies/[0-9a-fA-F-]{36}$", System.Text.RegularExpressions.RegexOptions.CultureInvariant);
    private static readonly System.Text.RegularExpressions.Regex MediaItem = new("^/api/v1/media/[0-9a-fA-F-]{36}$", System.Text.RegularExpressions.RegexOptions.CultureInvariant);
    private static readonly System.Text.RegularExpressions.Regex ContentItem = new("^/api/v1/(pages|services|partners|case-studies|blog-posts|vacancies|team-members|news-items)/[0-9a-fA-F-]{36}$", System.Text.RegularExpressions.RegexOptions.CultureInvariant);

    private async Task EnsureRoleUserAsync(string email, string? role)
    {
        using var scope = _factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var existing = await users.FindByEmailAsync(email);
        if (existing is null)
        {
            existing = new ApplicationUser { UserName = email, Email = email, EmailConfirmed = true };
            Assert.True((await users.CreateAsync(existing, ApiFactory.AdminPassword)).Succeeded);
        }

        if (role is not null && !await users.IsInRoleAsync(existing, role))
            Assert.True((await users.AddToRoleAsync(existing, role)).Succeeded);
    }

    private async Task LockAsync(string email)
    {
        using var scope = _factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await users.FindByEmailAsync(email);
        user!.LockoutEnabled = true;
        user.LockoutEnd = DateTimeOffset.MaxValue;
        Assert.True((await users.UpdateAsync(user)).Succeeded);
    }

    private async Task FlagPasswordChangeAsync(string email)
    {
        using var scope = _factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await users.FindByEmailAsync(email);
        user!.MustChangePassword = true;
        Assert.True((await users.UpdateAsync(user)).Succeeded);
    }

    private async Task EnsureCareersAddressAsync() => await SetMailboxAsync("careers@digitalhub.test", null);

    private async Task SetMailboxAsync(string? careers, string? email)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        var settings = await db.SiteSettings.FirstOrDefaultAsync();
        if (settings is null)
        {
            settings = new SiteSettings { Id = Guid.NewGuid() };
            db.SiteSettings.Add(settings);
        }

        settings.CareersEmail = careers;
        if (email is not null)
            settings.Email = email;
        await db.SaveChangesAsync();
    }

    private async Task<Guid> PublishedVacancyAsync()
    {
        var admin = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var created = await _client.SendAsync(Json(admin, HttpMethod.Post, "/api/v1/vacancies", new { slug = "apply-" + suffix, title = "Apply " + suffix, fields = new { summary = "A role." } }));
        var createdBody = await created.Content.ReadAsStringAsync();
        Assert.True(created.StatusCode == HttpStatusCode.Created, createdBody);
        var json = JsonDocument.Parse(createdBody).RootElement;
        var id = json.GetProperty("id").GetGuid();
        var published = await _client.SendAsync(Json(admin, HttpMethod.Post, "/api/v1/vacancies/" + id + "/publish", new { version = json.GetProperty("version").GetInt32() }));
        Assert.Equal(HttpStatusCode.OK, published.StatusCode);
        return id;
    }

    private async Task<int> VacancyVersionAsync(AuthSession session, Guid id)
    {
        var response = await _client.SendAsync(session.Authorized(HttpMethod.Get, "/api/v1/vacancies/" + id));
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.GetProperty("version").GetInt32();
    }

    private async Task<int> CountAsync(Guid? vacancyId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return await db.ApplicationCounts.Where(row => row.VacancyId == vacancyId && row.AppliedOn == today).SumAsync(row => (int?)row.Count) ?? 0;
    }

    private async Task<Guid> DraftVacancyAsync()
    {
        var admin = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var created = await _client.SendAsync(Json(admin, HttpMethod.Post, "/api/v1/vacancies", new { slug = "draft-" + suffix, title = "Draft " + suffix, fields = new { summary = "A role." } }));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        return JsonDocument.Parse(await created.Content.ReadAsStringAsync()).RootElement.GetProperty("id").GetGuid();
    }

    private async Task<Guid> EndedVacancyAsync()
    {
        var id = await PublishedVacancyAsync();
        var admin = await AuthSession.LoginAsync(_client, ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var version = await VacancyVersionAsync(admin, id);
        var ended = await _client.SendAsync(Json(admin, HttpMethod.Post, "/api/v1/vacancies/" + id + "/end", new { version }));
        Assert.Equal(HttpStatusCode.OK, ended.StatusCode);
        return id;
    }

    private static async Task<(HttpStatusCode Status, string Body)> PostFieldsAsync(
        HttpClient client, string name, string email, string message, byte[] file, Guid? vacancy,
        string fileName = "cv.pdf", string? website = null, string? consent = "yes", string? vacancyText = null)
    {
        var form = new MultipartFormDataContent
        {
            { new StringContent(name), "name" },
            { new StringContent(email), "email" },
            { new StringContent(message), "message" },
        };
        if (consent is not null)
            form.Add(new StringContent(consent), "consent");
        if (vacancyText is not null)
            form.Add(new StringContent(vacancyText), "vacancyId");
        else if (vacancy is Guid id)
            form.Add(new StringContent(id.ToString("D")), "vacancyId");
        if (website is not null)
            form.Add(new StringContent(website), "website");
        form.Add(new ByteArrayContent(file), "cv", fileName);
        var response = await client.SendAsync(new HttpRequestMessage(HttpMethod.Post, "/api/v1/public/apply") { Content = form });
        return (response.StatusCode, await response.Content.ReadAsStringAsync());
    }

    private static Task<(HttpStatusCode Status, string Body)> PostApplyAsync(HttpClient client, string name, string email, string message, byte[] file, Guid? vacancy, string fileName = "cv.pdf", string? website = null) =>
        PostFieldsAsync(client, name, email, message, file, vacancy, fileName, website);

    private static HttpRequestMessage Json(AuthSession session, HttpMethod method, string url, object body)
    {
        var request = session.Authorized(method, url);
        request.Content = JsonContent.Create(body);
        return request;
    }

    private static string UniqueEmail(string label) => label + "-" + Guid.NewGuid().ToString("N")[..8] + "@digitalhub.test";

    private static byte[] Pdf(string mark) => Encoding.ASCII.GetBytes("%PDF-1.4\n%" + mark);

    private static byte[] ZipBomb()
    {
        var name = Encoding.UTF8.GetBytes("[Content_Types].xml");
        var word = Encoding.UTF8.GetBytes("word/document.xml");
        return Entry(name, 0x70000000).Concat(Entry(word, 0x70000000)).ToArray();

        static byte[] Entry(byte[] entryName, uint claimed)
        {
            var header = new byte[30 + entryName.Length + 4];
            header[0] = 0x50;
            header[1] = 0x4B;
            header[2] = 0x03;
            header[3] = 0x04;
            BitConverter.GetBytes(4u).CopyTo(header, 18);
            BitConverter.GetBytes(claimed).CopyTo(header, 22);
            BitConverter.GetBytes((ushort)entryName.Length).CopyTo(header, 26);
            entryName.CopyTo(header, 30);
            return header;
        }
    }
}

public sealed class RecordingEmailSender : IEmailSender
{
    public List<EmailMessage> Sent { get; } = [];
    public bool Fail { get; set; }

    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        if (Fail)
            throw new EmailDeliveryException();
        Sent.Add(message);
        return Task.CompletedTask;
    }
}

public sealed class RecordingApplyFactory : ApiFactory
{
    public RecordingEmailSender Sender { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IEmailSender>();
            services.AddSingleton<IEmailSender>(Sender);
        });
    }
}

public sealed class ApplyLimitedFactory : ApiFactory
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.UseSetting("Apply:IpPermitLimit", "2");
        builder.UseSetting("Apply:EmailPermitLimit", "2");
    }
}

sealed class OpenEndedContent : HttpContent
{
    private readonly byte[] _bytes;
    public OpenEndedContent(byte[] bytes) => _bytes = bytes;
    protected override bool TryComputeLength(out long length)
    {
        length = 0;
        return false;
    }

    protected override Task SerializeToStreamAsync(Stream stream, TransportContext? context) => stream.WriteAsync(_bytes).AsTask();
}
