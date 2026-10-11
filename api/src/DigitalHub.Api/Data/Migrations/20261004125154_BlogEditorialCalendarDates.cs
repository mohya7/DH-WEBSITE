using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalHub.Api.Data.Migrations
{
    /// <summary>
    /// Blog posts get editorial calendar dates: date_published is added and
    /// date_modified becomes a date. No value is converted. The importer fills
    /// both from the source articles. The guard refuses to run once any blog post
    /// has been edited, because those dates would then be the editor's, not the
    /// source's, and nothing here may discard them.
    /// </summary>
    public partial class BlogEditorialCalendarDates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF EXISTS (SELECT 1 FROM blog_posts WHERE version > 1)
                    OR EXISTS (SELECT 1 FROM working_copies WHERE blog_post_id IS NOT NULL)
                    OR EXISTS (SELECT 1 FROM revisions WHERE entity_type = N'blog_post')
                    THROW 50001, 'A blog post has been edited (a version above 1, a working copy, or a revision). Its dates cannot be replaced; this migration needs a reviewed conversion.', 1;
                """);

            migrationBuilder.DropColumn(
                name: "date_modified",
                table: "blog_posts");

            migrationBuilder.AddColumn<DateOnly>(
                name: "date_published",
                table: "blog_posts",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "date_modified",
                table: "blog_posts",
                type: "date",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            throw new NotSupportedException(
                "Calendar dates cannot be turned back into the discarded timestamps. Restore the pre-migration backup.");
        }
    }
}
