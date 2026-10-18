using System.Security.Claims;
using DigitalHub.Api.Auth;
using DigitalHub.Api.Data;
using DigitalHub.Api.Identity;
using DigitalHub.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace DigitalHub.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
public sealed class AuthController(UserManager<ApplicationUser> users, TokenService tokens, ContentDbContext db, LoginThrottle throttle) : ControllerBase
{
    /// <summary>The largest auth request body: an email, a password or two, and JSON around them.</summary>
    public const long AuthBodyLimit = 4 * 1024;

    /// <summary>The most of a typed email kept in an audit entry; an email address is at most 254 characters.</summary>
    public const int AuditEmailLength = 254;

    [AllowAnonymous]
    [RequestBodyLimit(AuthBodyLimit)]
    [RejectDuplicateJsonFields]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        var email = (request.Email ?? "").Trim();
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        // The same normalisation FindByEmailAsync applies, so case and spacing
        // variants of one address share one budget.
        if (!throttle.TryAttempt(ip, users.NormalizeEmail(email) ?? ""))
        {
            return ProblemResults.Create(StatusCodes.Status429TooManyRequests, "rate_limited", "Too many login attempts.");
        }

        var user = await users.FindByEmailAsync(email);
        if (user is null)
        {
            // Hash the password anyway, so an unknown email costs what a wrong
            // password costs and timing does not reveal which emails exist (L1).
            users.PasswordHasher.VerifyHashedPassword(new ApplicationUser(), DummyHash(), request.Password ?? "");
        }

        if (user is null || !await users.CheckPasswordAsync(user, request.Password))
        {
            throttle.RecordFailure(ip);
            await AuditAsync(null, "sign_in_failed", "auth", null, ForAudit(email), success: false, cancellationToken);
            return ProblemResults.Create(StatusCodes.Status401Unauthorized, "unauthorized", "The email or password is incorrect.");
        }

        if (user.LockoutEnabled && user.LockoutEnd is not null && user.LockoutEnd > DateTimeOffset.UtcNow)
        {
            await AuditAsync(user.Id, "sign_in_failed", "auth", user.Id, ForAudit(email), success: false, cancellationToken);
            return ProblemResults.Create(StatusCodes.Status401Unauthorized, "unauthorized", "The email or password is incorrect.");
        }

