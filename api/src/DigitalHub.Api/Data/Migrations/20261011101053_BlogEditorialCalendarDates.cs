using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalHub.Api.Data.Migrations
{
    /// <summary>
    /// Blog posts get editorial calendar dates. date_modified is dropped and added again
    /// as a date, beside a new date_published. Nothing is converted, so no day can shift;
    /// the importer refills both from the source articles.
    /// </summary>
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

            migrationBuilder.DropColumn(
                name: "date_modified",
                table: "blog_posts");

            migrationBuilder.AddColumn<DateOnly>(
                name: "date_modified",
                table: "blog_posts",
                type: "date",
                nullable: true);

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

            migrationBuilder.DropColumn(
                name: "date_modified",
                table: "blog_posts");

            // Added back empty: nothing is converted either way. A re-import refills it.
            migrationBuilder.AddColumn<DateTime>(
                name: "date_modified",
                table: "blog_posts",
                type: "datetime2",
                nullable: true);
        }
    }
}
