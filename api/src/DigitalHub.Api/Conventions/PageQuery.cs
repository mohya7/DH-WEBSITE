using System.ComponentModel.DataAnnotations;

namespace DigitalHub.Api.Conventions;

public sealed class PageQuery
{
    [Range(1, 10_000)]
    public int Page { get; set; } = 1;

    [Range(1, 100)]
    public int PageSize { get; set; } = 20;
}

public sealed record PageResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int Total);
