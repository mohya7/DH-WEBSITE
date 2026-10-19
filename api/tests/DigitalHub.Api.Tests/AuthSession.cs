using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using DigitalHub.Api.Auth;

namespace DigitalHub.Api.Tests;

public sealed record AuthSession(
    HttpStatusCode Status,
    string Body,
    string? AccessToken,
    string? CsrfToken,
    string? CookiePair,
    string? SetCookie,
    string? CsrfCookiePair,
    string? CsrfSetCookie)
{
    public string? CookieHeader => CookiePair is null
        ? null
        : CsrfCookiePair is null ? CookiePair : $"{CookiePair}; {CsrfCookiePair}";
    public static async Task<AuthSession> LoginAsync(HttpClient client, string email, string password)
    {
        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password });
        var body = await response.Content.ReadAsStringAsync();
        string? access = null;
        string? csrf = null;
        if (response.IsSuccessStatusCode)
        {
            var json = JsonDocument.Parse(body).RootElement;
            access = json.GetProperty("accessToken").GetString();
            csrf = json.GetProperty("csrfToken").GetString();
        }

        string? pair = null;
        string? setCookie = null;
        string? csrfPair = null;
        string? csrfSetCookie = null;
        if (response.Headers.TryGetValues("Set-Cookie", out var cookies))
        {
            setCookie = cookies.FirstOrDefault(value => value.StartsWith(TokenService.RefreshCookieName + "=", StringComparison.Ordinal));
            pair = setCookie?.Split(';', 2)[0];
            csrfSetCookie = cookies.FirstOrDefault(value => value.StartsWith(TokenService.CsrfCookieName + "=", StringComparison.Ordinal));
            csrfPair = csrfSetCookie?.Split(';', 2)[0];
        }

        return new AuthSession(response.StatusCode, body, access, csrf, pair, setCookie, csrfPair, csrfSetCookie);
    }

    /// <summary>
    /// False once the server has ended this session. Every request checks the
    /// session (SessionCheck), so a test that deactivates or resets a user ends
    /// the sessions other tests cached for that user.
    /// </summary>
    public async Task<bool> IsLiveAsync(HttpClient client)
    {
        if (AccessToken is null)
            return false;
        using var response = await client.SendAsync(Authorized(HttpMethod.Get, "/api/v1/auth/me"));
        return response.StatusCode != HttpStatusCode.Unauthorized;
    }

    public HttpRequestMessage Authorized(HttpMethod method, string url)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", AccessToken);
        return request;
    }

    public HttpRequestMessage RefreshRequest(string? csrf = null, string? cookiePair = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/refresh");
        request.Headers.TryAddWithoutValidation("Cookie", cookiePair ?? CookieHeader);
        if (csrf is not null || CsrfToken is not null)
        {
            request.Headers.TryAddWithoutValidation(TokenService.CsrfHeaderName, csrf ?? CsrfToken);
        }

        return request;
    }
}
