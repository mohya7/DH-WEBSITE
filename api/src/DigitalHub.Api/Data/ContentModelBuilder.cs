using Microsoft.EntityFrameworkCore;

namespace DigitalHub.Api.Data;

public static class ContentModelBuilder
{
    public const string ExactlyOneOwner =
        "(CASE WHEN page_id IS NOT NULL THEN 1 ELSE 0 END" +
        " + CASE WHEN service_id IS NOT NULL THEN 1 ELSE 0 END" +
        " + CASE WHEN partner_id IS NOT NULL THEN 1 ELSE 0 END" +
        " + CASE WHEN case_study_id IS NOT NULL THEN 1 ELSE 0 END) = 1";

    public const string ExactlyOneWorkingCopyOwner =
        "(CASE WHEN page_id IS NOT NULL THEN 1 ELSE 0 END" +
        " + CASE WHEN service_id IS NOT NULL THEN 1 ELSE 0 END" +
        " + CASE WHEN partner_id IS NOT NULL THEN 1 ELSE 0 END" +
        " + CASE WHEN case_study_id IS NOT NULL THEN 1 ELSE 0 END" +
        " + CASE WHEN blog_post_id IS NOT NULL THEN 1 ELSE 0 END" +
        " + CASE WHEN vacancy_id IS NOT NULL THEN 1 ELSE 0 END" +
        " + CASE WHEN team_member_id IS NOT NULL THEN 1 ELSE 0 END" +
        " + CASE WHEN news_item_id IS NOT NULL THEN 1 ELSE 0 END) = 1";

