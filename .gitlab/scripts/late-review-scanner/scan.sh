#!/usr/bin/env bash
# Late Review Scanner — マージ済みMRの未解決レビュースレッドを検出し集約Issueに記録
# Adapted from .github/scripts/late-review-scanner/scan.sh (GitHub → GitLab)
#
# 必須環境変数:
#   GL_TOKEN          — GitLab personal access token (api scope)
#   CI_PROJECT_ID     — GitLab project ID (自動設定)
#   CI_API_V4_URL     — GitLab API base URL (自動設定)
#
# 任意環境変数:
#   SCAN_HOURS        — スキャン範囲（デフォルト: 24）

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../_common.sh"

require_env GL_TOKEN CI_PROJECT_ID CI_API_V4_URL

SCAN_HOURS="${SCAN_HOURS:-24}"
if ! validate_numeric "$SCAN_HOURS" "SCAN_HOURS"; then
  warn "Invalid SCAN_HOURS, using default 24"
  SCAN_HOURS=24
fi

LABEL="auto:late-review"
# busybox date (Alpine) does not support `-d "X hours ago"`. Compute via epoch
# instead (busybox 1.28+ and GNU coreutils both accept `-d @<epoch>`).
SINCE_EPOCH=$(( $(date -u +%s) - SCAN_HOURS * 3600 ))
SINCE=$(date -u -d "@${SINCE_EPOCH}" +%Y-%m-%dT%H:%M:%SZ)
SINCE_ENCODED=$(printf '%s' "$SINCE" | jq -sRr '@uri')
echo "Scanning for merged MRs since $SINCE (last ${SCAN_HOURS}h)..."

# --- 1. マージ済みMR取得 ---
MERGED_MRS=""
if ! MERGED_MRS=$(gitlab_api GET "/merge_requests?state=merged&updated_after=${SINCE_ENCODED}&per_page=100" 2>&1); then
  if echo "$MERGED_MRS" | grep -qiE '(401|403|Unauthorized|Forbidden)'; then
    error_exit "Authentication/permission error: $MERGED_MRS"
  fi
  warn "Failed to list merged MRs: $MERGED_MRS"
  exit 0
fi

MR_COUNT=$(echo "$MERGED_MRS" | jq 'length')
if [ "$MR_COUNT" -eq 0 ]; then
  echo "No merged MRs found in the last ${SCAN_HOURS}h. Done."
  exit 0
fi
echo "Found $MR_COUNT merged MR(s)"

# --- 2. 各MRの未解決ディスカッションを収集 ---
RESULTS_FILE=$(mktemp)
trap 'rm -f "$RESULTS_FILE"' EXIT

TOTAL_THREADS=0

