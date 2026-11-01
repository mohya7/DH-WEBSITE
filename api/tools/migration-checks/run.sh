#!/usr/bin/env bash
# Migration checks (GAP-06; ENGINEERING_STANDARDS.md G-4).
#
#   tools/migration-checks/run.sh <sql-server-container>
#
# Run from api/, after `dotnet tool restore` and a Release build. Uses the SQL
# Server container named by $1 (sa login, password from SA_PASSWORD) and its own
# scratch catalogs, which it drops on exit.
#
#   1. Generate the idempotent script and read the migration ids.
#   2. Canary: a batch that adds a column and uses it must be rejected.
#   3. The idempotent script, twice, on an empty catalog.
#   4. The script on a previous schema: (a) N-1, (b) the base branch's newest migration.
#   5. dotnet-ef database update: latest, down to N-1, latest again.
#   6. The schema from steps 3, 4 and 5 is identical.
#
# Environment:
#   SA_PASSWORD                     required; never printed.
#   MIGRATION_CHECKS_BLOCKING_FROM  required, YYYY-MM-DD. Before it, failures of
#                                   steps 3-6 are reported and the script exits 0;
#                                   from it, they fail. Steps 1 and 2 always fail.
#   MIGRATION_CHECK_DB_PREFIX       catalog name prefix, default MigrationCheck_.
#                                   A prefix starting with DigitalHubContent is refused.
#   BASE_REF                        base branch, default rebuild/dotnet-platform.
#
# No `set -x`: the connection strings carry SA_PASSWORD.
set -euo pipefail

readonly PROJECT="src/DigitalHub.Api/DigitalHub.Api.csproj"
readonly MIGRATIONS_DIR="api/src/DigitalHub.Api/Data/Migrations/"
readonly SQLCMD="/opt/mssql-tools18/bin/sqlcmd"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly CANARY_FILE="$SCRIPT_DIR/canary-add-column-then-sql.sql"

# ---------------------------------------------------------------- helpers

cannot_run() {
  echo "::error::Migration checks cannot run: $*" >&2
  summary "**Migration checks cannot run:** $*"
  exit 1
}

summary() {
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    printf '%s\n' "$*" >> "$GITHUB_STEP_SUMMARY"
  fi
}

# Removes the sa password from captured output before it is printed.
redact() {
  local text="$1"
  if [[ -n "${SA_PASSWORD:-}" ]]; then
    text="${text//"$SA_PASSWORD"/***}"
  fi
  printf '%s\n' "$text"
}

# The sqlcmd error lines of a captured output, at most 40 lines.
errors_of() {
  redact "$1" | grep -A1 -E '^(Msg [0-9]+|Sqlcmd: Error)' | head -n 40 || true
}

# ---------------------------------------------------------------- inputs

container="${1:-}"
[[ -n "$container" ]] || cannot_run "usage: run.sh <sql-server-container>"
[[ -n "${SA_PASSWORD:-}" ]] || cannot_run "SA_PASSWORD is not set"
export SQLCMDPASSWORD="$SA_PASSWORD"

