#!/usr/bin/env bash
# Setup Labels — bootstraps the auto:* labels used by the CI workflows.
# Adapted from shared-workflows-becky3/scripts/setup-labels.sh (GitHub → GitLab).
#
# Run this once locally (or from a manual web pipeline) before relying on the
# post-merge / late-review-scanner / claude jobs.
#
# Required environment variables:
#   GL_TOKEN          — GitLab personal access token (api scope).
#                       Falls back to GITLAB_TOKEN, then CI_JOB_TOKEN.
#   CI_API_V4_URL     — GitLab API base URL (auto-set in CI).
#                       Defaults to https://gitlab.com/api/v4 when run locally.
#   CI_PROJECT_ID     — Numeric project ID (auto-set in CI).
#                       When run locally, set CI_PROJECT_PATH to the URL-encoded path
#                       (e.g. "futagobim-group%2F02-Test-webapp") and the script
#                       will resolve the ID for you.
#
# Usage (local):
#   GL_TOKEN=glpat-xxx CI_PROJECT_PATH=futagobim-group%2F02-Test-webapp \
#     bash .gitlab/scripts/setup-labels.sh
#
# Usage (CI manual job):
#   Just run the script; CI_API_V4_URL and CI_PROJECT_ID are injected.

set -euo pipefail

TOKEN="${GL_TOKEN:-${GITLAB_TOKEN:-${CI_JOB_TOKEN:-}}}"
if [ -z "$TOKEN" ]; then
  echo "ERROR: No token found. Set GL_TOKEN or GITLAB_TOKEN." >&2
  exit 1
fi

API_URL="${CI_API_V4_URL:-https://gitlab.com/api/v4}"
PROJECT="${CI_PROJECT_ID:-${CI_PROJECT_PATH:-}}"
if [ -z "$PROJECT" ]; then
  echo "ERROR: Set CI_PROJECT_ID or CI_PROJECT_PATH (URL-encoded)." >&2
  exit 1
fi

# Label name | color | description
LABELS=(
  "auto:merged|#6F42C1|Auto-merged MR (consumed by post-merge job)"
  "auto:review-batch|#1F75CB|Aggregated review-followup issue"
  "auto:late-review|#FC9403|Aggregated late-review-scanner issue"
  "auto:failed|#DD2B0E|Auto pipeline failed (manual intervention required)"
  "auto:pipeline|#A8D695|Search/filter marker for auto-pipeline MRs"
  "auto-implement|#0033CC|Trigger label for auto-implement workflow"
)

created=0
existed=0
failed=0

for entry in "${LABELS[@]}"; do
  IFS='|' read -r name color desc <<< "$entry"
  echo "--- Ensuring label: $name"

  http_code=$(curl -sS -o /tmp/label_resp.json -w '%{http_code}' \
    --header "PRIVATE-TOKEN: $TOKEN" \
    --data-urlencode "name=$name" \
    --data-urlencode "color=$color" \
    --data-urlencode "description=$desc" \
    "$API_URL/projects/$PROJECT/labels" || echo "000")

  case "$http_code" in
    201)
      echo "  created"
      created=$((created + 1))
      ;;
    409)
      echo "  already exists"
      existed=$((existed + 1))
      ;;
    400)
      # GitLab returns 400 with "already been taken" when the label exists
      if grep -q 'already been taken' /tmp/label_resp.json 2>/dev/null; then
        echo "  already exists"
        existed=$((existed + 1))
      else
        echo "  FAILED ($http_code): $(cat /tmp/label_resp.json)" >&2
        failed=$((failed + 1))
      fi
      ;;
    *)
      echo "  FAILED ($http_code): $(cat /tmp/label_resp.json)" >&2
      failed=$((failed + 1))
      ;;
  esac
done

rm -f /tmp/label_resp.json

echo ""
echo "=== Summary ==="
echo "Created: $created"
echo "Existed: $existed"
echo "Failed:  $failed"

[ "$failed" -eq 0 ]
