/*
 * Media files and responsive sources.
 *
 * Static export cannot use Next's image optimiser. The API already stores each
 * image as WebP at its full size plus smaller variants named <hash>-w<width>.webp
 * (api/src/DigitalHub.Images/ImagePipeline.cs), so the build copies those files
 * into the output and builds the srcset from the stored widths.
 */
import type { BuildContent, MediaAsset } from "./build-content";

/** /media/<file name>, with nothing that could climb out of the media folder. */
const mediaPathPattern = /^\/media\/[A-Za-z0-9][A-Za-z0-9._-]*\.[A-Za-z0-9]+$/;

export function isSafeMediaPath(value: string): boolean {
  return mediaPathPattern.test(value) && !value.includes("..");
}

export function variantPath(asset: MediaAsset, width: number): string {
  const stem = asset.path.replace(/\.[^./]+$/, "");
  return `${stem}-w${width}.webp`;
}

/** Every stored file for an asset: the full size first, then each variant. */
export function mediaFiles(asset: MediaAsset): string[] {
  return [asset.path, ...asset.widths.map((width) => variantPath(asset, width))];
}

/** Variants narrower than the full image, ascending, then the full image itself. */
export function srcSetFor(asset: MediaAsset): string | undefined {
  const variants = asset.widths.filter((width) => width < asset.width);
  if (variants.length === 0) return undefined;
  return [...variants.map((width) => `${variantPath(asset, width)} ${width}w`), `${asset.path} ${asset.width}w`].join(", ");
}

/**
 * Alt text for one usage of an image. A usage marked decorative, or an asset
 * that is decorative with no alt of its own for this usage, gets an empty alt.
 * Otherwise the usage's own alt wins over the library default.
 */
export function altFor(asset: MediaAsset, usage: { alt?: string | null; decorative?: boolean | null } = {}): string {
  if (usage.decorative) return "";
  const own = usage.alt?.trim();
  if (own) return own;
  if (asset.decorative) return "";
  return asset.alt?.trim() ?? "";
}

/**
 * Ids of media that published content actually uses. Rich text bodies are JSON
 * stored in a string, so strings that parse as JSON are walked too. Only these
 * files are copied into the build output: an image used only by a draft stays
 * out of it.
 */
export function referencedMediaIds(content: BuildContent): Set<string> {
  const known = new Set(content.media.map((asset) => asset.id));
  const found = new Set<string>();
  const { media: _media, ...rest } = content;

  const walk = (value: unknown): void => {
    if (typeof value === "string") {
      if (known.has(value)) {
        found.add(value);
        return;
      }
      const text = value.trimStart();
      if (text.startsWith("{") || text.startsWith("[")) {
        try {
          walk(JSON.parse(text));
        } catch {
          // Ordinary text that happens to start with a brace.
        }
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (value !== null && typeof value === "object") {
      Object.values(value).forEach(walk);
    }
  };

  walk(rest);
  return found;
}