    public static void Configure(ModelBuilder builder)
    {
        ConfigureRecord<Page>(builder, "pages");
        ConfigureRecord<Service>(builder, "services");
        ConfigureRecord<Partner>(builder, "partners");
        ConfigureRecord<CaseStudy>(builder, "case_studies");
        ConfigureRecord<BlogPost>(builder, "blog_posts");
        ConfigureRecord<Vacancy>(builder, "vacancies");
        ConfigureRecord<TeamMember>(builder, "team_members");
        ConfigureRecord<NewsItem>(builder, "news_items");

        builder.Entity<Section>(entity =>
        {
            entity.ToTable("sections", table => table.HasCheckConstraint(
                "ck_sections_exactly_one_owner",
                ExactlyOneOwner));
            entity.HasKey(section => section.Id);
            entity.Property(section => section.Type).IsRequired();
            entity.Property(section => section.Fields).IsRequired();
            entity.HasIndex(section => new { section.PageId, section.SortOrder });
            entity.HasIndex(section => new { section.ServiceId, section.SortOrder });
            entity.HasIndex(section => new { section.PartnerId, section.SortOrder });
            entity.HasIndex(section => new { section.CaseStudyId, section.SortOrder });
            entity.HasOne(section => section.Page)
                .WithMany(page => page.Sections)
                .HasForeignKey(section => section.PageId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(section => section.Service)
                .WithMany(service => service.Sections)
                .HasForeignKey(section => section.ServiceId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(section => section.Partner)
                .WithMany(partner => partner.Sections)
                .HasForeignKey(section => section.PartnerId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(section => section.CaseStudy)
                .WithMany(study => study.Sections)
                .HasForeignKey(section => section.CaseStudyId)
                .OnDelete(DeleteBehavior.Cascade);
            Snake(entity);
        });

        builder.Entity<MediaAsset>(entity =>
        {
            entity.ToTable("media");
            entity.HasKey(asset => asset.Id);
            entity.HasIndex(asset => asset.ContentHash);
            entity.Property(asset => asset.Path).IsRequired();
            entity.Property(asset => asset.GeneratedSizes).IsRequired();
            Snake(entity);
        });

        LinkImage(builder, (Partner partner) => partner.Image, partner => (object?)partner.ImageId);
        LinkImage(builder, (CaseStudy study) => study.Image, study => (object?)study.ImageId);
        LinkImage(builder, (BlogPost post) => post.Image, post => (object?)post.ImageId);
        LinkImage(builder, (TeamMember member) => member.Image, member => (object?)member.ImageId);
        LinkImage(builder, (NewsItem item) => item.Image, item => (object?)item.ImageId);

        builder.Entity<BlogPost>(entity =>
        {
            entity.Property(post => post.Faq)
                .IsRequired()
                .HasDefaultValue("""{"items":[]}""");
            entity.Property(post => post.DatePublished).HasColumnType("date");
            entity.Property(post => post.DateModified).HasColumnType("date");
        });

        builder.Entity<CaseStudy>(entity =>
        {
            entity.Property(study => study.Theme).HasMaxLength(16);
            // Exact values only: the column collation ignores case, and = ignores trailing
            // spaces under any collation, so both are excluded explicitly.
            entity.ToTable(table => table.HasCheckConstraint(
                "ck_case_studies_theme",
                "theme IS NULL OR (theme COLLATE Latin1_General_BIN2 IN ('orange', 'teal') AND theme NOT LIKE '% ')"));
        });

        builder.Entity<Redirect>(entity =>
        {
            entity.ToTable("redirects");
            entity.HasKey(redirect => redirect.Id);
            entity.HasIndex(redirect => redirect.FromPath).IsUnique();
            entity.Property(redirect => redirect.FromPath).IsRequired();
            entity.Property(redirect => redirect.ToPath).IsRequired();
            entity.Property(redirect => redirect.Source).IsRequired();
            Snake(entity);
        });

        builder.Entity<NavigationItem>(entity =>
        {
            entity.ToTable("navigation_items", table => table.HasCheckConstraint(
                "ck_navigation_items_link_shape",
                """
                (link_kind = 'group' AND target_type IS NULL AND target_id IS NULL AND url IS NULL)
                OR (link_kind = 'external' AND target_type IS NULL AND target_id IS NULL AND url IS NOT NULL AND url <> '')
                OR (link_kind = 'internal' AND target_type IS NOT NULL AND target_id IS NOT NULL AND url IS NULL)
                """));
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Menu).IsRequired();
            entity.Property(item => item.Label).IsRequired();
            entity.Property(item => item.LinkKind).IsRequired().HasMaxLength(16).HasDefaultValue("group");
            entity.HasOne(item => item.Parent)
                .WithMany()
                .HasForeignKey(item => item.ParentId)
                .OnDelete(DeleteBehavior.Restrict);
            Snake(entity);
        });

        builder.Entity<SiteSettings>(entity =>
        {
            entity.ToTable("site_settings");
            entity.HasKey(settings => settings.Id);
            entity.Property(settings => settings.Version).IsConcurrencyToken();
            entity.HasOne(settings => settings.DefaultShareImage)
                .WithMany()
                .HasForeignKey(settings => settings.DefaultShareImageId)
                .OnDelete(DeleteBehavior.NoAction);
            Snake(entity);
        });

        builder.Entity<WorkingCopy>(entity =>
        {
            entity.ToTable("working_copies", table => table.HasCheckConstraint(
                "ck_working_copies_exactly_one_owner",
                ExactlyOneWorkingCopyOwner));
            entity.HasKey(copy => copy.Id);
            entity.Property(copy => copy.Document).IsRequired();
            OwnCopy(entity, copy => copy.Page, copy => copy.PageId, "page_id");
            OwnCopy(entity, copy => copy.Service, copy => copy.ServiceId, "service_id");
            OwnCopy(entity, copy => copy.Partner, copy => copy.PartnerId, "partner_id");
            OwnCopy(entity, copy => copy.CaseStudy, copy => copy.CaseStudyId, "case_study_id");
            OwnCopy(entity, copy => copy.BlogPost, copy => copy.BlogPostId, "blog_post_id");
            OwnCopy(entity, copy => copy.Vacancy, copy => copy.VacancyId, "vacancy_id");
            OwnCopy(entity, copy => copy.TeamMember, copy => copy.TeamMemberId, "team_member_id");
            OwnCopy(entity, copy => copy.NewsItem, copy => copy.NewsItemId, "news_item_id");
            Snake(entity);
        });

        builder.Entity<Revision>(entity =>
        {
            entity.ToTable("revisions");
            entity.HasKey(revision => revision.Id);
            entity.HasIndex(revision => new { revision.EntityType, revision.EntityId, revision.Version }).IsUnique();
            entity.Property(revision => revision.Snapshot).IsRequired();
            Snake(entity);
        });

        builder.Entity<AuditLogEntry>(entity =>
        {
            entity.ToTable("audit_log");
            entity.HasKey(entry => entry.Id);
            entity.HasIndex(entry => entry.At);
            Snake(entity);
        });

        builder.Entity<ContactRequest>(entity =>
        {
            entity.ToTable("contact_requests", table => table.HasCheckConstraint(
                "ck_contact_requests_status",
                "status IN ('new', 'handled')"));
            entity.HasKey(request => request.Id);
            entity.Property(request => request.Status).IsRequired();
            entity.HasIndex(request => request.CreatedAt);
            entity.HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(request => request.HandledById)
                .OnDelete(DeleteBehavior.NoAction);
            Snake(entity);
        });
    }

    private static void ConfigureRecord<T>(ModelBuilder builder, string table)
        where T : ContentRecord
    {
        builder.Entity<T>(entity =>
        {
            entity.ToTable(table, t => t.HasCheckConstraint(
                $"ck_{table}_status",
                "status IN ('draft', 'published', 'ended')"));
            entity.HasKey(record => record.Id);
            entity.HasIndex(record => record.Slug).IsUnique();
            entity.Property(record => record.Slug).IsRequired();
            entity.Property(record => record.Title).IsRequired();
            entity.Property(record => record.Status)
                .HasConversion(
                    status => status.ToString().ToLowerInvariant(),
                    value => Enum.Parse<ContentStatus>(value, ignoreCase: true))
                .HasMaxLength(16);
            entity.Property(record => record.Version).IsConcurrencyToken();
            entity.HasOne(record => record.ShareImage)
                .WithMany()
                .HasForeignKey(record => record.ShareImageId)
                .OnDelete(DeleteBehavior.NoAction);
            Snake(entity);
        });
    }

    private static void OwnCopy<TOwner>(
        Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<WorkingCopy> entity,
        System.Linq.Expressions.Expression<Func<WorkingCopy, TOwner?>> navigation,
        System.Linq.Expressions.Expression<Func<WorkingCopy, object?>> foreignKey,
        string column)
        where TOwner : class
    {
        entity.HasOne(navigation)
            .WithOne()
            .HasForeignKey<WorkingCopy>(foreignKey)
            .OnDelete(DeleteBehavior.Cascade);
        entity.HasIndex(foreignKey).IsUnique().HasFilter($"[{column}] IS NOT NULL");
    }

    private static void LinkImage<T>(
        ModelBuilder builder,
        System.Linq.Expressions.Expression<Func<T, MediaAsset?>> navigation,
        System.Linq.Expressions.Expression<Func<T, object?>> foreignKey)
        where T : class
    {
        builder.Entity<T>()
            .HasOne(navigation)
            .WithMany()
            .HasForeignKey(foreignKey)
            .OnDelete(DeleteBehavior.NoAction);
    }

    private static void Snake(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder entity)
    {
        foreach (var property in entity.Metadata.GetProperties())
        {
            property.SetColumnName(ToSnake(property.Name));
        }
    }

    private static string ToSnake(string name)
    {
        var chars = new List<char>(name.Length + 8);
        for (var i = 0; i < name.Length; i++)
        {
            var letter = name[i];
            if (char.IsUpper(letter) && i > 0)
            {
                chars.Add('_');
            }

            chars.Add(char.ToLowerInvariant(letter));
        }

        return new string(chars.ToArray());
    }
}