blocking_from="${MIGRATION_CHECKS_BLOCKING_FROM:-}"
if [[ ! "$blocking_from" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] \
  || [[ "$(date -u -d "$blocking_from" +%F 2>/dev/null || true)" != "$blocking_from" ]]; then
  cannot_run "MIGRATION_CHECKS_BLOCKING_FROM must be a real date, YYYY-MM-DD (got '${blocking_from}')"
fi

prefix="${MIGRATION_CHECK_DB_PREFIX:-MigrationCheck_}"
[[ "$prefix" =~ ^[A-Za-z][A-Za-z0-9_]*$ ]] \
  || cannot_run "MIGRATION_CHECK_DB_PREFIX must be letters, digits and _ (got '${prefix}')"
shopt -s nocasematch
if [[ "$prefix" == DigitalHubContent* ]]; then
  cannot_run "MIGRATION_CHECK_DB_PREFIX may not start with DigitalHubContent (got '${prefix}')"
fi
shopt -u nocasematch

base_ref="${BASE_REF:-rebuild/dotnet-platform}"
[[ "$base_ref" =~ ^[A-Za-z0-9][A-Za-z0-9._/-]*$ ]] || cannot_run "BASE_REF is not a branch name (got '${base_ref}')"

[[ -f DigitalHub.slnx && -f "$PROJECT" ]] || cannot_run "run it from the api/ folder"
[[ -f "$CANARY_FILE" ]] || cannot_run "canary fixture $CANARY_FILE is missing"
command -v jq >/dev/null || cannot_run "jq is not installed"

today="$(date -u +%F)"
if [[ "$today" < "$blocking_from" ]]; then
  mode="report"
else
  mode="blocking"
fi
echo "Migration checks: catalog prefix ${prefix}, base ${base_ref}, blocking from ${blocking_from} (today ${today}: ${mode} mode)."

# ---------------------------------------------------------------- scratch space and clean-up

tmp="$(mktemp -d)"
container_dir="/tmp/${prefix}migration-checks-$$"
created_catalogs=()

sql() { # sql <database> <query>: one query, headers off, errors fail.
  docker exec -e SQLCMDPASSWORD "$container" "$SQLCMD" -S localhost -U sa -C -b -I \
    -h -1 -W -d "$1" -Q "SET NOCOUNT ON; $2"
}

cleanup() {
  local db
  for db in "${created_catalogs[@]}"; do
    sql master "IF DB_ID(N'$db') IS NOT NULL BEGIN ALTER DATABASE [$db] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [$db]; END" \
      >/dev/null 2>&1 || echo "::warning::Could not drop scratch catalog $db" >&2
  done
  docker exec "$container" rm -rf "$container_dir" >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT

create_catalog() {
  local db="$1" out
  created_catalogs+=("$db")
  if ! out="$(sql master "IF DB_ID(N'$db') IS NOT NULL BEGIN ALTER DATABASE [$db] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [$db]; END; CREATE DATABASE [$db];" 2>&1)"; then
    errors_of "$out" >&2
    cannot_run "could not create catalog $db"
  fi
}

# Copies a file into the container. A failure means the gate cannot run.
copy_in() { # copy_in <local file> <name in container>
  chmod 0644 "$1"
  docker cp "$1" "$container:$container_dir/$2" >/dev/null || cannot_run "docker cp of $2 failed"
}

# Applies a copied script with -I (QUOTED_IDENTIFIER on) and -b (stop and exit 1
# on the first error). Without -b sqlcmd exits 0 after failed batches (plan 2.3 B).
# Sets apply_rc and apply_out.
apply_script() { # apply_script <database> <name in container>
  apply_rc=0
  apply_out="$(docker exec -e SQLCMDPASSWORD "$container" "$SQLCMD" -S localhost -U sa -C -I -b \
    -d "$1" -i "$container_dir/$2" 2>&1)" || apply_rc=$?
}

# Sets ef_rc and ef_out.
ef_update() { # ef_update <database> [<target migration>]
  local db="$1"; shift
  ef_rc=0
  ef_out="$(dotnet tool run dotnet-ef -- database update "$@" --no-build --configuration Release \
    --project "$PROJECT" \
    --connection "Server=localhost,1433;Database=$db;User ID=sa;Password=$SA_PASSWORD;Encrypt=True;TrustServerCertificate=True" 2>&1)" || ef_rc=$?
}

history_count() { # history_count <database>: prints the row count, or "none".
  sql "$1" "IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL SELECT 'none' ELSE SELECT CAST(COUNT(*) AS varchar(10)) FROM [__EFMigrationsHistory];" 2>/dev/null \
    | tr -d '[:space:]' || echo "error"
}

# ---------------------------------------------------------------- results

results=()
failures=0
pass() { results+=("| $1 | pass | $2 |"); echo "PASS  $1: $2"; }
fail() {
  results+=("| $1 | **FAIL** | $2 |")
  failures=$((failures + 1))
  if [[ "$mode" == "blocking" ]]; then
    echo "::error::Migration check failed: $1: $2"
  else
    echo "::warning::Migration check failed (report mode until ${blocking_from}): $1: $2"
  fi
}
skip() { results+=("| $1 | skipped | $2 |"); echo "SKIP  $1: $2"; }

# ---------------------------------------------------------------- 1. generate

echo "== 1. Generate the idempotent script and read the migration ids"
docker exec "$container" mkdir -p "$container_dir" >/dev/null || cannot_run "cannot create $container_dir in container $container"

if ! gen_out="$(dotnet tool run dotnet-ef -- migrations script --idempotent --no-build --configuration Release \
    --project "$PROJECT" -o "$tmp/idempotent.sql" 2>&1)"; then
  redact "$gen_out" | tail -n 40 >&2
  cannot_run "dotnet-ef migrations script failed"
fi
[[ -s "$tmp/idempotent.sql" ]] || cannot_run "the idempotent script is empty"

ids_json="$(dotnet tool run dotnet-ef -- migrations list --json --no-connect --no-build --configuration Release \
    --project "$PROJECT" 2>/dev/null)" || cannot_run "dotnet-ef migrations list failed"
n="$(jq -er 'length' <<<"$ids_json" 2>/dev/null)" || cannot_run "could not parse the migrations list"
[[ "$n" =~ ^[0-9]+$ ]] && (( n >= 2 )) || cannot_run "expected at least 2 migrations, got '${n}'"
latest="$(jq -er '.[-1].id' <<<"$ids_json")" || cannot_run "could not read the latest migration id"
prev="$(jq -er '.[-2].id' <<<"$ids_json")" || cannot_run "could not read the previous migration id"
all_ids="$(jq -er '.[].id' <<<"$ids_json")" || cannot_run "could not read the migration ids"
echo "N=${n}, latest=${latest}, previous=${prev}"

# The base branch's newest migration. In CI the checkout is shallow, and a
# --depth=1 fetch is safe. In a full local clone it would make the repository
# shallow, so there the script reads origin/<base> and never fetches.
if [[ "$(git rev-parse --is-shallow-repository)" == "true" ]]; then
  git fetch --no-tags --depth=1 origin "$base_ref" >/dev/null 2>&1 || cannot_run "git fetch of ${base_ref} failed"
  base_tree="FETCH_HEAD"
elif git rev-parse --verify --quiet "refs/remotes/origin/${base_ref}^{commit}" >/dev/null; then
  base_tree="refs/remotes/origin/${base_ref}"
else
  cannot_run "origin/${base_ref} is not available locally (this script does not fetch in a full clone)"
fi
base_id="$(git ls-tree --full-tree --name-only "$base_tree" -- "$MIGRATIONS_DIR" \
  | sed 's#.*/##' | grep -E '^[0-9]{14}_[A-Za-z0-9_]+\.cs$' | grep -v '\.Designer\.cs$' \
  | sort | tail -n 1 | sed 's/\.cs$//')" || true
[[ -n "$base_id" ]] || cannot_run "no migration found on ${base_ref}"
grep -qxF "$base_id" <<<"$all_ids" \
  || cannot_run "the base branch's newest migration ${base_id} is not in this branch (removed or renamed?)"
echo "base (${base_ref}) newest migration: ${base_id}"

copy_in "$tmp/idempotent.sql" idempotent.sql
cp "$CANARY_FILE" "$tmp/canary.sql"
copy_in "$tmp/canary.sql" canary.sql

# ---------------------------------------------------------------- 2. canary

echo "== 2. Canary: add a column and use it in one batch"
create_catalog "${prefix}Canary"
apply_script "${prefix}Canary" canary.sql
if (( apply_rc != 0 )) && grep -q 'Msg 207' <<<"$apply_out" && grep -qF "Invalid column name 'new_col'" <<<"$apply_out"; then
  pass "2. Canary rejected" "exit ${apply_rc}, Msg 207 Invalid column name 'new_col'"
elif (( apply_rc == 0 )); then
  errors_of "$apply_out"
  echo "::error::Migration checks are broken: the canary was not rejected (exit 0). sqlcmd has lost -b, or the check no longer sees the defect."
  summary "**Migration checks are broken:** the canary was not rejected (exit 0)."
  exit 1
else
  errors_of "$apply_out" >&2
  cannot_run "the canary failed for another reason (exit ${apply_rc}), not Msg 207 on new_col"
fi

# ---------------------------------------------------------------- 3. script twice on empty

echo "== 3. Idempotent script twice on an empty catalog"
create_catalog "${prefix}Script"
script_ok=true
for run in 1 2; do
  apply_script "${prefix}Script" idempotent.sql
  count="$(history_count "${prefix}Script")"
  if (( apply_rc == 0 )) && [[ "$count" == "$n" ]]; then
    pass "3. Script run ${run}, empty catalog" "exit 0, history ${count} of ${n}"
  else
    errors_of "$apply_out"
    fail "3. Script run ${run}, empty catalog" "exit ${apply_rc}, history ${count} of ${n}"
    script_ok=false
  fi
done

# ---------------------------------------------------------------- 4. previous schema, script route

echo "== 4a. Previous schema (${prev}), then the script"
create_catalog "${prefix}Previous"
previous_ok=false
ef_update "${prefix}Previous" "$prev"
if (( ef_rc != 0 )); then
  redact "$ef_out" | tail -n 20
  fail "4a. Previous schema, script" "database update ${prev} failed, exit ${ef_rc}"
else
  apply_script "${prefix}Previous" idempotent.sql
  count="$(history_count "${prefix}Previous")"
  if (( apply_rc == 0 )) && [[ "$count" == "$n" ]]; then
    pass "4a. Previous schema, script" "from ${prev}: exit 0, history ${count} of ${n}"
    previous_ok=true
  else
    errors_of "$apply_out"
    fail "4a. Previous schema, script" "from ${prev}: exit ${apply_rc}, history ${count} of ${n}"
  fi
fi

base_ok=false
base_ran=false
if [[ "$base_id" == "$latest" ]]; then
  echo "== 4b. Base schema"
  skip "4b. Base schema, script" "base = head (${base_id}), covered by step 3"
else
  echo "== 4b. Base schema (${base_id}), then the script"
  base_ran=true
  create_catalog "${prefix}Base"
  ef_update "${prefix}Base" "$base_id"
  if (( ef_rc != 0 )); then
    redact "$ef_out" | tail -n 20
    fail "4b. Base schema, script" "database update ${base_id} failed, exit ${ef_rc}"
  else
    apply_script "${prefix}Base" idempotent.sql
    count="$(history_count "${prefix}Base")"
    if (( apply_rc == 0 )) && [[ "$count" == "$n" ]]; then
      pass "4b. Base schema, script" "from ${base_id}: exit 0, history ${count} of ${n}"
      base_ok=true
    else
      errors_of "$apply_out"
      fail "4b. Base schema, script" "from ${base_id}: exit ${apply_rc}, history ${count} of ${n}"
    fi
  fi
fi

# ---------------------------------------------------------------- 5. database update route

echo "== 5. dotnet-ef database update: latest, down to ${prev}, latest"
create_catalog "${prefix}Ef"
ef_ok=true
for target in "" "$prev" ""; do
  label="${target:-latest}"
  if [[ -n "$target" ]]; then ef_update "${prefix}Ef" "$target"; else ef_update "${prefix}Ef"; fi
  if (( ef_rc != 0 )); then
    redact "$ef_out" | tail -n 20
    fail "5. database update ${label}" "exit ${ef_rc}"
    ef_ok=false
    break
  fi
done
if [[ "$ef_ok" == true ]]; then
  count="$(history_count "${prefix}Ef")"
  if [[ "$count" == "$n" ]]; then
    pass "5. database update latest, ${prev}, latest" "each exit 0, history ${count} of ${n}"
  else
    fail "5. database update latest, ${prev}, latest" "history ${count} of ${n}"
    ef_ok=false
  fi
fi

# ---------------------------------------------------------------- 6. same schema

# Columns (type, length, precision, nullability, identity, collation), indexes
# with their columns and filters, check constraints, foreign keys and defaults.
# Default constraint names are left out: SQL Server generates them.
read -r -d '' SCHEMA_QUERY <<'SQL' || true
SELECT line FROM (
  SELECT 'COL|' + t.name + '|' + c.name + '|' + ty.name
       + '|' + CAST(c.max_length AS varchar(10)) + '|' + CAST(c.precision AS varchar(10)) + '|' + CAST(c.scale AS varchar(10))
       + '|' + CASE c.is_nullable WHEN 1 THEN 'NULL' ELSE 'NOT NULL' END
       + '|' + CASE c.is_identity WHEN 1 THEN 'IDENTITY' ELSE '' END
       + '|' + ISNULL(c.collation_name, '') AS line
  FROM sys.columns c
  JOIN sys.tables t ON t.object_id = c.object_id
  JOIN sys.types ty ON ty.user_type_id = c.user_type_id
  UNION ALL
  SELECT 'IDX|' + t.name + '|' + i.name + '|' + i.type_desc
       + '|' + CASE i.is_unique WHEN 1 THEN 'UNIQUE' ELSE '' END
       + '|' + CASE i.is_primary_key WHEN 1 THEN 'PK' ELSE '' END
       + '|' + ISNULL((SELECT STRING_AGG(c.name + CASE ic.is_descending_key WHEN 1 THEN ' DESC' ELSE '' END
                                     + CASE ic.is_included_column WHEN 1 THEN ' INCLUDE' ELSE '' END, ',')
                              WITHIN GROUP (ORDER BY ic.is_included_column, ic.key_ordinal, c.name)
                       FROM sys.index_columns ic
                       JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                       WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id), '')
       + '|' + ISNULL(i.filter_definition, '')
  FROM sys.indexes i
  JOIN sys.tables t ON t.object_id = i.object_id
  WHERE i.type > 0
  UNION ALL
  SELECT 'CHK|' + t.name + '|' + cc.name + '|' + REPLACE(REPLACE(cc.definition, CHAR(13), ' '), CHAR(10), ' ')
  FROM sys.check_constraints cc
  JOIN sys.tables t ON t.object_id = cc.parent_object_id
  UNION ALL
  SELECT 'FK|' + t.name + '|' + fk.name + '|' + rt.name
       + '|' + fk.delete_referential_action_desc + '|' + fk.update_referential_action_desc
       + '|' + ISNULL((SELECT STRING_AGG(pc.name + '->' + rc.name, ',') WITHIN GROUP (ORDER BY fkc.constraint_column_id)
                       FROM sys.foreign_key_columns fkc
                       JOIN sys.columns pc ON pc.object_id = fkc.parent_object_id AND pc.column_id = fkc.parent_column_id
                       JOIN sys.columns rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id
                       WHERE fkc.constraint_object_id = fk.object_id), '')
  FROM sys.foreign_keys fk
  JOIN sys.tables t ON t.object_id = fk.parent_object_id
  JOIN sys.tables rt ON rt.object_id = fk.referenced_object_id
  UNION ALL
  SELECT 'DEF|' + t.name + '|' + c.name + '|' + dc.definition
  FROM sys.default_constraints dc
  JOIN sys.tables t ON t.object_id = dc.parent_object_id
  JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
) AS schema_lines
ORDER BY line;
SQL

schema_of() { # schema_of <database> <file>
  docker exec -e SQLCMDPASSWORD "$container" "$SQLCMD" -S localhost -U sa -C -b -I \
    -h -1 -y 0 -d "$1" -Q "SET NOCOUNT ON; $SCHEMA_QUERY" > "$2" 2>&1
}

echo "== 6. Same schema"
compare=()
[[ "$script_ok" == true ]] && compare+=("${prefix}Script")
[[ "$previous_ok" == true ]] && compare+=("${prefix}Previous")
[[ "$base_ok" == true ]] && compare+=("${prefix}Base")
[[ "$ef_ok" == true ]] && compare+=("${prefix}Ef")
if [[ "$base_ran" == true ]]; then expected_compare=4; else expected_compare=3; fi

if (( ${#compare[@]} < expected_compare )); then
  fail "6. Same schema" "not reached: only ${#compare[@]} of ${expected_compare} catalogs were migrated"
else
  reference="${compare[0]}"
  schema_of "$reference" "$tmp/schema-$reference.txt" || cannot_run "could not list the schema of $reference"
  lines="$(wc -l < "$tmp/schema-$reference.txt" | tr -d ' ')"
  same=true
  for db in "${compare[@]:1}"; do
    schema_of "$db" "$tmp/schema-$db.txt" || cannot_run "could not list the schema of $db"
    if ! diff -u "$tmp/schema-$reference.txt" "$tmp/schema-$db.txt" > "$tmp/schema-diff.txt"; then
      head -n 60 "$tmp/schema-diff.txt"
      fail "6. Same schema" "${db} differs from ${reference}"
      same=false
    fi
  done
  if [[ "$same" == true ]]; then
    pass "6. Same schema" "${#compare[@]} catalogs (${compare[*]}), ${lines} lines each, identical"
  fi
fi

# ---------------------------------------------------------------- result

summary "### Migration checks"
summary ""
summary "Mode: **${mode}** (blocking from ${blocking_from}). Migrations: ${n}; base ${base_ref} newest: ${base_id}."
summary ""
summary "| Check | Result | Detail |"
summary "|---|---|---|"
for row in "${results[@]}"; do
  summary "$row"
done

echo "== Result: ${failures} failure(s); blocking from ${blocking_from}; ${mode} mode."
if (( failures > 0 )); then
  if [[ "$mode" == "blocking" ]]; then
    echo "::error::Migration checks: ${failures} failure(s)."
    exit 1
  fi
  echo "::warning::Migration checks: ${failures} failure(s), reported only until ${blocking_from}."
fi
exit 0
