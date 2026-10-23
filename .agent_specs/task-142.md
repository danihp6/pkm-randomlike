# Spec: Task-142 — the battle's bag is the HUD's

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene + DOM panel migration (Phase 12, `D49`).
- **Role:** Dev.
- **Objective:** the battle's BAG window — its pocket chips, the search field, the
  5×2 item grid, the selected stack's detail line, the floating item card and the ◀
  back control — becomes a Preact panel in `src/ui/hud/panels/battle-bag/` mounted
  into `#hud` behind `?hud=dom`, and with the flag on `src/scenes/BattleScene.ts`
  draws none of it in canvas. The item rules do not move: one press still becomes
  the same `submit({ type: 'bag', itemId })`, the same pockets and the same
  `usableBag` filter.
- **Environment:** worktree `../wt-pkm-142`, branch `task-142`.
- **Dependencies:** merged on `main` before this branch:
  - `[Task-127]`, `[Task-124]`, `[Task-125]` — the flag spike, the shell and the kit.
  - `[Task-140]` and `[Task-141]` — the battle-lane precedent in the same scene:
    `mountHpPanel`/`mountMovesPanel`, `syncHud`, `battleMovesInput`,
    `onBattleMoveIntent`, `hidePanelKit`, `battleMovesDrawnObjectCount`. **Read
    them first**; this task is the same shape for the bag.

Before you write code, in your worktree: `npm ci`, then `npm test` once (baseline on
the base commit: 213 files / 3942 tests green).

### Exclusive paths (single writer)

**Nothing outside this list.**

- `src/scenes/BattleScene.ts`
- `src/ui/hud/panels/battle-bag/**` (new folder: `view.ts`, `view.test.ts`,
  `battleBagPanel.tsx`, `battleBag.css`, `mount.tsx`, `index.ts`,
  `fixture.test.ts`, `README.md`)
- `design/fixtures/05c-battle-bag.json` (new)

`src/ui/hud/panels/README.md` already lists `battle-bag/` — no edit. No
`src/scenes/panels/**` file is yours, and `src/scenes/panels/README.md` is
`Task-137`'s.

### Inputs (read-only)

- `src/ui/hud/panels/battle-moves/**` — **read only**: `battleMovesBox` is the same
  menu rect and `mountBattleMoves` the same controller shape. You may import
  `battleMovesBox` (do not copy its arithmetic, do not edit the file).
- `src/ui/hud/panels/battle-hp/**`, `src/ui/hud/state.ts` (`HudBattleBagRow`,
  `syncHud`), `src/ui/hud/commands.ts`.
- `src/ui/bag.ts` — `BagCategory`, `BAG_CATEGORIES`, `bagCategoryLabel`,
  `bagCategoryForKind`, `bagGridLayout`, `bagGridCell`, `stepBagGrid`,
  `filterBagStacks`, `BAG_GRID_COLS` (5), `BAG_GRID_GAP` (6). Never edited.
- `src/engine/battle/state.ts` — `BagSlot` (`{ item, count }`), `BattleState`,
  `noHeal`.
- `src/data/itemIcons.ts` — `ITEM_ICON_ATLAS_URL`, `ITEM_ICON_SIZE`,
  `itemIconFrame`; `src/data/anil/item-icons.json` (atlas columns).
- `src/data/items.ts` — `getItem` (`name`, `shortDesc`, `kind`).
- `src/scenes/BattleScene.ts`'s own bag state: `bagCategories`, `bagCategory`,
  `bagStacks`, `bagQuery`, `bagSearchFocused`, `menuIndex`, `usableBag()`,
  `filterBagStacks` call, `submit`, `openBag`, `cycleBagTab`, `selectBagTab`,
  `selectBagCell`, `typeInBagSearch`, `renderBagMenu`, `paintBagCells`, the constants
  `MENU_TAB_W/H/GAP`, `MENU_BAG_ROWS`, `MENU_BAG_CELL_MAX`, `MENU_BAG_DETAIL_H/GAP`,
  `MENU_BAG_CAP`, `BAG_INFO_W`, `BAG_INFO_GAP`, and `FRLG_WINDOW_PADDING`
  (`x 20, top 16, bottom 8`).
