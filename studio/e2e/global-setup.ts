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

  /* Drop and recreate rather than delete rows, so the identity tables start
     empty too and the seeder creates the admin and editor fresh on every run.
     Clearing content alone left AspNetUsers behind, which meant the seeded
     passwords had to be reset somewhere -- and a password reset belongs in the
     admin screens, never in startup code. SINGLE_USER rolls back any session
     still holding the database so the drop cannot hang. */
  runSql(env.server, "master", `
IF DB_ID(N'${e2eCatalog}') IS NOT NULL
BEGIN
    ALTER DATABASE [${e2eCatalog}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE [${e2eCatalog}];
END
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
