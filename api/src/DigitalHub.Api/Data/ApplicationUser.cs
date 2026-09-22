using Microsoft.AspNetCore.Identity;

namespace DigitalHub.Api.Data;

public sealed class ApplicationUser : IdentityUser
{
    public bool MustChangePassword { get; set; }
}
