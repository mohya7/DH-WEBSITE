using DigitalHub.Api.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace DigitalHub.Api.Identity;

public sealed class IdentitySeeder(IServiceProvider services, IConfiguration configuration) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        if (configuration.GetValue("Database:EnsureCreated", false))
        {
            await db.Database.EnsureCreatedAsync(cancellationToken);
        }
        else
        {
            if (!await db.Database.CanConnectAsync(cancellationToken))
            {
                return;
            }

            if ((await db.Database.GetPendingMigrationsAsync(cancellationToken)).Any())
            {
                return;
            }

            try
            {
                _ = await db.Roles.AnyAsync(cancellationToken);
            }
            catch (Exception)
            {
                return;
            }
        }

        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        foreach (var role in Roles.All)
        {
            if (await roles.RoleExistsAsync(role))
            {
                continue;
            }

            var created = await roles.CreateAsync(new IdentityRole(role));
            if (!created.Succeeded)
            {
                throw new InvalidOperationException($"Could not create role {role}.");
            }
        }

        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        await EnsureUserInRoleAsync(
            users,
            configuration["Auth:InitialAdminEmail"]!,
            configuration["Auth:InitialAdminPassword"]!,
            Roles.Admin);

        var editorEmail = configuration["Auth:InitialEditorEmail"];
        var editorPassword = configuration["Auth:InitialEditorPassword"];
        if (!string.IsNullOrWhiteSpace(editorEmail) && !string.IsNullOrWhiteSpace(editorPassword))
        {
            await EnsureUserInRoleAsync(users, editorEmail, editorPassword, Roles.Editor);
        }
    }

    private static async Task EnsureUserInRoleAsync(
        UserManager<ApplicationUser> users,
        string email,
        string password,
        string role)
    {
        var user = await users.FindByEmailAsync(email);
        if (user is null)
        {
            user = new ApplicationUser
            {
                UserName = email,
                Email = email,
                EmailConfirmed = true,
            };
            var created = await users.CreateAsync(user, password);
            if (!created.Succeeded)
            {
                var duplicate = created.Errors.All(error =>
                    error.Code is "DuplicateUserName" or "DuplicateEmail");
                user = await users.FindByEmailAsync(email);
                if (!duplicate || user is null)
                {
                    var codes = string.Join(", ", created.Errors.Select(error => error.Code));
                    throw new InvalidOperationException($"Could not create the {role} user: {codes}.");
                }
            }
        }

        if (!await users.IsInRoleAsync(user, role))
        {
            var added = await users.AddToRoleAsync(user, role);
            if (!added.Succeeded)
            {
                throw new InvalidOperationException($"Could not assign the {role} role.");
            }
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
