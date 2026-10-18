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
- `agent-smoke.yml` — dispatch-only probe that the credential, the CLI and the
  `opencode-go` model ids answer through the provider. Read-only, no repo side
  effects, 30 seconds: it is the early warning for the one external dependency that
  can break the whole loop, and the only pipeline that spends nothing on a repo.
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
  often than it asks to.
