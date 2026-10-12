using System.ComponentModel.DataAnnotations;

namespace DigitalHub.Api.Data;

public static class SectionTypes
{
    public const string Hero = "hero";
    public const string ServiceHero = "service_hero";
    public const string HubHero = "hub_hero";
    public const string ServiceCards = "service_cards";
    public const string FeatureGrid = "feature_grid";
    public const string DeliveryFlow = "delivery_flow";
    public const string LogoBar = "logo_bar";
    public const string Stats = "stats";
    public const string PartnerGrid = "partner_grid";
    public const string CaseCards = "case_cards";
    public const string NewsCarousel = "news_carousel";
    public const string BlogList = "blog_list";
    public const string VacancyList = "vacancy_list";
    public const string Values = "values";
    public const string CallToAction = "call_to_action";
    public const string ContactDetails = "contact_details";
    public const string Timeline = "timeline";
    public const string Pillars = "pillars";
    public const string Profile = "profile";
    public const string TeamGrid = "team_grid";
    public const string Problem = "problem";
    public const string Methodology = "methodology";
    public const string Industries = "industries";
    public const string RichText = "rich_text";
    public const string RelatedItems = "related_items";
    public const string PartnerOverview = "partner_overview";
    public const string PartnerFocus = "partner_focus";
    public const string Faq = "faq";
}

public sealed class Page : ContentRecord
{
    public List<Section> Sections { get; set; } = [];
}

public sealed class Section
{
    public Guid Id { get; set; }

    public Guid? PageId { get; set; }

    public Page? Page { get; set; }

    public Guid? ServiceId { get; set; }

    public Service? Service { get; set; }

    public Guid? PartnerId { get; set; }

    public Partner? Partner { get; set; }

    public Guid? CaseStudyId { get; set; }

    public CaseStudy? CaseStudy { get; set; }

    [MaxLength(40)]
    public string Type { get; set; } = "";

    public int SortOrder { get; set; }

    public bool Visible { get; set; } = true;

    public string Fields { get; set; } = "{}";
}

public sealed class Service : ContentRecord
{
    public string Summary { get; set; } = "";

    [MaxLength(80)]
    public string Icon { get; set; } = "";

    [MaxLength(80)]
    public string Visual { get; set; } = "";

    public bool Featured { get; set; }

    public List<Section> Sections { get; set; } = [];
}

public sealed class Partner : ContentRecord
{
    public string Summary { get; set; } = "";

    public Guid? ImageId { get; set; }

    public MediaAsset? Image { get; set; }

    [MaxLength(300)]
    public string? ImageAltOverride { get; set; }

    [MaxLength(40)]
    public string Variant { get; set; } = "";

    public bool Featured { get; set; }

    public List<Section> Sections { get; set; } = [];
}

public sealed class CaseStudy : ContentRecord
{
    public string Summary { get; set; } = "";

    public Guid? ImageId { get; set; }

    public MediaAsset? Image { get; set; }

    [MaxLength(300)]
    public string? ImageAltOverride { get; set; }

    [MaxLength(200)]
    public string Metric { get; set; } = "";

    public List<string> Categories { get; set; } = [];

    public bool Featured { get; set; }

    public List<Section> Sections { get; set; } = [];
}

public sealed class BlogPost : ContentRecord
{
    public string Summary { get; set; } = "";

    public Guid? ImageId { get; set; }

    public MediaAsset? Image { get; set; }

    [MaxLength(300)]
    public string? ImageAltOverride { get; set; }

    [MaxLength(80)]
    public string Category { get; set; } = "";

    [MaxLength(80)]
    public string CategoryLabel { get; set; } = "";

    public int ReadTime { get; set; }

    [MaxLength(40)]
    public string Accent { get; set; } = "";

    [MaxLength(80)]
    public string Cluster { get; set; } = "";

    public string Body { get; set; } = "";

    public string? AnswerBlock { get; set; }

    /// <summary>
    /// Same document as an faq section: { "items": [ { "question", "answer" } ] }.
    /// Answers are plain text so publish can emit FAQPage structured data.
    /// </summary>
    public string Faq { get; set; } = """{"items":[]}""";

    /// <summary>Editorial calendar dates, YYYY-MM-DD. Never system or publish times.</summary>
    public DateOnly? DatePublished { get; set; }

    public DateOnly? DateModified { get; set; }

