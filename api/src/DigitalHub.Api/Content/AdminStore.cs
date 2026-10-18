using System.Net.Mail;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;
using DigitalHub.Api.Conventions;
using DigitalHub.Api.Data;
using DigitalHub.Api.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace DigitalHub.Api.Content;

public sealed class AdminStore(ContentDbContext db, UserManager<ApplicationUser> users)
{
    private static readonly Regex GtmId = new(@"^GTM-[A-Z0-9]{7,}$", RegexOptions.CultureInvariant | RegexOptions.Compiled);
    private static readonly Regex Phone = new(@"^\+?[0-9][0-9\s\-().]{5,38}$", RegexOptions.CultureInvariant | RegexOptions.Compiled);
    private static readonly HashSet<string> StudioRoles = new(StringComparer.Ordinal) { Roles.Admin, Roles.Editor };
    private static readonly string[] ErrorTypes = ["404", "500"];

    public async Task<ContentOutcome> GetNavigationAsync(string? menu, CancellationToken cancellationToken)
    {
        if (menu is not ("header" or "footer"))
            return Validation("menu", "Menu must be header or footer.");

        var rows = await db.NavigationItems.AsNoTracking()
            .Where(item => item.Menu == menu)
            .OrderBy(item => item.SortOrder)
            .ThenBy(item => item.Label)
            .ToListAsync(cancellationToken);

        var children = rows.Where(item => item.ParentId is not null).GroupBy(item => item.ParentId!.Value)
            .ToDictionary(group => group.Key, group => group.ToList());
        var roots = rows.Where(item => item.ParentId is null).Select(item => PresentNav(item, children)).ToList();
        return ContentOutcome.Ok(new { menu, items = roots });
    }

    public async Task<ContentOutcome> ReplaceNavigationAsync(NavigationReplaceRequest request, string? userId, CancellationToken cancellationToken)
    {
        if (request.Menu is not ("header" or "footer"))
            return Validation("menu", "Menu must be header or footer.");
        if (request.Items is null)
            return Validation("items", "Items are required.");

        var errors = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        var flat = new List<NavFlat>();
        for (var index = 0; index < request.Items.Count; index++)
            ValidateNavItem(request.Items[index], $"items[{index}]", hasParent: false, errors, flat, parentId: null, sort: index);

        if (errors.Count > 0)
            return Validation(errors);

        foreach (var row in flat.Where(item => item.LinkKind == "internal"))
        {
            if (!await TargetExistsAsync(row.TargetType!, row.TargetId!.Value, cancellationToken))
                return Validation("items", "An internal link points at a missing " + row.TargetType + ".");
        }

        var existing = await db.NavigationItems.Where(item => item.Menu == request.Menu).ToListAsync(cancellationToken);
        db.NavigationItems.RemoveRange(existing);
        await db.SaveChangesAsync(cancellationToken);

        foreach (var row in flat.Where(item => item.ParentId is null))
        {
            db.NavigationItems.Add(new NavigationItem
            {
                Id = row.Id,
                Menu = request.Menu,
                ParentId = null,
                Label = row.Label,
                LinkKind = row.LinkKind,
                TargetType = row.TargetType,
                TargetId = row.TargetId,
                Url = row.Url,
                SortOrder = row.SortOrder,
            });
        }

        await db.SaveChangesAsync(cancellationToken);

        foreach (var row in flat.Where(item => item.ParentId is not null))
        {
            db.NavigationItems.Add(new NavigationItem
            {
                Id = row.Id,
                Menu = request.Menu,
                ParentId = row.ParentId,
                Label = row.Label,
                LinkKind = row.LinkKind,
                TargetType = row.TargetType,
                TargetId = row.TargetId,
                Url = row.Url,
                SortOrder = row.SortOrder,
            });
        }

        Audit(userId, "update_navigation", "navigation", request.Menu, request.Menu);
        await db.SaveChangesAsync(cancellationToken);
        return await GetNavigationAsync(request.Menu, cancellationToken);
    }

    public async Task<ContentOutcome> ListRedirectsAsync(int page, int pageSize, string? search, CancellationToken cancellationToken)
    {
        var query = db.Redirects.AsNoTracking();
        var term = string.IsNullOrWhiteSpace(search) ? null : search.Trim();
        if (term is not null)
        {
            query = query.Where(redirect =>
                redirect.FromPath.Contains(term) || redirect.ToPath.Contains(term));
        }

        var total = await query.CountAsync(cancellationToken);
        var rows = await query
            .OrderBy(redirect => redirect.FromPath)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(redirect => new
            {
                redirect.Id,
                redirect.FromPath,
                redirect.ToPath,
                redirect.StatusCode,
                redirect.Source,
                redirect.CreatedAt,
            })
            .ToListAsync(cancellationToken);
        return ContentOutcome.Ok(new PageResult<object>(rows.Cast<object>().ToList(), page, pageSize, total));
    }

