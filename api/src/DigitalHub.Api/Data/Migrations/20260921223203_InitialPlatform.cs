using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalHub.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialPlatform : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AspNetRoles",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    NormalizedName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    ConcurrencyStamp = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetRoles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUsers",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    UserName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    NormalizedUserName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    NormalizedEmail = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    EmailConfirmed = table.Column<bool>(type: "bit", nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SecurityStamp = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ConcurrencyStamp = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PhoneNumber = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PhoneNumberConfirmed = table.Column<bool>(type: "bit", nullable: false),
                    TwoFactorEnabled = table.Column<bool>(type: "bit", nullable: false),
                    LockoutEnd = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    LockoutEnabled = table.Column<bool>(type: "bit", nullable: false),
                    AccessFailedCount = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUsers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "audit_log",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    user_id = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: true),
                    action = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    entity_type = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    entity_id = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    success = table.Column<bool>(type: "bit", nullable: false),
                    detail = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_audit_log", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "media",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    path = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: false),
                    original_name = table.Column<string>(type: "nvarchar(260)", maxLength: 260, nullable: false),
                    content_type = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    width = table.Column<int>(type: "int", nullable: true),
                    height = table.Column<int>(type: "int", nullable: true),
                    size = table.Column<long>(type: "bigint", nullable: false),
                    generated_sizes = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    content_hash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    alt = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    decorative = table.Column<bool>(type: "bit", nullable: false),
                    caption = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    uploader_id = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_media", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "navigation_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    menu = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    parent_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    label = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    url = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_navigation_items", x => x.id);
                    table.ForeignKey(
                        name: "FK_navigation_items_navigation_items_parent_id",
                        column: x => x.parent_id,
                        principalTable: "navigation_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "redirects",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    from_path = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    to_path = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    status_code = table.Column<int>(type: "int", nullable: false),
                    source = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    created_by_id = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_redirects", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "RefreshTokens",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    TokenHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    CsrfTokenHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    FamilyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RevokedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ReplacedByHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RefreshTokens", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "revisions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    entity_type = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    entity_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    version = table.Column<int>(type: "int", nullable: false),
                    snapshot = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    published_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    published_by_id = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_revisions", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "AspNetRoleClaims",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RoleId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ClaimType = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ClaimValue = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetRoleClaims", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AspNetRoleClaims_AspNetRoles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "AspNetRoles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserClaims",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ClaimType = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ClaimValue = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserClaims", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AspNetUserClaims_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserLogins",
                columns: table => new
                {
                    LoginProvider = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ProviderKey = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ProviderDisplayName = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UserId = table.Column<string>(type: "nvarchar(450)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserLogins", x => new { x.LoginProvider, x.ProviderKey });
                    table.ForeignKey(
                        name: "FK_AspNetUserLogins_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserRoles",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    RoleId = table.Column<string>(type: "nvarchar(450)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserRoles", x => new { x.UserId, x.RoleId });
                    table.ForeignKey(
                        name: "FK_AspNetUserRoles_AspNetRoles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "AspNetRoles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AspNetUserRoles_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserTokens",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    LoginProvider = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Value = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserTokens", x => new { x.UserId, x.LoginProvider, x.Name });
                    table.ForeignKey(
                        name: "FK_AspNetUserTokens_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "contact_requests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    organization = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    role = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: true),
                    email = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                    situation = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    message = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    status = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    handled_by_id = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: true),
                    handled_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_contact_requests", x => x.id);
                    table.CheckConstraint("ck_contact_requests_status", "status IN ('new', 'handled')");
                    table.ForeignKey(
                        name: "FK_contact_requests_AspNetUsers_handled_by_id",
                        column: x => x.handled_by_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "blog_posts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    summary = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    image_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    image_alt_override = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    category = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    category_label = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    read_time = table.Column<int>(type: "int", nullable: false),
                    accent = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    cluster = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    body = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    answer_block = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    faq = table.Column<string>(type: "nvarchar(max)", nullable: false, defaultValue: "{\"items\":[]}"),
                    related_slugs = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    date_modified = table.Column<DateTime>(type: "datetime2", nullable: true),
                    featured = table.Column<bool>(type: "bit", nullable: false),
                    slug = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    status = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    published_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    version = table.Column<int>(type: "int", nullable: false),
                    meta_title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    meta_description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    share_image_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    share_image_alt_override = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    canonical_override = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    no_index = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_blog_posts", x => x.id);
                    table.CheckConstraint("ck_blog_posts_status", "status IN ('draft', 'published', 'ended')");
                    table.ForeignKey(
                        name: "FK_blog_posts_media_image_id",
                        column: x => x.image_id,
                        principalTable: "media",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_blog_posts_media_share_image_id",
                        column: x => x.share_image_id,
                        principalTable: "media",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "case_studies",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    summary = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    image_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    image_alt_override = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    metric = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    categories = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    featured = table.Column<bool>(type: "bit", nullable: false),
                    slug = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    status = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    published_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    version = table.Column<int>(type: "int", nullable: false),
                    meta_title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    meta_description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    share_image_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    share_image_alt_override = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    canonical_override = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    no_index = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_case_studies", x => x.id);
                    table.CheckConstraint("ck_case_studies_status", "status IN ('draft', 'published', 'ended')");
                    table.ForeignKey(
                        name: "FK_case_studies_media_image_id",
                        column: x => x.image_id,
                        principalTable: "media",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_case_studies_media_share_image_id",
                        column: x => x.share_image_id,
                        principalTable: "media",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "news_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    summary = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    details = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    image_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    image_alt_override = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    category = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    location = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    year = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: false),
                    month = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    featured = table.Column<bool>(type: "bit", nullable: false),
                    slug = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    status = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    published_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    version = table.Column<int>(type: "int", nullable: false),
                    meta_title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    meta_description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    share_image_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    share_image_alt_override = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    canonical_override = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    no_index = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_news_items", x => x.id);
                    table.CheckConstraint("ck_news_items_status", "status IN ('draft', 'published', 'ended')");
                    table.ForeignKey(
                        name: "FK_news_items_media_image_id",
                        column: x => x.image_id,
                        principalTable: "media",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_news_items_media_share_image_id",
                        column: x => x.share_image_id,
                        principalTable: "media",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "pages",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    slug = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    status = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    published_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    version = table.Column<int>(type: "int", nullable: false),
                    meta_title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    meta_description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    share_image_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    share_image_alt_override = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    canonical_override = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    no_index = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pages", x => x.id);
                    table.CheckConstraint("ck_pages_status", "status IN ('draft', 'published', 'ended')");
                    table.ForeignKey(
                        name: "FK_pages_media_share_image_id",
                        column: x => x.share_image_id,
                        principalTable: "media",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "partners",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    summary = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    image_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    image_alt_override = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    variant = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    featured = table.Column<bool>(type: "bit", nullable: false),
                    slug = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    status = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    published_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    version = table.Column<int>(type: "int", nullable: false),
                    meta_title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    meta_description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    share_image_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    share_image_alt_override = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    canonical_override = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    no_index = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_partners", x => x.id);
                    table.CheckConstraint("ck_partners_status", "status IN ('draft', 'published', 'ended')");
                    table.ForeignKey(
                        name: "FK_partners_media_image_id",
                        column: x => x.image_id,
                        principalTable: "media",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_partners_media_share_image_id",
                        column: x => x.share_image_id,
                        principalTable: "media",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "services",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    summary = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    icon = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    visual = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    featured = table.Column<bool>(type: "bit", nullable: false),
                    slug = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    status = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    published_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    version = table.Column<int>(type: "int", nullable: false),
                    meta_title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    meta_description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    share_image_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    share_image_alt_override = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    canonical_override = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    no_index = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_services", x => x.id);
                    table.CheckConstraint("ck_services_status", "status IN ('draft', 'published', 'ended')");
                    table.ForeignKey(
                        name: "FK_services_media_share_image_id",
                        column: x => x.share_image_id,
                        principalTable: "media",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "site_settings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    phone = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    whats_app = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    email = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: true),
                    linked_in = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    facebook = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    instagram = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    tik_tok = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    footer_text = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    default_meta_title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    default_meta_description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    default_share_image_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    default_share_image_alt_override = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    organization_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    legal_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    analytics_container_id = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    cookie_banner_text = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_site_settings", x => x.id);
                    table.ForeignKey(
                        name: "FK_site_settings_media_default_share_image_id",
                        column: x => x.default_share_image_id,
                        principalTable: "media",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "team_members",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    role = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    image_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    image_alt_override = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    email = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: true),
                    linked_in = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    featured = table.Column<bool>(type: "bit", nullable: false),
                    slug = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    status = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    published_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    version = table.Column<int>(type: "int", nullable: false),
                    meta_title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    meta_description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    share_image_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    share_image_alt_override = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    canonical_override = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    no_index = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_team_members", x => x.id);
                    table.CheckConstraint("ck_team_members_status", "status IN ('draft', 'published', 'ended')");
                    table.ForeignKey(
                        name: "FK_team_members_media_image_id",
                        column: x => x.image_id,
                        principalTable: "media",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_team_members_media_share_image_id",
                        column: x => x.share_image_id,
                        principalTable: "media",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "vacancies",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    summary = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    department = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    location = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    employment_type = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    about_role = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    key_responsibilities = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    required_skills = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    nice_to_have = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    role_offers = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    interview_stages = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ended_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    featured = table.Column<bool>(type: "bit", nullable: false),
                    slug = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    status = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    published_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    version = table.Column<int>(type: "int", nullable: false),
                    meta_title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    meta_description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    share_image_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    share_image_alt_override = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    canonical_override = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    no_index = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_vacancies", x => x.id);
                    table.CheckConstraint("ck_vacancies_status", "status IN ('draft', 'published', 'ended')");
                    table.ForeignKey(
                        name: "FK_vacancies_media_share_image_id",
                        column: x => x.share_image_id,
                        principalTable: "media",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "sections",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    page_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    service_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    partner_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    case_study_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    type = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    visible = table.Column<bool>(type: "bit", nullable: false),
                    fields = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sections", x => x.id);
                    table.CheckConstraint("ck_sections_exactly_one_owner", "(CASE WHEN page_id IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN service_id IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN partner_id IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN case_study_id IS NOT NULL THEN 1 ELSE 0 END) = 1");
                    table.ForeignKey(
                        name: "FK_sections_case_studies_case_study_id",
                        column: x => x.case_study_id,
                        principalTable: "case_studies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_sections_pages_page_id",
                        column: x => x.page_id,
                        principalTable: "pages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_sections_partners_partner_id",
                        column: x => x.partner_id,
                        principalTable: "partners",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_sections_services_service_id",
                        column: x => x.service_id,
                        principalTable: "services",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AspNetRoleClaims_RoleId",
                table: "AspNetRoleClaims",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "RoleNameIndex",
                table: "AspNetRoles",
                column: "NormalizedName",
                unique: true,
                filter: "[NormalizedName] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUserClaims_UserId",
                table: "AspNetUserClaims",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUserLogins_UserId",
                table: "AspNetUserLogins",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUserRoles_RoleId",
                table: "AspNetUserRoles",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "EmailIndex",
                table: "AspNetUsers",
                column: "NormalizedEmail");

            migrationBuilder.CreateIndex(
                name: "UserNameIndex",
                table: "AspNetUsers",
                column: "NormalizedUserName",
                unique: true,
                filter: "[NormalizedUserName] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_audit_log_at",
                table: "audit_log",
                column: "at");

            migrationBuilder.CreateIndex(
                name: "IX_blog_posts_image_id",
                table: "blog_posts",
                column: "image_id");

            migrationBuilder.CreateIndex(
                name: "IX_blog_posts_share_image_id",
                table: "blog_posts",
                column: "share_image_id");

            migrationBuilder.CreateIndex(
                name: "IX_blog_posts_slug",
                table: "blog_posts",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_case_studies_image_id",
                table: "case_studies",
                column: "image_id");

            migrationBuilder.CreateIndex(
                name: "IX_case_studies_share_image_id",
                table: "case_studies",
                column: "share_image_id");

            migrationBuilder.CreateIndex(
                name: "IX_case_studies_slug",
                table: "case_studies",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_contact_requests_created_at",
                table: "contact_requests",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "IX_contact_requests_handled_by_id",
                table: "contact_requests",
                column: "handled_by_id");

            migrationBuilder.CreateIndex(
                name: "IX_media_content_hash",
                table: "media",
                column: "content_hash");

            migrationBuilder.CreateIndex(
                name: "IX_navigation_items_parent_id",
                table: "navigation_items",
                column: "parent_id");

            migrationBuilder.CreateIndex(
                name: "IX_news_items_image_id",
                table: "news_items",
                column: "image_id");

            migrationBuilder.CreateIndex(
                name: "IX_news_items_share_image_id",
                table: "news_items",
                column: "share_image_id");

            migrationBuilder.CreateIndex(
                name: "IX_news_items_slug",
                table: "news_items",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pages_share_image_id",
                table: "pages",
                column: "share_image_id");

            migrationBuilder.CreateIndex(
                name: "IX_pages_slug",
                table: "pages",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_partners_image_id",
                table: "partners",
                column: "image_id");

            migrationBuilder.CreateIndex(
                name: "IX_partners_share_image_id",
                table: "partners",
                column: "share_image_id");

            migrationBuilder.CreateIndex(
                name: "IX_partners_slug",
                table: "partners",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_redirects_from_path",
                table: "redirects",
                column: "from_path",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_FamilyId",
                table: "RefreshTokens",
                column: "FamilyId");

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_TokenHash",
                table: "RefreshTokens",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_revisions_entity_type_entity_id_version",
                table: "revisions",
                columns: new[] { "entity_type", "entity_id", "version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_sections_case_study_id_sort_order",
                table: "sections",
                columns: new[] { "case_study_id", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "IX_sections_page_id_sort_order",
                table: "sections",
                columns: new[] { "page_id", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "IX_sections_partner_id_sort_order",
                table: "sections",
                columns: new[] { "partner_id", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "IX_sections_service_id_sort_order",
                table: "sections",
                columns: new[] { "service_id", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "IX_services_share_image_id",
                table: "services",
                column: "share_image_id");

            migrationBuilder.CreateIndex(
                name: "IX_services_slug",
                table: "services",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_site_settings_default_share_image_id",
                table: "site_settings",
                column: "default_share_image_id");

            migrationBuilder.CreateIndex(
                name: "IX_team_members_image_id",
                table: "team_members",
                column: "image_id");

            migrationBuilder.CreateIndex(
                name: "IX_team_members_share_image_id",
                table: "team_members",
                column: "share_image_id");

            migrationBuilder.CreateIndex(
                name: "IX_team_members_slug",
                table: "team_members",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_vacancies_share_image_id",
                table: "vacancies",
                column: "share_image_id");

            migrationBuilder.CreateIndex(
                name: "IX_vacancies_slug",
                table: "vacancies",
                column: "slug",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AspNetRoleClaims");

            migrationBuilder.DropTable(
                name: "AspNetUserClaims");

            migrationBuilder.DropTable(
                name: "AspNetUserLogins");

            migrationBuilder.DropTable(
                name: "AspNetUserRoles");

            migrationBuilder.DropTable(
                name: "AspNetUserTokens");

            migrationBuilder.DropTable(
                name: "audit_log");

            migrationBuilder.DropTable(
                name: "blog_posts");

            migrationBuilder.DropTable(
                name: "contact_requests");

            migrationBuilder.DropTable(
                name: "navigation_items");

            migrationBuilder.DropTable(
                name: "news_items");

            migrationBuilder.DropTable(
                name: "redirects");

            migrationBuilder.DropTable(
                name: "RefreshTokens");

            migrationBuilder.DropTable(
                name: "revisions");

            migrationBuilder.DropTable(
                name: "sections");

            migrationBuilder.DropTable(
                name: "site_settings");

            migrationBuilder.DropTable(
                name: "team_members");

            migrationBuilder.DropTable(
                name: "vacancies");

            migrationBuilder.DropTable(
                name: "AspNetRoles");

            migrationBuilder.DropTable(
                name: "AspNetUsers");

            migrationBuilder.DropTable(
                name: "case_studies");

            migrationBuilder.DropTable(
                name: "pages");

            migrationBuilder.DropTable(
                name: "partners");

            migrationBuilder.DropTable(
                name: "services");

            migrationBuilder.DropTable(
                name: "media");
        }
    }
}
