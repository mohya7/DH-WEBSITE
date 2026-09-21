using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalHub.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSiteSettingsPostalAddress : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "country",
                table: "site_settings",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "locality",
                table: "site_settings",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "postal_code",
                table: "site_settings",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "region",
                table: "site_settings",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "street_address",
                table: "site_settings",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "country",
                table: "site_settings");

            migrationBuilder.DropColumn(
                name: "locality",
                table: "site_settings");

            migrationBuilder.DropColumn(
                name: "postal_code",
                table: "site_settings");

            migrationBuilder.DropColumn(
                name: "region",
                table: "site_settings");

            migrationBuilder.DropColumn(
                name: "street_address",
                table: "site_settings");
        }
    }
}