    public async Task<ContentOutcome> CreateRedirectAsync(RedirectCreateRequest request, string? userId, CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        var from = RedirectPath(request.FromPath, "fromPath", "From path", errors);
        var to = RedirectPath(request.ToPath, "toPath", "To path", errors);
        if (errors.Count > 0)
            return Validation(errors);

        if (from == to)
            return ContentOutcome.Fail(StatusCodes.Status400BadRequest, "redirect_loop", "A redirect cannot point at itself.");

        if (await db.Redirects.AsNoTracking().AnyAsync(redirect => redirect.FromPath == from, cancellationToken))
            return ContentOutcome.Fail(StatusCodes.Status409Conflict, "redirect_exists", "A redirect from that path already exists.");

        if (await OccupiesLivePathAsync(from!, cancellationToken))
            return ContentOutcome.Fail(StatusCodes.Status400BadRequest, "redirect_live_path", "A redirect source cannot equal the path of a live page.");

        var resolved = await ResolveDestinationAsync(to!, from!, cancellationToken);
        if (resolved.Loop)
            return ContentOutcome.Fail(StatusCodes.Status400BadRequest, "redirect_loop", "That redirect would create a loop.");

        var created = new Redirect
        {
            Id = Guid.NewGuid(),
            FromPath = from!,
            ToPath = resolved.Path,
            StatusCode = 301,
            Source = "manual",
            CreatedById = userId,
            CreatedAt = DateTime.UtcNow,
        };
        db.Redirects.Add(created);
        Audit(userId, "create_redirect", "redirect", created.Id.ToString(), created.FromPath + " -> " + created.ToPath);
        await db.SaveChangesAsync(cancellationToken);
        return ContentOutcome.Ok(new
        {
            created.Id,
            created.FromPath,
            created.ToPath,
            created.StatusCode,
            created.Source,
            created.CreatedAt,
        }, StatusCodes.Status201Created);
    }

    public async Task<ContentOutcome> DeleteRedirectAsync(Guid id, string? userId, CancellationToken cancellationToken)
    {
        var redirect = await db.Redirects.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (redirect is null)
            return Missing("That redirect does not exist.");

        var detail = redirect.FromPath + " -> " + redirect.ToPath;
        db.Redirects.Remove(redirect);
        Audit(userId, "delete_redirect", "redirect", id.ToString(), detail);
        await db.SaveChangesAsync(cancellationToken);
        return ContentOutcome.Ok(null!, StatusCodes.Status204NoContent);
    }

    public async Task<ContentOutcome> GetSettingsAsync(CancellationToken cancellationToken)
    {
        var settings = await db.SiteSettings.AsNoTracking().FirstOrDefaultAsync(cancellationToken);
        /* A database that has never been written to has no settings row. Answer
           with empty defaults rather than 404, so the screen loads and can be
           filled in. Reading never creates the row; the first save does. */
        return ContentOutcome.Ok(PresentSettings(settings ?? new SiteSettings()));
    }

    public async Task<ContentOutcome> UpdateSettingsAsync(SiteSettingsUpdate request, string? userId, CancellationToken cancellationToken)
    {
        var settings = await db.SiteSettings.FirstOrDefaultAsync(cancellationToken);

        var errors = ValidateSettings(request);
        if (errors.Count > 0)
            return Validation(errors);

        // The first save is what creates the row.
        if (settings is null)
        {
            settings = new SiteSettings { Id = Guid.NewGuid() };
            db.SiteSettings.Add(settings);
        }

        settings.Phone = TrimOrNull(request.Phone);
        settings.WhatsApp = TrimOrNull(request.WhatsApp);
        settings.Email = TrimOrNull(request.Email);
        settings.CareersEmail = TrimOrNull(request.CareersEmail);
        settings.LinkedIn = TrimOrNull(request.LinkedIn);
        settings.Facebook = TrimOrNull(request.Facebook);
        settings.Instagram = TrimOrNull(request.Instagram);
        settings.TikTok = TrimOrNull(request.TikTok);
        settings.FooterText = TrimOrNull(request.FooterText);
        settings.StreetAddress = TrimOrNull(request.StreetAddress);
        settings.Locality = TrimOrNull(request.Locality);
        settings.Region = TrimOrNull(request.Region);
        settings.PostalCode = TrimOrNull(request.PostalCode);
        settings.Country = TrimOrNull(request.Country);
        settings.DefaultMetaTitle = TrimOrNull(request.DefaultMetaTitle);
        settings.DefaultMetaDescription = TrimOrNull(request.DefaultMetaDescription);
        settings.DefaultShareImageId = request.DefaultShareImageId;
        settings.DefaultShareImageAltOverride = TrimOrNull(request.DefaultShareImageAltOverride);
        settings.OrganizationName = TrimOrNull(request.OrganizationName);
        settings.LegalName = TrimOrNull(request.LegalName);
        settings.AnalyticsContainerId = TrimOrNull(request.AnalyticsContainerId);
        settings.CookieBannerText = TrimOrNull(request.CookieBannerText);
        settings.CookieBannerTitle = TrimOrNull(request.CookieBannerTitle);
        settings.CookieAcceptLabel = TrimOrNull(request.CookieAcceptLabel);
        settings.CookieRejectLabel = TrimOrNull(request.CookieRejectLabel);
        settings.CookieAnalyticsLabel = TrimOrNull(request.CookieAnalyticsLabel);
        settings.CookieSettingsLabel = TrimOrNull(request.CookieSettingsLabel);

        Audit(userId, "update_settings", "settings", settings.Id.ToString());
        await db.SaveChangesAsync(cancellationToken);
        return ContentOutcome.Ok(PresentSettings(settings));
    }