        var roles = await users.GetRolesAsync(user);
        var session = await tokens.IssueAsync(user, roles, cancellationToken);
        AppendSessionCookies(session.RefreshToken, session.CsrfToken, session.ExpiresAt);
        await AuditAsync(user.Id, "sign_in", "auth", user.Id, ForAudit(email), success: true, cancellationToken);
        return Ok(new
        {
            accessToken = session.AccessToken,
            expiresIn = tokens.AccessTokenSeconds,
            csrfToken = session.CsrfToken,
            mustChangePassword = user.MustChangePassword,
        });
    }

    [AllowedBeforePasswordChange]
    [RequestBodyLimit(AuthBodyLimit)]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request, CancellationToken cancellationToken)
    {
        var userId = User.FindFirstValue("sub");
        if (string.IsNullOrEmpty(userId))
        {
            return ProblemResults.Create(StatusCodes.Status401Unauthorized, "unauthorized", "Authentication is required.");
        }

        var user = await users.FindByIdAsync(userId);
        if (user is null)
        {
            return ProblemResults.Create(StatusCodes.Status401Unauthorized, "unauthorized", "Authentication is required.");
        }

        if (string.IsNullOrEmpty(request.NewPassword) || request.NewPassword.Length < 12)
        {
            return ProblemResults.Create(StatusCodes.Status400BadRequest, "validation_failed", "Password must be at least 12 characters.");
        }

        if (!throttle.MayChangePassword(user.Id))
        {
            return ProblemResults.Create(StatusCodes.Status429TooManyRequests, "rate_limited", "Too many wrong passwords. Try again later.");
        }

        var changed = await users.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!changed.Succeeded)
        {
            if (changed.Errors.Any(error => error.Code == nameof(IdentityErrorDescriber.PasswordMismatch)))
                throttle.RecordWrongCurrentPassword(user.Id);
            return ProblemResults.Create(StatusCodes.Status400BadRequest, "validation_failed", "The password could not be changed.");
        }

        user.MustChangePassword = false;
        await users.UpdateAsync(user);

        // Every other session of this user ends; the one that made the change
        // keeps its refresh token family, if its cookie came with the request.
        Guid? keep = null;
        if (Request.Cookies.TryGetValue(TokenService.RefreshCookieName, out var refreshToken))
            keep = await tokens.FindActiveFamilyAsync(refreshToken, user.Id, cancellationToken);
        await tokens.RevokeUserAsync(user.Id, keep, cancellationToken);
        await AuditAsync(user.Id, "change_password", "auth", user.Id, null, success: true, cancellationToken);
        return NoContent();
    }

    [AllowAnonymous]
    [RequestBodyLimit(AuthBodyLimit)]
    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh(CancellationToken cancellationToken)
    {
        if (!Request.Cookies.TryGetValue(TokenService.RefreshCookieName, out var refreshToken))
        {
            return ProblemResults.Create(StatusCodes.Status401Unauthorized, "unauthorized", "Authentication is required.");
        }

        if (!CsrfHeaderMatchesCookie(out var csrf))
        {
            return ProblemResults.Create(StatusCodes.Status403Forbidden, "csrf_failed", "The request could not be verified.");
        }

        var result = await tokens.RefreshAsync(refreshToken, csrf, cancellationToken);
        if (result.IsCsrfFailure)
        {
            return ProblemResults.Create(StatusCodes.Status403Forbidden, "csrf_failed", "The request could not be verified.");
        }

        if (!result.IsSuccess)
        {
            ClearSessionCookies();
            return ProblemResults.Create(StatusCodes.Status401Unauthorized, "unauthorized", "Authentication is required.");
        }

        AppendSessionCookies(result.RefreshToken!, result.CsrfToken!, result.ExpiresAt!.Value);
        return Ok(new
        {
            accessToken = result.AccessToken,
            expiresIn = tokens.AccessTokenSeconds,
            csrfToken = result.CsrfToken,
        });
    }

    [AllowAnonymous]
    [RequestBodyLimit(AuthBodyLimit)]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        string? userId = null;
        if (Request.Cookies.TryGetValue(TokenService.RefreshCookieName, out var refreshToken))
        {
            if (!CsrfHeaderMatchesCookie(out var csrf))
            {
                return ProblemResults.Create(StatusCodes.Status403Forbidden, "csrf_failed", "The request could not be verified.");
            }

            userId = await tokens.FindUserIdAsync(refreshToken, cancellationToken);
            var revoked = await tokens.RevokeAsync(refreshToken, csrf, cancellationToken);
            if (!revoked)
            {
                return ProblemResults.Create(StatusCodes.Status403Forbidden, "csrf_failed", "The request could not be verified.");
            }
            // The family is now revoked, so this session's access token is refused
            // on its next request (SessionCheck, finding L2). Other sessions of the
            // user are untouched.
        }

        ClearSessionCookies();
        await AuditAsync(userId, "sign_out", "auth", userId, null, success: true, cancellationToken);
        return NoContent();
    }

    private static string? _dummyHash;

    /// <summary>A hash of a random password, made once with the configured hasher, to verify against when the email is unknown.</summary>
    private string DummyHash() =>
        LazyInitializer.EnsureInitialized(ref _dummyHash, () => users.PasswordHasher.HashPassword(new ApplicationUser(), Guid.NewGuid().ToString("N")));

    /// <summary>The typed email as the audit log keeps it: at most AuditEmailLength characters (finding M3).</summary>
    private static string ForAudit(string email) =>
        email.Length <= AuditEmailLength ? email : email[..AuditEmailLength];

    private void AppendSessionCookies(string refreshToken, string csrfToken, DateTime expiresAt)
    {
        Response.Cookies.Append(TokenService.RefreshCookieName, refreshToken, TokenService.RefreshCookieOptions(expiresAt));
        Response.Cookies.Append(TokenService.CsrfCookieName, csrfToken, TokenService.CsrfCookieOptions(expiresAt));
    }

    private void ClearSessionCookies()
    {
        Response.Cookies.Delete(TokenService.RefreshCookieName, TokenService.RefreshCookieOptions(null));
        Response.Cookies.Delete(TokenService.CsrfCookieName, TokenService.CsrfCookieOptions(null));
    }

    private bool CsrfHeaderMatchesCookie(out string csrf)
    {
        Request.Cookies.TryGetValue(TokenService.CsrfCookieName, out var cookie);
        csrf = cookie ?? "";
        return TokenService.HeaderMatchesCookie(Request.Headers[TokenService.CsrfHeaderName].ToString(), cookie);
    }

    private async Task AuditAsync(
        string? userId,
        string action,
        string entityType,
        string? entityId,
        string? detail,
        bool success,
        CancellationToken cancellationToken)
    {
        db.AuditLog.Add(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            At = DateTime.UtcNow,
            Success = success,
            Detail = detail,
        });
        await db.SaveChangesAsync(cancellationToken);
    }

    [AllowedBeforePasswordChange]
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var userId = User.FindFirstValue("sub");
        if (string.IsNullOrEmpty(userId))
        {
            return ProblemResults.Create(StatusCodes.Status401Unauthorized, "unauthorized", "Authentication is required.");
        }

        var user = await users.FindByIdAsync(userId);
        if (user is null)
        {
            return ProblemResults.Create(StatusCodes.Status401Unauthorized, "unauthorized", "Authentication is required.");
        }

        var roles = await users.GetRolesAsync(user);
        var role = roles.FirstOrDefault(Roles.IsKnown);
        if (role is null)
        {
            return ProblemResults.Create(StatusCodes.Status403Forbidden, "forbidden", "You do not have access to this resource.");
        }

        return Ok(new { id = user.Id, email = user.Email, role, mustChangePassword = user.MustChangePassword });
    }

    public sealed class LoginRequest
    {
        [System.ComponentModel.DataAnnotations.Required]
        [System.ComponentModel.DataAnnotations.EmailAddress]
        [System.ComponentModel.DataAnnotations.MaxLength(AuditEmailLength)]
        public string Email { get; set; } = "";

        [System.ComponentModel.DataAnnotations.Required]
        public string Password { get; set; } = "";
    }

    public sealed class ChangePasswordRequest
    {
        [System.ComponentModel.DataAnnotations.Required]
        public string CurrentPassword { get; set; } = "";

        [System.ComponentModel.DataAnnotations.Required]
        public string NewPassword { get; set; } = "";
    }
}
