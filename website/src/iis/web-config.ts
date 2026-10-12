/*
 * The IIS web.config for the static export, generated at build (Phase C, Section 8).
 *
 * It is configuration for the site IIS serves from out/. It does not proxy
 * anywhere: routing to the Content API and the Node hiring system is Phase D.
 *
 * Clean URLs. Pages are exported as path.html (the home page as index.html).
 * A request is rewritten to that file when the file exists, even if the same
 * path is also a folder. /blogs is both blogs.html and blogs/, and the page
 * wins: the rewrite does not skip directories, and it does not redirect to
 * /blogs/. `/` is index.html through the default document.
 *
 * A folder that has no page of its own (/services, /design, /media) is answered
 * with status 404, and httpErrors then serves 404.html under that status.
 * Leaving it to IIS would be a redirect onto the folder and then a 403.
 *
 * Redirects. Every row of the redirects table is a 301, whatever status code
 * the row stores. Rules run before the clean-URL rewrite.
 *
 * Error pages. httpErrors serves 404.html and 500.html with ExecuteURL, which
 * keeps the status that triggered the error.
 *
 * Cache. HTML and everything else get a short cache. /design/ and /media/
 * replace it with a year-long immutable cache. Design files live under the
 * content hash, and media file names are the hash of their bytes.
 *
 * Content security policy. Report-only. jsDelivr is allowed only for the
 * three scripts and the Tabler Icons package the design loads, not the whole
 * host. Inline style elements are allowed only on the home page, which is the
 * only page that injects one. Inline style attributes are allowed on every
 * page, because the markup uses them.
 *
 * Only when the site settings name a Tag Manager container, the policy adds
 * the Tag Manager and GA4 hosts from
 * https://developers.google.com/tag-platform/security/guides/csp
 * (container tag, and Google Analytics without Ads features, plus frame-src
 * from the Google Analytics table). With no container the policy is the one
 * from before Tag Manager existed. Preview Mode, Custom HTML tags, and Ads
 * features need more hosts; they are added when the container needs them.
 *
 * Strict-Transport-Security is max-age=31536000 without includeSubDomains.
 * That is revisited once decision D1 (the domains) is settled.
 */
import type { Redirect } from "../content/build-content";
import { GOOGLE_FONTS, GOOGLE_FONTS_STATIC, GSAP, LENIS, SCROLL_TRIGGER, TABLER_ICONS } from "../design/sets";

export class WebConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebConfigError";
  }
}

export const htmlCacheControl = "public, max-age=0, must-revalidate";
export const designCacheControl = "public, max-age=31536000, immutable";
/** No includeSubDomains until decision D1 settles the domains. */
export const strictTransportSecurity = "max-age=31536000";

/** Directory of the Tabler package, so its stylesheet and font files are both covered. */
const tablerDirectory = TABLER_ICONS.slice(0, TABLER_ICONS.lastIndexOf("/") + 1);

const scriptSrc = `script-src 'self' ${GSAP} ${SCROLL_TRIGGER} ${LENIS}`;
const styleSrc = `style-src 'self' ${GOOGLE_FONTS} ${TABLER_ICONS}`;
const fontSrc = `font-src 'self' ${GOOGLE_FONTS_STATIC} ${tablerDirectory}`;
const tagManagerScript = "https://www.googletagmanager.com";
const tagManagerImg = "https://www.googletagmanager.com https://*.google-analytics.com";
const tagManagerConnect = "https://www.googletagmanager.com https://*.google-analytics.com https://*.google.com";

/** Whether the site loads Tag Manager, which widens the policy. */
export interface WebConfigOptions {
  tagManager?: boolean;
}

function policy(style: string, tagManager: boolean): string {
  const plus = (directive: string, hosts: string) => (tagManager ? `${directive} ${hosts}` : directive);
  return [
    "default-src 'self'",
    plus(scriptSrc, tagManagerScript),
    style,
    "style-src-attr 'unsafe-inline'",
    fontSrc,
    plus("img-src 'self' data:", tagManagerImg),
    plus("connect-src 'self'", tagManagerConnect),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    tagManager ? "frame-src https://www.googletagmanager.com" : "frame-src 'none'",
  ].join("; ");
}

