using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalHub.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class BlogEditorialCalendarDates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Guard: refuse once any blog post has been edited. Its dates would then be
            // an editor's, and this migration must not convert or discard them.
            migrationBuilder.Sql("""
                IF EXISTS (SELECT 1 FROM blog_posts WHERE version > 1)
                    OR EXISTS (SELECT 1 FROM working_copies WHERE blog_post_id IS NOT NULL)
                    OR EXISTS (SELECT 1 FROM revisions WHERE entity_type = N'blog_post')
                    THROW 50001, 'A blog post has been edited (a version above 1, a working copy, or a revision). Its dates need a reviewed conversion; this migration will not replace them.', 1;
                """);

            migrationBuilder.AlterColumn<DateOnly>(
                name: "date_modified",
                table: "blog_posts",
                type: "date",
                nullable: true,
                oldClrType: typeof(DateTime),
                oldType: "datetime2",
                oldNullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "date_published",
                table: "blog_posts",
                type: "date",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "date_published",
                table: "blog_posts");

            migrationBuilder.AlterColumn<DateTime>(
                name: "date_modified",
                table: "blog_posts",
                type: "datetime2",
                nullable: true,
                oldClrType: typeof(DateOnly),
                oldType: "date",
                oldNullable: true);
        }
    }
}
