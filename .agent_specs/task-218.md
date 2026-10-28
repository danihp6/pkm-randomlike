# Spec: Task-218 — the run-over README stops saying the board has no figures

> Batch 91 fill, cut in Batch 92 as its fourth member. It shares no path with
> `[Task-208]` (`src/ui/hud/panels/hud/**`, the styles, `src/data/hudLayout.ts`, the
> scene seam and three docs) or with `[Task-219]` (`src/ui/hud/panels/main-menu/**`,
> `docs/design-spec.md` §2, `D55`). One file, one rule, no code.

## 🎯 Scope

- **Task type:** docs (one folder map's rule).
- **Role:** Dev.
- **Objective:** `src/ui/hud/panels/run-over/README.md`'s rule 6 keeps the two facts that
  are still true — the frame's filter row (`MOST KOs / MOST DAMAGE / MOST TANKED`) is
  **not** drawn, and sorting is **out of scope** — and drops the false reason it gives:
  "because it has no figures", which died with `[Task-181]`/`[Task-183]`. The board now
  prints `RunStats.faints` and each member's `kos`/`damage`/`damageTaken` (rule 1 says so
  itself), so the reason is a contradiction inside one file.
- **Environment:** worktree `../wt-pkm-218`, branch `task-218`. Run
  `npm ci --prefer-offline --no-audit --no-fund` once (the gates below need it).
- **Dependencies:** none. `[Task-181]` and `[Task-183]` are merged on `main`; this task
  reads only the file it edits and `src/ui/hud/panels/run-over/README.md`'s own rule 1.

### Exclusive paths (single writer)

- `src/ui/hud/panels/run-over/README.md`

### Inputs (read-only)

- `src/ui/hud/panels/run-over/README.md` (rule 1 is the evidence the reason is false).
- `docs/hud-fidelity.md` §9 (the `07b` frame the rule talks about), read-only.

## 🔒 Contract

- Rule 6 keeps one clause per true fact and loses the causal "because…" clause. Suggested
  wording, not binding: "`07b`'s filter row (MOST KOs / MOST DAMAGE / MOST TANKED) is not
  drawn; sorting is out of scope." If a clause still claims the screen has no figures, the
  task failed.
- Nothing else in the file changes — not rule 1, not the layout map, not the `index.ts`
  line. No code, no test, no i18n key, no save field, no `SAVE_VERSION` step.

## 🧩 Data and configuration

- None.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green (this task adds no test and changes no
    code, so the suite is the regression proof that nothing else moved).
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-218` must be exactly the one path above.
  - **No browser pass is owed:** every criterion is `[unit]`.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `npm test` is green.
  - [ ] `[unit]` `grep -n "no figures" src/ui/hud/panels/run-over/README.md` prints
        nothing, and `grep -n "sortable" src/ui/hud/panels/run-over/README.md` prints
        nothing.
  - [ ] `[unit]` The rule still says the filter row is not drawn and that sorting is out of
        scope (`grep -n "filter row" …` and `grep -n "sorting is out of scope" …` both
        print their line).
  - [ ] `[unit]` `git diff --name-only main...task-218` is exactly
        `src/ui/hud/panels/run-over/README.md`.

## 📣 Coordination

- For the Architect: nothing moves — no batch, no path outside this folder, no edge.
- For the next batch: the run-over folder's map no longer contradicts its own rule 1.

## ⛔ Out of scope

- Drawing the filter row, adding sorting, or touching `view.ts`, `runOverPanel.tsx`, the
  fixtures or the CSS.
- Any other README, any doc under `docs/`, any code.
