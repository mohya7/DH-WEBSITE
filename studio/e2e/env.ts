import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const e2eCatalog = "DigitalHubContent_E2e";
export const productionCatalog = "DigitalHubContent";
export const e2eAdminEmail = "e2e-admin@digitalhub.test";
export const e2eEditorEmail = "e2e-editor@digitalhub.test";
export const e2ePassword = "E2e-Only-Passw0rd!";
export const e2eApiOrigin = "http://127.0.0.1:5099";
export const e2eStudioOrigin = "http://127.0.0.1:5174";

const studioRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(studioRoot, "..");

export function e2eEnv() {
  const apiProject = path.join(repoRoot, "api", "src", "DigitalHub.Api", "DigitalHub.Api.csproj");
  const restricted = readSecretConnectionString(apiProject);
  const connectionString = toE2eCatalog(restricted);
  assertSafeCatalog(catalogOf(connectionString));
  const mediaRoot = path.join(os.tmpdir(), "dh-platform-media-e2e");
  return {
    repoRoot,
    studioRoot,
    apiProject,
    connectionString,
    elevatedConnectionString: toIntegratedSecurity(connectionString),
    mediaRoot,
    loginName: valueOf(restricted, "User ID", "UID") ?? "dh_content_app",
    server: valueOf(connectionString, "Server", "Data Source") ?? "localhost",
    apiEnv: {
      ASPNETCORE_ENVIRONMENT: "Development",
      ASPNETCORE_URLS: e2eApiOrigin,
      ConnectionStrings__Content: connectionString,
      Media__Root: mediaRoot,
      Auth__InitialAdminEmail: e2eAdminEmail,
      Auth__InitialAdminPassword: e2ePassword,
      Auth__InitialEditorEmail: e2eEditorEmail,
      Auth__InitialEditorPassword: e2ePassword,
      Contact__PermitLimit: "1000",
      /* The limiter keys on IP plus email, so every test signing in as the same
         account from 127.0.0.1 shares one budget of 8 per hour. Raised for the
         same reason Contact__PermitLimit is, and only for the e2e API: the
         production default stays 8 in appsettings.json. */
      Auth__LoginPermitLimit: "1000",
      Database__EnsureCreated: "false",
    },
    studioEnv: {
      DH_API_URL: e2eApiOrigin,
      DH_STUDIO_PORT: "5174",
    },
  };
}

export function assertSafeCatalog(catalog: string) {
  if (catalog.localeCompare(productionCatalog, undefined, { sensitivity: "accent" }) === 0) {
    throw new Error("End-to-end runs must never use DigitalHubContent.");
  }

  if (catalog !== e2eCatalog) {
    throw new Error(`End-to-end runs must use ${e2eCatalog}.`);
  }
}

function readSecretConnectionString(apiProject: string) {
  const output = execFileSync("dotnet", ["user-secrets", "list", "--project", apiProject], {
    encoding: "utf8",
  });
  for (const line of output.split(/\r?\n/)) {
    const separator = line.indexOf(" = ");
    if (separator === -1) {
      continue;
    }

    if (line.slice(0, separator) === "ConnectionStrings:Content") {
      return line.slice(separator + 3).trim();
    }
  }

  throw new Error("ConnectionStrings:Content is not configured.");
}

function toE2eCatalog(connectionString: string) {
  const match = connectionString.match(/(Database|Initial Catalog)=([^;]+)/i);
  if (match === null || match.index === undefined) {
    throw new Error("The API connection string must name DigitalHubContent.");
  }

  const catalog = match[2];
  if (catalog.localeCompare(productionCatalog, undefined, { sensitivity: "accent" }) !== 0) {
    throw new Error("The API connection string must name DigitalHubContent.");
  }

  const after = match.index + match[0].length;
  if (after < connectionString.length && connectionString[after] === "_") {
    throw new Error("The API connection string must name DigitalHubContent.");
  }

  return connectionString.slice(0, match.index) + `${match[1]}=${e2eCatalog}` + connectionString.slice(after);
}

function toIntegratedSecurity(connectionString: string) {
  const stripped = connectionString
    .replace(/;?(User ID|UID|Password|PWD)=[^;]*/gi, "")
    .replace(/^;|;$/g, "");
  if (/Integrated Security=/i.test(stripped) || /Trusted_Connection=/i.test(stripped)) {
    return stripped;
  }

  return `${stripped};Integrated Security=true`;
}

function catalogOf(connectionString: string) {
  return valueOf(connectionString, "Database", "Initial Catalog") ?? "";
}

function valueOf(connectionString: string, ...keys: string[]) {
  for (const key of keys) {
    const match = connectionString.match(new RegExp(`(?:^|;)${key}=([^;]+)`, "i"));
    if (match?.[1]) {
      return match[1];
    }
  }

  return undefined;
}
