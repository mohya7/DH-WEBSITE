/*
 * Section comparison: every `main > section` on the built site against the same
 * page on feature/interviewer-portal, after only that page's content runtime has
 * run.
 *
 * Serves three things from one origin, so one page can compare them:
 *   /           the comparison page
 *   /old/...    the source branch's working tree, untouched
 *   /oldrt/...  the same page with every script removed except site-content.js
 *               and content-runtime.js, so only the content runtime runs — not
 *               GSAP, Lenis, or the page scripts, which mutate the DOM
 *   /new/...    website/out
 *
 *   node tools/section-compare/server.mjs [oldRoot] [newRoot] [port]
 *
 * then open the printed address. Results are on the page and in window.__result.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const websiteRoot = path.resolve(here, "..", "..");

const oldRoot = path.resolve(process.argv[2] ?? "D:\\work\\DigitalHub\\New Website\\DH-WEBSITE-main");
const newRoot = path.resolve(process.argv[3] ?? path.join(websiteRoot, "out"));
const port = Number(process.env.SECTION_COMPARE_PORT ?? process.argv[4] ?? 4190);

for (const [label, root] of [["old", oldRoot], ["new", newRoot]]) {
  if (!fs.existsSync(root)) {
    console.error(`${label} root does not exist: ${root}`);
    process.exit(1);
  }
}

const types = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json", ".webp": "image/webp", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff",
  ".mp4": "video/mp4", ".webm": "video/webm", ".txt": "text/plain; charset=utf-8",
};

/** The two scripts that fill the old pages in. Everything else is removed. */
const keep = /(?:site-content\.js|content-runtime\.js)/;

function onlyRuntime(html, urlPath) {
  const dir = urlPath.replace(/[^/]*$/, "");
  const withBase = html.replace(/<head([^>]*)>/i, `<head$1><base href="/old${dir}">`);
  return withBase.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (whole, attrs) => {
    const src = /src\s*=\s*["']([^"']+)["']/i.exec(attrs);
    return src && keep.test(src[1]) ? whole : "";
  });
}

function fileFor(root, rest) {
  const candidates = [path.join(root, rest)];
  if (rest.endsWith("/")) candidates.push(path.join(root, rest, "index.html"));
  if (!path.extname(rest)) candidates.push(path.join(root, rest + ".html"), path.join(root, rest, "index.html"));
  for (const file of candidates) {
    const resolved = path.resolve(file);
    if (!resolved.startsWith(root)) continue;
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved;
  }
  return null;
}

http.createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? "/").split("?")[0]);

  if (url === "/" || url === "/index.html") {
    res.writeHead(200, { "Content-Type": types[".html"] });
    return res.end(fs.readFileSync(path.join(here, "compare.html")));
  }
  if (url === "/accepted-differences.json") {
    res.writeHead(200, { "Content-Type": types[".json"] });
    return res.end(fs.readFileSync(path.join(here, "accepted-differences.json")));
  }

  const [, prefix, ...restParts] = url.split("/");
  const rest = "/" + restParts.join("/");

  if (prefix === "oldrt") {
    const file = fileFor(oldRoot, rest);
    if (!file) return res.writeHead(404).end("not found");
    res.writeHead(200, { "Content-Type": types[".html"] });
    return res.end(onlyRuntime(fs.readFileSync(file, "utf8"), rest));
  }

  const root = prefix === "old" ? oldRoot : prefix === "new" ? newRoot : null;
  if (!root) return res.writeHead(404).end("unknown prefix");
  const file = fileFor(root, rest);
  if (!file) return res.writeHead(404).end("not found");
  res.writeHead(200, { "Content-Type": types[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}).listen(port, "127.0.0.1", () => {
  console.log(`old  ${oldRoot}`);
  console.log(`new  ${newRoot}`);
  console.log(`\nopen http://127.0.0.1:${port}/`);
});
