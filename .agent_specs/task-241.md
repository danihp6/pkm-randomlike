# Spec: Task-241 — The route strip is wired to its spec (`03-route-hud`)

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** HUD panel (Preact over the `#hud` layer) — DOM only: no engine rule,
  no Phaser scene, no data table, no asset.
- **Role:** Dev.
- **Objective:** after this task the frame `03 Route HUD` is **measured** instead of
  `pending`: a new adapter `src/ui/hud/specGap.views/hud.ts` builds the route strip's
  `PanelView` from `design/fixtures/03-route-hud.json` at 1280×800, and the adapter's
  comment states — box by box, with the numbers — why the strip's own comparison at
  that viewport is empty and who owns each of the frame's 201 boxes. `gapFor` then
  reports nothing, and the strip's empty claim is guarded by a test so it cannot rot.
  No game behaviour and no pixel of the route changes.
- **Environment:** worktree `../wt-pkm-241`, branch `task-241`.
- **Dependencies:** none. The adapter contract (`src/ui/hud/specGap.views/README.md`,
  `specGap.ts`, `specGap.walk.test.ts`) and the precedent
  `src/ui/hud/specGap.views/notices.ts` are already merged.

### The measured facts this task is built on (verify them, then write them down)

- The frame is `03 Route HUD` (`design/board.json`, node `1:1558`), **201 boxes,
  63 strings, 36 colours**, viewport 1280×800. Its boxes belong to five other panels,
  not to the strip: `map panel`/`map panel highlight`/`room 0…10`, `bag panel`/`bag
  tile 1…16`, `party panel`/`portrait CH…GA`, `pc panel`/`pc slot 1…30`,
  `detail panel`/`tab stats`/`move tiles`. Each of those is measured by its own row
  (`03b`, `03c`, `03o`, `03p`, `03m`) — **not** here.
- The strip (`src/ui/hud/panels/hud/view.ts`) draws **one 26×26 badge per collapsed
  panel**, in `STRIP_CHIP_ORDER`, and nothing else; its own README's rule 1 says so.
  At 1280×800 in that frame all four cards are **open**, each drawing its own chip, so
  the strip draws **nothing** — the fixture says the same (`strip.wide.chips` is
  `[]`, `design/fixtures/03-route-hud.json`).
- The frame's `key map` `(942.59, 36, 29.18, 24)`, `key bag` `(36, 36, 24, 24)`,
  `key party` `(940, 320, 26, 26)` and `key pc` `(36, 360, 24, 24)` are the **cards'
  own chip** (`PanelFrame`, `src/ui/hud/panels/hud/panelFrame.tsx`): the control that
  collapses and drags the card, `D49`. A control is not content and is not part of the
  comparison; those four boxes are measured by the `03c` row (`Task` in Batch 108).
- The strip's badges *do* have a frame — at 390×844, `m03-route-hud`'s `m chip MAP`
  `(8, 55)`, `m chip BOX` `(8, 119)`, `m chip BAG` `(38, 551)`, which the fixture
  repeats in `strip.narrow.chips`. There is no mobile spec file (`design/screens/`
  carries the 33 desktop frames only), so that projection is measured by
  `src/ui/hud/panels/hud/fixture.test.ts` and is **not** this comparison's business.

### Exclusive paths (single writer)

- `src/ui/hud/specGap.views/hud.ts` — new.
- `src/ui/hud/panels/hud/specGap.test.ts` — new.
- `src/ui/hud/panels/hud/README.md` — one new line in its `## Layout` list.

**Nothing outside this list.** In particular, these two are **the Orchestrator's at
merge, not yours** — do not touch them, and do not "fix" the red they cause:

- `src/ui/hud/specGap.walk.test.ts` — its `PENDING` line for `03-route-hud` is deleted
  at merge. While it is still there the walker **fails on purpose**: its case
  `accounts for every screen: mapped, or a named reason` reports
  `screens both mapped and pending: 03-route-hud`. That single red is the expected
  state of your branch.
