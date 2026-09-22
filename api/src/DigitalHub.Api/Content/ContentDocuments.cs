using System.Text.Json;
using DigitalHub.Api.Data;

namespace DigitalHub.Api.Content;

public sealed class DraftDocument
{
    public string Slug { get; set; } = "";

    public string Title { get; set; } = "";

    public int SortOrder { get; set; }

    public string? MetaTitle { get; set; }

    public string? MetaDescription { get; set; }

    public Guid? ShareImageId { get; set; }

    public string? ShareImageAltOverride { get; set; }

    public string? CanonicalOverride { get; set; }

    public bool NoIndex { get; set; }

    public Dictionary<string, JsonElement> Fields { get; set; } = new(StringComparer.Ordinal);

    public List<DraftSection> Sections { get; set; } = [];
}

public sealed class DraftSection
{
    public Guid Id { get; set; }

    public string Type { get; set; } = "";

    public int SortOrder { get; set; }

    public bool Visible { get; set; } = true;

    public JsonElement Fields { get; set; }
}

public class ContentWrite
{
    public string Slug { get; set; } = "";

    public string Title { get; set; } = "";

    public int SortOrder { get; set; }

    public string? MetaTitle { get; set; }

    public string? MetaDescription { get; set; }

    public Guid? ShareImageId { get; set; }

    public string? ShareImageAltOverride { get; set; }

    public string? CanonicalOverride { get; set; }

    public bool NoIndex { get; set; }

    public Dictionary<string, JsonElement>? Fields { get; set; }
}

public static class ContentFields
{
    private static readonly Dictionary<string, HashSet<string>> Allowed = new(StringComparer.Ordinal)
    {
        ["pages"] = [],
        ["services"] = ["summary", "icon", "visual", "featured"],
        ["partners"] = ["summary", "imageId", "imageAltOverride", "variant", "featured"],
        ["case-studies"] = ["summary", "imageId", "imageAltOverride", "metric", "categories", "featured"],
        ["blog-posts"] = ["summary", "imageId", "imageAltOverride", "category", "categoryLabel", "readTime", "accent", "cluster", "body", "answerBlock", "faq", "dateModified", "featured"],
        ["vacancies"] = ["summary", "department", "location", "employmentType", "aboutRole", "keyResponsibilities", "requiredSkills", "niceToHave", "roleOffers", "interviewStages", "featured"],
        ["team-members"] = ["role", "imageId", "imageAltOverride", "email", "linkedIn", "featured"],
        ["news-items"] = ["summary", "details", "imageId", "imageAltOverride", "category", "location", "year", "month", "featured"],
    };

    public static DraftDocument FromRecord(string collection, ContentRecord record, IEnumerable<Section> sections)
    {
        return new DraftDocument
        {
            Slug = record.Slug,
            Title = record.Title,
            SortOrder = record.SortOrder,
            MetaTitle = record.MetaTitle,
            MetaDescription = record.MetaDescription,
            ShareImageId = record.ShareImageId,
            ShareImageAltOverride = record.ShareImageAltOverride,
            CanonicalOverride = record.CanonicalOverride,
            NoIndex = record.NoIndex,
            Fields = Read(collection, record),
            Sections = sections
                .OrderBy(section => section.SortOrder)
                .Select(section => new DraftSection
                {
                    Id = section.Id,
                    Type = section.Type,
                    SortOrder = section.SortOrder,
                    Visible = section.Visible,
                    Fields = ParseObject(section.Fields),
                })
                .ToList(),
        };
    }

    public static void ApplyWrite(DraftDocument draft, ContentWrite write)
    {
        draft.Slug = write.Slug.Trim();
        draft.Title = write.Title.Trim();
        draft.SortOrder = write.SortOrder;
        draft.MetaTitle = Blank(write.MetaTitle);
        draft.MetaDescription = Blank(write.MetaDescription);
        draft.ShareImageId = write.ShareImageId;
        draft.ShareImageAltOverride = Blank(write.ShareImageAltOverride);
        draft.CanonicalOverride = Blank(write.CanonicalOverride);
        draft.NoIndex = write.NoIndex;
        if (write.Fields is null)
            return;
        foreach (var pair in write.Fields)
            draft.Fields[pair.Key] = pair.Value.Clone();
    }

