#!/usr/bin/env bash
# check-forbidden.sh — Detect changed files matching forbidden glob patterns.
#
# Ported from .github/scripts/auto-fix/check-forbidden.sh.
# In the GitLab port the forbidden patterns are hardcoded (no input plumbing
# from a reusable workflow) and we read the changed file list from the MR
# changes endpoint via REST API.
#
# Required env:
#   GL_TOKEN, CI_API_V4_URL, CI_PROJECT_ID, CI_MERGE_REQUEST_IID
#
# Optional env:
#   FORBIDDEN_PATTERNS — newline-separated globs. Defaults to a sensible set
#                        of secret-bearing files. Set to empty to disable.
#
# Outputs:
#   forbidden_files.txt — list of matching files (one per line). Empty file
#                         means "no match".
#
# Exit codes:
#   0 — no forbidden file changed (caller may continue to merge)
#   1 — at least one forbidden file changed (caller must skip merge)
#
# Security note: API errors here are treated as fatal (exit 1) so an attacker
# cannot bypass the check by triggering a transient API failure.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../_common.sh"

require_env GL_TOKEN CI_API_V4_URL CI_PROJECT_ID CI_MERGE_REQUEST_IID

# Default forbidden patterns. Override via FORBIDDEN_PATTERNS env (newline-separated).
DEFAULT_PATTERNS='.env*
*.lock
secrets/*
credentials*
*.pem
*.key'

PATTERNS="${FORBIDDEN_PATTERNS:-$DEFAULT_PATTERNS}"

# Empty patterns -> nothing forbidden, exit success quickly.
if [ -z "$PATTERNS" ]; then
  echo "No forbidden patterns configured."
  : > forbidden_files.txt
  exit 0
fi

# Fetch changed files from the MR. The /changes endpoint returns each diff
# entry with new_path/old_path; we union both to catch renames.
if ! CHANGES_JSON=$(curl -fsS \
      --header "PRIVATE-TOKEN: $GL_TOKEN" \
      "$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests/$CI_MERGE_REQUEST_IID/changes" 2>&1); then
  error_exit "Failed to fetch MR changes (security-critical): $CHANGES_JSON"
fi

CHANGED_FILES=$(echo "$CHANGES_JSON" \
  | jq -r '.changes[]? | (.new_path, .old_path) | select(. != null and . != "")' \
  | sort -u)

if [ -z "$CHANGED_FILES" ]; then
  echo "No changed files reported."
  : > forbidden_files.txt
  exit 0
fi

# Walk each (file, pattern) pair and use bash's [[ == ]] glob match.
FORBIDDEN_FOUND=""
while IFS= read -r file; do
  [ -z "$file" ] && continue
  while IFS= read -r pattern; do
    [ -z "$pattern" ] && continue
    # shellcheck disable=SC2053  # intentional unquoted glob match
    if [[ "$file" == $pattern ]]; then
      FORBIDDEN_FOUND="${FORBIDDEN_FOUND}${file}"$'\n'
      break
    fi
  done <<< "$PATTERNS"
done <<< "$CHANGED_FILES"

if [ -n "$FORBIDDEN_FOUND" ]; then
  printf '%s' "$FORBIDDEN_FOUND" > forbidden_files.txt
  echo "Forbidden patterns matched:"
  printf '  - %s\n' $FORBIDDEN_FOUND
  exit 1
fi

: > forbidden_files.txt
echo "No forbidden patterns matched."
exit 0
