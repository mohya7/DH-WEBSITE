using System.Data;
using DigitalHub.PublicApi.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit.Abstractions;

namespace DigitalHub.PublicApi.Tests;

/// <summary>
/// ISO-3 (ADR 0001, point 3): the public forms API's login, dh_public_forms, holds
/// only INSERT on contact_requests; SELECT, INSERT, UPDATE on application_counts;
/// and SELECT on vacancies and site_settings. Like AuditLogPermissionTests, every
/// probe runs as the host's own login: the connection string comes from the
/// host's PublicFormsDbContext, so the test checks whatever login the public API
/// really runs on. Setup, inspection and clean-up use the elevated connection.
/// The grants come from the migration (the role) and the environment step (the
/// user and its membership), so this test fails on a catalog where the login
/// holds more, or less.
/// </summary>
[Collection("PublicFormsSql")]
public sealed class PublicFormsPermissionTests : IClassFixture<PublicApiFactory>
{
    private const int PermissionDenied = 229;
    private const int DatabasePermissionDenied = 262;
    private const string FormsLogin = "dh_public_forms";
    private const string FormsRole = "dh_public_forms_role";

    /// <summary>The six (table, operation) pairs the owner granted; every other pair is denied.</summary>
    private static readonly HashSet<string> Granted = new(StringComparer.OrdinalIgnoreCase)
    {
        "application_counts:INSERT",
        "application_counts:SELECT",
        "application_counts:UPDATE",
        "contact_requests:INSERT",
        "site_settings:SELECT",
        "vacancies:SELECT",
    };

    /// <summary>The 26 tables of the model snapshot (plan 2.5); the sweep in T-4 covers any added later.</summary>
    private static readonly string[] KnownTables =
    [
        "AspNetRoleClaims", "AspNetRoles", "AspNetUserClaims", "AspNetUserLogins", "AspNetUserRoles",
        "AspNetUserTokens", "AspNetUsers", "RefreshTokens", "application_counts", "audit_log", "blog_posts",
        "case_studies", "contact_requests", "media", "navigation_items", "news_items", "pages", "partners",
        "redirects", "revisions", "sections", "services", "site_settings", "team_members", "vacancies",
        "working_copies",
    ];

    private readonly PublicApiFactory _factory;
    private readonly ITestOutputHelper _output;

    public PublicFormsPermissionTests(PublicApiFactory factory, ITestOutputHelper output)
    {
        _factory = factory;
        _output = output;
    }

