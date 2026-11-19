using DigitalHub.Api.Data;
using DigitalHub.Forms;
using Microsoft.EntityFrameworkCore;

namespace DigitalHub.Api.Content;

/// <summary>
/// The forms' tables over the admin API's context: the same queries, insert and
/// count the contact store and the apply intake ran on it directly before ISO-1.
/// </summary>
public sealed class ContentFormsData(ContentDbContext db) : IFormsData
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
        var vacancy = await db.Vacancies.AsNoTracking().FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        return vacancy is null ? null : new FormsVacancy(vacancy.Id, vacancy.Title, vacancy.Status == ContentStatus.Published);
    }

    public async Task<FormsMailboxes?> MailboxesAsync(CancellationToken cancellationToken)
    {
        var settings = await db.SiteSettings.AsNoTracking().OrderBy(item => item.Id).FirstOrDefaultAsync(cancellationToken);
        return settings is null ? null : new FormsMailboxes(settings.CareersEmail, settings.Email);
    }

    public Task IncrementApplicationCountAsync(Guid? vacancyId, DateOnly day, CancellationToken cancellationToken) =>
        ApplicationCountSql.IncrementAsync(db.Database, vacancyId, day, cancellationToken);
}
