#!/usr/bin/env bash
# wait-for-ci.sh — Poll the MR's pipelines until the latest one finishes.
#
# We poll /merge_requests/:iid/pipelines and look at the FIRST entry (GitLab
# returns most recent first). Exit conditions:
#   - latest.status == "success"   -> exit 0
#   - latest.status == "failed"|"canceled"|"skipped" -> exit 1
#   - timeout reached              -> exit 2 (caller decides what to do)
#
# Required env:
#   GL_TOKEN, CI_API_V4_URL, CI_PROJECT_ID, CI_MERGE_REQUEST_IID, CI_PIPELINE_ID
#
# Optional env:
#   CI_WAIT_TIMEOUT  — seconds, default 900
#   CI_WAIT_INTERVAL — seconds between polls, default 30
#
# Note: we deliberately ignore the *current* pipeline (CI_PIPELINE_ID) when
# scanning, because that's the auto-fix pipeline itself. We want to wait for
# the build/test pipeline triggered by the auto-fix push.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../_common.sh"

require_env GL_TOKEN CI_API_V4_URL CI_PROJECT_ID CI_MERGE_REQUEST_IID

TIMEOUT="${CI_WAIT_TIMEOUT:-900}"
INTERVAL="${CI_WAIT_INTERVAL:-30}"
SELF_PIPELINE_ID="${CI_PIPELINE_ID:-0}"

if ! validate_numeric "$TIMEOUT" "CI_WAIT_TIMEOUT"; then
  warn "Invalid CI_WAIT_TIMEOUT, defaulting to 900"
  TIMEOUT=900
fi
if ! validate_numeric "$INTERVAL" "CI_WAIT_INTERVAL"; then
  warn "Invalid CI_WAIT_INTERVAL, defaulting to 30"
  INTERVAL=30
fi

MR_IID="$CI_MERGE_REQUEST_IID"
ELAPSED=0

echo "Polling MR !$MR_IID pipelines (timeout=${TIMEOUT}s, interval=${INTERVAL}s)"
echo "Ignoring self pipeline #$SELF_PIPELINE_ID"

while [ "$ELAPSED" -lt "$TIMEOUT" ]; do
  # /pipelines on the MR endpoint returns most recent first.
  if ! PIPELINES=$(curl -fsS \
        --header "PRIVATE-TOKEN: $GL_TOKEN" \
        "$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests/$MR_IID/pipelines?per_page=20" 2>&1); then
    # Authentication errors should fail fast; transient errors retry.
    if echo "$PIPELINES" | grep -qiE '401|403|unauthorized|forbidden'; then
      error_exit "Auth error polling pipelines: $PIPELINES"
    fi
    warn "Transient error fetching pipelines: $PIPELINES"
    sleep "$INTERVAL"
    ELAPSED=$((ELAPSED + INTERVAL))
    continue
  fi

  # Pick the most recent pipeline that isn't the auto-fix pipeline itself.
  LATEST=$(echo "$PIPELINES" \
    | jq --argjson self "$SELF_PIPELINE_ID" \
         '[.[] | select(.id != $self)] | .[0] // empty')

  if [ -z "$LATEST" ] || [ "$LATEST" = "null" ]; then
    echo "  [${ELAPSED}s] No non-self pipeline yet, waiting..."
    sleep "$INTERVAL"
    ELAPSED=$((ELAPSED + INTERVAL))
    continue
  fi

  STATUS=$(echo "$LATEST" | jq -r '.status')
  PID=$(echo "$LATEST" | jq -r '.id')

  case "$STATUS" in
    success)
      echo "Pipeline #$PID succeeded after ${ELAPSED}s."
      exit 0
      ;;
    failed|canceled|skipped)
      echo "Pipeline #$PID ended with status '$STATUS' after ${ELAPSED}s."
      exit 1
      ;;
    *)
      # running, pending, created, manual, scheduled, preparing, waiting_for_resource
      echo "  [${ELAPSED}s/${TIMEOUT}s] Pipeline #$PID status=$STATUS"
      sleep "$INTERVAL"
      ELAPSED=$((ELAPSED + INTERVAL))
      ;;
  esac
done

warn "CI wait timed out after ${TIMEOUT}s."
exit 2
