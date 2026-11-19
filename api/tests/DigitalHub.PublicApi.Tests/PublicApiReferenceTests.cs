using System.Reflection;
using DigitalHub.PublicApi.Data;
using DigitalHub.Tests.Shared;

namespace DigitalHub.PublicApi.Tests;

/// <summary>
/// ISO-2 (ISO-1 gate 2, F1; ADR 0001): the shared reference guard applied to the
/// public API's own assembly and to the forms library, with a name canary that
/// proves the guard can fail inside this suite.
/// </summary>
public sealed class PublicApiReferenceTests
{
    public static TheoryData<string> GuardedAssemblies => new()
    {
        "DigitalHub.PublicApi",
        "DigitalHub.Forms",
    };

    [Theory]
    [MemberData(nameof(GuardedAssemblies))]
    public void The_public_api_and_forms_reference_no_admin_identity_or_token_code(string assembly)
    {
        var guarded = assembly switch
        {
            "DigitalHub.PublicApi" => typeof(PublicFormsDbContext).Assembly,
            "DigitalHub.Forms" => typeof(ApplicationIntake).Assembly,
            _ => throw new ArgumentOutOfRangeException(nameof(assembly)),
        };

        Assert.Equal(assembly, guarded.GetName().Name);
        Assert.Empty(ReferenceGuard.Violations(guarded));
    }

    [Theory]
    // The forms-library guard's eight names before ISO-2.
    [InlineData("DigitalHub.Api")]
    [InlineData("DigitalHub.Images")]
    [InlineData("Microsoft.AspNetCore.Authentication.JwtBearer")]
    [InlineData("Microsoft.AspNetCore.Identity.EntityFrameworkCore")]
    [InlineData("Microsoft.Extensions.Identity.Core")]
    [InlineData("Microsoft.Extensions.Identity.Stores")]
    [InlineData("Microsoft.IdentityModel.Tokens")]
    [InlineData("System.IdentityModel.Tokens.Jwt")]
    // The four the F1 reproduction brought in.
    [InlineData("Microsoft.AspNetCore.Identity")]
    [InlineData("Microsoft.AspNetCore.Authentication")]
    [InlineData("Microsoft.AspNetCore.Authentication.BearerToken")]
    [InlineData("Microsoft.AspNetCore.Authentication.Cookies")]
    // Family members not seen yet.
    [InlineData("Microsoft.AspNetCore.Authentication.OAuth")]
    [InlineData("Microsoft.IdentityModel.JsonWebTokens")]
    public void The_guard_reports_every_forbidden_name(string name)
    {
        Assert.True(ReferenceGuard.IsForbidden(name), name + " must be forbidden");
    }

    [Fact]
    public void The_guard_reads_the_real_references_of_the_public_api()
    {
        var references = typeof(PublicFormsDbContext).Assembly.GetReferencedAssemblies()
            .Select(reference => reference.Name)
            .ToList();

        Assert.Contains("DigitalHub.Forms", references);
        Assert.Contains("Microsoft.EntityFrameworkCore", references);
    }
}
