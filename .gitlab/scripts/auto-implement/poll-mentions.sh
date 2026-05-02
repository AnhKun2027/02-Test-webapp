#!/usr/bin/env bash
# Mention Poll — quét @claude mention trong issues + MRs gần đây và xử lý
#
# Đối ứng GitHub claude.yml job "claude":
#   if: github.actor == inputs.allowed_user && (
#     issue_comment / pr_review_comment / issue body / review body
#     startsWith '@claude'
#   )
#
# GitLab không có webhook để chạy workflow theo comment trigger trong CI gốc,
# nên ta poll qua schedule. Mỗi N phút quét issues + MRs cập nhật gần đây,
# tìm comment có `@claude` chưa xử lý, gọi Claude trả lời.
#
# Anti-duplicate: bot reply có marker HTML comment <!-- claude-mention-processed -->
# để lần sau bỏ qua. Marker được nhúng vào reply note kèm reference tới
# note_id gốc đã xử lý, đảm bảo idempotent.
#
# Required env vars:
#   GL_TOKEN                — GitLab personal access token (api scope)
#   CLAUDE_CODE_OAUTH_TOKEN — Claude Max OAuth token
#   ALLOWED_USERS           — comma-separated allowlist (vd "an145,AnhKun2027")
#   CI_PROJECT_ID           — injected by GitLab CI
#   CI_API_V4_URL           — injected by GitLab CI
#   CI_PROJECT_PATH         — injected by GitLab CI
#
# Optional env vars:
#   POLL_WINDOW_MINUTES — cửa sổ quét (default 10)
#   BOT_NAME            — tên bot (default "claude-bot")
#   BOT_DISPLAY_NAME    — tên hiển thị (default "Claude Code")

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../_common.sh"

require_env GL_TOKEN CLAUDE_CODE_OAUTH_TOKEN ALLOWED_USERS \
            CI_PROJECT_ID CI_API_V4_URL CI_PROJECT_PATH

POLL_WINDOW_MINUTES="${POLL_WINDOW_MINUTES:-10}"
BOT_NAME="${BOT_NAME:-claude-bot}"
BOT_DISPLAY_NAME="${BOT_DISPLAY_NAME:-Claude Code}"
PROCESSED_MARKER="<!-- claude-mention-processed -->"

# Cross-platform UTC timestamp N minutes ago (GNU date vs BSD date)
SINCE=$(date -u -d "${POLL_WINDOW_MINUTES} minutes ago" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
  || date -u -v-"${POLL_WINDOW_MINUTES}"M +%Y-%m-%dT%H:%M:%SZ)

echo "Polling @claude mentions since $SINCE (window: ${POLL_WINDOW_MINUTES}m)"
echo "Bot identity: ${BOT_DISPLAY_NAME} (${BOT_NAME})"

PROCESSED_COUNT=0
SKIPPED_COUNT=0

# ---------------------------------------------------------------------------
# Hàm phụ: kiểm tra user nằm trong ALLOWED_USERS
# ---------------------------------------------------------------------------
is_allowed_user() {
  local user="$1"
  echo ",${ALLOWED_USERS}," | grep -q ",${user},"
}

# ---------------------------------------------------------------------------
# Hàm phụ: kiểm tra một note đã được Claude reply (xét trong cùng resource)
# Input: $1 = JSON array notes, $2 = note_id gốc
# Logic: nếu trong toàn bộ notes có note nào do BOT_NAME tạo và body chứa
#        marker + reference "note:<id>" thì đã xử lý.
# ---------------------------------------------------------------------------
already_processed() {
  local notes_json="$1"
  local note_id="$2"
  echo "$notes_json" | jq -e --arg uname "$BOT_NAME" --arg nid "$note_id" '
    [.[] | select(.author.username == $uname)
         | select(.body | contains("'"$PROCESSED_MARKER"'"))
         | select(.body | contains("note:" + $nid))
    ] | length > 0
  ' > /dev/null 2>&1
}

# ---------------------------------------------------------------------------
# Hàm phụ: post reply có marker
# Args: $1 resource_type ("merge_requests"|"issues"), $2 iid, $3 source_note_id, $4 reply_body
# ---------------------------------------------------------------------------
post_reply() {
  local resource="$1"
  local iid="$2"
  local source_note_id="$3"
  local body="$4"

  # Marker chứa note:<id> để link reply <-> source note (tránh re-process)
  local full_body
  full_body=$(printf '%s\n\n%s note:%s' \
    "$body" "$PROCESSED_MARKER" "$source_note_id")

  local payload
  payload=$(jq -n --arg b "$full_body" '{body: $b}')

  curl -fsS --request POST \
    --header "PRIVATE-TOKEN: $GL_TOKEN" \
    --header "Content-Type: application/json" \
    --data "$payload" \
    "$CI_API_V4_URL/projects/$CI_PROJECT_ID/${resource}/${iid}/notes" > /dev/null
}

