# Spec: Task-197 — The panel gate measures the panels at both viewports

## 🎯 Scope

- **Task type:** tooling (the HUD diff harness) + board fixtures + docs.
- **Role:** Dev.
- **Objective:** `node scripts/hud/diff.mjs` is the gate that judges every DOM panel against
  the board, and today it **does not measure what it claims**: its `--dev` boot never becomes
  ready (`Page.loadEventFired never arrived`), its phone pass compares the board's SETTINGS
  card against **the main menu**, five board frames have no fixture at all (and two more,
  `03l` and `05e`, are missing too), and it prints a verdict instead of saying "this frame
  cannot be framed yet". After this task the gate (1) boots from the Vite dev server without a
  build, (2) finds the machine's own Chromium, (3) names, per viewport, **which screen it
  actually measured** and reports a frame it cannot frame as `unavailable` instead of a false
  FAIL, (4) has a fixture for every board frame that can have one — enforced by a test that
  enumerates both folders — and (5) carries the measured table in `docs/hud-fidelity.md`.
  Fixing a panel's pixels is **not** this task: a red row is recorded with its numbers and
  cut into its own task by the Orchestrator.
- **Environment:** worktree `../wt-pkm-197`, branch `task-197`. Run
  `npm ci --prefer-offline --no-audit --no-fund` first. Never junction `node_modules` or the
  asset tree; `ASSETS_ROOT` is already set and lives outside this checkout. The machine has
  Chromium at `/usr/bin/google-chrome` and `/usr/bin/chromium`; `CHROME_PATH` is **empty**.
- **Dependencies:** none — `design/screens/`, `design/fixtures/`, `src/ui/hud/fixtures/` and
  `scripts/hud/diff.mjs` are all on `main`.

### Exclusive paths (single writer)

