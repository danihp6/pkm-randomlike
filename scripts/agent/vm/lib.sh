#!/usr/bin/env bash

# Shared plumbing for the VM's autopilot: paths, the env file, logging and the two
# helpers every script needs. Sourced, never executed.

VM_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

# Everything below is resolved again after the env file is read, because a value may
# live there (`PKM_AGENT_STATE`, `PKM_REPO`) and the derived paths must follow it.
resolve_paths() {
  PKM_REPO=${PKM_REPO:-$HOME/pkm-randomlike}
  PKM_AGENT_STATE=${PKM_AGENT_STATE:-$HOME/pkm-agent}
  PKM_AGENT_ENV=${PKM_AGENT_ENV:-$PKM_AGENT_STATE/env}
  PKM_MODEL=${PKM_MODEL:-opencode-go/deepseek-v4.1-flash}
  AGENT_DAILY_CYCLES=${AGENT_DAILY_CYCLES:-0}
  MERGE=${MERGE:-true}
  STATE=$PKM_AGENT_STATE
  LOGS=$STATE/logs
  CYCLES=$STATE/cycles.ndjson
  export PKM_REPO PKM_AGENT_STATE PKM_AGENT_ENV PKM_MODEL AGENT_DAILY_CYCLES MERGE \
    STATE LOGS CYCLES
}

resolve_paths

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

die() {
  log "error: $*" >&2
  exit 1
}

need() {
  local name
  for name in "$@"; do
    [ -n "${!name:-}" ] || die "$name is empty; set it in $PKM_AGENT_ENV"
  done
}

have() {
  local name
  for name in "$@"; do
    command -v "$name" >/dev/null 2>&1 || die "$name is not installed; run scripts/agent/vm/install.sh"
  done
}

# The env file is shell, so a value may contain `$HOME`; it is sourced as such.
load_env() {
  [ -f "$PKM_AGENT_ENV" ] || die "no env file at $PKM_AGENT_ENV (copy agent.env.example)"
  set -a
  # shellcheck disable=SC1090
  . "$PKM_AGENT_ENV"
  set +a
  resolve_paths
}

ensure_state() {
  mkdir -p "$STATE" "$LOGS"
  chmod 700 "$STATE" 2>/dev/null || true
  [ -f "$CYCLES" ] || : > "$CYCLES"
}

# The repo's slug, for `gh api repos/<slug>`; works with https and ssh remotes.
repo_slug() {
  local url
  url=$(git -C "$PKM_REPO" remote get-url origin)
  url=${url%.git}
  url=${url#*github.com:}
  url=${url#*github.com/}
  printf '%s\n' "$url"
}

today_utc() {
  date -u +%Y-%m-%d
}

# Counts today's cycles, and today's failures when asked for `red`, from the ledger.
count_today() {
  local field=$1 date
  date=$(today_utc)
  jq -s --arg date "$date" --arg field "$field" '
    map(select((.ts // "") >= $date
      and (if $field == "red" then .status == "failed" else true end))) | length
  ' "$CYCLES" 2>/dev/null || echo 0
}

# Appends one synthetic failure so a cycle that died before writing its own line still
# counts towards the red streak the gate reads.
record_failure() {
  ensure_state
  jq -nc --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg reason "$1" \
    '{ts:$ts,status:"failed",reason:$reason}' >> "$CYCLES"
}
