#!/usr/bin/env bash
# merge-or-dryrun.sh — Execute the merge if AUTO_MERGE_ENABLED=true, else
# post a dry-run notice on the MR. On successful real merge we add the
# `auto:merged` label so post-merge.yml can react.
#
# Required env:
#   GL_TOKEN, CI_API_V4_URL, CI_PROJECT_ID, CI_MERGE_REQUEST_IID,
#   CI_PIPELINE_URL
#
# Optional env:
#   AUTO_MERGE_ENABLED — "true" performs real merge; anything else = dry-run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../_common.sh"

require_env GL_TOKEN CI_API_V4_URL CI_PROJECT_ID CI_MERGE_REQUEST_IID

MR_IID="$CI_MERGE_REQUEST_IID"
RAW="${AUTO_MERGE_ENABLED:-}"
NORMALIZED=$(echo "$RAW" | tr '[:upper:]' '[:lower:]')

# Helper: post a comment to the MR (best-effort, never fails the script).
post_note() {
  local body="$1"
  local payload
  payload=$(jq -n --arg body "$body" '{body: $body}')
  curl -fsS -o /dev/null \
    --header "PRIVATE-TOKEN: $GL_TOKEN" \
    --header "Content-Type: application/json" \
    --data "$payload" \
    "$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests/$MR_IID/notes" \
    || warn "Failed to post note (best-effort)"
}

# Helper: add a label via PUT /merge_requests/:iid (idempotent).
add_label() {
  local label="$1"
  curl -fsS -o /dev/null \
    --header "PRIVATE-TOKEN: $GL_TOKEN" \
    --request PUT \
    --data "add_labels=$label" \
    "$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests/$MR_IID" \
    || warn "Failed to add label '$label'"
}

if [ "$NORMALIZED" = "true" ]; then
  echo "AUTO_MERGE_ENABLED=true — executing real merge."

  # Pre-tag with auto:merged so post-merge.yml fires even if the merge
  # response doesn't surface labels in time.
  add_label "auto:merged"

  # Prefer glab when available — it gives clearer error messages.
  if command -v glab >/dev/null 2>&1; then
    if ! MERGE_OUT=$(glab mr merge "$MR_IID" --yes 2>&1); then
      warn "glab mr merge failed: $MERGE_OUT"
      add_label "auto:failed"
      post_note "## auto-fix: 自動マージ失敗

マージコマンドが失敗しました:

\`\`\`
$MERGE_OUT
\`\`\`

[Pipeline]($CI_PIPELINE_URL)"
      exit 1
    fi
  else
    # Fallback: REST API. should_remove_source_branch=true mirrors --merge.
    if ! MERGE_OUT=$(curl -fsS \
          --header "PRIVATE-TOKEN: $GL_TOKEN" \
          --header "Content-Type: application/json" \
          --request PUT \
          --data '{"should_remove_source_branch": true}' \
          "$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests/$MR_IID/merge" 2>&1); then
      warn "API merge failed: $MERGE_OUT"
      add_label "auto:failed"
      post_note "## auto-fix: 自動マージ失敗

API merge call failed:

\`\`\`
$MERGE_OUT
\`\`\`

[Pipeline]($CI_PIPELINE_URL)"
      exit 1
    fi
  fi

  post_note "## auto-fix: 自動マージ完了

全てのマージ条件を満たしたため、自動マージを実行しました。

[Pipeline]($CI_PIPELINE_URL)"
  echo "Merge succeeded."
  exit 0
fi

# Dry-run path (default).
echo "AUTO_MERGE_ENABLED='$RAW' — dry-run mode."
post_note "## auto-fix: マージ判定結果（ドライラン）

全てのマージ条件を満たしています。\`AUTO_MERGE_ENABLED\` が有効でないため
実際のマージはスキップしました。手動でマージしてください。

\`\`\`bash
glab mr merge $MR_IID
\`\`\`

[Pipeline]($CI_PIPELINE_URL)"
exit 0