    public async Task<ContentOutcome> ListUsersAsync(CancellationToken cancellationToken)
    {
        var rows = await users.Users.AsNoTracking().OrderBy(user => user.Email).ToListAsync(cancellationToken);
        var result = new List<object>();
        foreach (var user in rows)
        {
            var roles = await users.GetRolesAsync(user);
            var role = roles.FirstOrDefault(StudioRoles.Contains);
            if (role is null)
                continue;
            result.Add(new
            {
                id = user.Id,
                email = user.Email,
                role,
                active = !IsDeactivated(user),
                mustChangePassword = user.MustChangePassword,
            });
        }

        return ContentOutcome.Ok(new { items = result });
    }

    public async Task<ContentOutcome> CreateUserAsync(UserCreateRequest request, string? actorId, CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        if (string.IsNullOrWhiteSpace(request.Email) || !IsEmail(request.Email))
            Add(errors, "email", "Enter a valid email address.");
        if (request.Role is not (Roles.Admin or Roles.Editor))
            Add(errors, "role", "Role must be admin or editor.");
        if (string.IsNullOrEmpty(request.Password) || request.Password.Length < 12)
            Add(errors, "password", "Password must be at least 12 characters.");
        if (errors.Count > 0)
            return Validation(errors);

        var email = request.Email.Trim();
        if (await users.FindByEmailAsync(email) is not null)
            return ContentOutcome.Fail(StatusCodes.Status409Conflict, "email_taken", "A user with that email already exists.");

        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            MustChangePassword = false,
        };
        var created = await users.CreateAsync(user, request.Password);
        if (!created.Succeeded)
            return ContentOutcome.Fail(StatusCodes.Status400BadRequest, "validation_failed", "The user could not be created.",
                created.Errors.GroupBy(error => error.Code).ToDictionary(group => group.Key, group => group.Select(error => error.Description).ToArray()));

        var role = await users.AddToRoleAsync(user, request.Role);
        if (!role.Succeeded)
            return ContentOutcome.Fail(StatusCodes.Status400BadRequest, "validation_failed", "The role could not be assigned.");

