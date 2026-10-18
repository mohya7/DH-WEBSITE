#!/bin/sh
# The only Semgrep scan. Roots, packs, and excludes are the lines below.
# This file takes no arguments and does not read SEMGREP_ROOTS or any other
# environment variable for those lists. A change here has to match
# run-semgrep.expected.sh in the same commit.
if [ "$#" -ne 0 ]; then
  echo "run-semgrep.sh takes no arguments"
  exit 1
fi
if [ -z "${RUNNER_TEMP:-}" ]; then
  echo "RUNNER_TEMP is not set"
  exit 1
fi
export SEMGREP_SEND_METRICS=off

set +e
semgrep scan \
  --metrics=off \
  --disable-version-check \
  --quiet \
  --json \
  --output "$RUNNER_TEMP/semgrep.json" \
  --config p/javascript \
  --config p/typescript \
  --config p/csharp \
  --config p/owasp-top-ten \
  --config p/secrets \
  --exclude node_modules \
  --exclude bin \
  --exclude obj \
  --exclude dist \
  --exclude out \
  --exclude website/design \
  --exclude website/fixtures \
  --exclude "*.Designer.cs" \
  --exclude "*ModelSnapshot.cs" \
  --exclude generated \
  api \
  website/src \
  website/scripts \
  website/behaviors \
  website/test \
  website/tools \
  website/next.config.ts \
  website/vitest.config.ts \
  studio/src \
  studio/scripts \
  studio/vite \
  studio/test \
  studio/e2e \
  studio/vite.config.ts \
  studio/vitest.config.ts \
  studio/playwright.config.ts \
  packages \
  .github/security
code=$?
set -e
if [ "$code" -gt 1 ]; then
  echo "semgrep exited $code"
  exit "$code"
fi
node .github/security/gate.mjs semgrep "$RUNNER_TEMP/semgrep.json"
