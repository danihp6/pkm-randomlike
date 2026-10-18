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

## One cycle

The Orchestrator role drives it (`opencode run --agent orchestrator --auto`), because
nested subagents were measured working headlessly. It reads `TODO.md`, takes **the
lowest pending batch whole** (2-4 tasks; nobody inside a batch shares a path), writes
one spec per task, gives each dev a worktree and its own spec, runs one Task QA per
task in parallel from its own integration tree, adds the integration wave on the
combined tree for two or more tasks, merges in ID order with the gate after each
merge, ticks `TODO.md`, archives each task in `CHANGELOG.md`, pushes, and deletes its
worktrees.

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
- No `agent-cycle` run is in flight.
- At least one `- [ ]` task remains. With none, the loop parks itself and says so in an
  issue.
- Fewer than three red cycles today (a broken loop, not a busy one; re-run
  `agent / cycle` by hand to resume).
- At most `AGENT_DAILY_CYCLES` cycles today, when that variable is set to a number.
  **Unset or `0` means no cap** — which is the current setting.

## Budget

A cycle is not cheap in runner minutes: one whole-batch cycle (three tasks) measured
**1h32m**, so roughly half an hour per task. Runner minutes are per job and are the
account's, not the repository's: on the Free plan a private repository shares 2,000
minutes a month across the whole account, and running out **blocks** Actions (or bills
it, when a payment method exists) rather than slowing down. The finite backlog is what
bounds the loop in practice: ~30 tasks in whole batches is ~15 hours of runner, after
which there is no `- [ ]` left and the loop parks.

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