- `docs/hud-fidelity.md` — its `03-route-hud` row flips from `pending` to `wired` at
  merge, in the same push.

Also do not touch `design/**`, `src/ui/hud/specGap.ts`, `specGap.views/notices.ts`,
`src/ui/hud/panels/hud/view.ts`, `strip.tsx`, `panelFrame.tsx`, `panelFrame.css`,
`src/scenes/**`, `src/engine/**` or `package.json`.

### Inputs (read-only)

- `AGENTS.md`, `docs/agent-spec-template.md`, `docs/hud-fidelity.md` (§5 "A panel's chip
  and its compressed state", §9, and the `The spec gap, measured (D57)` table),
  `design/README.md`.
- `design/screens/03-route-hud.json` and `design/exports/03-route-hud.png` — frame
  **`03 Route HUD`**, 1280×800.
- `design/fixtures/03-route-hud.json` — its `strip` block (`frame`, `nodes`, `narrow`,
  `wide`, `paint`) is the strip's copy; `state` is the route the frame draws.
- `src/ui/hud/panels/hud/` — the whole folder, especially `view.ts` (`stripView`,
  `StripInput`, `StripSlot`, `StripView`, `STRIP_CHIP_ORDER`, `STRIP_CHIP_SIZE`,
  `STRIP_PHONE_SLOTS`, `STRIP_NARROW`), `panelFrame.tsx`, `panelFrameView.ts` and the
  `README.md`.
- `src/ui/hud/specGap.ts`, `src/ui/hud/specGap.test.ts`,
  `src/ui/hud/specGap.walk.test.ts`, `src/ui/hud/specGap.views/README.md`,
  `src/ui/hud/specGap.views/notices.ts`.

## 🔒 Contract

`src/ui/hud/specGap.views/hud.ts` exports exactly two names:

```ts
export const slug = '03-route-hud';
export function buildView(spec: ScreenSpec): PanelView;
```

- `buildView` builds the strip exactly as the route scene builds it at the desk: one
  `stripView` call over the fixture's own four panel records with **every panel open**
  and no saved offset —

  ```ts
  const DESKTOP = { width: 1280, height: 800 };
  const SLOTS: readonly StripSlot[] = [
    { id: 'header', x: 928, y: 24, dx: 0, dy: 0, collapsed: false },
    { id: 'box', x: 24, y: 348, dx: 0, dy: 0, collapsed: false },
    { id: 'bag', x: 24, y: 24, dx: 0, dy: 0, collapsed: false },
    { id: 'party', x: 928, y: 308, dx: 0, dy: 0, collapsed: false },
  ];
  ```

  with `keybinds` from `src/data/keybinds.ts`'s defaults (`DEFAULT_KEYBINDS`; import the
  module's own default, never type a key). The docks above are the frame's own card
  corners (`map panel` `928,24`, `pc panel` `24,348`, `bag panel` `24,24`,
  `party panel` `928,308`); they only make the projection faithful — an open panel
  yields no chip either way.
- `buildView` returns `{ boxes: [], strings: [], colours: [] }`, and the doc comment
  above it carries the record: the five owning panels of the frame's boxes, the four
  `key *` boxes as the cards' own control (`D49`, measured by `03c`), and the measured
  reason the strip is empty at 1280×800 (`strip.wide.chips` is `[]`; a chip exists only
  for a collapsed panel, `panels/hud/README.md` rule 2).
- **Determinism:** reads no `Rng`, no clock, no store, no scene — `stripView` is pure
  and `keybinds` is a constant table.
- You may read `spec` only as a **structural selector**. Never filter strings or
  colours by the spec's content.

## 🧩 Data and configuration

None. No new key, no new default, no run field, no save version step.

## 🧪 Test and Validation Plan (for QA)

- **Method:** run from the task's worktree. `npm test` — Vitest, headless.
  `npm run build` — `tsc --noEmit && vite build`.
  `git diff --name-only main...task-241` — audit against the exclusive paths.
  One `[live]` pass, in the browser, below.
- **Acceptance criteria:**
  - [ ] `[unit]` `npx vitest run src/ui/hud/panels/hud/specGap.test.ts` is green. It
    asserts: `slug === '03-route-hud'`; `buildView(spec)` deep-equals
    `{ boxes: [], strings: [], colours: [] }`; `gapIsEmpty(gapFor(buildView(spec),
    spec))` is `true`; and the **premise** — the spec carries no box whose name starts
    with `chip` or `strip`, carries no name `strip badge`, and carries exactly the four
    `key map` / `key bag` / `key party` / `key pc` boxes at the rects above. A future
    frame that gains a strip badge makes this test red, which is the point: the empty
    claim cannot rot silently.
  - [ ] `[unit]` `npm test` fails **only** in
    `src/ui/hud/specGap.walk.test.ts` → `accounts for every screen: mapped, or a named
    reason`, with the message `screens both mapped and pending: 03-route-hud`. That red
    is the Orchestrator's `PENDING` flip at merge. No other test fails — quote the
    summary line in the report.
  - [ ] `[unit]` `npm run build` exits 0.
  - [ ] `[unit]` `git diff --name-only main...task-241` lists exactly
    `src/ui/hud/specGap.views/hud.ts`, `src/ui/hud/panels/hud/specGap.test.ts` and
    `src/ui/hud/panels/hud/README.md`. Nothing under `design/`, `src/scenes/`,
    `src/engine/` or `.agent_specs/`.
  - [ ] `[unit]` `git diff` shows no change to `src/ui/hud/specGap.walk.test.ts`, to
    `docs/hud-fidelity.md`, or to any file of `src/ui/hud/panels/hud/` other than the
    README's one added line.
  - [ ] `[live]` At **1280×800**, after NEW RUN → a starter → the first route, with all
    four cards open, measured over CDP with `getBoundingClientRect()` and
    `querySelectorAll`: `[data-hud-strip]` is present and
    `document.querySelectorAll('[data-hud-strip] [data-hud-strip-chip]').length === 0`
    — the strip draws no badge at the desk. Then, at **390×844** with the bag collapsed
    (press `I`), `[data-hud-strip-chip="bag"]` is `38, 551, 26, 26`, the fixture's and
    `m03-route-hud`'s `m chip BAG`.
- **A `[live]` that compares pixels is not a criterion** (`D57`).

## 📣 Coordination

- **For the Orchestrator:** at merge, delete `'03-route-hud'` from the `PENDING` map in
  `src/ui/hud/specGap.walk.test.ts` **and** flip the `03-route-hud` row of
  `docs/hud-fidelity.md`'s `The spec gap, measured (D57)` table to `wired` — one push,
  and the walker's "both mapped and pending" red clears. The row's counts (201 boxes /
  63 strings / 36 colours) stay as they are: they count the **frame**, not this
  comparison.
- **For the next batch:** the four `key *` boxes of this frame are the card chips and
  are measured by the `03c-panels-compress` row, not here. If the human wants the desk
  strip measured box by box, that needs a frame that draws it (a new Figma frame), not
  an adapter.
- **Do not** put a test file inside `src/ui/hud/specGap.views/`: the walker globs
  `./specGap.views/*.ts` and treats **every** module there as an adapter, so a
  `*.test.ts` beside an adapter registers an adapter with an `undefined` slug and
  breaks the walker.

## ⛔ Out of scope

- Changing the strip's geometry, its chip size, its docks or `PanelFrame` to make the
  four `key *` boxes match — that is `03c`'s row and a `D49`-level decision.
- The four cards of the frame (`map`, `bag`, `party`, `pc`) and the detail card: their
  own rows. The phone rail (`strip.narrow`). The frame's painted scene
  (`route screenshot`).
- Touching `specGap.ts`, the walker, `docs/hud-fidelity.md`, `design/**` or any test
  other than the one this task adds.
- New dependencies, refactors of `notices.ts`, prettier sweeps of unrelated files.
