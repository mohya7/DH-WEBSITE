using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using DigitalHub.Api.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace DigitalHub.Api.Content;

public sealed class ApplicationIntake(ContentDbContext db, IEmailSender email, ApplyThrottle throttle, ApplyDedupe dedupe, ILogger<ApplicationIntake> logger)
{
    public const string Accepted = "accepted";
    public const string Rejected = "The form could not be accepted.";
    public const string CvRejected = "The CV could not be accepted. Send a PDF or Word document up to 5 MB.";

    private static readonly Regex EmailPattern = new(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.CultureInvariant | RegexOptions.Compiled);

    public async Task<IResult> SubmitAsync(HttpRequest request, string remoteIp, CancellationToken cancellationToken)
    {
        if (!request.HasFormContentType)
            return Problem(StatusCodes.Status400BadRequest, "invalid_form", Rejected);

        IFormCollection form;
        try
        {
            form = await request.ReadFormAsync(cancellationToken);
        }
        catch (Exception exception) when (exception is BadHttpRequestException or InvalidDataException or IOException)
        {
            var status = exception is BadHttpRequestException bad ? bad.StatusCode : StatusCodes.Status400BadRequest;
            return status == StatusCodes.Status413PayloadTooLarge
                ? Problem(status, "too_large", CvRejected)
                : Problem(StatusCodes.Status400BadRequest, "invalid_form", Rejected);
        }
        if (Duplicate(form))
            return Problem(StatusCodes.Status400BadRequest, "invalid_form", Rejected);

        if (!string.IsNullOrWhiteSpace(form["website"]))
            return Page(StatusCodes.Status201Created, "accepted", "Your application has been sent.");

        var name = form["name"].ToString().Trim();
        var emailAddress = form["email"].ToString().Trim();
        var phone = form["phone"].ToString().Trim();
        var message = form["message"].ToString().Trim();
        var consent = form["consent"].ToString().Trim();
        var vacancyText = form["vacancyId"].ToString().Trim();
        var file = form.Files.GetFile("cv");

        if (!ValidText(name, 200) || !ValidEmail(emailAddress) || !ValidPhone(phone) || message.Length > 1000
            || consent is not ("yes" or "true" or "on") || file is null)
            return Problem(StatusCodes.Status400BadRequest, "invalid_form", Rejected);

        Guid? vacancyId = null;
        string vacancyTitle = "General application";
        if (vacancyText.Length > 0)
        {
            if (!Guid.TryParse(vacancyText, out var parsed))
                return Problem(StatusCodes.Status400BadRequest, "closed", "This position is no longer open.");
            var vacancy = await db.Vacancies.AsNoTracking().FirstOrDefaultAsync(item => item.Id == parsed, cancellationToken);
            if (vacancy is null || vacancy.Status != ContentStatus.Published)
                return Problem(StatusCodes.Status400BadRequest, "closed", "This position is no longer open.");
            vacancyId = vacancy.Id;
            vacancyTitle = vacancy.Title.Replace("\r", " ").Replace("\n", " ");
        }

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (extension is not (".pdf" or ".doc" or ".docx"))
            return Problem(StatusCodes.Status400BadRequest, "invalid_cv", CvRejected);

        byte[] bytes;
        await using (var source = file.OpenReadStream())
        {
            using var buffer = new MemoryStream();
            var rented = System.Buffers.ArrayPool<byte>.Shared.Rent(81920);
            try
            {
                int read;
                while ((read = await source.ReadAsync(rented, cancellationToken)) > 0)
                {
                    if (buffer.Length + read > CvFile.MaxBytes)
                        return Problem(StatusCodes.Status413PayloadTooLarge, "too_large", CvRejected);
                    buffer.Write(rented, 0, read);
                }
            }
            finally
            {
                System.Buffers.ArrayPool<byte>.Shared.Return(rented);
            }

            bytes = buffer.ToArray();
        }

        if (bytes.Length == 0 || !CvFile.Matches(extension, bytes))
            return Problem(StatusCodes.Status400BadRequest, "invalid_cv", CvRejected);

        var emailKey = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(emailAddress.ToLowerInvariant())));
        var throttleKey = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(ThrottleEmail(emailAddress))));
        if (!throttle.Allow(remoteIp, throttleKey))
            return Problem(StatusCodes.Status429TooManyRequests, "rate_limited", "Too many applications from this address. Try again later.");

        var careers = await CareersAddressAsync(cancellationToken);
        if (careers is null || !Mailbox(careers))
        {
            if (careers is not null)
                logger.LogWarning("careers mailbox is not a valid address");
            return Problem(StatusCodes.Status503ServiceUnavailable, "not_accepting", "Applications are not being accepted just now.");
        }

        var dedupeKey = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(string.Join('\n', emailKey, vacancyId?.ToString("D") ?? "", name, phone, message, Convert.ToHexString(SHA256.HashData(bytes))))));
        var gate = dedupe.Gate(dedupeKey);
        await gate.WaitAsync(cancellationToken);
        try
        {
            if (dedupe.RecentlySeen(dedupeKey))
                return Page(StatusCodes.Status201Created, "accepted", "Your application has been sent.");

            var attachmentName = CvFile.SafeFileName(file.FileName, extension);
            var body = new StringBuilder()
                .Append("Name: ").Append(name).Append('\n')
                .Append("Email: ").Append(emailAddress).Append('\n')
                .Append("Phone: ").Append(phone).Append('\n')
                .Append("Position: ").Append(vacancyTitle).Append('\n')
                .Append('\n')
                .Append(message)
                .ToString();

            try
            {
                await email.SendAsync(
                    new EmailMessage(careers, "Application: " + vacancyTitle, body, emailAddress, new EmailAttachment(attachmentName, CvFile.ContentType(extension), bytes)),
                    cancellationToken);
            }
            catch (EmailDeliveryException)
            {
                return Problem(StatusCodes.Status503ServiceUnavailable, "email_failed", "We could not send your application. Please email us directly at " + careers + ".");
            }

            // Recorded before the count, so a retry does not send again when the count fails.
            dedupe.Remember(dedupeKey);
            try
            {
                await IncrementAsync(vacancyId, DateOnly.FromDateTime(DateTime.UtcNow), cancellationToken);
            }
            catch (Exception exception) when (CountFailed(exception))
            {
                logger.LogWarning("application count was not recorded");
                return Page(StatusCodes.Status201Created, "accepted", "Your application has been sent.");
            }

            return Page(StatusCodes.Status201Created, "accepted", "Your application has been sent.");
        }
        finally
        {
            gate.Release();
        }
    }

    private static bool Duplicate(IFormCollection form)
    {
        foreach (var key in new[] { "name", "email", "phone", "message", "consent", "website", "vacancyId" })
        {
            if (form[key].Count > 1)
                return true;
        }

        return form.Files.Count(file => file.Name == "cv") > 1;
    }

    private static bool ValidText(string value, int max) =>
        value.Length is > 0 and var length && length <= max && value.IndexOfAny(['\r', '\n']) < 0;

    private static bool Mailbox(string value)
    {
        try
        {
            return new MailAddress(value).Address == value;
        }
        catch (FormatException)
        {
            return false;
        }
    }

    /// <summary>The throttle bucket only. Lower case, and the +tag in the local part is ignored. Reply-To stays the address as typed.</summary>
    private static string ThrottleEmail(string email)
    {
        var lower = email.ToLowerInvariant();
        var at = lower.IndexOf('@');
        if (at <= 0)
            return lower;
        var plus = lower.IndexOf('+', 0, at);
        return plus < 0 ? lower : string.Concat(lower.AsSpan(0, plus), lower.AsSpan(at));
    }

    private static bool ValidEmail(string value)
    {
        if (value.Length is 0 or > 200 || value.IndexOfAny(['\r', '\n']) >= 0 || !EmailPattern.IsMatch(value))
            return false;
        try
        {
            return new MailAddress(value).Address == value;
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private static bool ValidPhone(string value) =>
        value.Length <= 40 && value.IndexOfAny(['\r', '\n']) < 0 && value.All(character => char.IsDigit(character) || character is ' ' or '+' or '-' or '(' or ')');

    private async Task<string?> CareersAddressAsync(CancellationToken cancellationToken)
    {
        var settings = await db.SiteSettings.AsNoTracking().OrderBy(item => item.Id).FirstOrDefaultAsync(cancellationToken);
        var address = settings?.CareersEmail?.Trim();
        if (string.IsNullOrEmpty(address))
            address = settings?.Email?.Trim();
        return string.IsNullOrEmpty(address) ? null : address;
    }

    private async Task IncrementAsync(Guid? vacancyId, DateOnly day, CancellationToken cancellationToken)
    {
        var vacancy = new SqlParameter("@vacancy", (object?)vacancyId ?? DBNull.Value) { SqlDbType = System.Data.SqlDbType.UniqueIdentifier };
        var applied = new SqlParameter("@day", day.ToDateTime(TimeOnly.MinValue)) { SqlDbType = System.Data.SqlDbType.Date };
        var id = new SqlParameter("@id", Guid.NewGuid());
        for (var attempt = 0; attempt < 2; attempt++)
        {
            try
            {
                await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, cancellationToken);
                await db.Database.ExecuteSqlRawAsync(
                    """
                    MERGE application_counts WITH (HOLDLOCK) AS target
                    USING (SELECT @vacancy AS vacancy_id, @day AS applied_on) AS source
                    ON target.applied_on = source.applied_on
                     AND ((target.vacancy_id = source.vacancy_id) OR (target.vacancy_id IS NULL AND source.vacancy_id IS NULL))
                    WHEN MATCHED THEN UPDATE SET [count] = target.[count] + 1
                    WHEN NOT MATCHED THEN INSERT (id, vacancy_id, applied_on, [count]) VALUES (@id, source.vacancy_id, source.applied_on, 1);
                    """,
                    [vacancy, applied, id],
                    cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return;
            }
            catch (Exception exception) when (attempt == 0 && CountFailed(exception))
            {
                id.Value = Guid.NewGuid();
            }
        }
    }

    private static bool CountFailed(Exception exception) =>
        exception is SqlException or DbUpdateException || exception.InnerException is SqlException or DbUpdateException;

    private static IResult Problem(int status, string code, string title) => Page(status, code, title);

    private static IResult Page(int status, string code, string message) => ApplyPage.Result(status, code, message);
}
