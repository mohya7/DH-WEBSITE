using DigitalHub.Api.Content;

namespace DigitalHub.Api.Tests;

/// <summary>
/// ISO-1 (ADR 0001, point 2): the contact and apply code lives in its own
/// library, DigitalHub.Forms, which builds without the admin API, Identity or
/// the token stack. ISO-2's public API depends on that.
/// </summary>
public sealed class FormsLibraryTests
{
    private static readonly Type[] FormTypes =
    [
        typeof(ApplicationIntake),
        typeof(PublicContactStore),
        typeof(PublicContactRequest),
        typeof(ApplyThrottle),
        typeof(ApplyDedupe),
        typeof(CvFile),
        typeof(ApplyPage),
        typeof(IEmailSender),
        typeof(SmtpEmailSender),
        typeof(EmailMessage),
        typeof(EmailAttachment),
        typeof(EmailDeliveryException),
    ];

    private static readonly string[] ForbiddenReferences =
    [
        "DigitalHub.Api",
        "DigitalHub.Images",
        "Microsoft.AspNetCore.Authentication.JwtBearer",
        "Microsoft.AspNetCore.Identity.EntityFrameworkCore",
        "Microsoft.Extensions.Identity.Core",
        "Microsoft.Extensions.Identity.Stores",
        "Microsoft.IdentityModel.Tokens",
        "System.IdentityModel.Tokens.Jwt",
    ];

    [Fact]
    public void Contact_and_apply_code_lives_in_the_forms_library()
    {
        foreach (var type in FormTypes)
            Assert.Equal("DigitalHub.Forms", type.Assembly.GetName().Name);
    }

    [Fact]
    public void The_forms_library_references_no_admin_api_identity_or_token_code()
    {
        var referenced = typeof(ApplicationIntake).Assembly
            .GetReferencedAssemblies()
            .Select(name => name.Name)
            .ToList();

        foreach (var forbidden in ForbiddenReferences)
            Assert.DoesNotContain(forbidden, referenced);
    }
}
