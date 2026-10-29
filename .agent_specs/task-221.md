# Spec: Task-221 — The pixel diff retires; fidelity is read from the spec, not from a screenshot

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** tooling + docs (a deletion, one `package.json` line and three documents).
- **Role:** Dev.
- **Objective:** the measured pixel gate that `D49` introduced is gone, because `D57` moved
  identity to the imported spec. After this task no file in the repository references
  `scripts/hud/diff.mjs`, `npm run hud:diff` or a pixel verdict as a gate; the `scripts/hud/`
  folder does not exist; `package.json` has no `hud:diff` script; `docs/hud-fidelity.md` keeps
  its 33-frame measurement as a **historical record** whose `unavailable` rows read as backlog
  ("needs screen X"), never as failures; and `docs/hud-dom-proposal.md` §11 keeps the export
  recipe and loses the harness half. **No runtime code changes**: the HUD mounts exactly as it
  mounts today.
- **Environment:** worktree `../wt-pkm-221`, branch `task-221`.
- **Dependencies:** none. (`D57` is written by Task-220 in the same batch; you cite the number,
  you do not read the block and you do not edit it. The paths `D57` introduces —
  `design/screens/<slug>.json`, `design/exports/<slug>.png` — do not exist yet and need not.)

### Exclusive paths (single writer)

Create nothing. Modify or delete **only** these.