    public bool Featured { get; set; }
}

public sealed class Vacancy : ContentRecord
{
    public string Summary { get; set; } = "";

    [MaxLength(80)]
    public string Department { get; set; } = "";

    [MaxLength(120)]
    public string Location { get; set; } = "";

    [MaxLength(80)]
    public string EmploymentType { get; set; } = "";

    public string AboutRole { get; set; } = "";

    public string KeyResponsibilities { get; set; } = "";

    public string RequiredSkills { get; set; } = "";

    public string NiceToHave { get; set; } = "";

    public string RoleOffers { get; set; } = "";

    public List<string> InterviewStages { get; set; } = [];

    public DateTime? EndedAt { get; set; }

    public bool Featured { get; set; }
}

public sealed class TeamMember : ContentRecord
{
    [MaxLength(160)]
    public string Role { get; set; } = "";

    public Guid? ImageId { get; set; }

    public MediaAsset? Image { get; set; }

    [MaxLength(300)]
    public string? ImageAltOverride { get; set; }

    [MaxLength(320)]
    public string? Email { get; set; }

    [MaxLength(300)]
    public string? LinkedIn { get; set; }

    public bool Featured { get; set; }
}

public sealed class NewsItem : ContentRecord
{
    public string Summary { get; set; } = "";

    public string Details { get; set; } = "";

    public Guid? ImageId { get; set; }

    public MediaAsset? Image { get; set; }

    [MaxLength(300)]
    public string? ImageAltOverride { get; set; }

    [MaxLength(80)]
    public string Category { get; set; } = "";

    [MaxLength(120)]
    public string Location { get; set; } = "";

    [MaxLength(8)]
    public string Year { get; set; } = "";

    [MaxLength(16)]
    public string Month { get; set; } = "";

    public bool Featured { get; set; }
}

public sealed class MediaAsset
{
    public Guid Id { get; set; }

    [MaxLength(400)]
    public string Path { get; set; } = "";

    [MaxLength(260)]
    public string OriginalName { get; set; } = "";

    [MaxLength(120)]
    public string ContentType { get; set; } = "";

    public int? Width { get; set; }

    public int? Height { get; set; }

    public long Size { get; set; }

    public string GeneratedSizes { get; set; } = "[]";

    [MaxLength(64)]
    public string ContentHash { get; set; } = "";

    [MaxLength(300)]
    public string Alt { get; set; } = "";

    public bool Decorative { get; set; }

    [MaxLength(500)]
    public string? Caption { get; set; }

    [MaxLength(450)]
    public string? UploaderId { get; set; }

    public DateTime CreatedAt { get; set; }
}

public sealed class Redirect
{
    public Guid Id { get; set; }

    [MaxLength(300)]
    public string FromPath { get; set; } = "";

    [MaxLength(300)]
    public string ToPath { get; set; } = "";

    public int StatusCode { get; set; } = 301;

    [MaxLength(20)]
    public string Source { get; set; } = "manual";

    [MaxLength(450)]
    public string? CreatedById { get; set; }

    public DateTime CreatedAt { get; set; }
}

public sealed class NavigationItem
{
    public Guid Id { get; set; }

    [MaxLength(16)]
    public string Menu { get; set; } = "header";

    public Guid? ParentId { get; set; }

    public NavigationItem? Parent { get; set; }

    [MaxLength(160)]
    public string Label { get; set; } = "";

    /// <summary>group, internal, or external.</summary>
    [MaxLength(16)]
    public string LinkKind { get; set; } = "group";

    /// <summary>page, service, partner, case_study, blog_post, or vacancy. Internal links only.</summary>
    [MaxLength(32)]
    public string? TargetType { get; set; }

    public Guid? TargetId { get; set; }

    /// <summary>External URL only. Null for groups and internal links.</summary>
    [MaxLength(300)]
    public string? Url { get; set; }

    public int SortOrder { get; set; }
}

public sealed class SiteSettings
{
    public Guid Id { get; set; }

    [MaxLength(40)]
    public string? Phone { get; set; }

    [MaxLength(40)]
    public string? WhatsApp { get; set; }

    [MaxLength(320)]
    public string? Email { get; set; }

    /// <summary>Shown on the careers and apply pages in place of Email.</summary>
    [MaxLength(320)]
    public string? CareersEmail { get; set; }

    [MaxLength(300)]
    public string? LinkedIn { get; set; }

