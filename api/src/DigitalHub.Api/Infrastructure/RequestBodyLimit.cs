using Microsoft.AspNetCore.Http.Features;

namespace DigitalHub.Api.Infrastructure;

/// <summary>
/// The most bytes an action's request body may have. Enforced by
/// RequestBodyLimitMiddleware before anything reads the body, so neither the
/// duplicate-field guard nor the model binder reads more than this (findings M3
/// and L7). Without it Kestrel's default of 30 MB applied.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public sealed class RequestBodyLimitAttribute(long bytes) : Attribute
{
    public long Bytes { get; } = bytes;
}

public sealed class RequestBodyLimitMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var limit = context.GetEndpoint()?.Metadata.GetMetadata<RequestBodyLimitAttribute>()?.Bytes;
        if (limit is not long max)
        {
            await next(context);
            return;
        }

        if (context.Request.ContentLength > max)
        {
            await RefuseAsync(context, max);
            return;
        }

        // Kestrel also stops a body without a Content-Length at the limit.
        var feature = context.Features.Get<IHttpMaxRequestBodySizeFeature>();
        if (feature is { IsReadOnly: false })
            feature.MaxRequestBodySize = max;
        context.Request.Body = new LimitedReadStream(context.Request.Body, max);

        try
        {
            await next(context);
        }
        catch (Exception exception) when (IsTooLarge(exception) && !context.Response.HasStarted)
        {
            await RefuseAsync(context, max);
        }
    }

    private static bool IsTooLarge(Exception exception) => exception switch
    {
        RequestBodyTooLargeException => true,
        BadHttpRequestException bad => bad.StatusCode == StatusCodes.Status413PayloadTooLarge,
        _ => exception.InnerException is not null && IsTooLarge(exception.InnerException),
    };

    private static Task RefuseAsync(HttpContext context, long max)
    {
        context.Response.Clear();
        context.Response.StatusCode = StatusCodes.Status413PayloadTooLarge;
        return ProblemResults.WriteAsync(
            context.Response,
            StatusCodes.Status413PayloadTooLarge,
            "too_large",
            $"The request body must be {max:N0} bytes or smaller.",
            context.RequestAborted);
    }

    private sealed class RequestBodyTooLargeException() : IOException("The request body is over the limit.");

    /// <summary>A read-only view of the body that throws once more than the limit has been read.</summary>
    private sealed class LimitedReadStream(Stream inner, long max) : Stream
    {
        private long _read;

        public override bool CanRead => true;
        public override bool CanSeek => inner.CanSeek;
        public override bool CanWrite => false;
        public override long Length => inner.Length;

        public override long Position
        {
            get => inner.Position;
            set => inner.Position = value;
        }

        public override int Read(byte[] buffer, int offset, int count) => Count(inner.Read(buffer, offset, count));

        public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default) =>
            Count(await inner.ReadAsync(buffer, cancellationToken));

        public override async Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken) =>
            Count(await inner.ReadAsync(buffer.AsMemory(offset, count), cancellationToken));

        public override void Flush() => inner.Flush();
        public override long Seek(long offset, SeekOrigin origin) => inner.Seek(offset, origin);
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();

        private int Count(int read)
        {
            _read += read;
            if (_read > max)
                throw new RequestBodyTooLargeException();
            return read;
        }
    }
}
