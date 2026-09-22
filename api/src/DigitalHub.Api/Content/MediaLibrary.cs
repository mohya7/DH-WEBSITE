using System.Text.Json;
using DigitalHub.Api.Conventions;
using DigitalHub.Api.Data;
using DigitalHub.Images;
using Microsoft.EntityFrameworkCore;

namespace DigitalHub.Api.Content;

public sealed class MediaLibrary(ContentDbContext db, IConfiguration configuration, IWebHostEnvironment environment)
{
    public const string ContentSecurityPolicy = "default-src 'none'; script-src 'none'; style-src 'none'; sandbox";

    public string Root
    {
        get
        {
            var configured = configuration["Media:Root"];
            return string.IsNullOrWhiteSpace(configured)
                ? Path.Combine(environment.ContentRootPath, "media")
                : configured;
        }
    }

    public async Task<MediaOutcome> ListAsync(int page, int pageSize, string? search, CancellationToken cancellationToken)
    {
        var query = db.Media.AsNoTracking();
        var term = string.IsNullOrWhiteSpace(search) ? null : search.Trim();
        if (term is not null)
        {
            query = query.Where(asset =>
                asset.Alt.Contains(term)
                || (asset.Caption != null && asset.Caption.Contains(term))
                || asset.OriginalName.Contains(term));
        }

        var total = await query.CountAsync(cancellationToken);
        var rows = await query
            .OrderByDescending(asset => asset.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
        return MediaOutcome.Ok(new PageResult<MediaBody>(rows.Select(asset => Present(asset)).ToList(), page, pageSize, total));
    }

    public async Task<MediaOutcome> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var asset = await db.Media.AsNoTracking().FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        return asset is null
            ? MediaOutcome.Fail(StatusCodes.Status404NotFound, "not_found", "That image does not exist.")
            : MediaOutcome.Ok(Present(asset));
    }

    public async Task<MediaOutcome> UploadAsync(Stream content, long length, string? uploadedName, string? alt, bool decorative, string? caption, string? userId, CancellationToken cancellationToken)
    {
        if (length > ImagePipeline.MaxBytes)
            return MediaOutcome.Fail(StatusCodes.Status400BadRequest, "too_large", "Images must be 5 MB or smaller.");

        var altError = AltError(alt, decorative);
        if (altError is not null)
            return MediaOutcome.Fail(StatusCodes.Status400BadRequest, "validation_failed", altError, new Dictionary<string, string[]> { ["alt"] = [altError] });
        var captionError = CaptionError(caption);
        if (captionError is not null)
            return MediaOutcome.Fail(StatusCodes.Status400BadRequest, "validation_failed", captionError, new Dictionary<string, string[]> { ["caption"] = [captionError] });

        using var buffer = new MemoryStream();
        var chunk = new byte[81920];
        while (true)
        {
            var read = await content.ReadAsync(chunk, cancellationToken);
            if (read == 0)
                break;
            if (buffer.Length + read > ImagePipeline.MaxBytes)
                return MediaOutcome.Fail(StatusCodes.Status400BadRequest, "too_large", "Images must be 5 MB or smaller.");
            buffer.Write(chunk, 0, read);
        }

        var processed = ImagePipeline.Process(buffer.ToArray());
        if (!processed.Succeeded)
            return Refused(processed.Code);

        var existing = await db.Media.FirstOrDefaultAsync(asset => asset.ContentHash == processed.Hash, cancellationToken);
        if (existing is not null)
            return MediaOutcome.Ok(Present(existing, duplicate: true));

        Directory.CreateDirectory(Root);
        ImageFiles.WriteIfChanged(Root, processed.MainFileName, processed.Webp);
        foreach (var variant in processed.Variants)
            ImageFiles.WriteIfChanged(Root, variant.FileName, variant.Webp);

        var asset = new MediaAsset
        {
            Id = Guid.NewGuid(),
            Path = "/media/" + processed.MainFileName,
            OriginalName = MetadataName(uploadedName),
            ContentType = "image/webp",
            Width = processed.Width,
            Height = processed.Height,
            Size = processed.Webp.Length,
            GeneratedSizes = processed.GeneratedSizesJson(),
            ContentHash = processed.Hash,
            Alt = decorative ? alt?.Trim() ?? "" : alt!.Trim(),
            Decorative = decorative,
            Caption = string.IsNullOrWhiteSpace(caption) ? null : caption.Trim(),
            UploaderId = userId,
            CreatedAt = DateTime.UtcNow,
        };
        db.Media.Add(asset);
        Audit(userId, "upload", asset.Id);
        await db.SaveChangesAsync(cancellationToken);
        return MediaOutcome.Created(Present(asset));
    }

    public async Task<MediaOutcome> UpdateAsync(Guid id, string? alt, bool decorative, string? caption, string? userId, CancellationToken cancellationToken)
    {
        var asset = await db.Media.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (asset is null)
            return MediaOutcome.Fail(StatusCodes.Status404NotFound, "not_found", "That image does not exist.");
        var altError = AltError(alt, decorative);
        if (altError is not null)
            return MediaOutcome.Fail(StatusCodes.Status400BadRequest, "validation_failed", altError, new Dictionary<string, string[]> { ["alt"] = [altError] });
        var captionError = CaptionError(caption);
        if (captionError is not null)
            return MediaOutcome.Fail(StatusCodes.Status400BadRequest, "validation_failed", captionError, new Dictionary<string, string[]> { ["caption"] = [captionError] });

        asset.Alt = decorative ? alt?.Trim() ?? "" : alt!.Trim();
        asset.Decorative = decorative;
        asset.Caption = string.IsNullOrWhiteSpace(caption) ? null : caption.Trim();
        Audit(userId, "update", asset.Id);
        await db.SaveChangesAsync(cancellationToken);
        return MediaOutcome.Ok(Present(asset));
    }

