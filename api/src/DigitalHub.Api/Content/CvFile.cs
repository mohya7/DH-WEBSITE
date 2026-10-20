using System.Text;

namespace DigitalHub.Api.Content;

/// <summary>
/// Header checks for a CV. The file is never opened as a document.
/// </summary>
public static class CvFile
{
    public const int MaxBytes = 5 * 1024 * 1024;
    public const long BodyLimit = MaxBytes + 64 * 1024;
    public const long MaxClaimedUncompressed = 32L * 1024 * 1024;

    private static ReadOnlySpan<byte> OleHeader => [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];

    public static bool Matches(string extension, ReadOnlySpan<byte> body) => extension switch
    {
        ".pdf" => body.Length >= 5 && body.StartsWith("%PDF-"u8),
        ".doc" => body.Length >= 8 && body.StartsWith(OleHeader),
        ".docx" => IsDocx(body),
        _ => false,
    };

    public static string ContentType(string extension) => extension switch
    {
        ".pdf" => "application/pdf",
        ".doc" => "application/msword",
        ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        _ => "application/octet-stream",
    };

    public static string SafeFileName(string original, string extension)
    {
        var leaf = Path.GetFileName(original.Replace('\\', '/'));
        var kept = new string(leaf.Where(character => char.IsAsciiLetterOrDigit(character) || character is '.' or '_' or '-').ToArray());
        if (kept.Length == 0 || kept.StartsWith('.'))
            kept = "cv" + extension;
        if (!kept.EndsWith(extension, StringComparison.OrdinalIgnoreCase))
            kept += extension;
        if (kept.Length > 80)
            kept = kept[..76] + extension;
        return kept;
    }

    public static bool IsDocx(ReadOnlySpan<byte> data)
    {
        var hasTypes = false;
        var hasWord = false;
        long claimed = 0;
        var offset = 0;
        while (offset + 30 <= data.Length)
        {
            if (data[offset] != 0x50 || data[offset + 1] != 0x4B || data[offset + 2] != 0x03 || data[offset + 3] != 0x04)
                break;

            var compressed = BitConverter.ToUInt32(data.Slice(offset + 18, 4));
            var uncompressed = BitConverter.ToUInt32(data.Slice(offset + 22, 4));
            var nameLength = BitConverter.ToUInt16(data.Slice(offset + 26, 2));
            var extraLength = BitConverter.ToUInt16(data.Slice(offset + 28, 2));
            if (compressed == uint.MaxValue || uncompressed == uint.MaxValue)
                return false;

            claimed += uncompressed;
            if (claimed > MaxClaimedUncompressed)
                return false;

            var nameStart = offset + 30;
            if (nameStart + nameLength + extraLength > data.Length)
                return false;

            var name = Encoding.UTF8.GetString(data.Slice(nameStart, nameLength));
            if (name == "[Content_Types].xml")
                hasTypes = true;
            if (name.StartsWith("word/", StringComparison.Ordinal))
                hasWord = true;

            var next = nameStart + nameLength + extraLength + (int)compressed;
            if (next <= offset || next > data.Length)
                return false;
            offset = next;
        }

        return hasTypes && hasWord;
    }
}
