using System.Text.RegularExpressions;

namespace DigitalHub.Api.Content;

/// <summary>
/// What a redirect path may contain: exactly what the website build can write
/// into web.config (assertPath in website/src/iis/web-config.ts). The API used
/// to accept anything starting with "/", so one bad row made every website build
/// throw (finding L5). RedirectPathRuleTests reads web-config.ts and fails if the
/// two rules drift apart.
/// </summary>
public static class RedirectPaths
{
    public const int MaxLength = 300;

    public static readonly IReadOnlyList<string> ForbiddenSequences = ["..", "//"];

    /// <summary>The same regular-expression source as web-config.ts: control characters, space, DEL, backslash and ? # &lt; &gt; " '.</summary>
    public const string ForbiddenCharacters = """[\u0000-\u0020\u007f\\?#<>"']""";

    private static readonly Regex Forbidden = new(ForbiddenCharacters, RegexOptions.CultureInvariant);

    /// <summary>Null when the path can be written into web.config; otherwise why not.</summary>
    public static string? Problem(string path)
    {
        if (!path.StartsWith('/'))
            return "must start with /.";
        if (path.Length > MaxLength)
            return $"must be {MaxLength} characters or fewer.";
        if (ForbiddenSequences.Any(sequence => path.Contains(sequence, StringComparison.Ordinal)) || Forbidden.IsMatch(path))
            return "cannot contain \"..\", \"//\", spaces, control characters, a backslash, or ? # < > \" '.";
        return null;
    }
}
