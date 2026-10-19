using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalHub.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSiteSettingsVersion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "version",
                table: "site_settings",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "version",
                table: "site_settings");
        }
    }
}
