# Spec: Task-243 — The battle HP boxes are wired to their spec (`05-battle-hud`)

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** HUD panel (Preact over the `#hud` layer) — DOM only: no engine rule,
  no Phaser scene, no data table, no asset.
- **Role:** Dev.
- **Objective:** after this task the frame `05 Battle HUD` is **measured** instead of
  `pending`: a new adapter `src/ui/hud/specGap.views/battle-hp.ts` builds the battle HP
  panel's `PanelView` at 1280×800 from the panel's own view model and its own exported
  rects, claims the box the frame and the panel agree on (`foe panel`, exact within
  1 px), and writes the rest of the comparison down as measured numbers in the
  adapter's comment and in its test: the player plate's 14 px, the ball row's 16 px vs
  the board's 24, the stage grid's anchor, and the parts of the plate the view does not
  carry. No game behaviour and no pixel of the battle changes.
- **Environment:** worktree `../wt-pkm-243`, branch `task-243`.
- **Dependencies:** none. The adapter contract (`src/ui/hud/specGap.views/README.md`,
  `specGap.ts`, `specGap.walk.test.ts`) and the precedent
  `src/ui/hud/specGap.views/notices.ts` are already merged, and the panel's own anchor
  is `[Task-228]`/`[Task-235]`/`[Task-239]`'s.

### The measured facts this task is built on (verify them, then write them down)

- The frame is `05 Battle HUD` (`design/board.json`, node `1:1560`), **99 boxes,
  44 strings, 33 colours**, viewport 1280×800. Its HP half is `foe panel`
  `(64, 48, 368, 100)`, `foe panel highlight` `(76, 60, 344, 1)`, `foe hp track/fill`
  `(88, 126, 220/195, 8)`, `player panel` `(64, 660, 368, 100)`,
  `player panel highlight` `(76, 672, 344, 1)`, `player status ENV`
  `(376, 736, 44, 16)`, `foe party ball 1…3` `(88, 160, 24, 24)` at a 28 px pitch, and
  `stat stages` `(448, 673, 114, 74)` with six 34 px chips at a 40 px pitch.
- The shipped plate is `battleHpBox({ width: 1280, height: 800 }, 'enemy', 0)` =
  `{ x: 64, y: 48, w: 368, h: 100 }` — **identical** to the frame's `foe panel`, so that
  one box *is* claimable.
- The shipped player plate is `battleHpBox(…, 'player', 0)` = `{ x: 64, y: 674,
  w: 368, h: 100 }`: its bottom, 774, is the one line it shares with the command card
  (`DESKTOP_BOTTOM_MARGIN = 26` inside `battleStage`), against the board's 760. **14 px
  apart, by decision** (`docs/hud-fidelity.md` §5 "Battle zones", `[Task-239]`). It is
  not claimable and the panel does not move.
- `design/fixtures/05-battle-hud.json` carries `state` with **`battle: null`** (its
  `moves` block is the battle-moves panel's copy), so `battleHpView(state, …)` draws
  **no** box: the plate's name, level, HP readout, status, ball row and stage chips —
  the frame's 44 strings — have nothing to print from this fixture. That is recorded,
  not invented: the adapter claims no string.
- The rest of the frame's HP half is either painted from CSS off `HpBoxView.highlight`
  (the 12 px inset highlight, the track and its fill, the value line, the status mark)
  or is the panel's own deliberate geometry (`foeBallRow`: 16 px balls, 4 px apart, 8 px
  under the plate → `(64, 156, 16, 16)`; `battleHpStages`: right-aligned to the plate's
  column at 432 and 8 px above the plate, 34 px chips 6 px apart → six chips in a
  `(318, 592, 114, 74)` block at this viewport), against the board's
  `(88, 160, 24, 24)` and `(448, 673, 114, 74)`. None of them is claimable without
  moving the panel. (`docs/hud-fidelity.md` §5's `(318, 578, 114, 74)` is the same block
  measured before the plate moved to 674; the block rides the plate.)

