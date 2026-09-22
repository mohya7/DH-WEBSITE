using System.Buffers.Binary;

namespace DigitalHub.Images;

public enum ImageKind
{
    Jpeg,
    Png,
    Webp,
}

internal enum HeaderSize
{
    Ok,
    OverCap,
    Invalid,
}

internal static class ImageHeaders
{
    private static readonly byte[] PngSignature = [137, 80, 78, 71, 13, 10, 26, 10];

    public static bool IsSvg(ReadOnlySpan<byte> data)
    {
        if (IsUtf16Svg(data))
            return true;

        var span = data;
        if (span.StartsWith(new byte[] { 0xEF, 0xBB, 0xBF }))
            span = span[3..];
        var start = 0;
        while (start < span.Length && span[start] is (byte)' ' or (byte)'\t' or (byte)'\r' or (byte)'\n')
            start++;
        span = span[start..];
        if (span.Length > 512)
            span = span[..512];
        if (StartsWith(span, "<svg") || StartsWith(span, "<!doctype svg"))
            return true;
        if (StartsWith(span, "<?xml") || StartsWith(span, "<!doctype"))
            return Contains(span, "<svg");
        return false;
    }

    public static bool TryKind(ReadOnlySpan<byte> data, out ImageKind kind)
    {
        kind = default;
        if (data.Length >= 3 && data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF)
        {
            kind = ImageKind.Jpeg;
            return true;
        }

        if (data.Length >= PngSignature.Length && data.StartsWith(PngSignature))
        {
            kind = ImageKind.Png;
            return true;
        }

        if (data.Length >= 12 && data.StartsWith("RIFF"u8) && data[8..12].SequenceEqual("WEBP"u8))
        {
            kind = ImageKind.Webp;
            return true;
        }

        return false;
    }

    public static HeaderSize ReadSize(ReadOnlySpan<byte> data, ImageKind kind, out int width, out int height) => kind switch
    {
        ImageKind.Jpeg => Jpeg(data, out width, out height),
        ImageKind.Png => Png(data, out width, out height),
        ImageKind.Webp => Webp(data, out width, out height),
        _ => Invalid(out width, out height),
    };

    private static HeaderSize Png(ReadOnlySpan<byte> data, out int width, out int height)
    {
        width = 0;
        height = 0;
        if (data.Length < 24 || !data[12..16].SequenceEqual("IHDR"u8))
            return HeaderSize.Invalid;
        var rawWidth = BinaryPrimitives.ReadUInt32BigEndian(data[16..20]);
        var rawHeight = BinaryPrimitives.ReadUInt32BigEndian(data[20..24]);
        return Classify(rawWidth, rawHeight, out width, out height);
    }

    private static HeaderSize Jpeg(ReadOnlySpan<byte> data, out int width, out int height)
    {
        width = 0;
        height = 0;
        var index = 2;
        while (index + 1 < data.Length)
        {
            if (data[index] != 0xFF)
                return HeaderSize.Invalid;
            while (index < data.Length && data[index] == 0xFF)
                index++;
            if (index >= data.Length)
                return HeaderSize.Invalid;
            var marker = data[index++];
            if (marker is 0xD9 or 0xDA)
                return HeaderSize.Invalid;
            if (marker == 0x01 || marker is >= 0xD0 and <= 0xD7)
                continue;
            if (index + 1 >= data.Length)
                return HeaderSize.Invalid;
            var length = (data[index] << 8) + data[index + 1];
            if (length < 2 || index + length > data.Length)
                return HeaderSize.Invalid;
            if (marker is 0xC0 or 0xC1 or 0xC2 or 0xC3 or 0xC5 or 0xC6 or 0xC7 or 0xC9 or 0xCA or 0xCB or 0xCD or 0xCE or 0xCF)
            {
                if (length < 7)
                    return HeaderSize.Invalid;
                var rawHeight = (uint)((data[index + 3] << 8) + data[index + 4]);
                var rawWidth = (uint)((data[index + 5] << 8) + data[index + 6]);
                return Classify(rawWidth, rawHeight, out width, out height);
            }

            index += length;
        }

        return HeaderSize.Invalid;
    }

