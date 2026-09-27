import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { MediaAsset } from "../src/content/build-content";
import { altFor, mediaFiles, referencedMediaIds, srcSetFor, variantPath } from "../src/content/media";
import { createSite } from "../src/content/site";
import { snapshotContent } from "./helpers";

vi.mock("@/content/site", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/content/site")>();
  const { snapshotContent: load } = await import("./helpers");
  const site = actual.createSite(load());
  return { ...actual, getSite: () => site };
});

const asset: MediaAsset = {
  id: "a",
  path: "/media/abc.webp",
  originalName: "x.jpg",
  contentType: "image/webp",
  width: 1400,
  height: 900,
  size: 1,
  widths: [640, 1024],
  alt: "Library alt",
  decorative: false,
  caption: null,
};

describe("media sources", () => {
  it("name variants the way the API stores them", () => {
    expect(variantPath(asset, 640)).toBe("/media/abc-w640.webp");
    expect(mediaFiles(asset)).toEqual(["/media/abc.webp", "/media/abc-w640.webp", "/media/abc-w1024.webp"]);
  });

  it("build a srcset from the stored widths, then the full image", () => {
    expect(srcSetFor(asset)).toBe("/media/abc-w640.webp 640w, /media/abc-w1024.webp 1024w, /media/abc.webp 1400w");
    expect(srcSetFor({ ...asset, widths: [] })).toBeUndefined();
  });

  it("take alt text from the usage, then the library, and none when decorative", () => {
    expect(altFor(asset, { alt: "Usage alt" })).toBe("Usage alt");
    expect(altFor(asset, { alt: "  " })).toBe("Library alt");
    expect(altFor(asset, { alt: "Usage alt", decorative: true })).toBe("");
    expect(altFor({ ...asset, decorative: true })).toBe("");
  });

  it("copy only the media published content uses, including images inside rich text", () => {
    const content = snapshotContent();
    const used = referencedMediaIds(content);
    expect(used.size).toBe(57);
    expect(content.media.length).toBe(63);

    const extra = { ...content.media[0], id: "11111111-1111-1111-1111-111111111111" };
    content.media.push(extra);
    const body = JSON.parse(content.collections["blog-posts"][0].fields.body!);
    body.content.push({ type: "image", attrs: { mediaId: extra.id, alt: "Inline", decorative: false } });
    content.collections["blog-posts"][0].fields.body = JSON.stringify(body);
    expect(referencedMediaIds(content).has(extra.id)).toBe(true);
  });
});

describe("the website's Image adapter", () => {
  it("renders explicit width and height, a srcset, and the usage's alt", async () => {
    const { Image } = await import("../src/adapters/Image");
    const content = snapshotContent();
    const withVariants = content.media.find((item) => item.widths.length === 2)!;
    const html = renderToStaticMarkup(<Image mediaId={withVariants.id} alt="Usage alt" sizes="50vw" />);
    expect(html).toContain(`src="${withVariants.path}"`);
    expect(html).toContain(`width="${withVariants.width}"`);
    expect(html).toContain(`height="${withVariants.height}"`);
    expect(html).toContain(`srcSet="${srcSetFor(withVariants)}"`);
    expect(html).toContain('sizes="50vw"');
    expect(html).toContain('alt="Usage alt"');
    expect(html).toContain('loading="lazy"');
  });

  it("renders an empty alt for a decorative usage, and nothing for a missing image", async () => {
    const { Image } = await import("../src/adapters/Image");
    const site = createSite(snapshotContent());
    const any = site.content.media[0];
    expect(renderToStaticMarkup(<Image mediaId={any.id} decorative />)).toContain('alt=""');
    expect(renderToStaticMarkup(<Image mediaId="00000000-0000-0000-0000-000000000000" />)).toBe("");
    expect(renderToStaticMarkup(<Image mediaId={null} />)).toBe("");
  });
});
