using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalHub.Api.Data.Migrations
{
    /// <summary>
    /// Internal links become target_type + target_id. Group labels stay groups.
    /// Email, phone, and the four social links are deleted: the footer reads them
    /// from site_settings. Down rebuilds url from each target's current path.
    /// Down does not restore the six rows it removes, because those values live
    /// in site settings.
    /// </summary>
    public partial class NavigationLinkRefs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "url",
                table: "navigation_items",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(300)",
                oldMaxLength: 300);

            migrationBuilder.AddColumn<string>(
                name: "link_kind",
                table: "navigation_items",
                type: "nvarchar(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "group");

            migrationBuilder.AddColumn<Guid>(
                name: "target_id",
                table: "navigation_items",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "target_type",
                table: "navigation_items",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.Sql(
                """
                DELETE n
                FROM navigation_items n
                CROSS JOIN site_settings s
                WHERE n.url = 'mailto:' + s.email
                   OR n.url = s.linked_in
                   OR n.url = s.facebook
                   OR n.url = s.instagram
                   OR n.url = s.tik_tok
                   OR (
                        n.url LIKE 'tel:%'
                        AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(s.phone, ''), ' ', ''), '-', ''), '(', ''), ')', ''), '.', '')
                            = REPLACE(n.url, 'tel:', '')
                      );

                UPDATE n SET
                  link_kind = 'internal',
                  target_type = 'service',
                  target_id = s.id,
                  url = NULL
                FROM navigation_items n
                INNER JOIN services s ON n.url = '/services/' + s.slug;

                UPDATE n SET
                  link_kind = 'internal',
                  target_type = 'partner',
                  target_id = p.id,
                  url = NULL
                FROM navigation_items n
                INNER JOIN partners p ON n.url = '/partners/' + p.slug;

                UPDATE n SET
                  link_kind = 'internal',
                  target_type = 'case_study',
                  target_id = c.id,
                  url = NULL
                FROM navigation_items n
                INNER JOIN case_studies c ON n.url = '/cases/' + c.slug;

                UPDATE n SET
                  link_kind = 'internal',
                  target_type = 'blog_post',
                  target_id = b.id,
                  url = NULL
                FROM navigation_items n
                INNER JOIN blog_posts b ON n.url = '/blogs/' + b.slug;

                UPDATE n SET
                  link_kind = 'internal',
                  target_type = 'page',
                  target_id = pg.id,
                  url = NULL
                FROM navigation_items n
                INNER JOIN pages pg ON
                  (n.url = '/' AND pg.slug = 'home')
                  OR (n.url = '/about' AND pg.slug = 'about')
                  OR (n.url = '/contact' AND pg.slug = 'contact')
                  OR (n.url = '/news' AND pg.slug = 'news')
                  OR (n.url = '/partners' AND pg.slug = 'partners')
                  OR (n.url = '/cases' AND pg.slug = 'cases')
                  OR (n.url = '/blogs' AND pg.slug = 'blogs')
                  OR (n.url = '/careers' AND pg.slug = 'careers')
                  OR (n.url = '/careers/apply' AND pg.slug = 'apply');

                UPDATE navigation_items
                SET url = NULL, target_type = NULL, target_id = NULL
                WHERE link_kind = 'group' AND (url IS NULL OR LTRIM(RTRIM(url)) = '');

                IF EXISTS (
                  SELECT 1 FROM navigation_items
                  WHERE NOT (
                    (link_kind = 'group' AND target_type IS NULL AND target_id IS NULL AND url IS NULL)
                    OR (link_kind = 'external' AND target_type IS NULL AND target_id IS NULL AND url IS NOT NULL AND url <> '')
                    OR (link_kind = 'internal' AND target_type IS NOT NULL AND target_id IS NOT NULL AND url IS NULL)
                  )
                )
                  THROW 50002, 'Navigation link conversion left a row with no valid shape.', 1;
                """);

            migrationBuilder.AddCheckConstraint(
                name: "ck_navigation_items_link_shape",
                table: "navigation_items",
                sql: "(link_kind = 'group' AND target_type IS NULL AND target_id IS NULL AND url IS NULL)\nOR (link_kind = 'external' AND target_type IS NULL AND target_id IS NULL AND url IS NOT NULL AND url <> '')\nOR (link_kind = 'internal' AND target_type IS NOT NULL AND target_id IS NOT NULL AND url IS NULL)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_navigation_items_link_shape",
                table: "navigation_items");

            migrationBuilder.Sql(
                """
                UPDATE n SET url = CASE pg.slug
                  WHEN 'home' THEN '/'
                  WHEN 'apply' THEN '/careers/apply'
                  ELSE '/' + pg.slug
                END
                FROM navigation_items n
                INNER JOIN pages pg ON n.link_kind = 'internal' AND n.target_type = 'page' AND n.target_id = pg.id;

                UPDATE n SET url = '/services/' + s.slug
                FROM navigation_items n
                INNER JOIN services s ON n.link_kind = 'internal' AND n.target_type = 'service' AND n.target_id = s.id;

                UPDATE n SET url = '/partners/' + p.slug
                FROM navigation_items n
                INNER JOIN partners p ON n.link_kind = 'internal' AND n.target_type = 'partner' AND n.target_id = p.id;

                UPDATE n SET url = '/cases/' + c.slug
                FROM navigation_items n
                INNER JOIN case_studies c ON n.link_kind = 'internal' AND n.target_type = 'case_study' AND n.target_id = c.id;

                UPDATE n SET url = '/blogs/' + b.slug
                FROM navigation_items n
                INNER JOIN blog_posts b ON n.link_kind = 'internal' AND n.target_type = 'blog_post' AND n.target_id = b.id;

                UPDATE n SET url = '/careers/' + v.slug
                FROM navigation_items n
                INNER JOIN vacancies v ON n.link_kind = 'internal' AND n.target_type = 'vacancy' AND n.target_id = v.id;

                UPDATE navigation_items SET url = '' WHERE link_kind = 'group';

                IF EXISTS (
                  SELECT 1 FROM navigation_items
                  WHERE link_kind IN ('internal', 'external') AND (url IS NULL OR LTRIM(RTRIM(url)) = '')
                )
                  THROW 50001, 'Cannot reverse navigation links: a target has no current path.', 1;
                """);

            migrationBuilder.DropColumn(
                name: "link_kind",
                table: "navigation_items");

            migrationBuilder.DropColumn(
                name: "target_id",
                table: "navigation_items");

            migrationBuilder.DropColumn(
                name: "target_type",
                table: "navigation_items");

            migrationBuilder.AlterColumn<string>(
                name: "url",
                table: "navigation_items",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(300)",
                oldMaxLength: 300,
                oldNullable: true);
        }
    }
}
