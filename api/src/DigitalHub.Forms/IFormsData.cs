namespace DigitalHub.Forms;

/// <summary>
/// The four tables the forms touch (ADR 0001 point 3), behind one port. The admin
/// API implements it over its own context today; ISO-2's public API over its own.
/// </summary>
public interface IFormsData
{
    Task AddContactRequestAsync(ContactSubmission submission, CancellationToken cancellationToken);

    Task<FormsVacancy?> FindVacancyAsync(Guid id, CancellationToken cancellationToken);

    Task<FormsMailboxes?> MailboxesAsync(CancellationToken cancellationToken);

    Task IncrementApplicationCountAsync(Guid? vacancyId, DateOnly day, CancellationToken cancellationToken);
}

public sealed record ContactSubmission(Guid Id, string Name, string Organization, string? Role,
    string Email, string Situation, string Message, string Status, DateTime CreatedAt);

public sealed record FormsVacancy(Guid Id, string Title, bool Published);

public sealed record FormsMailboxes(string? CareersEmail, string? Email);
