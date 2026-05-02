#!/usr/bin/env bash
# claude-apply-fix.sh — Invoke Claude Code to apply fixes to the MR source
# branch. Reusable for two modes:
#
#   MODE=auto_fix        — Claude review confidence is high; apply directly.
#   MODE=with_guidance   — Claude must also incorporate the latest review
#                          comments from GitLab Duo (escalation path).
#
# Required env:
#   GL_TOKEN, CI_API_V4_URL, CI_PROJECT_ID, CI_MERGE_REQUEST_IID,
#   CLAUDE_CODE_OAUTH_TOKEN,
#   CI_MERGE_REQUEST_SOURCE_BRANCH_NAME, CI_REPOSITORY_URL, CI_PROJECT_DIR
#
# Outputs:
#   git commits pushed to source branch (one or more), plus a status comment
#   on the MR.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../_common.sh"

require_env GL_TOKEN CI_API_V4_URL CI_PROJECT_ID CI_MERGE_REQUEST_IID \
            CLAUDE_CODE_OAUTH_TOKEN CI_MERGE_REQUEST_SOURCE_BRANCH_NAME

MODE="${1:-auto_fix}"
case "$MODE" in
  auto_fix|with_guidance) ;;
  *) error_exit "Invalid MODE='$MODE' (expected auto_fix|with_guidance)" ;;
esac

MR_IID="$CI_MERGE_REQUEST_IID"
SRC_BRANCH="$CI_MERGE_REQUEST_SOURCE_BRANCH_NAME"

[ -f review.json ] || error_exit "review.json missing — claude-review must run first."

# Fetch unresolved threads (input to fixer).
if ! DISCUSSIONS=$(curl -fsS \
      --header "PRIVATE-TOKEN: $GL_TOKEN" \
      "$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests/$MR_IID/discussions?per_page=100" 2>&1); then
  error_exit "Failed to fetch discussions: $DISCUSSIONS"
fi

THREADS_JSON=$(echo "$DISCUSSIONS" \
  | jq '[.[] | select(.notes[0].resolvable == true and .notes[0].resolved == false)
        | {id: .id, author: .notes[0].author.username, body: .notes[0].body,
           file: (.notes[0].position.new_path // null),
           line: (.notes[0].position.new_line // null)}]')

# In with_guidance mode, also pull Duo's notes (author matches /duo|bot/i).
DUO_NOTES_JSON='[]'
if [ "$MODE" = "with_guidance" ]; then
  if ! NOTES=$(curl -fsS \
        --header "PRIVATE-TOKEN: $GL_TOKEN" \
        "$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests/$MR_IID/notes?per_page=100" 2>&1); then
    warn "Failed to fetch MR notes: $NOTES"
  else
    DUO_NOTES_JSON=$(echo "$NOTES" \
      | jq '[.[] | select(.author.username | test("duo|bot"; "i"))
            | {id: .id, author: .author.username, body: .body, created_at: .created_at}]')
  fi
fi

REVIEW_JSON=$(cat review.json)

PROMPT_HEADER='You are a senior engineer applying review fixes to a merge request.

Constraints:
- Apply MINIMAL changes that address each item.
- NEVER touch forbidden files: .env*, secrets/*, *.lock, *.pem, *.key, credentials*.
- Use one commit per logical fix with message: "fix(review): <short description>".
- Keep changes scoped to files mentioned by reviewers; do not refactor unrelated code.
- After applying changes, summarize what you did in 3-5 bullet points.

Workflow:
1. Read the unresolved threads, the structured review JSON, and (if present)
   the senior reviewer (Duo) feedback.
2. Edit the necessary files in the working tree.
3. Stage and commit each fix using git, then stop. CI will push.
'

PROMPT=$({
  printf '%s\n' "$PROMPT_HEADER"
  printf '\n=== Mode ===\n%s\n' "$MODE"
  printf '\n=== Claude review summary ===\n%s\n' "$REVIEW_JSON"
  printf '\n=== Unresolved review threads ===\n%s\n' "$THREADS_JSON"
  if [ "$MODE" = "with_guidance" ]; then
    printf '\n=== Senior reviewer (Duo) feedback ===\n%s\n' "$DUO_NOTES_JSON"
  fi
})

# Configure git so commits land on the MR source branch.
git config user.email "claude-bot@ci.local"
git config user.name  "Claude Auto-Fix"

# Make sure we are on the source branch (CI checks out a detached HEAD by
# default for MR pipelines).
git fetch origin "$SRC_BRANCH" --depth=50 || true
git checkout -B "$SRC_BRANCH" "origin/$SRC_BRANCH" || git checkout "$SRC_BRANCH"

echo "Invoking Claude Code (mode=$MODE)..."
# C1 fix: --print mode defaults to read-only. Must explicitly grant Edit/Write/git
# permissions, otherwise Claude aborts when it tries to modify files.
# Source: https://code.claude.com/docs/en/headless
if ! CLAUDE_OUTPUT=$(printf '%s' "$PROMPT" | claude --print \
      --allowedTools "Read,Edit,Write,Glob,Grep,Bash(git:*),Bash(glab:*),Bash(npm:*),Bash(node:*),Task" \
      --permission-mode acceptEdits \
      --max-turns 50 \
      2>&1); then
  warn "Claude CLI returned non-zero. Output:"
  printf '%s\n' "$CLAUDE_OUTPUT" >&2
  error_exit "claude --print failed"
fi

printf '%s\n' "$CLAUDE_OUTPUT"

# If Claude already committed via its built-in tools we just push; otherwise
# fall back to staging any working-tree changes it produced.
if git diff --quiet && git diff --cached --quiet \
   && [ "$(git rev-list --count "origin/$SRC_BRANCH..HEAD")" -eq 0 ]; then
  warn "Claude produced no changes and no commits — nothing to push."
else
  if ! git diff --cached --quiet || ! git diff --quiet; then
    git add -A
    git commit -m "fix(review): claude auto-fix (mode=$MODE)"
  fi

  PUSH_URL=$(printf 'https://oauth2:%s@%s' "$GL_TOKEN" \
    "$(echo "$CI_REPOSITORY_URL" | sed -E 's#^https?://[^@]*@##')")
  git push "$PUSH_URL" "HEAD:$SRC_BRANCH"
fi

# Status comment on the MR.
COMMENT=$(printf 'Fixed by Claude (mode=`%s`).\n\n%s' "$MODE" \
  "$(printf '%s' "$CLAUDE_OUTPUT" | tail -n 40)")
PAYLOAD=$(jq -n --arg body "$COMMENT" '{body: $body}')

curl -fsS -o /dev/null \
  --header "PRIVATE-TOKEN: $GL_TOKEN" \
  --header "Content-Type: application/json" \
  --data "$PAYLOAD" \
  "$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests/$MR_IID/notes" \
  || warn "Failed to post fix-applied comment."

exit 0
