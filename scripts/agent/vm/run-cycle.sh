#!/usr/bin/env bash

# One cycle: the same ritual `agent-cycle.yml` runs on a GitHub runner, on the VM.
# The difference is where the state lives, not what it means — `main` and the live
# `task-<ID>` branches are still the only truth, and each task still ships in one push.
#
# Environment: `agent.env.example` next to this file. Everything it needs is absolute;
# nothing here may create a junction or symlink into an asset tree (AGENTS.md).

set -uo pipefail
# shellcheck source=lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

load_env
ensure_state
have git jq gh node npm opencode flock

need OPENCODE_API_KEY GH_TOKEN ASSETS_REPO

MERGE=${MERGE:-true}
model=$PKM_MODEL
stamp=$(date -u +%Y%m%dT%H%M%SZ)
cycle_log="$LOGS/cycle-$stamp.log"

# One cycle at a time, across reboots and across the driver's own restarts.
exec 9>"$STATE/lock"
flock -n 9 || die "another cycle already holds $STATE/lock"

cd "$PKM_REPO" || die "no repository at $PKM_REPO (clone it first)"

log "cycle $stamp starts on $model (merge=$MERGE)" | tee -a "$cycle_log"

git fetch --prune --quiet origin || die "git fetch failed"
before_sha=$(git rev-parse origin/main)
slug=$(repo_slug)
before_issues=$(gh api "repos/$slug/issues?state=open&per_page=100" --paginate | jq -s 'add | length')

# The VM keeps one working copy and resets it every cycle: every push the last cycle
# made is already on origin/main, so a reset loses nothing and a dirty tree from a
# killed run cannot poison this one.
git checkout -q -B main origin/main
git reset -q --hard origin/main
git worktree prune
for dir in ../wt-pkm-* ../wt-mark-*; do
  [ -d "$dir" ] && git worktree remove --force "$dir" 2>/dev/null
done

if [ ! -d node_modules ] || [ package-lock.json -nt node_modules ]; then
  log "installing dependencies" | tee -a "$cycle_log"
  npm ci --prefer-offline --no-audit --no-fund >> "$cycle_log" 2>&1 || die "npm ci failed"
fi

assets_store=${ASSETS_STORE:-$HOME/pkm-assets/store}
assets_key=${ASSETS_DEPLOY_KEY_FILE:-$HOME/.ssh/pkm-assets}
mkdir -p "$(dirname "$assets_store")"
if [ ! -d "$assets_store/.git" ]; then
  [ -f "$assets_key" ] || die "no asset deploy key at $assets_key"
  GIT_SSH_COMMAND="ssh -i $assets_key -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes" \
    git clone --quiet --depth 1 "git@github.com:${ASSETS_REPO}.git" "$assets_store" \
    || die "cloning the asset store failed"
fi
GIT_SSH_COMMAND="ssh -i $assets_key -o IdentitiesOnly=yes" \
  git -C "$assets_store" fetch --quiet --depth 1 origin "${ASSETS_COMMIT:-main}" || die "asset fetch failed"
GIT_SSH_COMMAND="ssh -i $assets_key -o IdentitiesOnly=yes" \
  git -C "$assets_store" checkout --quiet "${ASSETS_COMMIT:-FETCH_HEAD}" || die "asset checkout failed"
export ASSETS_ROOT="$assets_store"
export POKEANIL_POKEMON="$assets_store/anil/Graphics/Pokemon"
export POKEANIL_ITEMS="$assets_store/anil/Graphics/Items"

git config user.name opencode-bot
git config user.email opencode-bot@users.noreply.github.com

log "recon of the durable state" | tee -a "$cycle_log"
node scripts/agent/recon.mjs --todo TODO.md --base origin/main --out .agent_specs/resume.md \
  >> "$cycle_log" 2>&1 || die "recon failed"

prompt=$(sed -e "s|{{MERGE}}|$MERGE|g" "$VM_DIR/prompt.md")

run_cycle() {
  # `--auto` plus a shell, same as the runner. The stream is captured so a transport
  # drop can be recognised instead of read as a broken loop.
  opencode run --agent orchestrator --auto --model "$model" "$prompt" 2>&1 | tee -a "$cycle_log"
  return "${PIPESTATUS[0]}"
}

run_cycle
agent_status=$?
agent_ok=false
[ "$agent_status" -eq 0 ] && agent_ok=true

