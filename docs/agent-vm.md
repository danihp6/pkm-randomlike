# The autopilot, on a VM

`docs/agent-ci.md` describes the whole lifecycle and the GitHub Actions host it was
built on. This file describes the other host: one always-on Linux box that runs the same
cycle itself, with no runner minutes, no dispatched workflows and no cron. The cycle's
semantics do not change — `main` plus the live `task-<ID>` branches are still the only
state — only who executes the ritual changes.

## Where this stands (2026-10-22)

The code is merged and the box is not born yet. Oracle's Madrid region answers
`OUT_OF_HOST_CAPACITY` for every shape, so the launch is waiting on a slot: `oci / retry`
waits from CI around the clock, one launch every ~7 minutes, chaining its own runs. Meanwhile:

- the repository is **public**, so Actions minutes are free again and the billing block
  that parked the loop overnight is gone;
- `AUTOPILOT` is **`on`** for a timed window, so cycles run and `main` moves while the wait
  is going on;
- when the instance appears, the `oci-ready` issue carries its IP and the bootstrap in
  this file turns it into the host.

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

The Oracle Always Free Ampere shape — 4 OCPU, 24 GB, 200 GB of block storage, no
monthly bill — removes all three. It also keeps `node_modules`, the Playwright browser
and the asset store warm between cycles, which is most of the setup time a runner pays
every time.

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

## Provisioning on Oracle Cloud

Always Free, not a trial: the account needs a card for verification but this shape does
not bill. Everything below is in the console; the CLI equivalents are the same calls.

1. **Create the instance.** Compute → Instances → Create instance.
   - Image: **Canonical Ubuntu 24.04** (aarch64).
   - Shape: **Ampere → VM.Standard.A1.Flex**, **4 OCPU / 24 GB**. That is the whole
     Always Free A1 allowance, so do not split it with another instance.
   - Boot volume: 100 GB (200 GB is the free ceiling).
   - Networking: let it create a VCN with a public subnet, and **assign a public IPv4**.
     That is what you SSH to.
   - SSH keys: upload yours (the console can generate a pair and hand you the private
     key once).
2. **Close the firewall.** The default security list opens nothing but SSH on 22. Keep
   it that way: the box needs **no inbound port at all**. Do not add 80/443.
3. **Note the shape's two realities.** A1 capacity is regional and often exhausted — the
   create call answers `Out of host capacity` and the only lever is to retry. Madrid has
   **one** availability domain (`gcgh:EU-MADRID-1-AD-1`, the sole entry from
   `oci iam availability-domain list`), so there is no other AD to rotate to; the shape is
   offered there (`VM.Standard.A1.Flex` answers from `oci compute shape list`), the region is
   just full. And Always Free compute exists **only in the tenancy's home region**, which
   Oracle does not change: a different region is a different tenancy or a paid instance, so
   the wait is in Madrid or nowhere. Always Free compute can also be reclaimed when it has
   been idle for a week (low CPU, low network); a loop that parks with an empty backlog is
   exactly that pattern, so treat a vanished instance as possible and keep the repo the
   source of truth (it already is).

The same thing through the CLI, once `~/.oci/config` holds an API key:

```bash
oci network vcn create --compartment-id "$T" --cidr-block 10.0.0.0/16 \
  --display-name pkm-vcn --dns-label pkmvcn --wait-for-state AVAILABLE
oci network internet-gateway create --compartment-id "$T" --vcn-id "$VCN" \
  --is-enabled true --display-name pkm-igw --wait-for-state AVAILABLE
oci network route-table update --rt-id "$RT" --force \
  --route-rules '[{"destination":"0.0.0.0/0","destinationType":"CIDR_BLOCK","networkEntityId":"'$IGW'"}]'
oci network security-list update --security-list-id "$SL" --force \
  --ingress-security-rules '[{"protocol":"6","source":"<your.ip>/32","sourceType":"CIDR_BLOCK","isStateless":false,"tcpOptions":{"destinationPortRange":{"min":22,"max":22}}}]'
oci network subnet create --compartment-id "$T" --vcn-id "$VCN" --cidr-block 10.0.1.0/24 \
  --display-name pkm-subnet --dns-label pkmsubnet --route-table-id "$RT" \
  --security-list-ids "[\"$SL\"]" --wait-for-state AVAILABLE
oci compute instance launch --compartment-id "$T" \
  --availability-domain "$AD" --shape VM.Standard.A1.Flex \
  --shape-config '{"ocpus":4,"memoryInGBs":24}' --image-id "$IMAGE" \
  --subnet-id "$SUBNET" --assign-public-ip true --display-name pkm-autopilot \
  --ssh-authorized-keys-file ~/.ssh/pkm_vm.pub --boot-volume-size-in-gbs 100
```

