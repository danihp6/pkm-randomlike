# Spec: Task-206 — The battle's command menu is the HUD's

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** DOM panel (new) + Phaser scene wiring + docs.
- **Role:** Dev.
- **Objective:** after this task the battle's FIGHT / BAG / SWITCH / RUN window is a Preact
  card in `#hud` like every other battle panel: a new
  `src/ui/hud/panels/battle-command/` mounts at the same card rect the move menu uses,
  paints one button per command with the board's row skin, the selected and disabled states
  and the fifth INFO control, and the scene stops drawing the window under `?hud=dom` and
  answers the card's intents through the same `confirmMenu`/`openInfo` path the keyboard and
  the canvas zones already take.
- **Environment:** worktree `../wt-pkm-206`, branch `task-206`.
- **Dependencies:** none to merge. It reads (never writes)
  `src/ui/hud/panels/battle-moves/{view.ts,index.ts}` for `battleMovesBox`, `compactCard`,
  `MOVE_MEGA_COL` and `MOVE_GRID_INSET` — all frozen by `[Task-203]`, which runs in
  parallel and does not touch them — and it reads
  `src/ui/hud/panels/battle-hp/view.ts` (`battleHpBox`, `battleHpLayout`) and
  `src/ui/hud/panels/battle-log/*` as the mount pattern to copy.

### Exclusive paths (single writer)

Nothing outside this list. No other task in Batch 87 claims any of these.

- `src/ui/hud/panels/battle-command/view.ts` *(new)*
- `src/ui/hud/panels/battle-command/view.test.ts` *(new)*
- `src/ui/hud/panels/battle-command/battleCommandPanel.tsx` *(new)*
- `src/ui/hud/panels/battle-command/battleCommand.css` *(new)*
- `src/ui/hud/panels/battle-command/mount.tsx` *(new)*
- `src/ui/hud/panels/battle-command/index.ts` *(new)*
- `src/ui/hud/panels/battle-command/README.md` *(new)*
- `src/ui/hud/panels/README.md`
- `src/scenes/BattleScene.ts`
- `src/scenes/BattleScene.test.ts`
- `docs/hud-fidelity.md` — **§5's `**Battle zones.**` block only**
- `docs/design-spec.md` — **§4 only**

### Inputs (read-only)

Beyond `AGENTS.md`:

- `src/ui/hud/panels/battle-moves/{view.ts,mount.tsx,battleMoves.tsx,battleMoves.css,README.md}`
  (the card rect, the cell skin, the intent/mount shape).
- `src/ui/hud/panels/battle-hp/view.ts` (`battleHpBox`, `battleHpLayout`).
- `src/ui/hud/kit/{index.ts,row.tsx,panel.tsx}` and `src/ui/hud/styles/root.css` (tokens).
- `src/scenes/BattleScene.ts` — read it whole around the seams you touch:
  `openMenu()` and `openPartnerMenu()` (the `menuItems` table and the disabled rules),
  `moveMenuGrid()` (`MENU_GRID_COLS = 2`, `MENU_GRID_GAP = 8`),
  `renderCommandMenu()` (the grid arithmetic and `layoutInfoControl`),
  `layoutInfoControl()`, `refreshHud()` (the `DOM_HUD` push block),
  `mountBattleMoves()` / `mountBattleLogPanel()` (the mount pattern),
  `hideMenu()`, `confirmMenu()`, `openInfo()`, `onMenuHover()`.
- `design/frames/05-battle-hud.json`: `battle menu` 576×216 at (664,544), `menu tab 0…3`
  128×30 at x 684/820/956/1092 y 564, the four `FIGHT`/`BAG`/`POKEMON`/`RUN` labels at
  y 573, and the four `move cell` boxes the card already carries.
- `docs/design-spec.md` §4, `docs/hud-fidelity.md` §5.

## 🔒 Contract

### TypeScript — the view (`src/ui/hud/panels/battle-command/view.ts`)

