#!/usr/bin/env bash
# classify-decision.sh — Read review.json from claude-review and propagate the
# final decision to downstream jobs via a `dotenv` artifact (review.env).
#
# Business overrides (Claude can suggest auto_fix but we still demote it to
# escalate when any of these is true):
#   - confidence  < CLAUDE_CONFIDENCE_THRESHOLD (default 80)
#   - diff_lines  > CLAUDE_AUTO_FIX_MAX_LINES   (default 200)
#   - safety_level != "safe"
#
# After classification we post a one-liner comment on the MR for visibility.
#
# Required env:
#   GL_TOKEN, CI_API_V4_URL, CI_PROJECT_ID, CI_MERGE_REQUEST_IID
#
# Outputs:
#   review.env — dotenv artifact (DECISION, CONFIDENCE, SAFETY_LEVEL, DIFF_LINES)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../_common.sh"

require_env GL_TOKEN CI_API_V4_URL CI_PROJECT_ID CI_MERGE_REQUEST_IID

[ -f review.json ] || error_exit "review.json missing — claude-review must run first."

THRESHOLD="${CLAUDE_CONFIDENCE_THRESHOLD:-80}"
MAX_LINES="${CLAUDE_AUTO_FIX_MAX_LINES:-200}"

DECISION=$(jq -r '.decision // "escalate"' review.json)
CONFIDENCE=$(jq -r '.confidence // 0' review.json)
SAFETY=$(jq -r '.safety_level // "risky"' review.json)
DIFF_LINES=$(jq -r '.diff_lines // 0' review.json)

# Defensive: coerce non-numeric to 0.
validate_numeric "$CONFIDENCE" "confidence" || CONFIDENCE=0
validate_numeric "$DIFF_LINES" "diff_lines" || DIFF_LINES=0

REASON=""
if [ "$DECISION" = "auto_fix" ]; then
  if [ "$CONFIDENCE" -lt "$THRESHOLD" ]; then
    DECISION="escalate"
    REASON="confidence $CONFIDENCE < $THRESHOLD"
  elif [ "$DIFF_LINES" -gt "$MAX_LINES" ]; then
    DECISION="escalate"
    REASON="diff_lines $DIFF_LINES > $MAX_LINES"
  elif [ "$SAFETY" != "safe" ]; then
    DECISION="escalate"
    REASON="safety_level=$SAFETY"
  fi
fi

if [ "$DECISION" != "auto_fix" ] && [ "$DECISION" != "escalate" ] && [ "$DECISION" != "no_action" ]; then
  warn "Unknown decision '$DECISION', defaulting to escalate."
  DECISION="escalate"
fi

# Persist as dotenv for downstream jobs.
{
  echo "DECISION=$DECISION"
  echo "CONFIDENCE=$CONFIDENCE"
  echo "SAFETY_LEVEL=$SAFETY"
  echo "DIFF_LINES=$DIFF_LINES"
} > review.env

echo "Classification: DECISION=$DECISION CONFIDENCE=$CONFIDENCE SAFETY=$SAFETY DIFF_LINES=$DIFF_LINES"
[ -n "$REASON" ] && echo "Override reason: $REASON"

# Post a short comment so humans can see what Claude decided.
COMMENT=$(printf 'Claude review: decision=`%s`, confidence=`%s`, safety=`%s`, diff_lines=`%s`%s' \
  "$DECISION" "$CONFIDENCE" "$SAFETY" "$DIFF_LINES" \
  "${REASON:+ (override: $REASON)}")
PAYLOAD=$(jq -n --arg body "$COMMENT" '{body: $body}')

curl -fsS -o /dev/null \
  --header "PRIVATE-TOKEN: $GL_TOKEN" \
  --header "Content-Type: application/json" \
  --data "$PAYLOAD" \
  "$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests/$CI_MERGE_REQUEST_IID/notes" \
  || warn "Failed to post classification comment (continuing)."

exit 0
