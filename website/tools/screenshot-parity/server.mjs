import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json",
};

/**
 * Serves one site at the root of its own port, read-only.
 * A path prefix would change how the old pages resolve relative URLs and how
 * content-runtime.js counts directories, so each side gets its own origin.
 * `overlay` replaces one URL path with another file. The replacement is read,
 * never written, and the site root is never opened for writing.
 */
export function startServer({ root, port, overlay = null }) {
  const siteRoot = path.resolve(root);
  if (!fs.existsSync(siteRoot) || !fs.statSync(siteRoot).isDirectory()) {
    throw new Error(`Site root does not exist: ${siteRoot}`);
  }

  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const overlayFile = overlay && urlPath === overlay.urlPath ? overlay.file : null;
    const file = overlayFile ? readableFile(overlayFile) : fileFor(siteRoot, urlPath);
    if (!file) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
      res.end("not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[path.extname(file).toLowerCase()] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    fs.createReadStream(file).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function readableFile(file) {
  const resolved = path.resolve(file);
  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved;
  return null;
}

export function fileFor(root, urlPath) {
  const decoded = urlPath.split("?")[0];
  if (decoded.includes("\0") || decoded.includes("%")) return null;
  const parts = decoded.split("/").filter((part) => part !== "");
  if (parts.some((part) => part === ".." || part === ".")) return null;

  const joined = path.resolve(root, ...parts);
  const candidates = [joined];
  if (decoded.endsWith("/") || path.extname(decoded) === "") {
    candidates.push(path.join(joined, "index.html"));
  }
  if (path.extname(decoded) === "") candidates.push(`${joined}.html`);

  const siteRoot = path.resolve(root);
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    const relative = path.relative(siteRoot, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) continue;
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved;
  }
  return null;
}
