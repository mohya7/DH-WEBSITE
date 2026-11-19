using System.Threading.RateLimiting;

namespace DigitalHub.Forms;

/// <summary>The contact form's rate-limit policy: a fixed window per client address.</summary>
public static class ContactRateLimit
{
    public const string PolicyName = "public-contact";

    public static RateLimitPartition<string> Partition(HttpContext httpContext, int permitLimit, int windowHours)
    {
        var ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter("contact\n" + ip, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = permitLimit,
            Window = TimeSpan.FromHours(windowHours),
            QueueLimit = 0,
        });
    }
}
