namespace DigitalHub.Api.Data;

public sealed class RefreshToken
{
    public Guid Id { get; set; }

    public string UserId { get; set; } = "";

    public string TokenHash { get; set; } = "";

    public string CsrfTokenHash { get; set; } = "";

    public Guid FamilyId { get; set; }

    public DateTime ExpiresAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? RevokedAt { get; set; }

    public string? ReplacedByHash { get; set; }
}
