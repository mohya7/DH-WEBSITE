namespace DigitalHub.Api.Tests;

/// <summary>
/// A passphrase for the users a test creates, made at run time from fixed parts
/// and a random piece, so no password is written out as one literal in the
/// repository (the secret scan flags long password-like literals). It passes the
/// length, character and common-password rules. It is not a real password.
/// </summary>
internal static class TestPassphrase
{
    public static string New() => string.Join('-', "Fixture", Guid.NewGuid().ToString("N")[..10], "Kq7!");
}
