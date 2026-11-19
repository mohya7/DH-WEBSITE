using Microsoft.Data.SqlClient;

namespace DigitalHub.PublicApi.Tests;

/// <summary>
/// Test fixtures for the forms' four tables, in parameterised ADO.NET on the same
/// restricted test login. They never go through the host's context, so they keep
/// working in ISO-3, when the host's own login can no longer read contact_requests.
/// </summary>
internal static class FormsDatabase
{
    public const string CareersAddress = "careers@digitalhub.test";

    private static readonly string Connection = PublicApiFactory.TestConnectionString();

    /// <summary>The elevated connection, only to create and drop the count-failure trigger.</summary>
    public static string ElevatedConnectionString() => PublicApiFactory.ElevatedTestConnectionString();

    /// <summary>Inserts a vacancy with every NOT NULL column, in the given status, and returns its id.</summary>
    public static async Task<Guid> InsertVacancyAsync(string status)
    {
        var id = Guid.NewGuid();
        var now = DateTime.UtcNow;
        await using var connection = new SqlConnection(Connection);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO vacancies (id, slug, title, status, summary, department, location, employment_type,
                about_role, key_responsibilities, required_skills, nice_to_have, role_offers, interview_stages,
                featured, no_index, sort_order, version, created_at, updated_at, published_at, ended_at)
            VALUES (@id, @slug, @title, @status, N'A role.', N'', N'', N'',
                N'', N'', N'', N'', N'', N'[]',
                0, 0, 0, 1, @now, @now, @published, @ended)
            """;
        command.Parameters.AddWithValue("@id", id);
        command.Parameters.AddWithValue("@slug", "public-api-" + id.ToString("N"));
        command.Parameters.AddWithValue("@title", "Public API " + id.ToString("N")[..8]);
        command.Parameters.AddWithValue("@status", status);
        command.Parameters.AddWithValue("@now", now);
        command.Parameters.AddWithValue("@published", status == "draft" ? DBNull.Value : now);
        command.Parameters.AddWithValue("@ended", status == "ended" ? now : DBNull.Value);
        await command.ExecuteNonQueryAsync();
        return id;
    }

    /// <summary>Removes a fixture vacancy; the cascade removes its application_counts rows.</summary>
    public static async Task DeleteVacancyAsync(Guid id)
    {
        await using var connection = new SqlConnection(Connection);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "DELETE FROM vacancies WHERE id = @id";
        command.Parameters.AddWithValue("@id", id);
        await command.ExecuteNonQueryAsync();
    }

    /// <summary>Removes a fixture contact request by id (ISO-3's permission test cleans up with it).</summary>
    public static async Task DeleteContactAsync(Guid id)
    {
        await using var connection = new SqlConnection(Connection);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "DELETE FROM contact_requests WHERE id = @id";
        command.Parameters.Add(new SqlParameter("@id", System.Data.SqlDbType.UniqueIdentifier) { Value = id });
        await command.ExecuteNonQueryAsync();
    }

    /// <summary>Today's (UTC) count for the vacancy, or for general applications when null.</summary>
    public static async Task<int> CountAsync(Guid? vacancyId)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow).ToDateTime(TimeOnly.MinValue);
        await using var connection = new SqlConnection(Connection);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = vacancyId is null
            ? "SELECT COALESCE(SUM([count]), 0) FROM application_counts WHERE vacancy_id IS NULL AND applied_on = @day"
            : "SELECT COALESCE(SUM([count]), 0) FROM application_counts WHERE vacancy_id = @vacancy AND applied_on = @day";
        command.Parameters.Add(new SqlParameter("@day", System.Data.SqlDbType.Date) { Value = today });
        if (vacancyId is Guid id)
            command.Parameters.Add(new SqlParameter("@vacancy", System.Data.SqlDbType.UniqueIdentifier) { Value = id });
        return Convert.ToInt32(await command.ExecuteScalarAsync());
    }

    /// <summary>Every column of every contact request with this email.</summary>
    public static async Task<List<Dictionary<string, object?>>> ContactByEmailAsync(string email)
    {
        await using var connection = new SqlConnection(Connection);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT * FROM contact_requests WHERE email = @email";
        command.Parameters.Add(new SqlParameter("@email", System.Data.SqlDbType.NVarChar, 320) { Value = email });
        var rows = new List<Dictionary<string, object?>>();
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var row = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
            for (var index = 0; index < reader.FieldCount; index++)
                row[reader.GetName(index)] = reader.IsDBNull(index) ? null : reader.GetValue(index);
            rows.Add(row);
        }

        return rows;
    }

    public static async Task<int> ContactCountAsync()
    {
        await using var connection = new SqlConnection(Connection);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT COUNT(*) FROM contact_requests";
        return Convert.ToInt32(await command.ExecuteScalarAsync());
    }

    /// <summary>
    /// Sets the careers mailbox on the first settings row, and the main email when
    /// one is given; inserts a row when there is none, as CareersTests does.
    /// </summary>
    public static async Task SetMailboxAsync(string? careers, string? email)
    {
        await using var connection = new SqlConnection(Connection);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            IF EXISTS (SELECT 1 FROM site_settings)
                UPDATE site_settings
                SET careers_email = @careers, email = COALESCE(@email, email)
                WHERE id = (SELECT TOP (1) id FROM site_settings ORDER BY id);
            ELSE
                INSERT INTO site_settings (id, version, careers_email, email)
                VALUES (NEWID(), 0, @careers, @email);
            """;
        command.Parameters.Add(new SqlParameter("@careers", System.Data.SqlDbType.NVarChar, 320) { Value = (object?)careers ?? DBNull.Value });
        command.Parameters.Add(new SqlParameter("@email", System.Data.SqlDbType.NVarChar, 320) { Value = (object?)email ?? DBNull.Value });
        await command.ExecuteNonQueryAsync();
    }

    public static Task EnsureCareersAddressAsync() => SetMailboxAsync(CareersAddress, null);
}