# A transport drop is not a broken loop: retry once when it shipped nothing. The
# durable branches make the retry cheap — the second attempt adopts what the first
# pushed, and after a task shipped the next cycle resumes instead.
if [ "$agent_ok" = false ]; then
  after_issues=$(gh api "repos/$slug/issues?state=open&per_page=100" --paginate | jq -s 'add | length' || echo '?')
  head_sha=$(git rev-parse HEAD)
  if [ "$head_sha" = "$before_sha" ] && [ "$after_issues" = "$before_issues" ] && grep -qE 'Transport:|finish_reason' "$cycle_log"; then
    log "the model stream dropped with nothing shipped; retrying once" | tee -a "$cycle_log"
    node scripts/agent/recon.mjs --todo TODO.md --base origin/main --out .agent_specs/resume.md \
      >> "$cycle_log" 2>&1 || true
    run_cycle
    agent_status=$?
    [ "$agent_status" -eq 0 ] && agent_ok=true
  fi
fi

{
  echo "== main before: $before_sha"
  echo "== main now:    $(git rev-parse HEAD)"
  echo "== new commits"
  git log --oneline "$before_sha..HEAD" || true
  echo "== files touched"
  git diff --stat "$before_sha..HEAD" || true
  echo "== tree state"
  git status --short
} >> "$cycle_log" 2>&1

log "post-cycle gate: npm test + npm run build" | tee -a "$cycle_log"
gate_ok=true
npm test >> "$cycle_log" 2>&1 || gate_ok=false
npm run build >> "$cycle_log" 2>&1 || gate_ok=false

after_issues=$(gh api "repos/$slug/issues?state=open&per_page=100" --paginate | jq -s 'add | length' || echo '?')
head_sha=$(git rev-parse HEAD)
moved=false; [ "$head_sha" = "$before_sha" ] || moved=true
issued=false; [ "$after_issues" = "$before_issues" ] || issued=true

verdict=$(node "$VM_DIR/verdict.mjs" \
  --gate "$gate_ok" --agent "$agent_ok" --moved "$moved" --issued "$issued" --merge "$MERGE")
status=$(printf '%s' "$verdict" | jq -r .status)
reason=$(printf '%s' "$verdict" | jq -r .reason)
ok=$(printf '%s' "$verdict" | jq -r '.ok')

tasks=$(git log --format=%s "$before_sha..HEAD" | grep -oE 'task-[0-9]+' | sort -u | sed 's/^task-/Task-/' | paste -sd' ' - || true)
open=$(grep -cE '^[[:space:]]*-[[:space:]]*\[ \][[:space:]]*\*\*\[Task-' TODO.md || true)
blocked=$(grep -cE '^[[:space:]]*-[[:space:]]*\[!\][[:space:]]*\*\*\[Task-' TODO.md || true)
tests=$(grep -aoE '[0-9]+ passed \([0-9]+\)' "$cycle_log" | tail -1 || true)
inflight=$(grep -oE 'branches alive: [0-9]+' .agent_specs/resume.md 2>/dev/null | grep -oE '[0-9]+' || true)

jq -nc \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg status "$status" --arg reason "$reason" --arg model "$model" \
  --arg before "$before_sha" --arg head "$head_sha" \
  --arg tasks "$tasks" --arg tests "$tests" \
  --argjson moved "$moved" --argjson issued "$issued" --argjson gate "$gate_ok" \
  --argjson agent "$agent_ok" --argjson open "${open:-0}" --argjson blocked "${blocked:-0}" \
  '{ts:$ts,status:$status,reason:$reason,model:$model,before:$before,head:$head,tasks:$tasks,
    tests:$tests,moved:$moved,issued:$issued,gate:$gate,agent:$agent,open:$open,blocked:$blocked}' \
  >> "$CYCLES"

{
  echo "# cycle $stamp"
  echo
  echo "| | |"
  echo "| --- | --- |"
  echo "| Verdict | **$status** — $reason |"
  echo "| Tasks | ${tasks:-—} |"
  echo "| main | \`${before_sha:0:7}\` → \`${head_sha:0:7}\` |"
  echo "| Gate | $gate_ok${tests:+ · $tests} |"
  echo "| Agent | $(printf '%s' "$agent_status") |"
  echo "| Backlog | ${open:-0} open · ${blocked:-0} blocked |"
  echo "| In flight | ${inflight:-?} task branch(es) |"
  echo "| Log | \`$cycle_log\` |"
} | tee -a "$cycle_log" > "$STATE/last-cycle.md"

log "cycle $stamp ends: $status ($reason)"

[ "$ok" = true ] || exit 1
exit 0
