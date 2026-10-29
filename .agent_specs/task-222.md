# Spec: Task-222 — A screen task names its spec, or it is not ready to launch

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** docs + one tooling test (no game code, no data, no scene).
- **Role:** Dev.
- **Objective:** the rule this repo lacked becomes a written, machine-checked rule of the
  multi-agent workflow: **a task that creates or changes a routed screen or a HUD panel lists
  its spec and its export as read-only inputs, with the frame's caption, and a screen task that
  names no spec is not ready to launch.** `AGENTS.md`'s **Specs** bullet and
  `docs/agent-spec-template.md`'s **Inputs (read-only)** section carry the rule with the two
  exact paths (`design/screens/<slug>.json`, `design/exports/<slug>.png`) and the slug rule
  (`03 Route HUD` → `03-route-hud`); the template's criterion rule adds that **a `[live]` that
  compares pixels is not a criterion** (`D57`). A Vitest test reads both documents and fails if
  any half of the rule disappears, so the next Architect cannot quietly drop it.
- **Environment:** worktree `../wt-pkm-222`, branch `task-222`.
- **Dependencies:** none, and none needed at runtime: this task writes prose about `D57` and
  about two paths that Task-220 (the decision) and Task-223 (the operator's import) land later.
  Cite the decision's **number**; do not read it, do not wait for it, do not verify the paths
  exist.

### Exclusive paths (single writer)

Create or modify **only** these.

- `AGENTS.md` (**the `- **Specs.**` bullet only**, under `## Multi-agent workflow`)
- `docs/agent-spec-template.md` (**the `### Inputs (read-only)` section and the criterion rule
  inside `## 🧪 Test and Validation Plan (for QA)`**; the other sections are read and left
  byte-identical)
- `scripts/agent/specTemplate.test.mjs` (**new** — Vitest, discovered by `npm test`)

**Claimed hot files:** `AGENTS.md` is claimed by this task alone this batch.
`docs/agent-spec-template.md` is claimed by this task alone. `docs/tech-decisions.md` is **not**
yours (Task-220 appends `D57`, Task-221 edits two paragraphs of `D49`/`D50`).

**Do not claim:** `docs/tech-decisions.md`, `docs/hud-fidelity.md`, `docs/hud-dom-proposal.md`,
`design/**`, `src/**`, `package.json`, `scripts/design/**`, `scripts/hud/**`, `TODO.md`,
`CHANGELOG.md`.

### Inputs (read-only)

Beyond `AGENTS.md` itself, you may read only these:

- `docs/agent-spec-template.md`
- `docs/tech-decisions.md` (`D49`, `D50` only — to know what the retired pixel gate was, so the
  new sentence contradicts nothing; **do not** read or write `D57`, it may not exist in your
  worktree)
- `design/README.md` (today's contract for `design/frames/**` and `design/screens/**`)
- `scripts/design/frames.mjs` (the slug rule you must quote: `slugOf`)
- `package.json`, `vite.config.ts`, `.prettierignore`
- `scripts/agent/recon.test.mjs` (the house style for a Node test in this folder)

## 🔒 Contract

The contract is textual, and it is checkable by string, so it is frozen here as **required
substrings** (a sentence may word them differently only if every substring survives).

### `docs/agent-spec-template.md` — the `### Inputs (read-only)` section

It must contain one new bullet whose text contains, in any order, all of:

- `design/screens/<slug>.json`
- `design/exports/<slug>.png`
- `caption` **and** the phrase `exactly as the board draws it` (or `exactly as drawn`) — the
  caption rule: the frame's name **exactly as drawn**, middle dot included
- `03 Route HUD` and `03-route-hud` — the slug rule, so spec, export and task cannot drift
- `routed screen` **and** `HUD panel` — the condition that makes the bullet mandatory
- `not ready to launch` — the consequence
- `D57` — the decision it rests on

Draft (use it or an equivalent that keeps every substring):

> - `design/screens/<slug>.json` and `design/exports/<slug>.png` — **mandatory for any task
>   that creates or changes a routed screen or a HUD panel**: the imported spec and its export,
>   named by slug, with the frame's `caption` exactly as the board draws it (middle dot
>   included). `<slug>` is the caption in lower-kebab (`03 Route HUD` → `03-route-hud`), so the
>   spec, the export and the task cannot drift. A screen task that names no spec is not ready to
>   launch (`D57`).

### `docs/agent-spec-template.md` — the criterion rule

Inside `## 🧪 Test and Validation Plan (for QA)`, the existing `[unit]`/`[live]` rule stays
verbatim (both tags, the `[live]` measurement sentence). **Add** one bullet that contains:

- `pixel`
- `not a criterion`
- `D57`

Draft:

> - **A `[live]` that compares pixels is not a criterion** (`D57`): the board enters as an
>   imported spec, so fidelity is read from `design/screens/<slug>.json`, never from a
>   screenshot diff.

### `AGENTS.md` — the `- **Specs.**` bullet

It keeps every sentence it has today (the `docs/agent-spec-template.md` sentence and the
`A subagent receives **only** its spec path plus `AGENTS.md`** sentence) and **gains** one
sentence containing:

- `design/screens/<slug>.json`
- `design/exports/<slug>.png`
- `caption`
- `not ready to launch`
- `D57`

Draft, appended to the bullet:

> A task that touches a routed screen or a HUD panel lists `design/screens/<slug>.json` and
> `design/exports/<slug>.png` as read-only inputs with the frame's exact `caption`; a screen task
> that names no spec is not ready to launch (`D57`).

### `scripts/agent/specTemplate.test.mjs` — the check

Node ESM Vitest test, no browser, no network, no writes. It must:

1. Split each document into sections by ATX heading (`#`–`###`) with one local helper
   `sections(markdown)` → `Map<string, string>` (heading text without the hashes, body until the
   next heading of the same or a higher level).
2. Assert `docs/agent-spec-template.md` still has all eight sections the template owns:
   `🎯 Scope`, `Exclusive paths (single writer)`, `Inputs (read-only)`, `🔒 Contract`,
   `🧩 Data and configuration`, `🧪 Test and Validation Plan (for QA)`, `📣 Coordination`,
   `⛔ Out of scope`.
3. From the `Inputs (read-only)` section, collect every backticked string matching
   `/^design\/(screens|exports)\//` (one local helper `requiredInputs(template)`), sort it, and
   assert it deep-equals `['design/exports/<slug>.png', 'design/screens/<slug>.json']`.
   **This is the "throwaway spec" check:** a spec written from the template cannot omit either
   file, because the template's Inputs section is where a spec's inputs are read from.
4. Assert the `Inputs (read-only)` body contains every substring listed in the Contract above
   (`caption`, `03 Route HUD`, `03-route-hud`, `routed screen`, `HUD panel`,
   `not ready to launch`, `D57`).
5. Assert the `🧪 Test and Validation Plan (for QA)` body still contains `[unit]` and `[live]`,
   and contains `pixel`, `not a criterion` and `D57`.
6. Read `AGENTS.md`, isolate the bullet starting `- **Specs.**` (up to the next line that starts
   with `- **`), and assert it contains `design/screens/<slug>.json`,
   `design/exports/<slug>.png`, `caption`, `not ready to launch`, `D57`, and the two sentences it
   already had (`docs/agent-spec-template.md`, `plus \`AGENTS.md\``).
7. Read no other file, and make no assumption about `design/screens/**` or `design/exports/**`
   existing on disk — they need not exist. A test that asserts a *file path exists* here is a
   bug: the rule is about the spec's input list, not about the artifact being present yet.

Nothing else is exported, and no other test file changes.

## 🧩 Data and configuration

- No JSON entry, no default value, no balance number.
- The rule is prose in two documents plus one test; the two paths it freezes are exactly
  `design/screens/<slug>.json` and `design/exports/<slug>.png`, and the slug rule is
  `slugOf`'s (`scripts/design/frames.mjs:39-45`): lowercase, `·` → `-`, every run of
  non-`[a-z0-9]` → `-`, trimmed — `03 Route HUD` → `03-route-hud`, mobile twins carry a leading
  `m`.
- `docs/agent-spec-template.md` is outside `.prettierignore`: keep it prettier-clean.
  `AGENTS.md` and `scripts/**` are inside it.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the new
    `scripts/agent/specTemplate.test.mjs` (default discovery picks up `*.test.mjs`).
  - `npm run build` — `tsc --noEmit && vite build`; must be green (no `src/` change).
  - `git diff --name-only main...task-222` audited against the exclusive paths above.
  - `npx prettier --check docs/agent-spec-template.md`.
  - **Every criterion is `[unit]`. This task owes no browser pass**, and it says so on purpose:
    the backlog entry's `[live]` ("the orchestrator's own next spec is the check") is not
    reproducible by QA — it depends on a document that does not exist yet in this worktree. It
    is replaced here by the executable form of the same claim: the template's own Inputs section,
    read as a spec's input list, must yield both files (criterion 5 below).
- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` exits 0.
  - [ ] `[unit]` `npm test` exits 0.
  - [ ] `[unit]` `npx vitest run scripts/agent/specTemplate.test.mjs` exits 0.
  - [ ] `[unit]` The template's Inputs section names both paths and the caption rule: `awk '/^### Inputs \(read-only\)/,/^## /' docs/agent-spec-template.md` contains both paths — measure once per path with `... | grep -o "design/screens/<slug>.json" | wc -l` → at least `1` and `... | grep -o "design/exports/<slug>.png" | wc -l` → at least `1` — and the same region contains `caption`, `03 Route HUD`, `03-route-hud`, `not ready to launch` and `D57` (each `| grep -c "<token>"` → at least `1`).
  - [ ] `[unit]` The criterion rule forbids a pixel diff: `awk '/^## 🧪 Test and Validation Plan/,0' docs/agent-spec-template.md | grep -ci "pixel"` prints at least `1`, and the same region contains `not a criterion` and `D57`.
  - [ ] `[unit]` `awk '/^- \*\*Specs\.\*\*/,/^- \*\*Host/' AGENTS.md` contains both paths (measure each with `grep -o "<path>" | wc -l` → at least `1`), and the same bullet contains `caption`, `not ready to launch` and `D57`.
  - [ ] `[unit]` The template keeps all eight sections: `npx vitest run scripts/agent/specTemplate.test.mjs -t "sections"` is green, and `grep -c "^## " docs/agent-spec-template.md` is unchanged from `main` (`git show main:docs/agent-spec-template.md | grep -c "^## "`).
  - [ ] `[unit]` Nothing else in either document moved: `git diff main...task-222 -- AGENTS.md` shows one added sentence inside the `- **Specs.**` bullet and nothing else; `git diff main...task-222 -- docs/agent-spec-template.md` shows additions inside `### Inputs (read-only)` and inside `## 🧪 Test and Validation Plan (for QA)` only — no deleted line anywhere in either file.
  - [ ] `[unit]` `npx prettier --check docs/agent-spec-template.md` exits 0.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched: `git diff --name-status main...task-222` lists exactly `M AGENTS.md`, `M docs/agent-spec-template.md`, `A scripts/agent/specTemplate.test.mjs`.

## 📣 Coordination

- **The paths this task freezes are other tasks' artifacts.** `design/screens/<slug>.json` is
  written by `scripts/design/import.mjs` (Task-220) and moved into place by Task-223;
  `design/exports/<slug>.png` likewise. Task-222 only *names* them: it must not create them, and
  its test must not assert their existence.
- **`D57` is Task-220's block** in `docs/tech-decisions.md`. Cite the number, never restate the
  decision's contents beyond "the board enters as an imported spec".
- **Task-221 retires the pixel gate** in `docs/hud-fidelity.md`, `docs/hud-dom-proposal.md` §11
  and two paragraphs of `D49`/`D50`. Your template sentence ("a `[live]` that compares pixels is
  not a criterion") is what keeps it retired for future specs; keep it in the criterion rule,
  not in the Inputs section.
- **For the Architect:** this test is the enforcement point. A future edit that drops the two
  paths, the caption rule or the pixel clause turns `npm test` red — do not delete the test to
  make a doc change pass; change the doc.
- **For the next batch:** every screen task's spec must now carry, in its Inputs list,
  `design/screens/<slug>.json` and `design/exports/<slug>.png` with the exact caption, e.g.
  `design/screens/05-battle-hud.json` / `design/exports/05-battle-hud.png` with the caption
  `05 Battle HUD`.

## ⛔ Out of scope

- No `src/` change, no scene, no panel, no fixture, no `design/` file.
- Do not touch any other section of `AGENTS.md`: the batch rules, the workflow, the git rules,
  the conventions and the communication line stay byte-identical.
- Do not touch any other section of `docs/agent-spec-template.md` (Scope, Exclusive paths,
  Contract, Data and configuration, Coordination, Out of scope, and the `Method`/`Acceptance`
  bullet structure that keeps the `[unit]`/`[live]` tags).
- Do not edit `docs/tech-decisions.md`, `design/README.md`, `TODO.md`, `CHANGELOG.md` or
  `package.json`.
- Do not add a "screen task" checklist, a new template section, a linter or an npm script: the
  rule lives in the two existing documents and one test.