### Exclusive paths (single writer)

- `src/ui/hud/specGap.views/battle-hp.ts` — new.
- `src/ui/hud/panels/battle-hp/specGap.test.ts` — new.
- `src/ui/hud/panels/battle-hp/README.md` — one new line in its `## Layout` list.

**Nothing outside this list.** In particular, these two are **the Orchestrator's at
merge, not yours** — do not touch them, and do not "fix" the red they cause:

- `src/ui/hud/specGap.walk.test.ts` — its `PENDING` line for `05-battle-hud` is deleted
  at merge. While it is still there the walker **fails on purpose**: its case
  `accounts for every screen: mapped, or a named reason` reports
  `screens both mapped and pending: 05-battle-hud`. That single red is the expected
  state of your branch.
- `docs/hud-fidelity.md` — its `05-battle-hud` row flips from `pending` to `wired` at
  merge, in the same push.

Also do not touch `design/**`, `src/ui/hud/specGap.ts`, `specGap.views/notices.ts`,
`src/ui/hud/panels/battle-hp/view.ts`, `battleHp.tsx`, `battleHp.css`,
`src/ui/hud/panels/battle-moves/**`, `src/scenes/**`, `src/engine/**` or
`package.json`.

### Inputs (read-only)

- `AGENTS.md`, `docs/agent-spec-template.md`, `docs/hud-fidelity.md` (§5 "Battle
  zones", "The stage grid", and the `The spec gap, measured (D57)` table),
  `design/README.md`.
- `design/screens/05-battle-hud.json` and `design/exports/05-battle-hud.png` — frame
  **`05 Battle HUD`**, 1280×800.
- `design/fixtures/05-battle-hud.json` — its `state` (six-key `HudState`, `battle:
  null`) and its `moves` block.
- `src/ui/hud/panels/battle-hp/` — the whole folder, especially `view.ts`
  (`battleHpView`, `BattleHpView`, `HpBoxView`, `battleHpBox`, `battleHpLayout`,
  `battleStage`, `foeBallRow`, `battleHpStages`, `DESKTOP_BOTTOM_MARGIN`,
  `BATTLE_BALL_SIZE`, `BATTLE_BALL_GAP`, `BATTLE_BALL_ROW_GAP`, `STAGE_CHIP`,
  `STAGE_GAP`, `STAGE_CLEARANCE`) and its `README.md`.
- `src/ui/hud/panels/battle-moves/view.ts` — read **only** for `battleMovesBox` and
  `CARD_WINDOW_MARGIN`, to record the menu card as a deliberate non-gap.
- `src/ui/hud/specGap.ts`, `src/ui/hud/specGap.test.ts`,
  `src/ui/hud/specGap.walk.test.ts`, `src/ui/hud/specGap.views/README.md`,
  `src/ui/hud/specGap.views/notices.ts`.

## 🔒 Contract

`src/ui/hud/specGap.views/battle-hp.ts` exports exactly two names:

```ts
export const slug = '05-battle-hud';
export function buildView(spec: ScreenSpec): PanelView;
```

- `buildView` imports `design/fixtures/05-battle-hud.json` as a module default and
  calls `battleHpView(fixture.state, DESKTOP, { enemy: false, player: false })` with
  `DESKTOP = { width: 1280, height: 800 }`. Because that snapshot has no battle, the
  view returns no box; the adapter then claims the one plate whose rect the panel's own
  exported geometry puts exactly where the frame puts it:

  ```ts
  const plate = battleHpBox(DESKTOP, 'enemy', 0); // { x: 64, y: 48, w: 368, h: 100 }
  ```

  Do not compute the highlight, the track, the ball row or the stage grid by hand:
  everything inside the plate is `HpBoxView.highlight` and the CSS.
- **Boxes:** exactly one, `{ name: 'foe panel', ...plate }`.
- **Strings:** `[]` — the fixture has no battle, so the plate prints nothing; the
  frame's 44 strings (foe/player names, levels, HP readouts, the four move cells, the
  menu tabs…) are not measurable from this fixture. Say so in the comment and in the
  report; do **not** invent them.
