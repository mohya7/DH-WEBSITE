import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { pairs } from "../tools/screenshot-parity/pairs.mjs";
import { comparePng, judge, readRegister } from "../tools/screenshot-parity/diff.mjs";
import { fileFor } from "../tools/screenshot-parity/server.mjs";

const tool = path.join(process.cwd(), "tools", "screenshot-parity");

function solid(width: number, height: number, rgba: number[]) {
  const png = new PNG({ width, height });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = rgba[0];
    png.data[i + 1] = rgba[1];
    png.data[i + 2] = rgba[2];
    png.data[i + 3] = rgba[3];
  }
  return PNG.sync.write(png);
}

function paint(buffer: Buffer, x: number, y: number) {
  const png = PNG.sync.read(buffer);
  const i = (png.width * y + x) << 2;
  png.data[i] = 255;
  png.data[i + 1] = 0;
  png.data[i + 2] = 0;
  png.data[i + 3] = 255;
  return PNG.sync.write(png);
}

describe("screenshot parity", () => {
  it("uses the section comparison's page pairs", () => {
    const html = fs.readFileSync(path.join(process.cwd(), "tools", "section-compare", "compare.html"), "utf8");
    const start = html.indexOf("const pairs = [");
    const block = html.slice(start, html.indexOf("];", start));
    const found = [...block.matchAll(/\["([^"]+)", "([^"]+)"\]/g)].map((match) => [match[1], match[2]]);
    expect(found).toEqual(pairs);
  });

  it("lists every mask with a reason, and does not mask the static carousels or marquees", () => {
    const file = JSON.parse(fs.readFileSync(path.join(tool, "masks.json"), "utf8"));
    expect(file.masks.length).toBeGreaterThan(0);
    for (const mask of file.masks) {
      expect(mask.selector).toMatch(/^#hero(Fluid|Sand)Canvas$/);
      expect(mask.effect).toBe("hide");
      expect(mask.reason.length).toBeGreaterThan(40);
    }
    const leftIn = file.reviewedNotMasked.map((entry: { selector: string }) => entry.selector);
    expect(leftIn).toEqual(expect.arrayContaining(["#newsViewport", "#blogsViewport", ".trust-track", ".marquee-track"]));
    for (const entry of file.reviewedNotMasked) expect(entry.reason.length).toBeGreaterThan(20);
  });

  it("starts with an empty accepted-differences register", () => {
    const register = readRegister(fs.readFileSync(path.join(tool, "accepted-differences.json"), "utf8"));
    expect(register.differences).toEqual([]);
  });

  it("allows zero differing pixels", () => {
    const threshold = JSON.parse(fs.readFileSync(path.join(tool, "threshold.json"), "utf8"));
    expect(threshold.maxDifferentPixels).toBe(0);
    expect(threshold.pixelmatchThreshold).toBe(0);
    expect(threshold.explanation).toMatch(/zero pixels/);
  });

  it("counts a pixel outside a mask and ignores a pixel inside one", () => {
    const base = solid(4, 4, [0, 0, 0, 255]);
    const outside = paint(base, 0, 0);
    const inside = paint(base, 3, 3);
    const open = comparePng(base, outside, { pixelmatchThreshold: 0 });
    const covered = comparePng(base, inside, { pixelmatchThreshold: 0, ignoreRects: [{ x: 2, y: 2, width: 2, height: 2 }] });
    expect(open.differentPixels).toBe(1);
    expect(covered.differentPixels).toBe(0);
  });

  it("fails a difference that the register does not list, and accepts one it does", () => {
    const capture = { old: "/index.html", new: "/", width: 1440, browser: "chromium", differentPixels: 12, sizeMismatch: false, status: "pending" };
    expect(judge(capture, { differences: [] }, 0)).toBe("differs");
    expect(judge(capture, { differences: [{ old: "/index.html", new: "/", width: 1440, browser: "chromium", reason: "Decided." }] }, 0)).toBe("accepted");
    expect(judge({ ...capture, differentPixels: 0 }, { differences: [] }, 0)).toBe("match");
    expect(judge({ ...capture, status: "error" }, { differences: [] }, 0)).toBe("error");
  });

  it("refuses a path that leaves the site root", () => {
    const root = path.join(tool);
    expect(fileFor(root, "/../package.json")).toBeNull();
    expect(fileFor(root, "/pairs.mjs")).toMatch(/pairs\.mjs$/);
  });
});
