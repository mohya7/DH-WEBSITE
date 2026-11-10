#!/bin/bash
# The actionlint gate (GAP-08). install-actionlint.sh puts the actionlint and
# the shellcheck binaries in $RUNNER_TEMP; this script runs them.
#
#   run-actionlint.sh workflows   lint every workflow in .github/workflows/.
#                                 Findings warn before ACTIONLINT_BLOCKING_FROM
#                                 (UTC, YYYY-MM-DD) and fail on or after it.
#   run-actionlint.sh canary      lint .github/lint/canary/canary-workflow.yml;
#                                 its findings must equal canary.expected
#                                 (line:col:kind). Always blocking.
#
# A gate that cannot run fails, in report mode too: actionlint exiting with
# anything but 0 or 1, shellcheck missing (actionlint would skip it silently),
# a missing or malformed blocking date or one after 2026-11-23, an actionlint
# config file (one can ignore findings by path or message), SHELLCHECK_OPTS
# set (it can exclude shellcheck checks), or exit 1 with no findings printed.
# No -ignore is ever passed.
# Tested by .github/lint/self-test.sh.
set -euo pipefail

usage() {
  echo "usage: run-actionlint.sh workflows|canary" >&2
  exit 1
}

[ "$#" -eq 1 ] || usage
mode="$1"
case "$mode" in
  workflows | canary) ;;
  *) usage ;;
esac

root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"

: "${RUNNER_TEMP:?RUNNER_TEMP is not set}"
actionlint="$RUNNER_TEMP/actionlint"
shellcheck="$RUNNER_TEMP/shellcheck"

if [ ! -f "$actionlint" ] || [ ! -x "$actionlint" ]; then
  echo "::error title=actionlint::$actionlint is not an executable file; run install-actionlint.sh first"
  exit 1
fi
if [ ! -f "$shellcheck" ] || [ ! -x "$shellcheck" ]; then
  echo "::error title=actionlint::$shellcheck is not an executable file; actionlint would skip shellcheck silently"
  exit 1
fi
for config in .github/actionlint.yaml .github/actionlint.yml; do
  if [ -e "$config" ]; then
    echo "::error title=actionlint::$config exists. A config file can ignore findings; this gate does not accept one."
    exit 1
  fi
done

# The shellcheck binary reads extra options from SHELLCHECK_OPTS, so it can exclude checks
# the way a config file can. Refused when set at all, even empty, so an attempt
# shows in the log rather than being quietly undone.
if [ -n "${SHELLCHECK_OPTS+set}" ]; then
  echo "::error title=actionlint::SHELLCHECK_OPTS is set ('$SHELLCHECK_OPTS'). It can exclude shellcheck checks; this gate does not accept it."
  exit 1
fi

# Wave 1's last blocking day (refinement plan). No later report week is
# accepted, whatever sets the date.
latest_blocking_from=2026-11-23

if [ "$mode" = workflows ]; then
  blocking_from="${ACTIONLINT_BLOCKING_FROM:-}"
  if ! [[ "$blocking_from" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] \
    || [ "$(date -u -d "$blocking_from" +%F 2>/dev/null || true)" != "$blocking_from" ]; then
    echo "::error title=actionlint::ACTIONLINT_BLOCKING_FROM must be a real date as YYYY-MM-DD, got '$blocking_from'"
    exit 1
  fi
  if [[ "$blocking_from" > "$latest_blocking_from" ]]; then
    echo "::error title=actionlint::ACTIONLINT_BLOCKING_FROM $blocking_from is after $latest_blocking_from, Wave 1's last blocking day"
    exit 1
  fi
fi

# One finding per line: file:line:col:kind:message. The $err are Go template
# variables for actionlint, not shell, so the single quotes are intended.
# shellcheck disable=SC2016
format='{{range $err := .}}{{$err.Filepath}}:{{$err.Line}}:{{$err.Column}}:{{$err.Kind}}:{{$err.Message}}\n{{end}}'
args=(-no-color "-shellcheck=$shellcheck" -pyflakes= -format "$format")
if [ "$mode" = canary ]; then
  args+=(.github/lint/canary/canary-workflow.yml)
fi
# With no file argument actionlint lints every *.yml and *.yaml in
# .github/workflows/ of the repository it finds from the working directory.

set +e
output="$("$actionlint" "${args[@]}")"
status=$?
set -e

if [ "$mode" = canary ]; then
  if [ "$status" -ne 1 ]; then
    [ -z "$output" ] || printf '%s\n' "$output"
    echo "::error title=actionlint canary::actionlint exited $status on the canary; expected 1 (findings)"
    exit 1
  fi
  printf '%s\n' "$output"
  found="$(printf '%s\n' "$output" | cut -d: -f2-4)"
  if ! diff -u .github/lint/canary.expected <(printf '%s\n' "$found"); then
    echo "::error title=actionlint canary::the canary's findings differ from .github/lint/canary.expected (diff above)"
    exit 1
  fi
  echo "actionlint canary: all $(grep -c . .github/lint/canary.expected) expected findings reported"
  exit 0
fi

case "$status" in
  0)
    echo "actionlint: 0 findings in .github/workflows"
    exit 0
    ;;
  1)
    printf '%s\n' "$output"
    count="$(printf '%s\n' "$output" | grep -c . || true)"
    if [ "$count" -eq 0 ]; then
      echo "::error title=actionlint::actionlint exited 1 (findings) but printed none, so the result cannot be trusted"
      exit 1
    fi
    today="$(date -u +%F)"
    if [[ "$today" < "$blocking_from" ]]; then
      echo "::warning title=actionlint (report mode until $blocking_from)::$count finding(s) in .github/workflows"
      exit 0
    fi
    echo "::error title=actionlint::$count finding(s) in .github/workflows (blocking since $blocking_from)"
    exit 1
    ;;
  *)
    [ -z "$output" ] || printf '%s\n' "$output"
    echo "::error title=actionlint::actionlint exited $status, so it could not lint the workflows"
    exit 1
    ;;
esac
