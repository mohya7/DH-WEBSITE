using DigitalHub.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace DigitalHub.Api.Content;

public static class StudioEdits
{
    public static async Task<bool> HasStartedAsync(ContentDbContext database, CancellationToken cancellationToken) =>
        await database.Revisions.AnyAsync(cancellationToken)
        || await database.WorkingCopies.AnyAsync(cancellationToken)
        || await database.AuditLog.AnyAsync(cancellationToken);
}
