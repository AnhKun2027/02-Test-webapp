#!/usr/bin/env bash
# resolve-threads.sh — Mark every still-unresolved review thread on the MR as
# resolved. Used after the fixer (Duo Agent / Claude) has pushed fixes.
#
# Required env:
#   GL_TOKEN, CI_API_V4_URL, CI_PROJECT_ID, CI_MERGE_REQUEST_IID
#
# Behaviour:
#   - Iterates discussions where notes[0].resolvable && !resolved.
#   - Issues PUT /discussions/:id?resolved=true for each.
#   - Auth errors (401/403) abort with exit 1.
#   - Per-thread failures are logged as warnings; if ALL fail we exit 1.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../_common.sh"

require_env GL_TOKEN CI_API_V4_URL CI_PROJECT_ID CI_MERGE_REQUEST_IID

MR_IID="$CI_MERGE_REQUEST_IID"

if ! DISCUSSIONS=$(curl -fsS \
      --header "PRIVATE-TOKEN: $GL_TOKEN" \
      "$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests/$MR_IID/discussions?per_page=100" 2>&1); then
  if echo "$DISCUSSIONS" | grep -qiE '401|403|unauthorized|forbidden'; then
    error_exit "Auth error fetching discussions: $DISCUSSIONS"
  fi
  warn "Transient API error fetching discussions: $DISCUSSIONS"
  exit 0
fi

# Extract IDs of resolvable, unresolved threads.
IDS=$(echo "$DISCUSSIONS" \
  | jq -r '.[] | select(.notes[0].resolvable == true and .notes[0].resolved == false) | .id')

if [ -z "$IDS" ]; then
  echo "No unresolved resolvable threads. Nothing to do."
  exit 0
fi

RESOLVED=0
FAILED=0
while IFS= read -r ID; do
  [ -z "$ID" ] && continue
  if curl -fsS -o /dev/null \
        --header "PRIVATE-TOKEN: $GL_TOKEN" \
        --request PUT \
        "$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests/$MR_IID/discussions/${ID}?resolved=true"; then
    RESOLVED=$((RESOLVED + 1))
  else
    FAILED=$((FAILED + 1))
    warn "Failed to resolve thread $ID"
  fi
done <<< "$IDS"

echo "Resolved: $RESOLVED, Failed: $FAILED"

# All-failures usually means token lacks scope or rate-limit hit -> exit 1.
if [ "$RESOLVED" -eq 0 ] && [ "$FAILED" -gt 0 ]; then
  error_exit "All thread resolutions failed ($FAILED). Check token scope (api, write_repository)."
fi

exit 0
