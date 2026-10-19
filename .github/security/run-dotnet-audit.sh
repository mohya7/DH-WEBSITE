#!/bin/sh
# The first command prints the table. The second writes the JSON the gate reads.
# dotnet list exits 0 when vulnerable packages are only reported.
set -eu
dotnet list DigitalHub.slnx package --vulnerable --include-transitive
dotnet list DigitalHub.slnx package --vulnerable --include-transitive --format json > "$RUNNER_TEMP/dotnet.json"
node ../.github/security/gate.mjs dotnet "$RUNNER_TEMP/dotnet.json"
