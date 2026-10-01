using DigitalHub.Api.Content;

namespace DigitalHub.Api.Tests;

/// <summary>
/// Where inline text may carry marks. Only one field may not: a hero's heading
/// outside a case study, because the ported scripts split the home heading into
/// animated parts and a mark there would break that.
///
/// The same rule, by the same name, is in packages/blocks/src/inline/document.ts
/// for the website and the Studio. These tests pin the API's half.
/// </summary>
public sealed class InlineTextRuleTests
{
    private const string Plain = """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"A heading"}]}]}""";

    private const string Marked = """
        {"type":"doc","content":[{"type":"paragraph","content":[
          {"type":"text","text":"A heading for "},
          {"type":"text","text":"someone","marks":[{"type":"italic"}]}
        ]}]}
        """;

    [Theory]
    // A hero's heading is plain everywhere but a case study.
    [InlineData("pages", "hero", "heading", false)]
    [InlineData("services", "hero", "heading", false)]
    [InlineData("partners", "hero", "heading", false)]
    [InlineData("case-studies", "hero", "heading", true)]
    // Every other inline field carries the emphasis the old pages had.
    [InlineData("services", "service_hero", "lead", true)]
    [InlineData("services", "problem", "lead", true)]
    [InlineData("pages", "problem", "lead", true)]
    public void Marks_are_allowed_everywhere_but_a_hero_heading_outside_a_case_study(
        string collection, string sectionType, string field, bool allowed) =>
        Assert.Equal(allowed, ContentStore.InlineMarksAllowed(collection, sectionType, field));

    [Fact]
    public void A_case_study_hero_heading_keeps_its_emphasis()
    {
        Assert.Empty(InlineText.Validate(Marked, InlineMarks("case-studies", "hero", "heading")));
    }

    [Fact]
    public void A_home_hero_heading_refuses_a_mark_and_accepts_plain_text()
    {
        var refused = InlineText.Validate(Marked, InlineMarks("pages", "hero", "heading"));
        Assert.Contains(refused, message => message.Contains("must be plain", StringComparison.Ordinal));
        Assert.Empty(InlineText.Validate(Plain, InlineMarks("pages", "hero", "heading")));
    }

    [Fact]
    public void A_service_hero_lede_and_a_problem_lead_keep_their_emphasis()
    {
        Assert.Empty(InlineText.Validate(Marked, InlineMarks("services", "service_hero", "lead")));
        Assert.Empty(InlineText.Validate(Marked, InlineMarks("services", "problem", "lead")));
    }

    [Fact]
    public void A_link_may_be_a_reference_or_a_fragment_and_nothing_else()
    {
        Assert.Empty(InlineText.Validate(Link("""{"href":"#services"}"""), allowMarks: true));
        Assert.Empty(InlineText.Validate(Link($$"""{"type":"page","id":"{{Guid.NewGuid():D}}"}"""), allowMarks: true));

        foreach (var attrs in new[] { """{"href":"https://example.com"}""", """{"href":"/contact"}""", """{"href":"mailto:a@b.com"}""" })
            Assert.NotEmpty(InlineText.Validate(Link(attrs), allowMarks: true));
    }

    [Fact]
    public void Only_one_paragraph_of_text_is_allowed()
    {
        const string twoParagraphs = """
            {"type":"doc","content":[
              {"type":"paragraph","content":[{"type":"text","text":"One"}]},
              {"type":"paragraph","content":[{"type":"text","text":"Two"}]}
            ]}
            """;
        Assert.NotEmpty(InlineText.Validate(twoParagraphs, allowMarks: true));

        const string heading = """{"type":"doc","content":[{"type":"heading","content":[{"type":"text","text":"No"}]}]}""";
        Assert.NotEmpty(InlineText.Validate(heading, allowMarks: true));

        // A plain string is not a document, and there is one stored format only.
        Assert.NotEmpty(InlineText.Validate("A heading", allowMarks: true));

        // Blank is simply unset.
        Assert.Empty(InlineText.Validate("", allowMarks: true));
        Assert.Empty(InlineText.Validate(null, allowMarks: true));
    }

    private static bool InlineMarks(string collection, string sectionType, string field) =>
        ContentStore.InlineMarksAllowed(collection, sectionType, field);

    private static string Link(string attrs) =>
        $$"""{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Go","marks":[{"type":"link","attrs":{{attrs}}}]}]}]}""";
}
