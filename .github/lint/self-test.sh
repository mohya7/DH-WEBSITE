#!/bin/bash
# Self-test for the actionlint gate (GAP-08). Proves the logic of
# run-actionlint.sh with stub binaries, without the real actionlint: every
# case builds a fresh copy of the gate's files in a temporary folder, sets
# RUNNER_TEMP to it, places a stub actionlint (prints a given output, exits
# with a given code, records its arguments) and a stub shellcheck, and, for the
# date cases, a stub date first on PATH that answers `date -u +%F` with a fixed
# day and passes every other call to the real date. The gate has no test-only
# switch. Case 17 reads .github/workflows/workflow-lint.yml itself.
#
# Run: bash .github/lint/self-test.sh   (exit 0 only when every case passes)
set -u

here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
gate="$repo/.github/lint/run-actionlint.sh"
workflow="$repo/.github/workflows/workflow-lint.yml"
real_date="$(command -v date)"
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT

failures=0
n=0

pass() { echo "ok   $1"; }
fail() { echo "FAIL $1: $2"; failures=$((failures + 1)); }

# new_case: a fresh layout under $scratch/<n>; sets $root, $tmp, $bin.
new_case() {
  n=$((n + 1))
  root="$scratch/$n/repo"
  tmp="$scratch/$n/runner-temp"
  bin="$scratch/$n/bin"
  mkdir -p "$root/.github/lint/canary" "$root/.github/workflows" "$tmp" "$bin"
  if [ -f "$gate" ]; then cp "$gate" "$root/.github/lint/run-actionlint.sh"; fi
  cp "$repo/.github/lint/canary.expected" "$root/.github/lint/canary.expected"
  cp "$repo/.github/lint/canary/canary-workflow.yml" "$root/.github/lint/canary/canary-workflow.yml"
  printf '#!/bin/sh\nexit 0\n' > "$tmp/shellcheck"
  chmod +x "$tmp/shellcheck"
}

# stub_actionlint <exit code> [output line...]
stub_actionlint() {
  local code="$1"
  shift
  : > "$tmp/actionlint.out"
  local line
  for line in "$@"; do printf '%s\n' "$line" >> "$tmp/actionlint.out"; done
  cat > "$tmp/actionlint" <<EOF
#!/bin/sh
printf '%s\n' "\$@" > "$tmp/actionlint.args"
cat "$tmp/actionlint.out"
exit $code
EOF
  chmod +x "$tmp/actionlint"
}

# stub_today <YYYY-MM-DD>: `date -u +%F` answers this day.
stub_today() {
  cat > "$bin/date" <<EOF
#!/bin/sh
if [ "\$#" -eq 2 ] && [ "\$1" = "-u" ] && [ "\$2" = "+%F" ]; then
  echo "$1"
  exit 0
fi
exec "$real_date" "\$@"
EOF
  chmod +x "$bin/date"
}

# run_gate <mode...>; ACTIONLINT_BLOCKING_FROM comes from $blocking_from
# ("unset" leaves it out). Sets $out and $rc.
# SHELLCHECK_OPTS is removed unless $extra_env sets it (case 18).
extra_env=()
run_gate() {
  if [ "$blocking_from" = "unset" ]; then
    out="$(cd "$scratch" && env -u ACTIONLINT_BLOCKING_FROM -u SHELLCHECK_OPTS PATH="$bin:$PATH" RUNNER_TEMP="$tmp" \
      "${extra_env[@]}" bash "$root/.github/lint/run-actionlint.sh" "$@" 2>&1)"
  else
    out="$(cd "$scratch" && env -u SHELLCHECK_OPTS PATH="$bin:$PATH" RUNNER_TEMP="$tmp" ACTIONLINT_BLOCKING_FROM="$blocking_from" \
      "${extra_env[@]}" bash "$root/.github/lint/run-actionlint.sh" "$@" 2>&1)"
  fi
  rc=$?
}

# expect <case> <exit code> [text that must appear in the output]
expect() {
  local name="$1" want_rc="$2" want_text="${3:-}"
  if [ "$rc" -ne "$want_rc" ]; then
    fail "$name" "exit $rc, expected $want_rc; output: $out"
  elif [ -n "$want_text" ] && ! grep -qF -- "$want_text" <<<"$out"; then
    fail "$name" "output lacks '$want_text'; output: $out"
  else
    pass "$name"
  fi
}

