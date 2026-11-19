using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Sockets;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace DigitalHub.PublicApi.Tests;

/// <summary>
/// The admin API's thirteen apply tests (CareersTests), ported to the public forms
/// API (ISO-2): the same names, inputs and assertions. Vacancies, mailboxes and
/// counts are set up and read through FormsDatabase instead of the admin API,
/// and the silent mail server listens on a port the system picks.
/// </summary>
[Collection("PublicFormsSql")]
public sealed class PublicApplyTests : IClassFixture<PublicApiFactory>, IClassFixture<RecordingApplyFactory>
{
    private readonly RecordingApplyFactory _recording;
    private readonly HttpClient _client;
    private readonly HttpClient _mail;

    public PublicApplyTests(PublicApiFactory factory, RecordingApplyFactory recording)
    {
        _recording = recording;
        _client = factory.CreateClient();
        _mail = recording.CreateClient();
    }

    [Fact]
    public async Task An_application_emails_the_cv_and_counts_once()
    {
        await FormsDatabase.EnsureCareersAddressAsync();
        var vacancy = await FormsDatabase.InsertVacancyAsync("published");
        try
        {
            var pdf = Pdf("one");
            var name = "Ada Lovelace";
            var address = UniqueEmail("ada");
            var first = await PostApplyAsync(_mail, name, address, "hello", pdf, vacancy);
            Assert.Equal(HttpStatusCode.Created, first.Status);
            Assert.False(first.SetCookie);
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
            Assert.Equal(1, await FormsDatabase.CountAsync(vacancy));

            var second = await PostApplyAsync(_mail, name, address, "hello", pdf, vacancy);
            Assert.Equal(HttpStatusCode.Created, second.Status);
            Assert.Equal(1, _recording.Sender.Sent.Count(message => message.ReplyTo == address));
            Assert.Equal(1, await FormsDatabase.CountAsync(vacancy));
        }
        finally
        {
            await FormsDatabase.DeleteVacancyAsync(vacancy);
        }
    }

    [Fact]
    public async Task The_recipient_is_the_careers_address_or_the_main_email()
    {
        await FormsDatabase.SetMailboxAsync("jobs@example.test", "sales@example.test");
        var address = UniqueEmail("mailbox");
        var sent = await PostApplyAsync(_mail, "Mailbox", address, "hello", Pdf("box"), null);
        Assert.Equal(HttpStatusCode.Created, sent.Status);
        Assert.Equal("jobs@example.test", _recording.Sender.Sent.Single(message => message.ReplyTo == address).To);

        await FormsDatabase.SetMailboxAsync(null, "sales@example.test");
        var fallback = UniqueEmail("fallback");
        var second = await PostApplyAsync(_mail, "Fallback", fallback, "hello", Pdf("fall"), null);
        Assert.Equal(HttpStatusCode.Created, second.Status);
        Assert.Equal("sales@example.test", _recording.Sender.Sent.Single(message => message.ReplyTo == fallback).To);
        await FormsDatabase.SetMailboxAsync("careers@digitalhub.test", null);
    }

    [Fact]
    public async Task A_failed_send_is_not_counted()
    {
        await FormsDatabase.EnsureCareersAddressAsync();
        _recording.Sender.Fail = true;
        try
        {
            var before = await FormsDatabase.CountAsync(null);
            var address = UniqueEmail("fail");
            var response = await PostApplyAsync(_mail, "No Send", address, "please", Pdf("fail"), null);
            Assert.Equal(HttpStatusCode.ServiceUnavailable, response.Status);
            Assert.Contains("careers@digitalhub.test", response.Body, StringComparison.Ordinal);
            Assert.DoesNotContain(address, response.Body, StringComparison.Ordinal);
            Assert.Equal(before, await FormsDatabase.CountAsync(null));
        }
        finally
        {
            _recording.Sender.Fail = false;
        }
    }

    [Fact]
    public async Task Attack_cases_are_refused()
    {
        await FormsDatabase.EnsureCareersAddressAsync();
        var vacancy = await FormsDatabase.InsertVacancyAsync("published");
        try
        {
            var before = await FormsDatabase.CountAsync(vacancy);

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
            Assert.Equal(before, await FormsDatabase.CountAsync(vacancy));
        }
        finally
        {
            await FormsDatabase.DeleteVacancyAsync(vacancy);
        }
    }

