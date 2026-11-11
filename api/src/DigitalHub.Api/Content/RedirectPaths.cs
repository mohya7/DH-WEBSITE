using System.Text.RegularExpressions;

namespace DigitalHub.Api.Content;

/// <summary>
/// What a redirect path may contain: exactly what the website build can write
/// into web.config (assertPath in website/src/iis/web-config.ts). The API used
/// to accept anything starting with "/", so one bad row made every website build
/// throw (finding L5). RedirectPathRuleTests reads web-config.ts and fails if the
/// two rules drift apart.
///
/// The build also gives a redirect its address with trailing slashes removed
/// (redirectRules and matchPattern in web-config.ts), so /x and /x/ are one
/// address there. Every redirect check compares Key, not the stored text
/// (ADM-02, ADM-07); RedirectAddressRuleTests locks the two together.
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

    /// <summary>
    /// The address the website build gives a redirect path: trailing slashes
    /// removed, and "/" when nothing is left. The same expression as web-config.ts
    /// (row.fromPath.replace(/\/+$/, "") || "/").
    /// </summary>
    public static string Key(string path)
    {
        var key = path.TrimEnd('/');
        return key.Length == 0 ? "/" : key;
    }

    /// <summary>
    /// The stored values that have the same address as this path. Two are enough:
    /// "//" is refused, so a valid path has at most one trailing slash.
    /// </summary>
    public static string[] Spellings(string path)
    {
        var key = Key(path);
        return key == "/" ? ["/"] : [key, key + "/"];
    }
}
