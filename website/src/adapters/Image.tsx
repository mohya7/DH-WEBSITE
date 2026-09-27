/*
 * The website's image adapter. Section components (Section 4) render images
 * through an adapter like this instead of next/image, which static export
 * cannot optimise.
 *
 * Always explicit width and height, so the layout does not shift, and a srcset
 * from the widths the API stored. A missing media id renders nothing.
 */
import { altFor, srcSetFor } from "@/content/media";
import { getSite } from "@/content/site";

export interface ImageProps {
  mediaId: string | null | undefined;
  /** Alt text for this usage. Falls back to the media library's default alt. */
  alt?: string | null;
  decorative?: boolean | null;
  /** How wide the image is drawn, for choosing from the srcset. */
  sizes?: string;
  className?: string;
  loading?: "lazy" | "eager";
  fetchPriority?: "high" | "low" | "auto";
}

export function Image({ mediaId, alt, decorative, sizes, className, loading = "lazy", fetchPriority }: ImageProps) {
  const asset = getSite().media(mediaId);
  if (!asset) return null;

  const srcSet = srcSetFor(asset);
  return (
    <img
      src={asset.path}
      width={asset.width}
      height={asset.height}
      srcSet={srcSet}
      sizes={srcSet ? (sizes ?? "100vw") : undefined}
      alt={altFor(asset, { alt, decorative })}
      className={className}
      loading={loading}
      decoding="async"
      fetchPriority={fetchPriority}
    />
  );
}
