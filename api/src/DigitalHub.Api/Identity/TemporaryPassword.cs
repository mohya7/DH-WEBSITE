using System.Security.Cryptography;
using DigitalHub.Api.Data;
using Microsoft.AspNetCore.Identity;

namespace DigitalHub.Api.Identity;

/// <summary>
/// The temporary password an admin hands to a user: 16 characters drawn with
/// RandomNumberGenerator, at least one from each of four sets, shuffled.
///
/// Copied as it is from AdminStore (NewAcceptedTemporaryPasswordAsync and
/// NewTemporaryPassword) for ADM-04's reactivation, because AdminStore.cs was held by
/// ADM-05. ADM-04b points AdminStore at this class and deletes its copy.
/// </summary>
internal static class TemporaryPassword
{
    /// <summary>
    /// A temporary password every password validator accepts. A random one is
    /// refused only by chance (it contains the user's email name, say); then
    /// another is drawn, at most 10 in all.
    /// </summary>
    public static async Task<string> NewAcceptedAsync(UserManager<ApplicationUser> users, ApplicationUser user)
    {
        for (var attempt = 0; ; attempt++)
        {
            var candidate = New();
            var accepted = true;
            foreach (var validator in users.PasswordValidators)
                accepted &= (await validator.ValidateAsync(users, user, candidate)).Succeeded;
            if (accepted || attempt == 9)
                return candidate;
        }
    }

    public static string New()
    {
        const string upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        const string lower = "abcdefghijkmnopqrstuvwxyz";
        const string digits = "23456789";
        const string special = "!@#$%";
        var required = new[]
        {
            upper[RandomNumberGenerator.GetInt32(upper.Length)],
            lower[RandomNumberGenerator.GetInt32(lower.Length)],
            digits[RandomNumberGenerator.GetInt32(digits.Length)],
            special[RandomNumberGenerator.GetInt32(special.Length)],
        };
        var alphabet = upper + lower + digits + special;
        var chars = new char[16];
        for (var index = 0; index < required.Length; index++)
            chars[index] = required[index];
        for (var index = required.Length; index < chars.Length; index++)
            chars[index] = alphabet[RandomNumberGenerator.GetInt32(alphabet.Length)];
        for (var index = chars.Length - 1; index > 0; index--)
        {
            var swap = RandomNumberGenerator.GetInt32(index + 1);
            (chars[index], chars[swap]) = (chars[swap], chars[index]);
        }

        return new string(chars);
    }
}
