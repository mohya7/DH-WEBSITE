using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalHub.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class MakeCaseStudyThemeExact : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_case_studies_theme",
                table: "case_studies");

            migrationBuilder.AddCheckConstraint(
                name: "ck_case_studies_theme",
                table: "case_studies",
                sql: "theme IS NULL OR (theme COLLATE Latin1_General_BIN2 IN ('orange', 'teal') AND theme NOT LIKE '% ')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_case_studies_theme",
                table: "case_studies");

            migrationBuilder.AddCheckConstraint(
                name: "ck_case_studies_theme",
                table: "case_studies",
                sql: "theme IS NULL OR theme IN ('orange', 'teal')");
        }
    }
}
