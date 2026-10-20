namespace DigitalHub.Api.Content;

/// <summary>
/// The addresses a section's link field (x-dh-kind "url" in packages/sections)
/// may hold (finding O1): a path on the site ("/contact"), a fragment on the page
/// ("#cookie-settings"), or an external address rich text would accept (http,
/// https, mailto, tel). Anything else, javascript: and data: among them, is
/// refused, however it is cased or padded with whitespace and control characters.
/// </summary>
public static class SectionLinks
{
    public const string Message = "The link is not allowed. Use a site path (/...), a #section, or an http, https, mailto, or tel address.";

    public static bool IsAllowed(string href)
    {
        var trimmed = href.Trim();
        if (trimmed.Length == 0 || trimmed.Any(char.IsControl))
            return false;
        if (trimmed[0] == '#')
            return true;
        if (trimmed[0] == '/')
        {
            // "//host" and "/\host" are other sites to a browser, not paths on this one.
            return trimmed.Length == 1 || (trimmed[1] != '/' && trimmed[1] != '\\');
        }

        return RichText.IsAllowedExternal(trimmed);
    }
}