    [Fact]
    public async Task Unreadable_requests_get_the_html_page()
    {
        await FormsDatabase.EnsureCareersAddressAsync();
        var before = await FormsDatabase.CountAsync(null);
        var sent = _recording.Sender.Sent.Count;

        var chunkedBody = new byte[CvFile.BodyLimit + 1024];
        Encoding.ASCII.GetBytes("------dh\r\nContent-Disposition: form-data; name=\"cv\"; filename=\"cv.pdf\"\r\n\r\n%PDF-").CopyTo(chunkedBody, 0);
        var chunkedContent = new OpenEndedContent(chunkedBody);
        chunkedContent.Headers.ContentType = MediaTypeHeaderValue.Parse("multipart/form-data; boundary=----dh");
        var chunked = await _client.SendAsync(new HttpRequestMessage(HttpMethod.Post, "/api/v1/public/apply") { Content = chunkedContent });
        var chunkedText = await chunked.Content.ReadAsStringAsync();
        Assert.Equal((HttpStatusCode)413, chunked.StatusCode);
        Assert.Contains("data-code=\"too_large\"", chunkedText, StringComparison.Ordinal);
        Assert.DoesNotContain("validation_failed", chunkedText, StringComparison.Ordinal);

        var shortBody = Encoding.ASCII.GetBytes("------dh\r\nContent-Disposition: form-data; name=\"name\"\r\n\r\nAda\r\n------dh--\r\n");
        var shortRequest = new HttpRequestMessage(HttpMethod.Post, "/api/v1/public/apply") { Content = new ShortLengthContent(shortBody, 12) };
        shortRequest.Content.Headers.ContentType = MediaTypeHeaderValue.Parse("multipart/form-data; boundary=----dh");
        var shortened = await _client.SendAsync(shortRequest);
        var shortenedBody = await shortened.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.BadRequest, shortened.StatusCode);
        Assert.Contains("data-code=\"invalid_form\"", shortenedBody, StringComparison.Ordinal);
        Assert.DoesNotContain("validation_failed", shortenedBody, StringComparison.Ordinal);

