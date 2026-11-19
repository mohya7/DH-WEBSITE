namespace DigitalHub.Forms;

public static class FormsServiceCollectionExtensions
{
    /// <summary>
    /// The contact and apply services, with the lifetimes the API registered them
    /// with before ISO-1. The host also registers <see cref="IFormsData"/> over its
    /// own context, and a <see cref="TimeProvider"/>.
    /// </summary>
    public static IServiceCollection AddDigitalHubForms(this IServiceCollection services)
    {
        services.AddScoped<PublicContactStore>();
        services.AddScoped<ApplicationIntake>();
        services.AddSingleton<ApplyThrottle>();
        services.AddSingleton<ApplyDedupe>();
        services.AddSingleton<IEmailSender, SmtpEmailSender>();
        return services;
    }
}
