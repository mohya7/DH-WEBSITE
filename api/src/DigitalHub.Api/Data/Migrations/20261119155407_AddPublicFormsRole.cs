using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalHub.Api.Data.Migrations
{
    /// <summary>
    /// ISO-3 (ADR 0001, point 3): the role behind the dh_public_forms login, with
    /// exactly the public forms' grants. The login, its user and its membership are
    /// created by the elevated account outside migrations, because the login's
    /// password is a secret (docs/security-deployment.md).
    /// </summary>
    public partial class AddPublicFormsRole : Migration
    {
        // EXEC: the idempotent script compiles each statement only when it runs.
        // No IF NOT EXISTS: a role of this name that already exists may carry
        // grants nobody reviewed, so the migration fails instead (P-5).
        private const string CreateRoleSql = @"
CREATE ROLE [dh_public_forms_role] AUTHORIZATION [dbo];
GRANT INSERT ON [dbo].[contact_requests] TO [dh_public_forms_role];
GRANT SELECT, INSERT, UPDATE ON [dbo].[application_counts] TO [dh_public_forms_role];
GRANT SELECT ON [dbo].[vacancies] TO [dh_public_forms_role];
GRANT SELECT ON [dbo].[site_settings] TO [dh_public_forms_role];";

        // A role with members cannot be dropped, so its members (the environment's
        // users) are removed from it first. The users themselves are left alone.
        private const string DropRoleSql = @"
DECLARE @members TABLE (name sysname NOT NULL);
INSERT INTO @members (name)
SELECT m.name
FROM sys.database_role_members AS rm
JOIN sys.database_principals AS r ON r.principal_id = rm.role_principal_id
JOIN sys.database_principals AS m ON m.principal_id = rm.member_principal_id
WHERE r.name = N'dh_public_forms_role';
DECLARE @member sysname, @sql nvarchar(400);
WHILE EXISTS (SELECT 1 FROM @members)
BEGIN
    SELECT TOP (1) @member = name FROM @members ORDER BY name;
    DELETE FROM @members WHERE name = @member;
    SET @sql = N'ALTER ROLE [dh_public_forms_role] DROP MEMBER ' + QUOTENAME(@member) + N';';
    EXEC (@sql);
END;
DROP ROLE [dh_public_forms_role];";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("EXEC(N'" + CreateRoleSql.Replace("'", "''") + "');");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("EXEC(N'" + DropRoleSql.Replace("'", "''") + "');");
        }
    }
}