        var brokenName = Encoding.ASCII.GetBytes("------dh\r\nContent-Disposition: form-data; name=\"cv\"; filename=\"cv.pdf\r\nBcc: x@y.test\"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.4\n------dh--\r\n");
        var named = new HttpRequestMessage(HttpMethod.Post, "/api/v1/public/apply")
        {
            Content = new ByteArrayContent(brokenName),
        };
        named.Content.Headers.ContentType = MediaTypeHeaderValue.Parse("multipart/form-data; boundary=----dh");
        var namedResponse = await _client.SendAsync(named);
        var namedBody = await namedResponse.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.BadRequest, namedResponse.StatusCode);
        Assert.Contains("data-code=\"invalid_form\"", namedBody, StringComparison.Ordinal);
        Assert.DoesNotContain("validation_failed", namedBody, StringComparison.Ordinal);

        var garbage = new HttpRequestMessage(HttpMethod.Post, "/api/v1/public/apply")
        {
            Content = new StringContent("this is not a form"),
        };
        garbage.Content.Headers.ContentType = MediaTypeHeaderValue.Parse("multipart/form-data; boundary=----dh");
        var parsed = await _client.SendAsync(garbage);
        var parsedBody = await parsed.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.BadRequest, parsed.StatusCode);
        Assert.Contains("<!DOCTYPE html>", parsedBody, StringComparison.Ordinal);
        Assert.DoesNotContain("validation_failed", parsedBody, StringComparison.Ordinal);

        Assert.Equal(before, await FormsDatabase.CountAsync(null));
        Assert.Equal(sent, _recording.Sender.Sent.Count);
    }

    [Fact]
    public async Task Consent_and_closed_vacancies_are_refused()
    {
        await FormsDatabase.EnsureCareersAddressAsync();
        var open = await FormsDatabase.InsertVacancyAsync("published");
        var draft = await FormsDatabase.InsertVacancyAsync("draft");
        var ended = await FormsDatabase.InsertVacancyAsync("ended");
        try
        {
            var before = await FormsDatabase.CountAsync(open);
            var general = await FormsDatabase.CountAsync(null);
            var sent = _recording.Sender.Sent.Count;

            foreach (var consent in new string?[] { null, "false", "no" })
            {
                var refused = await PostFieldsAsync(_mail, "Consent", UniqueEmail("consent"), "hello", Pdf("consent"), open, consent: consent);
                Assert.Equal(HttpStatusCode.BadRequest, refused.Status);
                Assert.Contains("data-code=\"invalid_form\"", refused.Body, StringComparison.Ordinal);
            }

            var unknown = await PostFieldsAsync(_mail, "Unknown", UniqueEmail("unknown"), "hello", Pdf("unknown"), null, vacancyText: Guid.NewGuid().ToString("D"));
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
            Assert.Equal(before, await FormsDatabase.CountAsync(open));
            Assert.Equal(general, await FormsDatabase.CountAsync(null));
            Assert.Equal(sent, _recording.Sender.Sent.Count);
        }
        finally
        {
            await FormsDatabase.DeleteVacancyAsync(open);
            await FormsDatabase.DeleteVacancyAsync(draft);
            await FormsDatabase.DeleteVacancyAsync(ended);
        }
    }

    [Fact]
    public async Task A_failed_count_still_answers_with_the_page_and_does_not_resend()
    {
        await FormsDatabase.EnsureCareersAddressAsync();
        var before = await FormsDatabase.CountAsync(null);
        await using var connection = new SqlConnection(FormsDatabase.ElevatedConnectionString());
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
            Assert.Equal(before, await FormsDatabase.CountAsync(null));
        }
        finally
        {
            command.CommandText = "DROP TRIGGER IF EXISTS application_counts_fail_for_test";
            await command.ExecuteNonQueryAsync();
        }
    }

    [Fact]
    public async Task A_silent_mail_server_is_refused_within_the_timeout()
    {
        await FormsDatabase.EnsureCareersAddressAsync();
        var before = await FormsDatabase.CountAsync(null);
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        using var accept = new CancellationTokenSource();
        var held = Task.Run(async () =>
        {
            while (!accept.IsCancellationRequested)
            {
                var incoming = await listener.AcceptTcpClientAsync(accept.Token);
                _ = incoming;
            }
        }, accept.Token);
        await using var factory = new SilentSmtpFactory(port);
        var client = factory.CreateClient();
        var watch = Stopwatch.StartNew();
        var response = await PostApplyAsync(client, "Silent", UniqueEmail("silent"), "hello", Pdf("silent"), null);
        watch.Stop();
        accept.Cancel();
        listener.Stop();
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.Status);
        Assert.Contains("data-code=\"email_failed\"", response.Body, StringComparison.Ordinal);
        Assert.StartsWith("<!DOCTYPE html>", response.Body, StringComparison.Ordinal);
        Assert.True(watch.Elapsed < TimeSpan.FromSeconds(8), watch.Elapsed.ToString());
        Assert.Equal(before, await FormsDatabase.CountAsync(null));
        try { await held; } catch (OperationCanceledException) { }
    }

    [Fact]
    public async Task The_same_application_can_be_sent_again_after_two_minutes()
    {
        await FormsDatabase.EnsureCareersAddressAsync();
        await using var factory = new ClockedApplyFactory();
        var client = factory.CreateClient();
        var address = UniqueEmail("again");
        var pdf = Pdf("again");
        Assert.Equal(HttpStatusCode.Created, (await PostApplyAsync(client, "Again", address, "hello", pdf, null)).Status);
        Assert.Equal(HttpStatusCode.Created, (await PostApplyAsync(client, "Again", address, "hello", pdf, null)).Status);
        Assert.Equal(1, factory.Sender.Sent.Count(message => message.ReplyTo == address));
        factory.Clock.Advance(ApplyDedupe.Window);
        Assert.Equal(HttpStatusCode.Created, (await PostApplyAsync(client, "Again", address, "hello", pdf, null)).Status);
        Assert.Equal(2, factory.Sender.Sent.Count(message => message.ReplyTo == address));
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
    public async Task Plus_tags_share_one_email_bucket_and_the_reply_address_is_unchanged()
    {
        await FormsDatabase.EnsureCareersAddressAsync();
        await using var factory = new RecordingLimitedFactory();
        var client = factory.CreateClient();
        var local = "plus-" + Guid.NewGuid().ToString("N")[..8];
        var plain = local + "@digitalhub.test";
        var tagged = local + "+Team@digitalhub.test";
        var other = local + "+other@digitalhub.test";
        Assert.Equal(HttpStatusCode.Created, (await PostApplyAsync(client, "Plus", plain, "one", Pdf("plus-a"), null)).Status);
        Assert.Equal(HttpStatusCode.Created, (await PostApplyAsync(client, "Plus", tagged, "two", Pdf("plus-b"), null)).Status);
        var third = await PostApplyAsync(client, "Plus", other, "three", Pdf("plus-c"), null);
        Assert.Equal(HttpStatusCode.TooManyRequests, third.Status);
        Assert.Contains("data-code=\"rate_limited\"", third.Body, StringComparison.Ordinal);
        Assert.Equal(2, factory.Sender.Sent.Count);
        Assert.Contains(factory.Sender.Sent, message => message.ReplyTo == tagged);
        Assert.Contains(factory.Sender.Sent, message => message.ReplyTo == plain);
    }

    [Fact]
    public async Task A_malformed_mailbox_is_refused_without_a_send()
    {
        var before = await FormsDatabase.CountAsync(null);
        var sent = _recording.Sender.Sent.Count;
        await FormsDatabase.SetMailboxAsync("not-an-address", null);
        try
        {
            var response = await PostApplyAsync(_mail, "Bad Box", UniqueEmail("badbox"), "hello", Pdf("badbox"), null);
            Assert.Equal(HttpStatusCode.ServiceUnavailable, response.Status);
            Assert.Contains("data-code=\"not_accepting\"", response.Body, StringComparison.Ordinal);
            Assert.Contains("Applications are not being accepted just now.", response.Body, StringComparison.Ordinal);
            Assert.DoesNotContain("not-an-address", response.Body, StringComparison.Ordinal);
            Assert.DoesNotContain("email_failed", response.Body, StringComparison.Ordinal);
            Assert.Equal(sent, _recording.Sender.Sent.Count);
            Assert.Equal(before, await FormsDatabase.CountAsync(null));
        }
        finally
        {
            await FormsDatabase.SetMailboxAsync("careers@digitalhub.test", null);
        }
    }

    [Fact]
    public async Task Concurrent_applications_each_count()
    {
        await FormsDatabase.EnsureCareersAddressAsync();
        var vacancy = await FormsDatabase.InsertVacancyAsync("published");
        try
        {
            var before = await FormsDatabase.CountAsync(vacancy);
            var tasks = Enumerable.Range(0, 6).Select(index => PostApplyAsync(_client, "Concurrent " + index, UniqueEmail("con" + index), "m", Pdf("con" + index), vacancy)).ToArray();
            var results = await Task.WhenAll(tasks);
            Assert.All(results, result => Assert.Equal(HttpStatusCode.Created, result.Status));
            Assert.Equal(before + 6, await FormsDatabase.CountAsync(vacancy));
        }
        finally
        {
            await FormsDatabase.DeleteVacancyAsync(vacancy);
        }
    }

    private static async Task<(HttpStatusCode Status, string Body, bool SetCookie)> PostFieldsAsync(
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
        return (response.StatusCode, await response.Content.ReadAsStringAsync(), response.Headers.Contains("Set-Cookie"));
    }

    private static Task<(HttpStatusCode Status, string Body, bool SetCookie)> PostApplyAsync(HttpClient client, string name, string email, string message, byte[] file, Guid? vacancy, string fileName = "cv.pdf", string? website = null) =>
        PostFieldsAsync(client, name, email, message, file, vacancy, fileName, website);

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

public class RecordingApplyFactory : PublicApiFactory
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

public sealed class RecordingLimitedFactory : RecordingApplyFactory
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.UseSetting("Apply:EmailPermitLimit", "2");
    }
}

