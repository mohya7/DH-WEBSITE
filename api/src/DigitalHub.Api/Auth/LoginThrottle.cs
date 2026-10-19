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
    private readonly PartitionedRateLimiter<string> _passwordChecks;

    public LoginThrottle(IConfiguration configuration)
    {
        var window = TimeSpan.FromHours(configuration.GetValue("Auth:LoginWindowHours", 1));
        var attemptLimit = configuration.GetValue("Auth:LoginPermitLimit", 8);
        var failureLimit = configuration.GetValue("Auth:LoginFailurePermitLimit", 30);
        var changeLimit = configuration.GetValue("Auth:ChangePasswordFailurePermitLimit", 5);
        _attempts = Fixed(attemptLimit, window);
        _failures = Fixed(failureLimit, window);
        _passwordChecks = Fixed(changeLimit, window);
    }

    /// <summary>
    /// False once this user has given a wrong current password to change-password
    /// Auth:ChangePasswordFailurePermitLimit times in the window (5 per hour).
    /// Someone holding a stolen access token cannot use change-password to guess
    /// the current password (finding L4). A new password the rules refuse does not count.
    /// </summary>
    public bool MayChangePassword(string userId)
    {
        using var lease = _passwordChecks.AttemptAcquire(userId, 0);
        return lease.IsAcquired;
    }

    public void RecordWrongCurrentPassword(string userId)
    {
        using var _ = _passwordChecks.AttemptAcquire(userId, 1);
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
        _passwordChecks.Dispose();
    }

    private static PartitionedRateLimiter<string> Fixed(int limit, TimeSpan window) =>
        PartitionedRateLimiter.Create<string, string>(key => RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = limit,
            Window = window,
            QueueLimit = 0,
        }));
}
