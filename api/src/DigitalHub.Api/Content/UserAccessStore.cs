using DigitalHub.Api.Auth;
using DigitalHub.Api.Data;
using DigitalHub.Api.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace DigitalHub.Api.Content;

/// <summary>
/// ADM-04: an admin changes a Studio user's role, or reactivates a deactivated user.
///
/// Both writes take the users lock first, inside their transaction, and read everything
/// they decide on after it: the target, the active admins and the acting admin. So two
/// role changes cannot both pass the last-admin guard, and an admin who was demoted or
/// deactivated while a request was in flight cannot finish it (the token let the request
/// in; the database decides at the write).
///
/// A role change revokes the user's refresh tokens and rotates their security stamp, so
/// every access token they hold, including one a racing refresh issued with the old role,
/// is refused on its next request (SessionCheck). Reactivation gives a new temporary
/// password and never revives an old session.
///
/// A separate store, and a separate controller, because AdminStore.cs and
/// AdminControllers.cs were held by ADM-05. The private helpers below copy AdminStore's;
/// ADM-04b removes the copies.
/// </summary>
public sealed class UserAccessStore(ContentDbContext db, UserManager<ApplicationUser> users, TokenService tokens)
{
    /* One fixed resource for every users change, owned by the transaction. A change waits
       at most 5 s for another, then is refused as busy (503 users_busy).
       UserRoleAndReactivationTests (T9) holds this resource, and UserRoleConcurrencyTests'
       gate cap must stay well under this timeout. Change them together. */
    private const string UsersLockSql =
        "EXEC @result = sp_getapplock @Resource = N'digitalhub:admins', @LockMode = N'Exclusive', @LockOwner = N'Transaction', @LockTimeout = 5000;";

    private const string Gone = "That user does not exist.";

    public async Task<ContentOutcome> ChangeRoleAsync(string id, UserRoleChange request, string? actorId, CancellationToken cancellationToken)
    {
        // 1. The new role.
        var role = request.Role;
        if (role is null || !Roles.IsKnown(role))
            return Validation("role", "Role must be admin, editor, or hr.");

        // 2. Never your own role (another admin does it), as for deactivate.
        if (string.Equals(id, actorId, StringComparison.Ordinal))
            return ContentOutcome.Fail(StatusCodes.Status400BadRequest, "cannot_change_own_role", "You cannot change your own role.");

        // 3. The lock is the first statement in the transaction; every read below is inside it.
        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        if (!await TakeUsersLockAsync(cancellationToken))
            return Busy();

        // 4. The target and its roles.
        var user = await users.FindByIdAsync(id);
        if (user is null)
            return Missing(Gone);
        var current = (await users.GetRolesAsync(user)).Where(Roles.IsKnown).ToList();
        if (current.Count == 0)
            return Missing(Gone);

        // 5.
        if (IsDeactivated(user))
            return ContentOutcome.Fail(StatusCodes.Status400BadRequest, "user_deactivated", "Reactivate this user before changing their role.");

        // 6. The last-admin guard, from the database. Before the actor check on purpose:
        // through HTTP it can fire only when the actor's token is stale.
        if (current.Contains(Roles.Admin) && role != Roles.Admin)
        {
            var admins = await users.GetUsersInRoleAsync(Roles.Admin);
            var otherActiveAdmins = admins.Count(candidate => candidate.Id != user.Id && !IsDeactivated(candidate));
            if (otherActiveAdmins == 0)
                return ContentOutcome.Fail(StatusCodes.Status400BadRequest, "last_admin", "The last active admin cannot lose the admin role.");
        }

        // 7. The acting admin, read fresh.
        if (await EnsureActorAsync(actorId, cancellationToken) is { } refused)
            return refused;

        // 8. The same role: nothing to write, no audit, sessions untouched.
        if (current.Count == 1 && current[0] == role)
        {
            await tx.CommitAsync(cancellationToken);
            return ContentOutcome.Ok(Present(user, role));
        }

        // 9. Any failed step rolls the whole transaction back (the using above).
        var removed = await users.RemoveFromRolesAsync(user, current);
        if (!removed.Succeeded)
            return Failed(removed, "The role could not be changed.");
        var added = await users.AddToRoleAsync(user, role);
        if (!added.Succeeded)
            return Failed(added, "The role could not be changed.");
        var stamped = await users.UpdateSecurityStampAsync(user);
        if (!stamped.Succeeded)
            return Failed(stamped, "The role could not be changed.");

        // 10. Every session of the user ends; they sign in again with the new role.
        await tokens.RevokeUserAsync(user.Id, null, cancellationToken);

        // 11.
        Audit(actorId, "change_user_role", "user", user.Id, string.Join(", ", current) + " -> " + role);
        await db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        // 12. The shape of a list row.
        return ContentOutcome.Ok(Present(user, role));
    }