- `scripts/hud/diff.mjs` (**delete**)
- `scripts/hud/diff.test.mjs` (**delete**)
- `scripts/hud/README.md` (**delete**)
- `package.json` (drop the `hud:diff` script entry)
- `docs/hud-fidelity.md` (header block, the measured table's intro, the "How the gate reads a
  frame" block, and the 34 rows whose verdict cell reads `unavailable`)
- `docs/hud-dom-proposal.md` (**§11 only**, lines 177–268 on `main`)
- `docs/tech-decisions.md` (**two paragraphs only**, by section: the `D49` paragraph
  "Identity is a test, not a look" and the `D50` paragraph "The escape hatch, so this stays one
  decision and not a habit"; nothing else in that file)
- `src/ui/hud/README.md` (one bullet's phrase)
- `src/ui/hud/mount.test.ts` (**the file's first doc comment line only**; the test body is
  untouched)

**Claimed hot files:** `package.json` is yours this batch, and you take **one** thing out of it:
the `hud:diff` entry. `docs/tech-decisions.md` is shared with Task-220 by section — Task-220 owns
only a `D57` block appended after `D56`; you own the two paragraphs named above. Never touch a
`## D##` heading, `D57`'s block, or any other decision.

**The three deletions are the whole folder.** `scripts/hud/` contains exactly
`diff.mjs`, `diff.test.mjs`, `README.md` — verified on `main`. There is no shared helper, no
fixture and no other file in it; `--diff`'s fixtures live in `design/fixtures/`, which **stays**.
Removing the folder (empty after the three deletions) is the expected end state.

**Do not claim:** `design/**`, `src/**` other than the two files above, `scripts/design/**`,
`scripts/agent/**`, `AGENTS.md`, `docs/agent-spec-template.md`, `.gitignore`, `TODO.md`,
`CHANGELOG.md`, `package-lock.json`.

### Inputs (read-only)

Beyond `AGENTS.md` itself, you may read only these:

- `docs/agent-spec-template.md`
- `docs/tech-decisions.md` (`D49`, `D50` — to keep their meaning while removing the harness;
  do not read or edit `D57`'s block, it may not exist in your worktree)
- `docs/hud-fidelity.md`, `docs/hud-dom-proposal.md`
- `scripts/hud/diff.mjs`, `scripts/hud/diff.test.mjs`, `scripts/hud/README.md` (about to be
  deleted — read them to know what you are removing)
- `package.json`, `vite.config.ts`, `.prettierignore`
- `design/fixtures/**` (the `?hudFixture` payloads you are **not** deleting),
  `design/screens/*.png` (the rasters you are **not** deleting)
- `src/ui/hud/fixtures/flags.ts` and `src/ui/hud/panels/**` — only to confirm the fixture URL
  still mounts (you change nothing there)

## 🔒 Contract

Nothing exported changes. What this task freezes is a **negative** contract, and it is the
acceptance surface:

1. `scripts/hud/` does not exist; no file references `scripts/hud/diff.mjs`, `scripts/hud/`,
   `npm run hud:diff` or the `hud:diff` script name.
2. `package.json`'s `scripts` object has **no** `hud:diff` key and is otherwise byte-identical:
   the `design:export`, `design:tokens`, `data:*`, `assets:*`, `infra:*` and gate scripts all
   stay. `dependencies` and `devDependencies` are **unchanged** (`pixelmatch` and `pngjs` stay
   in `devDependencies`; `package-lock.json` is not yours, so removing a dependency is out of
   scope — an unused dev dependency is not a defect this task fixes).
3. `docs/hud-fidelity.md` keeps **every measured number**. The 66-row table keeps its frame /
   viewport / screen / measured / pixels / geometry / colour columns and every `PASS`/`FAIL`
   cell. Only the verdict cell of the **34 rows** that read
   `` `unavailable`: the frame needs screen "<id>" `` changes, to
   `` `backlog: needs screen "<id>"` `` (same `<id>`, same backticks, no other edit in the row).
   The `03c-panels-compress` rows keep their `not framed` verdict.
   The word `unavailable` does not survive anywhere in the file.
4. `docs/hud-dom-proposal.md` §11 keeps: the scope sentence, the source of truth (66 frames,
   33 desktop 1280×800 at pitch 1790, 33 mobile 390×844 at `desktop x + 1320`), the three-file
   export table (`<slug>.svg`, `<slug>.png`, `<slug>.json` with their MCP calls and notes), the
   two measurements on `M 02 Options` (`8:3231`), the slug rule (`03 Route HUD` →
   `03-route-hud`, `m03-route-hud`), the `properties` list, the tokens paragraph and its JSON
   block, the frame → scene map requirement and the adaptation rules, and the fixture recipe.
   It loses: the sentence that makes `scripts/hud/diff.mjs` "the gate", the
   "Verification loop for every migrated screen (`D49`): `npm run hud:diff …`" paragraph, and
   the clause that names `scripts/hud/diff.mjs`'s `FIXTURE_ALLOWLIST` /
   `scripts/hud/diff.test.mjs`. Their replacement, in the same place: **the verification loop is
   `node scripts/design/check.mjs` (`D57`)** and identity is read from
   `design/screens/<slug>.json`, never from a pixel diff.
5. `docs/tech-decisions.md` keeps `D49`'s decision and its rationale; the one sentence that
   instructs `npm run hud:diff -- <slug>` and the two gate paragraphs it introduces now say the
   pixel gate **retired** and point at `D57`; `D50`'s escape-hatch sentence names
   `scripts/design/check.mjs` instead of `scripts/hud/diff.mjs`. **Amend, do not delete the
   decisions**, and do not edit `D57` (it is Task-220's).
6. `src/ui/hud/mount.test.ts` line 1 keeps saying what the file owns; only the clause
   "covered by `npm run hud:diff`" changes to the spec check (`node scripts/design/check.mjs`).
   The test's imports, cases and expectations are untouched.
7. No runtime behaviour moves: `?hudFixture=<slug>` and the mounted `[data-hud-panel]` /
   `[data-hud-battle-hp]` roots are exactly as they are on `main`.

## 🧩 Data and configuration

- `package.json`: delete exactly the line `    "hud:diff": "node scripts/hud/diff.mjs"` and the
  now-dangling comma on the previous entry (`"design:tokens"` becomes the last script). 2-space
  indent, no reordering, no reformat.
- `.gitignore`: untouched. Its `design/diff/` line **may stay** even though nothing writes there
  any more (the phrase in the backlog is "the ignore line may stay"); the directory is not
  present in the tree and nothing deletes it.
- `design/fixtures/**` and `design/screens/**` are **not** deleted: the fixtures feed
  `?hudFixture=<slug>`, the rasters are Task-223's to move. Deleting the harness does not delete
  its inputs.
- No new file, no new key, no new dependency.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, and nothing under `scripts/hud/` may be
    collected. Measurement: `npx vitest run 2>&1 | grep -c "scripts/hud"` → `0`.
  - `npm run build` — `tsc --noEmit && vite build`; must be green (no `src/` logic changed).
  - `git diff --name-only main...task-221` audited against the exclusive paths above.
  - `npx prettier --check docs/hud-fidelity.md docs/hud-dom-proposal.md src/ui/hud/README.md`
    (none of the three is in `.prettierignore`; `package.json`, `src/**/*.ts` and
    `docs/tech-decisions.md` are; a markdown table whose cells change width is **expected** to
    realign — accept the realignment inside the files you own and nothing else).
  - One `[live]` criterion; everything else is `[unit]`.
- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` exits 0.
  - [ ] `[unit]` `npm test` exits 0.
  - [ ] `[unit]` `grep -rn "hud/diff\|hud:diff" src scripts docs package.json` prints nothing (exit 1). This is the batch's replacement for the retired gate: no file names the deleted harness.
  - [ ] `[unit]` `test ! -e scripts/hud && echo gone` prints `gone`, and `git ls-files scripts/hud` prints nothing.
  - [ ] `[unit]` `node -p "require('./package.json').scripts['hud:diff'] ?? 'absent'"` prints `absent`, and `node -p "Object.keys(require('./package.json').devDependencies).sort().join(',')"` still contains `pixelmatch` and `pngjs`.
  - [ ] `[unit]` `grep -c "backlog: needs screen" docs/hud-fidelity.md` prints `34`, and `grep -n "unavailable" docs/hud-fidelity.md` prints nothing.
  - [ ] `[unit]` The measured numbers survive: `git diff main...task-221 -- docs/hud-fidelity.md` touches no line whose table row ends in `PASS |` or `FAIL |`, and the table still has 66 data rows. Measurement: `grep -c "^| \`" docs/hud-fidelity.md` is unchanged from `main` (`git show main:docs/hud-fidelity.md | grep -c "^| \`"` → same number).
  - [ ] `[unit]` `grep -n "Verification loop for every migrated screen\|FIXTURE_ALLOWLIST" docs/hud-dom-proposal.md` prints nothing, and the export recipe survives: `awk '/^## 11\./,/^## 12\./' docs/hud-dom-proposal.md | grep -c "node_export_visual"` prints `2`.
  - [ ] `[unit]` `git diff main...task-221 -- docs/tech-decisions.md` touches only the `D49` "Identity is a test, not a look" paragraph and the `D50` "The escape hatch" paragraph: it adds no `## D5` heading, deletes no decision, and never mentions `D57` outside those two paragraphs.
  - [ ] `[unit]` `npx prettier --check docs/hud-fidelity.md docs/hud-dom-proposal.md src/ui/hud/README.md` exits 0.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched: `git diff --name-status main...task-221` lists exactly `D scripts/hud/diff.mjs`, `D scripts/hud/diff.test.mjs`, `D scripts/hud/README.md`, `M package.json`, `M docs/hud-fidelity.md`, `M docs/hud-dom-proposal.md`, `M docs/tech-decisions.md`, `M src/ui/hud/README.md`, `M src/ui/hud/mount.test.ts`.
  - [ ] `[live]` The deletion moved no mount path — at **1280×800** and at **390×844**, on
        `npm run dev`: navigate to `/?hudFixture=02-options`, wait for `document.fonts.status ===
        'loaded'`, and read `document.querySelector('[data-hud-panel="options"]') !== null` →
        `true` at both widths; then navigate to `/?hudFixture=05-battle-hud` and read
        `document.querySelector('[data-hud-battle-hp]') !== null` → `true` at both widths. A
        `null` at any of the four readings is a red criterion (it would prove a mount path was
        edited by accident).

## 📣 Coordination

- **Task-220 (same batch) owns the `D57` block in `docs/tech-decisions.md` and everything under
  `scripts/design/` and `design/README.md`.** You cite `D57`; you do not write it. Your two
  paragraphs are far from its appended block, so the merge is textually disjoint — but do not
  reformat the file, and do not "tidy" neighbouring paragraphs.
- **`scripts/design/README.md:4` is on your grep path** (it said ``the fixtures and
  `scripts/hud/diff.mjs` read``). Task-220 owns that file (its folder's map) and clears the
  reference there; if your worktree still shows the line, that is the batch merge's job, not
  yours. Do not edit it.
- **`src/ui/hud/README.md` and `src/ui/hud/mount.test.ts` are yours for one phrase each** and
  they are non-obvious claims: without them the `[unit]` grep cannot be green, because both
  mention `npm run hud:diff`. Nothing else in either file moves.
- **`design/fixtures/**` stays.** The `?hudFixture=<slug>` store is the panel's own input; only
  the harness that consumed it for pixels goes. The fixture ↔ frame completeness guard retires
  with `diff.test.mjs`; Task-220's map test partly replaces it, and Task-223 rewrites the fixture
  tests.
- **Integration QA** should read the combined tree, not your branch alone: the grep criterion is
  a property of the batch (220 clears `scripts/design/README.md`, you clear the rest).
- **For the next batch:** `node scripts/design/check.mjs` is the only fidelity gate;
  `D57` is the decision. Nothing in the loop may reintroduce a pixel comparison as a criterion.

## ⛔ Out of scope

- No dependency removal, no `package-lock.json` edit, no `npm install`.
- No `src/` change beyond the two named files, and no behaviour change at all: no panel, no
  fixture, no flag, no test assertion.
- Do not delete `design/fixtures/**`, `design/screens/**` or `.gitignore`'s `design/diff/`
  line.
- Do not rewrite `docs/hud-fidelity.md` beyond the header block, the measured table's intro, the
  "How the gate reads a frame" block and the 34 verdict cells; do not drop a single measured
  number, and do not turn a `FAIL` into a `PASS`.
- Do not rewrite `docs/hud-dom-proposal.md` §12/§13 (the references and the "what changed"
  section, including its `pixelmatch` sentence): only §11 is yours.
- No new `docs/` file, no `CHANGELOG.md` entry, no `TODO.md` tick (the Orchestrator does those),
  no `design/README.md` edit.
