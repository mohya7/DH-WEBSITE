using System.Collections.Concurrent;
using System.Text;
using DigitalHub.Api.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Serilog.Core;
using Serilog.Events;

namespace DigitalHub.Api.Tests;

/// <summary>
/// P3 b from the PR #31 check: a client that disconnects in the middle of its
/// body made the duplicate-field reader throw OperationCanceledException, logged
/// as a 500. It is the client's doing: the request is recorded as 499 and no
/// error is logged. Oversize bodies keep their 413 (RequestBodyLimitTests).
/// </summary>
[Collection("SqlServer")]
public sealed class AbortedRequestTests
{
    [Theory]
    [InlineData("/api/v1/auth/login", 0)]
    [InlineData("/api/v1/public/contact", 0)]
    // The request-log line written 300 ms late, after the client has its answer.
    [InlineData("/api/v1/auth/login", 300)]
    public async Task A_client_that_disconnects_mid_body_is_not_a_server_error(string path, int requestLogDelayMs)
    {
        using var factory = new LoggingFactory(requestLogDelayMs);
        // The client side of an aborted request sees the abort, as a real client does.
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => factory.Server.SendAsync(ctx =>
        {
            ctx.Request.Method = HttpMethods.Post;
            ctx.Request.Path = path;
            ctx.Request.ContentType = "application/json";
            ctx.Request.Body = new DisconnectingBody(ctx, Encoding.UTF8.GetBytes("{\"email\":\"x@example.test\",\"password\":\"" + new string('y', 500)));
        }));

        // The server records it as the client's doing, not as an error.
        Assert.Empty(factory.Sink.AtLeast(LogEventLevel.Warning));
        Assert.Contains(factory.Sink.All(), line => line.Contains("Client closed the request", StringComparison.Ordinal));
        Assert.Contains(factory.Sink.All(), line => line.Contains($"\"{path}\" responded 499", StringComparison.Ordinal));
    }

    [Theory]
    [InlineData("/api/v1/auth/login", 0)]
    [InlineData("/api/v1/public/contact", 0)]
    // The request-log line written 300 ms late, after the client has its answer.
    [InlineData("/api/v1/auth/login", 300)]
    public async Task A_chunked_body_that_ends_early_is_a_400_not_a_server_error(string path, int requestLogDelayMs)
    {
        // What Kestrel raises when a chunked body stops before its last chunk (seen on
        // raw TCP; the test server cannot produce it, so the body raises it).
        using var factory = new LoggingFactory(requestLogDelayMs);
        var context = await factory.Server.SendAsync(ctx =>
        {
            ctx.Request.Method = HttpMethods.Post;
            ctx.Request.Path = path;
            ctx.Request.ContentType = "application/json";
            ctx.Request.Body = new EndsEarlyBody(Encoding.UTF8.GetBytes("{\"email\":\"x@example.test\",\"password\":\"" + new string('y', 500)));
        });

        Assert.Equal(StatusCodes.Status400BadRequest, context.Response.StatusCode);
        Assert.Empty(factory.Sink.AtLeast(LogEventLevel.Warning));
        Assert.Contains(factory.Sink.All(), line => line.Contains($"\"{path}\" responded 400", StringComparison.Ordinal));
    }

    /// <summary>Hands out the first bytes, then fails as Kestrel does for a chunked body cut short.</summary>
    private sealed class EndsEarlyBody(byte[] start) : Stream
    {
        private int _position;

        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => _position; set => throw new NotSupportedException(); }

        public override int Read(byte[] buffer, int offset, int count) => ReadAsync(buffer.AsMemory(offset, count)).AsTask().GetAwaiter().GetResult();

        public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken) => ReadAsync(buffer.AsMemory(offset, count), cancellationToken).AsTask();

        public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
        {
            if (_position < start.Length)
            {
                var count = Math.Min(buffer.Length, start.Length - _position);
                start.AsMemory(_position, count).CopyTo(buffer);
                _position += count;
                return ValueTask.FromResult(count);
            }

            throw new BadHttpRequestException("Unexpected end of request content.", StatusCodes.Status400BadRequest);
        }

        public override void Flush() { }
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    }

    /// <summary>Hands out the first bytes, then behaves as a connection the client closed.</summary>
    private sealed class DisconnectingBody(HttpContext context, byte[] start) : Stream
    {
        private int _position;

        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => _position; set => throw new NotSupportedException(); }

        public override int Read(byte[] buffer, int offset, int count) => ReadAsync(buffer.AsMemory(offset, count)).AsTask().GetAwaiter().GetResult();

        public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken) => ReadAsync(buffer.AsMemory(offset, count), cancellationToken).AsTask();

        public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
        {
            if (_position < start.Length)
            {
                var count = Math.Min(buffer.Length, start.Length - _position);
                start.AsMemory(_position, count).CopyTo(buffer);
                _position += count;
                return ValueTask.FromResult(count);
            }

            context.Abort();
            throw new OperationCanceledException(context.RequestAborted);
        }

        public override void Flush() { }
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    }

    private sealed class LoggingFactory(int requestLogDelayMs = 0) : ApiFactory
    {
        public CollectingSink Sink { get; } = new(requestLogDelayMs);

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.ConfigureTestServices(services => services.AddSingleton<ILogEventSink>(Sink));
        }
    }

    /// <summary>
    /// Collects every rendered event. With a delay above zero, the request-log event
    /// is held back that long before it is collected: a synchronous sleep on the
    /// thread that writes it, as a late write on the server thread is.
    /// </summary>
    private sealed class CollectingSink(int requestLogDelayMs = 0) : ILogEventSink
    {
        // The start of the request-log template in Program.cs (UseSerilogRequestLogging).
        private const string RequestLogTemplatePrefix = "HTTP {RequestMethod} ";

        private readonly ConcurrentQueue<(LogEventLevel Level, string Text)> _events = new();

        public void Emit(LogEvent logEvent)
        {
            if (requestLogDelayMs > 0 && logEvent.MessageTemplate.Text.StartsWith(RequestLogTemplatePrefix, StringComparison.Ordinal))
            {
                Thread.Sleep(requestLogDelayMs);
            }

            using var writer = new StringWriter();
            logEvent.RenderMessage(writer);
            _events.Enqueue((logEvent.Level, writer.ToString()));
        }

        public List<string> AtLeast(LogEventLevel level) => _events.Where(item => item.Level >= level).Select(item => $"{item.Level}: {item.Text}").ToList();

        public List<string> All() => _events.Select(item => item.Text).ToList();
    }
}
