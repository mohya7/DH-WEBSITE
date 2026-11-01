#!/bin/sh
# npm audit exits non-zero when advisories exist. The text run is the log.
# The JSON run feeds the gate, which decides whether the job fails.
if [ "$#" -ne 1 ]; then
  echo "run-npm-audit.sh needs the app name"
  exit 1
fi
app=$1
if [ "$app" != "website" ] && [ "$app" != "studio" ]; then
  echo "run-npm-audit.sh app must be website or studio"
  exit 1
fi
npm audit --audit-level=high || true
npm audit --audit-level=high --json > "$RUNNER_TEMP/audit.json" || true
node ../.github/security/gate.mjs npm "$RUNNER_TEMP/audit.json" "$app"
