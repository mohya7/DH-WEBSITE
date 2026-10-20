using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace DigitalHub.Api.Data;

public sealed class ContentDbContext : IdentityDbContext<ApplicationUser>
{
    public ContentDbContext(DbContextOptions<ContentDbContext> options)
        : base(options)
    {
    }

    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    public DbSet<Page> Pages => Set<Page>();

    public DbSet<Section> Sections => Set<Section>();

    public DbSet<Service> Services => Set<Service>();

    public DbSet<Partner> Partners => Set<Partner>();

    public DbSet<CaseStudy> CaseStudies => Set<CaseStudy>();

    public DbSet<BlogPost> BlogPosts => Set<BlogPost>();

    public DbSet<Vacancy> Vacancies => Set<Vacancy>();

    public DbSet<TeamMember> TeamMembers => Set<TeamMember>();

    public DbSet<NewsItem> NewsItems => Set<NewsItem>();

    public DbSet<MediaAsset> Media => Set<MediaAsset>();

    public DbSet<Redirect> Redirects => Set<Redirect>();

    public DbSet<NavigationItem> NavigationItems => Set<NavigationItem>();

    public DbSet<SiteSettings> SiteSettings => Set<SiteSettings>();

    public DbSet<WorkingCopy> WorkingCopies => Set<WorkingCopy>();

    public DbSet<Revision> Revisions => Set<Revision>();

    public DbSet<AuditLogEntry> AuditLog => Set<AuditLogEntry>();

    public DbSet<ContactRequest> ContactRequests => Set<ContactRequest>();

    public DbSet<ApplicationCount> ApplicationCounts => Set<ApplicationCount>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<RefreshToken>(entity =>
        {
            entity.HasIndex(token => token.TokenHash).IsUnique();
            entity.HasIndex(token => token.FamilyId);
            entity.Property(token => token.TokenHash).HasMaxLength(64);
            entity.Property(token => token.CsrfTokenHash).HasMaxLength(64);
            entity.Property(token => token.ReplacedByHash).HasMaxLength(64);
            entity.Property(token => token.UserId).HasMaxLength(450);
        });

        ContentModelBuilder.Configure(builder);
    }
}
