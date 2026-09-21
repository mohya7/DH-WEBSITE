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
        var email = configuration["Auth:InitialAdminEmail"]!;
        var password = configuration["Auth:InitialAdminPassword"]!;
        var admin = await users.FindByEmailAsync(email);
        if (admin is null)
        {
            admin = new ApplicationUser
            {
                UserName = email,
                Email = email,
                EmailConfirmed = true,
            };
            var created = await users.CreateAsync(admin, password);
            if (!created.Succeeded)
            {
                var codes = string.Join(", ", created.Errors.Select(error => error.Code));
                throw new InvalidOperationException($"Could not create the initial admin user: {codes}.");
            }
        }

        if (!await users.IsInRoleAsync(admin, Roles.Admin))
        {
            var added = await users.AddToRoleAsync(admin, Roles.Admin);
            if (!added.Succeeded)
            {
                throw new InvalidOperationException("Could not assign the admin role.");
            }
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
