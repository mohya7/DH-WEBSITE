/*
 * The IIS web.config for the static export, generated at build (Phase C, Section 8).
 *
 * It is configuration for the site IIS serves from out/. It does not proxy
 * anywhere: routing to the Content API and the Node hiring system is Phase D.
 *
 * Clean URLs. Pages are exported as path.html (the home page as index.html).
 * A request for /services/ai, with or without a trailing slash, is rewritten to
 * services/ai.html only when that file exists. Anything else stays unmatched,
 * so IIS returns a real 404 rather than the home page with status 200.
 * `/` is index.html through the default document.
 *
 * Redirects. Every row of the redirects table is a 301, whatever status code
 * the row stores. The section asks for 301s. Rules run before the clean-URL
 * rewrite, so a redirected path is never served as a page.
 *
 * Error pages. httpErrors serves 404.html and 500.html with ExecuteURL, which
 * keeps the original status code. A rewrite or a client redirect to those
 * files would answer 200 or 302.
 *
 * Cache. Every response gets a short cache, so HTML is not kept. The location
 * for /design/ replaces that with a year-long immutable cache. The hashed
 * folder lives under /design/, so a new hash is covered without rewriting
 * this file. Other static files, including media, get the short cache too:
 * IIS applies a site header to every response, and only a path can override it.
 *
 * Content security policy. Report-only, so a violation is reported and nothing
 * is blocked. Section 7.4 has not listed Tag Manager or GA4 hosts; nothing in
 * the ported design loads them, so they are not in this policy yet.
 * Hosts it does allow, and why:
 *   cdn.jsdelivr.net       GSAP, ScrollTrigger, Lenis, and the Tabler Icons
 *                          stylesheet and its font files
 *   fonts.googleapis.com   the Poppins stylesheet
 *   fonts.gstatic.com      the Poppins font files
 *   'unsafe-inline' styles the home page's webgl-fluid-lib.js appends a <style>
 *                          element while loading, and the markup sets style
 *                          attributes (style-src-attr)
 *   data:                  SVG and bitmap images in stylesheets
 */
import type { Redirect } from "../content/build-content";

export class WebConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebConfigError";
  }
}

export const htmlCacheControl = "public, max-age=0, must-revalidate";
export const designCacheControl = "public, max-age=31536000, immutable";
export const strictTransportSecurity = "max-age=31536000; includeSubDomains";

/** One line, so it can sit in a web.config attribute. */
export const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' https://cdn.jsdelivr.net",
  "style-src 'self' https://fonts.googleapis.com https://cdn.jsdelivr.net 'unsafe-inline'",
  "style-src-attr 'unsafe-inline'",
  "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
].join("; ");

const securityHeaders: [string, string][] = [
  ["Content-Security-Policy-Report-Only", contentSecurityPolicy],
  ["Strict-Transport-Security", strictTransportSecurity],
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["X-Frame-Options", "DENY"],
  ["Cache-Control", htmlCacheControl],
];

function xml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function assertPath(path: string, label: string): void {
  if (!path.startsWith("/")) throw new WebConfigError(`${label} must start with /: "${path}".`);
  if (path.length > 300) throw new WebConfigError(`${label} is longer than 300 characters.`);
  if (path.includes("..") || path.includes("//") || /[\u0000-\u0020\u007f\\?#<>"']/.test(path)) {
    throw new WebConfigError(`${label} cannot be written into web.config: "${path}".`);
  }
}

/** An IIS rewrite match for a request path. The leading slash is not part of the matched URL. */
function matchPattern(fromPath: string): string {
  const body = fromPath.slice(1).replace(/\/+$/, "");
  if (body === "") return "^/?$";
  return `^${body.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/?$`;
}

function customHeaders(headers: [string, string][], indent: string): string {
  const lines = headers.flatMap(([name, value]) => [
    `${indent}  <remove name="${xml(name)}" />`,
    `${indent}  <add name="${xml(name)}" value="${xml(value)}" />`,
  ]);
  return `${indent}<customHeaders>\n${lines.join("\n")}\n${indent}</customHeaders>`;
}

function redirectRules(redirects: readonly Redirect[]): string {
  const rows = [...redirects].sort((a, b) => (a.fromPath < b.fromPath ? -1 : a.fromPath > b.fromPath ? 1 : 0));
  const seen = new Set<string>();
  return rows
    .map((row) => {
      assertPath(row.fromPath, "A redirect's from path");
      assertPath(row.toPath, "A redirect's to path");
      const key = row.fromPath.replace(/\/+$/, "") || "/";
      if (seen.has(key)) throw new WebConfigError(`Two redirects start at ${row.fromPath}.`);
      seen.add(key);
      return `        <rule name="Redirect ${xml(row.fromPath)}" stopProcessing="true">
          <match url="${xml(matchPattern(row.fromPath))}" ignoreCase="false" />
          <action type="Redirect" url="${xml(row.toPath)}" redirectType="Permanent" appendQueryString="false" />
        </rule>`;
    })
    .join("\n");
}

const cleanUrls = `        <rule name="Clean URLs" stopProcessing="true">
          <match url="^(.+?)/?$" ignoreCase="false" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
            <add input="{DOCUMENT_ROOT}/{R:1}.html" matchType="IsFile" />
          </conditions>
          <action type="Rewrite" url="{R:1}.html" />
        </rule>`;

/** The web.config for these redirects. Throws if a path cannot be expressed as a safe rule. */
export function renderWebConfig(redirects: readonly Redirect[]): string {
  const redirectsXml = redirectRules(redirects);
  const rules = redirectsXml === "" ? cleanUrls : `${redirectsXml}\n${cleanUrls}`;
  return `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <defaultDocument enabled="true">
      <files>
        <clear />
        <add value="index.html" />
      </files>
    </defaultDocument>
    <rewrite>
      <rules>
${rules}
      </rules>
    </rewrite>
    <!-- ExecuteURL keeps the status that triggered the error. A client redirect would replace it, and serving the file as its own URL would answer 200. -->
    <httpErrors errorMode="Custom" existingResponse="Replace">
      <remove statusCode="404" subStatusCode="-1" />
      <error statusCode="404" path="/404.html" responseMode="ExecuteURL" />
      <remove statusCode="500" subStatusCode="-1" />
      <error statusCode="500" path="/500.html" responseMode="ExecuteURL" />
    </httpErrors>
    <httpProtocol>
${customHeaders(securityHeaders, "      ")}
    </httpProtocol>
  </system.webServer>
  <location path="design">
    <system.webServer>
      <httpProtocol>
${customHeaders([["Cache-Control", designCacheControl]], "        ")}
      </httpProtocol>
    </system.webServer>
  </location>
</configuration>
`;
}