    private static HeaderSize Webp(ReadOnlySpan<byte> data, out int width, out int height)
    {
        width = 0;
        height = 0;
        if (data.Length < 16)
            return HeaderSize.Invalid;
        var fourcc = data[12..16];
        if (fourcc.SequenceEqual("VP8X"u8))
        {
            if (data.Length < 30)
                return HeaderSize.Invalid;
            var rawWidth = (uint)(1 + data[24] + (data[25] << 8) + (data[26] << 16));
            var rawHeight = (uint)(1 + data[27] + (data[28] << 8) + (data[29] << 16));
            return Classify(rawWidth, rawHeight, out width, out height);
        }

        if (fourcc.SequenceEqual("VP8 "u8))
        {
            if (data.Length < 30 || (data[20] & 1) != 0)
                return HeaderSize.Invalid;
            if (data[23] != 0x9D || data[24] != 0x01 || data[25] != 0x2A)
                return HeaderSize.Invalid;
            var rawWidth = (uint)(data[26] | ((data[27] & 0x3F) << 8));
            var rawHeight = (uint)(data[28] | ((data[29] & 0x3F) << 8));
            return Classify(rawWidth, rawHeight, out width, out height);
        }

        if (fourcc.SequenceEqual("VP8L"u8))
        {
            if (data.Length < 25 || data[20] != 0x2F)
                return HeaderSize.Invalid;
            var bits = data[21] | (data[22] << 8) | (data[23] << 16) | (data[24] << 24);
            var rawWidth = (uint)((bits & 0x3FFF) + 1);
            var rawHeight = (uint)(((bits >> 14) & 0x3FFF) + 1);
            return Classify(rawWidth, rawHeight, out width, out height);
        }

        return HeaderSize.Invalid;
    }

    private static HeaderSize Classify(uint width, uint height, out int pixelsWide, out int pixelsHigh)
    {
        pixelsWide = 0;
        pixelsHigh = 0;
        if (width == 0 || height == 0)
            return HeaderSize.Invalid;
        if (width > ImagePipeline.MaxPixels || height > ImagePipeline.MaxPixels || (long)width * height > ImagePipeline.MaxPixels)
            return HeaderSize.OverCap;
        pixelsWide = (int)width;
        pixelsHigh = (int)height;
        return HeaderSize.Ok;
    }

    private static HeaderSize Invalid(out int width, out int height)
    {
        width = 0;
        height = 0;
        return HeaderSize.Invalid;
    }

    private static bool IsUtf16Svg(ReadOnlySpan<byte> data)
    {
        ReadOnlySpan<byte> le = stackalloc byte[] { 0x3C, 0x00, 0x73, 0x00, 0x76, 0x00, 0x67, 0x00 };
        ReadOnlySpan<byte> be = stackalloc byte[] { 0x00, 0x3C, 0x00, 0x73, 0x00, 0x76, 0x00, 0x67 };
        var window = data.Length > 256 ? data[..256] : data;
        return window.IndexOf(le) >= 0 || window.IndexOf(be) >= 0;
    }

    private static bool StartsWith(ReadOnlySpan<byte> data, string text)
    {
        if (data.Length < text.Length)
            return false;
        for (var i = 0; i < text.Length; i++)
        {
            var actual = data[i];
            var expected = (byte)text[i];
            if (actual >= 'A' && actual <= 'Z')
                actual = (byte)(actual + 32);
            if (actual != expected)
                return false;
        }

        return true;
    }

    private static bool Contains(ReadOnlySpan<byte> data, string text)
    {
        var needle = System.Text.Encoding.ASCII.GetBytes(text);
        return data.IndexOf(needle) >= 0;
    }
}
