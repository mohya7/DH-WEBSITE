using Microsoft.AspNetCore.Identity;

namespace DigitalHub.Api.Tests;

/// <summary>
/// ISO-2 (ISO-1 gate 2, F1): the tester's F1 reproduction, kept as a committed
/// canary. It is never called. Compiling it makes this test assembly reference
/// Microsoft.AspNetCore.Identity, Microsoft.AspNetCore.Authentication,
/// ...Authentication.BearerToken and ...Authentication.Cookies, so
/// FormsLibraryTests can prove the reference guard rejects all four.
/// </summary>
internal static class GuardCanary
{
    public static void Register(IServiceCollection services) =>
        services.AddAuthentication(IdentityConstants.BearerScheme).AddBearerToken().AddCookie();
}
