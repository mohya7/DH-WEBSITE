using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using DigitalHub.Api.Data;
using DigitalHub.Api.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace DigitalHub.Api.Auth;

public sealed class TokenService(ContentDbContext db, IConfiguration configuration)
{
    public const string RefreshCookieName = "dh_refresh";
    public const string CsrfCookieName = "dh_csrf";
    public const string RefreshCookiePath = "/api/v1/auth";
    public const string CsrfCookiePath = "/";
    public const string CsrfHeaderName = "X-CSRF-Token";

    public int AccessTokenSeconds => configuration.GetValue("Auth:AccessTokenMinutes", 10) * 60;

    public async Task<IssuedSession> IssueAsync(string userId, IEnumerable<string> roles, CancellationToken cancellationToken)
    {
        var knownRoles = roles.Where(Roles.IsKnown).ToArray();
        var (rawToken, csrf, entity) = NewToken(userId, Guid.NewGuid());
        db.RefreshTokens.Add(entity);
        await db.SaveChangesAsync(cancellationToken);
        return new IssuedSession(CreateAccessToken(userId, knownRoles), rawToken, csrf, entity.ExpiresAt);
    }

    public async Task<RefreshResult> RefreshAsync(string rawToken, string csrfToken, CancellationToken cancellationToken)
    {
        var hash = Hash(rawToken);
        var current = await db.RefreshTokens.SingleOrDefaultAsync(token => token.TokenHash == hash, cancellationToken);
        if (current is null)
        {
            return RefreshResult.Unauthorized();
        }

        if (current.RevokedAt is not null || current.ReplacedByHash is not null)
        {
            await RevokeFamilyAsync(current.FamilyId, cancellationToken);
            return RefreshResult.Unauthorized();
        }

        if (current.ExpiresAt <= DateTime.UtcNow)
        {
            return RefreshResult.Unauthorized();
        }

        if (!FixedEquals(current.CsrfTokenHash, Hash(csrfToken)))
        {
            return RefreshResult.CsrfFailed();
        }

        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(candidate => candidate.Id == current.UserId, cancellationToken);
        if (user is null)
        {
            return RefreshResult.Unauthorized();
        }

        var roleNames = await db.UserRoles
            .Where(link => link.UserId == user.Id)
            .Join(db.Roles, link => link.RoleId, role => role.Id, (_, role) => role.Name!)
            .ToListAsync(cancellationToken);

        var (rawNext, csrf, next) = NewToken(user.Id, current.FamilyId);
        current.RevokedAt = DateTime.UtcNow;
        current.ReplacedByHash = next.TokenHash;
        db.RefreshTokens.Add(next);
        await db.SaveChangesAsync(cancellationToken);
        var knownRoles = roleNames.Where(Roles.IsKnown);
        return RefreshResult.Success(CreateAccessToken(user.Id, knownRoles), rawNext, csrf, next.ExpiresAt);
    }

    public async Task<bool> RevokeAsync(string rawToken, string csrfToken, CancellationToken cancellationToken)
    {
        var current = await db.RefreshTokens.SingleOrDefaultAsync(token => token.TokenHash == Hash(rawToken), cancellationToken);
        if (current is null)
        {
            return false;
        }

        if (!FixedEquals(current.CsrfTokenHash, Hash(csrfToken)))
        {
            return false;
        }

        await RevokeFamilyAsync(current.FamilyId, cancellationToken);
        return true;
    }

    public static string Hash(string value)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return Convert.ToHexString(bytes);
    }

    public static CookieOptions RefreshCookieOptions(DateTimeOffset? expires)
    {
        return new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Path = RefreshCookiePath,
            // Host-only. Do not set Domain: the cookie must not be sent to the website's domain.
            Expires = expires,
            IsEssential = true,
        };
    }

    public static CookieOptions CsrfCookieOptions(DateTimeOffset? expires)
    {
        return new CookieOptions
        {
            HttpOnly = false,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            // The Studio document is at the site root. document.cookie cannot
            // see a cookie whose path is /api/v1/auth, so this cookie is
            // readable there and echoed as X-CSRF-Token. The refresh cookie
            // stays limited to the auth path.
            Path = CsrfCookiePath,
            Expires = expires,
            IsEssential = true,
        };
    }

    public static bool HeaderMatchesCookie(string? header, string? cookie)
    {
        if (string.IsNullOrEmpty(header) || string.IsNullOrEmpty(cookie))
        {
            return false;
        }

        return FixedEquals(header, cookie);
    }

    private string CreateAccessToken(string userId, IEnumerable<string> roles)
    {
        var claims = new List<Claim> { new("sub", userId) };
        foreach (var role in roles)
        {
            claims.Add(new Claim("role", role));
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(configuration["Auth:SigningKey"]!));
        var token = new JwtSecurityToken(
            issuer: configuration["Auth:Issuer"],
            audience: configuration["Auth:Audience"],
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: DateTime.UtcNow.AddSeconds(AccessTokenSeconds),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private (string Raw, string Csrf, RefreshToken Entity) NewToken(string userId, Guid familyId)
    {
        var raw = NewSecret();
        var csrf = NewSecret();
        var days = configuration.GetValue("Auth:RefreshTokenDays", 14);
        var entity = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TokenHash = Hash(raw),
            CsrfTokenHash = Hash(csrf),
            FamilyId = familyId,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddDays(days),
        };
        return (raw, csrf, entity);
    }

    private async Task RevokeFamilyAsync(Guid familyId, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var active = await db.RefreshTokens
            .Where(token => token.FamilyId == familyId && token.RevokedAt == null)
            .ToListAsync(cancellationToken);
        foreach (var token in active)
        {
            token.RevokedAt = now;
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private static string NewSecret() => Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(32));

    private static bool FixedEquals(string left, string right)
    {
        var leftBytes = Encoding.UTF8.GetBytes(left);
        var rightBytes = Encoding.UTF8.GetBytes(right);
        return leftBytes.Length == rightBytes.Length && CryptographicOperations.FixedTimeEquals(leftBytes, rightBytes);
    }
}

public sealed record IssuedSession(string AccessToken, string RefreshToken, string CsrfToken, DateTime ExpiresAt);

public sealed class RefreshResult
{
    public string? AccessToken { get; private init; }
    public string? RefreshToken { get; private init; }
    public string? CsrfToken { get; private init; }
    public DateTime? ExpiresAt { get; private init; }
    public bool IsCsrfFailure { get; private init; }
    public bool IsSuccess => AccessToken is not null;

    public static RefreshResult Success(string accessToken, string refreshToken, string csrfToken, DateTime expiresAt) =>
        new() { AccessToken = accessToken, RefreshToken = refreshToken, CsrfToken = csrfToken, ExpiresAt = expiresAt };

    public static RefreshResult Unauthorized() => new();

    public static RefreshResult CsrfFailed() => new() { IsCsrfFailure = true };
}
