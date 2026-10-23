# Spec: Task-141 — the battle's move menu is the HUD's

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene + DOM HUD migration (`D49`), battle lane.
- **Role:** Dev.
- **Objective:** under `?hud=dom` the battle's move menu — the card the FIGHT
  command opens: four move slots with their type and category badges, PP, power and
  accuracy, each slot's ⓘ and its floating description window, the ◀ back control and
  the MEGA / G-MAX columns — is a Preact card in the `#hud` layer, built from the
  **same** `MoveGrid` data the canvas builds today. The arena, the combatants, the
  effects, the shake, the flash, the fade and the message box are untouched; the card
  is the only thing that moves. A press still ends in the battle engine: the panel
  sends an intent, the scene answers with the shipped call (`chooseMove` /
  `toggleMega` / `toggleGmax` / `onBack`), and a pick becomes the same
  `{ type: 'fight', moveIndex, … }` the key path submits. With the flag off the menu
  is exactly what it is today.
- **Environment:** worktree `../wt-pkm-141`, branch `task-141`.
- **Dependencies:** `[Task-124]` (`#hud` layer), `[Task-125]` (the kit),
  `[Task-127]` (`?hud=dom`). Shipped, merged, read as the seam to copy:
  `[Task-140]` — the **same file's** `mountHpPanel`/`disposeHpPanel`/`DOM_HUD`
  branch and `src/ui/hud/panels/battle-hp/`, whose controller shape this task
  mirrors.

### Exclusive paths (single writer)

- `src/scenes/BattleScene.ts` — the batch's only claim on this hot file.
- `src/ui/hud/panels/battle-moves/**` (new folder)
- `design/fixtures/05-battle-hud.json` (new file)

Nothing else. You may **not** touch `src/ui/moveGrid.ts`, `src/ui/battleInfo.ts`,
`src/ui/infoPopup.ts`, `src/ui/hud/state.ts`, `src/ui/hud/commands.ts`,
`src/ui/hud/panels/battle-hp/**`, `src/engine/**`, `src/i18n/**`,
`src/ui/hud/panels/README.md` (it already lists `battle-moves/`; no line changes),
or `src/scenes/panels/hud.ts`.

### Inputs (read-only)

- `docs/agent-spec-template.md`, `docs/tech-decisions.md` (`D49`, `D34`, `D44`),
  `docs/hud-fidelity.md` (§5, §6), `docs/battle-spec.md` §3 (the command menu).
- `src/scenes/BattleScene.ts` — read the shipped layout first: `MAX_BATTLE_SIZE = 900`,
  `COMPACT_SIZE = 700`, `MOVE_BACK_COL = 64`, `MOVE_MEGA_COL = 62`,
  `MOVE_GMAX_COL = 62`, `MOVE_GRID_INSET = 8`, `MENU_GRID_GAP = 8`,
  `MENU_ROWS = 4`, `refreshHud`'s stage/viewport arithmetic and its `menu` rect,
  `openMoves`, `chooseMove`, `submit`, `toggleMega`, `toggleGmax`, `onBack`,
  `renderMoveMenu`, `layoutMegaControl`, `layoutGmaxControl`, `hideMoveChrome`,
  `moveMenu`, `moveMenuGrid`, and where `mountHpPanel` is called in `create`.
- `src/ui/moveGrid.ts` (`MoveGridCell`, `MoveGridSlot`, `padMoveGridCells`,
  `moveGridCellRects`, `moveGridInfoAt`, `isEmptySlot` — the geometry this task
  reuses verbatim), `src/ui/battleInfo.ts` (`battleInfoLines`, `battleInfoRows` — the
  INFO window, **not** migrated), `src/ui/typeColors.ts`, `src/ui/frlg.ts`
  (`FRLG_WINDOW_PADDING`).
- `src/ui/hud/panels/battle-hp/*` (the controller shape and its rules),
  `src/ui/hud/kit/*` (`Panel`, `TypeBadge`, `Meta`), `src/ui/hud/styles/root.css`.
