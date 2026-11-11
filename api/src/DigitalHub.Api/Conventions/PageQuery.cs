using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;

namespace DigitalHub.Api.Conventions;

// Bind Page and PageSize as top-level query keys, whatever the parameter is called:
// a parameter named "page" otherwise became a binding prefix (ADM-06).
[ModelBinder(Name = "")]
public sealed class PageQuery
{
    [Range(1, 10_000)]
    public int Page { get; set; } = 1;

    [Range(1, 100)]
    public int PageSize { get; set; } = 20;
}

public sealed record PageResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int Total);