finding='.github/workflows/ci.yml:10:5:expression:"github.event.pull_request.title" is potentially untrusted'
canary_lines=(
  '.github/lint/canary/canary-workflow.yml:15:3:job-needs:job "canary" needs job "no-such-job"'
  '.github/lint/canary/canary-workflow.yml:16:14:runner-label:label "ubuntu-latst" is unknown'
  '.github/lint/canary/canary-workflow.yml:21:11:action:input "not-an-input" is not defined'
  '.github/lint/canary/canary-workflow.yml:22:24:expression:"github.event.pull_request.title" is potentially untrusted'
  '.github/lint/canary/canary-workflow.yml:23:24:expression:property "missing" is not defined'
  '.github/lint/canary/canary-workflow.yml:24:9:shellcheck:shellcheck reported issue in this script: SC2086'
)

# 1. no findings
new_case; stub_actionlint 0; stub_today 2026-11-05; blocking_from=2026-11-11
run_gate workflows; expect "1 no findings" 0 "0 findings"

# 2. a finding before the blocking date: reported, not failed
new_case; stub_actionlint 1 "$finding"; stub_today 2026-11-10; blocking_from=2026-11-11
run_gate workflows; expect "2 finding in report mode" 0 "::warning"
expect "2 finding printed" 0 "$finding"

# 3. a finding on the blocking date: fails
new_case; stub_actionlint 1 "$finding"; stub_today 2026-11-11; blocking_from=2026-11-11
run_gate workflows; expect "3 finding on the blocking date" 1 "::error"

# 4. a finding after the blocking date: fails
new_case; stub_actionlint 1 "$finding"; stub_today 2026-12-01; blocking_from=2026-11-11
run_gate workflows; expect "4 finding after the blocking date" 1 "::error"

# 5. actionlint exits 2 (bad command line), report mode: fails
new_case; stub_actionlint 2 "flag provided but not defined"; stub_today 2026-11-05; blocking_from=2026-11-11
run_gate workflows; expect "5 exit 2 in report mode" 1

# 6. actionlint exits 3 (fatal error), report mode: fails
new_case; stub_actionlint 3; stub_today 2026-11-05; blocking_from=2026-11-11
run_gate workflows; expect "6 exit 3 in report mode" 1

# 7. ACTIONLINT_BLOCKING_FROM unset
new_case; stub_actionlint 0; stub_today 2026-11-05; blocking_from="unset"
run_gate workflows; expect "7 blocking date unset" 1

# 8. ACTIONLINT_BLOCKING_FROM not a real date, or not YYYY-MM-DD
for bad in 2026-13-45 11/11/2026 2026-02-30 ""; do
  new_case; stub_actionlint 0; stub_today 2026-11-05; blocking_from="$bad"
  run_gate workflows; expect "8 blocking date '$bad'" 1
done

# 9. shellcheck missing: actionlint would skip it silently
new_case; stub_actionlint 0; stub_today 2026-11-05; blocking_from=2026-11-11
rm -f "$tmp/shellcheck"
run_gate workflows; expect "9 shellcheck missing" 1
new_case; stub_actionlint 0; stub_today 2026-11-05; blocking_from=2026-11-11
chmod -x "$tmp/shellcheck"
run_gate workflows; expect "9 shellcheck not executable" 1

# 10. an actionlint config file, which could ignore findings
for cfg in actionlint.yaml actionlint.yml; do
  for mode in workflows canary; do
    new_case; stub_today 2026-11-05; blocking_from=2026-11-11
    if [ "$mode" = canary ]; then stub_actionlint 1 "${canary_lines[@]}"; else stub_actionlint 0; fi
    printf 'self-hosted-runner:\n  labels: []\n' > "$root/.github/$cfg"
    run_gate "$mode"; expect "10 .github/$cfg present, $mode mode" 1
  done
done

# 11. canary: exactly the expected findings
new_case; stub_actionlint 1 "${canary_lines[@]}"; stub_today 2026-11-05; blocking_from=2026-11-11
run_gate canary; expect "11 canary matches" 0

