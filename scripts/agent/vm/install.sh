#!/usr/bin/env bash

# Bootstrap an Ubuntu 24.04 host (the Oracle Always Free Ampere VM) for the autopilot.
# Idempotent: run it again after a reboot or an image update and it only fills the gaps.
#
# It installs the toolchain the cycle needs — git, gh, node 22, opencode, and a headless
# Chromium for the `[live]` criteria — writes the env template and the systemd unit, and
# leaves the service enabled but stopped until you fill `env`.

set -euo pipefail
# shellcheck source=lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

[ "$(id -u)" -ne 0 ] || die "run this as the unprivileged user (it calls sudo itself)"
command -v sudo >/dev/null || die "sudo is required"

arch=$(uname -m)
[ "$arch" = aarch64 ] || log "warning: $arch is not the Always Free Ampere shape; continuing"

log "installing base packages"
sudo apt-get update -qq
sudo apt-get install -y -qq git jq curl ca-certificates gnupg openssh-client build-essential

if ! node --version 2>/dev/null | grep -q '^v22\.'; then
  log "installing node 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - >/dev/null
  sudo apt-get install -y -qq nodejs
fi

if ! command -v gh >/dev/null 2>&1; then
  log "installing the GitHub CLI"
  sudo mkdir -p -m 755 /etc/apt/keyrings
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg |
    sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg >/dev/null
  sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" |
    sudo tee /etc/apt/sources.list.d/github-cli.list >/dev/null
  sudo apt-get update -qq
  sudo apt-get install -y -qq gh
fi

if ! command -v opencode >/dev/null 2>&1; then
  log "installing the opencode CLI"
  sudo npm install -g @opencode/cli
fi

# The cycle measures `[live]` criteria against a headless Chromium over CDP; the
# Playwright build is the one that exists for arm64 as well as x86. The agents call
# `chromium`, so the newest build is linked onto the PATH as that name.
if [ ! -d "$HOME/.cache/ms-playwright" ]; then
  log "installing chromium for the [live] criteria"
  npx --yes playwright install --with-deps chromium
fi
chrome=$(ls -d "$HOME"/.cache/ms-playwright/chromium-*/chrome-linux/chrome 2>/dev/null | head -1 || true)
if [ -n "$chrome" ] && [ ! -e /usr/local/bin/chromium ]; then
  sudo ln -s "$chrome" /usr/local/bin/chromium
  log "chromium -> $chrome"
fi

ensure_state
chmod 600 "$PKM_AGENT_ENV" 2>/dev/null || true

if [ ! -f "$PKM_AGENT_ENV" ]; then
  cp "$VM_DIR/agent.env.example" "$PKM_AGENT_ENV"
  chmod 600 "$PKM_AGENT_ENV"
  log "wrote $PKM_AGENT_ENV — fill it before starting the service"
fi

if [ ! -f "${ASSETS_DEPLOY_KEY_FILE:-$HOME/.ssh/pkm-assets}" ]; then
  log "no asset deploy key yet: put the read-only store key at ${ASSETS_DEPLOY_KEY_FILE:-$HOME/.ssh/pkm-assets} (chmod 600)"
fi

user=$(id -un)
home=$HOME
unit=pkm-agent-driver.service
sed -e "s|@USER@|$user|g" -e "s|@HOME@|$home|g" -e "s|@REPO@|$PKM_REPO|g" -e "s|@STATE@|$PKM_AGENT_STATE|g" \
  "$VM_DIR/$unit.in" > "/tmp/$unit"
sudo install -m 644 "/tmp/$unit" "/etc/systemd/system/$unit"
rm -f "/tmp/$unit"
sudo systemctl daemon-reload
sudo systemctl enable "$unit" >/dev/null 2>&1

if grep -qE '^OPENCODE_API_KEY=.+' "$PKM_AGENT_ENV" && grep -qE '^GH_TOKEN=.+' "$PKM_AGENT_ENV"; then
  sudo systemctl restart "$unit"
  log "service restarted: systemctl status $unit"
else
  log "$PKM_AGENT_ENV is still empty; the service is enabled but stopped"
fi

log "done. Next: brake.sh on, then systemctl start $unit"