- `scripts/hud/diff.mjs`
- `scripts/hud/diff.test.mjs` (new)
- `design/fixtures/**` (new fixtures + the narrow blocks the phone pass needs)
- `src/ui/hud/fixtures/**` (the fixture type, its guard and their tests)
- `docs/hud-fidelity.md` — a **new** section at the end (the measured table and the mobile
  twins' decision). Do **not** touch §5 (another task in this batch holds it) nor §6/§9.
- `docs/hud-dom-proposal.md` **§11 only** (the export recipe the fixtures follow)
- `scripts/README.md` and `design/README.md` (only if a file is added/renamed), and
  `src/ui/hud/fixtures/README.md`

### Inputs (read-only)

- `.agent_specs/task-197.md` (this file) and `AGENTS.md`.
- `scripts/hud/diff.mjs`, `src/ui/hud/fixtures/{flags.ts,registry.ts,index.ts}`,
  `src/ui/hud/mount.ts`, `src/ui/hud/shell.tsx`.
- `src/ui/hud/panels/options/{view.ts,preview.ts,optionsPanel.tsx}` (the narrow model reads
  `payload.mobile`; its root is `data-hud-panel="options"`),
  `src/ui/hud/panels/main-menu/{preview.ts,mainMenuPanel.tsx}`.
- `design/screens/*.png` and `design/screens/*.svg`, `design/fixtures/*.json`,
  `design/README.md`, `docs/hud-fidelity.md`, `docs/hud-dom-proposal.md` §11.
- `src/ui/hud/panels/*/**` for the `data-hud-panel="<id>"` marker each panel roots.

## 🔒 Contract

### 1. The harness boots from the dev server

`--dev` must not wait for `Page.loadEventFired`. After `Page.navigate`, poll through
`Runtime.evaluate` until the page is ready:

```js
document.readyState === 'complete' &&
document.querySelector('#hud') !== null &&          // the DOM layer asks for it in the URL
document.fonts.status === 'loaded'
```

polled every 100 ms against a 30 s budget; on timeout the harness throws
`page never became ready (<last reading>)` instead of `Page.loadEventFired never arrived`.
The same readiness poll replaces `once('Page.loadEventFired')` for the `--url` path, so both
paths share one rule. The app must not need a `dist` build for a `--dev` run.

### 2. The harness finds this machine's Chromium

```js
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean).find((candidate) => existsSync(candidate));
```

exported as a pure list builder so the test can assert Linux comes before Windows and that
`CHROME_PATH` wins.

### 3. A frame names the screen it compares

- `design/fixtures/<slug>.json` gains an optional top-level `"screen": "<panel id>"` beside
  `"slug"` and `"state"` — the `data-hud-panel` value the frame draws (`"options"`,
  `"main-menu"`, `"starter"`, `"shop"`, `"battle-moves"`, …). It is **not** inside `state`:
  `isHudState` keeps its exact six keys and its guard is unchanged.
- `src/ui/hud/fixtures/index.ts`:

```ts
export type HudFixture = Readonly<{ slug: string; screen: string | null; state: HudState }>;
```

  `fixtureFor` reads `screen` (a non-empty kebab-case string, else `null`) and returns it;
  a malformed `screen` is `null`, never a rejection of the whole fixture.
- After the settle, the harness reads the mounted panel ids with
  `document.querySelectorAll('[data-hud-panel]')` and, for the starter frame,
  `[data-hud-starter]`. The per-viewport report gains:

```json
{ "screen": "options", "measured": "options", "verdict": "pass" }
```

  where `measured` is the id the page actually carries. Rules:
  - the fixture names a screen and the page carries it → compare against the reference and
    report `pass`/`fail` as today;
  - the fixture names a screen and the page carries **a different** one (or none) → do **not**
    compare: `verdict: "unavailable"`, `measured: "<id or none>"`, and the console line says
    which screen the frame needs;
  - the fixture names no screen → keep today's behaviour, `screen: null`, and compare;
  - the slug has **no fixture** but is in `FIXTURE_ALLOWLIST` → `verdict: "unavailable"`,
    `measured: "none"`, `reason: "<the allow-list line>"`, and no pixel verdict, so a frame the
    gate cannot frame says so with its reason instead of failing.

  The exit code stays non-zero when at least one compared row fails; an `unavailable` row does
  not fail the run by itself (it is reported and recorded, because a frame that cannot be
  framed yet is a backlog row, not a regression).

### 4. Every board frame gets a fixture, enforced by a test

`design/screens/` holds 33 desktop frames; today 7 have no `design/fixtures/<slug>.json`:
`03b-panels-row-view`, `03c-panels-compress`, `03e-route-shop-sell`, `03h-panels-rocket-slots`,
`03l-panels-notice-level-up`, `03p-panels-pc-rip`, `05e-battle-stats`.

- Add a fixture for each one whose state a `HudState` can express, copying the structure of its
  closest sibling (`03d` for the shop, `03f/03g` for the rewards, `03k` for the notices,
  `03m` for the detail panel, `05b/05c/05d` for the battle). Each file: `slug` matching its
  name, a valid `state` (six keys), the `panel`/block the panel's own view reads, and its
  `screen`.
- A frame whose state a `HudState` genuinely cannot express — e.g. `03c-panels-compress`, whose
  subject is the **saved layout** (`hudLayout`), which a fixture does not carry — goes into the
  harness's explicit allow-list **with its reason in one line**, and its row in the table says
  `not framed: <reason>`. Never invent one to make the test green.
- `scripts/hud/diff.mjs` exports the pure helpers the test needs, e.g.:

```js
export const FIXTURE_ALLOWLIST = Object.freeze({
  '03c-panels-compress': 'the compressed state lives in the saved layout, not in a HudState',
});
export function framesWithoutFixtures(screenSlugs, fixtureSlugs, allowlist) { /* … */ }
```

  and guards its CLI so importing the module never runs a measurement:

```js
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) { main().catch(…); }
```

### 5. The measured table lands in the docs

A new final section of `docs/hud-fidelity.md` — `## The gate's measured table` — with one row
per slug and viewport: pixels differing, geometry median/max, colour flat ΔE, verdict, and the
screen measured (or the reason it is `unavailable` / `not framed`). The numbers come from a
real `node scripts/hud/diff.mjs --slug <slug>` run on this branch; mark a row you did not run
as `not measured` rather than filling it. `docs/hud-dom-proposal.md` §11 records the export
recipe the fixtures follow (the mobile twin is the same screen's phone layout, not a stale
frame: the board wins and both twins are kept).

Also: `02-options.json` gains its `"mobile"` block (the narrow options view:
`fixtureOptionsView(payload, true)` reads `payload.mobile`), so the 390 pass renders the
SETTINGS panel instead of the menu. Do the same for any other fixture whose panel has a narrow
variant and whose phone frame is compared.

## 🧩 Data and configuration

- Fixture JSON: `{ "slug": "<frame>", "screen": "<panel id>", "state": { … }, …panel blocks }`.
  `screen` is optional and outside `state`.
- The allow-list above is the only place a frame may skip a fixture, and every entry carries its
  reason.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless, green. It discovers `scripts/hud/diff.test.mjs` with the
    default include, and the fixture changes must keep every existing fixture test green.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-197` audited against the exclusive paths.
  - `[live]`: `node scripts/hud/diff.mjs --slug 02-options --dev` and
    `node scripts/hud/diff.mjs --slug 03c-panels-compress --dev` on your machine (Chromium is
    found without `CHROME_PATH`; the harness starts its own Vite dev server, so no build is
    needed and no other server must be running).
- **Acceptance criteria:**
  - [ ] `[unit]` `npm test` enumerates `design/screens/*.png` against `design/fixtures/*.json`:
    every desktop slug has a fixture **or** an allow-list entry with a non-empty reason, and the
    test fails when a new screen is added without one (assert the helper on a synthetic list:
    a missing slug is reported, an allow-listed one is not).
  - [ ] `[unit]` `fixtureFor` accepts the new `screen` and still rejects a file whose `slug` or
    `state` disagrees with its name; a malformed `screen` yields `screen: null` without
    rejecting the fixture.
  - [ ] `[unit]` the Chrome candidate list puts `CHROME_PATH` first and `/usr/bin/google-chrome`
    before the Windows paths.
  - [ ] `[unit]` importing `scripts/hud/diff.mjs` has no side effect (no server, no Chrome, no
    exit) — the CLI is guarded.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched; `src/engine/` untouched.
  - [ ] `[live]` `node scripts/hud/diff.mjs --slug 02-options --dev` prints a line for **both**
    viewports and its `design/diff/02-options/report.json` carries, for each viewport,
    `"screen": "options"` and `"measured": "options"` — the 390 capture is the SETTINGS panel,
    not the main menu. Every row in the new table of `docs/hud-fidelity.md` matches the run
    (`report.json`) for the numbers it prints; report the two console lines verbatim.
    A red pixel row is acceptable here only if the table records it as a failing row to be cut
    into its own task; a `measured` value that is not `options` fails this criterion.
  - [ ] `[live]` `node scripts/hud/diff.mjs --slug 03c-panels-compress --dev` reports that frame
    as `unavailable`/`not framed` with the allow-list reason, and does not print a pixel verdict
    for it — the gate can say "I cannot frame this" instead of inventing a FAIL.

## 📣 Coordination

- For the Architect: the table in `docs/hud-fidelity.md` is the backlog source — every red or
  `unavailable` row is a task to cut. `02-options`'s phone twin is measured from now on.
- For the next batch: `?hudFixture=<slug>` still pins a fixture; the harness's `screen` field
  is how a frame declares which panel it draws.

## ⛔ Out of scope

- Fixing a panel's pixels (a red row is recorded, not repaired here).
- Adding a per-scene boot flag (`?scene=`) or touching `src/main.ts`, `src/scenes/**`.
- Re-exporting the board's PNGs from `design/frames/` (record the decision instead).
- Teaching the harness to drive input (keys, clicks) to reach a scene mid-run.