- **Colours:** `[]`. The plate's fills are `battleHp.css`'s tokens and the atlases.
- **Determinism:** reads no `Rng`, no clock, no store, no scene. `battleHpBox` and
  `battleHpView` are pure.
- You may read `spec` only as a **structural selector**. Never filter strings or
  colours by the spec's content.

### The boxes this view does **not** claim

Put this table, with the deltas, in a doc comment above `buildView`:

| frame box | frame rect | shipped | why not claimed |
| --- | --- | --- | --- |
| `player panel` | `64, 660, 368, 100` | `battleHpBox(…, 'player', 0)` = `64, 674, 368, 100` | dy +14: the plate ends on the command card's shared bottom line 774 (`DESKTOP_BOTTOM_MARGIN` 26), the board's on 760 |
| `foe panel highlight`, `player panel highlight` | `76, 60, 344, 1` / `76, 672, 344, 1` | `HpBoxView.highlight` = `box + (12, 12, w − 24, 1)` | the foe's matches the board exactly; it is not a view box (it is the snapshot's), and the player's inherits the plate's dy |
| `foe hp track`, `foe hp fill`, `player hp track`, `player hp fill` | `88, 126, 220/195, 8` … | `battle-hp` track/fill spans, `battleHp.css` | painted by CSS off `HpBoxView.fraction`; the fill's width is the snapshot's fraction |
| `player status ENV` | `376, 736, 44, 16` | `.battle-hp__status` | painted by CSS when `statusLabel !== null`, and the fixture has no battle |
| `foe party ball 1…3` | `88, 160, 24, 24`, 28 px pitch | `foeBallRow` = `64, 156, 16, 16`, 20 px pitch | the shipped ball row is 16 px, 4 px apart, 8 px under the plate (`panels/battle-hp/README.md` rule 5) |
| `stat stages`, `stage atk…acc` | `448, 673, 114, 74`, 34 px chips at a 40 px pitch | `battleHpStages` | right-aligned to the plate's column (432) 8 px above it, because the board's own origin sits inside the shipped menu card |
| `battle menu`, `battle menu highlight`, `menu tab 0…3`, `move cell 0…3`, `attack detail`, `weather chip`, `foe sprite art`, `player sprite art`, `battle field`, `* shadow` | — | `battleMovesBox({1280, 800})` = `{ x: 676, y: 582, w: 564, h: 192 }`, the scene's canvas | **not this adapter's**: the menu card, its cells and the field belong to the battle-command / battle-moves / battle-log rows, and the sprites are the canvas's (`D49`) |

## 🧩 Data and configuration

None. No new key, no new default, no run field, no save version step. The fixture is
read-only — **in particular do not add a `battle` block to
`design/fixtures/05-battle-hud.json`**: that file is another task's path.

## 🧪 Test and Validation Plan (for QA)

- **Method:** run from the task's worktree. `npm test` — Vitest, headless.
  `npm run build` — `tsc --noEmit && vite build`.
  `git diff --name-only main...task-243` — audit against the exclusive paths.
  One `[live]` pass, in the browser, below.
