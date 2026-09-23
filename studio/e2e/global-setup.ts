import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { assertSafeCatalog, e2eCatalog, e2eEnv } from "./env";

export default async function globalSetup() {
  const env = e2eEnv();
  assertSafeCatalog(e2eCatalog);
  fs.rmSync(env.mediaRoot, { recursive: true, force: true });
  fs.mkdirSync(env.mediaRoot, { recursive: true });
  fs.mkdirSync(path.join(env.studioRoot, "e2e", ".generated"), { recursive: true });

  runSql(env.server, "master", `
IF DB_ID(N'${e2eCatalog}') IS NULL
    CREATE DATABASE [${e2eCatalog}];
`);

  const apiRoot = path.join(env.repoRoot, "api");
  try {
    execFileSync("dotnet", ["tool", "restore"], { cwd: apiRoot, stdio: "pipe" });
    execFileSync(
      "dotnet",
      ["tool", "run", "dotnet-ef", "--", "database", "update", "--project", env.apiProject, "--connection", env.elevatedConnectionString],
      { cwd: apiRoot, stdio: "pipe" },
    );
  } catch {
    throw new Error("Could not apply migrations to DigitalHubContent_E2e.");
  }

  runSql(env.server, e2eCatalog, `
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'${escapeSql(env.loginName)}')
    CREATE USER [${escapeIdent(env.loginName)}] FOR LOGIN [${escapeIdent(env.loginName)}];
IF NOT EXISTS (
    SELECT 1
    FROM sys.database_role_members rm
    JOIN sys.database_principals r ON rm.role_principal_id = r.principal_id
    JOIN sys.database_principals m ON rm.member_principal_id = m.principal_id
    WHERE r.name = N'db_datareader' AND m.name = N'${escapeSql(env.loginName)}')
    ALTER ROLE db_datareader ADD MEMBER [${escapeIdent(env.loginName)}];
IF NOT EXISTS (
    SELECT 1
    FROM sys.database_role_members rm
    JOIN sys.database_principals r ON rm.role_principal_id = r.principal_id
    JOIN sys.database_principals m ON rm.member_principal_id = m.principal_id
    WHERE r.name = N'db_datawriter' AND m.name = N'${escapeSql(env.loginName)}')
    ALTER ROLE db_datawriter ADD MEMBER [${escapeIdent(env.loginName)}];

DELETE FROM sections;
DELETE FROM working_copies;
DELETE FROM revisions;
DELETE FROM redirects;
UPDATE navigation_items SET parent_id = NULL;
DELETE FROM navigation_items;
DELETE FROM contact_requests;
DELETE FROM pages;
DELETE FROM services;
DELETE FROM partners;
DELETE FROM case_studies;
DELETE FROM blog_posts;
DELETE FROM vacancies;
DELETE FROM team_members;
DELETE FROM news_items;
DELETE FROM media;
DELETE FROM audit_log;
DELETE FROM RefreshTokens;
`);
}

function runSql(server: string, database: string, sql: string) {
  try {
    execFileSync("sqlcmd", ["-S", server, "-d", database, "-E", "-C", "-I", "-b", "-Q", sql], { stdio: "pipe" });
  } catch {
    throw new Error(`Could not run SQL against ${database}.`);
  }
}

function escapeSql(value: string) {
  return value.replaceAll("'", "''");
}

function escapeIdent(value: string) {
  return value.replaceAll("]", "]]");
}
