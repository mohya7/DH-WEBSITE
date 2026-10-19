using DigitalHub.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DigitalHub.Api.Controllers;

[ApiController]
[Authorize(Policy = "hr")]
[Route("api/v1/applications")]
public sealed class ApplicationsController(ContentDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken cancellationToken)
    {
        var vacancies = await db.Vacancies.AsNoTracking()
            .OrderBy(item => item.Title)
            .Select(item => new { item.Id, item.Title, item.Status })
            .ToListAsync(cancellationToken);
        var counts = await db.ApplicationCounts.AsNoTracking().ToListAsync(cancellationToken);
        var months = counts
            .Select(row => row.AppliedOn.ToString("yyyy-MM"))
            .Distinct(StringComparer.Ordinal)
            .Order(StringComparer.Ordinal)
            .ToList();

        var rows = new List<object>
        {
            Row(null, "General application", null, counts.Where(row => row.VacancyId is null)),
        };
        foreach (var vacancy in vacancies)
        {
            rows.Add(Row(vacancy.Id, vacancy.Title, vacancy.Status.ToString().ToLowerInvariant(), counts.Where(row => row.VacancyId == vacancy.Id)));
        }

        return Ok(new { months, rows });

        static object Row(Guid? id, string title, string? status, IEnumerable<ApplicationCount> matches) => new
        {
            vacancyId = id,
            title,
            status,
            counts = matches
                .GroupBy(row => row.AppliedOn.ToString("yyyy-MM"))
                .ToDictionary(group => group.Key, group => group.Sum(row => row.Count)),
        };
    }
}
