using System.Reflection;

namespace DigitalHub.Tests.Shared;

/// <summary>
/// ISO-2 (ISO-1 gate 2, F1; ADR 0001): the assemblies the forms library and the
/// public forms API must never reference. Both test projects compile this one
/// file as a link, so the two guards cannot drift.
/// </summary>
internal static class ReferenceGuard
{
    /// <summary>Forbidden by exact name.</summary>
    public static readonly string[] Exact = ["DigitalHub.Api", "DigitalHub.Images", "System.IdentityModel.Tokens.Jwt"];

    /// <summary>Forbidden with every assembly below them: the family name itself, or the name plus ".".</summary>
    public static readonly string[] Families =
    [
        "Microsoft.AspNetCore.Authentication",   // .JwtBearer, .BearerToken, .Cookies, .OAuth, ... and the root assembly
        "Microsoft.AspNetCore.Identity",         // the root assembly and .EntityFrameworkCore
        "Microsoft.Extensions.Identity",         // .Core, .Stores
        "Microsoft.IdentityModel",               // .Tokens, .JsonWebTokens, .Protocols...
    ];

    public static bool IsForbidden(string name) =>
        Exact.Contains(name, StringComparer.OrdinalIgnoreCase)
        || Families.Any(family => name.Equals(family, StringComparison.OrdinalIgnoreCase)
                               || name.StartsWith(family + ".", StringComparison.OrdinalIgnoreCase));

    public static IReadOnlyList<string> Violations(Assembly assembly) =>
        assembly.GetReferencedAssemblies().Select(reference => reference.Name ?? "")
            .Where(IsForbidden).OrderBy(name => name, StringComparer.Ordinal).ToList();
}