    public static void ApplyToRecord(string collection, ContentRecord record, DraftDocument draft, Dictionary<string, List<string>> errors)
    {
        record.Slug = draft.Slug;
        record.Title = draft.Title;
        record.SortOrder = draft.SortOrder;
        record.MetaTitle = draft.MetaTitle;
        record.MetaDescription = draft.MetaDescription;
        record.ShareImageId = draft.ShareImageId;
        record.ShareImageAltOverride = draft.ShareImageAltOverride;
        record.CanonicalOverride = draft.CanonicalOverride;
        record.NoIndex = draft.NoIndex;
        ApplyFields(collection, record, draft.Fields, errors);
    }

    public static void Validate(string collection, DraftDocument draft, Dictionary<string, List<string>> errors)
    {
        if (draft.Slug.Length == 0 || draft.Slug.Length > 200 || !SlugPattern.IsMatch(draft.Slug))
            Add(errors, "slug", "Use lowercase letters, numbers, and hyphens.");
        if (draft.Title.Length == 0 || draft.Title.Length > 300)
            Add(errors, "title", "Enter a title of at most 300 characters.");
        Limit(errors, "metaTitle", draft.MetaTitle, 300);
        Limit(errors, "metaDescription", draft.MetaDescription, 500);
        Limit(errors, "shareImageAltOverride", draft.ShareImageAltOverride, 300);
        Limit(errors, "canonicalOverride", draft.CanonicalOverride, 300);

        var allowed = Allowed[collection];
        foreach (var pair in draft.Fields)
        {
            if (!allowed.Contains(pair.Key))
                Add(errors, pair.Key, "is not a field on this item.");
        }

        switch (collection)
        {
            case "services":
                OptionalLong(draft, errors, "summary");
                OptionalShort(draft, errors, "icon", 80);
                OptionalShort(draft, errors, "visual", 80);
                OptionalBool(draft, errors, "featured");
                break;
            case "partners":
                OptionalLong(draft, errors, "summary");
                OptionalGuid(draft, errors, "imageId");
                OptionalShort(draft, errors, "imageAltOverride", 300);
                OptionalShort(draft, errors, "variant", 40);
                OptionalBool(draft, errors, "featured");
                break;
            case "case-studies":
                OptionalLong(draft, errors, "summary");
                OptionalGuid(draft, errors, "imageId");
                OptionalShort(draft, errors, "imageAltOverride", 300);
                OptionalShort(draft, errors, "metric", 200);
                OptionalStrings(draft, errors, "categories");
                OptionalBool(draft, errors, "featured");
                break;
            case "blog-posts":
                OptionalLong(draft, errors, "summary");
                OptionalGuid(draft, errors, "imageId");
                OptionalShort(draft, errors, "imageAltOverride", 300);
                OptionalShort(draft, errors, "category", 80);
                OptionalShort(draft, errors, "categoryLabel", 80);
                OptionalInt(draft, errors, "readTime");
                OptionalShort(draft, errors, "accent", 40);
                OptionalShort(draft, errors, "cluster", 80);
                OptionalLong(draft, errors, "body");
                OptionalLong(draft, errors, "answerBlock");
                OptionalLong(draft, errors, "faq");
                OptionalDate(draft, errors, "dateModified");
                OptionalBool(draft, errors, "featured");
                break;
            case "vacancies":
                OptionalLong(draft, errors, "summary");
                OptionalShort(draft, errors, "department", 80);
                OptionalShort(draft, errors, "location", 120);
                OptionalShort(draft, errors, "employmentType", 80);
                OptionalLong(draft, errors, "aboutRole");
                OptionalLong(draft, errors, "keyResponsibilities");
                OptionalLong(draft, errors, "requiredSkills");
                OptionalLong(draft, errors, "niceToHave");
                OptionalLong(draft, errors, "roleOffers");
                OptionalStrings(draft, errors, "interviewStages");
                OptionalBool(draft, errors, "featured");
                break;
            case "team-members":
                OptionalShort(draft, errors, "role", 160);
                OptionalGuid(draft, errors, "imageId");
                OptionalShort(draft, errors, "imageAltOverride", 300);
                OptionalShort(draft, errors, "email", 320);
                OptionalShort(draft, errors, "linkedIn", 300);
                OptionalBool(draft, errors, "featured");
                break;
            case "news-items":
                OptionalLong(draft, errors, "summary");
                OptionalLong(draft, errors, "details");
                OptionalGuid(draft, errors, "imageId");
                OptionalShort(draft, errors, "imageAltOverride", 300);
                OptionalShort(draft, errors, "category", 80);
                OptionalShort(draft, errors, "location", 120);
                OptionalShort(draft, errors, "year", 8);
                OptionalShort(draft, errors, "month", 16);
                OptionalBool(draft, errors, "featured");
                break;
        }
    }

