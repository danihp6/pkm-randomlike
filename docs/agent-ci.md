# The CI autopilot

`AGENTS.md` describes the batch lifecycle and the git rules; this file describes the
half of it that runs unattended on GitHub Actions. The workflows themselves are in
`.github/workflows/` and carry the same policy in their headers, but this is the map.

## The pieces

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `ci.yml` | push to `main`, pull requests | The gate: `npm test` + `npm run build`. Read-only. |
| `agent-smoke.yml` | dispatch | Proves the credential, the CLI and the model ids answer through the provider. |
| `agent-role-smoke.yml` | dispatch | Proves a roled agent starts headless and loads its prompt, that `--auto` lets it use tools, that a job can push a branch, and that the private asset store is readable with the deploy key. |
| `agent-cycle.yml` | dispatch (the driver dispatches it) | **One batch, end to end.** The only workflow allowed to write `main`. |
| `agent-autopilot.yml` | `schedule` every 30 min, dispatch | The loop: decides whether a cycle may start and dispatches one. Spends no tokens. |
| `agent-autopilot-window.yml` | dispatch, `schedule` hourly | The timed brake: arms `AUTOPILOT` for a range you pick (`hours`, and the range's UTC start) and turns it off on the range's edges. Needs the `AUTOPILOT_TOKEN` secret. |

## One cycle

The Orchestrator role drives it (`opencode run --agent orchestrator --auto`), because
nested subagents were measured working headlessly. It reads `TODO.md`, takes **the
lowest pending batch whole** (2-4 tasks; nobody inside a batch shares a path), writes
one spec per task, gives each dev a worktree and its own spec, runs one Task QA per
task in parallel from its own integration tree, adds the integration wave on the
combined tree for two or more tasks, merges in ID order with the gate after each
merge, ticks `TODO.md`, archives each task in `CHANGELOG.md`, pushes, and deletes its
worktrees.

Every subagent is launched **in the foreground and waited for**. This is a single
pass: when the orchestrator's turn ends the process ends, and a background subagent
dies with the runner. That happened once, measured: a cycle "succeeded" in seven
minutes having written a spec and launched a dev it never waited for.

A cycle that moves nothing is a **red** cycle, not a quiet one: it must leave a trace
— a merge, a `[!]` mark, or an issue — or the run fails, and the driver's red-streak
guard then stops the loop instead of chaining the same no-op forever.

Two facts the local flow took for granted, and that the runner has to be told:

- **There is no human.** The `question` tool would hang the job: a blocking doubt
  becomes an `agent-blocked` issue, with the reason written out. An issue whose body
  is a placeholder is a failure, not a block.
- **There are no local asset trees.** The private store is materialised outside the
  checkout by the cycle itself (deploy key, pinned `ASSETS_COMMIT`) and handed over as
  `$ASSETS_ROOT` / `POKEANIL_*`. The `AGENTS.md` asset rule still applies: absolute
  paths, never a junction.

## Task states

`TODO.md` is the queue, and the state is the checkbox:

| Mark | Means |
| --- | --- |
| `- [ ]` | available. The driver counts only these. |
| `- [!]` | blocked. The cycle writes `BLOCKED: <reason>` next to it and pushes the mark, so no later cycle picks it again until a human frees it. |
| ticked | shipped and archived in `CHANGELOG.md`; the item is deleted from `TODO.md`. |

A `*Decision:*` line on an item is the human's answer, frozen. **Its absence means the
audit found no decision was needed** — it is not a block. A decision is never invented;
if one is genuinely missing the task gets blocked instead.

## The `[live]` criteria

A `[live]` criterion only exists in the running game, so the cycle measures it: a dev
server plus CDP over the runner image's headless Chromium, preferring the live canvas
(`renderer.snapshotArea` + `getImageData`) over screenshots, and it says which method
produced each piece of evidence. **A `[live]` criterion with an objective measurement
(an equality with a repository function, a count, a coordinate, a colour, a range)
passes.** Only the subjective residue — "it looks right", whether a tone reads as
such — becomes an `agent-review` issue, and that issue does not stop the merge while
the `[unit]` criteria are green. Nothing is ever reported as passing without being
measured.

The deliberate trade: **a merge never waits for a human.** A review issue is a request
for a second look at something already in `main`, so a defect it finds becomes a new
task (or a `git revert -m 1 <merge>`), not a blocked merge.

## The loop's guards

`autopilot.yml` starts a cycle only when all of them hold:

- `AUTOPILOT` (repository variable) is exactly `on`. **This is the brake**: anything
  else parks the loop, and it takes effect at a cycle boundary, so no merge is ever
  cut in half.
- No `agent-cycle` run is in flight, other than the one that asked (a cycle hands the
  baton at its end by dispatching this workflow with its own run id in `ignore_run`).
- At least one `- [ ]` task remains. With none, the loop parks itself and says so in an
  issue.
- Fewer than three red cycles today (a broken loop, not a busy one; re-run
  `agent / cycle` by hand to resume).
- At most `AGENT_DAILY_CYCLES` cycles today, when that variable is set to a number.
  **Unset or `0` means no cap** — which is the current setting.
- Inside the armed window, when there is one: `AUTOPILOT_FROM` / `AUTOPILOT_UNTIL` hold
  the range as absolute UTC instants and the driver parks outside them even if the brake
  still reads `on`, so a cron that fires late cannot start a cycle past the end.

Chaining matters, and it is measured rather than assumed: a `*/30` cron on this
private repository fired **three times in six hours** overnight, so the schedule is a
safety net and the chain is the loop. The cycle dispatches this driver at its end, and
the driver decides.

## The timed window

Setting `AUTOPILOT=on` by hand is the brake's manual mode and stays the default. The
timed window is the other mode: **dispatch `agent / autopilot window`** with the number
of hours you want (and, if you want the range to start later, its UTC `HH:MM`), and it
writes the range into `AUTOPILOT_FROM` / `AUTOPILOT_UNTIL`, turns `AUTOPILOT` on, and
asks the driver for a cycle right away — so the range starts when you dispatch it, not
when the cron next feels like firing.

Both edges of the range are then the workflow's own: an hourly pass arms the brake when
the range opens (and starts the chain, because a range that opens with the loop parked
has no cycle in flight to hand the baton) and, when the range closes, turns the brake off
**and clears the range**. That pass is what keeps the off promise even when nothing has
run for hours, and clearing it is what makes the manual brake reachable again — the
driver parks whenever `AUTOPILOT_UNTIL` is set, so a range left behind in the past would
keep a human's own `on` parked forever. One invariant covers it all: **with a range set,
the brake mirrors the range.** So a manual `off` inside an open range lasts until the
next pass — `hours: 0` is a stop: brake off, range cleared, and back to the settings.
With no range set, the hourly pass is skipped entirely and the brake is manual again, as
it was before the first window.

Two costs, stated plainly: the range lives in repository variables, and **writing one is
not in `GITHUB_TOKEN`'s permission set** (`actions/variables` answers 403, "Resource not
accessible by integration"), so the workflow needs a PAT in the `AUTOPILOT_TOKEN` secret
— classic with the `repo` scope, or fine-grained with `Variables: read and write` on this
repository. The PAT is exported only to the two steps that touch a variable; asking the
driver for a cycle uses the workflow's own `GITHUB_TOKEN`, which carries `actions: write`
(a PAT there answers 403 "Resource not accessible by personal access token", which the
first live run measured). Without the secret the window workflow fails with a message
that says so, and the loop keeps behaving like the manual brake it already is. And the
edges are hourly: the cycle boundary usually turns the brake off sooner, but the pass is
the guarantee.

## Budget

A cycle is not cheap in runner minutes: one whole-batch cycle (three tasks) measured
**1h32m**, so roughly half an hour per task. Runner minutes are per job and are the
account's, not the repository's: on the Free plan a private repository shares 2,000
minutes a month across the whole account, and running out **blocks** Actions (or bills
it, when a payment method exists) rather than slowing down. The finite backlog is what
bounds the loop in practice: ~30 tasks in whole batches is ~15 hours of runner, after
which there is no `- [ ]` left and the loop parks. The timed window adds a ~10-second
hourly job while a range is armed (and none at all when it is not, since the job skips
itself), which is cheap next to the cycle it is there to stop starting.

## Known holes

- `main` has no protection: rulesets and classic branch protection need a paid plan or
  a public repository. The only thing standing between the agent and `main` is the
  cycle's own gate plus the job permissions, where only `agent-cycle` gets
  `contents: write`.
- The agent runs with `--auto`, a shell, the inference key in its environment and write
  access to the repository. It fetches nothing from the outside (the Orchestrator's
  `webfetch` is denied) but the Architect may, so a poisoned document inside the
  repository is the injection risk worth watching.
- A human push to `main` while a cycle is in flight can make its final push be
  rejected; the cycle is told to bring `origin/main` into its branch before pushing.
- `AUTOPILOT_TOKEN` is the one long-lived credential the loop needs and the only one
  kept for the brake's sake: a PAT that may write repository variables. It is exported
  to the two `agent-autopilot-window.yml` steps that touch a variable and to nothing
  else — the driver dispatch uses the workflow's own token — and a fine-grained token
  with `Variables: read and write` (rather than a classic `repo` one) keeps the blast
  radius small. Rotating it is a human's job; when it expires the window workflow fails
  loudly at its first `gh variable set`.
- The window's edges are hourly, and GitHub's cron is a request rather than a promise
  (the `*/30` schedule below fired three times in six hours overnight). The driver's gate
  is what makes that harmless: a late edge cannot start a cycle outside the range, it can
  only leave the recorded brake reading stale for up to an hour.
