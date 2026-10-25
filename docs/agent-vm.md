# The autopilot, on a VM

`docs/agent-ci.md` describes the whole lifecycle and the GitHub Actions host it was
built on. This file describes the other host: one always-on Linux box that runs the same
cycle itself, with no runner minutes, no dispatched workflows and no cron. The cycle's
semantics do not change — `main` plus the live `task-<ID>` branches are still the only
state — only who executes the ritual changes.

## Where this stands (2026-10-25)

The code is merged and the box is not provisioned: hosting it is a human's call, and today
the loop runs on GitHub Actions, whose minutes are free while the repository is public. The
VM host stays as the fallback for the day Actions stops being enough — a private
repository's billable minutes, the six-hour job cap or a cron that fires too rarely — and
nothing in the repository has to change to adopt it: the scripts below plus the bootstrap in
this file are the whole host.

## Why a box

Three measured facts pushed the loop off Actions:

- **Cron is a request, not a promise.** A `*/30` schedule fired three times in six hours,
  so the loop had to chain cycles from inside a cycle, and a dead cycle could end it.
- **A job is capped at six hours**, and the runner image is 2 cores and 7 GB for a batch
  that wants four devs plus a headless Chromium.
- **A billable private repository adds a hard stop**: a whole-batch cycle measured
  **1h32m**, and 2,000 shared minutes are ~30 tasks of headroom. The repository is public
  again, so this one is currently moot — it is the reason the box is worth having the day
  the repository goes private for good.

A cheap always-on box — 2–4 cores, 12–24 GB, 100 GB of disk — removes all three. It also
keeps `node_modules`, the Playwright browser and the asset store warm between cycles, which
is most of the setup time a runner pays every time. Any provider will do: the scripts below
take no cloud CLI and make no provider-specific call.

## The shape

| Piece | What it does |
| --- | --- |
| `scripts/agent/vm/run-driver.sh` | The loop: reads the brake, the backlog and today's ledger, asks `gate.mjs`, and runs a cycle when the answer is yes. Runs as a systemd service. |
| `scripts/agent/vm/run-cycle.sh` | One cycle: fetch, reset, assets, recon, `opencode run --agent orchestrator --auto`, post-merge gate, verdict, one line in the ledger. Holds the lock, so two cycles can never overlap. |
| `scripts/agent/vm/gate.mjs` | The decision, pure and unit-tested (`gate.test.mjs`): brake, window, backlog, red streak, cap — in that order. |
| `scripts/agent/vm/verdict.mjs` | The cycle's verdict, pure and unit-tested (`verdict.test.mjs`): a red gate fails; a moved `main` or an opened issue is green even when the stream died. |
| `scripts/agent/vm/brake.sh` | The brake by hand (`on`, `off`) or by window (`window 4`), plus `status` and `reset`. |
| `scripts/agent/vm/prompt.md` | The Orchestrator's prompt. **The canonical copy**: `agent-cycle.yml` reads this file too, so the fallback cannot drift. |
| `scripts/agent/vm/install.sh` | Bootstrap: git, gh, node 22, opencode, headless Chromium, the env template, the systemd unit. |

State lives in `$PKM_AGENT_STATE` (default `~/pkm-agent`):

```
brake            `on` or anything else
window           "<from epoch> <until epoch>", present only while a range is armed
cycles.ndjson    one line per cycle: ts, status, tasks, gate, agent, moved, issued…
logs/cycle-*.log full transcript of every cycle, kept
last-cycle.md    the markdown summary of the last one
lock             flock target: one cycle at a time
alerts           "title:date" lines, so a parked loop nags once a day, not every wake-up
```

## Bootstrap

On the VM, as the `ubuntu` user:

```bash
sudo apt-get update && sudo apt-get install -y git
git clone https://github.com/danihp6/pkm-randomlike.git ~/pkm-randomlike
~/pkm-randomlike/scripts/agent/vm/install.sh
```

Then the two credentials, neither of which is in the repository:

- **The asset store's read-only deploy key** at `~/.ssh/pkm-assets` (`chmod 600`), the
  same key the `ASSETS_DEPLOY_KEY` secret holds.
- **`~/pkm-agent/env`** (the installer writes the template, `chmod 600`): the inference
  key, and a PAT with `contents: write` + `issues: write`. The PAT is the one long-lived
  credential on the box; the Actions loop never needed one for `main` because
  `GITHUB_TOKEN` was ephemeral. Scope it to this repository and nothing else.

```bash
~/pkm-randomlike/scripts/agent/vm/brake.sh on
sudo systemctl start pkm-agent-driver
journalctl -u pkm-agent-driver -f
```

## Operating it

```bash
brake.sh status            # what the driver would read: brake, window, today's counts
brake.sh off               # park at the next boundary; a merge is never cut in half
brake.sh window 6          # run for six hours, starting now
brake.sh window 6 23:00    # ... starting today at 23:00 UTC
brake.sh reset             # forget today's red streak, after a human looked at it
systemctl status pkm-agent-driver
tail -f ~/pkm-agent/cycles.ndjson
```

The guards are the Actions loop's guards, kept deliberately: an empty backlog parks with
one issue a day, three red cycles park the loop, `AGENT_DAILY_CYCLES` caps the day when
set, and the window is a belt under the brake — a stale `on` cannot start a cycle past
its end. `brake.sh` is the only writer of that state.

## What actually differs from the workflow

| | Actions | VM |
| --- | --- | --- |
| Trigger | cron + a chain from the cycle's last step | a `while` loop, 30 s between cycles |
| Concurrency | `concurrency: agent-cycle` | `flock` on `$STATE/lock` |
| Brake | repository variable `AUTOPILOT` | `$STATE/brake` |
| Window | `AUTOPILOT_FROM`/`UNTIL` + an hourly workflow | `$STATE/window`, read by the gate |
| Credential for `main` | `GITHUB_TOKEN`, per run | a scoped PAT in `env` |
| Machine | 2 cores, 7 GB, fresh every time | 4 cores, 24 GB, warm caches |
| Job limit | 6 h, then killed | none; a cycle that hangs holds the lock |
| History | run summaries in the UI | `cycles.ndjson`, `logs/`, `last-cycle.md` |
| The cycle's code | `agent-cycle.yml` | `run-cycle.sh` + the same `prompt.md` |

`agent-cycle.yml` stays as the manual fallback (`gh workflow run agent-cycle.yml`): it
appears in the runs UI, it can be dispatched on a branch, and it is the way to run a
single cycle without waking the box. The two hosts share `prompt.md` and nothing else;
`docs/agent-ci.md` still owns the protocol both implement.

## Security

- Inbound: SSH only, from a known address. Everything else is outbound.
- The PAT lives in one `chmod 600` file owned by the service user. Rotating it is a
  human's job: `brake.sh off`, edit, restart.
- The box holds a clone with the asset store next to it. Those trees are gitignored and
  must never be copied back into the repo (AGENTS.md, **Asset trees**).
- The agent runs with `--auto`, a shell, the inference key in its environment and write
  access to `main`. Same trust model as the runner: nothing fetched from outside by the
  Orchestrator, the Architect may fetch, so a poisoned document inside the repo is the
  injection risk worth watching.

## Going back to Actions

The VM is not load-bearing: `main` and the branches are the state. To return,
`sudo systemctl disable --now pkm-agent-driver`, set `AUTOPILOT=on` (plus `AUTOPILOT_FROM`
/ `AUTOPILOT_UNTIL` if you want a window), and dispatch `agent / autopilot`. Nothing in
the repository has to change.
