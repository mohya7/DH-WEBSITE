namespace DigitalHub.Images;

public static class ImageFiles
{
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
