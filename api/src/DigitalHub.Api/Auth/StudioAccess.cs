using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using DigitalHub.Api.Identity;

namespace DigitalHub.Api.Auth;

/// <summary>
/// Admin and editor use the content API. HR may list vacancies, open one, and
/// end it. Every other content action is refused for HR.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class StudioAccessAttribute : Attribute, IAsyncAuthorizationFilter
{
    public Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;
        if (user.Identity?.IsAuthenticated != true)
            return Task.CompletedTask;

        if (user.IsInRole(Roles.Admin) || user.IsInRole(Roles.Editor))
            return Task.CompletedTask;

        if (user.IsInRole(Roles.Hr) && VacancyReadOrEnd(context))
            return Task.CompletedTask;

        context.Result = new ForbidResult();
        return Task.CompletedTask;
    }

    private static bool VacancyReadOrEnd(AuthorizationFilterContext context)
    {
        if (context.RouteData.Values["collection"] is not string collection
            || !string.Equals(collection, "vacancies", StringComparison.Ordinal))
            return false;

        var action = context.ActionDescriptor is ControllerActionDescriptor descriptor
            ? descriptor.ActionName
            : "";
        return action is "List" or "Get" or "End";
    }
}