```ts
import type { Rect, Viewport } from '../battle-moves/view';   // re-export as your own aliases

export type BattleCommandRowId = 'fight' | 'bag' | 'switch' | 'run';

/** One command the scene offers, in the order the canvas grid draws it. */
export type BattleCommandRow = Readonly<{
  id: BattleCommandRowId;
  /** Already localised (`t('battle.command.*')`): the view reads no i18n. */
  label: string;
  /** False draws it dimmed; a press still emits and the scene refuses it. */
  enabled: boolean;
}>;

export type BattleCommandInput = Readonly<{
  /** True while `mode === 'menu'` or `mode === 'partner'`. */
  open: boolean;
  /** The battle menu card in **page** coordinates: `battleMovesBox(viewport)`. */
  card: Rect;
  /** One entry per offered command: four for the lead, two for the partner. */
  rows: readonly BattleCommandRow[];
  /** `menuIndex`, clamped by the view. */
  selected: number;
  /** True while the keyboard cursor sits on the INFO control. */
  infoSelected: boolean;
  /** `t('battle.infoControl')`. */
  infoLabel: string;
}>;

export type BattleCommandRowView = Readonly<{
  id: BattleCommandRowId;
  label: string;
  enabled: boolean;
  selected: boolean;
  /** Page coordinates. */
  box: Rect;
}>;

export type BattleCommandView = Readonly<{
  open: boolean;
  /** True for the 236 px phone card (`compactCard`). */
  compact: boolean;
  card: Rect;
  rows: readonly BattleCommandRowView[];
  /** The fifth control in the right column; null only when there are no rows. */
  info: Readonly<{ label: string; selected: boolean; box: Rect }> | null;
}>;

/** The page rect of the card the command window shares with the move menu. */
export function battleCommandBox(viewport: Viewport): Rect;

export function battleCommandView(input: BattleCommandInput): BattleCommandView;
```

Frozen geometry (mirror `renderCommandMenu`, do not invent):

- `battleCommandBox(viewport)` **returns `battleMovesBox(viewport)`** — the same card: the
  battle square's menu box plus the camera viewport's origin. 1280×800 ⇒
  `{ x: 440, y: 582, w: 564, h: 192 }`; 390×844 ⇒ `{ x: 16, y: 592, w: 358, h: 236 }`.
- Grid, with `pad = { x: 20, top: 16, bottom: 8 }` (`FRLG_WINDOW_PADDING`), `inset = 8`
  (`MOVE_GRID_INSET`), `infoCol = 62` (`MOVE_MEGA_COL`), `gap = 8`, `cols = 2`:
  `left = card.x + 28`, `right = card.x + card.w - 90`,
  `top = card.y + 24`, `bottom = card.y + card.h - 16`,
  `rows = max(1, ceil(count / 2))`, `cellW = (right - left - gap) / 2`,
  `cellH = (bottom - top - (rows - 1) * gap) / rows`,
  a row's box at `index`: `x = left + (index % 2) * (cellW + gap)`,
  `y = top + floor(index / 2) * (cellH + gap)`.
  Measured: 1280 ⇒ cells **219×72** in two rows; 390 ⇒ **116×94**; the partner menu's two
  rows are one full-height row (152 / 196 tall).
- `info.box = { x: card.x + card.w - 90, y: top, w: 62, h: bottom - top }` — 1280
  `{ x: 914, y: 606, w: 62, h: 152 }`, 390 `{ x: 284, y: 616, w: 62, h: 196 }`.
- `selected` is clamped into `0 … rows.length - 1` (`NaN` lands on 0, an empty list selects
  nothing); when `infoSelected` is true exactly **one** row has `selected: false` and
  `info.selected` is true — the cursor is on the fifth control.
- `info` is `null` only when `rows.length === 0`; a view with no rows still returns `card`
  and `compact` so the mounted card can paint its frame.
- Pure and total: no RNG, no clock, no i18n, no engine, no Phaser. The same input returns a
  deep-equal view.

### TypeScript — the panel, mount and barrel

```ts
// battleCommandPanel.tsx
export type BattleCommandPanelProps = Readonly<{
  view: BattleCommandView;
  onIntent?: ((intent: BattleCommandIntent) => void) | undefined;
}>;
export function BattleCommandPanel(props: BattleCommandPanelProps): JSX.Element;

// mount.tsx — the panel's own channel, exactly like `BattleMovesIntent`
export type BattleCommandIntent =
  | Readonly<{ type: 'hover'; index: number }>
  | Readonly<{ type: 'press'; index: number }>
  | Readonly<{ type: 'info' }>;

export type BattleCommandController = Readonly<{
  update(input: BattleCommandInput): void;
  dispose(): void;
}>;

export function mountBattleCommand(
  host: Element,
  onIntent?: (intent: BattleCommandIntent) => void,
): BattleCommandController;
```