    public async Task<MediaOutcome> DeleteAsync(Guid id, string? userId, CancellationToken cancellationToken)
    {
        var asset = await db.Media.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (asset is null)
            return MediaOutcome.Fail(StatusCodes.Status404NotFound, "not_found", "That image does not exist.");
        var places = await MediaUsage.FindPlacesAsync(db, id, cancellationToken);
        if (places.Count > 0)
            return MediaOutcome.InUse(places);

        var hash = asset.ContentHash;
        var variants = VariantNames(asset.GeneratedSizes);
        db.Media.Remove(asset);
        Audit(userId, "delete", id);
        await db.SaveChangesAsync(cancellationToken);
        ImageFiles.DeleteHash(Root, hash, variants);
        return MediaOutcome.NoContent();
    }

    private void Audit(string? userId, string action, Guid id)
    {
        db.AuditLog.Add(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Action = action,
            EntityType = "media",
            EntityId = id.ToString(),
            At = DateTime.UtcNow,
            Success = true,
        });
    }

    private static MediaOutcome Refused(string? code) => code switch
    {
        "too_large" => MediaOutcome.Fail(StatusCodes.Status400BadRequest, "too_large", "Images must be 5 MB or smaller."),
        "svg_refused" => MediaOutcome.Fail(StatusCodes.Status400BadRequest, "svg_refused", "SVG files are not allowed."),
        "too_many_pixels" => MediaOutcome.Fail(StatusCodes.Status400BadRequest, "too_many_pixels", "This image is over the 25 megapixel cap."),
        "metadata" => MediaOutcome.Fail(StatusCodes.Status400BadRequest, "metadata", "The image could not be stored without its metadata."),
        "unsupported_type" => MediaOutcome.Fail(StatusCodes.Status400BadRequest, "unsupported_type", "Upload a JPEG, PNG, or WebP image."),
        _ => MediaOutcome.Fail(StatusCodes.Status400BadRequest, "undecodable", "That file could not be read as an image."),
    };

    private static string? AltError(string? alt, bool decorative)
    {
        if (!decorative && string.IsNullOrWhiteSpace(alt))
            return "Alt text is required unless the image is decorative.";
        if (alt is not null && alt.Trim().Length > 300)
            return "Alt text must be 300 characters or fewer.";
        return null;
    }

    private static string? CaptionError(string? caption) =>
        caption is not null && caption.Trim().Length > 500 ? "Caption must be 500 characters or fewer." : null;

    private static string MetadataName(string? uploadedName)
    {
        var name = Path.GetFileName(uploadedName ?? "").Replace("\0", "");
        return name.Length <= 260 ? name : name[..260];
    }

    private static IEnumerable<string> VariantNames(string generatedSizes)
    {
        if (string.IsNullOrWhiteSpace(generatedSizes))
            yield break;
        JsonDocument document;
        try
        {
            document = JsonDocument.Parse(generatedSizes);
        }
        catch (JsonException)
        {
            yield break;
        }

        using (document)
        {
            if (document.RootElement.ValueKind != JsonValueKind.Array)
                yield break;
            foreach (var item in document.RootElement.EnumerateArray())
            {
                if (!item.TryGetProperty("path", out var path) || path.ValueKind != JsonValueKind.String)
                    continue;
                var name = Path.GetFileName(path.GetString() ?? "");
                if (name.Length > 0)
                    yield return name;
            }
        }
    }

    private static MediaBody Present(MediaAsset asset, bool duplicate = false) => new(
        asset.Id,
        asset.Path,
        asset.OriginalName,
        asset.ContentType,
        asset.Width,
        asset.Height,
        asset.Size,
        ParseSizes(asset.GeneratedSizes),
        asset.ContentHash,
        asset.Alt,
        asset.Decorative,
        asset.Caption,
        asset.CreatedAt,
        duplicate);

    private static JsonElement ParseSizes(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<JsonElement>(string.IsNullOrWhiteSpace(json) ? "[]" : json);
        }
        catch (JsonException)
        {
            return JsonSerializer.Deserialize<JsonElement>("[]");
        }
    }
}

public sealed record MediaBody(
    Guid Id,
    string Path,
    string OriginalName,
    string ContentType,
    int? Width,
    int? Height,
    long Size,
    JsonElement GeneratedSizes,
    string ContentHash,
    string Alt,
    bool Decorative,
    string? Caption,
    DateTime CreatedAt,
    bool Duplicate);

public sealed class MediaOutcome
{
    public int Status { get; private init; }

    public string? Code { get; private init; }

    public string? Title { get; private init; }

    public object? Body { get; private init; }

    public Dictionary<string, string[]>? Errors { get; private init; }

    public IReadOnlyList<string>? Usages { get; private init; }

    public static MediaOutcome Ok(object body) => new() { Status = StatusCodes.Status200OK, Body = body };

    public static MediaOutcome Created(object body) => new() { Status = StatusCodes.Status201Created, Body = body };

    public static MediaOutcome NoContent() => new() { Status = StatusCodes.Status204NoContent };

    public static MediaOutcome Fail(int status, string code, string title, Dictionary<string, string[]>? errors = null) => new()
    {
        Status = status,
        Code = code,
        Title = title,
        Errors = errors,
    };

    public static MediaOutcome InUse(IReadOnlyList<string> usages) => new()
    {
        Status = StatusCodes.Status409Conflict,
        Code = "in_use",
        Title = "This image is used, so it was not deleted.",
        Usages = usages,
    };
}
