namespace DigitalHub.Api.Data;

/// <summary>
/// How many applications arrived for one vacancy on one UTC day.
/// A null vacancy is the general application. No person, address, or file is stored.
/// </summary>
public sealed class ApplicationCount
{
    public Guid Id { get; set; }

    public Guid? VacancyId { get; set; }

    public Vacancy? Vacancy { get; set; }

    public DateOnly AppliedOn { get; set; }

    public int Count { get; set; }
}