    public static void ApplyFields(string collection, ContentRecord record, IReadOnlyDictionary<string, JsonElement> fields, Dictionary<string, List<string>> errors)
    {
        switch (record)
        {
            case Service service:
                service.Summary = Long(fields, "summary", service.Summary);
                service.Icon = Short(fields, "icon", service.Icon);
                service.Visual = Short(fields, "visual", service.Visual);
                service.Featured = Bool(fields, "featured", service.Featured);
                break;
            case Partner partner:
                partner.Summary = Long(fields, "summary", partner.Summary);
                partner.ImageId = GuidValue(fields, "imageId", partner.ImageId);
                partner.ImageAltOverride = ShortNull(fields, "imageAltOverride", partner.ImageAltOverride);
                partner.Variant = Short(fields, "variant", partner.Variant);
                partner.Featured = Bool(fields, "featured", partner.Featured);
                break;
            case CaseStudy study:
                study.Summary = Long(fields, "summary", study.Summary);
                study.ImageId = GuidValue(fields, "imageId", study.ImageId);
                study.ImageAltOverride = ShortNull(fields, "imageAltOverride", study.ImageAltOverride);
                study.Metric = Short(fields, "metric", study.Metric);
                study.Categories = Strings(fields, "categories", study.Categories);
                study.Featured = Bool(fields, "featured", study.Featured);
                break;
            case BlogPost post:
                post.Summary = Long(fields, "summary", post.Summary);
                post.ImageId = GuidValue(fields, "imageId", post.ImageId);
                post.ImageAltOverride = ShortNull(fields, "imageAltOverride", post.ImageAltOverride);
                post.Category = Short(fields, "category", post.Category);
                post.CategoryLabel = Short(fields, "categoryLabel", post.CategoryLabel);
                post.ReadTime = Int(fields, "readTime", post.ReadTime);
                post.Accent = Short(fields, "accent", post.Accent);
                post.Cluster = Short(fields, "cluster", post.Cluster);
                post.Body = Long(fields, "body", post.Body);
                post.AnswerBlock = LongNull(fields, "answerBlock", post.AnswerBlock);
                post.Faq = Long(fields, "faq", post.Faq);
                post.DateModified = Date(fields, "dateModified", post.DateModified);
                post.Featured = Bool(fields, "featured", post.Featured);
                break;
            case Vacancy vacancy:
                vacancy.Summary = Long(fields, "summary", vacancy.Summary);
                vacancy.Department = Short(fields, "department", vacancy.Department);
                vacancy.Location = Short(fields, "location", vacancy.Location);
                vacancy.EmploymentType = Short(fields, "employmentType", vacancy.EmploymentType);
                vacancy.AboutRole = Long(fields, "aboutRole", vacancy.AboutRole);
                vacancy.KeyResponsibilities = Long(fields, "keyResponsibilities", vacancy.KeyResponsibilities);
                vacancy.RequiredSkills = Long(fields, "requiredSkills", vacancy.RequiredSkills);
                vacancy.NiceToHave = Long(fields, "niceToHave", vacancy.NiceToHave);
                vacancy.RoleOffers = Long(fields, "roleOffers", vacancy.RoleOffers);
                vacancy.InterviewStages = Strings(fields, "interviewStages", vacancy.InterviewStages);
                vacancy.Featured = Bool(fields, "featured", vacancy.Featured);
                break;
            case TeamMember member:
                member.Role = Short(fields, "role", member.Role);
                member.ImageId = GuidValue(fields, "imageId", member.ImageId);
                member.ImageAltOverride = ShortNull(fields, "imageAltOverride", member.ImageAltOverride);
                member.Email = ShortNull(fields, "email", member.Email);
                member.LinkedIn = ShortNull(fields, "linkedIn", member.LinkedIn);
                member.Featured = Bool(fields, "featured", member.Featured);
                break;
            case NewsItem news:
                news.Summary = Long(fields, "summary", news.Summary);
                news.Details = Long(fields, "details", news.Details);
                news.ImageId = GuidValue(fields, "imageId", news.ImageId);
                news.ImageAltOverride = ShortNull(fields, "imageAltOverride", news.ImageAltOverride);
                news.Category = Short(fields, "category", news.Category);
                news.Location = Short(fields, "location", news.Location);
                news.Year = Short(fields, "year", news.Year);
                news.Month = Short(fields, "month", news.Month);
                news.Featured = Bool(fields, "featured", news.Featured);
                break;
            case Page:
                break;
            default:
                Add(errors, "collection", "This collection cannot be saved.");
                break;
        }

        _ = collection;
    }

