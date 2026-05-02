#!/usr/bin/env bash
# Post Merge — レビューIssue更新スクリプト
# Adapted from .github/scripts/post-merge/update-review-issue.sh (GitHub → GitLab)
#
# 必須環境変数:
#   MR_IID            — マージされたMRのIID
#   MR_TITLE          — MRタイトル
#   GL_TOKEN          — GitLab personal access token (api scope)
#   CI_PROJECT_ID     — GitLab project ID (自動設定)
#   CI_API_V4_URL     — GitLab API base URL (自動設定)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../_common.sh"

require_env GL_TOKEN CI_PROJECT_ID CI_API_V4_URL

MR_IID="${CI_MERGE_REQUEST_IID:-}"
if [ -z "$MR_IID" ]; then
  # push イベント: 最後のマージコミットからMR IIDを取得
  if ! MR_IID=$(gitlab_api GET "/repository/commits/${CI_COMMIT_SHA}/merge_requests" 2>/dev/null \
    | jq -r '.[0].iid // empty'); then
    warn "Could not determine MR IID from commit $CI_COMMIT_SHA"
    exit 0
  fi
fi

if [ -z "$MR_IID" ]; then
  warn "No MR IID found. Skipping post-merge."
  exit 0
fi

# source branch を確認（auto/* ブランチのMRのみ処理）
MR_INFO=""
if ! MR_INFO=$(gitlab_api GET "/merge_requests/$MR_IID" 2>&1); then
  warn "Failed to get MR info: $MR_INFO"
  exit 0
fi

# Lấy source branch của MR
MR_SOURCE_BRANCH=$(echo "$MR_INFO" | jq -r '.source_branch // ""')
if [[ "$MR_SOURCE_BRANCH" != auto/* ]]; then
  echo "MR !$MR_IID source branch '$MR_SOURCE_BRANCH' is not auto/*. Skipping."
  exit 0
fi

MR_TITLE="${MR_TITLE:-$(echo "$MR_INFO" | jq -r '.title // "(タイトル取得失敗)"')}"
DATE=$(date -u +"%Y-%m-%d") || DATE="unknown-date"

# 変更ファイル一覧を取得
CHANGED_FILES=""
if ! CHANGED_FILES=$(gitlab_api GET "/merge_requests/$MR_IID/diffs?per_page=100" 2>/dev/null \
  | jq -r '.[].new_path' 2>/dev/null); then
  warn "Failed to get MR diff files"
fi

FILE_LIST=""
while IFS= read -r file; do
  [ -n "$file" ] && FILE_LIST="${FILE_LIST}\n- \`${file}\`"
done <<< "$CHANGED_FILES"
[ -z "$FILE_LIST" ] && FILE_LIST="\n- (取得失敗)"

COMMENT_BODY="## MR !${MR_IID}: ${MR_TITLE} (${DATE})\n\n### 変更ファイル${FILE_LIST}"

LABEL="auto:review-batch"

# 既存 review-batch Issue を検索
ISSUE_IID=""
if ! ISSUE_SEARCH=$(gitlab_api GET "/issues?labels=$LABEL&state=opened&per_page=1" 2>&1); then
  warn "Failed to search for review-batch issue: $ISSUE_SEARCH"
else
  ISSUE_IID=$(echo "$ISSUE_SEARCH" | jq -r '.[0].iid // empty')
fi

if [ -n "$ISSUE_IID" ]; then
  echo "Found existing review-batch issue: #$ISSUE_IID"
  if gitlab_api POST "/issues/$ISSUE_IID/notes" \
    -d "{\"body\":$(printf '%s' "$COMMENT_BODY" | jq -Rs .)}" > /dev/null; then
    echo "Added comment to review-batch issue #$ISSUE_IID"
  else
    warn "Failed to add comment to review-batch issue #$ISSUE_IID"
  fi
else
  echo "No existing review-batch issue found. Creating new one."

  ISSUE_BODY="# 自動マージレビュー\n\n自動マージされたMRの一覧です。\n各MRの変更内容を確認し、問題がなければこのIssueをクローズしてください。"

  NEW_ISSUE=""
  if ! NEW_ISSUE=$(gitlab_api POST "/issues" \
    -d "{\"title\":\"自動マージレビュー (created:${DATE})\",\"description\":$(printf '%s' "$ISSUE_BODY" | jq -Rs .),\"labels\":\"$LABEL\"}" 2>&1); then
    warn "Failed to create review-batch issue: $NEW_ISSUE"
    exit 0
  fi

  NEW_ISSUE_IID=$(echo "$NEW_ISSUE" | jq -r '.iid')
  if ! validate_numeric "$NEW_ISSUE_IID" "NEW_ISSUE_IID"; then
    warn "Could not extract issue IID"
    exit 0
  fi

  echo "Created review-batch issue: #$NEW_ISSUE_IID"

  # NOTE: GitHub original calls `gh issue pin` here. GitLab has no
  # equivalent feature; skipped intentionally (gốc cũng best-effort).

  if gitlab_api POST "/issues/$NEW_ISSUE_IID/notes" \
    -d "{\"body\":$(printf '%s' "$COMMENT_BODY" | jq -Rs .)}" > /dev/null; then
    echo "Added initial comment to review-batch issue #$NEW_ISSUE_IID"
  else
    warn "Failed to add initial comment"
  fi
fi