    // T-1
    [Fact]
    public async Task The_host_runs_as_dh_public_forms_in_no_fixed_role()
    {
        await using var connection = await OpenHostAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT SUSER_SNAME(), USER_NAME(), IS_SRVROLEMEMBER(N'sysadmin'),
                IS_ROLEMEMBER(N'db_owner'), IS_ROLEMEMBER(N'db_datareader'), IS_ROLEMEMBER(N'db_datawriter'),
                IS_ROLEMEMBER(N'db_ddladmin'), IS_ROLEMEMBER(N'db_securityadmin'), IS_ROLEMEMBER(N'db_accessadmin'),
                IS_ROLEMEMBER(N'dh_public_forms_role')
            """;
        await using var reader = await command.ExecuteReaderAsync();
        Assert.True(await reader.ReadAsync());
        Assert.Equal(FormsLogin, reader.GetString(0));
        Assert.Equal(FormsLogin, reader.GetString(1));
        Assert.Equal(0, NullableInt(reader, 2));
        for (var index = 3; index <= 8; index++)
            Assert.True(NullableInt(reader, index) == 0, $"IS_ROLEMEMBER('{reader.GetName(index)}') is not 0 for the host's login.");
        Assert.Equal(1, NullableInt(reader, 9));
        await reader.CloseAsync();

        await using var elevated = await OpenElevatedAsync();
        await using var roles = elevated.CreateCommand();
        roles.CommandText = """
            SELECT r.name
            FROM sys.database_role_members AS rm
            JOIN sys.database_principals AS r ON r.principal_id = rm.role_principal_id
            JOIN sys.database_principals AS m ON m.principal_id = rm.member_principal_id
            WHERE m.name = @member
            ORDER BY r.name
            """;
        roles.Parameters.Add(new SqlParameter("@member", SqlDbType.NVarChar, 128) { Value = FormsLogin });
        var names = new List<string>();
        await using var roleReader = await roles.ExecuteReaderAsync();
        while (await roleReader.ReadAsync())
            names.Add(roleReader.GetString(0));
        Assert.Equal(new[] { FormsRole }, names);
    }

    // T-2
    [Theory]
    [InlineData("AspNetUsers")]
    [InlineData("AspNetRoles")]
    [InlineData("AspNetUserRoles")]
    [InlineData("AspNetUserClaims")]
    [InlineData("AspNetRoleClaims")]
    [InlineData("AspNetUserLogins")]
    [InlineData("AspNetUserTokens")]
    [InlineData("RefreshTokens")]
    [InlineData("audit_log")]
    [InlineData("contact_requests")]
    public async Task It_cannot_read_users_roles_sessions_or_audit(string table)
    {
        await using var connection = await OpenHostAsync();
        var error = await RunRolledBackAsync(connection, $"SELECT TOP (1) 1 FROM dbo.{Quote(table)}");
        Assert.True(error == PermissionDenied, $"SELECT on {table}: expected error {PermissionDenied}, got {Describe(error)}.");
    }

    // T-3
    [Theory]
    [InlineData("blog_posts")]
    [InlineData("case_studies")]
    [InlineData("media")]
    [InlineData("navigation_items")]
    [InlineData("news_items")]
    [InlineData("pages")]
    [InlineData("partners")]
    [InlineData("redirects")]
    [InlineData("revisions")]
    [InlineData("sections")]
    [InlineData("services")]
    [InlineData("site_settings")]
    [InlineData("team_members")]
    [InlineData("vacancies")]
    [InlineData("working_copies")]
    public async Task It_cannot_change_content(string table)
    {
        var before = await ElevatedRowCountAsync(table);

        await using var connection = await OpenHostAsync();
        var failures = new List<string>();
        foreach (var (operation, sql) in new[]
        {
            ("INSERT", $"INSERT INTO dbo.{Quote(table)} DEFAULT VALUES"),
            ("UPDATE", $"UPDATE dbo.{Quote(table)} SET [id] = [id] WHERE 1 = 0"),
            ("DELETE", $"DELETE FROM dbo.{Quote(table)} WHERE 1 = 0"),
        })
        {
            var error = await RunRolledBackAsync(connection, sql);
            if (error != PermissionDenied)
                failures.Add($"{operation} on {table}: expected error {PermissionDenied}, got {Describe(error)}");
        }

        Assert.Equal(before, await ElevatedRowCountAsync(table));
        Assert.True(failures.Count == 0, string.Join(Environment.NewLine, failures));
    }

    // T-4
    [Fact]
    public async Task Every_table_operation_outside_the_four_grants_is_denied()
    {
        var tables = new List<(string Name, string? Probe)>();
        await using (var elevated = await OpenElevatedAsync())
        await using (var command = elevated.CreateCommand())
        {
            command.CommandText = """
                SELECT t.name,
                    (SELECT TOP (1) c.name
                     FROM sys.columns AS c
                     WHERE c.object_id = t.object_id
                       AND c.is_identity = 0
                       AND c.is_computed = 0
                       AND TYPE_NAME(c.system_type_id) NOT IN (N'timestamp', N'rowversion')
                     ORDER BY c.column_id) AS probe
                FROM sys.tables AS t
                WHERE t.schema_id = SCHEMA_ID(N'dbo')
                ORDER BY t.name
                """;
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
                tables.Add((reader.GetString(0), reader.IsDBNull(1) ? null : reader.GetString(1)));
        }

        var names = tables.Select(table => table.Name).ToHashSet(StringComparer.Ordinal);
        var missing = KnownTables.Where(table => !names.Contains(table)).ToList();
        Assert.True(missing.Count == 0, "Tables missing from DigitalHubContent_Test: " + string.Join(", ", missing));
        Assert.Contains("__EFMigrationsHistory", names);

        var failures = new List<string>();
        await using var connection = await OpenHostAsync();
        foreach (var (name, probe) in tables)
        {
            if (probe is null)
            {
                failures.Add($"{name}: no column that UPDATE ... SET can name (every column is identity, computed or rowversion)");
                continue;
            }

            foreach (var (operation, sql) in new[]
            {
                ("SELECT", $"SELECT TOP (1) 1 FROM dbo.{Quote(name)}"),
                ("INSERT", $"INSERT INTO dbo.{Quote(name)} DEFAULT VALUES"),
                ("UPDATE", $"UPDATE dbo.{Quote(name)} SET {Quote(probe)} = {Quote(probe)} WHERE 1 = 0"),
                ("DELETE", $"DELETE FROM dbo.{Quote(name)} WHERE 1 = 0"),
            })
            {
                if (Granted.Contains($"{name}:{operation}"))
                    continue;
                var error = await RunRolledBackAsync(connection, sql);
                if (error != PermissionDenied)
                    failures.Add($"{name} {operation}: expected error {PermissionDenied}, got {Describe(error)}");
            }
        }

        Assert.True(failures.Count == 0,
            $"{failures.Count} table operations were not denied:{Environment.NewLine}{string.Join(Environment.NewLine, failures)}");
    }

    // T-5
    [Fact]
    public async Task Its_permissions_are_exactly_the_four_grants()
    {
        var hostUser = await HostUserNameAsync();
        var probe = "iso3_probe_" + Guid.NewGuid().ToString("N")[..8];

        await using var elevated = await OpenElevatedAsync(pooling: false);
        await ExecuteAsync(elevated, $"CREATE USER {Quote(probe)} WITHOUT LOGIN;");
        try
        {
            var host = await EffectivePermissionsAsync(elevated, hostUser);
            var empty = await EffectivePermissionsAsync(elevated, probe);

            // (a) Exactly the six object grants.
            Assert.Equal(Granted.OrderBy(item => item, StringComparer.Ordinal), host.Objects);

            // (b) Nothing at schema or database level beyond what any new user holds.
            Assert.Equal(empty.Schema, host.Schema);
            Assert.Equal(empty.Database, host.Database);

            // (c) Nothing is granted to public.
            Assert.Empty(empty.Objects);
        }
        finally
        {
            await ExecuteAsync(elevated, $"DROP USER {Quote(probe)};");
        }
    }

    // T-6
    [Fact]
    public async Task It_cannot_change_the_schema()
    {
        var contactsBefore = await ElevatedRowCountAsync("contact_requests");
        await using var connection = await OpenHostAsync();
        try
        {
            var create = await RunRolledBackAsync(connection, "CREATE TABLE dbo.iso3_probe (id int)");
            Assert.True(create == DatabasePermissionDenied, $"CREATE TABLE: expected error {DatabasePermissionDenied}, got {Describe(create)}.");

            var alter = await RunRolledBackAsync(connection, "ALTER TABLE dbo.vacancies ADD iso3_probe int NULL");
            _output.WriteLine($"ALTER TABLE dbo.vacancies ADD: {Describe(alter)}");
            Assert.NotNull(alter);

            var truncate = await RunRolledBackAsync(connection, "TRUNCATE TABLE dbo.contact_requests");
            _output.WriteLine($"TRUNCATE TABLE dbo.contact_requests: {Describe(truncate)}");
            Assert.NotNull(truncate);
        }
        finally
        {
            await using var elevated = await OpenElevatedAsync();
            await ExecuteAsync(elevated, """
                IF OBJECT_ID(N'dbo.iso3_probe', N'U') IS NOT NULL DROP TABLE dbo.iso3_probe;
                IF COL_LENGTH(N'dbo.vacancies', N'iso3_probe') IS NOT NULL ALTER TABLE dbo.vacancies DROP COLUMN iso3_probe;
                """);
        }

        await using (var elevated = await OpenElevatedAsync())
        await using (var command = elevated.CreateCommand())
        {
            command.CommandText = "SELECT COL_LENGTH(N'dbo.vacancies', N'iso3_probe')";
            Assert.Equal(DBNull.Value, await command.ExecuteScalarAsync());
        }

        Assert.Equal(contactsBefore, await ElevatedRowCountAsync("contact_requests"));
    }

    // T-7
    [Fact]
    public async Task The_granted_operations_succeed_through_the_host()
    {
        await FormsDatabase.EnsureCareersAddressAsync();
        var open = await FormsDatabase.InsertVacancyAsync("published");
        var contactId = Guid.NewGuid();
        var email = $"iso3-{contactId:N}@digitalhub.test";
        try
        {
            using var scope = _factory.Services.CreateScope();
            var data = scope.ServiceProvider.GetRequiredService<IFormsData>();

            // (a) INSERT on contact_requests, with no read-back.
            await data.AddContactRequestAsync(
                new ContactSubmission(contactId, "ISO-3 probe", "Digital Hub", null, email, "other",
                    "Permission probe.", "new", DateTime.UtcNow),
                CancellationToken.None);
            var rows = await FormsDatabase.ContactByEmailAsync(email);
            Assert.Single(rows);
            Assert.Equal(contactId, (Guid)rows[0]["id"]!);

            // (b) SELECT on vacancies.
            var vacancy = await data.FindVacancyAsync(open, CancellationToken.None);
            Assert.NotNull(vacancy);
            Assert.Equal(open, vacancy.Id);
            Assert.True(vacancy.Published);

            // (c) SELECT on site_settings.
            var mailboxes = await data.MailboxesAsync(CancellationToken.None);
            Assert.NotNull(mailboxes);
            Assert.Equal(FormsDatabase.CareersAddress, mailboxes.CareersEmail);

            // (d) The MERGE's insert branch, then its update branch: SELECT, INSERT and UPDATE.
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            await data.IncrementApplicationCountAsync(open, today, CancellationToken.None);
            await data.IncrementApplicationCountAsync(open, today, CancellationToken.None);
            Assert.Equal(2, await FormsDatabase.CountAsync(open));
        }
        finally
        {
            await FormsDatabase.DeleteContactAsync(contactId);
            await FormsDatabase.DeleteVacancyAsync(open);
        }
    }

    // T-8
    [Fact]
    public async Task The_host_context_cannot_read_back_contact_requests()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PublicFormsDbContext>();

        var exception = await Assert.ThrowsAsync<SqlException>(() => db.ContactRequests.AsNoTracking().AnyAsync());
        Assert.Equal(PermissionDenied, exception.Number);
    }

    /// <summary>The connection string the host's own context uses: the login under test.</summary>
    private string HostConnectionString()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PublicFormsDbContext>();
        return db.Database.GetConnectionString()
            ?? throw new InvalidOperationException("The host's PublicFormsDbContext has no connection string.");
    }

    private async Task<SqlConnection> OpenHostAsync()
    {
        var connection = new SqlConnection(HostConnectionString());
        await connection.OpenAsync();
        return connection;
    }

    private async Task<string> HostUserNameAsync()
    {
        await using var connection = await OpenHostAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT USER_NAME()";
        return (string)(await command.ExecuteScalarAsync())!;
    }

    private static async Task<SqlConnection> OpenElevatedAsync(bool pooling = true)
    {
        var builder = new SqlConnectionStringBuilder(PublicApiFactory.ElevatedTestConnectionString());
        if (!pooling)
            builder.Pooling = false;
        var connection = new SqlConnection(builder.ConnectionString);
        await connection.OpenAsync();
        return connection;
    }

    private static async Task ExecuteAsync(SqlConnection connection, string sql)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        await command.ExecuteNonQueryAsync();
    }

    private static async Task<long> ElevatedRowCountAsync(string table)
    {
        await using var connection = await OpenElevatedAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = $"SELECT COUNT_BIG(*) FROM dbo.{Quote(table)}";
        return Convert.ToInt64(await command.ExecuteScalarAsync());
    }

    /// <summary>
    /// Runs one statement in a transaction that is always rolled back, so even a
    /// wrongly granted login changes nothing. Returns the SQL error number, or null
    /// when the statement ran.
    /// </summary>
    private static async Task<int?> RunRolledBackAsync(SqlConnection connection, string sql)
    {
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync();
        try
        {
            await using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = sql;
            await command.ExecuteNonQueryAsync();
            return null;
        }
        catch (SqlException exception)
        {
            return exception.Number;
        }
        finally
        {
            // The server may already have rolled the transaction back after an error.
            if (transaction.Connection is not null)
                await transaction.RollbackAsync();
        }
    }

    /// <summary>
    /// A principal's effective permissions, measured with EXECUTE AS USER and
    /// fn_my_permissions: on every non-shipped securable object (not constraints or
    /// triggers, which have a parent), on schema dbo and on the database.
    /// </summary>
    private static async Task<Permissions> EffectivePermissionsAsync(SqlConnection elevated, string user)
    {
        await using var command = elevated.CreateCommand();
        command.CommandText = """
            SET NOCOUNT ON;
            DECLARE @objects TABLE (qualified nvarchar(300) NOT NULL, name sysname NOT NULL);
            INSERT INTO @objects (qualified, name)
            SELECT QUOTENAME(SCHEMA_NAME(o.schema_id)) + N'.' + QUOTENAME(o.name), o.name
            FROM sys.objects AS o
            WHERE o.is_ms_shipped = 0 AND o.parent_object_id = 0;
            DECLARE @result TABLE (scope nvarchar(16) NOT NULL, entity sysname NOT NULL, permission nvarchar(128) NOT NULL);
            EXECUTE AS USER = @user;
            INSERT INTO @result (scope, entity, permission)
            SELECT N'OBJECT', o.name, p.permission_name
            FROM @objects AS o
            CROSS APPLY sys.fn_my_permissions(o.qualified, N'OBJECT') AS p
            WHERE p.subentity_name = N'';
            INSERT INTO @result (scope, entity, permission)
            SELECT N'SCHEMA', N'dbo', p.permission_name FROM sys.fn_my_permissions(N'dbo', N'SCHEMA') AS p;
            INSERT INTO @result (scope, entity, permission)
            SELECT N'DATABASE', N'', p.permission_name FROM sys.fn_my_permissions(NULL, N'DATABASE') AS p;
            REVERT;
            SELECT scope, entity, permission FROM @result;
            """;
        command.Parameters.Add(new SqlParameter("@user", SqlDbType.NVarChar, 128) { Value = user });
        var objects = new List<string>();
        var schema = new List<string>();
        var database = new List<string>();
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var scope = reader.GetString(0);
            var entry = scope == "OBJECT" ? $"{reader.GetString(1)}:{reader.GetString(2)}" : reader.GetString(2);
            (scope switch { "OBJECT" => objects, "SCHEMA" => schema, _ => database }).Add(entry);
        }

        return new Permissions(
            objects.Distinct().Order(StringComparer.Ordinal).ToList(),
            schema.Distinct().Order(StringComparer.Ordinal).ToList(),
            database.Distinct().Order(StringComparer.Ordinal).ToList());
    }

    private sealed record Permissions(List<string> Objects, List<string> Schema, List<string> Database);

    private static string Quote(string name) => "[" + name.Replace("]", "]]") + "]";

    private static int? NullableInt(SqlDataReader reader, int index) =>
        reader.IsDBNull(index) ? null : Convert.ToInt32(reader.GetValue(index));

    private static string Describe(int? error) => error is int number ? $"error {number}" : "no error (the statement ran)";
}
