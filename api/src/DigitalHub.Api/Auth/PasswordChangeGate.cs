using DigitalHub.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;

namespace DigitalHub.Api.Auth;

/// <summary>
/// Marks an action a signed-in user may call while their password must be
/// changed: reading who they are and changing the password.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public sealed class AllowedBeforePasswordChangeAttribute : Attribute;

/// <summary>
/// While a user's password must be changed (after an admin reset), every
/// endpoint refuses them with 403 password_change_required, except the ones
/// marked AllowedBeforePasswordChange and the anonymous ones (sign-in, refresh,
/// sign-out, the public form). The Studio enforced this alone before (finding L3).
/// SessionCheck reads the flag from the database on every request.
/// </summary>
public sealed class PasswordChangeGate(RequestDelegate next)
{
    public const string RequiredItem = "password-change-required";

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.Items.ContainsKey(RequiredItem) && context.GetEndpoint() is { } endpoint
            && endpoint.Metadata.GetMetadata<AllowedBeforePasswordChangeAttribute>() is null
            && endpoint.Metadata.GetMetadata<IAllowAnonymous>() is null)
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await ProblemResults.WriteAsync(
                context.Response,
                StatusCodes.Status403Forbidden,
                "password_change_required",
                "Change your temporary password before doing anything else.",
                context.RequestAborted);
            return;
        }

        await next(context);
    }
}
