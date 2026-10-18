using DigitalHub.Api.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;

namespace DigitalHub.Api.Auth;

/// <summary>
/// Runs for every request that carries a valid access token. The token is
/// accepted only while:
/// - its user exists and is not deactivated;
/// - the user still has the security stamp the token was issued with (a
///   password change or reset changes it);
/// - the session the token was issued for (its refresh-token family) still has a
///   live refresh token (sign-out, reuse detection, a reset or a deactivation
///   revokes it).
///
/// Before this, that state was checked at sign-in and refresh only, so a
/// deactivated user, a signed-out session, or a session from before a password
/// change kept working until the token expired (findings M2 and L2).
///
/// No cache: two indexed reads per request, so the change applies on the very
/// next request.
/// </summary>
public static class SessionCheck
{
    public static async Task ValidateAsync(TokenValidatedContext context)
    {
        var userId = context.Principal?.FindFirst("sub")?.Value;
        var stamp = context.Principal?.FindFirst(TokenService.StampClaim)?.Value;
        var session = context.Principal?.FindFirst(TokenService.SessionClaim)?.Value;
        if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(stamp) || !Guid.TryParseExact(session, "N", out var familyId))
        {
            context.Fail("The session has ended.");
            return;
        }

        var db = context.HttpContext.RequestServices.GetRequiredService<ContentDbContext>();
        var cancellationToken = context.HttpContext.RequestAborted;
        var user = await db.Users.AsNoTracking()
            .Where(candidate => candidate.Id == userId)
            .Select(candidate => new { candidate.SecurityStamp, candidate.LockoutEnabled, candidate.LockoutEnd })
            .SingleOrDefaultAsync(cancellationToken);

        if (user is null
            || (user.LockoutEnabled && user.LockoutEnd is not null && user.LockoutEnd > DateTimeOffset.UtcNow)
            || !string.Equals(TokenService.StampValue(user.SecurityStamp), stamp, StringComparison.Ordinal))
        {
            context.Fail("The session has ended.");
            return;
        }

        var now = DateTime.UtcNow;
        var live = await db.RefreshTokens.AsNoTracking()
            .AnyAsync(token => token.FamilyId == familyId && token.UserId == userId && token.RevokedAt == null && token.ExpiresAt > now, cancellationToken);
        if (!live)
            context.Fail("The session has ended.");
    }
}
