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
# The audit covers the full tree. NODE_ENV=production, NPM_CONFIG_OMIT,
# npm_config_production or an .npmrc can make npm omit packages without any
# flag here, so npm's effective omit setting must be empty. No switch turns
# this check off.
if ! omit=$(npm config get omit); then
  echo "::error title=npm audit ($app)::npm config get omit failed"
  exit 1
fi
if [ -n "$omit" ]; then
  echo "::error title=npm audit ($app)::npm is set to omit \"$omit\"; the audit must cover the full tree, development packages included. Remove NODE_ENV=production, NPM_CONFIG_OMIT, npm_config_production or the omit setting in .npmrc."
  exit 1
fi
npm audit --audit-level=high || true
npm audit --audit-level=high --json > "$RUNNER_TEMP/audit.json" || true
node ../.github/security/gate.mjs npm "$RUNNER_TEMP/audit.json" "$app"
