using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalHub.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddRefreshTokenSessionStart : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "SessionStartedAt",
                table: "RefreshTokens",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            // Existing families start at their earliest token, the first sign-in we
            // have a record of. Without this every existing session would count as
            // started in year 1 and end at once.
            migrationBuilder.Sql(@"
UPDATE token
SET SessionStartedAt = family.StartedAt
FROM RefreshTokens AS token
JOIN (SELECT FamilyId, MIN(CreatedAt) AS StartedAt FROM RefreshTokens GROUP BY FamilyId) AS family
    ON family.FamilyId = token.FamilyId;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SessionStartedAt",
                table: "RefreshTokens");
        }
    }
}
