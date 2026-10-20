using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalHub.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddApplicationCounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "application_counts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    vacancy_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    applied_on = table.Column<DateOnly>(type: "date", nullable: false),
                    count = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_application_counts", x => x.id);
                    table.ForeignKey(
                        name: "FK_application_counts_vacancies_vacancy_id",
                        column: x => x.vacancy_id,
                        principalTable: "vacancies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_application_counts_applied_on",
                table: "application_counts",
                column: "applied_on",
                unique: true,
                filter: "[vacancy_id] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_application_counts_vacancy_id_applied_on",
                table: "application_counts",
                columns: new[] { "vacancy_id", "applied_on" },
                unique: true,
                filter: "[vacancy_id] IS NOT NULL");

            // marketing and interviewer are unused. Users who only had one of
            // these roles are left with no role until an admin assigns a new one.
            migrationBuilder.Sql("""
                DELETE FROM AspNetUserRoles
                WHERE RoleId IN (SELECT Id FROM AspNetRoles WHERE Name IN (N'marketing', N'interviewer'));
                DELETE FROM AspNetRoles WHERE Name IN (N'marketing', N'interviewer');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF NOT EXISTS (SELECT 1 FROM AspNetRoles WHERE Name = N'marketing')
                    INSERT INTO AspNetRoles (Id, Name, NormalizedName, ConcurrencyStamp)
                    VALUES (CONVERT(nvarchar(450), NEWID()), N'marketing', N'MARKETING', CONVERT(nvarchar(450), NEWID()));
                IF NOT EXISTS (SELECT 1 FROM AspNetRoles WHERE Name = N'interviewer')
                    INSERT INTO AspNetRoles (Id, Name, NormalizedName, ConcurrencyStamp)
                    VALUES (CONVERT(nvarchar(450), NEWID()), N'interviewer', N'INTERVIEWER', CONVERT(nvarchar(450), NEWID()));
                """);
            migrationBuilder.DropTable(
                name: "application_counts");
        }
    }
}
