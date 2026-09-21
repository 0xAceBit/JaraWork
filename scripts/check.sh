#!/usr/bin/env bash
# Sequential lint + typecheck with a hard per-step timeout.
#
# Sequential on purpose: one agent round trip instead of two, and each step
# still gets the sandbox's full CPU rather than splitting it with the other.
# Both are now near-instant (oxlint --type-aware + tsc 7 typically finish in
# well under a second combined on a real app — see CHANGELOG for the
# eslint/tsc 5.6 comparison), so sequencing costs nothing worth trading away.
# Both steps always run so one invocation reports lint AND type errors.
#
# The per-step timeout exists because the sandbox's agent-side command timeout
# is 600s: a starved step should fail in 150s with a clear message, not eat
# 10 minutes. GNU timeout ships in the sandbox image; on machines without it
# (exported apps on stock macOS) the steps run unbounded rather than failing.

set -u

STEP_TIMEOUT_SECONDS=150
fail=0

if command -v timeout > /dev/null 2>&1; then
  HAVE_TIMEOUT=1
else
  HAVE_TIMEOUT=0
fi

run_step() {
  step_name="$1"
  shift
  step_start=$(date +%s)
  if [ "${HAVE_TIMEOUT}" -eq 1 ]; then
    timeout --signal=TERM --kill-after=10 "${STEP_TIMEOUT_SECONDS}" "$@"
  else
    "$@"
  fi
  step_exit=$?
  step_elapsed=$(( $(date +%s) - step_start ))
  # 124 is timeout's TERM path; 137 is SIGKILL, which is also what the kernel
  # OOM killer produces, so only call 137 a timeout when the clock agrees.
  if [ "${HAVE_TIMEOUT}" -eq 1 ] && { [ "${step_exit}" -eq 124 ] || { [ "${step_exit}" -eq 137 ] && [ "${step_elapsed}" -ge "${STEP_TIMEOUT_SECONDS}" ]; }; }; then
    echo "check: ${step_name} timed out after ${STEP_TIMEOUT_SECONDS}s." >&2
    echo "check: the sandbox is likely busy with another heavy process (forge build, bun install, dev server restart)." >&2
    echo "check: wait for background work to finish, then re-run: bun run check" >&2
    fail=1
  elif [ "${step_exit}" -eq 137 ]; then
    echo "check: ${step_name} was killed (exit 137) after ${step_elapsed}s — likely out of memory. Stop other heavy processes and re-run: bun run check" >&2
    fail=1
  elif [ "${step_exit}" -ne 0 ]; then
    fail=1
  fi
}

run_step lint bun run lint
run_step typecheck bun run typecheck

exit "${fail}"
