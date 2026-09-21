using System.ComponentModel.DataAnnotations;

namespace DigitalHub.Api.Data;

public enum ContentStatus
{
    Draft,
    Published,
    Ended,
}

/// <summary>
/// Columns shared by pages and every collection table. Not a table of its own.
/// </summary>
public abstract class ContentRecord
{
    public Guid Id { get; set; }

    [MaxLength(200)]
    public string Slug { get; set; } = "";

    [MaxLength(300)]
    public string Title { get; set; } = "";

    public ContentStatus Status { get; set; } = ContentStatus.Draft;

    public int SortOrder { get; set; }

    public DateTime? PublishedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public int Version { get; set; }

    [MaxLength(300)]
    public string? MetaTitle { get; set; }

    [MaxLength(500)]
    public string? MetaDescription { get; set; }

    public Guid? ShareImageId { get; set; }

    public MediaAsset? ShareImage { get; set; }

    [MaxLength(300)]
    public string? ShareImageAltOverride { get; set; }

    [MaxLength(300)]
    public string? CanonicalOverride { get; set; }

    public bool NoIndex { get; set; }
}
