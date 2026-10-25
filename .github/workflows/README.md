# `.github/workflows/`

The CI half of the build. Each file is one pipeline; the roles it plays are in
`AGENTS.md` (the batch lifecycle) and `docs/agent-ci.md` (the autopilot's own
rules — the cycle, the task states, the `[live]` policy and the loop's guards). A
workflow that can write to `main` is named as such below.

Every gate and cycle writes a **step summary**: `ci.yml` says which commit and which
batch the gate is covering, and `agent-cycle.yml` says which tasks the cycle took,
what the gate did, and — with a symbol per line — what a human still has to look at.
GitHub paints its own test panel from the log next to them; the summaries carry the
part it cannot know.

- `ci.yml` — the repo's gate (`npm test` + `npm run build`) on `main` and on pull
  requests. Read-only; it is the required check.
- `agent-cycle.yml` — **the autopilot's unit of work, and the only workflow allowed
  to write `main`**: one batch, the Orchestrator driving plan → dev → QA → merge
  (--no-ff) → TODO/CHANGELOG bookkeeping → push. It picks the batch itself from the
  plan in `TODO.md`, applies each item's `*Decision:*` line, and marks a task `[!]`
  (pushing the mark) when it has to block it. A `[live]` criterion with an objective
  measurement is measured over CDP and passes; only the subjective residue becomes an
  `agent-review` issue, which does not stop the merge. Dispatch-only.
- `agent-autopilot.yml` — **the loop**: on a 30-minute schedule it reads the
  `AUTOPILOT` variable and the backlog, and dispatches at most one `agent-cycle`
  when nothing is in flight, work is left, and the day's caps allow it. Spends no
  tokens; the brake is the repository variable, read at a cycle boundary. A cycle
  also hands it the baton at its own end, because the schedule alone fires far less
  often than it asks to. A range armed by the window below parks it on both edges.
- `agent-autopilot-window.yml` — **the timed brake, and the only workflow that moves
  it**: dispatching it with `hours` (and, optionally, the range's UTC start) writes the
  range into `AUTOPILOT_FROM` / `AUTOPILOT_UNTIL` and turns `AUTOPILOT` on for it;
  an hourly pass then arms the loop when the range opens and turns the brake off when
  it closes. It needs the `AUTOPILOT_TOKEN` secret, because `GITHUB_TOKEN` cannot write
  repository variables. `hours: 0` closes the range now; with no range set the brake is
  manual and the pass skips itself.
