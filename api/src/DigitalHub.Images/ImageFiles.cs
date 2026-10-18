namespace DigitalHub.Images;

public static class ImageFiles
{
    /// <summary>The only content type the upload path stores: every stored image is WebP.</summary>
    public const string StoredContentType = "image/webp";

    /// <summary>
    /// Why a file could not have been stored by the upload path, or null when it could:
    /// its name is a stored name (the content hash, or the hash and a width), it is at
    /// most ImagePipeline.MaxBytes, it is not SVG, its bytes are WebP, and its header
    /// is readable within the pixel cap. The content bundle import applies this rule to
    /// every file it would write, so it accepts nothing the upload would refuse.
    /// </summary>
    public static string? StoredFileProblem(string fileName, ReadOnlySpan<byte> data)
    {
        if (!IsHashName(fileName))
            return "its name is not a stored image name (<64 hex>.webp or <64 hex>-w<width>.webp)";
        if (data.Length > ImagePipeline.MaxBytes)
            return $"it is larger than the upload limit of {ImagePipeline.MaxBytes:N0} bytes";
        if (data.Length == 0)
            return "it is empty";
        if (ImageHeaders.IsSvg(data))
            return "it is SVG, which the upload refuses";
        if (!ImageHeaders.TryKind(data, out var kind) || kind != ImageKind.Webp)
            return "its bytes are not WebP, the only format the upload stores";
        var header = ImageHeaders.ReadSize(data, kind, out _, out _);
        if (header == HeaderSize.OverCap)
            return "it is over the upload's pixel cap";
        if (header != HeaderSize.Ok)
            return "its WebP header cannot be read";
        return null;
    }

    public static bool WriteIfChanged(string directory, string fileName, byte[] bytes)
    {
        if (!IsHashName(fileName))
            throw new InvalidOperationException("A stored image name is the content hash.");

        Directory.CreateDirectory(directory);
        var root = Path.GetFullPath(directory);
        var path = Path.GetFullPath(Path.Combine(root, fileName));
        var prefix = root.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        if (!path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("A stored image name is the content hash.");

        if (File.Exists(path))
        {
            var existing = File.ReadAllBytes(path);
            if (existing.AsSpan().SequenceEqual(bytes))
                return false;
        }

        File.WriteAllBytes(path, bytes);
        return true;
    }

    public static void DeleteHash(string directory, string hash, IEnumerable<string> variantFileNames)
    {
        if (hash.Length != 64)
            return;
        TryDelete(directory, hash + ".webp");
        foreach (var name in variantFileNames)
            TryDelete(directory, name);
    }

    private static void TryDelete(string directory, string fileName)
    {
        if (!IsHashName(fileName))
            return;
        var path = Path.Combine(directory, fileName);
        if (File.Exists(path))
            File.Delete(path);
    }

    private static bool IsHashName(string fileName)
    {
        if (fileName.Length < 69 || fileName.IndexOfAny(['/', '\\', ':']) >= 0 || fileName.Contains("..", StringComparison.Ordinal))
            return false;
        var hash = fileName[..64];
        foreach (var character in hash)
        {
            if (character is not (>= '0' and <= '9' or >= 'a' and <= 'f'))
                return false;
        }

        var rest = fileName[64..];
        if (rest == ".webp")
            return true;
        if (!rest.StartsWith("-w", StringComparison.Ordinal) || !rest.EndsWith(".webp", StringComparison.Ordinal))
            return false;
        var width = rest[2..^5];
        return width.Length > 0 && width.All(character => character is >= '0' and <= '9');
    }
}
