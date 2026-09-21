namespace DigitalHub.Api.Identity;

public static class Roles
{
    public const string Admin = "admin";
    public const string Editor = "editor";
    public const string Hr = "hr";
    public const string Marketing = "marketing";
    public const string Interviewer = "interviewer";

    public static readonly string[] All = [Admin, Editor, Hr, Marketing, Interviewer];

    public static bool IsKnown(string role) => All.Contains(role, StringComparer.Ordinal);
}
