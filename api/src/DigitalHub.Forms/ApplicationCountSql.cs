using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace DigitalHub.Forms;

/// <summary>
/// The per-day application count. One copy, taking the context's database, so the
/// admin API and ISO-2's public API run the same MERGE, retry and failure rule.
/// </summary>
public static class ApplicationCountSql
{
    public static async Task IncrementAsync(DatabaseFacade database, Guid? vacancyId, DateOnly day, CancellationToken cancellationToken)
    {
        var vacancy = new SqlParameter("@vacancy", (object?)vacancyId ?? DBNull.Value) { SqlDbType = System.Data.SqlDbType.UniqueIdentifier };
        var applied = new SqlParameter("@day", day.ToDateTime(TimeOnly.MinValue)) { SqlDbType = System.Data.SqlDbType.Date };
        var id = new SqlParameter("@id", Guid.NewGuid());
        for (var attempt = 0; attempt < 2; attempt++)
        {
            try
            {
                await using var transaction = await database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, cancellationToken);
                await database.ExecuteSqlRawAsync(
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

    public static bool CountFailed(Exception exception) =>
        exception is SqlException or DbUpdateException || exception.InnerException is SqlException or DbUpdateException;
}
