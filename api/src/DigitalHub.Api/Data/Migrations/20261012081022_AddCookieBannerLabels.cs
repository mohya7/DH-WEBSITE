using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalHub.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCookieBannerLabels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "cookie_accept_label",
                table: "site_settings",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "cookie_analytics_label",
                table: "site_settings",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "cookie_banner_title",
                table: "site_settings",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "cookie_reject_label",
                table: "site_settings",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "cookie_settings_label",
                table: "site_settings",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "cookie_accept_label",
                table: "site_settings");

            migrationBuilder.DropColumn(
                name: "cookie_analytics_label",
                table: "site_settings");

            migrationBuilder.DropColumn(
                name: "cookie_banner_title",
                table: "site_settings");

            migrationBuilder.DropColumn(
                name: "cookie_reject_label",
                table: "site_settings");

            migrationBuilder.DropColumn(
                name: "cookie_settings_label",
                table: "site_settings");
        }
    }
}
