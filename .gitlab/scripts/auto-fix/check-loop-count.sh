#!/usr/bin/env bash
# check-loop-count.sh — Track and cap the number of auto-fix iterations on a MR.
#
# Marker comments are HTML-style hidden tags posted on the MR (kind:
# `<!-- auto-fix-loop-N -->`). On each run we:
#   1. Count existing markers.
#   2. If count >= MAX_LOOP_COUNT, post a warning and exit 1.
#   3. Otherwise post a fresh marker (count + 1) and continue (exit 0).
#
# Required env:
#   GL_TOKEN, CI_API_V4_URL, CI_PROJECT_ID, CI_MERGE_REQUEST_IID
#
# Optional env:
#   MAX_LOOP_COUNT — integer, default 3. When the existing marker count
#                    reaches this value we stop the loop.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../_common.sh"

require_env GL_TOKEN CI_API_V4_URL CI_PROJECT_ID CI_MERGE_REQUEST_IID

MAX="${MAX_LOOP_COUNT:-3}"
if ! validate_numeric "$MAX" "MAX_LOOP_COUNT"; then
  warn "Invalid MAX_LOOP_COUNT=$MAX, falling back to 3"
  MAX=3
fi

MR_IID="$CI_MERGE_REQUEST_IID"
MARKER_RE='<!-- auto-fix-loop-([0-9]+) -->'

# Fetch all notes (paginated). The MR API caps page_size at 100; we follow
# x-next-page header until exhausted to support long discussions.
NOTES_JSON='[]'
PAGE=1
while :; do
  if ! PAGE_JSON=$(curl -fsS \
        --header "PRIVATE-TOKEN: $GL_TOKEN" \
        "$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests/$MR_IID/notes?per_page=100&page=$PAGE" 2>&1); then
    warn "Failed to fetch MR notes (page $PAGE), defaulting loop count to 0: $PAGE_JSON"
    PAGE_JSON='[]'
    break
  fi
  COUNT=$(echo "$PAGE_JSON" | jq 'length')
  NOTES_JSON=$(jq -s 'add' <(echo "$NOTES_JSON") <(echo "$PAGE_JSON"))
  if [ "$COUNT" -lt 100 ]; then
    break
  fi
  PAGE=$((PAGE + 1))
  # Cap pagination defensively to avoid runaway loops on broken APIs.
  if [ "$PAGE" -gt 20 ]; then
    warn "Stopping note pagination at page 20"
    break
  fi
done

# Count markers in note bodies. grep -c matches lines, but a single body may
# legitimately contain multiple markers — we use grep -oE then wc -l for accuracy.
LOOP_COUNT=$(echo "$NOTES_JSON" \
  | jq -r '.[].body // empty' \
  | grep -oE "$MARKER_RE" \
  | wc -l \
  | tr -d ' ')

if ! validate_numeric "$LOOP_COUNT" "loop count"; then
  LOOP_COUNT=0
fi

echo "Current auto-fix loop count: $LOOP_COUNT (limit: $MAX)"

if [ "$LOOP_COUNT" -ge "$MAX" ]; then
  echo "Loop limit reached. Posting warning comment and aborting."
  WARN_BODY=$(cat <<EOF
## auto-fix: loop limit reached

Auto-fix has already run **${LOOP_COUNT}** time(s) on this MR (limit: ${MAX}).
Stopping to prevent infinite retry. Please review the remaining issues manually
and either fix them or close the MR.

*Pipeline #${CI_PIPELINE_ID:-?} · ${CI_PIPELINE_URL:-}*
EOF
)
  PAYLOAD=$(jq -n --arg body "$WARN_BODY" '{body: $body}')
  curl -fsS -o /dev/null \
    --header "PRIVATE-TOKEN: $GL_TOKEN" \
    --header "Content-Type: application/json" \
    --data "$PAYLOAD" \
    "$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests/$MR_IID/notes" \
    || warn "Failed to post loop-limit comment"
  exit 1
fi

# Post a new marker comment for this run. The marker is the only required
# content — humans see the "auto-fix iteration N" prefix as informative text.
NEW_N=$((LOOP_COUNT + 1))
MARKER_BODY=$(cat <<EOF
<!-- auto-fix-loop-${NEW_N} -->
auto-fix iteration **${NEW_N}/${MAX}** started (pipeline #${CI_PIPELINE_ID:-?}).
EOF
)
PAYLOAD=$(jq -n --arg body "$MARKER_BODY" '{body: $body}')
curl -fsS -o /dev/null \
  --header "PRIVATE-TOKEN: $GL_TOKEN" \
  --header "Content-Type: application/json" \
  --data "$PAYLOAD" \
  "$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests/$MR_IID/notes" \
  || warn "Failed to post loop marker comment (continuing anyway)"

echo "Posted loop marker $NEW_N/$MAX. Continuing pipeline."
exit 0
