using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;

namespace DigitalHub.Api.Infrastructure;

/// <summary>
/// The build endpoint's credential. Not a user login and not a role: a build is
/// a machine reading published content, and giving it a user account would put a
/// second kind of privileged account in the identity tables.
///
/// The value lives in configuration as Build:Token, held in user-secrets. It is
/// never committed and never given to the cloud agent, which builds against the
/// snapshot instead.
/// </summary>
public sealed class BuildToken(IConfiguration configuration)
{
    private readonly byte[]? _expected = Read(configuration);

    /// <summary>False when no token is configured, so the endpoint cannot be left open by omission.</summary>
    public bool Configured => _expected is not null;

    public bool Matches(string? presented)
    {
        if (_expected is null || string.IsNullOrEmpty(presented))
            return false;

        var offered = Encoding.UTF8.GetBytes(presented);
        /* Constant time over the offered value. FixedTimeEquals itself returns
           early on a length mismatch, so compare hashes: both are 32 bytes
           whatever the input length, and the comparison cannot leak the length. */
        return CryptographicOperations.FixedTimeEquals(SHA256.HashData(offered), SHA256.HashData(_expected));
    }

    private static byte[]? Read(IConfiguration configuration)
    {
        var value = configuration["Build:Token"];
        return string.IsNullOrWhiteSpace(value) ? null : Encoding.UTF8.GetBytes(value);
    }
}
