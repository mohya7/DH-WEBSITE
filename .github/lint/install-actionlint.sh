#!/bin/sh
# Versions and checksums come from the workflow env (workflow-lint.yml), which
# names the source of each sha256. Downloads actionlint and shellcheck into
# $RUNNER_TEMP, checks each archive before use, and extracts only the binary.
# This script does not lint.
set -eu

actionlint_file="actionlint_${ACTIONLINT_VERSION}_linux_amd64.tar.gz"
curl -sSfL -o "$RUNNER_TEMP/$actionlint_file" \
  "https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/$actionlint_file"
echo "${ACTIONLINT_SHA256}  $RUNNER_TEMP/$actionlint_file" | sha256sum --check --strict
tar -xzf "$RUNNER_TEMP/$actionlint_file" -C "$RUNNER_TEMP" actionlint

shellcheck_file="shellcheck-v${SHELLCHECK_VERSION}.linux.x86_64.tar.xz"
curl -sSfL -o "$RUNNER_TEMP/$shellcheck_file" \
  "https://github.com/koalaman/shellcheck/releases/download/v${SHELLCHECK_VERSION}/$shellcheck_file"
echo "${SHELLCHECK_SHA256}  $RUNNER_TEMP/$shellcheck_file" | sha256sum --check --strict
tar -xJf "$RUNNER_TEMP/$shellcheck_file" -C "$RUNNER_TEMP" --strip-components=1 \
  "shellcheck-v${SHELLCHECK_VERSION}/shellcheck"

"$RUNNER_TEMP/actionlint" -version
"$RUNNER_TEMP/shellcheck" --version