- `index.ts` re-exports the panel, `BattleCommandPanelProps`, `mountBattleCommand`,
  `BattleCommandController`, `BattleCommandIntent`, `battleCommandBox`,
  `battleCommandView` and the types `BattleCommandInput`, `BattleCommandRow`,
  `BattleCommandRowId`, `BattleCommandRowView`, `BattleCommandView`, `Rect`, `Viewport`.
- The panel's root is `<div class="battle-command" data-hud-panel="battle-command"
  data-open="true|false" data-compact="true|false" hidden={!open}>`, `position: fixed` at
  `card`, `pointer-events: none`, and only its buttons take a press — the same contract as
  `battle-moves`/`battle-log`. The card's own glass is painted by this panel
  (`rgb(16 22 31 / 90%)` + a 1 px `--hud-panel-border` inset shadow, the token only).
- Each row is a `<button type="button" class="battle-command__row"
  data-hud-command={id} data-selected data-enabled aria-disabled={!enabled}
  data-hud-command-box>` at its `box`, `aria-pressed={selected}`, carrying the label in a
  span. It fires `onIntent({ type: 'hover', index })` on `onPointerEnter`, and
  `onIntent({ type: 'press', index })` on click. **A disabled row is never `disabled`** —
  the canvas keeps it reachable and lets `confirm` refuse it, so the card must too.
- The INFO control is a `<button class="battle-command__info" data-hud-command-info>`
  at `info.box`, `aria-pressed={info.selected}`, firing `{ type: 'info' }`.
- Row skin (board `05`'s `menu tab`): radius 6 (`--hud-row-radius`), 4 % white fill and 8 %
  white border for an ordinary row, `rgb(125 211 252 / 16%)` fill + solid accent border for
  the selected one, `opacity: 0.4` for a disabled one, label centred, 10 px / 13 px
  (`--hud-type-body-size`/`-line`), uppercase, `max-width: calc(100% - 32px)` so a long
  label never leaves its box. No literal colour: tokens and the two accent alphas only.
- `install`-time state: `mountBattleCommand` paints one closed view
  (`{ open: false, card: { x: 0, y: 0, w: 0, h: 0 }, rows: [], selected: 0,
  infoSelected: false, infoLabel: '' }`) so `[data-hud-panel="battle-command"]` exists from
  the moment the battle mounts, exactly like `mountBattleMoves`'s `CLOSED`.

### TypeScript — the scene (`src/scenes/BattleScene.ts`)

1. Import `mountBattleCommand`, `type BattleCommandController`,
   `type BattleCommandIntent` and `battleCommandView` from
   `'../ui/hud/panels/battle-command'`.
2. Field: `private commandController: BattleCommandController | null = null;` beside
   `movesController`.
3. A `mountBattleCommandPanel()` (or the same shape `mountBattleMoves` uses, called from
   `create()` on the `DOM_HUD` path):
   ```ts
   if (!DOM_HUD || typeof document === 'undefined') return;
   const host = document.getElementById('hud');
   if (host === null) return;
   this.commandController = mountBattleCommand(host, (intent) => this.onBattleCommandIntent(intent));
   ```
4. `renderCommandMenu(menu)` gains the canvas-off branch **as its first statement**, the
   same way `renderMoveMenu` and `renderBagMenu` already do it:
   ```ts
   if (DOM_HUD) {
     this.hideMenu();
     return;
   }
   ```
   (`hideMenu()` already hides `menuPanel`, `menuCursor`, `menuRows`, disables `menuZones`,
   `hideMoveChrome()`, `hidePartyGrid()`, `hideBagChrome()`, `hideInfoControl()` and the
   back arrow — do not hand-roll a second list.)
5. A private input builder, fed from the same fields the canvas reads:
   ```ts
   private battleCommandInput(menu: Rect): BattleCommandInput {
     return {
       open: this.mode === 'menu' || this.mode === 'partner',
       card: { x: menu.x, y: menu.y, w: menu.w, h: menu.h },
       rows: this.menuItems.map((item) => ({ id: COMMAND_IDS[...], label: item.label, enabled: item.enabled })),
       selected: this.menuIndex,
       infoSelected: this.infoSelected,
       infoLabel: t('battle.infoControl'),
     };
   }
   ```
   `menu` here is the **page** rect the scene lays the canvas out in, so the card must be
   `battleCommandBox({ width, height })`'s value, not the camera-local `menu`; use the same
   `{ width, height }` the `refreshHud` block already computed for the stage and let the
   view place it, so the two cards can never drift.
   The row **id** comes from the item's own order and label: `fight`, `bag`, `switch`, `run`
   for `mode === 'menu'` and `fight`, `switch` for `mode === 'partner'` (a `COMMAND_IDS`
   table keyed by mode, not by string matching a translated label).
6. `refreshHud()`'s `DOM_HUD` block pushes it once, after the moves push:
   ```ts
   this.commandController?.update(this.battleCommandInput(menu));
   ```
7. The intent handler mirrors the pointer path the canvas zones already take:
   - `hover` → `this.menuIndex = clamp(intent.index); this.infoSelected = false;
     this.refreshHud();` (the `onMenuHover` rule, including clearing the INFO/MEGA/G-MAX
     selections);
   - `press` → `this.menuIndex = clamp(intent.index); this.infoSelected = false;
     this.confirmMenu();`
   - `info` → `this.infoSelected = true; this.openInfo();`
   No new engine call, no new command path.

## 🧩 Data and configuration

No data, no key, no fixture, no `?hudFixture` slug (the `05` frame's fixture is
`battle-moves`'). Labels come from the shipped `battle.command.fight|bag|switch|run` and
`battle.infoControl` keys; the panel reads no i18n.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; green.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-206` audited against the exclusive-path list.
  - **Browser pass:** `npm run dev` (port **5175**), Chromium `/usr/bin/chromium`, the DOM
    HUD at `http://localhost:5175/?hud=dom`, viewports exactly **1280×800** and
    **390×844**; read the DOM/canvas over CDP (`getBoundingClientRect`,
    `getComputedStyle`, `elementFromPoint`), never a screenshot. The asset store is at
    `$ASSETS_ROOT` and is never symlinked into the worktree; a placeholders-only tree must
    play a battle (the `battle-hp`/`battle-log` cards draw no art).
  - **Starting a battle without the dev menu** (there is no `.env.development` in the tree,
    so the F-menu never installs): pick a starter, then walk into tall grass (a wild
    encounter) or into a trainer's line of sight — the command window is the first thing
    the battle shows.
- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` clean.
  - [ ] `[unit]` `npm test` green.
  - [ ] `[unit]` `battle-command/view.test.ts`: at 1280×800 `battleCommandBox` is
        `{ x: 440, y: 582, w: 564, h: 192 }` and four rows land on
        `{ x: 468, y: 606, w: 219, h: 72 }`, `{ x: 695, y: 606, … }`,
        `{ x: 468, y: 686, … }`, `{ x: 695, y: 686, … }`; at 390×844 the card is
        `{ x: 16, y: 592, w: 358, h: 236 }` and the cells are 116×94 at x 44 / 168,
        y 616 / 718; `info.box` is `{ x: 914, y: 606, w: 62, h: 152 }` / `{ x: 284, y: 616,
        w: 62, h: 196 }`.
  - [ ] `[unit]` `battle-command/view.test.ts`: a two-row partner input yields **one**
        full-height row (`h === 152` at 1280, `196` at 390), its boxes never intersect the
        INFO box, and every row box plus the INFO box lies inside the card at both
        viewports (`fitsInside` from `battle-moves`, 0.5 px tolerance).
  - [ ] `[unit]` `battle-command/view.test.ts`: no row box and no INFO box intersects any
        `battleHpBox(viewport, side, 0)` for `side` in `enemy`/`player` at either viewport.
  - [ ] `[unit]` `battle-command/view.test.ts`: with `selected: 3` rows 0-3 carry
        `selected` on index 3 only; with `infoSelected: true` **no** row is selected and
        `info.selected` is true; `selected: 9` clamps to the last row and `selected: NaN` to
        the first; `rows: []` returns `info === null` and still returns `card` and
        `compact`.
  - [ ] `[unit]` `battle-command/view.test.ts`: `enabled: false` passes through
        untouched for `bag`/`switch`/`run` in a party of one with an empty bag (the scene's
        flags, not the view's), and `battleCommandView` is pure (same input ⇒ deep-equal).
  - [ ] `[unit]` `BattleScene.test.ts`: the source reads
        `this.commandController?.update(this.battleCommandInput(menu));` exactly once,
        contains exactly one `mountBattleCommand(`, and `renderCommandMenu`'s first
        statement is the `DOM_HUD` branch (a regex over the source between
        `private renderCommandMenu(` and the next `private ` asserting `if (DOM_HUD)` comes
        before `this.menuPanel.setVisible(true)`); `hideMenu()` is still the one hider.
  - [ ] `[unit]` nothing outside the exclusive paths changed; `battle-moves/**` is
        untouched (it is `[Task-203]`'s).
  - [ ] `[live]` **1280×800:** in a battle, `[data-hud-panel="battle-command"]` exists with
        `data-open="true"`, `hidden` false, its rect equal to the card
        (`{ left: 440, top: 582, width: 564, height: 192 }` ± 1 px); it carries exactly four
        `[data-hud-command]` buttons in the order `fight`, `bag`, `switch`, `run`, each with
        a non-empty `textContent`; `[data-hud-command-info]` exists with the text `INFO`;
        and **the canvas draws no command window behind it** — the pixel at the card's
        centre matches the card's own fill (read via `Page.captureScreenshot` of that 1 px
        region, or assert `document.elementFromPoint(720, 640)` is inside the
        `battle-command` panel).
  - [ ] `[live]` **Clicking FIGHT** on that card sets `[data-hud-panel="battle-command"]`'s
        `data-open` to `false` and `[data-hud-panel="battle-moves"]`'s to `true` (the moves
        card opens); pressing `Esc` (or the `◀`) brings the command card back; **RUN** in a
        wild battle closes the battle and returns to the route (the
        `[data-hud-battle-hp]` root disappears from the DOM).
  - [ ] `[live]` **Disabled states:** in a battle where BAG has nothing usable and SWITCH
        has no bench (a one-Pokémon party with an empty bag), the `bag` and `switch`
        buttons carry `aria-disabled="true"` and a computed `opacity` of `0.4`, `run` in a
        trainer battle likewise, while `fight` is `aria-disabled="false"`; hovering a
        dimmed row still moves the selection (`data-selected="true"` moves onto it).
  - [ ] `[live]` **390×844:** the same card assertions with `data-compact="true"` and the
        rect `{ left: 16, top: 592, width: 358, height: 236 }` ± 1 px, four cells of
        116×94, and the card's top edge at least **8 px** below the player's HP card's
        bottom edge — measured per box: no `[data-hud-hp]` box's rect intersects the card's
        rect, and neither does `[data-hud-battle-log]`'s.

## 📣 Coordination

**Premises of the task entry I corrected against the tree:**

1. **"its four rows" is wrong.** The board's `05` draws the four commands as **four
   128×30 tabs in one row** (`menu tab 0…3` at x 684/820/956/1092, y 564) and the shipped
   game draws them as a **2×2 grid plus a fifth INFO control** (`renderCommandMenu`,
   `MENU_GRID_COLS = 2`; `docs/design-spec.md` §4 freezes the grid and the INFO column, and
   the keyboard map walks it in 2D). This task keeps the **game's 2×2 + INFO** and takes the
   board's row *skin* (128×30's radius 6, the 16 % accent selected fill, the 10/13 label):
   the geometry must match `BattleScene.renderCommandMenu` cell for cell, or the keyboard
   cursor and the card would disagree.
2. **The command window is not drawn "by Phaser only under `?hud=dom`"** — it is drawn by
   Phaser **always** today, because `renderCommandMenu` is the one menu with no `DOM_HUD`
   early return (`renderMoveMenu`, `renderBagMenu` and the party grid all have one). That
   missing branch *is* the defect; adding it is step 4 of the contract.
3. **The card rect already exists**: `battleMovesBox` builds the battle menu card the move
   menu uses, and the command menu shares that same card in the canvas (`menu =
   { x: box.x, y: box.y, w: box.w, h: box.h }`). Do not design a second rect; import
   `battleMovesBox` (via `battleCommandBox`) and let `[Task-203]` own it.
4. **The labels are already keyed**: `battle.command.fight`, `battle.command.bag`,
   `battle.command.switch`, `battle.command.run` and `battle.infoControl` (`INFO`) exist in
   both `en.ts` and `es.ts`. No i18n edit is yours.
5. **The disabled reasons are the scene's, already computed**: BAG `usableBag().length > 0`,
   SWITCH `hasBench()`, RUN `canRun(this.state, 'player')` (`openMenu()`), and the partner
   menu offers FIGHT/SWITCH only. The view only carries the flag; do not re-derive a rule.
6. There is **no `?hudFixture` slug** owed here: `05`'s fixture is claimed by
   `battle-moves`, and adding a second preview would collide with it. The panel's own
   `view.test.ts` is the coverage.

**The `docs/` boundary (law for this batch):**

- **`docs/hud-fidelity.md`** — you own **§5's block that opens `**Battle zones.**`** and
  nothing else in that file. Inside it: (a) say that the command window is the **same card**
  as the moves menu (`battleMovesBox`'s rect: 440 → 1004 at 1280×800, 358×236 at 390×844),
  so the four command cells occupy the boxes the four move cells occupy; (b) **correct the
  stale closing sentence** — "Inside a cell the category column ends 8 px left of the ⓘ …
  and prints right-aligned, so `SPECIAL` / `PHYSICAL` / `STATUS` cannot run under the ⓘ
  square" — to say the category is drawn as the atlas glyph in the box `[Task-203]`'s §5
  blocks describe (`MOVE_ICON_BOX`), because that sentence is now false. Do not touch
  §5's other blocks (`**Desktop.**`, `**Mobile.**`, `**Chips.**`, `**The pad**`,
  `**A cell's text is bounded by its own box.**`, `**The compact battle has its own
  cell.**`, `**The target step's prompt.**`), nor §6 (§203's), nor §9 (§199's), nor the
  measured table.
- **`docs/design-spec.md`** — you own **§4 only**. Two changes at most: the command-menu
  bullet names the DOM card as the window's painter under `D49` (`src/ui/hud/panels/
  battle-command/`, mounted like `battle-moves`), and the "battle's windows are the drawn
  chrome" sentence gains the command window in its list. No other section, and §2 belongs
  to `[Task-199]`.

- **For the Architect:** the entry's `docs/hud-fidelity.md` §5 claim is one block, not the
  whole section — recorded here so Integration QA can diff §5 block by block.
- **For `[Task-200]`** (the DOM HUD as the default, Batch 90): this panel is mounted behind
  `DOM_HUD` exactly like its five siblings, so that task's census finds
  `renderCommandMenu`'s canvas branch to delete like the others; the card it draws is
  `battleCommandBox`, which is `battleMovesBox` and already survives the flag.
- **For `[Task-208]`** (chip/drag/slot, Batch 91): this card positions itself at
  `battleCommandBox` and owns no drag; the shell will re-dock it.
- **For `[Task-213]`/`[Task-212]`** (the stage chips and the ball row, later batches): they
  add boxes to `battle-hp`; the command card's clearance (`card.x ≥ 440` on the desk,
  `card.y ≥ 592` on the phone, 8 px under the player's box) is what their new rows must
  respect; the view's non-intersection test here is the guard.

## ⛔ Out of scope

- No change to `battle-moves/**` (`[Task-203]`'s), to `battle-hp/**`, `battle-bag/**`,
  `battle-switch/**`, `battle-log/**` or the kit.
- No new i18n key, no new data, no fixture, no `preview.ts`.
- No change to `openMenu`/`openPartnerMenu`'s item table, the disabled rules, the INFO
  window (`renderInfoWindow`) or the keyboard map.
- No MEGA/G-MAX art in this card: those two controls belong to the **moves** card
  (`[Task-203]`'s panel) and the canvas's own columns; the command card only reserves the
  62 px INFO column, as `renderCommandMenu` already does.
- No back control: the command window is the root of the battle menus and the canvas draws
  none (`layoutBackButton(menu, false)`).
- No retheming of the card beyond the board's row skin; no drag, no collapse, no saved slot
  (`[Task-208]`).
