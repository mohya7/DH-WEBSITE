using System.Text;
using DigitalHub.Api.Data;
using Microsoft.AspNetCore.Identity;

namespace DigitalHub.Api.Identity;

/// <summary>
/// Refuses a password that is common, wherever a password is set: creating a
/// user, the initial admin, changing a password, and a reset (item 14). Runs
/// beside Identity's own length and character rules, which stay as they are.
///
/// A password is refused when:
/// - it is on the embedded list of common passwords (common-passwords.txt, 10,001
///   entries; source and licence in common-passwords.LICENSE.txt), compared in
///   lower case;
/// - it matches a listed password after folding: lower case, trailing digits and
///   symbols removed, and 0/o, 1/l/i, 3/e, 4/a, 5/s, 7/t, $/s, @/a read alike, so
///   "P@ssw0rd2026!" is "password";
/// - it contains the local part of the user's email (when that is 4 characters or
///   more) or "digitalhub", in any case, also after folding.
/// Every reason gives the same error, which does not say which one matched.
///
/// A password shorter than the required length is left to the length rule, so
/// that error comes first and alone.
/// </summary>
public sealed class CommonPasswordValidator : IPasswordValidator<ApplicationUser>
{
    public const string ErrorCode = "PasswordTooCommon";

    public const string Message =
        "That password is too easy to guess. Do not use a common password or a variation of one, your email name, or the site name.";

    private const string SiteName = "digitalhub";

    private static readonly Lazy<CommonList> List = new(Load);

    private static int _loads;

    /// <summary>How many times the list has been read from the assembly: once per process.</summary>
    public static int Loads => Volatile.Read(ref _loads);

    public Task<IdentityResult> ValidateAsync(UserManager<ApplicationUser> manager, ApplicationUser user, string? password)
    {
        if (password is null || password.Length < manager.Options.Password.RequiredLength)
            return Task.FromResult(IdentityResult.Success);

        return Task.FromResult(IsCommon(password, user.Email)
            ? IdentityResult.Failed(new IdentityError { Code = ErrorCode, Description = Message })
            : IdentityResult.Success);
    }

    /// <summary>True when the password is refused, for any of the three reasons.</summary>
    public static bool IsCommon(string password, string? email)
    {
        var list = List.Value;
        var lower = password.ToLowerInvariant();
        if (list.Exact.Contains(lower))
            return true;

        foreach (var form in Folded(lower))
        {
            if (form.Length > 0 && list.Folded.Contains(form))
                return true;
        }

        foreach (var word in Words(email))
        {
            if (lower.Contains(word, StringComparison.Ordinal) || Fold(lower).Contains(Fold(word), StringComparison.Ordinal))
                return true;
        }

        return false;
    }

    private static IEnumerable<string> Words(string? email)
    {
        yield return SiteName;
        var at = email?.IndexOf('@') ?? -1;
        var local = at > 0 ? email![..at].ToLowerInvariant() : null;
        if (local is { Length: >= 4 })
            yield return local;
    }

    /// <summary>The two folded forms: trailing digits and symbols removed before and after reading leetspeak.</summary>
    private static IEnumerable<string> Folded(string lower)
    {
        yield return Fold(TrimTrailing(lower));
        yield return TrimTrailing(Fold(lower));
    }

    private static string TrimTrailing(string value)
    {
        var end = value.Length;
        while (end > 0 && !char.IsLetter(value[end - 1]))
            end--;
        return value[..end];
    }

    private static string Fold(string value)
    {
        var folded = new StringBuilder(value.Length);
        foreach (var c in value)
        {
            folded.Append(c switch
            {
                '0' => 'o',
                '1' or 'l' or 'i' => 'i',
                '3' => 'e',
                '4' or '@' => 'a',
                '5' or '$' => 's',
                '7' => 't',
                _ => c,
            });
        }

        return folded.ToString();
    }

    private sealed record CommonList(HashSet<string> Exact, HashSet<string> Folded);

    private static CommonList Load()
    {
        Interlocked.Increment(ref _loads);
        using var stream = typeof(CommonPasswordValidator).Assembly.GetManifestResourceStream("DigitalHub.Api.common-passwords.txt")
            ?? throw new InvalidOperationException("The common password list is not embedded in the API.");
        using var reader = new StreamReader(stream, Encoding.UTF8);
        var exact = new HashSet<string>(StringComparer.Ordinal);
        var folded = new HashSet<string>(StringComparer.Ordinal);
        while (reader.ReadLine() is { } line)
        {
            var entry = line.Trim().ToLowerInvariant();
            if (entry.Length == 0)
                continue;
            exact.Add(entry);
            foreach (var form in Folded(entry))
            {
                if (form.Length > 0)
                    folded.Add(form);
            }
        }

        return new CommonList(exact, folded);
    }
}
