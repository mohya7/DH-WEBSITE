using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using DigitalHub.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace DigitalHub.Api.Tests;

/// <summary>
/// Finding L1: an unknown email costs a password hash, like a known email with
/// a wrong password, so response time does not reveal which emails exist.
/// </summary>
[Collection("SqlServer")]
public sealed class LoginTimingTests : IClassFixture<LoginTimingTests.CountingFactory>
{
    private readonly CountingFactory _factory;
    private readonly HttpClient _client;

    public LoginTimingTests(CountingFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task An_unknown_email_verifies_a_password_hash_like_a_known_one()
    {
        CountingHasher.Reset();
        var unknown = await _client.PostAsJsonAsync("/api/v1/auth/login", new { email = "nobody-" + Guid.NewGuid().ToString("N")[..8] + "@digitalhub.test", password = "Wrong-Passw0rd!" });
        Assert.Equal(HttpStatusCode.Unauthorized, unknown.StatusCode);
        Assert.Equal(1, CountingHasher.Verifications);

        CountingHasher.Reset();
        var known = await _client.PostAsJsonAsync("/api/v1/auth/login", new { email = ApiFactory.AdminEmail, password = "Wrong-Passw0rd!" });
        Assert.Equal(HttpStatusCode.Unauthorized, known.StatusCode);
        Assert.Equal(1, CountingHasher.Verifications);
    }

    [Fact]
    public async Task Unknown_and_known_emails_take_about_as_long()
    {
        // Warm both paths first.
        await TimeAsync("warm-" + Guid.NewGuid().ToString("N")[..6] + "@digitalhub.test");
        await TimeAsync(ApiFactory.AdminEmail);

        var unknown = new List<double>();
        var known = new List<double>();
        for (var sample = 0; sample < 20; sample++)
        {
            unknown.Add(await TimeAsync($"nobody-{sample}-{Guid.NewGuid():N}"[..24] + "@digitalhub.test"));
            known.Add(await TimeAsync(ApiFactory.AdminEmail));
        }

        var ratio = Median(unknown) / Median(known);
        // Before the fix the ratio was about 0.2 (15 ms against 78 ms in the review).
        Assert.InRange(ratio, 0.6, 1.7);
    }

    private async Task<double> TimeAsync(string email)
    {
        var watch = Stopwatch.StartNew();
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "Wrong-Passw0rd!" });
        watch.Stop();
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        return watch.Elapsed.TotalMilliseconds;
    }

    private static double Median(List<double> values)
    {
        var sorted = values.Order().ToList();
        return sorted[sorted.Count / 2];
    }

    public sealed class CountingFactory : ApiFactory
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.ConfigureTestServices(services =>
                services.AddScoped<IPasswordHasher<ApplicationUser>>(provider =>
                    new CountingHasher(new PasswordHasher<ApplicationUser>(provider.GetService<IOptions<PasswordHasherOptions>>()))));
        }
    }

    public sealed class CountingHasher(IPasswordHasher<ApplicationUser> inner) : IPasswordHasher<ApplicationUser>
    {
        private static int _verifications;

        public static int Verifications => Volatile.Read(ref _verifications);

        public static void Reset() => Interlocked.Exchange(ref _verifications, 0);

        public string HashPassword(ApplicationUser user, string password) => inner.HashPassword(user, password);

        public PasswordVerificationResult VerifyHashedPassword(ApplicationUser user, string hashedPassword, string providedPassword)
        {
            Interlocked.Increment(ref _verifications);
            return inner.VerifyHashedPassword(user, hashedPassword, providedPassword);
        }
    }
}
