using System.Net.Mail;
using System.Text.RegularExpressions;
using DigitalHub.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace DigitalHub.Api.Content;

public sealed class PublicContactStore(ContentDbContext db)
{
    public static readonly HashSet<string> Situations = new(StringComparer.OrdinalIgnoreCase)
    {
        "gov",
        "dx",
        "dex",
        "other",
    };

    public const int MaxName = 120;
    public const int MaxOrganization = 160;
    public const int MaxRole = 120;
    public const int MaxEmail = 160;
    public const int MaxSituation = 40;
    public const int MaxMessage = 4000;
    public const int MinMessage = 10;

    public async Task<ContentOutcome> SubmitAsync(PublicContactRequest request, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(request.Website))
            return ContentOutcome.Ok(new { ok = true }, StatusCodes.Status201Created);

        var errors = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        var situation = (request.Situation ?? "").Trim().ToLowerInvariant();
        var name = (request.Name ?? "").Trim();
        var organization = (request.Organization ?? request.Org ?? "").Trim();
        var role = string.IsNullOrWhiteSpace(request.Role) ? null : request.Role.Trim();
        var email = (request.Email ?? "").Trim().ToLowerInvariant();
        var message = (request.Message ?? "").Trim();

        if (string.IsNullOrEmpty(situation) || situation.Length > MaxSituation || !Situations.Contains(situation))
            Add(errors, "situation", "Please select what you are looking for.");
        if (string.IsNullOrEmpty(name))
            Add(errors, "name", "Name is required.");
        else if (name.Length > MaxName)
            Add(errors, "name", "Name is too long.");
        if (string.IsNullOrEmpty(organization))
            Add(errors, "organization", "Organisation is required.");
        else if (organization.Length > MaxOrganization)
            Add(errors, "organization", "Organisation is too long.");
        if (role is not null && role.Length > MaxRole)
            Add(errors, "role", "Role is too long.");
        if (string.IsNullOrEmpty(email))
            Add(errors, "email", "Email is required.");
        else if (email.Length > MaxEmail || !IsEmail(email))
            Add(errors, "email", "Enter a valid email address.");
        if (string.IsNullOrEmpty(message))
            Add(errors, "message", "Message is required.");
        else if (message.Length < MinMessage)
            Add(errors, "message", "Please share a bit more detail in your message.");
        else if (message.Length > MaxMessage)
            Add(errors, "message", "Message is too long.");

        if (errors.Count > 0)
        {
            return ContentOutcome.Fail(
                StatusCodes.Status400BadRequest,
                "validation_failed",
                "One or more fields are invalid.",
                errors.ToDictionary(pair => pair.Key, pair => pair.Value.ToArray()));
        }

        db.ContactRequests.Add(new ContactRequest
        {
            Id = Guid.NewGuid(),
            Name = name,
            Organization = organization,
            Role = role,
            Email = email,
            Situation = situation,
            Message = message,
            Status = "new",
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync(cancellationToken);
        return ContentOutcome.Ok(new { ok = true }, StatusCodes.Status201Created);
    }

    private static bool IsEmail(string value)
    {
        try
        {
            _ = new MailAddress(value);
            return value.Contains('@', StringComparison.Ordinal)
                && Regex.IsMatch(value, @"^[^\s@]+@[^\s@]+\.[^\s@]+$", RegexOptions.CultureInvariant);
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private static void Add(Dictionary<string, List<string>> errors, string field, string message)
    {
        if (!errors.TryGetValue(field, out var list))
        {
            list = [];
            errors[field] = list;
        }

        list.Add(message);
    }
}

public sealed class PublicContactRequest
{
    public string? Situation { get; set; }
    public string? Name { get; set; }
    public string? Organization { get; set; }
    public string? Org { get; set; }
    public string? Role { get; set; }
    public string? Email { get; set; }
    public string? Message { get; set; }

    /// <summary>Honeypot. When filled, the request succeeds and stores nothing.</summary>
    public string? Website { get; set; }
}
