#!/usr/bin/env bash
# merge-check.sh — Verify the 6 conditions before auto-merging the MR.
#
# Conditions (mirrors GitHub copilot-auto-fix):
#   1. MR state == "opened"
#   2. detailed_merge_status / merge_status == "mergeable" (no conflicts)
#   3. head_pipeline.status == "success"
#   4. No "auto:failed" label
#   5. No forbidden files (delegates to check-forbidden.sh)
#   6. Zero unresolved (resolvable) discussions
#
# Required env:
#   GL_TOKEN, CI_API_V4_URL, CI_PROJECT_ID, CI_MERGE_REQUEST_IID
#
# Exit codes:
#   0 — all conditions satisfied; safe to merge
#   1 — at least one condition failed; reasons printed to stdout

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../_common.sh"

require_env GL_TOKEN CI_API_V4_URL CI_PROJECT_ID CI_MERGE_REQUEST_IID

MR_IID="$CI_MERGE_REQUEST_IID"
ALL_OK=true
REASONS=""

add_reason() {
  REASONS="${REASONS}- ❌ $1"$'\n'
  ALL_OK=false
}

# Fetch MR object once; include head_pipeline so we can read CI status.
if ! MR_JSON=$(curl -fsS \
      --header "PRIVATE-TOKEN: $GL_TOKEN" \
      "$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests/$MR_IID?include_diverged_commits_count=false" 2>&1); then
  echo "API error fetching MR: $MR_JSON" >&2
  exit 1
fi

# --- Condition 1: state == opened ---
STATE=$(echo "$MR_JSON" | jq -r '.state // "unknown"')
if [ "$STATE" = "opened" ]; then
  echo "[1/6] MR state is opened — OK"
else
  add_reason "MR state is '$STATE' (expected 'opened')"
  echo "[1/6] MR state is '$STATE' — FAIL"
fi

# --- Condition 2: no conflicts ---
# GitLab exposes both legacy (merge_status) and new (detailed_merge_status)
# fields. We accept either "can_be_merged" or "mergeable".
MERGE_STATUS=$(echo "$MR_JSON" | jq -r '.detailed_merge_status // .merge_status // "unknown"')
case "$MERGE_STATUS" in
  mergeable|can_be_merged)
    echo "[2/6] No conflicts ($MERGE_STATUS) — OK"
    ;;
  *)
    add_reason "MR has conflicts or is not mergeable (status: $MERGE_STATUS)"
    echo "[2/6] merge status '$MERGE_STATUS' — FAIL"
    ;;
esac

# --- Condition 3: head pipeline success ---
PIPELINE_STATUS=$(echo "$MR_JSON" | jq -r '.head_pipeline.status // .pipeline.status // "missing"')
if [ "$PIPELINE_STATUS" = "success" ]; then
  echo "[3/6] Head pipeline status: success — OK"
else
  add_reason "Head pipeline status is '$PIPELINE_STATUS' (expected 'success')"
  echo "[3/6] Head pipeline status: '$PIPELINE_STATUS' — FAIL"
fi

# --- Condition 4: no auto:failed label ---
HAS_FAILED_LABEL=$(echo "$MR_JSON" | jq -r '[.labels[]? | select(. == "auto:failed")] | length')
if [ "$HAS_FAILED_LABEL" = "0" ]; then
  echo "[4/6] No auto:failed label — OK"
else
  add_reason "MR has 'auto:failed' label"
  echo "[4/6] auto:failed label present — FAIL"
fi

# --- Condition 5: no forbidden files (delegate) ---
# Run check-forbidden.sh in a subshell so its exit code is captured without
# aborting our own script.
if bash "$SCRIPT_DIR/check-forbidden.sh" >/tmp/forbidden.log 2>&1; then
  echo "[5/6] No forbidden files — OK"
else
  FILES=$(cat forbidden_files.txt 2>/dev/null || echo "(see log)")
  add_reason "Forbidden file pattern matched: $(echo "$FILES" | tr '\n' ' ')"
  echo "[5/6] Forbidden files detected — FAIL"
  echo "--- check-forbidden.sh output ---"
  cat /tmp/forbidden.log
  echo "---------------------------------"
fi

# --- Condition 6: zero unresolved (resolvable) threads ---
if ! DISCUSSIONS=$(curl -fsS \
      --header "PRIVATE-TOKEN: $GL_TOKEN" \
      "$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests/$MR_IID/discussions?per_page=100" 2>&1); then
  add_reason "API error fetching discussions"
  echo "[6/6] discussions fetch failed — FAIL"
else
  UNRESOLVED=$(echo "$DISCUSSIONS" \
    | jq '[.[] | select(.notes[0].resolvable == true and .notes[0].resolved == false)] | length')
  if [ "$UNRESOLVED" = "0" ]; then
    echo "[6/6] No unresolved threads — OK"
  else
    add_reason "$UNRESOLVED unresolved review thread(s) remain"
    echo "[6/6] $UNRESOLVED unresolved threads — FAIL"
  fi
fi

echo
if [ "$ALL_OK" = "true" ]; then
  echo "All 6 merge conditions satisfied."
  exit 0
fi

echo "Merge conditions NOT satisfied. Reasons:"
printf '%s' "$REASONS"
exit 1