# 12. canary: the shellcheck finding missing
new_case; stub_actionlint 1 "${canary_lines[@]:0:5}"; stub_today 2026-11-05; blocking_from=2026-11-11
run_gate canary; expect "12 canary without the shellcheck finding" 1
new_case; stub_actionlint 1 "${canary_lines[@]}" "$finding"; stub_today 2026-11-05; blocking_from=2026-11-11
run_gate canary; expect "12 canary with an extra finding" 1

# 13. canary: no findings at all, or another exit code
new_case; stub_actionlint 0; stub_today 2026-11-05; blocking_from=2026-11-11
run_gate canary; expect "13 canary exit 0" 1
new_case; stub_actionlint 3 "${canary_lines[@]}"; stub_today 2026-11-05; blocking_from=2026-11-11
run_gate canary; expect "13 canary exit 3" 1

# 14. canary ignores the blocking date
new_case; stub_actionlint 1 "${canary_lines[@]}"; stub_today 2026-12-01; blocking_from=2026-11-11
run_gate canary; expect "14 canary after the blocking date" 0
new_case; stub_actionlint 1 "${canary_lines[@]}"; stub_today 2026-11-05; blocking_from="unset"
run_gate canary; expect "14 canary with the date unset" 0

# 15. no mode, unknown mode
new_case; stub_actionlint 0; stub_today 2026-11-05; blocking_from=2026-11-11
run_gate; expect "15 no mode" 1
new_case; stub_actionlint 0; stub_today 2026-11-05; blocking_from=2026-11-11
run_gate everything; expect "15 unknown mode" 1

# 16. the arguments actionlint receives, in both modes
for mode in workflows canary; do
  new_case; stub_today 2026-11-05; blocking_from=2026-11-11
  if [ "$mode" = canary ]; then stub_actionlint 1 "${canary_lines[@]}"; else stub_actionlint 0; fi
  run_gate "$mode"
  args="$(cat "$tmp/actionlint.args" 2>/dev/null)"
  if [ "$rc" -ne 0 ]; then
    fail "16 arguments, $mode mode" "gate exit $rc; output: $out"
  elif ! grep -qxF -- "-shellcheck=$tmp/shellcheck" <<<"$args"; then
    fail "16 arguments, $mode mode" "no -shellcheck=$tmp/shellcheck in: $args"
  elif ! grep -qxF -- "-pyflakes=" <<<"$args"; then
    fail "16 arguments, $mode mode" "no -pyflakes= in: $args"
  elif ! grep -qxF -- "-no-color" <<<"$args"; then
    fail "16 arguments, $mode mode" "no -no-color in: $args"
  elif grep -qE -- '^-+ignore' <<<"$args"; then
    fail "16 arguments, $mode mode" "-ignore passed: $args"
  elif [ "$mode" = workflows ] && grep -qE '\.ya?ml$' <<<"$args"; then
    fail "16 arguments, $mode mode" "file arguments passed, so not every workflow is linted: $args"
  elif [ "$mode" = canary ] && ! grep -qxF ".github/lint/canary/canary-workflow.yml" <<<"$args"; then
    fail "16 arguments, $mode mode" "canary file not passed: $args"
  else
    pass "16 arguments, $mode mode"
  fi
done

# 18. SHELLCHECK_OPTS set (shellcheck reads it, so it could drop checks the
# way a config file can): refused in both modes, in report mode, even empty.
for opts in "-e SC2046" ""; do
  for mode in workflows canary; do
    new_case; stub_today 2026-11-05; blocking_from=2026-11-11
    if [ "$mode" = canary ]; then stub_actionlint 1 "${canary_lines[@]}"; else stub_actionlint 0; fi
    extra_env=(SHELLCHECK_OPTS="$opts")
    run_gate "$mode"; expect "18 SHELLCHECK_OPTS='$opts', $mode mode" 1 "SHELLCHECK_OPTS"
    extra_env=()
  done
done

# 19. a blocking date after 2026-11-23 (Wave 1's last blocking day) is refused
# at run time, however the workflow sets it; 2026-11-23 itself is accepted.
new_case; stub_actionlint 1 "$finding"; stub_today 2026-11-05; blocking_from=2026-11-24
run_gate workflows; expect "19 blocking date 2026-11-24" 1 "2026-11-23"
new_case; stub_actionlint 0; stub_today 2026-11-05; blocking_from=2099-01-01
run_gate workflows; expect "19 blocking date 2099-01-01, no findings" 1 "2026-11-23"
new_case; stub_actionlint 1 "$finding"; stub_today 2026-11-05; blocking_from=2026-11-23
run_gate workflows; expect "19 blocking date 2026-11-23" 0 "::warning"

