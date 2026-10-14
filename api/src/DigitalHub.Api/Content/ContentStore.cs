using System.Text.Json;
using DigitalHub.Api.Conventions;
using DigitalHub.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace DigitalHub.Api.Content;

public sealed class ContentStore(ContentDbContext db, SectionSchemaSet schemas, CollectionSchemaSet collectionSchemas)
{
    public static readonly HashSet<string> OrderedCollections = new(StringComparer.Ordinal)
    {
        "services",
        "partners",
        "case-studies",
        "team-members",
        "news-items",
    };

    private static readonly Dictionary<string, (string EntityType, bool Sections)> Kinds = new(StringComparer.Ordinal)
    {
        ["pages"] = ("page", true),
        ["services"] = ("service", true),
        ["partners"] = ("partner", true),
        ["case-studies"] = ("case_study", true),
        ["blog-posts"] = ("blog_post", false),
        ["vacancies"] = ("vacancy", false),
        ["team-members"] = ("team_member", false),
        ["news-items"] = ("news_item", false),
    };

    public bool Knows(string collection) => Kinds.ContainsKey(collection);

    public async Task<ContentOutcome> ListAsync(string collection, int page, int pageSize, string? search, string? status, CancellationToken cancellationToken)
    {
        if (!Knows(collection))
            return Unknown();
        ContentStatus? parsed = null;
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!Enum.TryParse<ContentStatus>(status, ignoreCase: true, out var value))
                return Validation("status", "Status must be draft, published, or ended.");
            parsed = value;
        }

        var term = string.IsNullOrWhiteSpace(search) ? null : search.Trim();
        var copies = await CopyRowsAsync(collection, cancellationToken);
        var copyIds = copies
            .Where(copy => term is not null && copy.Document.Contains(term, StringComparison.OrdinalIgnoreCase))
            .Select(copy => copy.OwnerId)
            .ToList();
        var byId = copies.ToDictionary(copy => copy.OwnerId, copy => copy.Document);

        var rows = await RowsAsync(collection, parsed, term, copyIds, cancellationToken);
        var total = rows.Count;
        IEnumerable<ContentRow> sorted = OrderedCollections.Contains(collection)
            ? rows.OrderBy(row => row.SortOrder).ThenBy(row => row.Title, StringComparer.OrdinalIgnoreCase).ThenBy(row => row.Slug, StringComparer.OrdinalIgnoreCase)
            : rows.OrderBy(row => row.Title, StringComparer.OrdinalIgnoreCase).ThenBy(row => row.Slug, StringComparer.OrdinalIgnoreCase);
        var pageRows = sorted.Skip((page - 1) * pageSize).Take(pageSize).ToList();
        var cards = await LoadCardsAsync(collection, pageRows.Select(row => row.Id).ToList(), cancellationToken);
        var mediaIds = cards.Values
            .SelectMany(card => new Guid?[] { card.ImageId, card.ShareImageId })
            .Where(id => id is not null)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();
        if (byId.Count > 0)
        {
            foreach (var document in byId.Values)
            {
                var draft = JsonSerializer.Deserialize<DraftDocument>(document, ContentJson.Options);
                if (draft?.ShareImageId is Guid share)
                    mediaIds.Add(share);
                var image = FieldGuid(draft?.Fields, "imageId");
                if (image is Guid id)
                    mediaIds.Add(id);
            }
        }

        var paths = mediaIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await db.Media.AsNoTracking()
                .Where(asset => mediaIds.Contains(asset.Id))
                .ToDictionaryAsync(asset => asset.Id, asset => asset.Path, cancellationToken);

        var items = pageRows
            .Select(row =>
            {
                var slug = row.Slug;
                var title = row.Title;
                var hasCopy = byId.TryGetValue(row.Id, out var document);
                cards.TryGetValue(row.Id, out var card);
                card ??= new CardRow(null, null, null, null, []);
                DraftDocument? draft = null;
                if (hasCopy && document is not null)
                    draft = JsonSerializer.Deserialize<DraftDocument>(document, ContentJson.Options);
                if (draft is not null)
                {
                    slug = draft.Slug;
                    title = draft.Title;
                    card = OverlayCard(collection, slug, card, draft);
                }

                var imageId = card.ImageId ?? card.ShareImageId;
                return new
                {
                    row.Id,
                    slug,
                    title,
                    status = row.Status.ToString().ToLowerInvariant(),
                    state = StateOf(row.Status, hasCopy),
                    row.Version,
                    sortOrder = row.SortOrder,
                    updatedAt = row.UpdatedAt,
                    hasWorkingCopy = hasCopy,
                    summary = card.Summary,
                    imagePath = imageId is Guid mediaId && paths.TryGetValue(mediaId, out var path) ? path : null,
                    chips = card.Chips,
                };
            })
            .ToList();

        return ContentOutcome.Ok(new PageResult<object>(items.Cast<object>().ToList(), page, pageSize, total));
    }

    public async Task<ContentOutcome> GetAsync(string collection, Guid id, CancellationToken cancellationToken)
    {
        if (!Knows(collection))
            return Unknown();
        var loaded = await LoadAsync(collection, id, cancellationToken);
        return loaded is null ? Missing() : ContentOutcome.Ok(Present(collection, loaded, null));
    }

    public Task<ContentOutcome> CreateAsync(string collection, ContentWrite write, string? userId, CancellationToken cancellationToken)
    {
        if (!Knows(collection))
            return Task.FromResult(Unknown());
        return SaveNewAsync(collection, write, userId, cancellationToken);
    }

    public Task<ContentOutcome> UpdateAsync(string collection, Guid id, int version, ContentWrite write, string? userId, CancellationToken cancellationToken)
    {
        if (!Knows(collection))
            return Task.FromResult(Unknown());
        return MutateAsync(collection, id, version, userId, "update", draft => ContentFields.ApplyWrite(draft, write), cancellationToken);
    }

    public Task<ContentOutcome> SaveAsync(string collection, Guid id, ContentSave save, string? userId, CancellationToken cancellationToken)
    {
        if (!Knows(collection))
            return Task.FromResult(Unknown());
        if (SectionsOf(collection) && save.Sections is null)
            return Task.FromResult(Validation("sections", "Include every section in the save."));
        return MutateAsync(collection, id, save.Version, userId, "save", draft =>
        {
            ContentFields.ApplyWrite(draft, save);
            if (!SectionsOf(collection))
                return;
            draft.Sections = (save.Sections ?? []).Select((section, index) => new DraftSection
            {
                Id = section.Id == Guid.Empty ? Guid.NewGuid() : section.Id,
                Type = section.Type.Trim(),
                SortOrder = (index + 1) * 10,
                Visible = section.Visible,
                Fields = section.Fields.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null
                    ? Parse("{}")
                    : section.Fields.Clone(),
            }).ToList();
        }, cancellationToken);
    }

    public async Task<ContentOutcome> OrderAsync(string collection, IReadOnlyList<OrderEntry> items, string? userId, CancellationToken cancellationToken)
    {
        if (!Knows(collection))
            return Unknown();
        if (!OrderedCollections.Contains(collection))
            return Validation("collection", "This collection is not shown in a set order.");

        var records = await LoadRecordsAsync(collection, cancellationToken);
        var byId = records.ToDictionary(record => record.Id);
        if (items.Count != records.Count || items.Select(item => item.Id).Distinct().Count() != items.Count || items.Any(item => !byId.ContainsKey(item.Id)))
            return Validation("items", "Include every item in this collection once.");
        if (items.Any(item => byId[item.Id].Version != item.Version))
            return Conflict();
        if (items.Count == 0)
            return ContentOutcome.Ok(new { items = Array.Empty<object>() });

        for (var index = 0; index < items.Count; index++)
        {
            var record = byId[items[index].Id];
            record.SortOrder = (index + 1) * 10;
            record.Version += 1;
            record.UpdatedAt = DateTime.UtcNow;
            var copy = await FindCopyAsync(collection, record.Id, cancellationToken);
            if (copy is null)
                continue;
            var draft = JsonSerializer.Deserialize<DraftDocument>(copy.Document, ContentJson.Options);
            if (draft is null)
                continue;
            draft.SortOrder = record.SortOrder;
            copy.Document = JsonSerializer.Serialize(draft, ContentJson.Options);
            copy.SavedAt = DateTime.UtcNow;
        }

        Audit(userId, "order", collection, items[0].Id);
        return await CommitAsync(cancellationToken, () => ContentOutcome.Ok(new
        {
            items = items.Select(item => new { id = item.Id, version = byId[item.Id].Version, sortOrder = byId[item.Id].SortOrder }).ToList(),
        }));
    }

    public async Task<ContentOutcome> EndAsync(string collection, Guid id, int version, string? userId, CancellationToken cancellationToken)
    {
        if (collection != "vacancies")
            return Validation("collection", "Only a vacancy can be ended.");
        var loaded = await LoadAsync(collection, id, cancellationToken);
        if (loaded is null)
            return Missing();
        if (loaded.Record.Version != version)
            return Conflict();
        if (loaded.Record is not Vacancy vacancy)
            return Validation("collection", "Only a vacancy can be ended.");
        if (vacancy.Status == ContentStatus.Ended)
            return ContentOutcome.Fail(StatusCodes.Status409Conflict, "already_ended", "This vacancy has already ended.");
        if (vacancy.Status != ContentStatus.Published)
            return ContentOutcome.Fail(StatusCodes.Status409Conflict, "not_published", "Publish the vacancy before ending it.");

        vacancy.Status = ContentStatus.Ended;
        vacancy.EndedAt = DateTime.UtcNow;
        vacancy.UpdatedAt = vacancy.EndedAt.Value;
        vacancy.Version += 1;
        Audit(userId, "end", collection, id);
        return await CommitAsync(cancellationToken, () => ContentOutcome.Ok(Present(collection, loaded, null)));
    }

    public async Task<ContentOutcome> DeleteAsync(string collection, Guid id, int version, string? userId, CancellationToken cancellationToken)
    {
        if (!Knows(collection))
            return Unknown();
        var loaded = await LoadAsync(collection, id, cancellationToken);
        if (loaded is null)
            return Missing();
        if (loaded.Record.Version != version)
            return Conflict();
        if (loaded.Record.Status == ContentStatus.Published)
            return ContentOutcome.Fail(StatusCodes.Status409Conflict, "published", "Unpublish this item before deleting it.");

        var path = ContentPaths.PublicPath(collection, loaded.Record.Slug);
        var redirects = path is null
            ? []
            : await db.Redirects.Where(redirect => redirect.ToPath == path).ToListAsync(cancellationToken);
        db.Redirects.RemoveRange(redirects);
        foreach (var redirect in redirects)
        {
            db.AuditLog.Add(new AuditLogEntry
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Action = "delete_redirect",
                EntityType = "redirect",
                EntityId = redirect.Id.ToString(),
                At = DateTime.UtcNow,
                Success = true,
                Detail = redirect.FromPath + " -> " + redirect.ToPath,
            });
        }

        var entityType = Kinds[collection].EntityType;
        var revisions = await db.Revisions
            .Where(revision => revision.EntityType == entityType && revision.EntityId == id)
            .ToListAsync(cancellationToken);
        db.Revisions.RemoveRange(revisions);
        db.Remove(loaded.Record);
        Audit(userId, "delete", collection, id);
        return await CommitAsync(cancellationToken, () => ContentOutcome.Ok(new { }, StatusCodes.Status204NoContent));
    }

    public async Task<ContentOutcome> DiscardAsync(string collection, Guid id, int version, string? userId, CancellationToken cancellationToken)
    {
        if (!Knows(collection))
            return Unknown();
        var loaded = await LoadAsync(collection, id, cancellationToken);
        if (loaded is null)
            return Missing();
        if (loaded.Record.Status != ContentStatus.Published)
            return ContentOutcome.Fail(StatusCodes.Status409Conflict, "not_published", "Only a published item has live content to return to.");
        if (loaded.Copy is null)
            return ContentOutcome.Fail(StatusCodes.Status404NotFound, "no_working_copy", "This item has no draft to discard.");
        if (loaded.Record.Version != version)
            return Conflict();

        db.WorkingCopies.Remove(loaded.Copy);
        loaded.Copy = null;
        loaded.Record.Version += 1;
        Audit(userId, "discard_draft", collection, id);
        return await CommitAsync(cancellationToken, () => ContentOutcome.Ok(Present(collection, loaded, null)));
    }

    public async Task<ContentOutcome> PublishAsync(string collection, Guid id, int version, string? userId, CancellationToken cancellationToken)
    {
        if (!Knows(collection))
            return Unknown();
        var loaded = await LoadAsync(collection, id, cancellationToken);
        if (loaded is null)
            return Missing();
        if (loaded.Record.Version != version)
            return Conflict();

        var draft = DocumentOf(collection, loaded);
        var errors = new Dictionary<string, List<string>>();
        var warnings = new Dictionary<string, List<string>>();
        foreach (var pair in await CheckAsync(collection, id, draft, cancellationToken))
            errors[pair.Key] = pair.Value;
        await PublishChecks.AddAsync(db, collection, id, draft, errors, warnings, cancellationToken);
        if (errors.Count > 0)
            return PublishBlocked(errors, warnings);

        var previousSlug = await LastPublishedSlugAsync(collection, id, cancellationToken);
        var applyErrors = new Dictionary<string, List<string>>();
        ContentFields.ApplyToRecord(collection, loaded.Record, draft, applyErrors);
        if (applyErrors.Count > 0)
            return PublishBlocked(applyErrors, warnings);

        ReplaceSections(collection, loaded, draft);
        if (loaded.Copy is not null)
        {
            db.WorkingCopies.Remove(loaded.Copy);
            loaded.Copy = null;
        }

        var now = DateTime.UtcNow;
        loaded.Record.Status = ContentStatus.Published;
        if (loaded.Record is Vacancy reopened)
            reopened.EndedAt = null;
        loaded.Record.PublishedAt = now;
        loaded.Record.UpdatedAt = now;
        loaded.Record.Version += 1;
        db.Revisions.Add(new Revision
        {
            Id = Guid.NewGuid(),
            EntityType = Kinds[collection].EntityType,
            EntityId = id,
            Version = loaded.Record.Version,
            Snapshot = JsonSerializer.Serialize(draft, ContentJson.Options),
            PublishedAt = now,
            PublishedById = userId,
        });
        if (previousSlug is not null)
            await RetargetAsync(collection, previousSlug, draft.Slug, userId, cancellationToken);
        Audit(userId, "publish", collection, id);
        var warningBody = warnings.ToDictionary(pair => pair.Key, pair => pair.Value.ToArray());
        return await CommitAsync(cancellationToken, () => ContentOutcome.Ok(Present(collection, loaded, draft, warningBody)));
    }

    public async Task<ContentOutcome> UnpublishAsync(string collection, Guid id, int version, string? userId, CancellationToken cancellationToken)
    {
        if (!Knows(collection))
            return Unknown();
        var loaded = await LoadAsync(collection, id, cancellationToken);
        if (loaded is null)
            return Missing();
        if (loaded.Record.Version != version)
            return Conflict();
        if (loaded.Record.Status != ContentStatus.Published)
            return ContentOutcome.Fail(StatusCodes.Status409Conflict, "not_published", "This item is not published.");

        var draft = DocumentOf(collection, loaded);
        var errors = await CheckAsync(collection, id, draft, cancellationToken);
        if (errors.Count > 0)
            return Validation(errors);

        var applyErrors = new Dictionary<string, List<string>>();
        ContentFields.ApplyToRecord(collection, loaded.Record, draft, applyErrors);
        if (applyErrors.Count > 0)
            return Validation(applyErrors);

        ReplaceSections(collection, loaded, draft);
        if (loaded.Copy is not null)
        {
            db.WorkingCopies.Remove(loaded.Copy);
            loaded.Copy = null;
        }

        loaded.Record.Status = ContentStatus.Draft;
        loaded.Record.UpdatedAt = DateTime.UtcNow;
        loaded.Record.Version += 1;
        Audit(userId, "unpublish", collection, id);
        return await CommitAsync(cancellationToken, () => ContentOutcome.Ok(Present(collection, loaded, draft)));
    }

    public async Task<ContentOutcome> ListRevisionsAsync(string collection, Guid id, CancellationToken cancellationToken)
    {
        if (!Knows(collection))
            return Unknown();
        if (!await ExistsAsync(collection, id, cancellationToken))
            return Missing();

        var entityType = Kinds[collection].EntityType;
        var items = await db.Revisions.AsNoTracking()
            .Where(revision => revision.EntityType == entityType && revision.EntityId == id)
            .OrderByDescending(revision => revision.PublishedAt)
            .Select(revision => new
            {
                revision.Id,
                revision.Version,
                publishedAt = revision.PublishedAt,
                publishedById = revision.PublishedById,
            })
            .ToListAsync(cancellationToken);
        return ContentOutcome.Ok(new { items });
    }

    public async Task<ContentOutcome> GetRevisionAsync(string collection, Guid id, Guid revisionId, CancellationToken cancellationToken)
    {
        if (!Knows(collection))
            return Unknown();
        var revision = await FindRevisionAsync(collection, id, revisionId, cancellationToken);
        if (revision is null)
            return MissingRevision();

        var missing = await MediaUsage.MissingAsync(db, revision.Snapshot, cancellationToken);
        return ContentOutcome.Ok(new
        {
            revision.Id,
            revision.Version,
            publishedAt = revision.PublishedAt,
            publishedById = revision.PublishedById,
            snapshot = Parse(revision.Snapshot),
            missingMedia = missing,
        });
    }

    public async Task<ContentOutcome> RestoreAsync(string collection, Guid id, Guid revisionId, int version, string? userId, CancellationToken cancellationToken)
    {
        if (!Knows(collection))
            return Unknown();
        var loaded = await LoadAsync(collection, id, cancellationToken);
        if (loaded is null)
            return Missing();
        if (loaded.Record.Version != version)
            return Conflict();

        var revision = await FindRevisionAsync(collection, id, revisionId, cancellationToken);
        if (revision is null)
            return MissingRevision();

        var draft = JsonSerializer.Deserialize<DraftDocument>(revision.Snapshot, ContentJson.Options);
        if (draft is null)
            return Validation("snapshot", "This revision cannot be read.");

        var errors = await CheckAsync(collection, id, draft, cancellationToken, requireMedia: false);
        if (errors.Count > 0)
            return Validation(errors);

        var missing = await MediaUsage.MissingAsync(db, revision.Snapshot, cancellationToken);
        if (loaded.Record.Status == ContentStatus.Published)
        {
            var copy = loaded.Copy ?? NewCopy(collection, id);
            copy.Document = JsonSerializer.Serialize(draft, ContentJson.Options);
            copy.SavedAt = DateTime.UtcNow;
            if (loaded.Copy is null)
                db.WorkingCopies.Add(copy);
            loaded.Copy = copy;
        }
        else
        {
            var applyErrors = new Dictionary<string, List<string>>();
            ContentFields.ApplyToRecord(collection, loaded.Record, draft, applyErrors);
            if (applyErrors.Count > 0)
                return Validation(applyErrors);
            ReplaceSections(collection, loaded, draft);
            if (loaded.Copy is not null)
            {
                db.WorkingCopies.Remove(loaded.Copy);
                loaded.Copy = null;
            }

            loaded.Record.UpdatedAt = DateTime.UtcNow;
        }

        loaded.Record.Version += 1;
        Audit(userId, "restore", collection, id);
        return await CommitAsync(cancellationToken, () => ContentOutcome.Ok(new
        {
            item = Present(collection, loaded, draft),
            missingMedia = missing,
        }));
    }

    public Task<ContentOutcome> AddSectionAsync(string collection, Guid id, int version, string type, bool visible, JsonElement fields, string? userId, CancellationToken cancellationToken)
    {
        if (!SectionsOf(collection))
            return Task.FromResult(NoSections());
        return MutateAsync(collection, id, version, userId, "add_section", draft =>
        {
            var order = draft.Sections.Count == 0 ? 10 : draft.Sections.Max(section => section.SortOrder) + 10;
            draft.Sections.Add(new DraftSection
            {
                Id = Guid.NewGuid(),
                Type = type.Trim(),
                SortOrder = order,
                Visible = visible,
                Fields = fields.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null ? Parse("{}") : fields.Clone(),
            });
        }, cancellationToken);
    }

    public Task<ContentOutcome> UpdateSectionAsync(string collection, Guid id, Guid sectionId, int version, JsonElement fields, string? userId, CancellationToken cancellationToken)
    {
        if (!SectionsOf(collection))
            return Task.FromResult(NoSections());
        var missing = false;
        return MutateAsync(collection, id, version, userId, "update_section", draft =>
        {
            var section = draft.Sections.FirstOrDefault(item => item.Id == sectionId);
            if (section is null)
            {
                missing = true;
                return;
            }

            section.Fields = fields.Clone();
        }, cancellationToken, () => missing);
    }

    public Task<ContentOutcome> ReorderAsync(string collection, Guid id, int version, IReadOnlyList<Guid> sectionIds, string? userId, CancellationToken cancellationToken)
    {
        if (!SectionsOf(collection))
            return Task.FromResult(NoSections());
        return MutateAsync(collection, id, version, userId, "reorder_sections", draft =>
        {
            if (sectionIds.Count != draft.Sections.Count || sectionIds.Distinct().Count() != sectionIds.Count
                || draft.Sections.Any(section => !sectionIds.Contains(section.Id)))
            {
                draft.Sections.Add(new DraftSection { Type = "", Fields = Parse("{\"__order\":\"invalid\"}") });
                return;
            }

            var ordered = new List<DraftSection>();
            for (var index = 0; index < sectionIds.Count; index++)
            {
                var section = draft.Sections.First(item => item.Id == sectionIds[index]);
                section.SortOrder = (index + 1) * 10;
                ordered.Add(section);
            }

            draft.Sections = ordered;
        }, cancellationToken);
    }

    public Task<ContentOutcome> VisibilityAsync(string collection, Guid id, Guid sectionId, int version, bool visible, string? userId, CancellationToken cancellationToken)
    {
        if (!SectionsOf(collection))
            return Task.FromResult(NoSections());
        var missing = false;
        return MutateAsync(collection, id, version, userId, visible ? "show_section" : "hide_section", draft =>
        {
            var section = draft.Sections.FirstOrDefault(item => item.Id == sectionId);
            if (section is null)
            {
                missing = true;
                return;
            }

            section.Visible = visible;
        }, cancellationToken, () => missing);
    }

    public Task<ContentOutcome> RemoveSectionAsync(string collection, Guid id, Guid sectionId, int version, string? userId, CancellationToken cancellationToken)
    {
        if (!SectionsOf(collection))
            return Task.FromResult(NoSections());
        var missing = false;
        return MutateAsync(collection, id, version, userId, "remove_section", draft =>
        {
            var section = draft.Sections.FirstOrDefault(item => item.Id == sectionId);
            if (section is null)
            {
                missing = true;
                return;
            }

            draft.Sections.Remove(section);
        }, cancellationToken, () => missing);
    }

    private async Task<ContentOutcome> SaveNewAsync(string collection, ContentWrite write, string? userId, CancellationToken cancellationToken)
    {
        var record = NewRecord(collection);
        record.Id = Guid.NewGuid();
        record.Status = ContentStatus.Draft;
        record.Version = 1;
        record.CreatedAt = DateTime.UtcNow;
        record.UpdatedAt = record.CreatedAt;
        var draft = ContentFields.FromRecord(collection, record, []);
        ContentFields.ApplyWrite(draft, write);
        var errors = await CheckAsync(collection, record.Id, draft, cancellationToken);
        if (errors.Count > 0)
            return Validation(errors);

        var applyErrors = new Dictionary<string, List<string>>();
        ContentFields.ApplyToRecord(collection, record, draft, applyErrors);
        if (applyErrors.Count > 0)
            return Validation(applyErrors);
        Add(record);
        Audit(userId, "create", collection, record.Id);
        var loaded = new Loaded { Record = record, Sections = [] };
        return await CommitAsync(cancellationToken, () => ContentOutcome.Ok(Present(collection, loaded, draft), StatusCodes.Status201Created));
    }

    private async Task<ContentOutcome> MutateAsync(
        string collection,
        Guid id,
        int version,
        string? userId,
        string action,
        Action<DraftDocument> change,
        CancellationToken cancellationToken,
        Func<bool>? missing = null)
    {
        var loaded = await LoadAsync(collection, id, cancellationToken);
        if (loaded is null)
            return Missing();
        if (loaded.Record.Version != version)
            return Conflict();

        var draft = DocumentOf(collection, loaded);
        change(draft);
        if (missing?.Invoke() == true)
            return ContentOutcome.Fail(StatusCodes.Status404NotFound, "not_found", "That section does not exist.");

        if (draft.Sections.Any(section => section.Type.Length == 0))
            return Validation("sectionIds", "List every section of this item once.");

        var errors = await CheckAsync(collection, id, draft, cancellationToken);
        if (errors.Count > 0)
            return Validation(errors);

        if (loaded.Record.Status == ContentStatus.Published)
        {
            var copy = loaded.Copy ?? NewCopy(collection, id);
            copy.Document = JsonSerializer.Serialize(draft, ContentJson.Options);
            copy.SavedAt = DateTime.UtcNow;
            if (loaded.Copy is null)
                db.WorkingCopies.Add(copy);
            loaded.Copy = copy;
        }
        else
        {
            var applyErrors = new Dictionary<string, List<string>>();
            ContentFields.ApplyToRecord(collection, loaded.Record, draft, applyErrors);
            if (applyErrors.Count > 0)
                return Validation(applyErrors);
            ReplaceSections(collection, loaded, draft);
            loaded.Record.UpdatedAt = DateTime.UtcNow;
        }

        loaded.Record.Version += 1;
        Audit(userId, action, collection, id);
        return await CommitAsync(cancellationToken, () => ContentOutcome.Ok(Present(collection, loaded, draft)));
    }

    /// <summary>
    /// Whether an inline-text field may carry marks. Only one field may not: a
    /// hero's heading outside a case study. The home hero's heading is split into
    /// animated parts by the ported scripts, and a mark there would break that.
    /// Every other inline field -- a service hero's lede, a problem's lead, and a
    /// case study's own heading -- carries the emphasis the old pages had.
    ///
    /// The same rule, by the same name, is in packages/blocks/src/inline/document.ts
    /// for the website and the Studio. The two must agree.
    /// </summary>
    public static bool InlineMarksAllowed(string collection, string sectionType, string field) =>
        !(sectionType == "hero" && field == "heading" && collection != "case-studies");

    /// <summary>
    /// The checks a save and a publish apply to one document, for a caller that
    /// writes the rows itself: the content bundle import. The same checks, not a copy.
    /// </summary>
    public Task<Dictionary<string, List<string>>> CheckDocumentAsync(string collection, Guid id, DraftDocument draft, CancellationToken cancellationToken) =>
        CheckAsync(collection, id, draft, cancellationToken);

    private async Task<Dictionary<string, List<string>>> CheckAsync(string collection, Guid id, DraftDocument draft, CancellationToken cancellationToken, bool requireMedia = true)
    {
        var errors = new Dictionary<string, List<string>>();
        ContentFields.Validate(collection, draft, errors);
        foreach (var message in collectionSchemas.Validate(collection, JsonSerializer.Serialize(draft.Fields, ContentJson.Options)))
            Add(errors, "fields", message);
        if (draft.Fields.TryGetValue("body", out var body) && body.ValueKind == JsonValueKind.String)
        {
            foreach (var message in RichText.Validate(body.GetString()))
                Add(errors, "body", message);
        }
        if (Kinds[collection].Sections)
        {
            for (var index = 0; index < draft.Sections.Count; index++)
            {
                var section = draft.Sections[index];
                var key = "sections[" + index + "]";
                if (!schemas.Knows(section.Type))
                {
                    Add(errors, key, "Unknown section type.");
                    continue;
                }

                var json = section.Fields.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null
                    ? "{}"
                    : section.Fields.GetRawText();
                foreach (var message in schemas.Validate(section.Type, json))
                    Add(errors, key, message);
                if (section.Fields.ValueKind == JsonValueKind.Object)
                {
                    var inlineTextFields = schemas.InlineTextFields(section.Type);
                    foreach (var property in section.Fields.EnumerateObject())
                    {
                        if (property.Value.ValueKind != JsonValueKind.String || property.Value.GetString() is not { } text)
                            continue;
                        if (inlineTextFields.Contains(property.Name))
                        {
                            foreach (var message in InlineText.Validate(text, InlineMarksAllowed(collection, section.Type, property.Name)))
                                Add(errors, key + "." + property.Name, message);
                            continue;
                        }

                        if (!text.Contains("\"type\":\"doc\"", StringComparison.Ordinal) && !text.Contains("\"type\": \"doc\"", StringComparison.Ordinal))
                            continue;
                        foreach (var message in RichText.Validate(text))
                            Add(errors, key + "." + property.Name, message);
                    }
                }
            }
        }
        else if (draft.Sections.Count > 0)
        {
            Add(errors, "sections", "This item has no sections.");
        }

        if (await SlugTakenAsync(collection, id, draft.Slug, cancellationToken))
            Add(errors, "slug", "That slug is already in use.");

        var path = ContentPaths.PublicPath(collection, draft.Slug);
        if (path is not null && await db.Redirects.AsNoTracking().AnyAsync(redirect => redirect.FromPath == path, cancellationToken))
            Add(errors, "slug", "That address is the source of a redirect.");

        var referenced = MediaUsage.ReferencedIds(JsonSerializer.Serialize(draft, ContentJson.Options));
        if (requireMedia && referenced.Count > 0)
        {
            var existing = await db.Media.AsNoTracking()
                .Where(asset => referenced.Contains(asset.Id))
                .Select(asset => asset.Id)
                .ToListAsync(cancellationToken);
            var known = existing.ToHashSet();
            foreach (var mediaId in referenced.Where(mediaId => !known.Contains(mediaId)))
                Add(errors, "media", mediaId + " is not in the library.");
        }

        return errors;
    }

    private void ReplaceSections(string collection, Loaded loaded, DraftDocument draft)
    {
        if (!Kinds[collection].Sections)
            return;

        var keep = draft.Sections.Select(section => section.Id).ToHashSet();
        foreach (var section in loaded.Sections.Where(section => !keep.Contains(section.Id)).ToList())
        {
            db.Sections.Remove(section);
            loaded.Sections.Remove(section);
        }

        foreach (var draftSection in draft.Sections)
        {
            var row = loaded.Sections.FirstOrDefault(section => section.Id == draftSection.Id);
            if (row is null)
            {
                row = new Section { Id = draftSection.Id };
                Assign(row, collection, loaded.Record.Id);
                db.Sections.Add(row);
                loaded.Sections.Add(row);
            }

            row.Type = draftSection.Type;
            row.SortOrder = draftSection.SortOrder;
            row.Visible = draftSection.Visible;
            row.Fields = draftSection.Fields.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null
                ? "{}"
                : draftSection.Fields.GetRawText();
        }
    }

    private async Task<bool> SlugTakenAsync(string collection, Guid id, string slug, CancellationToken cancellationToken)
    {
        var live = collection switch
        {
            "pages" => await db.Pages.AnyAsync(item => item.Id != id && item.Slug == slug, cancellationToken),
            "services" => await db.Services.AnyAsync(item => item.Id != id && item.Slug == slug, cancellationToken),
            "partners" => await db.Partners.AnyAsync(item => item.Id != id && item.Slug == slug, cancellationToken),
            "case-studies" => await db.CaseStudies.AnyAsync(item => item.Id != id && item.Slug == slug, cancellationToken),
            "blog-posts" => await db.BlogPosts.AnyAsync(item => item.Id != id && item.Slug == slug, cancellationToken),
            "vacancies" => await db.Vacancies.AnyAsync(item => item.Id != id && item.Slug == slug, cancellationToken),
            "team-members" => await db.TeamMembers.AnyAsync(item => item.Id != id && item.Slug == slug, cancellationToken),
            "news-items" => await db.NewsItems.AnyAsync(item => item.Id != id && item.Slug == slug, cancellationToken),
            _ => false,
        };
        if (live)
            return true;

        var documents = await CopyRowsAsync(collection, cancellationToken);
        var taken = documents.Any(copy => copy.OwnerId != id && JsonSerializer.Deserialize<DraftDocument>(copy.Document, ContentJson.Options) is { } draft
            && string.Equals(draft.Slug, slug, StringComparison.Ordinal));
        return taken;
    }

    private async Task<List<ContentRow>> RowsAsync(string collection, ContentStatus? status, string? term, List<Guid> copyIds, CancellationToken cancellationToken)
    {
        switch (collection)
        {
            case "pages": return await Project(Filter(db.Pages.AsNoTracking(), status, term, copyIds)).ToListAsync(cancellationToken);
            case "services": return await Project(Filter(db.Services.AsNoTracking(), status, term, copyIds)).ToListAsync(cancellationToken);
            case "partners": return await Project(Filter(db.Partners.AsNoTracking(), status, term, copyIds)).ToListAsync(cancellationToken);
            case "case-studies": return await Project(Filter(db.CaseStudies.AsNoTracking(), status, term, copyIds)).ToListAsync(cancellationToken);
            case "blog-posts": return await Project(Filter(db.BlogPosts.AsNoTracking(), status, term, copyIds)).ToListAsync(cancellationToken);
            case "vacancies": return await Project(Filter(db.Vacancies.AsNoTracking(), status, term, copyIds)).ToListAsync(cancellationToken);
            case "team-members": return await Project(Filter(db.TeamMembers.AsNoTracking(), status, term, copyIds)).ToListAsync(cancellationToken);
            case "news-items": return await Project(Filter(db.NewsItems.AsNoTracking(), status, term, copyIds)).ToListAsync(cancellationToken);
            default: return [];
        }
    }

    private static IQueryable<ContentRow> Project<T>(IQueryable<T> query)
        where T : ContentRecord =>
        query.Select(item => new ContentRow(item.Id, item.Slug, item.Title, item.Status, item.Version, item.UpdatedAt, item.SortOrder));

    private static IQueryable<T> Filter<T>(IQueryable<T> query, ContentStatus? status, string? term, List<Guid> copyIds)
        where T : ContentRecord
    {
        if (status is not null)
            query = query.Where(item => item.Status == status);
        if (term is not null)
            query = query.Where(item => item.Title.Contains(term) || item.Slug.Contains(term) || copyIds.Contains(item.Id));
        return query;
    }

    private async Task<Loaded?> LoadAsync(string collection, Guid id, CancellationToken cancellationToken)
    {
        ContentRecord? record;
        List<Section> sections;
        switch (collection)
        {
            case "pages":
                var page = await db.Pages.Include(item => item.Sections).FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
                record = page;
                sections = page?.Sections.ToList() ?? [];
                break;
            case "services":
                var service = await db.Services.Include(item => item.Sections).FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
                record = service;
                sections = service?.Sections.ToList() ?? [];
                break;
            case "partners":
                var partner = await db.Partners.Include(item => item.Sections).FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
                record = partner;
                sections = partner?.Sections.ToList() ?? [];
                break;
            case "case-studies":
                var study = await db.CaseStudies.Include(item => item.Sections).FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
                record = study;
                sections = study?.Sections.ToList() ?? [];
                break;
            case "blog-posts":
                record = await db.BlogPosts.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
                sections = [];
                break;
            case "vacancies":
                record = await db.Vacancies.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
                sections = [];
                break;
            case "team-members":
                record = await db.TeamMembers.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
                sections = [];
                break;
            case "news-items":
                record = await db.NewsItems.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
                sections = [];
                break;
            default:
                return null;
        }

        if (record is null)
            return null;
        var copy = await FindCopyAsync(collection, id, cancellationToken);
        return new Loaded { Record = record, Sections = sections, Copy = copy };
    }

    private async Task<List<CopyRow>> CopyRowsAsync(string collection, CancellationToken cancellationToken)
    {
        switch (collection)
        {
            case "pages":
                return await db.WorkingCopies.AsNoTracking().Where(copy => copy.PageId != null)
                    .Select(copy => new CopyRow(copy.PageId!.Value, copy.Document)).ToListAsync(cancellationToken);
            case "services":
                return await db.WorkingCopies.AsNoTracking().Where(copy => copy.ServiceId != null)
                    .Select(copy => new CopyRow(copy.ServiceId!.Value, copy.Document)).ToListAsync(cancellationToken);
            case "partners":
                return await db.WorkingCopies.AsNoTracking().Where(copy => copy.PartnerId != null)
                    .Select(copy => new CopyRow(copy.PartnerId!.Value, copy.Document)).ToListAsync(cancellationToken);
            case "case-studies":
                return await db.WorkingCopies.AsNoTracking().Where(copy => copy.CaseStudyId != null)
                    .Select(copy => new CopyRow(copy.CaseStudyId!.Value, copy.Document)).ToListAsync(cancellationToken);
            case "blog-posts":
                return await db.WorkingCopies.AsNoTracking().Where(copy => copy.BlogPostId != null)
                    .Select(copy => new CopyRow(copy.BlogPostId!.Value, copy.Document)).ToListAsync(cancellationToken);
            case "vacancies":
                return await db.WorkingCopies.AsNoTracking().Where(copy => copy.VacancyId != null)
                    .Select(copy => new CopyRow(copy.VacancyId!.Value, copy.Document)).ToListAsync(cancellationToken);
            case "team-members":
                return await db.WorkingCopies.AsNoTracking().Where(copy => copy.TeamMemberId != null)
                    .Select(copy => new CopyRow(copy.TeamMemberId!.Value, copy.Document)).ToListAsync(cancellationToken);
            case "news-items":
                return await db.WorkingCopies.AsNoTracking().Where(copy => copy.NewsItemId != null)
                    .Select(copy => new CopyRow(copy.NewsItemId!.Value, copy.Document)).ToListAsync(cancellationToken);
            default:
                return [];
        }
    }

    private Task<WorkingCopy?> FindCopyAsync(string collection, Guid id, CancellationToken cancellationToken) => collection switch
    {
        "pages" => db.WorkingCopies.FirstOrDefaultAsync(copy => copy.PageId == id, cancellationToken),
        "services" => db.WorkingCopies.FirstOrDefaultAsync(copy => copy.ServiceId == id, cancellationToken),
        "partners" => db.WorkingCopies.FirstOrDefaultAsync(copy => copy.PartnerId == id, cancellationToken),
        "case-studies" => db.WorkingCopies.FirstOrDefaultAsync(copy => copy.CaseStudyId == id, cancellationToken),
        "blog-posts" => db.WorkingCopies.FirstOrDefaultAsync(copy => copy.BlogPostId == id, cancellationToken),
        "vacancies" => db.WorkingCopies.FirstOrDefaultAsync(copy => copy.VacancyId == id, cancellationToken),
        "team-members" => db.WorkingCopies.FirstOrDefaultAsync(copy => copy.TeamMemberId == id, cancellationToken),
        "news-items" => db.WorkingCopies.FirstOrDefaultAsync(copy => copy.NewsItemId == id, cancellationToken),
        _ => Task.FromResult<WorkingCopy?>(null),
    };

    private static WorkingCopy NewCopy(string collection, Guid id)
    {
        var copy = new WorkingCopy { Id = Guid.NewGuid() };
        switch (collection)
        {
            case "pages": copy.PageId = id; break;
            case "services": copy.ServiceId = id; break;
            case "partners": copy.PartnerId = id; break;
            case "case-studies": copy.CaseStudyId = id; break;
            case "blog-posts": copy.BlogPostId = id; break;
            case "vacancies": copy.VacancyId = id; break;
            case "team-members": copy.TeamMemberId = id; break;
            case "news-items": copy.NewsItemId = id; break;
        }

        return copy;
    }

    private static ContentRecord NewRecord(string collection) => collection switch
    {
        "pages" => new Page(),
        "services" => new Service(),
        "partners" => new Partner(),
        "case-studies" => new CaseStudy(),
        "blog-posts" => new BlogPost(),
        "vacancies" => new Vacancy(),
        "team-members" => new TeamMember(),
        "news-items" => new NewsItem(),
        _ => throw new InvalidOperationException("Unknown collection."),
    };

    private void Add(ContentRecord record)
    {
        switch (record)
        {
            case Page page: db.Pages.Add(page); break;
            case Service service: db.Services.Add(service); break;
            case Partner partner: db.Partners.Add(partner); break;
            case CaseStudy study: db.CaseStudies.Add(study); break;
            case BlogPost post: db.BlogPosts.Add(post); break;
            case Vacancy vacancy: db.Vacancies.Add(vacancy); break;
            case TeamMember member: db.TeamMembers.Add(member); break;
            case NewsItem news: db.NewsItems.Add(news); break;
        }
    }

    private static void Assign(Section section, string collection, Guid id)
    {
        section.PageId = collection == "pages" ? id : null;
        section.ServiceId = collection == "services" ? id : null;
        section.PartnerId = collection == "partners" ? id : null;
        section.CaseStudyId = collection == "case-studies" ? id : null;
    }

    private async Task<string?> LastPublishedSlugAsync(string collection, Guid id, CancellationToken cancellationToken)
    {
        var entityType = Kinds[collection].EntityType;
        var snapshot = await db.Revisions.AsNoTracking()
            .Where(revision => revision.EntityType == entityType && revision.EntityId == id)
            .OrderByDescending(revision => revision.PublishedAt)
            .ThenByDescending(revision => revision.Version)
            .Select(revision => revision.Snapshot)
            .FirstOrDefaultAsync(cancellationToken);
        if (snapshot is null)
            return null;
        return JsonSerializer.Deserialize<DraftDocument>(snapshot, ContentJson.Options)?.Slug;
    }

    private object Present(string collection, Loaded loaded, DraftDocument? editing, IReadOnlyDictionary<string, string[]>? warnings = null)
    {
        var live = ContentFields.FromRecord(collection, loaded.Record, loaded.Sections);
        DraftDocument content;
        if (editing is not null)
            content = editing;
        else if (loaded.Copy is not null)
            content = JsonSerializer.Deserialize<DraftDocument>(loaded.Copy.Document, ContentJson.Options) ?? live;
        else
            content = live;

        var published = loaded.Record.Status == ContentStatus.Published;
        var hasWorkingCopy = published && loaded.Copy is not null;
        return new
        {
            id = loaded.Record.Id,
            collection,
            status = loaded.Record.Status.ToString().ToLowerInvariant(),
            state = StateOf(loaded.Record.Status, hasWorkingCopy),
            version = loaded.Record.Version,
            updatedAt = loaded.Record.UpdatedAt,
            publishedAt = loaded.Record.PublishedAt,
            hasWorkingCopy,
            notice = published ? "Published changes appear on the website at the next build." : null,
            endedAt = (loaded.Record as Vacancy)?.EndedAt,
            warnings = warnings ?? new Dictionary<string, string[]>(),
            content = Body(collection, content),
            live = published ? Body(collection, live) : null,
        };
    }

    private static DraftDocument DocumentOf(string collection, Loaded loaded) =>
        loaded.Copy is null
            ? ContentFields.FromRecord(collection, loaded.Record, loaded.Sections)
            : JsonSerializer.Deserialize<DraftDocument>(loaded.Copy.Document, ContentJson.Options)
                ?? ContentFields.FromRecord(collection, loaded.Record, loaded.Sections);

    private async Task RetargetAsync(string collection, string oldSlug, string newSlug, string? userId, CancellationToken cancellationToken)
    {
        var oldPath = ContentPaths.PublicPath(collection, oldSlug);
        var newPath = ContentPaths.PublicPath(collection, newSlug);
        if (oldPath is null || newPath is null || oldPath == newPath)
            return;

        var redirects = await db.Redirects
            .Where(redirect => redirect.ToPath == oldPath || redirect.FromPath == oldPath)
            .ToListAsync(cancellationToken);
        foreach (var redirect in redirects.Where(redirect => redirect.ToPath == oldPath && redirect.FromPath != oldPath).ToList())
        {
            redirect.ToPath = newPath;
            if (redirect.FromPath == redirect.ToPath)
            {
                AuditRedirect(userId, "delete_redirect", redirect.Id, redirect.FromPath + " -> " + oldPath);
                db.Redirects.Remove(redirect);
            }
            else
            {
                AuditRedirect(userId, "update_redirect", redirect.Id, redirect.FromPath + " -> " + newPath);
            }
        }

        var own = redirects.FirstOrDefault(redirect => redirect.FromPath == oldPath);
        if (own is not null)
        {
            own.ToPath = newPath;
            AuditRedirect(userId, "update_redirect", own.Id, oldPath + " -> " + newPath);
            return;
        }

        var created = new Redirect
        {
            Id = Guid.NewGuid(),
            FromPath = oldPath,
            ToPath = newPath,
            StatusCode = 301,
            Source = "slug",
            CreatedById = userId,
            CreatedAt = DateTime.UtcNow,
        };
        db.Redirects.Add(created);
        AuditRedirect(userId, "create_redirect", created.Id, oldPath + " -> " + newPath);
    }

    private async Task<bool> ExistsAsync(string collection, Guid id, CancellationToken cancellationToken) => collection switch
    {
        "pages" => await db.Pages.AnyAsync(item => item.Id == id, cancellationToken),
        "services" => await db.Services.AnyAsync(item => item.Id == id, cancellationToken),
        "partners" => await db.Partners.AnyAsync(item => item.Id == id, cancellationToken),
        "case-studies" => await db.CaseStudies.AnyAsync(item => item.Id == id, cancellationToken),
        "blog-posts" => await db.BlogPosts.AnyAsync(item => item.Id == id, cancellationToken),
        "vacancies" => await db.Vacancies.AnyAsync(item => item.Id == id, cancellationToken),
        "team-members" => await db.TeamMembers.AnyAsync(item => item.Id == id, cancellationToken),
        "news-items" => await db.NewsItems.AnyAsync(item => item.Id == id, cancellationToken),
        _ => false,
    };

    private Task<Revision?> FindRevisionAsync(string collection, Guid id, Guid revisionId, CancellationToken cancellationToken)
    {
        var entityType = Kinds[collection].EntityType;
        return db.Revisions.FirstOrDefaultAsync(
            revision => revision.Id == revisionId && revision.EntityType == entityType && revision.EntityId == id,
            cancellationToken);
    }

    private void AuditRedirect(string? userId, string action, Guid id, string detail)
    {
        db.AuditLog.Add(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Action = action,
            EntityType = "redirect",
            EntityId = id.ToString(),
            At = DateTime.UtcNow,
            Success = true,
            Detail = detail,
        });
    }

    private static string StateOf(ContentStatus status, bool hasWorkingCopy) =>
        status == ContentStatus.Published
            ? hasWorkingCopy ? "changed" : "published"
            : status.ToString().ToLowerInvariant();

    private static object Body(string collection, DraftDocument draft) => new
    {
        draft.Slug,
        draft.Title,
        draft.SortOrder,
        draft.MetaTitle,
        draft.MetaDescription,
        draft.ShareImageId,
        draft.ShareImageAltOverride,
        draft.CanonicalOverride,
        draft.NoIndex,
        draft.Fields,
        sections = Kinds[collection].Sections ? draft.Sections.OrderBy(section => section.SortOrder).ToList() : null,
    };

    private void Audit(string? userId, string action, string collection, Guid id)
    {
        db.AuditLog.Add(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Action = action,
            EntityType = Kinds[collection].EntityType,
            EntityId = id.ToString(),
            At = DateTime.UtcNow,
            Success = true,
        });
    }

    private async Task<ContentOutcome> CommitAsync(CancellationToken cancellationToken, Func<ContentOutcome> success)
    {
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return success();
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict();
        }
    }

    private static bool SectionsOf(string collection) => Kinds.TryGetValue(collection, out var kind) && kind.Sections;

    private static JsonElement Parse(string json)
    {
        using var document = JsonDocument.Parse(json);
        return document.RootElement.Clone();
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

    private static ContentOutcome Unknown() =>
        ContentOutcome.Fail(StatusCodes.Status404NotFound, "unknown_collection", "That collection does not exist.");

    private static ContentOutcome Missing() =>
        ContentOutcome.Fail(StatusCodes.Status404NotFound, "not_found", "That item does not exist.");

    private static ContentOutcome Conflict() =>
        ContentOutcome.Fail(StatusCodes.Status409Conflict, "concurrency_conflict", "This item was changed by someone else.");

    private static ContentOutcome NoSections() =>
        ContentOutcome.Fail(StatusCodes.Status404NotFound, "sections_not_supported", "This item has no sections.");

    private static ContentOutcome MissingRevision() =>
        ContentOutcome.Fail(StatusCodes.Status404NotFound, "not_found", "That revision does not exist.");

    private static ContentOutcome PublishBlocked(Dictionary<string, List<string>> errors, Dictionary<string, List<string>> warnings) =>
        ContentOutcome.Fail(
            StatusCodes.Status400BadRequest,
            "publish_blocked",
            "Publishing is blocked until every check passes.",
            errors.ToDictionary(pair => pair.Key, pair => pair.Value.ToArray()),
            warnings.ToDictionary(pair => pair.Key, pair => pair.Value.ToArray()));

    private static ContentOutcome Validation(string key, string message) =>
        Validation(new Dictionary<string, List<string>> { [key] = [message] });

    private static ContentOutcome Validation(Dictionary<string, List<string>> errors) =>
        ContentOutcome.Fail(
            StatusCodes.Status400BadRequest,
            "validation_failed",
            "One or more fields are invalid.",
            errors.ToDictionary(pair => pair.Key, pair => pair.Value.ToArray()));

    private sealed record ContentRow(Guid Id, string Slug, string Title, ContentStatus Status, int Version, DateTime UpdatedAt, int SortOrder);

    private sealed record CardRow(string? Summary, Guid? ImageId, Guid? ShareImageId, string? MetaDescription, IReadOnlyList<string> Chips);

    private async Task<Dictionary<Guid, CardRow>> LoadCardsAsync(string collection, List<Guid> ids, CancellationToken cancellationToken)
    {
        if (ids.Count == 0)
            return [];

        switch (collection)
        {
            case "pages":
                return (await db.Pages.AsNoTracking().Where(item => ids.Contains(item.Id))
                    .Select(item => new { item.Id, item.MetaDescription, item.ShareImageId, item.Slug })
                    .ToListAsync(cancellationToken))
                    .ToDictionary(item => item.Id, item => new CardRow(item.MetaDescription, item.ShareImageId, item.ShareImageId, item.MetaDescription, ChipList(item.Slug)));
            case "services":
                return (await db.Services.AsNoTracking().Where(item => ids.Contains(item.Id))
                    .Select(item => new { item.Id, item.Summary, item.ShareImageId, item.MetaDescription, item.Slug })
                    .ToListAsync(cancellationToken))
                    .ToDictionary(item => item.Id, item => new CardRow(item.Summary, item.ShareImageId, item.ShareImageId, item.MetaDescription, ChipList(ContentPaths.PublicPath("services", item.Slug))));
            case "partners":
                return (await db.Partners.AsNoTracking().Where(item => ids.Contains(item.Id))
                    .Select(item => new { item.Id, item.Summary, item.ImageId, item.ShareImageId, item.MetaDescription, item.Slug })
                    .ToListAsync(cancellationToken))
                    .ToDictionary(item => item.Id, item => new CardRow(item.Summary, item.ImageId, item.ShareImageId, item.MetaDescription, ChipList(ContentPaths.PublicPath("partners", item.Slug))));
            case "case-studies":
                return (await db.CaseStudies.AsNoTracking().Where(item => ids.Contains(item.Id))
                    .Select(item => new { item.Id, item.Summary, item.ImageId, item.ShareImageId, item.MetaDescription, item.Metric, item.Categories })
                    .ToListAsync(cancellationToken))
                    .ToDictionary(item => item.Id, item => new CardRow(item.Summary, item.ImageId, item.ShareImageId, item.MetaDescription, ChipList(item.Metric, string.Join(", ", item.Categories))));
            case "blog-posts":
                return (await db.BlogPosts.AsNoTracking().Where(item => ids.Contains(item.Id))
                    .Select(item => new { item.Id, item.Summary, item.ImageId, item.ShareImageId, item.MetaDescription, item.ReadTime, item.Cluster, item.CategoryLabel, item.Category })
                    .ToListAsync(cancellationToken))
                    .ToDictionary(item => item.Id, item => new CardRow(item.Summary, item.ImageId, item.ShareImageId, item.MetaDescription, ChipList(item.ReadTime > 0 ? item.ReadTime + " min" : null, First(item.Cluster, item.CategoryLabel, item.Category))));
            case "vacancies":
                return (await db.Vacancies.AsNoTracking().Where(item => ids.Contains(item.Id))
                    .Select(item => new { item.Id, item.Summary, item.ShareImageId, item.MetaDescription, item.Department, item.Location, item.EmploymentType })
                    .ToListAsync(cancellationToken))
                    .ToDictionary(item => item.Id, item => new CardRow(item.Summary, item.ShareImageId, item.ShareImageId, item.MetaDescription, ChipList(item.Department, item.Location, item.EmploymentType)));
            case "team-members":
                return (await db.TeamMembers.AsNoTracking().Where(item => ids.Contains(item.Id))
                    .Select(item => new { item.Id, item.Role, item.ImageId, item.ShareImageId, item.MetaDescription, item.LinkedIn })
                    .ToListAsync(cancellationToken))
                    .ToDictionary(item => item.Id, item => new CardRow(item.Role, item.ImageId, item.ShareImageId, item.MetaDescription, ChipList(item.Role, string.IsNullOrWhiteSpace(item.LinkedIn) ? "No profile link" : item.LinkedIn)));
            case "news-items":
                return (await db.NewsItems.AsNoTracking().Where(item => ids.Contains(item.Id))
                    .Select(item => new { item.Id, item.Summary, item.ImageId, item.ShareImageId, item.MetaDescription, item.Category, item.Location, item.Year })
                    .ToListAsync(cancellationToken))
                    .ToDictionary(item => item.Id, item => new CardRow(item.Summary, item.ImageId, item.ShareImageId, item.MetaDescription, ChipList(item.Category, item.Location, item.Year)));
            default:
                return [];
        }
    }

    private static CardRow OverlayCard(string collection, string slug, CardRow live, DraftDocument draft)
    {
        var fields = draft.Fields;
        var summary = First(FieldText(fields, "summary"), FieldText(fields, "role"), draft.MetaDescription, live.Summary);
        var imageId = FieldGuid(fields, "imageId") ?? live.ImageId;
        var shareImageId = draft.ShareImageId ?? live.ShareImageId;
        var chips = collection switch
        {
            "pages" => ChipList(slug),
            "services" => ChipList(ContentPaths.PublicPath("services", slug)),
            "partners" => ChipList(ContentPaths.PublicPath("partners", slug)),
            "case-studies" => ChipList(FieldText(fields, "metric"), FieldJoined(fields, "categories")),
            "blog-posts" => ChipList(
                FieldInt(fields, "readTime") is int minutes && minutes > 0 ? minutes + " min" : null,
                First(FieldText(fields, "cluster"), FieldText(fields, "categoryLabel"), FieldText(fields, "category"))),
            "vacancies" => ChipList(FieldText(fields, "department"), FieldText(fields, "location"), FieldText(fields, "employmentType")),
            "team-members" => ChipList(
                First(FieldText(fields, "role"), live.Summary),
                First(FieldText(fields, "linkedIn"), live.Chips.ElementAtOrDefault(1), "No profile link")),
            "news-items" => ChipList(FieldText(fields, "category"), FieldText(fields, "location"), FieldText(fields, "year")),
            _ => live.Chips,
        };
        if (chips.Count == 0)
            chips = live.Chips;
        return new CardRow(summary, imageId, shareImageId, draft.MetaDescription ?? live.MetaDescription, chips);
    }

    private static IReadOnlyList<string> ChipList(params string?[] values) =>
        values.Where(value => !string.IsNullOrWhiteSpace(value)).Select(value => value!.Trim()).Take(3).ToList();

    private static string? First(params string?[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));

    private static string? FieldText(Dictionary<string, JsonElement>? fields, string key)
    {
        if (fields is null || !fields.TryGetValue(key, out var value))
            return null;
        if (value.ValueKind == JsonValueKind.String)
            return string.IsNullOrWhiteSpace(value.GetString()) ? null : value.GetString();
        if (value.ValueKind == JsonValueKind.Number)
            return value.ToString();
        return null;
    }

    private static Guid? FieldGuid(Dictionary<string, JsonElement>? fields, string key)
    {
        var text = FieldText(fields, key);
        return Guid.TryParse(text, out var id) ? id : null;
    }

    private static int? FieldInt(Dictionary<string, JsonElement>? fields, string key)
    {
        if (fields is null || !fields.TryGetValue(key, out var value))
            return null;
        if (value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var number))
            return number;
        return int.TryParse(FieldText(fields, key), out var parsed) ? parsed : null;
    }

    private static string? FieldJoined(Dictionary<string, JsonElement>? fields, string key)
    {
        if (fields is null || !fields.TryGetValue(key, out var value) || value.ValueKind != JsonValueKind.Array)
            return null;
        var text = string.Join(", ", value.EnumerateArray().Select(item => item.GetString()).Where(item => !string.IsNullOrWhiteSpace(item)));
        return string.IsNullOrWhiteSpace(text) ? null : text;
    }

    private async Task<List<ContentRecord>> LoadRecordsAsync(string collection, CancellationToken cancellationToken) => collection switch
    {
        "pages" => (await db.Pages.ToListAsync(cancellationToken)).Cast<ContentRecord>().ToList(),
        "services" => (await db.Services.ToListAsync(cancellationToken)).Cast<ContentRecord>().ToList(),
        "partners" => (await db.Partners.ToListAsync(cancellationToken)).Cast<ContentRecord>().ToList(),
        "case-studies" => (await db.CaseStudies.ToListAsync(cancellationToken)).Cast<ContentRecord>().ToList(),
        "blog-posts" => (await db.BlogPosts.ToListAsync(cancellationToken)).Cast<ContentRecord>().ToList(),
        "vacancies" => (await db.Vacancies.ToListAsync(cancellationToken)).Cast<ContentRecord>().ToList(),
        "team-members" => (await db.TeamMembers.ToListAsync(cancellationToken)).Cast<ContentRecord>().ToList(),
        "news-items" => (await db.NewsItems.ToListAsync(cancellationToken)).Cast<ContentRecord>().ToList(),
        _ => [],
    };

    private sealed record CopyRow(Guid OwnerId, string Document);

    private sealed class Loaded
    {
        public required ContentRecord Record { get; init; }

        public required List<Section> Sections { get; init; }

        public WorkingCopy? Copy { get; set; }
    }
}

public sealed class ContentOutcome
{
    public object? Body { get; init; }

    public int Status { get; init; }

    public string? Code { get; init; }

    public string? Title { get; init; }

    public IDictionary<string, string[]>? Errors { get; init; }

    public IDictionary<string, string[]>? Warnings { get; init; }

    public static ContentOutcome Ok(object body, int status = StatusCodes.Status200OK) => new() { Body = body, Status = status };

    public static ContentOutcome Fail(int status, string code, string title, IDictionary<string, string[]>? errors = null, IDictionary<string, string[]>? warnings = null) =>
        new() { Status = status, Code = code, Title = title, Errors = errors, Warnings = warnings };
}