public sealed class ApplyLimitedFactory : PublicApiFactory
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.UseSetting("Apply:IpPermitLimit", "2");
        builder.UseSetting("Apply:EmailPermitLimit", "2");
    }
}

/// <summary>Points Email at a local listener that accepts and never answers, on the port the test was given.</summary>
public sealed class SilentSmtpFactory(int port) : PublicApiFactory
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.UseSetting("Email:Host", "127.0.0.1");
        builder.UseSetting("Email:Port", port.ToString(System.Globalization.CultureInfo.InvariantCulture));
        builder.UseSetting("Email:TimeoutSeconds", "2");
        builder.UseSetting("Email:From", "careers@digitalhub.test");
    }
}

public sealed class ClockedApplyFactory : RecordingApplyFactory
{
    public FakeClock Clock { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.ConfigureTestServices(services => services.AddSingleton<TimeProvider>(Clock));
    }
}

public sealed class FakeClock : TimeProvider
{
    private DateTimeOffset _now = DateTimeOffset.UtcNow;

    public override DateTimeOffset GetUtcNow() => _now;

    public void Advance(TimeSpan by) => _now += by;
}

sealed class ShortLengthContent : HttpContent
{
    private readonly byte[] _bytes;
    private readonly long _declared;
    public ShortLengthContent(byte[] bytes, long declared)
    {
        _bytes = bytes;
        _declared = declared;
    }

    protected override bool TryComputeLength(out long length)
    {
        length = _declared;
        return true;
    }

    protected override Task SerializeToStreamAsync(Stream stream, TransportContext? context) => stream.WriteAsync(_bytes).AsTask();
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
