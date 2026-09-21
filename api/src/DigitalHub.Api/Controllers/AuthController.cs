using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using DigitalHub.Api.Auth;
using DigitalHub.Api.Data;
using DigitalHub.Api.Identity;
using DigitalHub.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace DigitalHub.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
public sealed class AuthController(UserManager<ApplicationUser> users, TokenService tokens) : ControllerBase
{
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        var user = await users.FindByEmailAsync(request.Email);
        if (user is null || !await users.CheckPasswordAsync(user, request.Password))
        {
            return ProblemResults.Create(StatusCodes.Status401Unauthorized, "unauthorized", "The email or password is incorrect.");
        }

        var roles = await users.GetRolesAsync(user);
        var session = await tokens.IssueAsync(user.Id, roles, cancellationToken);
        AppendSessionCookies(session.RefreshToken, session.CsrfToken, session.ExpiresAt);
        return Ok(new
        {
            accessToken = session.AccessToken,
            expiresIn = tokens.AccessTokenSeconds,
            csrfToken = session.CsrfToken,
        });
    }

    [AllowAnonymous]
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
    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        if (Request.Cookies.TryGetValue(TokenService.RefreshCookieName, out var refreshToken))
        {
            if (!CsrfHeaderMatchesCookie(out var csrf))
            {
                return ProblemResults.Create(StatusCodes.Status403Forbidden, "csrf_failed", "The request could not be verified.");
            }

            var revoked = await tokens.RevokeAsync(refreshToken, csrf, cancellationToken);
            if (!revoked)
            {
                return ProblemResults.Create(StatusCodes.Status403Forbidden, "csrf_failed", "The request could not be verified.");
            }
        }

        ClearSessionCookies();
        return NoContent();
    }

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

        return Ok(new { id = user.Id, email = user.Email, role });
    }

    public sealed class LoginRequest
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = "";

        [Required]
        public string Password { get; set; } = "";
    }
}
