using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalHub.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class ReshapeWorkingCopies : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DELETE FROM working_copies;");

            migrationBuilder.DropIndex(
                name: "IX_working_copies_entity_type_entity_id",
                table: "working_copies");

            migrationBuilder.DropColumn(
                name: "entity_id",
                table: "working_copies");

            migrationBuilder.DropColumn(
                name: "entity_type",
                table: "working_copies");

            migrationBuilder.AddColumn<Guid>(
                name: "blog_post_id",
                table: "working_copies",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "case_study_id",
                table: "working_copies",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "news_item_id",
                table: "working_copies",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "page_id",
                table: "working_copies",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "partner_id",
                table: "working_copies",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "service_id",
                table: "working_copies",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "team_member_id",
                table: "working_copies",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "vacancy_id",
                table: "working_copies",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_working_copies_blog_post_id",
                table: "working_copies",
                column: "blog_post_id",
                unique: true,
                filter: "[blog_post_id] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_working_copies_case_study_id",
                table: "working_copies",
                column: "case_study_id",
                unique: true,
                filter: "[case_study_id] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_working_copies_news_item_id",
                table: "working_copies",
                column: "news_item_id",
                unique: true,
                filter: "[news_item_id] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_working_copies_page_id",
                table: "working_copies",
                column: "page_id",
                unique: true,
                filter: "[page_id] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_working_copies_partner_id",
                table: "working_copies",
                column: "partner_id",
                unique: true,
                filter: "[partner_id] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_working_copies_service_id",
                table: "working_copies",
                column: "service_id",
                unique: true,
                filter: "[service_id] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_working_copies_team_member_id",
                table: "working_copies",
                column: "team_member_id",
                unique: true,
                filter: "[team_member_id] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_working_copies_vacancy_id",
                table: "working_copies",
                column: "vacancy_id",
                unique: true,
                filter: "[vacancy_id] IS NOT NULL");

            migrationBuilder.AddCheckConstraint(
                name: "ck_working_copies_exactly_one_owner",
                table: "working_copies",
                sql: "(CASE WHEN page_id IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN service_id IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN partner_id IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN case_study_id IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN blog_post_id IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN vacancy_id IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN team_member_id IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN news_item_id IS NOT NULL THEN 1 ELSE 0 END) = 1");

            migrationBuilder.AddForeignKey(
                name: "FK_working_copies_blog_posts_blog_post_id",
                table: "working_copies",
                column: "blog_post_id",
                principalTable: "blog_posts",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_working_copies_case_studies_case_study_id",
                table: "working_copies",
                column: "case_study_id",
                principalTable: "case_studies",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_working_copies_news_items_news_item_id",
                table: "working_copies",
                column: "news_item_id",
                principalTable: "news_items",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_working_copies_pages_page_id",
                table: "working_copies",
                column: "page_id",
                principalTable: "pages",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_working_copies_partners_partner_id",
                table: "working_copies",
                column: "partner_id",
                principalTable: "partners",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_working_copies_services_service_id",
                table: "working_copies",
                column: "service_id",
                principalTable: "services",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_working_copies_team_members_team_member_id",
                table: "working_copies",
                column: "team_member_id",
                principalTable: "team_members",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_working_copies_vacancies_vacancy_id",
                table: "working_copies",
                column: "vacancy_id",
                principalTable: "vacancies",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_working_copies_blog_posts_blog_post_id",
                table: "working_copies");

            migrationBuilder.DropForeignKey(
                name: "FK_working_copies_case_studies_case_study_id",
                table: "working_copies");

            migrationBuilder.DropForeignKey(
                name: "FK_working_copies_news_items_news_item_id",
                table: "working_copies");

            migrationBuilder.DropForeignKey(
                name: "FK_working_copies_pages_page_id",
                table: "working_copies");

            migrationBuilder.DropForeignKey(
                name: "FK_working_copies_partners_partner_id",
                table: "working_copies");

            migrationBuilder.DropForeignKey(
                name: "FK_working_copies_services_service_id",
                table: "working_copies");

            migrationBuilder.DropForeignKey(
                name: "FK_working_copies_team_members_team_member_id",
                table: "working_copies");

            migrationBuilder.DropForeignKey(
                name: "FK_working_copies_vacancies_vacancy_id",
                table: "working_copies");

            migrationBuilder.DropIndex(
                name: "IX_working_copies_blog_post_id",
                table: "working_copies");

            migrationBuilder.DropIndex(
                name: "IX_working_copies_case_study_id",
                table: "working_copies");

            migrationBuilder.DropIndex(
                name: "IX_working_copies_news_item_id",
                table: "working_copies");

            migrationBuilder.DropIndex(
                name: "IX_working_copies_page_id",
                table: "working_copies");

            migrationBuilder.DropIndex(
                name: "IX_working_copies_partner_id",
                table: "working_copies");

            migrationBuilder.DropIndex(
                name: "IX_working_copies_service_id",
                table: "working_copies");

            migrationBuilder.DropIndex(
                name: "IX_working_copies_team_member_id",
                table: "working_copies");

            migrationBuilder.DropIndex(
                name: "IX_working_copies_vacancy_id",
                table: "working_copies");

            migrationBuilder.DropCheckConstraint(
                name: "ck_working_copies_exactly_one_owner",
                table: "working_copies");

            migrationBuilder.DropColumn(
                name: "blog_post_id",
                table: "working_copies");

            migrationBuilder.DropColumn(
                name: "case_study_id",
                table: "working_copies");

            migrationBuilder.DropColumn(
                name: "news_item_id",
                table: "working_copies");

            migrationBuilder.DropColumn(
                name: "page_id",
                table: "working_copies");

            migrationBuilder.DropColumn(
                name: "partner_id",
                table: "working_copies");

            migrationBuilder.DropColumn(
                name: "service_id",
                table: "working_copies");

            migrationBuilder.DropColumn(
                name: "team_member_id",
                table: "working_copies");

            migrationBuilder.DropColumn(
                name: "vacancy_id",
                table: "working_copies");

            migrationBuilder.AddColumn<Guid>(
                name: "entity_id",
                table: "working_copies",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<string>(
                name: "entity_type",
                table: "working_copies",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_working_copies_entity_type_entity_id",
                table: "working_copies",
                columns: new[] { "entity_type", "entity_id" },
                unique: true);
        }
    }
}