    private static Dictionary<string, JsonElement> Read(string collection, ContentRecord record)
    {
        object projected = record switch
        {
            Service service => new { service.Summary, service.Icon, service.Visual, service.Featured },
            Partner partner => new { partner.Summary, partner.ImageId, partner.ImageAltOverride, partner.Variant, partner.Featured },
            CaseStudy study => new { study.Summary, study.ImageId, study.ImageAltOverride, study.Metric, study.Categories, study.Featured },
            BlogPost post => new
            {
                post.Summary,
                post.ImageId,
                post.ImageAltOverride,
                post.Category,
                post.CategoryLabel,
                post.ReadTime,
                post.Accent,
                post.Cluster,
                post.Body,
                post.AnswerBlock,
                post.Faq,
                post.DateModified,
                post.Featured,
            },
            Vacancy vacancy => new
            {
                vacancy.Summary,
                vacancy.Department,
                vacancy.Location,
                vacancy.EmploymentType,
                vacancy.AboutRole,
                vacancy.KeyResponsibilities,
                vacancy.RequiredSkills,
                vacancy.NiceToHave,
                vacancy.RoleOffers,
                vacancy.InterviewStages,
                vacancy.Featured,
            },
            TeamMember member => new { member.Role, member.ImageId, member.ImageAltOverride, member.Email, member.LinkedIn, member.Featured },
            NewsItem news => new { news.Summary, news.Details, news.ImageId, news.ImageAltOverride, news.Category, news.Location, news.Year, news.Month, news.Featured },
            _ => new { },
        };
        using var document = JsonDocument.Parse(JsonSerializer.Serialize(projected, ContentJson.Options));
        var fields = document.RootElement.EnumerateObject().ToDictionary(property => property.Name, property => property.Value.Clone(), StringComparer.Ordinal);
        _ = collection;
        return fields;
    }

