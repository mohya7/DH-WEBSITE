import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { snapshotDir, type ContentConfig } from "../src/content/config";
import { ContentCheckError, prepareContent } from "../src/content/prepare";
import { PreparedContentError, readPrepared, sha256 } from "../src/content/prepared";
import { ContentSourceError } from "../src/content/sources";
import { snapshotRaw, tempDir } from "./helpers";

/*
 * Stands in for the Content API: GET /api/v1/build/content behind X-Build-Token,
 * and /media/* served as the API serves the media library. Content and media
 * come from the snapshot, which is that endpoint's response byte for byte.
 */
const TOKEN = "test-build-token";
let server: http.Server;
let apiUrl: string;
let contentRequests = 0;
let seenTokens: (string | undefined)[] = [];
let mode: "ok" | "rate-limited" | "broken-media" = "ok";

beforeAll(async () => {
  server = http.createServer((request, response) => {
    const url = request.url ?? "";
    if (url === "/api/v1/build/content") {
      contentRequests += 1;
      const token = request.headers["x-build-token"] as string | undefined;
      seenTokens.push(token);
      if (mode === "rate-limited") return response.writeHead(429).end();
      if (token !== TOKEN) return response.writeHead(401, { "content-type": "application/problem+json" }).end("{}");
      return response.writeHead(200, { "content-type": "application/json" }).end(snapshotRaw);
    }
    if (url.startsWith("/media/")) {
      const file = path.join(snapshotDir, "media", path.basename(url));
      if (!fs.existsSync(file)) return response.writeHead(404).end();
      const data = fs.readFileSync(file);
      return response.writeHead(200, { "content-type": "image/webp" }).end(mode === "broken-media" ? data.subarray(1) : data);
    }
    response.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  apiUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

function targets() {
  const root = tempDir("prepare");
  return { outDir: path.join(root, ".content"), mediaDir: path.join(root, "public", "media") };
}

describe("CONTENT_SOURCE=api", () => {
  it("reads the build endpoint once, with the token in X-Build-Token, and copies the media it uses", async () => {
    mode = "ok";
    contentRequests = 0;
    seenTokens = [];
    const { outDir, mediaDir } = targets();
    const config: ContentConfig = { source: "api", apiUrl, token: TOKEN };

    const manifest = await prepareContent(config, { outDir, mediaDir });

    expect(contentRequests).toBe(1);
    expect(seenTokens).toEqual([TOKEN]);
    expect(manifest.source).toBe(`api (${apiUrl})`);
    expect(manifest.routes).toHaveLength(27);
    expect(manifest.media).toMatchObject({ assetsListed: 63, assetsUsed: 57, files: 86 });
    expect(fs.readdirSync(mediaDir)).toHaveLength(86);
    expect(fs.readFileSync(path.join(outDir, "content.json"), "utf8")).toBe(snapshotRaw);
    expect(fs.readFileSync(path.join(outDir, "manifest.json"), "utf8")).not.toContain(TOKEN);

    expect(readPrepared(config, outDir).manifest.contentSha256).toBe(sha256(snapshotRaw));
  });

  it("stops on a refused token without printing it", async () => {
    mode = "ok";
    const error = await prepareContent({ source: "api", apiUrl, token: "wrong-token" }, targets()).catch((caught: Error) => caught);
    expect(error).toBeInstanceOf(ContentSourceError);
    expect((error as Error).message).toMatch(/refused the build token \(401\)/);
    expect((error as Error).message).not.toContain("wrong-token");
  });

  it("stops with a clear message when rate-limited", async () => {
    mode = "rate-limited";
    await expect(prepareContent({ source: "api", apiUrl, token: TOKEN }, targets())).rejects.toThrow(/rate-limited the build \(429\)/);
  });

  it("stops when a downloaded image does not match its recorded size", async () => {
    mode = "broken-media";
    await expect(prepareContent({ source: "api", apiUrl, token: TOKEN }, targets())).rejects.toThrow(ContentCheckError);
  });

  it("stops when the API cannot be reached", async () => {
    await expect(prepareContent({ source: "api", apiUrl: "http://127.0.0.1:1", token: TOKEN }, targets())).rejects.toThrow(/Could not reach the Content API/);
  });
});

describe("CONTENT_SOURCE=snapshot", () => {
  it("prepares the snapshot's content and media", async () => {
    const { outDir, mediaDir } = targets();
    const config: ContentConfig = { source: "snapshot", snapshotDir };
    const manifest = await prepareContent(config, { outDir, mediaDir });
    expect(manifest.source).toBe("snapshot (fixtures/snapshot)");
    expect(manifest.routes).toHaveLength(27);
    expect(manifest.errorPages).toEqual({ "404": true, "500": true });
    for (const file of fs.readdirSync(mediaDir)) {
      expect(fs.readFileSync(path.join(mediaDir, file)).equals(fs.readFileSync(path.join(snapshotDir, "media", file)))).toBe(true);
    }
  });

  it("removes media left over from an earlier build", async () => {
    const { outDir, mediaDir } = targets();
    fs.mkdirSync(mediaDir, { recursive: true });
    fs.writeFileSync(path.join(mediaDir, "stale.webp"), "old");
    await prepareContent({ source: "snapshot", snapshotDir }, { outDir, mediaDir });
    expect(fs.existsSync(path.join(mediaDir, "stale.webp"))).toBe(false);
  });
});

describe("prepared content", () => {
  it("is refused when it has not been prepared", () => {
    expect(() => readPrepared({ source: "snapshot", snapshotDir }, tempDir("empty"))).toThrow(/has not been prepared/);
  });

  it("is refused when it came from a different source than the one configured", async () => {
    const { outDir, mediaDir } = targets();
    await prepareContent({ source: "snapshot", snapshotDir }, { outDir, mediaDir });
    expect(() => readPrepared({ source: "api", apiUrl: "http://127.0.0.1:5097", token: TOKEN }, outDir)).toThrow(PreparedContentError);
    expect(() => readPrepared({ source: "api", apiUrl: "http://127.0.0.1:5097", token: TOKEN }, outDir)).toThrow(/came from snapshot .* configured source is api/);
  });

  it("is refused when it was changed after preparing", async () => {
    const { outDir, mediaDir } = targets();
    await prepareContent({ source: "snapshot", snapshotDir }, { outDir, mediaDir });
    fs.appendFileSync(path.join(outDir, "content.json"), " ");
    expect(() => readPrepared({ source: "snapshot", snapshotDir }, outDir)).toThrow(/does not match its manifest/);
  });

  it("leaves no usable manifest behind when preparing fails", async () => {
    const { outDir, mediaDir } = targets();
    await prepareContent({ source: "snapshot", snapshotDir }, { outDir, mediaDir });
    mode = "rate-limited";
    await expect(prepareContent({ source: "api", apiUrl, token: TOKEN }, { outDir, mediaDir })).rejects.toThrow();
    expect(fs.existsSync(path.join(outDir, "manifest.json"))).toBe(false);
  });
});