# ---------------------------------------------------------------------------
# Hàm phụ: gọi Claude xử lý mention, in stdout response
# Args: $1 resource_label ("MR"/"Issue"), $2 iid, $3 url, $4 author, $5 mention_body
# ---------------------------------------------------------------------------
run_claude_for_mention() {
  local label="$1"
  local iid="$2"
  local url="$3"
  local author="$4"
  local mention="$5"

  local context
  context=$(printf '%s #%s by @%s\nURL: %s\n\nMention body:\n%s' \
    "$label" "$iid" "$author" "$url" "$mention")

  # Output đi vào stdout, caller capture để post reply
  CLAUDE_CODE_OAUTH_TOKEN="$CLAUDE_CODE_OAUTH_TOKEN" claude \
    --allowedTools "Bash(glab:*),Bash(git:*),Read,Edit,Write,Glob,Grep" \
    --permission-mode acceptEdits \
    --max-turns 30 \
    --output-format text \
    -p "$(cat <<PROMPT
You are ${BOT_DISPLAY_NAME} responding to a @claude mention in GitLab project ${CI_PROJECT_PATH}.

${context}

Respond concisely to the user's request in the mention. If they asked a question,
answer it. If they requested a change, explain what you would do (do NOT push code
in this poll job — that is handled by auto-implement). Reply in markdown, do not
include the @mention again, do not include any HTML comments in your reply.
PROMPT
    )" 2>&1 || echo "(Claude failed to generate a response. Please retry.)"
}

# ---------------------------------------------------------------------------
# Hàm phụ: xử lý 1 resource (MR hoặc Issue)
# Args: $1 resource_type ("merge_requests"|"issues"), $2 iid, $3 web_url
# ---------------------------------------------------------------------------
process_resource() {
  local resource="$1"
  local iid="$2"
  local web_url="$3"
  local label
  if [ "$resource" = "merge_requests" ]; then label="MR"; else label="Issue"; fi

  local notes
  notes=$(curl -fsS --header "PRIVATE-TOKEN: $GL_TOKEN" \
    "$CI_API_V4_URL/projects/$CI_PROJECT_ID/${resource}/${iid}/notes?per_page=100&sort=desc&order_by=updated_at") \
    || { warn "Failed to fetch notes for ${label} #${iid}"; return; }

  # Lọc: comment có @claude (case-insensitive), không phải bot tạo,
  # không chứa marker (tự exclude bot reply cũ).
  # Process substitution thay vì pipe -> giữ counter ở shell cha.
  while IFS= read -r NOTE; do
    [ -z "$NOTE" ] && continue

    local note_id author body
    note_id=$(echo "$NOTE" | jq -r '.id')
    author=$(echo "$NOTE" | jq -r '.author.username')
    body=$(echo "$NOTE" | jq -r '.body')

    if ! is_allowed_user "$author"; then
      echo "  - Skip note ${note_id}: user '${author}' not in ALLOWED_USERS"
      SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
      continue
    fi

    if already_processed "$notes" "$note_id"; then
      echo "  - Skip note ${note_id}: already processed (marker found)"
      SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
      continue
    fi

    echo "  - Processing ${label} #${iid} note ${note_id} from @${author}"

    local response
    response=$(run_claude_for_mention "$label" "$iid" "$web_url" "$author" "$body")

    if post_reply "$resource" "$iid" "$note_id" "$response"; then
      PROCESSED_COUNT=$((PROCESSED_COUNT + 1))
      echo "    OK: replied to note ${note_id}"
    else
      warn "Failed to post reply for ${label} #${iid} note ${note_id}"
    fi
  done < <(echo "$notes" | jq -c --arg uname "$BOT_NAME" '
    .[]
    | select(.system == false)
    | select(.author.username != $uname)
    | select(.body | test("@claude"; "i"))
    | select(.body | contains("'"$PROCESSED_MARKER"'") | not)
  ')
}

# ---------------------------------------------------------------------------
# 1. Quét MRs cập nhật trong cửa sổ
# ---------------------------------------------------------------------------
echo ""
echo "=== Scanning merge requests ==="
MRS=$(curl -fsS --header "PRIVATE-TOKEN: $GL_TOKEN" \
  "$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests?updated_after=${SINCE}&state=opened&per_page=20") \
  || error_exit "Failed to fetch merge requests"

MR_COUNT=$(echo "$MRS" | jq 'length')
echo "Found ${MR_COUNT} MR(s) updated since ${SINCE}"

while IFS= read -r MR; do
  [ -z "$MR" ] && continue
  iid=$(echo "$MR" | jq -r '.iid')
  url=$(echo "$MR" | jq -r '.web_url')
  echo "MR #${iid}: ${url}"
  process_resource "merge_requests" "$iid" "$url"
done < <(echo "$MRS" | jq -c '.[]')

# ---------------------------------------------------------------------------
# 2. Quét Issues cập nhật trong cửa sổ
# ---------------------------------------------------------------------------
echo ""
echo "=== Scanning issues ==="
ISSUES=$(curl -fsS --header "PRIVATE-TOKEN: $GL_TOKEN" \
  "$CI_API_V4_URL/projects/$CI_PROJECT_ID/issues?updated_after=${SINCE}&state=opened&per_page=20") \
  || error_exit "Failed to fetch issues"

ISSUE_COUNT=$(echo "$ISSUES" | jq 'length')
echo "Found ${ISSUE_COUNT} issue(s) updated since ${SINCE}"

while IFS= read -r ISSUE; do
  [ -z "$ISSUE" ] && continue
  iid=$(echo "$ISSUE" | jq -r '.iid')
  url=$(echo "$ISSUE" | jq -r '.web_url')
  echo "Issue #${iid}: ${url}"
  process_resource "issues" "$iid" "$url"
done < <(echo "$ISSUES" | jq -c '.[]')

# ---------------------------------------------------------------------------
# 3. Summary
# ---------------------------------------------------------------------------
echo ""
echo "=== Mention poll complete ==="
echo "Processed : ${PROCESSED_COUNT}"
echo "Skipped   : ${SKIPPED_COUNT}"