        Audit(actorId, "create_user", "user", user.Id, request.Role);
        await db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
        return ContentOutcome.Ok(new
        {
            id = user.Id,
            email = user.Email,
            role = request.Role,
            active = true,
            mustChangePassword = false,
        }, StatusCodes.Status201Created);
    }

    public async Task<ContentOutcome> DeactivateUserAsync(string id, string? actorId, CancellationToken cancellationToken)
    {
        if (string.Equals(id, actorId, StringComparison.Ordinal))
            return ContentOutcome.Fail(StatusCodes.Status400BadRequest, "cannot_deactivate_self", "You cannot deactivate your own account.");

        var user = await users.FindByIdAsync(id);
        if (user is null || IsDeactivated(user))
            return Missing("That user does not exist.");

        var roles = await users.GetRolesAsync(user);
        if (roles.Contains(Roles.Admin))
        {
            var admins = await users.GetUsersInRoleAsync(Roles.Admin);
            var activeAdmins = admins.Count(candidate => !IsDeactivated(candidate));
            if (activeAdmins <= 1)
                return ContentOutcome.Fail(StatusCodes.Status400BadRequest, "last_admin", "The last active admin cannot be deactivated.");
        }

        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        user.LockoutEnabled = true;
        user.LockoutEnd = DateTimeOffset.MaxValue;
        var updated = await users.UpdateAsync(user);
        if (!updated.Succeeded)
            return ContentOutcome.Fail(StatusCodes.Status400BadRequest, "validation_failed", "The user could not be deactivated.");

        await RevokeRefreshTokensAsync(user.Id, cancellationToken);

        Audit(actorId, "deactivate_user", "user", user.Id);
        await db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
        return ContentOutcome.Ok(new { id = user.Id, active = false });
    }

    public async Task<ContentOutcome> ResetPasswordAsync(string id, string? actorId, CancellationToken cancellationToken)
    {
        var user = await users.FindByIdAsync(id);
        if (user is null || IsDeactivated(user))
            return Missing("That user does not exist.");

        var temporary = NewTemporaryPassword();
        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        var removed = await users.RemovePasswordAsync(user);
        if (!removed.Succeeded)
            return ContentOutcome.Fail(StatusCodes.Status400BadRequest, "validation_failed", "The password could not be reset.");
        var added = await users.AddPasswordAsync(user, temporary);
        if (!added.Succeeded)
            return ContentOutcome.Fail(StatusCodes.Status400BadRequest, "validation_failed", "The password could not be reset.");

        user.MustChangePassword = true;
        await users.UpdateAsync(user);
        // A reset is what follows a compromise: every session of the user ends.
        await RevokeRefreshTokensAsync(user.Id, cancellationToken);
        Audit(actorId, "reset_password", "user", user.Id);
        await db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
        return ContentOutcome.Ok(new { id = user.Id, temporaryPassword = temporary });
    }

    /// <summary>Marks every live refresh token of the user revoked. The caller saves.</summary>
    private async Task RevokeRefreshTokensAsync(string userId, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var tokens = await db.RefreshTokens
            .Where(token => token.UserId == userId && token.RevokedAt == null)
            .ToListAsync(cancellationToken);
        foreach (var token in tokens)
            token.RevokedAt = now;
    }

    public async Task<ContentOutcome> ListAuditAsync(
        string? userId,
        string? action,
        string? entityType,
        DateTime? from,
        DateTime? to,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var query = db.AuditLog.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(userId))
            query = query.Where(entry => entry.UserId == userId);
        if (!string.IsNullOrWhiteSpace(action))
            query = query.Where(entry => entry.Action == action);
        if (!string.IsNullOrWhiteSpace(entityType))
            query = query.Where(entry => entry.EntityType == entityType);
        if (from is not null)
            query = query.Where(entry => entry.At >= from.Value);
        if (to is not null)
            query = query.Where(entry => entry.At <= to.Value);

        var total = await query.CountAsync(cancellationToken);
        var rows = await query
            .OrderByDescending(entry => entry.At)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(entry => new
            {
                entry.Id,
                entry.UserId,
                entry.Action,
                entry.EntityType,
                entry.EntityId,
                entry.At,
                entry.Success,
                entry.Detail,
            })
            .ToListAsync(cancellationToken);
        return ContentOutcome.Ok(new PageResult<object>(rows.Cast<object>().ToList(), page, pageSize, total));
    }

    public async Task<ContentOutcome> ListContactRequestsAsync(int page, int pageSize, string? search, CancellationToken cancellationToken)
    {
        var query = db.ContactRequests.AsNoTracking();
        var term = string.IsNullOrWhiteSpace(search) ? null : search.Trim();
        if (term is not null)
        {
            query = query.Where(request =>
                request.Name.Contains(term)
                || request.Email.Contains(term)
                || request.Organization.Contains(term)
                || request.Message.Contains(term));
        }

        var total = await query.CountAsync(cancellationToken);
        var rows = await query
            .OrderByDescending(request => request.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(request => new
            {
                request.Id,
                request.Name,
                request.Organization,
                request.Email,
                request.Situation,
                request.Status,
                request.CreatedAt,
                request.HandledAt,
            })
            .ToListAsync(cancellationToken);
        return ContentOutcome.Ok(new PageResult<object>(rows.Cast<object>().ToList(), page, pageSize, total));
    }

    public async Task<ContentOutcome> CountNewContactRequestsAsync(CancellationToken cancellationToken)
    {
        var count = await db.ContactRequests.AsNoTracking().CountAsync(request => request.Status == "new", cancellationToken);
        return ContentOutcome.Ok(new { count });
    }

    public async Task<ContentOutcome> GetContactRequestAsync(Guid id, CancellationToken cancellationToken)
    {
        var request = await db.ContactRequests.AsNoTracking().FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (request is null)
            return Missing("That contact request does not exist.");
        return ContentOutcome.Ok(PresentContact(request));
    }

    public async Task<ContentOutcome> HandleContactRequestAsync(Guid id, string? userId, CancellationToken cancellationToken)
    {
        var request = await db.ContactRequests.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (request is null)
            return Missing("That contact request does not exist.");

        request.Status = "handled";
        request.HandledById = userId;
        request.HandledAt = DateTime.UtcNow;
        Audit(userId, "handle_contact", "contact_request", id.ToString());
        await db.SaveChangesAsync(cancellationToken);
        return ContentOutcome.Ok(PresentContact(request));
    }

    public async Task<ContentOutcome> ListErrorPagesAsync(CancellationToken cancellationToken)
    {
        var items = new List<object>();
        foreach (var type in ErrorTypes)
        {
            var slug = "error-" + type;
            var page = await db.Pages.AsNoTracking().Include(item => item.Sections)
                .FirstOrDefaultAsync(item => item.Slug == slug, cancellationToken);
            if (page is null)
                continue;
            var section = page.Sections.OrderBy(item => item.SortOrder).FirstOrDefault(item => item.Type == SectionTypes.RichText)
                ?? page.Sections.OrderBy(item => item.SortOrder).FirstOrDefault();
            items.Add(PresentErrorPage(type, page, section));
        }

        return ContentOutcome.Ok(new { items });
    }

    public async Task<ContentOutcome> UpdateErrorPageAsync(string type, ErrorPageUpdate request, string? userId, CancellationToken cancellationToken)
    {
        if (type is not ("404" or "500"))
            return Validation("type", "Type must be 404 or 500.");
        if (request.Version < 1)
            return Validation("version", "Version is required.");
        if (string.IsNullOrWhiteSpace(request.Title))
            return Validation("title", "Title is required.");

        var bodyErrors = RichText.Validate(request.Body);
        if (bodyErrors.Count > 0)
            return Validation("body", string.Join(" ", bodyErrors));

        var slug = "error-" + type;
        var page = await db.Pages.Include(item => item.Sections).FirstOrDefaultAsync(item => item.Slug == slug, cancellationToken);
        if (page is null)
            return Missing("That error page does not exist.");
        if (page.Version != request.Version)
            return ContentOutcome.Fail(StatusCodes.Status409Conflict, "concurrency_conflict", "Someone else changed this page.");

        var section = page.Sections.OrderBy(item => item.SortOrder).FirstOrDefault(item => item.Type == SectionTypes.RichText)
            ?? page.Sections.OrderBy(item => item.SortOrder).FirstOrDefault();
        if (section is null)
        {
            section = new Section
            {
                Id = Guid.NewGuid(),
                PageId = page.Id,
                Type = SectionTypes.RichText,
                SortOrder = 0,
                Visible = true,
                Fields = "{}",
            };
            page.Sections.Add(section);
            db.Sections.Add(section);
        }

        page.Title = request.Title.Trim();
        page.UpdatedAt = DateTime.UtcNow;
        page.Version += 1;
        section.Type = SectionTypes.RichText;
        section.Fields = JsonSerializer.Serialize(new
        {
            heading = page.Title,
            body = request.Body ?? EmptyDoc,
        }, ContentJson.Options);

        Audit(userId, "update_error_page", "error_page", type, page.Title);
        await db.SaveChangesAsync(cancellationToken);
        return ContentOutcome.Ok(PresentErrorPage(type, page, section));
    }

    private async Task<bool> OccupiesLivePathAsync(string fromPath, CancellationToken cancellationToken)
    {
        var published = ContentStatus.Published;
        var pagePaths = await db.Pages.AsNoTracking()
            .Where(page => page.Status == published)
            .Select(page => page.Slug)
            .ToListAsync(cancellationToken);
        if (pagePaths.Any(slug => ContentPaths.PublicPath("pages", slug) == fromPath))
            return true;

        var servicePaths = await db.Services.AsNoTracking()
            .Where(item => item.Status == published)
            .Select(item => item.Slug)
            .ToListAsync(cancellationToken);
        if (servicePaths.Any(slug => ContentPaths.PublicPath("services", slug) == fromPath))
            return true;

        var partnerPaths = await db.Partners.AsNoTracking()
            .Where(item => item.Status == published)
            .Select(item => item.Slug)
            .ToListAsync(cancellationToken);
        if (partnerPaths.Any(slug => ContentPaths.PublicPath("partners", slug) == fromPath))
            return true;

        var casePaths = await db.CaseStudies.AsNoTracking()
            .Where(item => item.Status == published)
            .Select(item => item.Slug)
            .ToListAsync(cancellationToken);
        if (casePaths.Any(slug => ContentPaths.PublicPath("case-studies", slug) == fromPath))
            return true;

        var blogPaths = await db.BlogPosts.AsNoTracking()
            .Where(item => item.Status == published)
            .Select(item => item.Slug)
            .ToListAsync(cancellationToken);
        if (blogPaths.Any(slug => ContentPaths.PublicPath("blog-posts", slug) == fromPath))
            return true;

        var vacancyPaths = await db.Vacancies.AsNoTracking()
            .Where(item => item.Status == published)
            .Select(item => item.Slug)
            .ToListAsync(cancellationToken);
        return vacancyPaths.Any(slug => ContentPaths.PublicPath("vacancies", slug) == fromPath);
    }

    private async Task<(string Path, bool Loop)> ResolveDestinationAsync(string to, string from, CancellationToken cancellationToken)
    {
        var visited = new HashSet<string>(StringComparer.Ordinal) { from };
        var current = to;
        while (true)
        {
            if (!visited.Add(current))
                return (current, true);
            var next = await db.Redirects.AsNoTracking().FirstOrDefaultAsync(redirect => redirect.FromPath == current, cancellationToken);
            if (next is null)
                return (current, current == from);
            current = next.ToPath;
        }
    }

    private static void ValidateNavItem(
        NavigationNode item,
        string path,
        bool hasParent,
        Dictionary<string, List<string>> errors,
        List<NavFlat> flat,
        Guid? parentId,
        int sort)
    {
        if (string.IsNullOrWhiteSpace(item.Label))
            Add(errors, path + ".label", "Label is required.");
        var children = item.Children ?? [];
        if (hasParent && children.Count > 0)
            Add(errors, path + ".children", "Navigation supports one nesting level.");

        var kind = (item.LinkKind ?? "").Trim().ToLowerInvariant();
        if (children.Count > 0)
            kind = "group";
        else if (string.IsNullOrWhiteSpace(kind))
        {
            if (!string.IsNullOrWhiteSpace(item.Url))
                kind = "external";
            else if (!string.IsNullOrWhiteSpace(item.TargetType) && item.TargetId is not null && item.TargetId != Guid.Empty)
                kind = "internal";
            else
                kind = "group";
        }

        string? targetType = null;
        Guid? targetId = null;
        string? url = null;
        switch (kind)
        {
            case "group":
                break;
            case "internal":
                targetType = item.TargetType?.Trim();
                targetId = item.TargetId;
                if (string.IsNullOrWhiteSpace(targetType) || targetId is null || targetId == Guid.Empty)
                    Add(errors, path + ".targetId", "Choose an existing content item for an internal link.");
                else if (targetType is not ("page" or "service" or "partner" or "case_study" or "blog_post" or "vacancy"))
                    Add(errors, path + ".targetType", "Target type is not supported.");
                break;
            case "external":
                url = item.Url?.Trim();
                if (string.IsNullOrWhiteSpace(url))
                    Add(errors, path + ".url", "Url is required for an external link.");
                else if (url.Length > 300)
                    Add(errors, path + ".url", "Url is too long.");
                else if (!IsAllowedExternalNav(url))
                    Add(errors, path + ".url", "External links must be http, https, mailto, or tel.");
                break;
            default:
                Add(errors, path + ".linkKind", "Link kind must be group, internal, or external.");
                break;
        }

        var id = item.Id == Guid.Empty ? Guid.NewGuid() : item.Id;
        flat.Add(new NavFlat(id, parentId, item.Label?.Trim() ?? "", kind, targetType, targetId, url, sort));
        for (var index = 0; index < children.Count; index++)
            ValidateNavItem(children[index], path + ".children[" + index + "]", hasParent: true, errors, flat, id, index);
    }

    private async Task<bool> TargetExistsAsync(string type, Guid id, CancellationToken cancellationToken) => type switch
    {
        "page" => await db.Pages.AsNoTracking().AnyAsync(item => item.Id == id, cancellationToken),
        "service" => await db.Services.AsNoTracking().AnyAsync(item => item.Id == id, cancellationToken),
        "partner" => await db.Partners.AsNoTracking().AnyAsync(item => item.Id == id, cancellationToken),
        "case_study" => await db.CaseStudies.AsNoTracking().AnyAsync(item => item.Id == id, cancellationToken),
        "blog_post" => await db.BlogPosts.AsNoTracking().AnyAsync(item => item.Id == id, cancellationToken),
        "vacancy" => await db.Vacancies.AsNoTracking().AnyAsync(item => item.Id == id, cancellationToken),
        _ => false,
    };

    private static bool IsAllowedExternalNav(string url)
    {
        if (url.StartsWith("mailto:", StringComparison.OrdinalIgnoreCase)
            || url.StartsWith("tel:", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return Uri.TryCreate(url, UriKind.Absolute, out var uri)
            && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
    }

    private static Dictionary<string, List<string>> ValidateSettings(SiteSettingsUpdate request)
    {
        var errors = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        if (!string.IsNullOrWhiteSpace(request.Email) && !IsEmail(request.Email))
            Add(errors, "email", "Enter a valid email address.");
        if (!string.IsNullOrWhiteSpace(request.CareersEmail) && !IsEmail(request.CareersEmail))
            Add(errors, "careersEmail", "Enter a valid email address.");
        if (!string.IsNullOrWhiteSpace(request.Phone) && !Phone.IsMatch(request.Phone.Trim()))
            Add(errors, "phone", "Enter a reasonable phone number.");
        if (!string.IsNullOrWhiteSpace(request.WhatsApp))
        {
            var value = request.WhatsApp.Trim();
            var ok = Phone.IsMatch(value)
                || (Uri.TryCreate(value, UriKind.Absolute, out var uri)
                    && uri.Scheme == Uri.UriSchemeHttps
                    && uri.Host.Equals("wa.me", StringComparison.OrdinalIgnoreCase));
            if (!ok)
                Add(errors, "whatsApp", "Enter a phone number or an https://wa.me/ link.");
        }
        RequireHttps(errors, "linkedIn", request.LinkedIn);
        RequireHttps(errors, "facebook", request.Facebook);
        RequireHttps(errors, "instagram", request.Instagram);
        RequireHttps(errors, "tikTok", request.TikTok);
        if (!string.IsNullOrWhiteSpace(request.AnalyticsContainerId) && !GtmId.IsMatch(request.AnalyticsContainerId.Trim()))
            Add(errors, "analyticsContainerId", "Analytics container ID must look like GTM-XXXXXXX.");
        LimitText(errors, "cookieBannerTitle", request.CookieBannerTitle, 200);
        LimitText(errors, "cookieAcceptLabel", request.CookieAcceptLabel, 80);
        LimitText(errors, "cookieRejectLabel", request.CookieRejectLabel, 80);
        LimitText(errors, "cookieAnalyticsLabel", request.CookieAnalyticsLabel, 80);
        LimitText(errors, "cookieSettingsLabel", request.CookieSettingsLabel, 80);
        return errors;
    }

    private static void RequireHttps(Dictionary<string, List<string>> errors, string field, string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return;
        if (!Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps)
            Add(errors, field, "Enter an https URL.");
    }

    private static bool IsEmail(string value)
    {
        try
        {
            _ = new MailAddress(value.Trim());
            return value.Contains('@', StringComparison.Ordinal);
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private static bool IsDeactivated(ApplicationUser user) =>
        user.LockoutEnabled && user.LockoutEnd is not null && user.LockoutEnd > DateTimeOffset.UtcNow;

    private static string NewTemporaryPassword()
    {
        const string upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        const string lower = "abcdefghijkmnopqrstuvwxyz";
        const string digits = "23456789";
        const string special = "!@#$%";
        var required = new[]
        {
            upper[RandomNumberGenerator.GetInt32(upper.Length)],
            lower[RandomNumberGenerator.GetInt32(lower.Length)],
            digits[RandomNumberGenerator.GetInt32(digits.Length)],
            special[RandomNumberGenerator.GetInt32(special.Length)],
        };
        var alphabet = upper + lower + digits + special;
        var chars = new char[16];
        for (var index = 0; index < required.Length; index++)
            chars[index] = required[index];
        for (var index = required.Length; index < chars.Length; index++)
            chars[index] = alphabet[RandomNumberGenerator.GetInt32(alphabet.Length)];
        for (var index = chars.Length - 1; index > 0; index--)
        {
            var swap = RandomNumberGenerator.GetInt32(index + 1);
            (chars[index], chars[swap]) = (chars[swap], chars[index]);
        }

        return new string(chars);
    }

    /// <summary>The trimmed path, or null with an error added when the website build could not write it into web.config.</summary>
    private static string? RedirectPath(string? path, string field, string label, Dictionary<string, List<string>> errors)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            Add(errors, field, label + " is required and must start with /.");
            return null;
        }

        var trimmed = path.Trim();
        if (RedirectPaths.Problem(trimmed) is string problem)
        {
            Add(errors, field, label + " " + problem);
            return null;
        }

        return trimmed;
    }

    private static object PresentNav(NavigationItem item, Dictionary<Guid, List<NavigationItem>> children) => new
    {
        item.Id,
        item.Label,
        item.LinkKind,
        item.TargetType,
        item.TargetId,
        item.Url,
        item.SortOrder,
        children = children.TryGetValue(item.Id, out var list)
            ? list.OrderBy(child => child.SortOrder).Select(child => PresentNav(child, children)).ToList()
            : new List<object>(),
    };

    private static object PresentSettings(SiteSettings settings) => new
    {
        settings.Id,
        settings.Phone,
        settings.WhatsApp,
        settings.Email,
        settings.CareersEmail,
        settings.LinkedIn,
        settings.Facebook,
        settings.Instagram,
        settings.TikTok,
        settings.FooterText,
        settings.StreetAddress,
        settings.Locality,
        settings.Region,
        settings.PostalCode,
        settings.Country,
        settings.DefaultMetaTitle,
        settings.DefaultMetaDescription,
        settings.DefaultShareImageId,
        settings.DefaultShareImageAltOverride,
        settings.OrganizationName,
        settings.LegalName,
        settings.AnalyticsContainerId,
        settings.CookieBannerText,
        settings.CookieBannerTitle,
        settings.CookieAcceptLabel,
        settings.CookieRejectLabel,
        settings.CookieAnalyticsLabel,
        settings.CookieSettingsLabel,
    };

    private static object PresentContact(ContactRequest request) => new
    {
        request.Id,
        request.Name,
        request.Organization,
        request.Role,
        request.Email,
        request.Situation,
        request.Message,
        request.Status,
        request.HandledById,
        request.HandledAt,
        request.CreatedAt,
    };

    private static object PresentErrorPage(string type, Page page, Section? section)
    {
        var body = EmptyDoc;
        if (section is not null)
        {
            try
            {
                using var document = JsonDocument.Parse(section.Fields);
                if (document.RootElement.TryGetProperty("body", out var field))
                {
                    body = field.ValueKind switch
                    {
                        JsonValueKind.String => field.GetString() ?? EmptyDoc,
                        JsonValueKind.Object => field.GetRawText(),
                        _ => EmptyDoc,
                    };
                }
            }
            catch (JsonException)
            {
                body = EmptyDoc;
            }
        }

        return new
        {
            type,
            id = page.Id,
            title = page.Title,
            body,
            version = page.Version,
        };
    }

    private void Audit(string? userId, string action, string entityType, string? entityId, string? detail = null)
    {
        db.AuditLog.Add(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            At = DateTime.UtcNow,
            Success = true,
            Detail = detail,
        });
    }

    private static ContentOutcome Validation(string field, string message) =>
        Validation(new Dictionary<string, List<string>> { [field] = [message] });

    private static ContentOutcome Validation(Dictionary<string, List<string>> errors) =>
        ContentOutcome.Fail(
            StatusCodes.Status400BadRequest,
            "validation_failed",
            "One or more fields are invalid.",
            errors.ToDictionary(pair => pair.Key, pair => pair.Value.ToArray()));

    private static ContentOutcome Missing(string title = "Not found.") =>
        ContentOutcome.Fail(StatusCodes.Status404NotFound, "not_found", title);

    private static void Add(Dictionary<string, List<string>> errors, string field, string message)
    {
        if (!errors.TryGetValue(field, out var list))
        {
            list = [];
            errors[field] = list;
        }

        list.Add(message);
    }

    private static string? TrimOrNull(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static void LimitText(Dictionary<string, List<string>> errors, string name, string? value, int max)
    {
        if (value is not null && value.Trim().Length > max)
            Add(errors, name, "is longer than " + max + " characters.");
    }

    private const string EmptyDoc = """{"type":"doc","content":[{"type":"paragraph"}]}""";
}

public sealed class NavigationReplaceRequest
{
    public string Menu { get; set; } = "";

    public List<NavigationNode>? Items { get; set; }
}

public sealed class NavigationNode
{
    public Guid Id { get; set; }

    public string Label { get; set; } = "";

    public string? LinkKind { get; set; }

    public string? TargetType { get; set; }

    public Guid? TargetId { get; set; }

    public string? Url { get; set; }

    public List<NavigationNode>? Children { get; set; }
}

internal sealed record NavFlat(
    Guid Id,
    Guid? ParentId,
    string Label,
    string LinkKind,
    string? TargetType,
    Guid? TargetId,
    string? Url,
    int SortOrder);

public sealed class RedirectCreateRequest
{
    public string FromPath { get; set; } = "";

    public string ToPath { get; set; } = "";
}

public sealed class SiteSettingsUpdate
{
    public string? Phone { get; set; }
    public string? WhatsApp { get; set; }
    public string? Email { get; set; }
    public string? CareersEmail { get; set; }
    public string? LinkedIn { get; set; }
    public string? Facebook { get; set; }
    public string? Instagram { get; set; }
    public string? TikTok { get; set; }
    public string? FooterText { get; set; }
    public string? StreetAddress { get; set; }
    public string? Locality { get; set; }
    public string? Region { get; set; }
    public string? PostalCode { get; set; }
    public string? Country { get; set; }
    public string? DefaultMetaTitle { get; set; }
    public string? DefaultMetaDescription { get; set; }
    public Guid? DefaultShareImageId { get; set; }
    public string? DefaultShareImageAltOverride { get; set; }
    public string? OrganizationName { get; set; }
    public string? LegalName { get; set; }
    public string? AnalyticsContainerId { get; set; }
    public string? CookieBannerText { get; set; }
    public string? CookieBannerTitle { get; set; }
    public string? CookieAcceptLabel { get; set; }
    public string? CookieRejectLabel { get; set; }
    public string? CookieAnalyticsLabel { get; set; }
    public string? CookieSettingsLabel { get; set; }
}

public sealed class UserCreateRequest
{
    public string Email { get; set; } = "";

    public string Role { get; set; } = "";

    public string Password { get; set; } = "";
}

public sealed class ErrorPageUpdate
{
    public int Version { get; set; }

    public string Title { get; set; } = "";

    public string? Body { get; set; }
}
