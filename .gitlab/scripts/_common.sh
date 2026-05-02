#!/usr/bin/env bash
# Shared utilities for GitLab CI scripts
# Adapted from .github/scripts/auto-fix/_common.sh (GitHub → GitLab)

set -euo pipefail

# Print warning (GitLab CI format)
warn() {
  echo "WARNING: $*" >&2
}

# Print error and exit
error_exit() {
  echo "ERROR: $*" >&2
  exit 1
}

# Validate required env vars
require_env() {
  for var in "$@"; do
    if [ -z "${!var:-}" ]; then
      error_exit "Required env var not set: $var"
    fi
  done
}

# Validate numeric value
validate_numeric() {
  local val="$1"
  local name="${2:-value}"
  if ! [[ "$val" =~ ^[0-9]+$ ]]; then
    warn "Expected numeric $name, got: $val"
    return 1
  fi
}

# Validate MR/issue number
validate_mr_number() {
  local num="$1"
  if ! validate_numeric "$num" "MR number"; then
    error_exit "Invalid MR number: $num"
  fi
}

# GitLab API call via curl
# GL_TOKEN, CI_API_V4_URL, CI_PROJECT_ID are injected from GitLab CI environment
# shellcheck disable=SC2154
gitlab_api() {
  local method="${1:-GET}"
  local path="$2"
  shift 2
  curl -s -f -X "$method" \
    --header "PRIVATE-TOKEN: ${GL_TOKEN}" \
    --header "Content-Type: application/json" \
    "${CI_API_V4_URL}/projects/${CI_PROJECT_ID}${path}" \
    "$@"
}