- `design/frames/05c-battle-bag.json` and `m05c-battle-bag.json` — the board's bag.
- `docs/hud-fidelity.md`, `docs/hud-dom-proposal.md` §6/§7,
  `docs/tech-decisions.md` `D49`, `D45`.

## 🔒 Contract

### The pure view

`src/ui/hud/panels/battle-bag/view.ts`:

```ts
import { battleMovesBox } from '../battle-moves';

export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;

/** The bag's card is the battle's menu box: one rect for every mode. */
export const battleBagBox = battleMovesBox;

export type BattleBagCell = Readonly<{
  /** The stack's index in `rows` (what a press sends back). */
  index: number;
  itemId: string;
  name: string;
  count: number;
  frame: number | null;   // the Añil item-atlas frame
  selected: boolean;
  box: Rect;              // card-relative
}>;

export type BattleBagInput = Readonly<{
  open: boolean;                   // mode === 'bag'
  card: Rect;                      // the battle's own `menu` rect, in page space
  tabs: readonly Readonly<{ category: BagCategory; label: string; active: boolean }>[];
  query: string;
  focused: boolean;
  rows: readonly Readonly<{ itemId: string; name: string; count: number }>[];
  selected: number;
  detail: string;                  // `${name} x${count}`, or t('battle.noItems')
  info: Readonly<{ text: string }> | null; // `${name}\n${shortDesc}`
  empty: string | null;            // t('battle.noItems') when no stack
}>;

export type BattleBagView = Readonly<{
  open: boolean;
  box: Rect;
  tabs: readonly Readonly<{ category: BagCategory; label: string; active: boolean; box: Rect }>[];
  search: Readonly<{ box: Rect; text: string; placeholder: string; focused: boolean }>;
  grid: Readonly<{ box: Rect; columns: number; rows: number; cellW: number; gap: number }>;
  cells: readonly BattleBagCell[];
  detail: Readonly<{ text: string; box: Rect }>;
  info: Readonly<{ text: string; box: Rect }> | null;
  empty: Readonly<{ text: string; box: Rect }> | null;
  back: Readonly<{ label: string; box: Rect }>;
}>;

export function battleBagView(input: BattleBagInput): BattleBagView;
```

- **The card is `battleMovesBox(viewport)`, re-exported, never recomputed.** The
  scene still passes `card` (page coordinates) exactly as `battleMovesInput` does,
  so the panel follows the camera layout the canvas already made.
- **Card-relative arithmetic, card size 728×192 at 1280×800 (the menu box), mirrored
  from `renderBagMenu`:**
  - content pad: `x = 20`, `top = 16`, `bottom = 8` (`FRLG_WINDOW_PADDING`);
  - tabs: one chip per offered pocket, 120×26, gap 4, at `y = 16`;
  - search: full content width, 24 px tall, at `y = 16 + 26 + 8 = 50`;
  - grid band: `y = 50 + 24 + 8 = 82`, height
    `card.h − 8 − 20 − 6 − 82 = 76`, **five columns** (`BAG_GRID_COLS`), **two rows**
    (`MENU_BAG_ROWS`), gap 6, cell side capped at 56 (`MENU_BAG_CELL_MAX`) — use
    `bagGridLayout` with `{ rows: 2, gap: BAG_GRID_GAP, maxCell: 56 }`, never your
    own fit;
  - detail line: 20 px tall at `y = card.h − 8 − 20`;
  - info card: 320 px wide, at `x = 20`, its bottom `8 px` above the grid band
    (`above = grid.y − 8`), its height `48 + 13 × lines`;
  - ◀: at `x = 20 + 14`, `y = (grid.y + card.h − 8) / 2`, a 36 px-tall glyph box.
  - The compact/phone card comes out of `battleMovesBox` (358×236 at 390×844) and
    the same arithmetic follows it; nothing is hand-tuned per viewport.
- **Cells:** one per stack, `bagGridCell` rects in row-major order, the selected cell
  gets the accent row pair, an empty tail cell draws the dim outline, the badge is
  `×N`, the icon is the atlas frame. `rows.length` never exceeds `MENU_BAG_CAP` (10).
