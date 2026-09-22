using System.Security.Cryptography;
using System.Text.Json.Nodes;
using SkiaSharp;

namespace DigitalHub.Images;

public sealed class ImageVariant
{
    public int Width { get; init; }

    public int Height { get; init; }

    public byte[] Webp { get; init; } = [];

    public string FileName { get; init; } = "";
}

public sealed class ImageResult
{
    public string? Code { get; init; }

    public byte[] Webp { get; init; } = [];

    public string Hash { get; init; } = "";

    public int Width { get; init; }

    public int Height { get; init; }

    public IReadOnlyList<ImageVariant> Variants { get; init; } = [];

    public bool Succeeded => Code is null;

    public string MainFileName => Hash + ".webp";

    public string GeneratedSizesJson()
    {
        var generated = new JsonArray();
        foreach (var variant in Variants)
        {
            generated.Add(new JsonObject
            {
                ["width"] = variant.Width,
                ["height"] = variant.Height,
                ["path"] = "/media/" + variant.FileName,
                ["bytes"] = variant.Webp.Length,
            });
        }

        return generated.ToJsonString();
    }

    public static ImageResult Fail(string code) => new() { Code = code };
}

public static class ImagePipeline
{
    public const int MaxBytes = 5 * 1024 * 1024;

    public const long MaxPixels = 25_000_000;

    public const int Quality = 80;

    public static readonly int[] VariantWidths = [640, 1024, 1600];

    public static ImageResult Process(ReadOnlySpan<byte> content)
    {
        if (content.Length > MaxBytes)
            return ImageResult.Fail("too_large");
        if (content.Length == 0 || ImageHeaders.IsSvg(content))
            return ImageResult.Fail(content.Length == 0 ? "unsupported_type" : "svg_refused");
        if (!ImageHeaders.TryKind(content, out var kind))
            return ImageResult.Fail("unsupported_type");

        var header = ImageHeaders.ReadSize(content, kind, out var width, out var height);
        if (header == HeaderSize.OverCap)
            return ImageResult.Fail("too_many_pixels");
        if (header != HeaderSize.Ok)
            return ImageResult.Fail("undecodable");

        var bytes = content.ToArray();
        using var stream = new MemoryStream(bytes, writable: false);
        using var codec = SKCodec.Create(stream);
        if (codec is null)
            return ImageResult.Fail("undecodable");
        if (Over(codec.Info.Width, codec.Info.Height))
            return ImageResult.Fail("too_many_pixels");

        using var bitmap = DecodeOriented(codec);
        if (bitmap is null)
            return ImageResult.Fail("undecodable");
        if (Over(bitmap.Width, bitmap.Height))
            return ImageResult.Fail("too_many_pixels");

        var webp = Encode(bitmap);
        if (webp is null)
            return ImageResult.Fail("undecodable");
        if (ContainsMetadata(webp))
            return ImageResult.Fail("metadata");

        var hash = Convert.ToHexString(SHA256.HashData(webp)).ToLowerInvariant();
        var variants = new List<ImageVariant>();
        foreach (var variantWidth in VariantWidths)
        {
            if (bitmap.Width <= variantWidth)
                continue;
            var variantHeight = Math.Max(1, (int)Math.Round(bitmap.Height * (variantWidth / (double)bitmap.Width)));
            var info = new SKImageInfo(variantWidth, variantHeight, SKColorType.Rgba8888, SKAlphaType.Premul);
            using var resized = bitmap.Resize(info, new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.None));
            if (resized is null)
                return ImageResult.Fail("undecodable");
            var variantBytes = Encode(resized);
            if (variantBytes is null)
                return ImageResult.Fail("undecodable");
            if (ContainsMetadata(variantBytes))
                return ImageResult.Fail("metadata");
            variants.Add(new ImageVariant
            {
                Width = variantWidth,
                Height = variantHeight,
                Webp = variantBytes,
                FileName = hash + "-w" + variantWidth + ".webp",
            });
        }

