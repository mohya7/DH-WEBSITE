/*
 * Builds DigitalHubContent_Parity from scratch and exports the content snapshot
 * the cloud agent builds against.
 *
 * Why a parity database: on the real database the case studies, blog posts, and
 * error pages are drafts, so a website built from it would be missing whole
 * regions of the design and screenshot comparison could prove nothing about
 * them. This database is a throwaway: fresh, migrated, imported from
 * feature/interviewer-portal, then those placeholders published through the API.
 * The snapshot stays "published content only" and the design can be compared in
 * full. The real database is never touched.
 *
 * Idempotent: it drops and recreates the catalog every run, so a second run
 * produces the same result as the first.
 *
 *   node api/tools/parity-snapshot.mjs
 */
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const apiRoot = path.join(repoRoot, "api");
const apiProject = path.join(apiRoot, "src", "DigitalHub.Api", "DigitalHub.Api.csproj");
const sourceRoot = "D:\\work\\DigitalHub\\New Website\\DH-WEBSITE-main";
const snapshotRoot = path.join(repoRoot, "website", "fixtures", "snapshot");
const mediaRoot = path.join(repoRoot, "artifacts", "parity-media");

const catalog = "DigitalHubContent_Parity";
const forbidden = ["DigitalHubContent", "DigitalHubContent_Studio", "DigitalHubContent_Test", "DigitalHubContent_E2e"];
const origin = "http://127.0.0.1:5097";
const adminEmail = "parity-admin@digitalhub.test";
const adminPassword = "Parity-Only-Passw0rd!";
const buildToken = "parity-only-build-token-" + Math.random().toString(36).slice(2, 12);

const placeholderNote = "Placeholder text added only to publish this item in the parity database.";
const filled = [];

function step(message) {
  console.log("\n== " + message);
}

function run(file, args, options = {}) {
  return execFileSync(file, args, { encoding: "utf8", stdio: "pipe", ...options });
}

/* Never print a connection string: it carries the SQL login's password. */
function redact(text) {
  return String(text ?? "").replace(/(password|pwd)\s*=\s*[^;\r\n]*/gi, "$1=[redacted]");
}

function secretConnectionString() {
  const output = run("dotnet", ["user-secrets", "list", "--project", apiProject]);
  for (const line of output.split(/\r?\n/)) {
    const at = line.indexOf(" = ");
    if (at !== -1 && line.slice(0, at).trim() === "ConnectionStrings:Content") return line.slice(at + 3).trim();
  }
  throw new Error("ConnectionStrings:Content is not in user-secrets.");
}

function withCatalog(connectionString, name) {
  return connectionString.replace(/(?:Database|Initial Catalog)\s*=\s*[^;]*/i, "Database=" + name);
}

/* The elevated account, for DDL and migrations. The application's own login is
   not allowed to create a database or alter a schema. */
function integratedSecurity(connectionString) {
  return connectionString
    .split(";")
    .filter((part) => part.trim().length > 0)
    .filter((part) => !/^\s*(user\s*id|uid|password|pwd)\s*=/i.test(part))
    .concat("Integrated Security=true")
    .join(";");
}

function valueOf(connectionString, ...names) {
  for (const part of connectionString.split(";")) {
    const at = part.indexOf("=");
    if (at === -1) continue;
    const key = part.slice(0, at).trim().toLowerCase();
    if (names.some((name) => name.toLowerCase() === key)) return part.slice(at + 1).trim();
  }
  return undefined;
}

function sql(database, statements) {
  run("sqlcmd", ["-S", server, "-d", database, "-E", "-C", "-I", "-b", "-Q", statements]);
}

async function api(method, url, { token, body, buildHeader } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = "Bearer " + token;
  if (buildHeader) headers["X-Build-Token"] = buildHeader;
  const response = await fetch(origin + url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  return { status: response.status, body: parsed, text };
}

async function waitForApi() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(origin + "/api/v1/health");
      // 401 is a healthy API that wants a caller; either answer means it is up.
      if (response.status === 200 || response.status === 401) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("The parity API did not start.");
}

const secret = secretConnectionString();
const server = valueOf(secret, "Server", "Data Source") ?? "localhost";
const appLogin = valueOf(secret, "User ID", "UID") ?? "dh_content_app";
const parityConnection = withCatalog(secret, catalog);
const elevatedConnection = integratedSecurity(parityConnection);

