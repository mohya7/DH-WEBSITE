#!/bin/sh
# Version and checksum come from the workflow env, which the security job sets
# from the release checksum file. This script does not scan.
set -eu
file="gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz"
curl -sSfL -o "$RUNNER_TEMP/$file" "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/$file"
echo "${GITLEAKS_SHA256}  $RUNNER_TEMP/$file" | sha256sum --check --strict
tar -xzf "$RUNNER_TEMP/$file" -C "$RUNNER_TEMP" gitleaks
