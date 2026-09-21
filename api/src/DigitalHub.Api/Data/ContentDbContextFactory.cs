using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace DigitalHub.Api.Data;

/// <summary>
/// Used by the EF tools to pick the SQL Server provider. It does not open a connection.
/// Runtime configuration comes from user-secrets, not from this fallback.
/// </summary>
public sealed class ContentDbContextFactory : IDesignTimeDbContextFactory<ContentDbContext>
{
    public ContentDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__Content")
            ?? "Server=localhost;Database=DigitalHubContent;Encrypt=True;TrustServerCertificate=True";
        var options = new DbContextOptionsBuilder<ContentDbContext>()
            .UseSqlServer(connectionString)
            .Options;
        return new ContentDbContext(options);
    }
}
