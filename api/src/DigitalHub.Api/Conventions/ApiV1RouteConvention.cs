using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ApplicationModels;

namespace DigitalHub.Api.Conventions;

public sealed class ApiV1RouteConvention : IApplicationModelConvention
{
    public void Apply(ApplicationModel application)
    {
        foreach (var controller in application.Controllers)
        {
            foreach (var selector in controller.Selectors)
            {
                var route = selector.AttributeRouteModel?.Template;
                if (string.IsNullOrEmpty(route))
                {
                    selector.AttributeRouteModel = new AttributeRouteModel(new RouteAttribute("api/v1/[controller]"));
                }
                else if (!route.StartsWith("api/v1/", StringComparison.OrdinalIgnoreCase)
                    && !string.Equals(route, "api/v1", StringComparison.OrdinalIgnoreCase))
                {
                    selector.AttributeRouteModel = new AttributeRouteModel(new RouteAttribute("api/v1/" + route.TrimStart('/')));
                }
            }
        }
    }
}
