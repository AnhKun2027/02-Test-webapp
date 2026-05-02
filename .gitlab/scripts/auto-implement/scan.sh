#!/usr/bin/env bash
# Auto-implement Scanner — polls issues with "auto-implement" label and runs Claude for each
#
# Flow:
#   1. Find open issues with label "auto-implement"
#   2. Swap label → "auto:in-progress" (prevents duplicate runs)
#   3. Run Claude: create branch, implement, push, open MR
#   4. On success: label → "auto:pipeline"
#      On failure: label → "auto:failed"
#
# Required env vars:
#   GL_TOKEN              — GitLab personal access token (api scope)
#   CLAUDE_CODE_OAUTH_TOKEN — Claude Max OAuth token
#   CI_PROJECT_ID         — injected by GitLab CI
#   CI_API_V4_URL         — injected by GitLab CI
#   CI_PROJECT_PATH       — injected by GitLab CI
#   CI_SERVER_HOST        — injected by GitLab CI

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../_common.sh"

require_env GL_TOKEN CLAUDE_CODE_OAUTH_TOKEN CI_PROJECT_ID CI_API_V4_URL CI_PROJECT_PATH CI_SERVER_HOST

# Bot identity (parameterizable, đối ứng GitHub bot_name / bot_id)
BOT_NAME="${BOT_NAME:-claude-bot}"
BOT_DISPLAY_NAME="${BOT_DISPLAY_NAME:-Claude Code}"

# ---------------------------------------------------------------------------
# 1. Fetch open issues with "auto-implement" label
# ---------------------------------------------------------------------------
echo "Scanning for issues with 'auto-implement' label (excluding 'auto:failed')..."

# not[labels]=auto:failed: bỏ qua issue đã fail trước đó (đối ứng GitHub: !contains(labels, 'auto:failed'))
ISSUES_JSON=""
if ! ISSUES_JSON=$(gitlab_api GET "/issues?labels=auto-implement&not\[labels\]=auto:failed&state=opened&per_page=20" 2>&1); then
  if echo "$ISSUES_JSON" | grep -qiE '(401|403|Unauthorized|Forbidden)'; then
    error_exit "Authentication/permission error: $ISSUES_JSON"
  fi
  error_exit "Failed to fetch issues: $ISSUES_JSON"
fi

ISSUE_COUNT=$(echo "$ISSUES_JSON" | jq 'length')
echo "Found $ISSUE_COUNT issue(s) with 'auto-implement' label"

if [ "$ISSUE_COUNT" -eq 0 ]; then
  echo "Nothing to do. Exiting."
  exit 0
fi

# ---------------------------------------------------------------------------
# 2. Process each issue
# ---------------------------------------------------------------------------
SUCCESS_COUNT=0
FAIL_COUNT=0

while IFS= read -r ISSUE; do
  [ -z "$ISSUE" ] && continue

  ISSUE_IID=$(echo "$ISSUE" | jq -r '.iid')
  ISSUE_TITLE=$(echo "$ISSUE" | jq -r '.title')
  ISSUE_BODY=$(echo "$ISSUE" | jq -r '.description // ""')
  ISSUE_URL=$(echo "$ISSUE" | jq -r '.web_url')

  echo ""
  echo "=== Issue #${ISSUE_IID}: ${ISSUE_TITLE} ==="

  # Swap label: auto-implement → auto:in-progress (lock to prevent duplicate runs)
  if ! gitlab_api PUT "/issues/${ISSUE_IID}" \
    -d '{"add_labels":"auto:in-progress","remove_labels":"auto-implement"}' > /dev/null 2>&1; then
    warn "Failed to update labels for issue #${ISSUE_IID}. Skipping."
    continue
  fi
  echo "Marked #${ISSUE_IID} as auto:in-progress"

  BRANCH_NAME="auto/issue-${ISSUE_IID}-$(date +%Y%m%d-%H%M%S)"

  # Run Claude to implement the issue
  # Build user-controlled content separately to avoid heredoc injection
  ISSUE_CONTENT=$(printf 'Issue #%s: %s\nURL: %s\n\nDescription:\n%s' \
    "$ISSUE_IID" "$ISSUE_TITLE" "$ISSUE_URL" "$ISSUE_BODY")

  set +e
  CLAUDE_CODE_OAUTH_TOKEN="$CLAUDE_CODE_OAUTH_TOKEN" claude \
    --allowedTools "Bash(glab:*),Bash(git:*),Bash(npm:*),Bash(npx:*),Bash(node:*),Bash(shellcheck:*),Bash(markdownlint-cli2:*),Read,Edit,Write,Glob,Grep,Task" \
    --permission-mode acceptEdits \
    --max-turns 100 \
    --verbose \
    --output-format stream-json \
    -p "$(cat <<PROMPT
You are ${BOT_DISPLAY_NAME} running inside a GitLab CI job for project ${CI_PROJECT_PATH}.
Your task is to implement the following GitLab issue.

${ISSUE_CONTENT}

IMPORTANT: Read .claude/CLAUDE-auto-progress.md FIRST and follow the 4-step quality
gate process defined there. The agents (test-runner, code-reviewer, doc-reviewer)
are available in .claude/agents/ — invoke them via the Task tool.

Step-by-step instructions:
1. Read .claude/CLAUDE-auto-progress.md to understand the workflow rules
2. Create branch: git checkout -b ${BRANCH_NAME}
3. Read the codebase and understand the context before implementing
4. Implement everything described in the issue description
5. Run quality gates (per CLAUDE-auto-progress.md):
   - Step 1/4: Task(subagent_type="test-runner") — run tests/lint
   - Step 2/4: Task(subagent_type="code-reviewer") — review the diff
   - Step 3/4: Task(subagent_type="doc-reviewer") — review docs
   - Step 4/4: commit + push + create MR
6. Commit: git add -A && git commit -m "feat: implement #${ISSUE_IID} - ${ISSUE_TITLE}"
7. Push: git push origin ${BRANCH_NAME}
8. Open MR: glab mr create --target-branch main \
     --title "feat: ${ISSUE_TITLE}" \
     --description "Closes #${ISSUE_IID}" \
     --label "auto:pipeline"

Use glab CLI for GitLab operations (already authenticated).
Summarize what you did and include the MR URL when done.
PROMPT
    )"
  CLAUDE_EXIT=$?
  set -e

  if [ "$CLAUDE_EXIT" -eq 0 ]; then
    echo "✅ Issue #${ISSUE_IID} implemented successfully"
    gitlab_api PUT "/issues/${ISSUE_IID}" \
      -d '{"add_labels":"auto:pipeline","remove_labels":"auto:in-progress"}' > /dev/null 2>&1 || \
      warn "Failed to update labels after success for #${ISSUE_IID}"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  else
    echo "❌ Failed to implement issue #${ISSUE_IID} (claude exit: $CLAUDE_EXIT)"
    gitlab_api PUT "/issues/${ISSUE_IID}" \
      -d '{"add_labels":"auto:failed","remove_labels":"auto:in-progress"}' > /dev/null 2>&1 || \
      warn "Failed to update labels after failure for #${ISSUE_IID}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi

done < <(echo "$ISSUES_JSON" | jq -c '.[]')

# ---------------------------------------------------------------------------
# 3. Summary
# ---------------------------------------------------------------------------
echo ""
echo "=== Auto-implement complete ==="
echo "Succeeded : $SUCCESS_COUNT"
echo "Failed    : $FAIL_COUNT"

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
