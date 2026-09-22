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

        using var bitmap = SKBitmap.Decode(codec);
        if (bitmap is null)
            return ImageResult.Fail("undecodable");
        if (Over(bitmap.Width, bitmap.Height))
            return ImageResult.Fail("too_many_pixels");

        using var full = SKImage.FromBitmap(bitmap);
        using var encoded = full.Encode(SKEncodedImageFormat.Webp, Quality);
        if (encoded is null)
            return ImageResult.Fail("undecodable");
        var webp = encoded.ToArray();
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
            using var variantImage = SKImage.FromBitmap(resized);
            using var variantData = variantImage.Encode(SKEncodedImageFormat.Webp, Quality);
            if (variantData is null)
                return ImageResult.Fail("undecodable");
            var variantBytes = variantData.ToArray();
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
        }
        catch (Exception ex)
        {
            error = ex.GetType().Name;
        }
    }

    private static bool Over(int width, int height) =>
        width <= 0 || height <= 0 || width > MaxPixels || height > MaxPixels || (long)width * height > MaxPixels;

    private static bool ContainsMetadata(byte[] bytes)
    {
        ReadOnlySpan<byte> data = bytes;
        return data.IndexOf("Exif"u8) >= 0
            || data.IndexOf("EXIF"u8) >= 0
            || data.IndexOf("http://ns.adobe.com/xap/1.0/"u8) >= 0;
    }
}