    [MaxLength(300)]
    public string? Facebook { get; set; }

    [MaxLength(300)]
    public string? Instagram { get; set; }

    [MaxLength(300)]
    public string? TikTok { get; set; }

    public string? FooterText { get; set; }

    [MaxLength(300)]
    public string? StreetAddress { get; set; }

    [MaxLength(120)]
    public string? Locality { get; set; }

    [MaxLength(120)]
    public string? Region { get; set; }

    [MaxLength(20)]
    public string? PostalCode { get; set; }

    [MaxLength(80)]
    public string? Country { get; set; }

    [MaxLength(300)]
    public string? DefaultMetaTitle { get; set; }

    [MaxLength(500)]
    public string? DefaultMetaDescription { get; set; }

    public Guid? DefaultShareImageId { get; set; }

    public MediaAsset? DefaultShareImage { get; set; }

    [MaxLength(300)]
    public string? DefaultShareImageAltOverride { get; set; }

    [MaxLength(200)]
    public string? OrganizationName { get; set; }

    [MaxLength(200)]
    public string? LegalName { get; set; }

    /// <summary>Google Tag Manager container, GTM- followed by at least seven letters or digits. Empty means nothing loads.</summary>
    [MaxLength(40)]
    public string? AnalyticsContainerId { get; set; }

    /// <summary>Cookie banner body. Empty uses the website's English default.</summary>
    public string? CookieBannerText { get; set; }

    /// <summary>Cookie banner title. Empty uses the website's English default.</summary>
    [MaxLength(200)]
    public string? CookieBannerTitle { get; set; }

    [MaxLength(80)]
    public string? CookieAcceptLabel { get; set; }

    [MaxLength(80)]
    public string? CookieRejectLabel { get; set; }

    [MaxLength(80)]
    public string? CookieAnalyticsLabel { get; set; }

    [MaxLength(80)]
    public string? CookieSettingsLabel { get; set; }
}

public sealed class WorkingCopy
{
    public Guid Id { get; set; }

    public Guid? PageId { get; set; }

    public Page? Page { get; set; }

    public Guid? ServiceId { get; set; }

    public Service? Service { get; set; }

    public Guid? PartnerId { get; set; }

    public Partner? Partner { get; set; }

    public Guid? CaseStudyId { get; set; }

    public CaseStudy? CaseStudy { get; set; }

    public Guid? BlogPostId { get; set; }

    public BlogPost? BlogPost { get; set; }

    public Guid? VacancyId { get; set; }

    public Vacancy? Vacancy { get; set; }

    public Guid? TeamMemberId { get; set; }

    public TeamMember? TeamMember { get; set; }

    public Guid? NewsItemId { get; set; }

    public NewsItem? NewsItem { get; set; }

    public string Document { get; set; } = "";

    public DateTime SavedAt { get; set; }
}

public sealed class Revision
{
    public Guid Id { get; set; }

    [MaxLength(40)]
    public string EntityType { get; set; } = "";

    public Guid EntityId { get; set; }

    public int Version { get; set; }

    public string Snapshot { get; set; } = "";

    public DateTime PublishedAt { get; set; }

    [MaxLength(450)]
    public string? PublishedById { get; set; }
}

public sealed class AuditLogEntry
{
    public Guid Id { get; set; }

    [MaxLength(450)]
    public string? UserId { get; set; }

    [MaxLength(40)]
    public string Action { get; set; } = "";

    [MaxLength(40)]
    public string EntityType { get; set; } = "";

    [MaxLength(64)]
    public string? EntityId { get; set; }

    public DateTime At { get; set; }

    public bool Success { get; set; }

    public string? Detail { get; set; }
}

public sealed class ContactRequest
{
    public Guid Id { get; set; }

    [MaxLength(200)]
    public string Name { get; set; } = "";

    [MaxLength(200)]
    public string Organization { get; set; } = "";

    [MaxLength(160)]
    public string? Role { get; set; }

    [MaxLength(320)]
    public string Email { get; set; } = "";

    [MaxLength(40)]
    public string Situation { get; set; } = "";

    public string Message { get; set; } = "";

    [MaxLength(16)]
    public string Status { get; set; } = "new";

    [MaxLength(450)]
    public string? HandledById { get; set; }

    public DateTime? HandledAt { get; set; }

    public DateTime CreatedAt { get; set; }
}
