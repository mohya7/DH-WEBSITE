using DigitalHub.Api.Content;
using DigitalHub.Tests.Shared;

namespace DigitalHub.Api.Tests;

/// <summary>
/// ISO-1 (ADR 0001, point 2): the contact and apply code lives in its own
/// library, DigitalHub.Forms, which builds without the admin API, Identity or
/// the token stack. ISO-2's public API depends on that. ISO-2 moved the
/// forbidden list into the shared ReferenceGuard (F1).
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

    [Fact]
    public void Contact_and_apply_code_lives_in_the_forms_library()
    {
        foreach (var type in FormTypes)
            Assert.Equal("DigitalHub.Forms", type.Assembly.GetName().Name);
    }

    [Fact]
    public void The_forms_library_references_no_admin_api_identity_or_token_code()
    {
        Assert.Empty(ReferenceGuard.Violations(typeof(ApplicationIntake).Assembly));
    }

    /// <summary>
    /// ISO-2 (ISO-1 gate 2, F1): the guard must reject the authentication and
    /// Identity assemblies the tester's F1 reproduction brought in. GuardCanary
    /// compiles that reproduction into this test assembly.
    /// </summary>
    [Fact]
    public void The_guard_rejects_the_authentication_and_identity_assemblies()
    {
        var violations = ReferenceGuard.Violations(typeof(GuardCanary).Assembly);

        foreach (var name in new[]
                 {
                     "Microsoft.AspNetCore.Identity",
                     "Microsoft.AspNetCore.Authentication",
                     "Microsoft.AspNetCore.Authentication.BearerToken",
                     "Microsoft.AspNetCore.Authentication.Cookies",
                 })
            Assert.Contains(name, violations);
    }
}
