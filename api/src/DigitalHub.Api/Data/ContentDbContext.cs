using Microsoft.EntityFrameworkCore;

namespace DigitalHub.Api.Data;

/// <summary>
/// Content database context. Entity sets are added with the Section 4 schema.
/// Present now so health checks can open a connection.
/// </summary>
public sealed class ContentDbContext : DbContext
{
    public ContentDbContext(DbContextOptions<ContentDbContext> options)
        : base(options)
    {
    }
}