// Refuse to run against anything but the throwaway catalog.
const resolved = valueOf(parityConnection, "Database", "Initial Catalog");
if (resolved !== catalog || forbidden.includes(resolved)) {
  throw new Error("Refusing to run: the connection string resolves to " + resolved + ", not " + catalog + ".");
}

let child = null;
try {
  step("Drop and recreate " + catalog);
  sql("master", `
IF DB_ID(N'${catalog}') IS NOT NULL
BEGIN
    ALTER DATABASE [${catalog}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE [${catalog}];
END
CREATE DATABASE [${catalog}];
`);

  step("Apply migrations with the elevated account");
  run("dotnet", ["tool", "restore"], { cwd: apiRoot });
  run("dotnet", [
    "tool", "run", "dotnet-ef", "--", "database", "update",
    "--project", apiProject, "--connection", elevatedConnection,
  ], { cwd: apiRoot });

  step("Grant the application login");
  sql(catalog, `
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'${appLogin.replace(/'/g, "''")}')
    CREATE USER [${appLogin.replace(/]/g, "]]")}] FOR LOGIN [${appLogin.replace(/]/g, "]]")}];
ALTER ROLE db_datareader ADD MEMBER [${appLogin.replace(/]/g, "]]")}];
ALTER ROLE db_datawriter ADD MEMBER [${appLogin.replace(/]/g, "]]")}];
`);

  step("Import content from feature/interviewer-portal");
  fs.rmSync(mediaRoot, { recursive: true, force: true });
  fs.mkdirSync(mediaRoot, { recursive: true });
  const importOutput = run("dotnet", [
    "run", "--project", path.join(apiRoot, "tools", "DigitalHub.ContentImport"), "-c", "Release", "--",
    "--source", sourceRoot, "--apply", "--database", catalog, "--media-root", mediaRoot,
  ], { cwd: apiRoot });
  console.log(redact(importOutput.split(/\r?\n/).slice(-6).join("\n")));

  step("Start the API against " + catalog);
  const artifacts = path.join(repoRoot, "artifacts", "parity");
  const apiEnv = {
      ...process.env,
      ASPNETCORE_ENVIRONMENT: "Development",
      ASPNETCORE_URLS: origin,
      ConnectionStrings__Content: parityConnection,
      Media__Root: mediaRoot,
      Auth__InitialAdminEmail: adminEmail,
      Auth__InitialAdminPassword: adminPassword,
      Auth__LoginPermitLimit: "1000",
      Build__Token: buildToken,
      Build__PermitLimit: "1000",
      Database__EnsureCreated: "false",
      // Its own build output, so a review API on 5088 keeps its file lock.
      UseArtifactsOutput: "true",
      ArtifactsPath: artifacts,
  };

  /* ArtifactsPath moves obj/ as well as bin/, so build into it explicitly before
     running with --no-build; otherwise the restore assets are not there. */
  run("dotnet", ["build", apiProject, "-c", "Release"], { cwd: apiRoot, env: apiEnv });

  const apiLog = path.join(repoRoot, "artifacts", "parity-api.log");
  fs.mkdirSync(path.dirname(apiLog), { recursive: true });
  const logHandle = fs.openSync(apiLog, "w");
  child = spawn("dotnet", ["run", "--project", apiProject, "-c", "Release", "--no-build", "--no-launch-profile"], {
    cwd: repoRoot,
    stdio: ["ignore", logHandle, logHandle],
    env: apiEnv,
  });

  try {
    await waitForApi();
  } catch (error) {
    // Say why, without echoing a connection string.
    console.error(redact(fs.readFileSync(apiLog, "utf8").split(/\r?\n/).slice(-15).join("\n")));
    throw error;
  }

  const login = await api("POST", "/api/v1/auth/login", { body: { email: adminEmail, password: adminPassword } });
  if (login.status !== 200) throw new Error("The parity admin could not sign in: " + login.status);
  const token = login.body.accessToken;

  step("Publish the placeholder case studies, blog posts, and error pages");
  const published = {};
  for (const collection of ["case-studies", "blog-posts"]) {
    published[collection] = await publishDrafts(collection, token);
  }
  published["error-pages"] = await publishErrorPages(token);

  step("Export the snapshot");
  const content = await api("GET", "/api/v1/build/content", { buildHeader: buildToken });
  if (content.status !== 200) throw new Error("The build endpoint answered " + content.status);

  fs.rmSync(snapshotRoot, { recursive: true, force: true });
  fs.mkdirSync(path.join(snapshotRoot, "media"), { recursive: true });
  const contentPath = path.join(snapshotRoot, "content.json");
  fs.writeFileSync(contentPath, content.text);

  let mediaCount = 0;
  let mediaBytes = 0;
  if (fs.existsSync(mediaRoot)) {
    for (const name of fs.readdirSync(mediaRoot)) {
      const from = path.join(mediaRoot, name);
      if (!fs.statSync(from).isFile()) continue;
      fs.copyFileSync(from, path.join(snapshotRoot, "media", name));
      mediaCount += 1;
      mediaBytes += fs.statSync(from).size;
    }
  }

  const snapshot = JSON.parse(content.text);
  const apiCommit = run("git", ["rev-parse", "HEAD"], { cwd: repoRoot }).trim();
  const sourceCommit = run("git", ["rev-parse", "HEAD"], { cwd: sourceRoot }).trim();
  const contentBytes = fs.statSync(contentPath).size;

  writeReadme({ snapshot, apiCommit, sourceCommit, contentBytes, mediaCount, mediaBytes, published });

  step("Done");
  console.log("content.json  " + contentBytes.toLocaleString() + " bytes");
  console.log("media         " + mediaCount + " files, " + mediaBytes.toLocaleString() + " bytes");
  console.log("counts        " + JSON.stringify(snapshot.counts));
  console.log("unresolved    " + snapshot.unresolvedReferences.length + " references");
  if (filled.length > 0) {
    console.log("\nPlaceholder text was added to publish these items in the parity database:");
    for (const entry of filled) console.log("  " + entry);
  }
} catch (error) {
  console.error("\nFAILED: " + redact(error.message));
  if (error.stdout) console.error(redact(error.stdout));
  if (error.stderr) console.error(redact(error.stderr));
  process.exitCode = 1;
} finally {
  if (child !== null) child.kill();
}

