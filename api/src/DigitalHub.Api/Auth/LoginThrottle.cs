using System.Threading.RateLimiting;

namespace DigitalHub.Api.Auth;

/// <summary>
/// The sign-in limits, applied inside the login action so they count the email
/// the action actually checks, normalised the way FindByEmailAsync normalises it.
/// A middleware that read the body on its own could be shown a different email
/// than the model binder kept (finding H1).
///
/// Two limits:
/// - every attempt for one IP and one email: Auth:LoginPermitLimit per
///   Auth:LoginWindowHours (8 per hour), so one account cannot be guessed at fast;
/// - failed attempts from one IP across all emails: Auth:LoginFailurePermitLimit
///   per window (30 per hour), so one address cannot spray many accounts.
///   30 leaves room for a shared office address where several people mistype,
///   and caps guessing from one address at 30 an hour whatever the emails.
/// </summary>
public sealed class LoginThrottle : IDisposable
{
    private readonly PartitionedRateLimiter<string> _attempts;
    private readonly PartitionedRateLimiter<string> _failures;

    public LoginThrottle(IConfiguration configuration)
    {
        var window = TimeSpan.FromHours(configuration.GetValue("Auth:LoginWindowHours", 1));
        var attemptLimit = configuration.GetValue("Auth:LoginPermitLimit", 8);
        var failureLimit = configuration.GetValue("Auth:LoginFailurePermitLimit", 30);
        _attempts = Fixed(attemptLimit, window);
        _failures = Fixed(failureLimit, window);
    }

    /// <summary>
    /// Takes one attempt for this address and email. False when either limit is
    /// spent; then nothing was taken from the per-email budget.
    /// </summary>
    public bool TryAttempt(string ip, string normalizedEmail)
    {
        using (var failures = _failures.AttemptAcquire(ip, 0))
        {
            if (!failures.IsAcquired)
                return false;
        }

        using var attempt = _attempts.AttemptAcquire(ip + "\n" + normalizedEmail, 1);
        return attempt.IsAcquired;
    }

    public void RecordFailure(string ip)
    {
        using var _ = _failures.AttemptAcquire(ip, 1);
    }

    public void Dispose()
    {
        _attempts.Dispose();
        _failures.Dispose();
    }

    private static PartitionedRateLimiter<string> Fixed(int limit, TimeSpan window) =>
        PartitionedRateLimiter.Create<string, string>(key => RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = limit,
            Window = window,
            QueueLimit = 0,
        }));
}
