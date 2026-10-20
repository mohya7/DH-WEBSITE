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

    /// <summary>
    /// When the family's first sign-in happened. Every token of a family carries
    /// the same value, so a refresh can enforce the absolute session limit
    /// (Auth:SessionMaxDays) however often the family was refreshed (item 13).
    /// </summary>
    public DateTime SessionStartedAt { get; set; }

    public DateTime? RevokedAt { get; set; }

    public string? ReplacedByHash { get; set; }
}
