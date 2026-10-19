#!/bin/sh
# $1 is the gate label, $2 is the report path, $3 is the git log range.
set -eu
if [ "$#" -ne 3 ]; then
  echo "run-gitleaks.sh needs a label, a report path, and log options"
  exit 1
fi
label=$1
report=$2
opts=$3
"$RUNNER_TEMP/gitleaks" git --no-banner --redact --exit-code 0 \
  --log-opts="$opts" \
  --report-format json --report-path "$report" .
node .github/security/gate.mjs gitleaks "$report" "$label"
