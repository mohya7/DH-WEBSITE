namespace DigitalHub.Api.Content;

public sealed record EmailAttachment(string FileName, string ContentType, byte[] Content);

public sealed record EmailMessage(string To, string Subject, string Body, string? ReplyTo, EmailAttachment? Attachment);

public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken);
}

/// <summary>
/// SMTP from configuration. An empty Email:Host is a local run: the message is
/// not sent and the log line carries none of it.
/// </summary>
public sealed class SmtpEmailSender(IConfiguration configuration, ILogger<SmtpEmailSender> logger) : IEmailSender
{
    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        var host = configuration["Email:Host"];
        if (string.IsNullOrWhiteSpace(host))
        {
            logger.LogInformation("email not sent (local)");
            return;
        }

        using var mail = new System.Net.Mail.MailMessage();
        try
        {
            mail.From = new System.Net.Mail.MailAddress(configuration["Email:From"] ?? "careers@digitalhub.com.eg");
            mail.To.Add(new System.Net.Mail.MailAddress(message.To));
            if (message.ReplyTo is not null)
                mail.ReplyToList.Add(new System.Net.Mail.MailAddress(message.ReplyTo));
        }
        catch (FormatException)
        {
            logger.LogWarning("careers mailbox is not a valid address");
            throw new EmailDeliveryException();
        }
        mail.Subject = message.Subject;
        mail.Body = message.Body;
        mail.IsBodyHtml = false;
        if (message.Attachment is not null)
        {
            var stream = new MemoryStream(message.Attachment.Content, writable: false);
            mail.Attachments.Add(new System.Net.Mail.Attachment(stream, message.Attachment.FileName, message.Attachment.ContentType));
        }

#pragma warning disable SYSLIB0014
        using var client = new System.Net.Mail.SmtpClient(host, configuration.GetValue("Email:Port", 587))
        {
            EnableSsl = true,
        };
#pragma warning restore SYSLIB0014
        var user = configuration["Email:User"];
        if (!string.IsNullOrEmpty(user))
            client.Credentials = new System.Net.NetworkCredential(user, configuration["Email:Password"]);

        var timeoutSeconds = Math.Clamp(configuration.GetValue("Email:TimeoutSeconds", 15), 1, 120);
        client.Timeout = timeoutSeconds * 1000;

        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(TimeSpan.FromSeconds(timeoutSeconds));
            await client.SendMailAsync(mail, timeout.Token);
        }
        catch (Exception exception) when (exception is System.Net.Mail.SmtpException or InvalidOperationException or IOException
            || (exception is OperationCanceledException && !cancellationToken.IsCancellationRequested))
        {
            logger.LogWarning("application email failed");
            throw new EmailDeliveryException();
        }
    }
}

public sealed class EmailDeliveryException : Exception;
