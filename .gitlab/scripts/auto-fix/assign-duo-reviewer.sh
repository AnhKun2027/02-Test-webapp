#!/usr/bin/env bash
# Assign GitLab Duo bot as reviewer on the current MR (REVIEW ONLY — Option 2
# escalation path). This script is intentionally narrow: it requests Duo to
# post review comments. It does NOT invoke Duo Agent's fix capability — fixes
# are applied later by Claude in `claude-apply-fix.sh with_guidance`.
#
# Duo Code Review is triggered by mentioning @GitLabDuo in a review request.
# We use the Notes API to post a quick action comment, which is the documented
# way to invoke Duo on demand from CI.
#
# Required env (auto-set in CI):
#   GL_TOKEN, CI_API_V4_URL, CI_PROJECT_ID, CI_MERGE_REQUEST_IID

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../_common.sh"

require_env GL_TOKEN CI_API_V4_URL CI_PROJECT_ID CI_MERGE_REQUEST_IID

MR_IID="$CI_MERGE_REQUEST_IID"
echo "Requesting Duo Code Review on MR !$MR_IID..."

# Post quick action note. GitLab parses /assign_reviewer @GitLabDuo and acts.
NOTE_BODY="/assign_reviewer @GitLabDuo"
PAYLOAD=$(jq -n --arg body "$NOTE_BODY" '{body: $body}')

RESPONSE=$(curl -sS -w '\n%{http_code}' \
  --header "PRIVATE-TOKEN: $GL_TOKEN" \
  --header "Content-Type: application/json" \
  --data "$PAYLOAD" \
  "$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests/$MR_IID/notes")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "201" ]; then
  warn "Failed to post quick action (HTTP $HTTP_CODE): $BODY"
  exit 1
fi

echo "Posted /assign_reviewer @GitLabDuo on MR !$MR_IID"