        return new ImageResult
        {
            Webp = webp,
            Hash = hash,
            Width = bitmap.Width,
            Height = bitmap.Height,
            Variants = variants,
        };
    }

    public static void MeasureFile(string path, out int width, out int height, out string? error)
    {
        width = 0;
        height = 0;
        error = null;
        if (!File.Exists(path))
        {
            error = "file not found";
            return;
        }

        try
        {
            using var codec = SKCodec.Create(path);
            if (codec is null)
            {
                error = "SkiaSharp could not decode the file";
                return;
            }

            width = codec.Info.Width;
            height = codec.Info.Height;
            if (SwapsAxes(codec.EncodedOrigin))
                (width, height) = (height, width);
        }
        catch (Exception ex)
        {
            error = ex.GetType().Name;
        }
    }

    private static bool Over(int width, int height) =>
        width <= 0 || height <= 0 || width > MaxPixels || height > MaxPixels || (long)width * height > MaxPixels;

    /// <summary>
    /// Decode into sRGB so an embedded profile is applied, then rotate to the EXIF
    /// orientation, then hand back pixels the WebP encode can store without a profile.
    /// </summary>
    private static SKBitmap? DecodeOriented(SKCodec codec)
    {
        using var srgb = SKColorSpace.CreateSrgb();
        var info = new SKImageInfo(codec.Info.Width, codec.Info.Height, SKColorType.Rgba8888, SKAlphaType.Unpremul, srgb);
        using var decoded = new SKBitmap(info);
        if (codec.GetPixels(info, decoded.GetPixels()) != SKCodecResult.Success)
            return null;
        return Orient(decoded, codec.EncodedOrigin);
    }

    private static SKBitmap Orient(SKBitmap source, SKEncodedOrigin origin)
    {
        var swapped = SwapsAxes(origin);
        var width = swapped ? source.Height : source.Width;
        var height = swapped ? source.Width : source.Height;
        var oriented = new SKBitmap(new SKImageInfo(width, height, SKColorType.Rgba8888, SKAlphaType.Unpremul));
        using var canvas = new SKCanvas(oriented);
        switch (origin)
        {
            case SKEncodedOrigin.TopRight:
                canvas.Scale(-1, 1, width / 2f, height / 2f);
                break;
            case SKEncodedOrigin.BottomRight:
                canvas.RotateDegrees(180, width / 2f, height / 2f);
                break;
            case SKEncodedOrigin.BottomLeft:
                canvas.Scale(1, -1, width / 2f, height / 2f);
                break;
            case SKEncodedOrigin.LeftTop:
                canvas.Translate(width, 0);
                canvas.RotateDegrees(90);
                canvas.Scale(-1, 1);
                break;
            case SKEncodedOrigin.RightTop:
                canvas.Translate(width, 0);
                canvas.RotateDegrees(90);
                break;
            case SKEncodedOrigin.RightBottom:
                canvas.Translate(0, height);
                canvas.RotateDegrees(270);
                canvas.Scale(-1, 1);
                break;
            case SKEncodedOrigin.LeftBottom:
                canvas.Translate(0, height);
                canvas.RotateDegrees(270);
                break;
        }

        canvas.DrawBitmap(source, 0, 0);
        canvas.Flush();
        return oriented;
    }

    private static bool SwapsAxes(SKEncodedOrigin origin) => origin is
        SKEncodedOrigin.LeftTop or SKEncodedOrigin.RightTop or SKEncodedOrigin.RightBottom or SKEncodedOrigin.LeftBottom;

    private static byte[]? Encode(SKBitmap bitmap)
    {
        var info = new SKImageInfo(bitmap.Width, bitmap.Height, SKColorType.Rgba8888, SKAlphaType.Unpremul);
        using var pixmap = new SKPixmap(info, bitmap.GetPixels(), bitmap.RowBytes);
        using var data = pixmap.Encode(SKEncodedImageFormat.Webp, Quality);
        return data?.ToArray();
    }

    private static bool ContainsMetadata(byte[] bytes)
    {
        ReadOnlySpan<byte> data = bytes;
        return data.IndexOf("Exif"u8) >= 0
            || data.IndexOf("EXIF"u8) >= 0
            || data.IndexOf("http://ns.adobe.com/xap/1.0/"u8) >= 0
            || data.IndexOf("ICC_PROFILE"u8) >= 0
            || data.IndexOf("ICCP"u8) >= 0;
    }
}