- `src/data/keybinds.ts` (`keyLabel`), `src/i18n/en.ts` (`battle.mega`,
  `battle.megaIntent`, `battle.gmax`, `battle.gmaxIntent`, `move.pp`, `move.pwr`,
  `move.pwrNone`, `move.acc`, `move.accNone`, `battle.command.fight`).
- The board: `design/frames/05-battle-hud.json` and
  `design/frames/m05-battle-hud.json` (this is the frame that draws the four move
  cells — `move cell 0…3`, `move cell name`, `move pp`, `move power`,
  `move acc`, `move chip 0 FIRE`… — inside the battle HUD; `05d Battle · pokemon` is
  the **switch** screen and is not this task's frame), their `.png` in
  `design/screens/`, `design/tokens.json`.

## 🔒 Contract

### `src/ui/hud/panels/battle-moves/view.ts` — the pure layout model

```ts
export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;

/** Everything the panel needs, in plain data; the scene builds it (no engine import here). */
export type BattleMovesInput = Readonly<{
  /** True while `mode === 'moves'`. */
  open: boolean;
  /** The card in **page** coordinates: `menu` + the camera viewport's offset. */
  card: Rect;
  /** The four slots, exactly `padMoveGridCells(cells, MAX_MOVES)` of the canvas's own cells. */
  cells: readonly MoveGridSlot[];
  /** `menuIndex`. */
  selected: number;
  /** The slot whose ⓘ popup floats, or null. */
  info: number | null;
  mega: boolean;      // megaAvailable()
  gmax: boolean;      // gmaxAvailable()
  megaArmed: boolean; // megaIntent
  gmaxArmed: boolean; // gmaxIntent
}>;

export type BattleMoveSlotView = Readonly<{
  index: number;
  empty: boolean;
  name: string;
  type: string;
  category: string;
  pp: string;      // t('move.pp', …)
  power: string;   // t('move.pwr' | 'move.pwrNone', …)
  accuracy: string;// t('move.acc' | 'move.accNone', …)
  /** Green when power > basePower, red when below, ink when level (the canvas's own rule). */
  powerTone: 'up' | 'down' | 'level';
  accuracyTone: 'up' | 'down' | 'level';
  enabled: boolean;
  selected: boolean;
  box: Rect;                    // page coordinates
  /** The ⓘ button: `{ x: box.x + box.w - 36, y: box.y + 8, w: 22, h: 22 }`, empty slots none. */
  info: Rect | null;
}>;

export type BattleMovesView = Readonly<{
  open: boolean;
  card: Rect;
  slots: readonly BattleMoveSlotView[];
  back: Readonly<{ label: string; box: Rect }>;
  mega: Readonly<{ label: string; box: Rect; armed: boolean }> | null;
  gmax: Readonly<{ label: string; box: Rect; armed: boolean }> | null;
  /** The floating description card: the move's, or null when nothing is pinned. */
  info: Readonly<{ title: string; type: string; category: string; text: string; box: Rect }> | null;
}>;

export const MOVE_GRID_INSET = 8;   // MOVE_GRID_INSET
export const MOVE_BACK_COL = 64;    // MOVE_BACK_COL
export const MOVE_MEGA_COL = 62;    // MOVE_MEGA_COL
export const MOVE_GMAX_COL = 62;    // MOVE_GMAX_COL
export const BATTLE_STAGE_MAX = 900;   // MAX_BATTLE_SIZE
export const BATTLE_COMPACT = 700;     // COMPACT_SIZE
export const MOVE_INFO_SIZE = 22;      // the canvas's INFO_SIZE

/** The page-space card the scene's own `menu` rect becomes (see the arithmetic below). */
export function battleMovesBox(viewport: Viewport): Rect;
export function battleMovesView(input: BattleMovesInput): BattleMovesView;
```

`battleMovesBox` mirrors `refreshHud`'s stage and menu arithmetic exactly:

```
wide   = width > height
stageW = wide ? min(height, 900) : width
stageH = wide ? stageW : height
offX   = round((width  - stageW) / 2)
offY   = round((height - stageH) / 2)
compact = stageW < 700
menu   = compact ? { x: 16, y: stageH - 236 - 16, w: stageW - 32, h: 236 }
                 : { x: 36, y: stageH - 218,      w: stageW - 72, h: 192 }
card   = { x: offX + menu.x, y: offY + menu.y, w: menu.w, h: menu.h }
```

so `battleMovesBox({1280,800}) = {x:276,y:582,w:728,h:192}` and
`battleMovesBox({390,844}) = {x:16,y:592,w:358,h:236}`. The scene's `card` must equal
it; a `[live]` criterion compares the DOM rect against it, so a drift fails the task
instead of the diff.

Inside the card, the geometry is the canvas's own:

- `pad = { x: 20, top: 16, bottom: 8 }` (`FRLG_WINDOW_PADDING`);
- `left = card.x + pad.x + backW`, `right = card.x + card.w - pad.x - MOVE_GRID_INSET -
  (mega ? 62 : 0) - (gmax ? 62 : 0)`, `top = card.y + pad.top + 8`,
  `bottom = card.y + card.h - pad.bottom - 8`, where `backW = MOVE_BACK_COL`;
- the four slot rects come from **`moveGridCellRects`** with
  `{ x: card.x, y: card.y, w: card.w, h: card.h, cells, selected, info,
  leftReserve: MOVE_BACK_COL, rightReserve: (mega ? 62 : 0) + (gmax ? 62 : 0) }` —
  the identical call the canvas makes, so the two grids can never diverge;
- `back.box = { x: card.x + pad.x, y: card.y + card.h / 2 - 18, w: 64, h: 36 }`
  with `label: '◀'`;
- `mega.box = { x: right - 62, y: top, w: 62, h: bottom - top }`;
  `gmax.box = { x: right - (mega ? 62 : 0) - 62, y: top, w: 62, h: bottom - top }`;
- the info card floats **above** the pinned cell when there is room
  (`cell.y - gap - height ≥ card.y`) and below it otherwise; `height = 48 +
  13 · lines` where `lines = ceil(text.length / 44)` per `\n`-separated paragraph
  (the shipped `InfoPopup` floor), `w = card.w - 2 · 20`, `gap = 8`.

`battleMovesView` is **pure and total**: any `selected`/`info` outside `0…3` clamps,
an empty slot yields `info: null` and empty strings, `mega`/`gmax` `null` when their
flag is false, and two calls with the same input are deep-equal.

### `src/ui/hud/panels/battle-moves/mount.tsx`

```ts
export type BattleMovesController = Readonly<{
  /** Pushes the menu's state; a closed menu hides the card but keeps it mounted. */
  update(input: BattleMovesInput): void;
  dispose(): void;
}>;

export function mountBattleMoves(host: Element): BattleMovesController;
```

The `mountBattleHp` shape exactly: a `<div class="battle-moves-mount">` appended to
`host`, an empty card painted on mount so `[data-hud-panel="battle-moves"]` exists
from the moment the battle mounts, `render(h(BattleMoves, { view }), container)` per
update, and a `dispose()` that renders `null` and removes the container.

```ts
/** The panel's own command channel: plain data, never a battle state. */
export type BattleMovesIntent =
  | Readonly<{ type: 'move'; moveIndex: number }>
  | Readonly<{ type: 'info'; moveIndex: number | null }>
  | Readonly<{ type: 'mega' }>
  | Readonly<{ type: 'gmax' }>
  | Readonly<{ type: 'back' }>;
```

`mountBattleMoves` takes the intent sink as a second argument:
`mountBattleMoves(host, onIntent?: (intent: BattleMovesIntent) => void)`. The shared
`src/ui/hud/commands.ts` union is **not** extended: it has no battle-menu variant, its
owner is not in this batch, and the scene is the only receiver.

### `src/ui/hud/panels/battle-moves/index.ts` — the barrel

```ts
export { BattleMoves } from './battleMoves';
export type { BattleMovesProps } from './battleMoves';
export { mountBattleMoves } from './mount';
export type { BattleMovesController, BattleMovesIntent } from './mount';
export {
  BATTLE_COMPACT, BATTLE_STAGE_MAX, MOVE_BACK_COL, MOVE_GMAX_COL, MOVE_GRID_INSET,
  MOVE_INFO_SIZE, MOVE_MEGA_COL, battleMovesBox, battleMovesView,
} from './view';
export type { BattleMoveSlotView, BattleMovesInput, BattleMovesView, Rect, Viewport } from './view';
```

### DOM contract (`battleMoves.tsx`)

- `div.battle-moves` with `data-hud-panel="battle-moves"`, `data-open`,
  `hidden={!view.open}`, `position: fixed` at `view.card`, `pointer-events: none` on
  the root and `auto` on every control (the canvas's own pads and keys keep every
  other press).
- `[data-hud-move-slot="0…3"]` — a `<button type="button">` per slot,
  `data-selected`, `data-enabled`, `data-empty`; inside it the name, a
  `TypeBadge` for the type, a category label, and the PP / PWR / ACC lines.
- `[data-hud-move-info="<index>"]` — the ⓘ button, present only on a filled slot; the
  floating card is `[data-hud-move-desc]`.
- `[data-hud-move-back]`, `[data-hud-move-mega]`, `[data-hud-move-gmax]` — the three
  controls, each `aria-pressed` for the armed state.
- The card paints with the board's `05` cell skin: radius 8 per slot, the 12 % accent
  fill and solid accent border on the selected cell (`--hud-accent`), the 4 % / 8 %
  row pair otherwise, 10 px body text with a px line box from `root.css`.

### `src/scenes/BattleScene.ts` — the seam

Everything the battle draws today stays; the edits are the ones `[Task-140]` already
made for the HP boxes, in the same file and the same order:

1. Import `mountBattleMoves`, `battleMovesBox`, and the types from
   `../ui/hud/panels/battle-moves`.
2. Field: `private movesController: BattleMovesController | null = null;`.
3. Mount once per battle, beside `this.mountHpPanel()` in `create()`:
   `this.mountMovesPanel()` — the `DOM_HUD` + `typeof document === 'undefined'`
   guard, `document.getElementById('hud')`, `mountBattleMoves(host, (intent) => this.onBattleMoveIntent(intent))`.
   Dispose it in the same shutdown handler that calls `this.disposeHpPanel()`.
4. **One emit point.** `refreshHud`'s existing `if (DOM_HUD) { syncHud(…, (next) =>
   this.hpController?.update(next)); }` gains **one** more statement in the same block:
   `this.movesController?.update(this.battleMovesInput(menu));`, where
   `battleMovesInput(menu)` is a private method that returns
   `{ open: this.mode === 'moves', card: { x: menu.x + offX, y: menu.y + offY, w: menu.w,
   h: menu.h }, cells: padMoveGridCells(<the same cells renderMoveMenu builds>, MAX_MOVES),
   selected: this.megaSelected || this.gmaxSelected ? -1 : this.menuIndex, info: this.infoMove,
   mega: this.megaAvailable(), gmax: this.gmaxAvailable(), megaArmed: this.megaIntent,
   gmaxArmed: this.gmaxIntent }`. `offX`/`offY` are the camera viewport's origin that
   `refreshHud` already computes for `setViewport`. **Build the cells once**: hoist the
   `menuItems.map(item => ({ … }))` that `renderMoveMenu` does today into a private
   `moveCells()` used by both branches, so the DOM and the canvas can never read
   different data (that is the whole point of the task).
5. `renderMoveMenu(menu)`: `if (DOM_HUD) { this.hideMoveChrome(); this.menuPanel.setVisible(false);
   /* the message box stays hidden: menuOpen is true */ return; }` before it paints
   anything. The canvas keeps drawing the *command* grid, the bag, the party grid and
   the INFO window — none of those is this task.
6. `onBattleMoveIntent(intent)` — the only receiver, mapping every intent to the
   shipped call, never to a new rule:
   - `move` → `this.menuIndex = clamp(index); this.chooseMove(this.commandSlot, this.menuIndex);`
     (`chooseMove` is what a canvas press and a `confirm` key already reach, and it
     submits the engine's own `{ type: 'fight', moveIndex, … }`);
   - `info` → `this.infoMove = index; this.infoPinned = index !== null; this.refreshHud();`
   - `mega` → `this.toggleMega(); this.refreshHud();`
   - `gmax` → `this.toggleGmax(); this.refreshHud();`
   - `back` → `this.onBack();` (the canvas `backZone`'s own handler).
   It must not write the battle state, the turn or the bag: forces, PP and money stay
   the engine's.
7. `export function`-style probe: add `movesDrawnObjectCount(): number` beside
   `hpDrawnObjectCount()`, counting the visible objects this menu owns
   (`this.menuPanel`, `this.backArrow`, `this.megaCell`, `this.megaGlyph`,
   `this.gmaxCell`, `this.gmaxGlyph` and the grid's own cells through
   `this.moveGrid.cellRect(i) !== null`): `0` under the flag when the menu is closed
   **and** when it is open.

**Determinism:** reads no `Rng` stream and no clock; every pick reaches the same
engine call a key press reaches, so a fixed seed's battle replays identically with
the flag on or off. `battleMovesView` is pure data in, pure data out.

**Rules:** `view.ts` imports no Phaser and touches no DOM (it imports `moveGrid`'s
pure functions, `t()` and types only); only `*.tsx`/`mount.tsx` import Preact. No new
dependency. The arena, the sprites, the effects, `this.hud` (the canvas Graphics) and
every damage number stay exactly as they are.

### Data

- No engine, save, `SAVE_VERSION`, RNG or battle-rule change.
- New fixture: **`design/fixtures/05-battle-hud.json`** (below).
- No i18n key is added: the panel reuses `move.pp`, `move.pwr`, `move.pwrNone`,
  `move.acc`, `move.accNone`, `battle.mega`, `battle.megaIntent`, `battle.gmax`,
  `battle.gmaxIntent`. `src/i18n/**` is **not** edited.

## 🧩 Data and configuration

`design/fixtures/05-battle-hud.json` — the frame's own copy, in the established shape
(`{ slug, state, <panel block> }`, extra keys allowed):

```json
{
  "slug": "05-battle-hud",
  "state": { "party": [], "bag": [], "money": null, "route": null, "battle": null, "notice": null },
  "moves": {
    "card": { "x": 276, "y": 582, "w": 728, "h": 192 },
    "selected": 0,
    "info": 0,
    "mega": true,
    "gmax": false,
    "megaArmed": false,
    "gmaxArmed": false,
    "cells": [
      { "name": "FLAMETHROWER", "type": "fire",   "category": "Special", "pp": 12, "maxPp": 15, "power": 90,  "basePower": 90,  "accuracy": 100, "baseAccuracy": 100, "desc": "THE FOE IS SCORCHED WITH AN INTENSE BLAST OF FIRE.\nIT MAY ALSO LEAVE THE TARGET WITH A BURN.", "status": "brn", "enabled": true },
      { "name": "AIR SLASH",    "type": "flying", "category": "Special", "pp": 15, "maxPp": 15, "power": 75,  "basePower": 75,  "accuracy": 95,  "baseAccuracy": 95,  "desc": "…", "status": null, "enabled": true },
      { "name": "DRAGON CLAW",  "type": "dragon", "category": "Physical", "pp": 10, "maxPp": 10, "power": 80, "basePower": 80, "accuracy": 100, "baseAccuracy": 100, "desc": "…", "status": null, "enabled": true },
      { "name": "EARTHQUAKE",   "type": "ground", "category": "Physical", "pp": 8,  "maxPp": 10, "power": 100, "basePower": 100, "accuracy": 100, "baseAccuracy": 100, "desc": "…", "status": null, "enabled": true }
    ]
  }
}
```

- `state` is the empty `HudState` (it passes `isHudState` unchanged): this panel reads
  `BattleMovesInput`, not `HudState` — say so in the folder README.
- `moves.cells` are `MoveGridCell` **verbatim** (the type the canvas already feeds),
  with the frame's own strings and numbers: `FLAMETHROWER` `PP 12/15` `PWR 90`
  `ACC 100`, `AIR SLASH` `PP 15/15` `PWR 75` `ACC 95`, `DRAGON CLAW` `PP 10/10`
  `PWR 80` `ACC 100`, `EARTHQUAKE` `PP 8/10` `PWR 100` `ACC 100`, and the frame's
  FIRE / FLYING / DRAGON / GROUND chips.
- `moves.card` is the desktop card at 1280×800 (`battleMovesBox`'s own value), so the
  fixture and the view agree by construction.
- `selected: 0` and `info: 0` reproduce the frame's highlighted first cell and its
  open description window; `mega: true` reproduces the MEGA column the frame draws.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; green including
    `src/ui/hud/panels/battle-moves/view.test.ts` and `fixture.test.ts`.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-141` audited against **Exclusive paths**.
  - The browser pass is only for the `[live]` criteria. Run them in the battle the
    dev route offers (walk into tall grass) at 1280×800 and 390×844.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `src/ui/hud/panels/battle-moves/view.test.ts` exists and passes and
        pins: `battleMovesBox({1280,800}) = {276,582,728,192}` and
        `battleMovesBox({390,844}) = {16,592,358,236}`; the four slot rects of a full
        four-cell input equal `moveGridCellRects` called with the same card plus
        `leftReserve: 64` / `rightReserve: 62` (with `mega: true`, `gmax: false`) and
        with `rightReserve: 0` (both false) — the test derives both sides from that
        one call instead of hard-coding them twice; the ⓘ box at
        `{x: slot.w − 36, y: 8, w: 22, h: 22}`; `back.box = {296, 660, 64, 36}`;
        `mega.box.w = 62`, `mega.box.x = 852` (`right 914 − 62`), and
        `gmax === null` when `gmax: false`.
  - [ ] `[unit]` `view.test.ts` also asserts: purity and no input mutation; clamping
        of `selected`/`info`; an empty slot has `info: null`, empty strings and the
        row tone `'level'`; `powerTone`/`accuracyTone` are `'up'`, `'down'`, `'level'`
        for `power >/<== basePower` and `accuracy >/<== baseAccuracy`, and `'level'`
        when either half is `null`; the info card's height rule (`48 + 13·lines`) and
        its above/below choice at both ends of the card.
  - [ ] `[unit]` `fixture.test.ts` imports the fixture, asserts `state` passes
        `isHudState`, and asserts `battleMovesView(fixture.moves)` reproduces
        `"FLAMETHROWER"`, `t('move.pp', { pp: 12, max: 15 })`, `t('move.pwr', { value: 90 })`,
        `t('move.acc', { value: 100 })`, four slots in order, `selected === 0`,
        `info.title === 'FLAMETHROWER'` and `mega !== null`.
  - [ ] `[unit]` `grep -rn "from 'phaser'\|document\.\|Math.random\|Date.now\|window\." src/ui/hud/panels/battle-moves/view.ts` prints nothing.
  - [ ] `[unit]` `git diff --name-only main...task-141` ⊆ the three entries above; the
        diff of `src/scenes/BattleScene.ts` adds no change outside `DOM_HUD`-guarded
        branches plus the new private methods and the probe.
  - [ ] `[live]` **The card is the derived rect at both sizes.** In a battle with
        `?hud=dom`, press FIGHT, then
        `document.querySelector('[data-hud-panel="battle-moves"]').getBoundingClientRect()`
        is `276,582 728×192` at 1280×800 and `16,592 358×236` at 390×844, Δ ≤ 1 px per
        edge; `getComputedStyle` on the selected slot gives `border-radius: 8px` and a
        1 px `rgb(125, 211, 252)` border.
  - [ ] `[live]` **The canvas draws nothing under the flag.** With the move menu open,
        `movesDrawnObjectCount()` returns `0` and `hpDrawnObjectCount()` still returns
        `0`; with the flag off and the same menu open, `movesDrawnObjectCount()` > 0.
  - [ ] `[live]` **A pick reaches the engine.** At 1280×800 with `?hud=dom`, open
        FIGHT, click the third slot (`[data-hud-move-slot="2"]`), and after the turn
        resolves read the battle's own readout: `__pkmBattle.state.turn` advanced by
        one and one of the log entries appended by that turn is
        `{ key: 'battle.log.used' }` whose `params.move` is that slot's move name;
        press the same slot with the flag off and compare: same turn delta, same
        `battle.log.used` move.
  - [ ] `[live]` **The ★ controls are the armed state.** Click `[data-hud-move-mega]`
        and read `__pkmBattle.megaIntent === true` and the button's `aria-pressed`;
        click it again and both read `false`. With `gmax` unavailable the
        `[data-hud-move-gmax]` node is absent.
  - [ ] `[live]` **The ⓘ is the description.** Click `[data-hud-move-info="0"]` and
        read `[data-hud-move-desc]`: its text equals the first cell's `desc` from
        `__pkmBattle.menuItems[0].move.desc`, and its rect sits within the card
        (`card.y ≤ desc.y` or `desc.y + desc.h ≤ card.y + card.h`).

## 📣 Coordination

- **For the Orchestrator:** this is the batch's single claim on
  `src/scenes/BattleScene.ts`; no other task in the batch may touch it. The flag is
  `?hud=dom`; the fixture slug is `05-battle-hud`; the tests are `view.test.ts` and
  `fixture.test.ts` under `src/ui/hud/panels/battle-moves/`.
  - Two facts the backlog gets wrong, both handled above: the four-slot move menu is
    drawn by the **`05-battle-hud` / `m05-battle-hud`** frame (`move cell 0…3`,
    `move pp/power/acc`, `move chip 0 FIRE`), **not** by `05d Battle · pokemon`, which
    is the switch/party screen (`[Task-143]`'s frame); and the board places the battle
    window bottom-right (`576×216` at `664,544`) while the shipped battle stage draws
    a full-width bottom box — this task reproduces the shipped `menu` rect (the
    message box, the bag, the party grid and the INFO window all read it, and the
    arena must not move), painted with the board's cell skin. Adopting the board's
    bottom-right card is a battle-layout change no task owns.
  - The battle lane's gate is DOM-vs-derived-rect parity plus `movesDrawnObjectCount()`
    and the engine's own log, as `[Task-140]` did for the HP boxes; `npm run hud:diff`
    is the `02-options` gate and is not run here.
- **For the next batch:** `BattleMovesIntent` (like `DetailIntent` and `ShopIntent`) is
  a panel-local channel; a task that widens `src/ui/hud/commands.ts` should fold all
  three in one change. `[Task-142]` (battle bag) and `[Task-143]` (battle switch) sit
  on the same `mountBattleHp`-style controller and can copy `mountBattleMoves`
  verbatim; `[Task-144]` (message box) takes the last `BattleScene.ts` slot, so it must
  build on this task's `refreshHud` emit block rather than restructure it.

## ⛔ Out of scope

- No engine, `src/engine/**`, save, `SAVE_VERSION`, RNG or battle-rule change; no
  arena, sprite, effect, shake, flash, fade or floating-damage-number change.
- No other battle window: the command grid (FIGHT / BAG / POKEMON / RUN), the bag, the
  switch grid, the INFO window (`src/ui/battleInfo.ts`) and the message box keep their
  canvas drawing and are `[Task-142]`/`[Task-143]`/`[Task-144]`'s.
- No `src/ui/hud/commands.ts` change, no `src/ui/hud/state.ts` change (the panel is fed
  by the scene's own `menuItems`, not by the shared snapshot).
- No new i18n key and no `src/i18n/**` edit; no `hud:diff` change; no kit change.
- No HTML5 drag and drop: a slot is a press, and the pick is one `chooseMove`.