`VM.Standard.A1.Flex` is the only shape that matters: 4 OCPU / 24 GB is the whole
Always Free allowance, and no other shape on the free list has the RAM for a batch.

## Waiting for capacity from CI

`oci / retry` (`.github/workflows/oci-retry.yml`) is **the** wait: one continuous chain of
runs in CI. A local loop used to run alongside it every ~6 minutes; it was retired on
2026-10-22 because two loops against one tenancy share a single launch rate limiter, and the
one that asks second gets `TooManyRequests`. One loop asking every ~7 minutes beats two
asking every ~5.

The workflow **cannot supply the cadence from its schedule**. A `cron: '*/10 * * * *'` is a
request, not a promise: this repository's `*/30` fired every 1.5 to 5 hours over two days,
and the new workflow's first scheduled tick came five hours after it went live. So a run
holds the cadence itself — `scripts/agent/vm/oci-launch.sh` takes `ATTEMPTS` (8 in CI; the
default of 1 is a one-shot probe), `ATTEMPT_SLEEP` (300 s), `THROTTLE_SLEEP` (600 s),
`START_DELAY` (300 s) and
`BUDGET` (3 600 s), and walks through its attempts, rotating 4/24 → 2/12 → 1/6.
`timeout-minutes: 75` sits above the script's own budget, so the job ends itself instead of
being killed mid-launch.

**And a run that ends without a slot hands the baton to the next one**, the same way
`agent-cycle.yml` keeps its loop alive. That is what makes the wait continuous rather than
bursty: one launch every ~7 minutes, around the clock, ~200 a day, two API calls each (the
`RUNNING` check and the `launch`). Actions minutes are free while the repository is public.
The chain stops by itself the moment an instance exists; `concurrency` keeps exactly one run
alive, so a chained run and a cron tick can never overlap. The brake is the repository
variable **`OCI_RETRY=off`**: the run then attempts nothing and chains nothing, and the cron
ticks into an empty job until it is turned back on. A run whose attempts step *failed* (bad
credential, missing variable) also does not chain, so a misconfiguration cannot spin.

**The spacing is rate limiting, not patience.** A launch call takes ~1 min 40 s to answer
either way. At one attempt every ~2 min 30 s, half of them came back `TooManyRequests`
("too many requests for the user") instead of "out of host capacity", and at ~5 min it still
did: Oracle throttles the launch API long before the region is out of shapes, and the
interval people doing this wait settle on is 5 to 10 minutes. Two more things matter as much
as the gap between attempts. A **throttle costs 10 minutes**, not 5. And a chained run opens
with a **5 min warm-up** (`START_DELAY`), because without it the last attempt of one run and
the first of the next land a minute apart — two launches back to back, which is exactly the
pattern that earns the 429. A throttled attempt is logged and counted as such instead of
being counted as a full region.

**The launch carries a public key.** `OCI_SSH_PUBLIC_KEY` is a repository variable with the
public half of the key you log in with, passed as `--metadata '{"ssh_authorized_keys": …}'`.
Without it the script exits `2` and launches nothing: a slot spent on a box nobody can SSH
into is worse than a red run, and A1 slots do not come back often.

Each attempt parks the run by finding the instance already `RUNNING` — it keeps no state
of its own — so once a slot opens the chained runs keep coming, find the instance, announce
it and stop chaining. That is what lets the `oci-ready` issue still be opened by a later run
if the one that launched died before announcing: the address is read again, never stored.
When a slot opens the run waits for the IP and opens an `oci-ready` issue with the instance,
the shape and the address.

It authenticates as a dedicated OCI user, not the operator's:

- user `pkm-ci` in the `pkm-ci` group, API key only, no console password;
- a policy that allows `manage instances`, `use` the network plumbing the launch needs,
  and `read instance-images`, and nothing else;
- the private key is the only secret (`OCI_CLI_KEY_CONTENT`); the identifiers are
  repository variables (`OCI_CLI_USER`, `OCI_CLI_FINGERPRINT`, `OCI_CLI_TENANCY`,
  `OCI_CLI_REGION`, `OCI_COMPARTMENT_ID`, `OCI_SUBNET_ID`, `OCI_IMAGE_ID`, `OCI_AD`), and
  `OCI_SSH_PUBLIC_KEY` is one too because a public key is not a secret.

Rotating the key is a human's job: `oci iam user api-key delete`, upload a new one, and
`gh secret set OCI_CLI_KEY_CONTENT < new-key.pem`. The workflow spends no model tokens;
each attempt is one `launch` call, and a `TooManyRequests` or a full region exits `0` on
purpose so the runs list does not turn red while the answer is simply "not yet".

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