- **Pure and total:** same input ⇒ deep-equal view; the input is never written; no
  Phaser, no DOM, no battle import, no RNG.

### The scene side

In `src/scenes/BattleScene.ts`, mirroring the moves controller exactly:

- new fields `bagController: BattleBagController | null` and the mount/dispose pair
  `mountBagPanel()` / `disposeBagPanel()` with the same `DOM_HUD` guard and
  `document.getElementById('hud')` lookup; called beside `mountMovesPanel()` at
  `create` (line 820) and disposed beside `disposeMovesPanel()` in the
  `shutdown` handler (line 816).
- `refreshHud`'s `if (DOM_HUD)` block (line 3137) also pushes
  `this.bagController?.update(this.battleBagInput(menu))`, after `syncHud`.
- `battleBagInput(menu: Rect): BattleBagInput` is `battleMovesInput`'s twin: the
  card from `battleMovesBox`, `open: this.mode === 'bag'`, the tabs from
  `bagCategories` with `bagCategoryLabel`, `rows` from `this.bagStacks`, `selected:
  this.menuIndex`, `detail`, `info`, `empty`, `query: this.bagQuery`, `focused:
  this.bagSearchFocused`.
- `renderBagMenu` early-returns under the flag (like `renderMoveMenu` at 4045):
  every canvas bag piece goes dark (`menuPanel`, `menuRows`, `menuZones`, tabs,
  search bg/text, cells, zones, detail, info popup, back arrow/zone) and the scene
  keeps feeding the card. `hideBagChrome` stays for the other modes.
