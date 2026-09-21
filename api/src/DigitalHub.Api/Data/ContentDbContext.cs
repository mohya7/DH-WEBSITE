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
    }
}