    public async Task<ContentOutcome> ReactivateAsync(string id, string? actorId, CancellationToken cancellationToken)
    {
        // 1. The lock first, then the acting admin, read fresh.
        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        if (!await TakeUsersLockAsync(cancellationToken))
            return Busy();
        if (await EnsureActorAsync(actorId, cancellationToken) is { } refused)
            return refused;

        // 2. The target, with a Studio role.
        var user = await users.FindByIdAsync(id);
        if (user is null)
            return Missing(Gone);
        var role = (await users.GetRolesAsync(user)).FirstOrDefault(Roles.IsKnown);
        if (role is null)
            return Missing(Gone);

        // 3.
        if (!IsDeactivated(user))
            return ContentOutcome.Fail(StatusCodes.Status400BadRequest, "already_active", "That user is already active.");

        // 4. The lockout state of a newly created user (F-7).
        user.LockoutEnd = null;
        user.AccessFailedCount = 0;
        user.LockoutEnabled = users.Options.Lockout.AllowedForNewUsers;

        // 5. A new temporary password, to be changed at sign-in (O-ADM04-2).
        var temporary = await TemporaryPassword.NewAcceptedAsync(users, user);
        var removed = await users.RemovePasswordAsync(user);
        if (!removed.Succeeded)
            return Failed(removed, "The user could not be reactivated.");
        var added = await users.AddPasswordAsync(user, temporary);
        if (!added.Succeeded)
            return Failed(added, "The user could not be reactivated.");
        user.MustChangePassword = true;
        var stamped = await users.UpdateSecurityStampAsync(user);
        if (!stamped.Succeeded)
            return Failed(stamped, "The user could not be reactivated.");

        // 6.
        var updated = await users.UpdateAsync(user);
        if (!updated.Succeeded)
            return Failed(updated, "The user could not be reactivated.");

        // 7. Old sessions are never revived: those revoked at deactivation stay revoked.
        await tokens.RevokeUserAsync(user.Id, null, cancellationToken);

        // 8. The role, never the password.
        Audit(actorId, "reactivate_user", "user", user.Id, role);
        await db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        // 9. The controller adds Cache-Control: no-store.
        return ContentOutcome.Ok(new
        {
            id = user.Id,
            email = user.Email,
            role,
            active = true,
            mustChangePassword = true,
            temporaryPassword = temporary,
        });
    }

    /// <summary>
    /// The acting admin, re-read inside the lock with fresh queries (never an entity the
    /// request's context already tracks), so a change committed while the request waited
    /// is seen. Null when the actor exists, is active and is still an admin; otherwise 403.
    /// </summary>
    private async Task<ContentOutcome?> EnsureActorAsync(string? actorId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(actorId))
            return Forbidden();

        var actor = await db.Users.AsNoTracking().SingleOrDefaultAsync(candidate => candidate.Id == actorId, cancellationToken);
        if (actor is null || IsDeactivated(actor))
            return Forbidden();

        var isAdmin = await db.UserRoles.AsNoTracking()
            .Where(link => link.UserId == actorId)
            .Join(db.Roles.AsNoTracking(), link => link.RoleId, candidate => candidate.Id, (_, candidate) => candidate.Name)
            .AnyAsync(name => name == Roles.Admin, cancellationToken);
        return isAdmin ? null : Forbidden();
    }

    /// <summary>
    /// Takes the users lock, owned by the current transaction. False on a timeout, a
    /// deadlock or an error (sp_getapplock below 0). It needs only membership of public,
    /// so the application login can take it.
    /// </summary>
    private async Task<bool> TakeUsersLockAsync(CancellationToken cancellationToken)
    {
        var result = new Microsoft.Data.SqlClient.SqlParameter("@result", System.Data.SqlDbType.Int) { Direction = System.Data.ParameterDirection.Output };
        await db.Database.ExecuteSqlRawAsync(UsersLockSql, [result], cancellationToken);
        return result.Value is int code && code >= 0;
    }

    private static object Present(ApplicationUser user, string role) => new
    {
        id = user.Id,
        email = user.Email,
        role,
        active = true,
        mustChangePassword = user.MustChangePassword,
    };

    private static ContentOutcome Failed(IdentityResult result, string title) =>
        result.Errors.Any(error => error.Code == nameof(IdentityErrorDescriber.ConcurrencyFailure))
            ? ContentOutcome.Fail(StatusCodes.Status409Conflict, "concurrency_conflict", "Someone else changed this user. Reload and try again.")
            : ContentOutcome.Fail(StatusCodes.Status400BadRequest, "validation_failed", title);

    private static ContentOutcome Busy() =>
        ContentOutcome.Fail(StatusCodes.Status503ServiceUnavailable, "users_busy", "Another change to the users is in progress. Try again.");

    // The text of Program.cs's OnForbidden.
    private static ContentOutcome Forbidden() =>
        ContentOutcome.Fail(StatusCodes.Status403Forbidden, "forbidden", "You do not have access to this resource.");

    // Copied from AdminStore (ADM-04b removes the copy).
    private static bool IsDeactivated(ApplicationUser user) =>
        user.LockoutEnabled && user.LockoutEnd is not null && user.LockoutEnd > DateTimeOffset.UtcNow;

    // Copied from AdminStore (ADM-04b removes the copy).
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

    // Copied from AdminStore (ADM-04b removes the copy).
    private static ContentOutcome Validation(string field, string message) =>
        Validation(new Dictionary<string, List<string>> { [field] = [message] });

    // Copied from AdminStore (ADM-04b removes the copy).
    private static ContentOutcome Validation(Dictionary<string, List<string>> errors) =>
        ContentOutcome.Fail(
            StatusCodes.Status400BadRequest,
            "validation_failed",
            "One or more fields are invalid.",
            errors.ToDictionary(pair => pair.Key, pair => pair.Value.ToArray()));

    // Copied from AdminStore (ADM-04b removes the copy).
    private static ContentOutcome Missing(string title = "Not found.") =>
        ContentOutcome.Fail(StatusCodes.Status404NotFound, "not_found", title);
}

public sealed class UserRoleChange
{
    public string Role { get; set; } = "";
}