- **Acceptance criteria:**
  - [ ] `[unit]` `npx vitest run src/ui/hud/panels/battle-hp/specGap.test.ts` is green.
    It asserts: `slug === '05-battle-hud'`; `buildView(spec).boxes` is exactly
    `[{ name: 'foe panel', x: 64, y: 48, w: 368, h: 100 }]`; `strings` and `colours` are
    `[]`; `gapIsEmpty(gapFor(buildView(spec), spec))` is `true`; and the recorded
    numbers — `battleHpBox({ width: 1280, height: 800 }, 'player', 0)` is
    `{ x: 64, y: 674, w: 368, h: 100 }` against the spec's `player panel`
    `{ x: 64, y: 660, width: 368, height: 100 }` (dy 14), `foeBallRow` on a two-member
    trainer is 16 px boxes 4 px apart starting at `y = 156`, `battleHpStages` with six
    stages is `{ x: 318, y: 592, w: 114, h: 74 }`, and the fixture's `state.battle` is
    `null`.
  - [ ] `[unit]` `npm test` fails **only** in
    `src/ui/hud/specGap.walk.test.ts` → `accounts for every screen: mapped, or a named
    reason`, with the message `screens both mapped and pending: 05-battle-hud`. That
    red is the Orchestrator's `PENDING` flip at merge. No other test fails — quote the
    summary line in the report.
  - [ ] `[unit]` `npm run build` exits 0.
  - [ ] `[unit]` `git diff --name-only main...task-243` lists exactly
    `src/ui/hud/specGap.views/battle-hp.ts`,
    `src/ui/hud/panels/battle-hp/specGap.test.ts` and
    `src/ui/hud/panels/battle-hp/README.md`. Nothing under `design/`, `src/scenes/`,
    `src/engine/` or `.agent_specs/`.
  - [ ] `[unit]` `git diff` shows no change to `src/ui/hud/specGap.walk.test.ts`, to
    `docs/hud-fidelity.md`, to `design/fixtures/05-battle-hud.json`, or to any file of
    `src/ui/hud/panels/battle-hp/` other than the README's one added line.
  - [ ] `[live]` At **1280×800** with a battle open (walk into a trainer's line of
    sight), measured over CDP with `getBoundingClientRect()`:
    `[data-hud-hp="enemy-0"]` is `64, 48, 368, 100` and `[data-hud-hp="player-0"]` is
    `64, 674, 368, 100` — both equal `battleHpBox({ width: 1280, height: 800 }, side,
    0)`, and the player plate's bottom (774) equals
    `[data-hud-panel="battle-moves"]`'s bottom.
- **A `[live]` that compares pixels is not a criterion** (`D57`).

## 📣 Coordination

- **For the Orchestrator:** at merge, delete `'05-battle-hud'` from the `PENDING` map in
  `src/ui/hud/specGap.walk.test.ts` **and** flip the `05-battle-hud` row of
  `docs/hud-fidelity.md`'s `The spec gap, measured (D57)` table to `wired` — one push.
  The row's 44-string count stays unmeasured: `design/fixtures/05-battle-hud.json`
  carries no `battle`, so the plate's copy cannot be compared until a fixture task adds
  one (the fixture is its own path, not this task's).
- **For the next batch:** `05b-battle-message`, `05c-battle-bag`, `05d-battle-pokemon`
  and `05e-battle-stats` read the same fixture family; whichever of them runs first
  should also carry the `battle` snapshot, so the HP box's strings become measurable.
- **Do not** put a test file inside `src/ui/hud/specGap.views/`: the walker globs
  `./specGap.views/*.ts` and treats **every** module there as an adapter, so a
  `*.test.ts` beside an adapter registers an adapter with an `undefined` slug and
  breaks the walker.

## ⛔ Out of scope

- Moving the player plate to the board's 660, the ball row to 24 px, the stage grid to
  `(448, 673)`, or the menu card to `(664, 544, 576, 216)`: those are `[Task-228]` /
  `[Task-239]`'s window anchor and would break the shared bottom line and the frozen
  222 px cells.
- The doubles partner box, the phone layout (`m05`), the fill's animation, the status
  icons, the move cells, the attack-detail card, the message box.
- Adding a `battle` block to the fixture or any change under `design/**`.
- Touching `specGap.ts`, the walker, `docs/hud-fidelity.md` or any test other than the
  one this task adds.
- New dependencies, refactors of `notices.ts`, prettier sweeps of unrelated files.