/** Every page except the home page. No inline style elements. */
export const contentSecurityPolicy = policy(styleSrc, false);

/** The home page, whose webgl-fluid-lib.js appends a style element as it loads. */
export const homeContentSecurityPolicy = policy(`${styleSrc} 'unsafe-inline'`, false);

/** The same two policies when the site settings name a Tag Manager container. */
export const tagManagerContentSecurityPolicy = policy(styleSrc, true);
export const tagManagerHomeContentSecurityPolicy = policy(`${styleSrc} 'unsafe-inline'`, true);

function securityHeaders(sitePolicy: string): [string, string][] {
  return [
    ["Content-Security-Policy-Report-Only", sitePolicy],
    ["Strict-Transport-Security", strictTransportSecurity],
    ["X-Content-Type-Options", "nosniff"],
    ["Referrer-Policy", "strict-origin-when-cross-origin"],
    ["X-Frame-Options", "DENY"],
    ["Cache-Control", htmlCacheControl],
  ];
}

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
            <add input="{DOCUMENT_ROOT}/{R:1}.html" matchType="IsFile" />
          </conditions>
          <action type="Rewrite" url="{R:1}.html" />
        </rule>
        <rule name="Folder addresses" stopProcessing="true">
          <match url=".+" ignoreCase="false" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" />
          </conditions>
          <action type="CustomResponse" statusCode="404" statusReason="Not Found" statusDescription="Not Found" />
        </rule>`;

function cacheLocation(urlPath: string): string {
  return `  <location path="${urlPath}">
    <system.webServer>
      <httpProtocol>
${customHeaders([["Cache-Control", designCacheControl]], "        ")}
      </httpProtocol>
    </system.webServer>
  </location>`;
}

/** The web.config for these redirects. Throws if a path cannot be expressed as a safe rule. */
export function renderWebConfig(redirects: readonly Redirect[], options: WebConfigOptions = {}): string {
  const sitePolicy = options.tagManager ? tagManagerContentSecurityPolicy : contentSecurityPolicy;
  const homePolicy = options.tagManager ? tagManagerHomeContentSecurityPolicy : homeContentSecurityPolicy;
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
    <staticContent>
      <remove fileExtension=".webp" />
      <mimeMap fileExtension=".webp" mimeType="image/webp" />
      <remove fileExtension=".xml" />
      <mimeMap fileExtension=".xml" mimeType="application/xml" />
      <remove fileExtension=".txt" />
      <mimeMap fileExtension=".txt" mimeType="text/plain; charset=utf-8" />
    </staticContent>
    <rewrite>
      <rules>
${rules}
      </rules>
      <outboundRules rewriteBeforeCache="true">
        <rule name="Home page inline style elements" preCondition="IsHome">
          <match serverVariable="RESPONSE_Content_Security_Policy_Report_Only" pattern=".*" />
          <action type="Rewrite" value="${xml(homePolicy)}" />
        </rule>
        <preConditions>
          <preCondition name="IsHome">
            <add input="{URL}" pattern="^/$" />
          </preCondition>
        </preConditions>
      </outboundRules>
    </rewrite>
    <!-- ExecuteURL keeps the status that triggered the error. A client redirect would replace it, and serving the file as its own URL would answer 200. -->
    <httpErrors errorMode="Custom" existingResponse="Replace">
      <remove statusCode="404" subStatusCode="-1" />
      <error statusCode="404" path="/404.html" responseMode="ExecuteURL" />
      <remove statusCode="500" subStatusCode="-1" />
      <error statusCode="500" path="/500.html" responseMode="ExecuteURL" />
    </httpErrors>
    <httpProtocol>
${customHeaders(securityHeaders(sitePolicy), "      ")}
    </httpProtocol>
  </system.webServer>
${cacheLocation("design")}
${cacheLocation("media")}
  <location path="index.html">
    <system.webServer>
      <httpProtocol>
${customHeaders([["Content-Security-Policy-Report-Only", homePolicy]], "        ")}
      </httpProtocol>
    </system.webServer>
  </location>
</configuration>
`;
}
