using DigitalHub.Forms;
using Microsoft.EntityFrameworkCore;

namespace DigitalHub.PublicApi.Data;

/// <summary>
/// The forms' port (ISO-1, IFormsData) over the public API's own context: the
/// same reads, insert and shared count the admin API's ContentFormsData runs.
/// </summary>
public sealed class PublicFormsData(PublicFormsDbContext db) : IFormsData
{
    public async Task AddContactRequestAsync(ContactSubmission submission, CancellationToken cancellationToken)
    {
        db.ContactRequests.Add(new ContactRequest
        {
            Id = submission.Id,
            Name = submission.Name,
            Organization = submission.Organization,
            Role = submission.Role,
            Email = submission.Email,
            Situation = submission.Situation,
            Message = submission.Message,
            Status = submission.Status,
            CreatedAt = submission.CreatedAt,
        });
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<FormsVacancy?> FindVacancyAsync(Guid id, CancellationToken cancellationToken)
    {
        var vacancy = await db.Vacancies.AsNoTracking()
            .Where(item => item.Id == id)
            .Select(item => new { item.Id, item.Title, item.Status })
            .FirstOrDefaultAsync(cancellationToken);
        // Ignoring case matches the admin's Enum.Parse(..., ignoreCase: true).
        return vacancy is null
            ? null
            : new FormsVacancy(vacancy.Id, vacancy.Title, string.Equals(vacancy.Status, "published", StringComparison.OrdinalIgnoreCase));
    }

    public Task<FormsMailboxes?> MailboxesAsync(CancellationToken cancellationToken) =>
        db.SiteSettings.AsNoTracking()
            .OrderBy(item => item.Id)
            .Select(item => new FormsMailboxes(item.CareersEmail, item.Email))
            .FirstOrDefaultAsync(cancellationToken);

    public Task IncrementApplicationCountAsync(Guid? vacancyId, DateOnly day, CancellationToken cancellationToken) =>
        ApplicationCountSql.IncrementAsync(db.Database, vacancyId, day, cancellationToken);
}