    private static JsonElement ParseObject(string json)
    {
        using var document = JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json);
        return document.RootElement.Clone();
    }

    private static void OptionalLong(DraftDocument draft, Dictionary<string, List<string>> errors, string name)
    {
        if (!draft.Fields.TryGetValue(name, out var value) || value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
            return;
        if (value.ValueKind != JsonValueKind.String)
            Add(errors, name, "must be text.");
    }

    private static void OptionalShort(DraftDocument draft, Dictionary<string, List<string>> errors, string name, int max)
    {
        if (!draft.Fields.TryGetValue(name, out var value) || value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
            return;
        if (value.ValueKind != JsonValueKind.String)
        {
            Add(errors, name, "must be text.");
            return;
        }

        if ((value.GetString() ?? "").Length > max)
            Add(errors, name, "is longer than " + max + " characters.");
    }

    private static void OptionalBool(DraftDocument draft, Dictionary<string, List<string>> errors, string name)
    {
        if (!draft.Fields.ContainsKey(name))
            return;
        if (draft.Fields[name].ValueKind is not (JsonValueKind.True or JsonValueKind.False))
            Add(errors, name, "must be true or false.");
    }

    private static void OptionalInt(DraftDocument draft, Dictionary<string, List<string>> errors, string name)
    {
        if (!draft.Fields.ContainsKey(name))
            return;
        if (!draft.Fields[name].TryGetInt32(out _))
            Add(errors, name, "must be a whole number.");
    }

    private static void OptionalGuid(DraftDocument draft, Dictionary<string, List<string>> errors, string name)
    {
        if (!draft.Fields.TryGetValue(name, out var value) || value.ValueKind == JsonValueKind.Null)
            return;
        if (value.ValueKind != JsonValueKind.String || !Guid.TryParse(value.GetString(), out _))
            Add(errors, name, "must be an id or null.");
    }

    private static void OptionalStrings(DraftDocument draft, Dictionary<string, List<string>> errors, string name)
    {
        if (!draft.Fields.ContainsKey(name))
            return;
        var value = draft.Fields[name];
        if (value.ValueKind != JsonValueKind.Array || value.EnumerateArray().Any(item => item.ValueKind != JsonValueKind.String))
            Add(errors, name, "must be a list of text.");
    }

    private static void OptionalDate(DraftDocument draft, Dictionary<string, List<string>> errors, string name)
    {
        if (!draft.Fields.TryGetValue(name, out var value) || value.ValueKind == JsonValueKind.Null)
            return;
        if (value.ValueKind != JsonValueKind.String || !DateTime.TryParse(value.GetString(), out _))
            Add(errors, name, "must be a date or null.");
    }

    private static string Long(IReadOnlyDictionary<string, JsonElement> fields, string name, string current) =>
        fields.TryGetValue(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() ?? "" : current;

    private static string? LongNull(IReadOnlyDictionary<string, JsonElement> fields, string name, string? current)
    {
        if (!fields.TryGetValue(name, out var value))
            return current;
        if (value.ValueKind == JsonValueKind.Null)
            return null;
        return value.ValueKind == JsonValueKind.String ? value.GetString() : current;
    }

    private static string Short(IReadOnlyDictionary<string, JsonElement> fields, string name, string current) =>
        fields.TryGetValue(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() ?? "" : current;

    private static string? ShortNull(IReadOnlyDictionary<string, JsonElement> fields, string name, string? current)
    {
        if (!fields.TryGetValue(name, out var value))
            return current;
        if (value.ValueKind == JsonValueKind.Null)
            return null;
        return value.ValueKind == JsonValueKind.String ? Blank(value.GetString()) : current;
    }

    private static bool Bool(IReadOnlyDictionary<string, JsonElement> fields, string name, bool current) =>
        fields.TryGetValue(name, out var value) && value.ValueKind is JsonValueKind.True or JsonValueKind.False ? value.GetBoolean() : current;

    private static int Int(IReadOnlyDictionary<string, JsonElement> fields, string name, int current) =>
        fields.TryGetValue(name, out var value) && value.TryGetInt32(out var number) ? number : current;

    private static Guid? GuidValue(IReadOnlyDictionary<string, JsonElement> fields, string name, Guid? current)
    {
        if (!fields.TryGetValue(name, out var value))
            return current;
        if (value.ValueKind == JsonValueKind.Null)
            return null;
        return Guid.TryParse(value.GetString(), out var id) ? id : current;
    }

    private static List<string> Strings(IReadOnlyDictionary<string, JsonElement> fields, string name, List<string> current)
    {
        if (!fields.TryGetValue(name, out var value) || value.ValueKind != JsonValueKind.Array)
            return current;
        return value.EnumerateArray().Select(item => item.GetString() ?? "").ToList();
    }

    private static DateTime? Date(IReadOnlyDictionary<string, JsonElement> fields, string name, DateTime? current)
    {
        if (!fields.TryGetValue(name, out var value))
            return current;
        if (value.ValueKind == JsonValueKind.Null)
            return null;
        return DateTime.TryParse(value.GetString(), out var parsed) ? DateTime.SpecifyKind(parsed.ToUniversalTime(), DateTimeKind.Utc) : current;
    }

    private static void Limit(Dictionary<string, List<string>> errors, string name, string? value, int max)
    {
        if (value is not null && value.Length > max)
            Add(errors, name, "is longer than " + max + " characters.");
    }

    private static void Add(Dictionary<string, List<string>> errors, string key, string message)
    {
        if (!errors.TryGetValue(key, out var list))
        {
            list = [];
            errors[key] = list;
        }

        list.Add(message);
    }

    private static string? Blank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static readonly System.Text.RegularExpressions.Regex SlugPattern = new("^[a-z0-9]+(?:-[a-z0-9]+)*$", System.Text.RegularExpressions.RegexOptions.CultureInvariant);
}
