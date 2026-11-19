namespace DigitalHub.PublicApi.Data;

/// <summary>
/// The four tables the forms touch (ADR 0001, points 3 and 4), with only the
/// columns the forms use. The schema is owned by the admin API's migrations;
/// this model never creates or changes it.
/// </summary>
public sealed class ContactRequest
{
    public Guid Id { get; set; }

    public string Name { get; set; } = "";

    public string Organization { get; set; } = "";

    public string? Role { get; set; }

    public string Email { get; set; } = "";

    public string Situation { get; set; } = "";

    public string Message { get; set; } = "";

    public string Status { get; set; } = "";

    public DateTime CreatedAt { get; set; }
}

public sealed class Vacancy
{
    public Guid Id { get; set; }

    public string Title { get; set; } = "";

    /// <summary>Stored lower case: draft, published or ended.</summary>
    public string Status { get; set; } = "";
}

public sealed class SiteSettings
{
    public Guid Id { get; set; }

    public string? Email { get; set; }

    public string? CareersEmail { get; set; }
}

public sealed class ApplicationCount
{
    public Guid Id { get; set; }

    public Guid? VacancyId { get; set; }

    public DateOnly AppliedOn { get; set; }

    public int Count { get; set; }
}
