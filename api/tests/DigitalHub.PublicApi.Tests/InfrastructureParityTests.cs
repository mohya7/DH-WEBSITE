using System.Text.RegularExpressions;

namespace DigitalHub.PublicApi.Tests;

/// <summary>
/// ISO-2 (plan 3.4.2): six infrastructure files are copied from the admin API and
/// must not drift, three of them security controls (log redaction, security
/// headers, the safe 500 body). The two copies are compared as text, with only
/// the namespace line and RateLimitLog's category allowed to differ. A change to
/// one copy without the other fails here. Reading text keeps the admin assembly
/// out of this suite.
/// </summary>
public sealed partial class InfrastructureParityTests
{
    public static TheoryData<string> MustNotDrift => new()
    {
        "ProblemResults.cs",
        "CorrelationIdMiddleware.cs",
        "SecurityHeadersMiddleware.cs",
        "UnhandledExceptionHandler.cs",
        "RateLimitLog.cs",
        "SensitiveDestructuringPolicy.cs",
    };

    [Theory]
    [MemberData(nameof(MustNotDrift))]
    public void The_shared_infrastructure_matches_the_admin_copy(string file)
    {
        var root = RepositoryRoot();
        var admin = File.ReadAllText(Path.Combine(root, "api", "src", "DigitalHub.Api", "Infrastructure", file));
        var copy = File.ReadAllText(Path.Combine(root, "api", "src", "DigitalHub.PublicApi", "Infrastructure", file));
        var isRateLimitLog = file == "RateLimitLog.cs";

        var difference = FirstDifference(Normalize(admin, isRateLimitLog), Normalize(copy, isRateLimitLog));

        Assert.True(difference is null, file + " differs from the admin copy at " + difference);
    }

    [Fact]
    public void The_parity_check_reports_a_difference()
    {
        const string admin = "using X;\r\n\r\nnamespace DigitalHub.Api.Infrastructure;\r\n\r\npublic static class RateLimitLog\r\n{\r\n    public const string Category = \"DigitalHub.Api.RateLimit\";\r\n    private static readonly string[] Names = [\"password\"];\r\n}\r\n";
        const string copy = "using X;\n\nnamespace DigitalHub.PublicApi.Infrastructure;\n\npublic static class RateLimitLog\n{\n    public const string Category = \"DigitalHub.PublicApi.RateLimit\";\n    private static readonly string[] Names = [\"password\"];\n}\n";
        Assert.Null(FirstDifference(Normalize(admin, isRateLimitLog: true), Normalize(copy, isRateLimitLog: true)));

        // The category line is only ignored in RateLimitLog.cs.
        Assert.NotNull(FirstDifference(Normalize(admin, isRateLimitLog: false), Normalize(copy, isRateLimitLog: false)));

        // A new name in a redaction set on one side only is reported, with its line.
        var drifted = copy.Replace("[\"password\"]", "[\"password\", \"apiKey\"]", StringComparison.Ordinal);
        var difference = FirstDifference(Normalize(admin, isRateLimitLog: true), Normalize(drifted, isRateLimitLog: true));
        Assert.NotNull(difference);
        Assert.StartsWith("line 8:", difference, StringComparison.Ordinal);
        Assert.Contains("apiKey", difference, StringComparison.Ordinal);

        // A file with no namespace line is refused rather than compared.
        Assert.Throws<InvalidOperationException>(() => Normalize("public class X;\n", isRateLimitLog: false));
    }

    /// <summary>LF line ends; the one namespace line and, in RateLimitLog.cs, the one Category line replaced.</summary>
    internal static string Normalize(string text, bool isRateLimitLog)
    {
        var normalized = text.Replace("\r\n", "\n", StringComparison.Ordinal);
        normalized = ReplaceExactlyOne(NamespaceLine(), normalized, "namespace <ns>;", "namespace");
        if (isRateLimitLog)
            normalized = ReplaceExactlyOne(CategoryLine(), normalized, "    public const string Category = <category>;", "Category");
        return normalized;
    }

    /// <summary>Null when equal, otherwise the first differing line number and both lines.</summary>
    internal static string? FirstDifference(string expected, string actual)
    {
        var left = expected.Split('\n');
        var right = actual.Split('\n');
        for (var index = 0; index < Math.Max(left.Length, right.Length); index++)
        {
            var a = index < left.Length ? left[index] : "(end of file)";
            var b = index < right.Length ? right[index] : "(end of file)";
            if (!string.Equals(a, b, StringComparison.Ordinal))
                return $"line {index + 1}: admin \"{a}\", public \"{b}\"";
        }

        return null;
    }

    private static string ReplaceExactlyOne(Regex pattern, string text, string replacement, string what)
    {
        var count = pattern.Matches(text).Count;
        if (count != 1)
            throw new InvalidOperationException($"Expected exactly one {what} line, found {count}.");
        return pattern.Replace(text, replacement);
    }

    /// <summary>The folder that holds api/DigitalHub.slnx, found by walking up from the test output. Fails closed.</summary>
    private static string RepositoryRoot()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
        {
            if (File.Exists(Path.Combine(directory.FullName, "api", "DigitalHub.slnx")))
                return directory.FullName;
        }

        throw new InvalidOperationException("The repository root (the folder holding api/DigitalHub.slnx) was not found.");
    }

    [GeneratedRegex(@"^namespace [A-Za-z0-9_.]+;$", RegexOptions.Multiline)]
    private static partial Regex NamespaceLine();

    [GeneratedRegex(@"^    public const string Category = ""[^""]*"";$", RegexOptions.Multiline)]
    private static partial Regex CategoryLine();
}
