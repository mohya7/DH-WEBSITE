namespace DigitalHub.Api.Identity;

public static class Roles
{
    public const string Admin = "admin";
    public const string Editor = "editor";
    public const string Hr = "hr";

    public static readonly string[] All = [Admin, Editor, Hr];

    public static bool IsKnown(string role) => All.Contains(role, StringComparer.Ordinal);
}
