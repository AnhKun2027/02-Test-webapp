#!/usr/bin/env bash
# Poll the MR discussions until Duo posts at least one new review discussion.
#
# Option-2 flow: Duo is asked to REVIEW only (no fix). As soon as Duo's review
# comments land, we exit 0 so the next job (claude-apply-fix.sh with_guidance)
# can read those comments and apply fixes.
#
# Strategy:
#   - Record baseline discussion count before waiting.
#   - Every DUO_POLL_INTERVAL seconds, fetch discussions and check if any
#     new resolvable thread was authored by a bot user (Duo).
#   - Exit 0 when Duo has reviewed, or when timeout reached (still 0 to allow
#     downstream jobs to proceed with whatever guidance is available).
#
# Required env:
#   GL_TOKEN, CI_API_V4_URL, CI_PROJECT_ID, CI_MERGE_REQUEST_IID,
#   DUO_REVIEW_TIMEOUT, DUO_POLL_INTERVAL

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../_common.sh"

require_env GL_TOKEN CI_API_V4_URL CI_PROJECT_ID CI_MERGE_REQUEST_IID

TIMEOUT="${DUO_REVIEW_TIMEOUT:-900}"
INTERVAL="${DUO_POLL_INTERVAL:-30}"
MR_IID="$CI_MERGE_REQUEST_IID"

fetch_discussions() {
  curl -sS \
    --header "PRIVATE-TOKEN: $GL_TOKEN" \
    "$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests/$MR_IID/discussions?per_page=100"
}

# Baseline count of resolvable discussions before we requested Duo.
BASELINE=$(fetch_discussions \
  | jq '[.[] | select(.notes[0].resolvable == true)] | length')

echo "Baseline resolvable discussions: $BASELINE"
echo "Waiting up to ${TIMEOUT}s for Duo Code Review to post discussions..."

ELAPSED=0
while [ "$ELAPSED" -lt "$TIMEOUT" ]; do
  sleep "$INTERVAL"
  ELAPSED=$((ELAPSED + INTERVAL))

  CURRENT=$(fetch_discussions \
    | jq '[.[] | select(.notes[0].resolvable == true and (.notes[0].author.username | test("duo|bot"; "i")))] | length' 2>/dev/null || echo "0")

  if [ "$CURRENT" -gt "$BASELINE" ]; then
    NEW=$((CURRENT - BASELINE))
    echo "Duo posted $NEW new review discussion(s) after ${ELAPSED}s."
    exit 0
  fi

  echo "  [${ELAPSED}s/${TIMEOUT}s] Still waiting... (current Duo discussions: $CURRENT)"
done

warn "Timeout reached after ${TIMEOUT}s. Proceeding without confirmed Duo review."
exit 0
