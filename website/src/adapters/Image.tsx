/*
 * The website's image adapter. Section components render images through it
 * instead of next/image, which static export cannot optimise.
 *
 * Always explicit width and height, so the layout does not shift, and a srcset
 * from the widths the API stored. A missing media id renders nothing.
 */
import type { ImageAdapterProps } from "@digitalhub/blocks";
import { altFor, srcSetFor } from "@/content/media";
import { getSite } from "@/content/site";

export type ImageProps = ImageAdapterProps;

export function Image({ mediaId, alt, decorative, sizes, className, loading = "lazy", fetchPriority, attributes }: ImageProps) {
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
      {...attributes}
    />
  );
}
