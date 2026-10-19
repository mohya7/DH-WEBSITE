using System.Threading.RateLimiting;

namespace DigitalHub.Api.Content;

/// <summary>
/// Apply attempts, counted inside the action after the form is parsed.
/// One budget per IP and one per email address, each Apply:WindowHours (1).
/// </summary>
public sealed class ApplyThrottle : IDisposable
{
    private readonly PartitionedRateLimiter<string> _byIp;
    private readonly PartitionedRateLimiter<string> _byEmail;

    public ApplyThrottle(IConfiguration configuration)
    {
        var window = TimeSpan.FromHours(configuration.GetValue("Apply:WindowHours", 1));
        _byIp = Fixed(configuration.GetValue("Apply:IpPermitLimit", 10), window);
        _byEmail = Fixed(configuration.GetValue("Apply:EmailPermitLimit", 5), window);
    }

    public bool Allow(string ip, string emailKey)
    {
        using var ipLease = _byIp.AttemptAcquire(ip);
        if (!ipLease.IsAcquired)
            return false;
        using var emailLease = _byEmail.AttemptAcquire(emailKey);
        return emailLease.IsAcquired;
    }

    public void Dispose()
    {
        _byIp.Dispose();
        _byEmail.Dispose();
    }

    private static PartitionedRateLimiter<string> Fixed(int permit, TimeSpan window) =>
        PartitionedRateLimiter.Create<string, string>(key =>
            RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = permit,
                Window = window,
                QueueLimit = 0,
            }));
}
