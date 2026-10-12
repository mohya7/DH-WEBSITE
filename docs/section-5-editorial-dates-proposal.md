# Section 5 Part B — editorial calendar dates (proposal only)

Status: **not implemented or applied**. No collection schema, entity, active EF
migration, importer date logic or byline has been changed by this proposal.
Approval is required by the task's Part B and AGENTS.md's schema rule.

## Schema and entity changes

In `packages/collections/blog-posts.json`, add `datePublished` and replace the
definition of `dateModified` with the same nullable calendar-date shape:

```json
"datePublished": {
  "type": ["string", "null"],
  "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}$",
  "x-dh-kind": "text",
  "x-dh-label": "Publication date (YYYY-MM-DD)"
},
"dateModified": {
  "type": ["string", "null"],
  "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}$",
  "x-dh-kind": "text",
  "x-dh-label": "Modified date (YYYY-MM-DD)"
}
```

Both remain optional for drafts. The API must additionally use
`DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture,
DateTimeStyles.None, out ...)`: the regex alone does not reject 2026-02-30.
Reject timestamps and zone suffixes. JSON uses only `YYYY-MM-DD` or null.
The type generator currently rejects `pattern`; add explicit handling that
retains TypeScript `string` while leaving runtime validation to the schema/API,
and update its unsupported-keyword test to another genuinely unsupported keyword.
Regenerate the shared schema types with that change.

`BlogPost` in `ContentEntities.cs`:

```csharp
public DateOnly? DatePublished { get; set; }
public DateOnly? DateModified { get; set; } // replaces DateTime?
```

`ContentModelBuilder.cs`:

```csharp
entity.Property(post => post.DatePublished).HasColumnType("date");
entity.Property(post => post.DateModified).HasColumnType("date");
```

Add `datePublished` to `ContentDocuments`' blog field allow-list, validation,
apply and read projection, and use a nullable `DateOnly` parser for both fields.
System.Text.Json serializes DateOnly to the required calendar representation.
`published_at`, `created_at`, and `updated_at` keep their system roles; no SQL
copies them into editorial fields. Publish time remains the API publish time.

## Source extraction and importer changes

All five source articles have publication **2026-06-15** and modification
**2026-08-12**. Listed posts get these from `collections.blogs[].datePublished`
and `.dateModified` in source `content/site-content.json`; HTML-only posts get
them from the `Published 15 Jun 2026` and `Updated 12 Aug 2026` byline fragments.

Replace only the blog date extraction with date-only helpers:

```csharp
private static DateOnly? CalendarDate(string? value) =>
    DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture,
        DateTimeStyles.None, out var date) ? date : null;

private static DateOnly? BylineCalendarDate(IHtmlDocument document, string label)
{
    var byline = document.QuerySelector(".blog-view-byline")?.TextContent ?? "";
    var match = Regex.Match(byline,
        Regex.Escape(label) + @"\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})");
    return match.Success && DateOnly.TryParseExact(match.Groups[1].Value,
        new[] { "d MMM yyyy", "dd MMM yyyy" }, CultureInfo.InvariantCulture,
        DateTimeStyles.None, out var date) ? date : null;
}

// BlogFrom:
var published = htmlOnly ? BylineCalendarDate(document!, "Published")
                         : CalendarDate(Text(item, "datePublished"));
var modified = htmlOnly ? BylineCalendarDate(document!, "Updated")
                        : CalendarDate(Text(item, "dateModified"));
// Within new BlogPost:
DatePublished = published,
DateModified = modified,
CreatedAt = default,
UpdatedAt = default,
```

Use the existing UpsertRecord behavior to assign system times for new imports
and preserve existing CreatedAt on re-import; its existing published-record
rules remain unchanged. Add both editorial fields to `SameBlog` comparison;
remove DateModified from any DateTime-only comparison helper. A nonblank invalid
source date stops the import with the source path/field named; it must not
silently become null. Missing dates remain null, without copying one field to
the other. No local-time conversion, midnight construction or `ToUniversalTime`.

## Existing-row conversion and proposed migration

Do not truncate `date_modified` blindly: listed imported posts currently carry
`2026-08-11 21:00:00` in this Cairo environment, while HTML-only posts carry
`2026-08-12 00:00:00`. A cast would turn the listed dates into August 11.
Do not backfill publication from `published_at` or `created_at`.

The conversion is source-backed and guarded. The five known source slugs map as
follows, only while their existing modification value is the recorded imported
value. Rows absent from this table, edited dates, or working copies require an
explicit per-row conversion manifest before applying to that database. Do not
run the importer over an edited database to perform this conversion.