- **Intents** (`mount.tsx` exports them): `tab(category)`, `select(index)`,
  `use(itemId)`, `search(query)`, `focus(focused)`, `scroll(delta)`, `back`.
  `onBattleBagIntent` lands each on the call the canvas already made:
  - `tab` → `selectBagTab`'s effect (`this.setBagItems(category)` with the same
    `bagQuery`/`bagSearchFocused` reset);
  - `select` → `this.selectBagCell(index)` (select, never submit);
  - `use` → `this.menuIndex = index; this.submit({ type: 'bag', itemId })` — the
    same command a confirm press produces in `onConfirm`; guard `mode === 'bag'`
    and `usableBag()` membership, exactly as the canvas row does;
  - `search` → `this.bagQuery = query; this.refreshBagItems()`;
  - `focus` → `this.bagSearchFocused = focused` (the guard `handleAction` already
    reads), and under the flag the scene's own `typeInBagSearch` must **not** append
    to `bagQuery` (the native input owns the text): swallow the event while
    `bagSearchFocused` is true and return `true`;
  - `scroll` → step the selection within `this.bagStacks` by `delta`, wrapped;
  - `back` → `this.onBack()` (the shipped ◀ control's call).
- Two-step press: the first press on a cell selects it, a second press on the same
  cell (or the `confirm` action) uses it — the arm/use split lives in the panel's
  own state (`selected` from the scene; the panel sends `select` then `use`), never
  in the engine.
- Add the live probe beside the two others at the file's end:

```ts
/** The display objects the bag draws right now: 0 under `?hud=dom`. */
export function battleBagDrawnObjectCount(scene: BattleScene): number {
  return scene.bagDrawnObjectCount();
}
```

  and a private `bagDrawnObjectCount()` counting the bag chrome exactly as
  `movesDrawnObjectCount` does (0 under the flag, the visible bag objects with it
  off).
- **No rule moves:** `usableBag()`, `submit`, `takeTurn`, `state.noHeal`, the
  capture/ball rule and `lastBallId` are untouched. **No RNG draw is added or
  removed**, no run field, **no `SAVE_VERSION` step**.

## 🧩 Data and configuration

- One fixture, following `isHudState`:
  `{ "slug": "05c-battle-bag", "state": { party: [], bag: [], money: null, route: null, battle: null, notice: null }, "bag": { …BattleBagInput… } }`
  carrying the frame's own eight stacks (×3, ×2, ×1, ×12, ×5, ×4, ×2, ×1), the
  `CONSUMIBLES` / `POKEBALLS` pocket labels, the `SEARCH ITEMS` placeholder, the
  selected row 0 and the `Potion` info text
  (`A SPRAY-TYPE MEDICINE.\nRESTORES 20 HP TO ONE POKEMON.`).
- No new i18n key: `hud.searchItems`, `battle.noItems`, `bag.consumable` and
  `bag.ball` already ship.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; green, including `view.test.ts` and
    `fixture.test.ts`.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-142` audited against the exclusive paths.
  - One `[live]` criterion (the card and its cells on screen); the rest are
    `[unit]`.
- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` is clean and the new folder imports no Phaser and
        no scene module.
  - [ ] `[unit]` `battleBagView` is pure and total; the card equals
        `battleMovesBox(viewport)` for 1280×800 and 390×844 (an equality with the
        shipped function, not a copied number).
  - [ ] `[unit]` The card-relative arithmetic is pinned: tabs at `y = 16` with
        120×26 and gap 4, search at `y = 50` and height 24, grid band at `y = 82`
        with height 76, detail at `y = 164`, cell side `35` and five columns / two
        rows for the desktop card, the info card 320 wide with its bottom 8 px above
        the grid.
  - [ ] `[unit]` The cells are `bagGridLayout`'s rects: ten cell boxes, nine of them
        filled by the fixture's eight stacks (the ninth empty and dim), each badge
        `×N`, the selected index flagged exactly once.
  - [ ] `[unit]` `fixture.test.ts` pins the frame: the two pocket labels, the
        placeholder, the eight stacks in order, the `Potion` info text and the detail
        line.
  - [ ] `[unit]` The engine is untouched: `git diff main...task-142 --
        src/engine/** src/ui/bag.ts` is empty, and no RNG call is added or removed
        (`git diff` contains no `Rng`/`hashSeed` line).
  - [ ] `[unit]` `battleBagDrawnObjectCount(scene)` is 0 under the flag and positive
        with it off (the same shape as `battleMovesDrawnObjectCount`).
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` **The bag card lands on the menu box and the canvas draws none of
        it.** Measurement: `CHROME_PATH=/usr/bin/chromium npm run dev`, open
        `http://127.0.0.1:<port>/?hud=dom`, reach a route (Enter ×3), start a wild
        battle with
        `(await import('/src/main.ts')).game.scene.getScene('Route').startDebugWildBattle('pidgey', 5)`,
        wait for `globalThis.__pkmBattle`, then
        `__pkmBattle.openBag(); __pkmBattle.refreshHud();`
        (TypeScript's `private` is compile-time only). Read
        `document.querySelector('[data-hud-panel="battle-bag"]').getBoundingClientRect()`
        and require it to equal the battle's menu box within 2 px — at 1280×800
        `(276,582,728,192)` as `battleMovesBox({width:1280,height:800})` derives it,
        and at 390×844 `(16,592,358,236)`; read the ten
        `[data-hud-bag-cell]` rects and require nine of them 35×35 in a 5-column
        pitch of 41 px; then
        `(await import('/src/scenes/BattleScene.ts')).battleBagDrawnObjectCount(__pkmBattle) === 0`
        on that page and `> 0` with `?hud` absent. Report the rects, the pitch and
        both counts verbatim.

## 📣 Coordination

- For the Architect: the bag card is `battleMovesBox`, i.e. the menu box, and the
  FIGHT/BAG/POKEMON/RUN command strip stays the canvas command menu (no Phase-12
  task claims it) — the bag card is the body only, exactly as the move card is.
- For the next batch (`Task-143`, the switch screen, the next `BattleScene.ts`
  slot): the same `mount…Panel`/`…Input`/`on…Intent`/`…DrawnObjectCount` quartet is
  the pattern; `battleBagDrawnObjectCount` is the live probe for this card.

## ⛔ Out of scope

- `src/ui/bag.ts`, `src/engine/**`, `src/ui/hud/state.ts`, `src/ui/hud/commands.ts`,
  the other battle panels (`battle-hp`, `battle-moves`), any other scene, any i18n
  table, `src/scenes/panels/**`, `docs/**`, `package.json`, `src/main.ts`,
  `src/data/**`.
- The command strip, the arena, the combatants, the capture sequence, the damage
  numbers and the message box (the next task's).