/* Publishes every draft in a collection, filling only what the publish checks
   demand. Anything filled is recorded and reported, so invented text is never
   silently part of the snapshot. */
async function publishDrafts(collection, token) {
  const drafts = await listAll(collection, token, "status=draft");
  const names = [];
  for (const row of drafts) {
    await publishOne(collection, row.id, token);
    names.push(row.slug);
  }

  console.log(`  ${collection}: published ${names.length}`);
  return names;
}

/** The list endpoint caps pageSize at 100, so read every page. */
async function listAll(collection, token, query = "") {
  const rows = [];
  for (let page = 1; page <= 100; page += 1) {
    const suffix = query.length > 0 ? "&" + query : "";
    const listed = await api("GET", `/api/v1/${collection}?page=${page}&pageSize=100${suffix}`, { token });
    if (listed.status !== 200) {
      throw new Error(`Could not list ${collection}: ${listed.status} ${listed.text.slice(0, 200)}`);
    }
    rows.push(...listed.body.items);
    if (rows.length >= listed.body.total || listed.body.items.length === 0) break;
  }

  return rows;
}

async function publishErrorPages(token) {
  const names = [];
  for (const slug of ["error-404", "error-500"]) {
    const found = await listAll("pages", token, "search=" + encodeURIComponent(slug));
    const row = found.find((item) => item.slug === slug);
    if (row === undefined) {
      console.log(`  error pages: ${slug} does not exist, nothing to publish`);
      continue;
    }
    if (row.status === "published") {
      names.push(slug);
      continue;
    }
    await publishOne("pages", row.id, token);
    names.push(slug);
  }

  console.log(`  error pages: published ${names.length}`);
  return names;
}

