namespace DigitalHub.Forms;

/// <summary>The contact store's result: the members the contact controller reads.</summary>
public sealed class FormOutcome
{
    public object? Body { get; init; }

    public int Status { get; init; }

    public string? Code { get; init; }

    public string? Title { get; init; }

    public IDictionary<string, string[]>? Errors { get; init; }

    public static FormOutcome Ok(object body, int status = StatusCodes.Status200OK) => new() { Body = body, Status = status };

    public static FormOutcome Fail(int status, string code, string title, IDictionary<string, string[]>? errors = null) =>
        new() { Status = status, Code = code, Title = title, Errors = errors };
}
