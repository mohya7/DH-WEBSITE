/*
 * npm run check:csp — after `npm run build`.
 *
 * Serves out/ with the Content-Security-Policy-Report-Only header from
 * out/web.config and loads every built page in a browser. Report-only mode
 * still fires a violation event, and the page is not blocked. Prints every
 * violation. Exits 0 either way: the list is the result. Exits 1 only when
 * the pages could not be loaded.
 *
 * Ports come from the environment, so another agent can run this on its own
 * range. The defaults are Cursor's: CSP_CHECK_PORT=4380 for the site and
 * CSP_CHECK_DEBUG_PORT=4381 for the browser. This process stops only the
 * browser it started.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

function port(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`${name} must be a TCP port. It is "${raw}".`);
  }
  return value;
}

const sitePort = port("CSP_CHECK_PORT", 4380);
const debugPort = port("CSP_CHECK_DEBUG_PORT", 4381);
const outDir = path.join(process.cwd(), "out");

interface Violation {
  directive: string;
  blocked: string;
  source: string;
  line: number;
  sample: string;
  disposition: string;
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function pageUrl(file: string): string {
  const relative = path.relative(outDir, file).split(path.sep).join("/");
  if (relative === "index.html") return "/";
  return `/${relative.replace(/\.html$/, "")}`;
}

function fileFor(urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath.split("?")[0]);
  } catch {
    return null;
  }
  const relative = decoded.replace(/^\/+/, "");
  const candidates = relative === "" || relative.endsWith("/") ? [`${relative.replace(/\/$/, "")}/index.html`.replace(/^\//, "")] : [relative];
  if (relative !== "" && !relative.endsWith(".html")) candidates.push(`${relative.replace(/\/$/, "")}.html`);
  const root = path.resolve(outDir);
  for (const candidate of candidates) {
    const full = path.resolve(outDir, ...candidate.split("/").filter((part) => part !== "." && part !== ".."));
    if (path.relative(root, full).startsWith("..")) return null;
    if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
  }
  return null;
}

const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json",
};

function policiesFromConfig(): { site: string; home: string } {
  const xml = fs.readFileSync(path.join(outDir, "web.config"), "utf8");
  const values = [...xml.matchAll(/name="Content-Security-Policy-Report-Only" value="([^"]*)"/g)].map((match) => match[1]);
  const site = values[0];
  const home = values.find((value) => value !== site);
  if (!site || !home) throw new Error("out/web.config has no separate report-only policy for the home page.");
  return { site, home };
}

function policyFor(pathname: string, policies: { site: string; home: string }): string {
  return pathname === "/" || pathname === "/index.html" ? policies.home : policies.site;
}

function serve(policies: { site: string; home: string }): Promise<http.Server> {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${sitePort}`);
    const file = fileFor(url.pathname);
    response.setHeader("Content-Security-Policy-Report-Only", policyFor(url.pathname, policies));
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    response.setHeader("X-Frame-Options", "DENY");
    if (!file) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("not found");
      return;
    }
    const type = types[path.extname(file).toLowerCase()] ?? "application/octet-stream";
    response.writeHead(200, { "Content-Type": type });
    fs.createReadStream(file).pipe(response);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(sitePort, "127.0.0.1", () => resolve(server));
  });
}

function browserPath(): string {
  const candidates = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error("Neither Edge nor Chrome is installed, so the pages could not be loaded.");
  return found;
}

interface Cdp {
  send(method: string, params?: object): Promise<unknown>;
  wait(method: string, timeoutMs: number): Promise<void>;
  on(method: string, handler: (params: Record<string, unknown>) => void): void;
  close(): void;
}

function connect(wsUrl: string): Promise<Cdp> {
  const ws = new WebSocket(wsUrl);
  let next = 0;
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  const waiters: { method: string; resolve: () => void }[] = [];
  const listeners = new Map<string, ((params: Record<string, unknown>) => void)[]>();
  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () => {
      resolve({
        send(method, params) {
          const id = ++next;
          return new Promise((res, rej) => {
            pending.set(id, { resolve: res, reject: rej });
            ws.send(JSON.stringify({ id, method, params }));
          });
        },
        wait(method, timeoutMs) {
          return new Promise((res, rej) => {
            const timer = setTimeout(() => rej(new Error(`Timed out waiting for ${method}.`)), timeoutMs);
            waiters.push({
              method,
              resolve: () => {
                clearTimeout(timer);
                res();
              },
            });
          });
        },
        on(method, handler) {
          listeners.set(method, [...(listeners.get(method) ?? []), handler]);
        },
        close() {
          ws.close();
        },
      });
    });
    ws.addEventListener("error", () => reject(new Error("Could not connect to the browser.")));
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as { id?: number; method?: string; params?: Record<string, unknown>; error?: { message: string }; result?: unknown };
      if (message.id) {
        const pendingCall = pending.get(message.id);
        if (!pendingCall) return;
        pending.delete(message.id);
        if (message.error) pendingCall.reject(new Error(message.error.message));
        else pendingCall.resolve(message.result);
        return;
      }
      if (!message.method) return;
      const waiter = waiters.find((item) => item.method === message.method);
      if (waiter) {
        waiters.splice(waiters.indexOf(waiter), 1);
        waiter.resolve();
      }
      for (const handler of listeners.get(message.method) ?? []) handler(message.params ?? {});
    });
  });
}

async function waitForBrowser(): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < 20000) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      if (response.ok) return;
    } catch {
      // The port is not open yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("The browser did not open its debugging port.");
}

async function openTab(): Promise<{ webSocketDebuggerUrl: string }> {
  const url = `http://127.0.0.1:${debugPort}/json/new?about:blank`;
  let response = await fetch(url, { method: "PUT" });
  if (!response.ok) response = await fetch(url);
  if (!response.ok) throw new Error(`Could not open a browser tab (${response.status}).`);
  return (await response.json()) as { webSocketDebuggerUrl: string };
}

const listener = `window.__cspViolations = [];
document.addEventListener("securitypolicyviolation", (event) => {
  window.__cspViolations.push({
    directive: event.violatedDirective,
    blocked: event.blockedURI,
    source: event.sourceFile || "",
    line: event.lineNumber,
    sample: event.sample || "",
    disposition: event.disposition
  });
});`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  if (!fs.existsSync(outDir)) throw new Error("out/ does not exist. Run npm run build in website/ first.");
  const policies = policiesFromConfig();
  const pages = walk(outDir).filter((file) => file.endsWith(".html")).sort();
  const server = await serve(policies);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "dh-csp-"));
  let browser: ChildProcess | undefined;
  try {
    browser = spawn(
      browserPath(),
      ["--headless=new", "--disable-gpu", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${userData}`, "--no-first-run", "--disable-extensions", "--remote-allow-origins=*", "about:blank"],
      { stdio: "ignore" },
    );
    await waitForBrowser();
    const tab = await openTab();
    const cdp = await connect(tab.webSocketDebuggerUrl);
    const consoleHits: string[] = [];
    const documentPolicies = new Map<string, string>();
    let currentPath = "/";
    cdp.on("Log.entryAdded", (params) => {
      const entry = params.entry as { text?: string } | undefined;
      const text = entry?.text ?? "";
      if (text.includes("Content Security Policy")) consoleHits.push(text);
    });
    cdp.on("Network.responseReceived", (params) => {
      const response = params.response as { url?: string; headers?: Record<string, string> } | undefined;
      if (!response?.url || !response.headers) return;
      const responseUrl = new URL(response.url);
      if (responseUrl.port !== String(sitePort) || responseUrl.pathname !== currentPath) return;
      const header = response.headers["Content-Security-Policy-Report-Only"] ?? response.headers["content-security-policy-report-only"];
      if (header) documentPolicies.set(currentPath, header);
    });
    await cdp.send("Page.enable");
    await cdp.send("Network.enable");
    await cdp.send("Log.enable");
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: listener });

    const found: { url: string; violations: Violation[]; console: string[] }[] = [];
    for (const file of pages) {
      const urlPath = pageUrl(file);
      const url = `http://127.0.0.1:${sitePort}${urlPath}`;
      currentPath = urlPath;
      consoleHits.length = 0;
      const loaded = cdp.wait("Page.loadEventFired", 25000);
      await cdp.send("Page.navigate", { url });
      await loaded;
      await sleep(1500);
      const result = (await cdp.send("Runtime.evaluate", {
        expression: "window.__cspViolations || []",
        returnByValue: true,
      })) as { result?: { value?: Violation[] } };
      const violations = result.result?.value ?? [];
      if (violations.length > 0 || consoleHits.length > 0) found.push({ url: urlPath, violations, console: [...consoleHits] });
      console.log(`${urlPath}  ${violations.length} violation(s)`);
    }
    for (const file of pages) {
      const urlPath = pageUrl(file);
      const received = documentPolicies.get(urlPath);
      if (received !== policyFor(urlPath, policies)) {
        throw new Error(`${urlPath} was not served with its report-only policy from out/web.config.`);
      }
    }
    await cdp.send("Runtime.evaluate", { expression: 'fetch("https://csp-probe.invalid/").catch(function () {})' });
    await sleep(500);
    const probe = (await cdp.send("Runtime.evaluate", {
      expression: "window.__cspViolations || []",
      returnByValue: true,
    })) as { result?: { value?: Violation[] } };
    const probeHit = (probe.result?.value ?? []).some((violation) => violation.blocked.includes("csp-probe.invalid"));
    if (!probeHit) throw new Error("A deliberate blocked request produced no violation, so this check cannot be trusted.");
    cdp.close();

    console.log(`\nLoaded ${pages.length} pages with Content-Security-Policy-Report-Only.`);
    console.log("The document header matched out/web.config, and a deliberate blocked request was reported.");
    if (found.length === 0) {
      console.log("No content security policy violations.");
      return;
    }
    console.log(`${found.length} page(s) reported a violation:\n`);
    for (const page of found) {
      console.log(page.url);
      for (const violation of page.violations) {
        console.log(`  ${violation.disposition} ${violation.directive} blocked ${violation.blocked || "(inline)"} ${violation.sample}`.trim());
        if (violation.source) console.log(`    ${violation.source}:${violation.line}`);
      }
      for (const line of page.console) console.log(`  console: ${line}`);
    }
  } finally {
    server.close();
    if (browser?.pid) spawnSync("taskkill", ["/PID", String(browser.pid), "/T", "/F"], { stdio: "ignore" });
    try {
      fs.rmSync(userData, { recursive: true, force: true });
    } catch {
      // Edge can keep the profile directory open for a moment after it exits. The report does not depend on removing it.
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