while IFS= read -r MR_LINE; do
  [ -z "$MR_LINE" ] && continue
  MR_IID=$(echo "$MR_LINE" | jq -r '.iid')
  MR_TITLE=$(echo "$MR_LINE" | jq -r '.title')
  [ -z "$MR_IID" ] && continue

  echo ""
  echo "--- MR !$MR_IID: $MR_TITLE ---"

  DISCUSSIONS=""
  if ! DISCUSSIONS=$(gitlab_api GET "/merge_requests/$MR_IID/discussions?per_page=100" 2>&1); then
    if echo "$DISCUSSIONS" | grep -qiE '(401|403|Unauthorized|Forbidden)'; then
      error_exit "Authentication/permission error: $DISCUSSIONS"
    fi
    warn "Failed to query discussions for MR !$MR_IID: $DISCUSSIONS"
    continue
  fi

  # 未解決のスレッド（individual_note=false かつ resolved=false）
  UNRESOLVED=$(echo "$DISCUSSIONS" | jq -c \
    '[.[] | select(.individual_note == false and .resolved == false)
      | {id: .id, url: (.notes[0].url // (.notes[0].noteable_url // ""))}]')

  THREAD_COUNT=$(echo "$UNRESOLVED" | jq 'length')
  if [ "$THREAD_COUNT" -eq 0 ]; then
    echo "No unresolved threads."
    continue
  fi

  echo "Found $THREAD_COUNT unresolved thread(s)"
  TOTAL_THREADS=$((TOTAL_THREADS + THREAD_COUNT))

  echo "$UNRESOLVED" | jq -c \
    --arg mr_iid "$MR_IID" --arg mr_title "$MR_TITLE" \
    '{mr_iid: $mr_iid, mr_title: $mr_title, threads: .}' >> "$RESULTS_FILE"

done < <(echo "$MERGED_MRS" | jq -c '.[]')

# --- 3. 検出がなければ終了 ---
if [ "$TOTAL_THREADS" -eq 0 ]; then
  echo ""
  echo "No unresolved threads found across all MRs. Done."
  exit 0
fi

echo ""
echo "Total unresolved threads: $TOTAL_THREADS"

# --- 4. 集約Issue検索・作成 ---
ISSUE_IID=""
if ! ISSUE_SEARCH=$(gitlab_api GET "/issues?labels=$LABEL&state=opened&per_page=1" 2>&1); then
  warn "Failed to search for existing issue: $ISSUE_SEARCH"
else
  ISSUE_IID=$(echo "$ISSUE_SEARCH" | jq -r '.[0].iid // empty')
fi

if [ -n "$ISSUE_IID" ]; then
  echo "Found existing late-review issue: #$ISSUE_IID"
else
  echo "No existing late-review issue found. Creating new one."
  DATE=$(date -u +"%Y-%m-%d") || DATE="unknown-date"

  ISSUE_BODY="## 事後レビュー指摘\n\nこの Issue はマージ済み MR に対する事後レビュー指摘をまとめたものです。"

  NEW_ISSUE=""
  if ! NEW_ISSUE=$(gitlab_api POST "/issues" \
    -d "{\"title\":\"事後レビュー指摘 (created:${DATE})\",\"description\":\"$ISSUE_BODY\",\"labels\":\"$LABEL\"}" 2>&1); then
    error_exit "Failed to create late-review issue: $NEW_ISSUE"
  fi

  ISSUE_IID=$(echo "$NEW_ISSUE" | jq -r '.iid')
  if ! validate_numeric "$ISSUE_IID" "ISSUE_IID"; then
    error_exit "Could not extract issue IID from response"
  fi
  echo "Created late-review issue: #$ISSUE_IID"

  # NOTE: GitHub original calls `gh issue pin` here to pin the aggregator
  # issue at the top of the Issues tab. GitLab has no equivalent feature
  # (labels filter but do not pin). Skipped intentionally — gốc cũng
  # đánh dấu best-effort / non-critical.
fi

# --- 5. MR単位でコメント追記 + スレッドresolve ---
COMMENTS_POSTED=0

while IFS= read -r RESULT; do
  [ -z "$RESULT" ] && continue

  MR_IID_R=$(echo "$RESULT" | jq -r '.mr_iid')
  MR_TTL=$(echo "$RESULT" | jq -r '.mr_title')
  COMMENT_LINKS=""

  while IFS= read -r THREAD; do
    URL=$(echo "$THREAD" | jq -r '.url')
    COMMENT_LINKS="${COMMENT_LINKS}\n- ${URL}"
  done < <(echo "$RESULT" | jq -c '.threads[]')

  COMMENT_BODY="## MR !${MR_IID_R}: ${MR_TTL}${COMMENT_LINKS}"

  if ! gitlab_api POST "/issues/$ISSUE_IID/notes" \
    -d "{\"body\":$(echo "$COMMENT_BODY" | jq -Rs .)}" > /dev/null 2>&1; then
    warn "Failed to add comment for MR !$MR_IID_R"
    continue
  fi

  echo "Added comment for MR !$MR_IID_R"
  COMMENTS_POSTED=$((COMMENTS_POSTED + 1))

  # スレッドをresolve
  while IFS= read -r THREAD; do
    DISC_ID=$(echo "$THREAD" | jq -r '.id')
    if ! gitlab_api PUT "/merge_requests/$MR_IID_R/discussions/$DISC_ID" \
      -d '{"resolved":true}' > /dev/null 2>&1; then
      warn "Failed to resolve discussion $DISC_ID on MR !$MR_IID_R"
    fi
  done < <(echo "$RESULT" | jq -c '.threads[]')

done < "$RESULTS_FILE"

echo ""
echo "=== Summary ==="
echo "MRs with unresolved threads: $COMMENTS_POSTED"
echo "Total unresolved threads: $TOTAL_THREADS"
echo "Issue: #$ISSUE_IID"
