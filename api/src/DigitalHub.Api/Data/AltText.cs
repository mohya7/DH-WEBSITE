namespace DigitalHub.Api.Data;

/// <summary>
/// Alt text lives on the media asset. A usage may override it.
/// The effective value is the override when present, otherwise the asset default.
/// </summary>
public static class AltText
{
    public static string? Effective(string? altOverride, MediaAsset? asset)
    {
        if (!string.IsNullOrWhiteSpace(altOverride))
        {
            return altOverride.Trim();
        }

        if (asset is null || string.IsNullOrWhiteSpace(asset.Alt))
        {
            return null;
        }

        return asset.Alt.Trim();
    }

    public static bool IsPublishable(string? altOverride, MediaAsset? asset)
    {
        if (asset is null || asset.Decorative)
        {
            return true;
        }

        return !string.IsNullOrWhiteSpace(Effective(altOverride, asset));
    }
}