async function publishOne(collection, id, token) {
  const loaded = await api("GET", `/api/v1/${collection}/${id}`, { token });
  if (loaded.status !== 200) throw new Error(`Could not load ${collection}/${id}: ${loaded.status}`);
  const content = loaded.body.content;
  const slug = content.slug;

  let version = loaded.body.version;
  let attempt = await api("POST", `/api/v1/${collection}/${id}/publish`, { token, body: { version } });
  if (attempt.status === 200) return;

  // Blocked. Fill only the fields the checks named, then try once more.
  const errors = attempt.body?.errors ?? {};
  const write = {
    version,
    slug,
    title: content.title,
    metaTitle: content.metaTitle,
    metaDescription: content.metaDescription,
    shareImageId: content.shareImageId,
    shareImageAltOverride: content.shareImageAltOverride,
    canonicalOverride: content.canonicalOverride,
    noIndex: content.noIndex,
    sortOrder: content.sortOrder,
    fields: { ...content.fields },
  };
  if (Array.isArray(content.sections)) {
    write.sections = content.sections.map((section) => ({
      id: section.id,
      type: section.type,
      visible: section.visible,
      fields: section.fields,
    }));
  }

  for (const key of Object.keys(errors)) {
    if (key === "metaDescription") {
      write.metaDescription = `${content.title}. ${placeholderNote}`;
      filled.push(`${collection}/${slug}: metaDescription`);
    } else if (key === "body") {
      write.fields.body = JSON.stringify({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: placeholderNote }] }],
      });
      filled.push(`${collection}/${slug}: body`);
    }
  }

  const saved = await api("PUT", `/api/v1/${collection}/${id}/save`, { token, body: write });
  if (saved.status !== 200) {
    throw new Error(`Could not prepare ${collection}/${slug} for publishing: ${saved.status} ${saved.text.slice(0, 300)}`);
  }

  const reloaded = await api("GET", `/api/v1/${collection}/${id}`, { token });
  version = reloaded.body.version;
  attempt = await api("POST", `/api/v1/${collection}/${id}/publish`, { token, body: { version } });
  if (attempt.status !== 200) {
    throw new Error(`Could not publish ${collection}/${slug}: ${attempt.status} ${attempt.text.slice(0, 300)}`);
  }
}

function writeReadme({ snapshot, apiCommit, sourceCommit, contentBytes, mediaCount, mediaBytes, published }) {
  const counts = Object.entries(snapshot.counts).map(([name, value]) => `| ${name} | ${value} |`).join("\n");
  const filledList = filled.length === 0
    ? "None. Every placeholder published as it was imported.\n"
    : filled.map((entry) => "- " + entry).join("\n") + "\n";

  fs.writeFileSync(path.join(snapshotRoot, "README.md"), `# Content snapshot

Generated by \`node api/tools/parity-snapshot.mjs\`. **Never edit by hand** — run
the script again instead.

| | |
|---|---|
| Generated | ${snapshot.generatedAt} |
| Source database | \`${catalog}\` (throwaway, rebuilt each run) |
| Content imported from | \`feature/interviewer-portal\` at \`${sourceCommit}\` |
| API commit | \`${apiCommit}\` |
| content.json | ${contentBytes.toLocaleString()} bytes |
| media | ${mediaCount} files, ${mediaBytes.toLocaleString()} bytes |

## Item counts

| Collection | Published items |
|---|---|
${counts}

Unresolved references: ${snapshot.unresolvedReferences.length}.

## What this contains

Published content only, as the build content endpoint returned it, byte for byte.
No drafts, contact requests, users, audit entries, tokens, or anything from
user-secrets.

## What changes when the snapshot is regenerated

The database is rebuilt from nothing each run, so two runs of the same source
commit produce the same content, the same counts, and the same structure — but:

- **Item ids are new GUIDs.** Do not store a snapshot id anywhere that has to
  survive a refresh, and do not hard-code one in a test.
- **\`publishedAt\` and \`updatedAt\` are the time of the run**, not an editorial
  date. Anything that reads them, such as the sitemap's last-modified dates, will
  move on every refresh. A real editorial date has to come from the content.

Everything else compares byte for byte.

## Placeholders published for parity

On the real database the case studies, blog posts, and error pages are drafts, so
a website built from it would be missing whole regions of the design. This
snapshot comes from a throwaway parity database where those were published, so
screenshot comparison can cover them. The real database is not changed.

Published for parity: ${published["case-studies"].length} case studies, ${published["blog-posts"].length} blog posts, ${published["error-pages"].length} error pages.

### Text added to make them publishable

${filledList}`);
}