# 20. actionlint exits 1 but prints nothing: fails, with a message
for when in 2026-11-05 2026-12-01; do
  new_case; stub_actionlint 1; stub_today "$when"; blocking_from=2026-11-11
  run_gate workflows; expect "20 exit 1 with no output, today $when" 1 "::error"
done

# 17. the workflow itself: a valid blocking date no later than 2026-11-23, set
# exactly once; no continue-on-error, if, paths or paths-ignore key, quoted or
# not, in block or flow style; every uses a 40-character SHA; no SHELLCHECK_OPTS;
# no write to the runner's env or path files in the workflow or the gate's
# scripts. Full-line and trailing comments are ignored, except for the
# SHELLCHECK_OPTS and env-file checks, which read every byte.
key_re() { printf '%s' "(^[[:space:]]*(-[[:space:]]+)?|[{,][[:space:]]*)[\"']?$1[\"']?[[:space:]]*:"; }
check_workflow() {
  if [ ! -f "$workflow" ]; then echo "$workflow is missing"; return; fi
  local code
  code="$(sed -E -e 's/^[[:space:]]*#.*$//' -e 's/[[:space:]]#.*$//' "$workflow")"
  local mentions date_value
  mentions="$(grep -o 'ACTIONLINT_BLOCKING_FROM' <<<"$code" | grep -c .)"
  if [ "$mentions" -ne 1 ]; then echo "ACTIONLINT_BLOCKING_FROM appears $mentions times outside comments, expected once (its env entry)"; return; fi
  date_value="$(grep -E "$(key_re ACTIONLINT_BLOCKING_FROM)" <<<"$code" \
    | sed -E "s/^.*ACTIONLINT_BLOCKING_FROM[\"']?[[:space:]]*:[[:space:]]*[\"']?([^\"',}[:space:]]*).*$/\1/")"
  if ! grep -qE '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' <<<"$date_value" \
    || [ "$("$real_date" -u -d "$date_value" +%F 2>/dev/null)" != "$date_value" ]; then
    echo "ACTIONLINT_BLOCKING_FROM '$date_value' is not a real YYYY-MM-DD date"; return
  fi
  if [[ "$date_value" > "2026-11-23" ]]; then echo "ACTIONLINT_BLOCKING_FROM $date_value is after 2026-11-23"; return; fi
  local key
  for key in continue-on-error if paths paths-ignore; do
    if grep -nE "$(key_re "$key")" <<<"$code"; then echo "$key key present"; return; fi
  done
  if grep -n 'SHELLCHECK_OPTS' "$workflow"; then echo "SHELLCHECK_OPTS in the workflow"; return; fi
  local env_files="GITHUB_""ENV|GITHUB_""PATH" script
  if grep -nE "$env_files" "$workflow"; then echo "the workflow writes the runner's env or path file"; return; fi
  for script in "$repo"/.github/lint/*.sh; do
    if grep -nE "$env_files" "$script"; then echo "$script writes the runner's env or path file"; return; fi
  done
  local uses
  uses="$(grep -oE "[\"']?uses[\"']?[[:space:]]*:[[:space:]]*[\"']?[^\"',}[:space:]]*" <<<"$code" \
    | sed -E "s/^[\"']?uses[\"']?[[:space:]]*:[[:space:]]*[\"']?//")"
  if [ -z "$uses" ]; then echo "no uses: found"; return; fi
  if grep -vE '^[A-Za-z0-9_.-]+/[A-Za-z0-9_./-]+@[0-9a-f]{40}$' <<<"$uses"; then
    echo "a uses: is not pinned by a 40-character SHA"; return
  fi
}
problem="$(check_workflow)"
if [ -n "$problem" ]; then fail "17 workflow-lint.yml shape" "$problem"; else pass "17 workflow-lint.yml shape"; fi

echo
if [ "$failures" -ne 0 ]; then
  echo "actionlint gate self-test: $failures failed"
  exit 1
fi
echo "actionlint gate self-test: all cases passed"
