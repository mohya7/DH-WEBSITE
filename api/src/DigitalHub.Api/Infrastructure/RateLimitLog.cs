using System.Net;
using System.Net.Sockets;

namespace DigitalHub.Api.Infrastructure;

/// <summary>
/// A Warning event each time a rate limit refuses a request (finding N9), so a
/// burst of sign-in guesses or contact spam shows up in the logs as more than
/// request lines. It names the method, the path (never the query string or the
/// body, so never an email) and the client's network, not its full address.
/// </summary>
public static class RateLimitLog
{
    public const string Category = "DigitalHub.Api.RateLimit";

    public static void Refused(HttpContext context, string limit)
    {
        var logger = context.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger(Category);
        logger.LogWarning(
            "Rate limit {Limit} refused {Method} {Path} from {ClientNetwork}",
            limit,
            context.Request.Method,
            context.Request.Path.Value,
            Network(context.Connection.RemoteIpAddress));
    }

    /// <summary>The address with its host part removed: an IPv4 /24 or an IPv6 /48.</summary>
    public static string Network(IPAddress? address)
    {
        if (address is null)
            return "unknown";
        if (address.IsIPv4MappedToIPv6)
            address = address.MapToIPv4();
        var bytes = address.GetAddressBytes();
        if (address.AddressFamily == AddressFamily.InterNetwork)
        {
            bytes[3] = 0;
            return new IPAddress(bytes) + "/24";
        }

        for (var index = 6; index < bytes.Length; index++)
            bytes[index] = 0;
        return new IPAddress(bytes) + "/48";
    }
}
