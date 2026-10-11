import { execFileSync, spawn } from "node:child_process";
import path from "node:path";
import { assertSafeCatalog, e2eCatalog, e2eEnv } from "./env.ts";

let stage = "catalog validation";
async function startApi() {
  assertSafeCatalog(e2eCatalog);
  const env = e2eEnv();
  // Keep the E2E build separate from a running manual-review API on Windows.
  const processEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ...env.apiEnv,
    UseArtifactsOutput: "true",
    ArtifactsPath: path.join(env.repoRoot, "artifacts", "e2e"),
  };
  // The administrator connection is for this script only, never for the API.
  delete processEnv.ConnectionStrings__ContentAdmin;

  /* Drop and recreate rather than delete rows, so the identity tables start
     empty too and the seeder creates the admin and editor fresh on every run.
     Clearing content alone left AspNetUsers behind, which meant the seeded
     passwords had to be reset somewhere -- and a password reset belongs in the
     admin screens, never in startup code. SINGLE_USER rolls back any session
     still holding the database so the drop cannot hang. */
  stage = "database reset";
  runSql(env, "master", `
IF DB_ID(N'${e2eCatalog}') IS NOT NULL
BEGIN
    ALTER DATABASE [${e2eCatalog}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE [${e2eCatalog}];
END
CREATE DATABASE [${e2eCatalog}];
`);

  const apiRoot = path.join(env.repoRoot, "api");
  try {
    stage = "dotnet tool restore";
    execFileSync("dotnet", ["tool", "restore"], { cwd: apiRoot, stdio: "pipe" });
    /* Build explicitly into the artifacts folder first. ArtifactsPath moves obj/
       as well as bin/, so without this the restore assets live under the default
       path and dotnet-ef fails with NETSDK1004 before it reads any migration.
       Building here also satisfies the --no-build on both the migration and the
       run below, so the executable is produced exactly once. */
    stage = "Release build";
    execFileSync("dotnet", ["build", env.apiProject, "-c", "Release"], { cwd: apiRoot, stdio: "pipe", env: processEnv });
    stage = "Release migrations";
    execFileSync(
      "dotnet",
      ["tool", "run", "dotnet-ef", "--", "database", "update", "--no-build", "--configuration", "Release", "--project", env.apiProject, "--connection", env.elevatedConnectionString],
      { cwd: apiRoot, stdio: "pipe", env: processEnv },
    );
  } catch {
    throw new Error("Could not apply migrations to DigitalHubContent_E2e.");
  }

  stage = "application grants";
  runSql(env, e2eCatalog, `
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
  // Only this webServer process resets the database. Playwright workers reload
  // the config, so it must never import or execute this script.
  const api = spawn("dotnet", ["run", "--project", env.apiProject, "-c", "Release", "--no-build", "--no-launch-profile"], {
    cwd: env.repoRoot,
    env: processEnv,
    stdio: "inherit",
  });
  api.on("error", () => {
    console.error("Could not start the E2E API.");
    process.exitCode = 1;
  });
  api.on("exit", (code) => { process.exitCode = code ?? 1; });
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => api.kill(signal));
  }
}

/**
 * Runs SQL as the administrator: SQL authentication when ConnectionStrings__ContentAdmin
 * is configured (the password goes through SQLCMDPASSWORD, never the command
 * line), Windows authentication (-E) otherwise, as on the local machine.
 */
function runSql(env: ReturnType<typeof e2eEnv>, database: string, sql: string) {
  const auth = env.sqlAdmin === null ? ["-E"] : ["-U", env.sqlAdmin.user];
  const sqlEnv = env.sqlAdmin === null ? process.env : { ...process.env, SQLCMDPASSWORD: env.sqlAdmin.password };
  try {
    execFileSync("sqlcmd", ["-S", env.server, "-d", database, ...auth, "-C", "-I", "-b", "-Q", sql], { stdio: "pipe", env: sqlEnv });
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

startApi().catch(() => {
  // Child-process errors can contain connection strings; never print them.
  console.error(`E2E ${stage} failed; the API was not started.`);
  process.exitCode = 1;
});
