using Microsoft.EntityFrameworkCore;

namespace DigitalHub.PublicApi.Data;

/// <summary>
/// ADR 0001, point 4: a small context that maps only the forms' four tables, so
/// this process's code cannot reach anything else even before its login refuses
/// it (ISO-3). No navigations, no foreign keys and no store-generated values: a
/// new contact request is a plain INSERT with no read-back. It has no migrations.
/// </summary>
public sealed class PublicFormsDbContext(DbContextOptions<PublicFormsDbContext> options) : DbContext(options)
{
    public DbSet<ContactRequest> ContactRequests => Set<ContactRequest>();

    public DbSet<Vacancy> Vacancies => Set<Vacancy>();

    public DbSet<SiteSettings> SiteSettings => Set<SiteSettings>();

    public DbSet<ApplicationCount> ApplicationCounts => Set<ApplicationCount>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        builder.Entity<ContactRequest>(entity =>
        {
            entity.ToTable("contact_requests");
            entity.HasKey(request => request.Id);
            entity.Property(request => request.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(request => request.Name).HasColumnName("name");
            entity.Property(request => request.Organization).HasColumnName("organization");
            entity.Property(request => request.Role).HasColumnName("role");
            entity.Property(request => request.Email).HasColumnName("email");
            entity.Property(request => request.Situation).HasColumnName("situation");
            entity.Property(request => request.Message).HasColumnName("message");
            entity.Property(request => request.Status).HasColumnName("status");
            entity.Property(request => request.CreatedAt).HasColumnName("created_at");
        });

        builder.Entity<Vacancy>(entity =>
        {
            entity.ToTable("vacancies");
            entity.HasKey(vacancy => vacancy.Id);
            entity.Property(vacancy => vacancy.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(vacancy => vacancy.Title).HasColumnName("title");
            entity.Property(vacancy => vacancy.Status).HasColumnName("status");
        });

        builder.Entity<SiteSettings>(entity =>
        {
            entity.ToTable("site_settings");
            entity.HasKey(settings => settings.Id);
            entity.Property(settings => settings.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(settings => settings.Email).HasColumnName("email");
            entity.Property(settings => settings.CareersEmail).HasColumnName("careers_email");
        });

        builder.Entity<ApplicationCount>(entity =>
        {
            entity.ToTable("application_counts");
            entity.HasKey(row => row.Id);
            entity.Property(row => row.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(row => row.VacancyId).HasColumnName("vacancy_id");
            entity.Property(row => row.AppliedOn).HasColumnName("applied_on").HasColumnType("date");
            entity.Property(row => row.Count).HasColumnName("count");
        });
    }
}
