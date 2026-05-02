#!/usr/bin/env bash
# handle-errors.sh — Best-effort error reporter. Posts a comment on the MR
# linking to the failing pipeline and applies the `auto:failed` label.
#
# Designed to be called from a job with `when: on_failure`.
#
# Required env:
#   GL_TOKEN, CI_API_V4_URL, CI_PROJECT_ID, CI_MERGE_REQUEST_IID,
#   CI_PIPELINE_URL
#
# Optional env:
#   CI_PIPELINE_ID, CI_JOB_NAME, CI_JOB_URL — used for richer context
#
# Always exits 0: this is a notifier, not a gate. Failing here would mask
# the original error in the upstream job.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Best-effort source of _common.sh. If the file is missing we still want to
# post the error comment via raw curl/jq.
SOURCED=false
if [ -f "$SCRIPT_DIR/../_common.sh" ]; then
  # shellcheck disable=SC1091
  if source "$SCRIPT_DIR/../_common.sh" 2>/dev/null; then
    SOURCED=true
  fi
fi

if [ "$SOURCED" = false ]; then
  warn() { echo "WARNING: $*" >&2; }
fi

# Required vars: bail out gracefully if the runner didn't inject them
# (eg. job ran outside a MR pipeline somehow).
for v in GL_TOKEN CI_API_V4_URL CI_PROJECT_ID CI_MERGE_REQUEST_IID; do
  if [ -z "${!v:-}" ]; then
    echo "WARNING: $v is unset; skipping error report." >&2
    exit 0
  fi
done

MR_IID="$CI_MERGE_REQUEST_IID"
PIPELINE_URL="${CI_PIPELINE_URL:-(no pipeline url)}"
PIPELINE_ID="${CI_PIPELINE_ID:-?}"
JOB_NAME="${CI_JOB_NAME:-unknown-job}"
JOB_URL="${CI_JOB_URL:-}"

ERROR_BODY=$(cat <<EOF
## auto-fix: pipeline error

Auto-fix pipeline failed at job **\`${JOB_NAME}\`**. The \`auto:failed\`
label has been applied to stop further automatic processing.

- Pipeline: [#${PIPELINE_ID}](${PIPELINE_URL})
$( [ -n "$JOB_URL" ] && echo "- Failing job log: ${JOB_URL}" )

**Next steps**: investigate the job log, fix the root cause, remove the
\`auto:failed\` label, and retry the pipeline.
EOF
)

# Post the error note (best-effort).
PAYLOAD=$(jq -n --arg body "$ERROR_BODY" '{body: $body}')
if ! curl -fsS -o /dev/null \
      --header "PRIVATE-TOKEN: $GL_TOKEN" \
      --header "Content-Type: application/json" \
      --data "$PAYLOAD" \
      "$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests/$MR_IID/notes"; then
  warn "Failed to post error comment on MR !$MR_IID"
fi

# Apply auto:failed label (best-effort).
if ! curl -fsS -o /dev/null \
      --header "PRIVATE-TOKEN: $GL_TOKEN" \
      --request PUT \
      --data "add_labels=auto:failed" \
      "$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests/$MR_IID"; then
  warn "Failed to apply auto:failed label on MR !$MR_IID"
fi

echo "Posted error report and labelled MR !$MR_IID as auto:failed."
exit 0
