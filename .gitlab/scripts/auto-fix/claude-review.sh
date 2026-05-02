#!/usr/bin/env bash
# claude-review.sh — Run Claude Code as a code reviewer over the current MR.
#
# Logic:
#   1. Pull MR diff via the GitLab REST API (/changes endpoint).
#   2. Pull unresolved review threads via /discussions endpoint.
#   3. Build a deterministic prompt that asks Claude to emit ONLY a JSON
#      object with shape {decision, confidence, safety_level, diff_lines,
#      issues[], reasoning}.
#   4. Pipe the prompt to `claude --print --output-format=json` (stdin only,
#      no shell-interpolation of user content into a heredoc -> printf '%s'
#      is used to flush the prompt safely).
#   5. Validate the structure of the returned JSON, write `review.json`
#      artifact, exit 1 on any failure.
#
# Required env:
#   GL_TOKEN, CI_API_V4_URL, CI_PROJECT_ID, CI_MERGE_REQUEST_IID,
#   CLAUDE_CODE_OAUTH_TOKEN
#
# Outputs:
#   review.json — structured Claude review (artifact passed to next stage)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../_common.sh"

require_env GL_TOKEN CI_API_V4_URL CI_PROJECT_ID CI_MERGE_REQUEST_IID CLAUDE_CODE_OAUTH_TOKEN

MR_IID="$CI_MERGE_REQUEST_IID"

echo "Fetching MR !$MR_IID diff..."
if ! CHANGES_JSON=$(curl -fsS \
      --header "PRIVATE-TOKEN: $GL_TOKEN" \
      "$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests/$MR_IID/changes" 2>&1); then
  error_exit "Failed to fetch MR changes: $CHANGES_JSON"
fi

# Build a unified-diff-like text from the changes payload (limit to keep
# prompt size manageable; we only need to evaluate scope/safety, not full
# patch). Each entry has new_path/old_path/diff fields.
DIFF_TEXT=$(echo "$CHANGES_JSON" \
  | jq -r '.changes[]? | "--- " + (.old_path // "/dev/null") + "\n+++ " + (.new_path // "/dev/null") + "\n" + (.diff // "")')

# Best-effort line count from "+"/"-" markers in the diff text.
DIFF_LINES=$(printf '%s' "$DIFF_TEXT" | grep -cE '^[+-]' || true)

echo "Fetching MR !$MR_IID unresolved threads..."
if ! DISCUSSIONS=$(curl -fsS \
      --header "PRIVATE-TOKEN: $GL_TOKEN" \
      "$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests/$MR_IID/discussions?per_page=100" 2>&1); then
  error_exit "Failed to fetch discussions: $DISCUSSIONS"
fi

THREADS_JSON=$(echo "$DISCUSSIONS" \
  | jq '[.[] | select(.notes[0].resolvable == true and .notes[0].resolved == false)
        | {id: .id, author: .notes[0].author.username,
           body: .notes[0].body,
           file: (.notes[0].position.new_path // null),
           line: (.notes[0].position.new_line // null)}]')

# Build the prompt. We use printf '%s' on every untrusted variable so the
# shell never re-evaluates the content.
PROMPT_HEADER='You are a senior code reviewer. Review the merge request below.
Output ONLY a single valid JSON object, no prose, no code fences.

Schema:
{
  "decision":     "auto_fix" | "escalate" | "no_action",
  "confidence":   <integer 0-100>,
  "safety_level": "safe" | "caution" | "risky",
  "diff_lines":   <integer>,
  "issues": [
    {"thread_id": "<string>", "category": "<bug|style|perf|security|other>",
     "severity": "<low|medium|high>", "fix_proposal": "<string>"}
  ],
  "reasoning": "<short rationale, <= 500 chars>"
}

Rules:
- "no_action" if there are no real bugs, only suggestions/style nits.
- "auto_fix"  ONLY if confidence >= 80 AND safety_level == "safe"
              AND diff_lines <= 200.
- "escalate"  in every other case (low confidence, risky scope, large diff,
              architectural change, security-sensitive area).
- ANY touch on forbidden files (.env*, secrets/*, *.lock, *.pem, *.key,
  credentials*) MUST force "escalate".
- Be conservative: when in doubt, escalate.
'

PROMPT=$({
  printf '%s\n' "$PROMPT_HEADER"
  printf '\n=== Computed diff_lines ===\n%s\n' "$DIFF_LINES"
  printf '\n=== Unresolved review threads ===\n%s\n' "$THREADS_JSON"
  printf '\n=== MR diff ===\n%s\n' "$DIFF_TEXT"
})

echo "Invoking Claude Code (review mode)..."
if ! RAW_OUTPUT=$(printf '%s' "$PROMPT" \
      | claude --print --output-format=json 2>&1); then
  error_exit "Claude CLI failed: $RAW_OUTPUT"
fi

# `claude --output-format=json` returns a wrapper {result: "..."} where
# .result is the model's text. Extract and re-parse as JSON.
MODEL_TEXT=$(printf '%s' "$RAW_OUTPUT" | jq -r '.result // empty' 2>/dev/null || true)
if [ -z "$MODEL_TEXT" ]; then
  # Older Claude CLI versions print the bare text; fall back.
  MODEL_TEXT="$RAW_OUTPUT"
fi

# Strip optional code fences just in case the model added them.
MODEL_TEXT=$(printf '%s' "$MODEL_TEXT" \
  | sed -e 's/^```json//; s/^```//; s/```$//' )

if ! printf '%s' "$MODEL_TEXT" | jq -e \
      '.decision and .confidence and .safety_level' >/dev/null 2>&1; then
  warn "Claude returned invalid JSON (missing required fields)."
  printf '%s\n' "$MODEL_TEXT" >&2
  error_exit "Aborting — review.json would be malformed."
fi

# Persist the structured review.
printf '%s' "$MODEL_TEXT" | jq '.' > review.json

DECISION=$(jq -r '.decision' review.json)
CONFIDENCE=$(jq -r '.confidence' review.json)
SAFETY=$(jq -r '.safety_level' review.json)
echo "Claude review: decision=$DECISION, confidence=$CONFIDENCE, safety=$SAFETY"