| Slug | Expected old date_modified | New datePublished | New dateModified |
|---|---|---|---|
| digital-employee-experience | 2026-08-11 21:00:00 | 2026-06-15 | 2026-08-12 |
| azure-digital-egypt-2030 | 2026-08-11 21:00:00 | 2026-06-15 | 2026-08-12 |
| enterprise-ai-production | 2026-08-11 21:00:00 | 2026-06-15 | 2026-08-12 |
| digital-transformation-signs | 2026-08-12 00:00:00 | 2026-06-15 | 2026-08-12 |
| augment-vs-outsource-tech-team | 2026-08-12 00:00:00 | 2026-06-15 | 2026-08-12 |

Proposed migration `BlogEditorialCalendarDates` (shown here, **not registered in
the migrations project**). The transaction is provided by EF. Its guard runs
before DDL. An empty database is allowed, because a fresh import fills it later.
This is the concrete initial-import conversion; it deliberately refuses an
edited database until a reviewed conversion manifest replaces the guard/map.

```csharp
protected override void Up(MigrationBuilder migrationBuilder)
{
    migrationBuilder.Sql("""
        IF EXISTS (SELECT 1 FROM working_copies WHERE blog_post_id IS NOT NULL)
            THROW 50001, 'Blog working copies need a reviewed calendar-date conversion manifest.', 1;

        IF EXISTS (
            SELECT 1 FROM blog_posts b
            LEFT JOIN (VALUES
                ('digital-employee-experience', '2026-08-11T21:00:00'),
                ('azure-digital-egypt-2030', '2026-08-11T21:00:00'),
                ('enterprise-ai-production', '2026-08-11T21:00:00'),
                ('digital-transformation-signs', '2026-08-12T00:00:00'),
                ('augment-vs-outsource-tech-team', '2026-08-12T00:00:00')
            ) s(slug, previous_modified) ON s.slug = b.slug
            WHERE s.slug IS NULL OR b.date_modified IS NULL
               OR b.date_modified <> CONVERT(datetime2, s.previous_modified, 126)
        )
            THROW 50001, 'Blog dates differ from the reviewed source map; review each row before converting.', 1;
        """);

    migrationBuilder.AddColumn<DateOnly>(
        name: "date_published", table: "blog_posts", type: "date", nullable: true);
    migrationBuilder.AddColumn<DateOnly>(
        name: "date_modified_calendar", table: "blog_posts", type: "date", nullable: true);
    migrationBuilder.Sql("""
        UPDATE blog_posts SET
            date_published = CONVERT(date, '2026-06-15', 23),
            date_modified_calendar = CONVERT(date, '2026-08-12', 23);
        """);
    migrationBuilder.DropColumn(name: "date_modified", table: "blog_posts");
    migrationBuilder.RenameColumn(
        name: "date_modified_calendar", table: "blog_posts", newName: "date_modified");
}

protected override void Down(MigrationBuilder migrationBuilder) =>
    throw new NotSupportedException(
        "Calendar dates cannot reconstruct discarded times. Restore the pre-migration backup.");
```

The fixed source dates in this migration are historical conversion data, not a
runtime rule. The new importer reads each article's own fields. Before execution,
generate and show the EF migration and SQL script, confirm the actual catalog,
review the row map against a read-only export, and take the usual database backup.
The elevated account applies it; the application never migrates at startup.
No read or write of `DigitalHubContent` was needed to prepare this proposal.

Revisions retain immutable original JSON. Add a compatibility step when reading
or restoring pre-change blog revisions: show the raw old timestamp and require
an explicit calendar-date choice for ambiguous data; never publish it or infer
a publication date from a revision/system timestamp. Already-normalized dates
pass through. For initial imported rows, their reviewed source map may provide
the two dates. Converted working copies, when approved through their own map,
must preserve unrelated draft fields, bump the owning version and audit the
conversion transaction. The migration above refuses them rather than discarding
or silently overwriting edits.

## Byline and validation after approval

Change `BlogArticle` from `displayDate(item.publishedAt)` to
`displayCalendarDate(f.datePublished)`. Format by splitting a validated
`YYYY-MM-DD` into numeric day/month/year and a fixed English month-name array;
do not create a JavaScript Date or apply a time zone. `dateModified` uses the
same formatter. Null dates omit that part of the byline. There is no fallback to
system timestamps.

After approval: test exact JSON round trips, invalid/leap dates, timestamp/zone
rejection, both importer paths, migration refusal on edited rows/copies,
restoration of old revisions, and identical display under UTC/Cairo/US zones.
Run the API suite only on DigitalHubContent_Test. Rebuild the parity database
and snapshot from a clean committed tree, then run website tests/build/browser
tests/comparison. The three publication-byline failures should disappear;
the newly exposed chrome content conflicts need their separate decision.
