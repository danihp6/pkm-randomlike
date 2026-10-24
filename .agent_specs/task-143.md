# Spec: Task-143 — The battle's switch screen is the HUD's

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene + DOM HUD panel (`D49` chrome migration). No engine rule, no data table, no gameplay change.
- **Role:** Dev.
- **Objective:** The battle's **SWITCH window** — the party grid drawn today by `renderPartyGrid()` in `src/scenes/BattleScene.ts` — becomes a Preact card in `src/ui/hud/panels/battle-switch/`: one row per party member, its portrait cell, its fitted name-and-level line, its HP track and fill, its status mark, the selected row and the ◀ back control. The panel is pure presentation: it answers with `{ type: 'switch', index }` / `{ type: 'back' }`, the scene maps that onto the call the canvas already makes (`confirmParty(index)` / `onBack()`), and the **send-out / withdraw beat stays entirely in the scene** (`playSwitch()`, driven by the `switch` feed event). Under `?hud=dom` the canvas draws none of that window (`renderPartyGrid` short-circuits through `hideMenu()`), while the arena, the combatants, the tweens and the effects are untouched.
- **Environment:** worktree `../wt-pkm-143`, branch `task-143`, off `main` with `[Task-140]`, `[Task-141]` and `[Task-142]` merged. Linux, headless. No browser is required for the `[unit]` gate; the `[live]` passes need a Chromium (`CHROME_PATH`) and a dev server. Assets live **outside** the checkout under `$ASSETS_ROOT` (or `sprite-sources/`) and are **never** symlinked or junctioned into a worktree.
- **Dependencies (all merged; read, never edit):**
  - `[Task-127]` — the DOM/`?hud=dom` flag, the kit, the fixture registry and the diff harness: `src/ui/hud/mount.ts`, `src/ui/hud/fixtures/index.ts`, `src/ui/hud/kit/index.ts`, `scripts/hud/diff.mjs`.
  - `[Task-124]` — the HUD shell, `src/ui/hud/README.md` and the panel map `src/ui/hud/panels/README.md` (it already carries the `battle-switch/` line; **do not edit it**).
  - `[Task-125]` — `src/ui/hud/styles/root.css` (every `--hud-*` token) and `src/ui/hud/kit/`.
  - `[Task-140]`, `[Task-141]`, `[Task-142]` — the three shipped battle panels whose shape this task copies: `src/ui/hud/panels/battle-hp/` (a `HudState`-fed panel, the 44×16 status mark), `src/ui/hud/panels/battle-moves/` (page-coordinate rects, `mountBattleMoves`, the `battleMovesBox` card) and `src/ui/hud/panels/battle-bag/` (`battleBagBox = battleMovesBox`, the `fixture.test.ts` shape).

### Exclusive paths (single writer)

The list of paths this task creates or modifies. **Nothing outside this list.**

- `src/scenes/BattleScene.ts` (**hot file — this task is its only owner in Batch 64**)
- `src/ui/hud/panels/battle-switch/view.ts`
- `src/ui/hud/panels/battle-switch/view.test.ts`
- `src/ui/hud/panels/battle-switch/battleSwitchPanel.tsx`
- `src/ui/hud/panels/battle-switch/battleSwitch.css`
- `src/ui/hud/panels/battle-switch/mount.tsx`
- `src/ui/hud/panels/battle-switch/preview.ts`
- `src/ui/hud/panels/battle-switch/preview.test.ts`
- `src/ui/hud/panels/battle-switch/fixture.test.ts`
- `src/ui/hud/panels/battle-switch/index.ts`
- `src/ui/hud/panels/battle-switch/README.md`
- `design/fixtures/05d-battle-pokemon.json`

Explicitly **not** yours (another task owns each): `src/ui/hud/panels/README.md`, `src/ui/hud/README.md`, `src/ui/hud/state.ts`, `src/ui/hud/commands.ts`, `src/ui/hud/mount.ts`, `src/ui/hud/kit/**`, `src/ui/hud/styles/**`, `src/ui/hud/fixtures/**`, `src/ui/partyGrid.ts`, `src/ui/frlg.ts`, `src/ui/metrics.ts`, `src/i18n/**`, `src/engine/**`, `src/data/**`, `package.json`, `src/main.ts`, `vite.config.ts`, `scripts/**`, every other scene, every other `docs/*.md`, every other `design/fixtures/*.json`.

### Inputs (read-only)

Beyond `AGENTS.md`, you may read (and only read):

- `docs/tech-decisions.md` — **D49** (§ "The HUD is a DOM layer over an untouched canvas": the measured gate, the awaiting bridge, the per-element escape hatch, "no phase closes with a screen migrated half-way").
- `docs/agent-spec-template.md`, `docs/hud-fidelity.md` (§2 type sizes and their line boxes, §5 panel geometry, §8 what identity can and cannot mean).
- `src/scenes/BattleScene.ts` itself.
- `src/ui/partyGrid.ts` (`partyGridLayout`, `partyGridFieldRows`, `fitPartyLabel`), `src/ui/frlg.ts` (`FRLG_WINDOW_PADDING`, `FRLG_HPBAR`), `src/ui/metrics.ts` (`hpFraction`, `hpColor`, `HP_COLORS`, `statusAbbreviation`), `src/ui/bag.ts` (not used, only as a precedent), `src/data/keybinds.ts`.
- `src/ui/hud/**` in full, especially `panels/battle-moves/{view.ts,mount.tsx,battleMoves.tsx,battleMoves.css,index.ts,README.md}`, `panels/battle-bag/{view.ts,mount.tsx,battleBagPanel.tsx,index.ts,fixture.test.ts,README.md}`, `panels/battle-hp/{view.ts,battleHp.tsx,battleHp.css,README.md}`, `panels/party/{view.ts,partyPanel.tsx}`, `panels/options/{preview.ts,preview.test.ts,view.ts,README.md}`, `fixtures/{index.ts,flags.ts,registry.ts}`, `styles/root.css`, `kit/`.
- `src/engine/battle/{state.ts,fighter.ts,commands.ts}` (types only), `src/engine/run/state.ts` (`MAX_PARTY_SIZE === 6`).
- `design/frames/05d-battle-pokemon.json`, `design/frames/m05d-battle-pokemon.json`, `design/fixtures/05-battle-hud.json`, `design/fixtures/05c-battle-bag.json`, `design/tokens.json`, `design/screens/README.md` if it exists.
- `scripts/hud/diff.mjs` (to know what the harness does and which artifacts it writes).

## 🔒 Contract

Everything below is a promise. Names, signatures, keys, numbers and defaults are exact; a batch-mate (and Task QA) is written against them.

### Folder shape (copy the siblings' shape, not a new one)

```
src/ui/hud/panels/battle-switch/
  view.ts            the pure value model + the fixture parser
  view.test.ts       the pinned geometry, the tone table, the clamping, purity
  battleSwitchPanel.tsx   the card component + the row press rule
  battleSwitch.css   the card's glass, the row, the portrait, the HP track/fill, the mark, the ◀
  mount.tsx          mountBattleSwitch + the intent union + the controller
  preview.ts         the `?hudFixture=05d-battle-pokemon` preview
  preview.test.ts    previewRequested's truth table
  fixture.test.ts    design/fixtures/05d-battle-pokemon.json, headless
  index.ts           the barrel the scene imports
  README.md          the folder's one-line-per-file map
```

### `view.ts`

```ts
import { PORTRAIT_SIZE } from '../../../../data/portraits';
import { t } from '../../../../i18n';
import { hpColor, hpFraction, HP_COLORS } from '../../../metrics';
import { FRLG_WINDOW_PADDING, FRLG_HPBAR } from '../../../frlg';
import { fitPartyLabel, partyGridLayout } from '../../../partyGrid';
import { battleMovesBox } from '../battle-moves';

export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;
export type HpTone = 'healthy' | 'caution' | 'danger';

/** The switch grid's card **is** the battle's menu box: the shipped `battleMovesBox`, re-exported. */
export const battleSwitchBox = battleMovesBox;

export const SWITCH_ROWS = 6;                 // MAX_PARTY_SIZE, mirrored like `PARTY_ROWS`
export const SWITCH_ROW_GAP = 8;              // MENU_GRID_GAP / partyGridLayout's default gap
export const SWITCH_BACK_COLUMN = 64;         // MOVE_BACK_COL
export const SWITCH_INSET = 8;                // MOVE_GRID_INSET
export const SWITCH_AVATAR_CAP = 0.9;         // PARTY_AVATAR_SCALE
export const SWITCH_HPBAR_CAP = 0.4;          // PARTY_CELL_HPBAR_SCALE
export const SWITCH_LABEL_SIZE = 14;          // the board's `mon name CH` (Silkscreen Regular 14/18)
export const SWITCH_ROW_LEAD = 8;             // the portrait's inset from the row's left edge
export const SWITCH_ROW_TRAIL = 8;            // the HP track's inset from the row's right edge
export const SWITCH_AVATAR_GAP = 6;           // the label's gap after the portrait
export const SWITCH_STATUS_W = 44;            // the board's `status ENV CH` mark
export const SWITCH_STATUS_H = 16;
export const SWITCH_STATUS_GAP = 4;           // the gap between the mark and the HP track
export const SWITCH_BACK_W = 48;              // the ◀ hit box the canvas arms
export const SWITCH_BACK_H = 36;
export const SWITCH_BACK_INSET = 14;          // the canvas' `FRLG_WINDOW_PADDING.x + 14` arrow spot

/** One party member, as the scene hands it. Plain data: never a `BattleFighter`. */
export type BattleSwitchRowInput = Readonly<{
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  /** `statusAbbreviation(fighter.status)`: 'BRN' | 'PSN' | 'TOX' | 'PAR' | 'SLP' | 'FRZ' | null. */
  statusLabel: string | null;
  /** `switchablePartyIndices(state, 'player').includes(index)`. */
  enabled: boolean;
  /** `partyGridFieldRows(activeIndex, secondActiveIndex).includes(index)` in a double, else false. */
  field: boolean;
}>;

export type BattleSwitchInput = Readonly<{
  /** True while `mode === 'party'`; a closed grid hides the card but keeps it mounted. */
  open: boolean;
  /** The card in **page** coordinates (see `battleSwitchBox`). */
  card: Rect;
  /** The members, in party order, at most `SWITCH_ROWS`. */
  rows: readonly BattleSwitchRowInput[];
  /** `menuIndex`. */
  selected: number;
}>;

export type SwitchRowView = Readonly<{
  index: number;
  name: string;
  level: number;
  /** The board's row line — `party.rowLabel` with the status left to the mark — fitted to the row. */
  label: Readonly<{ text: string; box: Rect }>;
  /** `hp + '/' + maxHp`: the row's accessible name, never painted. */
  hpText: string;
  /** 0…1, from `hpFraction`. */
  fraction: number;
  /** Null for a fainted member: the canvas hides the bar with the member. */
  hp: Readonly<{ track: Rect; area: Rect; fill: Rect; tone: HpTone }> | null;
  statusLabel: string | null;
  /** The 44×16 board mark, right-aligned in the row; null with no status. */
  status: Readonly<{ box: Rect }> | null;
  field: boolean;
  enabled: boolean;
  selected: boolean;
  /** Page coordinates. `row` is the same rect the canvas draws its cell at. */
  row: Rect;
  portrait: Rect;
}>;

export type BattleSwitchView = Readonly<{
  open: boolean;
  /** The card in page coordinates; the root is `position: fixed` at it. */
  card: Rect;
  rows: readonly SwitchRowView[];
  /** The six fixed row rects the grid always lays out, filled or not (`partyGridLayout`'s `rects`). */
  slots: readonly Rect[];
  back: Readonly<{ label: string; box: Rect }>;
}>;

/** The view as plain data. Pure and total: out-of-range indices clamp, a short party paints fewer rows. */
export function battleSwitchView(input: BattleSwitchInput): BattleSwitchView;

/**
 * The fixture payload (`design/fixtures/05d-battle-pokemon.json`) as an input. `null` when the
 * payload carries no `switch` object or no `rows` array. The card is always the viewport's own
 * `battleSwitchBox` — a payload's `card` is documentation, never the authority.
 */
export function fixtureSwitchInput(payload: unknown, viewport: Viewport): BattleSwitchInput | null;
```

Rules the view must obey, all of them testable:

1. **Geometry is `partyGridLayout`'s, not a second copy.** The view calls it **once**:

   ```ts
   const layout = partyGridLayout(input.card, {
     padding: FRLG_WINDOW_PADDING,
     rows: SWITCH_ROWS,
     gap: SWITCH_ROW_GAP,
     backColumn: SWITCH_BACK_COLUMN,
     inset: SWITCH_INSET,
     avatarScaleCap: SWITCH_AVATAR_CAP,
     hpBarScaleCap: SWITCH_HPBAR_CAP,
     hpBarWidth: FRLG_HPBAR.width,
     hpBarHeight: FRLG_HPBAR.height,
   });
   ```

   and derives every row from `layout.rects`, `layout.avatarScale`, `layout.hpBarScale` and `layout.labelMaxWidth`. **Do not re-derive the pitch by hand.**
2. **Per row**, with `avatarW = PORTRAIT_SIZE * layout.avatarScale`, `barW = FRLG_HPBAR.width * layout.hpBarScale`, `barH = FRLG_HPBAR.height * layout.hpBarScale`, `markW = statusLabel === null ? 0 : SWITCH_STATUS_W + SWITCH_STATUS_GAP`, `labelW = Math.max(24, layout.labelMaxWidth - markW)`:
   - `row = layout.rects[i]`;
   - `portrait = { x: row.x + SWITCH_ROW_LEAD, y: row.y + (row.h - avatarW) / 2, w: avatarW, h: avatarW }`;
   - `trackRight = row.x + row.w - SWITCH_ROW_TRAIL - markW`;
   - `track = { x: trackRight - barW, y: row.y + (row.h - barH) / 2, w: barW, h: barH }`;
   - `area = { x: track.x + FRLG_HPBAR.fill.x * layout.hpBarScale, y: track.y + FRLG_HPBAR.fill.y * layout.hpBarScale, w: FRLG_HPBAR.fill.width * layout.hpBarScale, h: FRLG_HPBAR.fill.height * layout.hpBarScale }`;
   - `fill = { ...area, w: area.w * hpFraction(hp, maxHp) }`;
   - `tone` = `hpColor(fraction)`'s own band (`=== HP_COLORS.healthy` → `'healthy'`, `=== HP_COLORS.caution` → `'caution'`, else `'danger'`); **never a second comparison**;
   - `hp = hp > 0 ? { track, area, fill, tone } : null` (exactly the canvas' `alive = member.hp > 0`);
   - `status = statusLabel === null ? null : { box: { x: row.x + row.w - SWITCH_ROW_TRAIL - SWITCH_STATUS_W, y: row.y + (row.h - SWITCH_STATUS_H) / 2, w: SWITCH_STATUS_W, h: SWITCH_STATUS_H } }`;
   - `label = { text: fitPartyLabel(t('party.rowLabel', { name, level, status: '' }), labelW, SWITCH_LABEL_SIZE), box: { x: portrait.x + avatarW + SWITCH_AVATAR_GAP, y: row.y, w: labelW, h: row.h } }` — the fit and the box take the **same** clamped width, so the text can never be wider than its box.
3. `selected` clamps into `0 … rows.length - 1` (`NaN` → 0); a member whose index is not the selected one reads `selected: false`.
4. `back = { label: '\u25c0', box: { x: card.x + FRLG_WINDOW_PADDING.x + SWITCH_BACK_INSET - 12, y: (slots[0].y + slots[5].y + slots[5].h) / 2 - SWITCH_BACK_H / 2, w: SWITCH_BACK_W, h: SWITCH_BACK_H } }` — the canvas' own arrow spot (`renderPartyGrid`) and the 48×36 hit box `backZone` is armed with.
5. `slots` is always the six rects (never fewer), `rows.length ≤ SWITCH_ROWS`, no `undefined` anywhere, and the same input always yields deep-equal output.
6. No Phaser import, no DOM, no clock, no `Rng`: this module is data in, data out.

**Pinned numbers** (these are the tests' assertions; the dev gets them for free by following rule 1):

| quantity | `battleSwitchBox({width:1280,height:800})` → `{276,582,728,192}` | `battleSwitchBox({width:390,height:844})` → `{16,592,358,236}` |
| --- | --- | --- |
| `slots[i].y` | 606, 632.6667, 659.3333, 686, 712.6667, 739.3333 | 616, 650, 684, 718, 752, 786 |
| `rowH` / pitch | 18.6667 / 26.6667 | 26 / 34 |
| `row` | `{x:360, w:616}` | `{x:100, w:246}` |
| `avatarW` | 14.6667 | 22 |
| `hpBarW × hpBarH` | 107.2 × 11.2 | 107.2 × 11.2 |
| `area.w × area.h` | 76.8 × 4.8 | 76.8 × 4.8 |
| `labelMaxWidth` | 472.1333 | 94.8 |
| unstatused `track.x` | 860.8 | 230.8 |
| statused `track.x` | 812.8 | 182.8 |
| `status.box.x` | 924 | 294 |
| `back.box` | `{298, 664, 48, 36}` | `{38, 696, 48, 36}` |

### `mount.tsx`

```ts
import { h, render } from 'preact';
import { BattleSwitchPanel } from './battleSwitchPanel';
import { battleSwitchView, type BattleSwitchInput, type BattleSwitchView } from './view';

/** The panel's own command channel: plain data, never a battle state. */
export type BattleSwitchIntent =
  | Readonly<{ type: 'switch'; index: number }>
  | Readonly<{ type: 'back' }>;

export type BattleSwitchController = Readonly<{
  /** Pushes the grid's state; a closed grid hides the card but keeps it mounted. */
  update(input: BattleSwitchInput): void;
  dispose(): void;
}>;

export function mountBattleSwitch(
  host: Element,
  onIntent?: (intent: BattleSwitchIntent) => void,
): BattleSwitchController;
```

- The container is a `div.battle-switch-mount` appended to `host`, exactly as `mountBattleMoves` does.
- It paints **on mount** with `CLOSED` (`{ open: false, card: { x: 0, y: 0, w: 0, h: 0 }, rows: [], selected: 0 }`), so `[data-hud-panel="battle-switch"]` exists from the moment the battle mounts.
- `update` recomputes the view and re-renders through the same Preact root (no remount, so a press cannot lose its pointer target); `dispose` renders `null` and removes the container, and is idempotent.
- `switch` is the **one press = one switch** rule of the canvas (`onMenuClick` → `confirmMenu`), never a "pick then confirm" two-step; a row that is `enabled: false` is a `disabled` button and sends nothing.

### `battleSwitchPanel.tsx`

```ts
import type { JSX } from 'preact';
import type { BattleSwitchIntent } from './mount';
import type { BattleSwitchView, SwitchRowView } from './view';
import './battleSwitch.css';

export type BattleSwitchProps = Readonly<{
  view: BattleSwitchView;
  onIntent?: ((intent: BattleSwitchIntent) => void) | undefined;
}>;

/** The intent a row press sends: the index that row's own view carries. */
export function rowPressIntent(row: SwitchRowView): BattleSwitchIntent;

export function BattleSwitchPanel(props: BattleSwitchProps): JSX.Element;
```

Markup contract (QA reads these attributes; do not rename them):

- root: `<div class="battle-switch" data-hud-panel="battle-switch" data-open="true|false" hidden={!view.open}>`, styled `position: fixed` from `view.card`.
- one `<button type="button" class={joinClasses('battle-switch__row', row.selected && 'battle-switch__row--selected', row.field && 'battle-switch__row--field', !row.enabled && 'battle-switch__row--marked')} data-hud-switch-row="{index}" data-selected="true|false" data-enabled="true|false" data-field="true|false" disabled={!row.enabled}>` per `view.rows` entry, placed with `left/top/width/height` = `row − card` (page rects, card-relative like `battle-moves`' `insetStyle`);
  - `<span class="battle-switch__portrait" data-hud-switch-portrait style="row-relative portrait">` — the board's 8 px-radius tile, **no image**: the sprite stays in the canvas (`D49`; family with the party card's empty portrait cell);
  - `<span class="battle-switch__label" data-hud-switch-label>{label.text}</span>`;
  - when `hp !== null`: `<span class="battle-switch__hp" data-hud-switch-hp><span class="battle-switch__hp-area" data-hud-switch-hp-area><span class={joinClasses('battle-switch__hp-fill', 'battle-switch__hp-fill--' + hp.tone)} data-hud-switch-hp-fill /></span></span>`; the `--hp` box is `hp.track`, the `--hp-area` box is `hp.area`, the fill's width is `hp.fill.w` **in px, not %** (the area is the texture's own 192 px window, so a percentage of the track would be the wrong ratio);
  - when `status !== null`: `<span class="battle-switch__status" data-hud-switch-status>{statusLabel}</span>` at `status.box`;
  - the button's `aria-label` is `t('party.rowLabel', { name, level, status: statusLabel === null ? '' : '  ' + statusLabel })` and its `title` is `hpText`.
- the ◀: `<button type="button" class="battle-switch__back" data-hud-switch-back aria-label={t('battle.command.switch')}>{view.back.label}</button>` at `back.box`, sending `{ type: 'back' }`.
- the layer is `pointer-events: none`; **only** the rows and the ◀ set `pointer-events: auto`, so the canvas keeps every other press.

### `battleSwitch.css`

Scoped custom properties, one per board value, with the frame node named in the comment — the `battleMoves.css` style:

- `--battle-switch-card-fill: rgb(16 22 31 / 90%)` (the battle window's glass; the canvas window is hidden under the flag, so the card paints it), `border-radius: var(--hud-panel-radius)`, `box-shadow: inset 0 0 0 1px var(--hud-panel-border)`;
- `--battle-switch-row-fill: rgb(255 255 255 / 6%)`, `--battle-switch-row-border: rgb(255 255 255 / 10%)` (the canvas' `FRLG_ROW_FILL`/`FRLG_ROW_STROKE`), radius `var(--hud-row-radius)` (the board's `slot tile 4`);
- `--battle-switch-selected-fill: rgb(125 211 252 / 16%)` + `border-color: var(--hud-accent)` (`party sel`), the row radius 8 (`party sel` r8);
- `--battle-switch-track-fill: rgb(255 255 255 / 12%)` (`hp track CH`, radius 3), `--battle-switch-fill-healthy: #4ad15c` / `--battle-switch-fill-caution: #f5c242` / `--battle-switch-fill-danger: #ef4444` (= `src/ui/metrics.ts` `HP_COLORS`, the canvas' own `hpColorInt`; the `.battle-switch__hp-fill--healthy|--caution|--danger` classes pick them, each fill radius 3 px);
- `--battle-switch-status-fill: #8b5cf6` (the shipped status chip's fill, the same value `battle-hp` uses), radius 6, `font-size: var(--hud-type-chip-size)`, `line-height: 16px`, weight 700, uppercase, centred (`status ENV CH`);
- label: `font-size: var(--hud-type-section-size)` (14 px), `line-height: var(--hud-type-section-line)` (18 px), colour `var(--hud-text-ink)`; `--field` rows take `var(--hud-accent)`; `--marked` rows `opacity: .45`; the label box also carries `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` as the truncation backstop;
- the card, the rows and every child are `box-sizing: border-box`; `[hidden]` is `display: none`.

### `preview.ts`

```ts
/** True only when the URL asks for `?hud=dom&hudFixture=05d-battle-pokemon`. */
export function previewRequested(search: string): boolean;

/**
 * Mounts the fixture's card once into the HUD layer and returns its disposer, or
 * null when the URL does not ask for it. Inert — no node, no listener — otherwise:
 * headless (no `document`/`window`) it returns null before touching either.
 */
export function installBattleSwitchPreview(search: string): (() => void) | null;
```

- Copy `panels/options/preview.ts`: import the payload
  `import payload from '../../../../../design/fixtures/05d-battle-pokemon.json'`, validate the URL with `parseHudFlags`, require `installFixture(flags, FIXTURE_MODULES) !== null`, build the input with `fixtureSwitchInput(payload, viewport)` and return null if either is null.
- The viewport is `{ width: window.innerWidth, height: window.innerHeight }`; a `window.addEventListener('resize', …)` re-pushes `fixtureSwitchInput(...)` through `controller.update` so the card follows the device (this is what makes the 390×844 check possible).
- Attach with the options panel's own deferral (`queueMicrotask`, or `DOMContentLoaded` when `document.readyState === 'loading'`) so `#hud` exists; an `installed` latch makes a second call inert; the disposer removes the listener, disposes the controller and clears the latch.
- It never starts a battle and never touches a scene: under the fixture URL the game's own boot screen stays behind the card.

### `index.ts` (the barrel the scene imports)

```ts
export { BattleSwitchPanel, rowPressIntent } from './battleSwitchPanel';
export type { BattleSwitchProps } from './battleSwitchPanel';
export { mountBattleSwitch } from './mount';
export type { BattleSwitchController, BattleSwitchIntent } from './mount';
export { installBattleSwitchPreview, previewRequested } from './preview';
export {
  battleSwitchBox,
  battleSwitchView,
  fixtureSwitchInput,
  SWITCH_ROWS,
  SWITCH_STATUS_W,
  SWITCH_STATUS_H,
  SWITCH_BACK_W,
  SWITCH_BACK_H,
  SWITCH_LABEL_SIZE,
} from './view';
export type {
  BattleSwitchInput,
  BattleSwitchRowInput,
  BattleSwitchView,
  HpTone,
  Rect,
  SwitchRowView,
  Viewport,
} from './view';
```

### `src/scenes/BattleScene.ts` (the only scene change)

Private additions (same shape as the three shipped panels):

```ts
/** The mounted DOM switch grid (`?hud=dom`) and the controller `refreshHud` pushes to. */
private switchController: BattleSwitchController | null = null;

/** Mounts the DOM switch grid into the HUD layer, once per battle (`?hud=dom`). */
private mountSwitchPanel(): void;
private disposeSwitchPanel(): void;
/** The DOM grid's state: the card `battleSwitchBox` derives, and the party this scene owns. */
private battleSwitchInput(menu: Rect): BattleSwitchInput;
/** The DOM grid's only receiver: every intent lands on the call the canvas already made. */
private onBattleSwitchIntent(intent: BattleSwitchIntent): void;
```

Public probes (the `?hud=dom` flag contract, exactly like `hpDrawnObjectCount` / `movesDrawnObjectCount` / `bagDrawnObjectCount`):

```ts
/** Counts the visible objects the switch grid owns: the window, the ◀, the cells, avatars, labels, bars, fills and the detail window. */
switchDrawnObjectCount(): number;

/** The switch grid's drawn-object count, for the live flag contract: `(await import('/src/scenes/BattleScene.ts')).battleSwitchDrawnObjectCount(...)`. */
export function battleSwitchDrawnObjectCount(scene: BattleScene): number;
```

Wiring, in this order and nowhere else:

1. **Module scope**, beside the existing `const DOM_HUD = …` (line ~349):
   `installBattleSwitchPreview(typeof window === 'undefined' ? '' : window.location.search);` — guarded by `typeof window`, exactly like `SettingsScene.ts:92`; `src/main.ts` imports this module statically, so `#hud` exists by the time the deferred attach runs.
2. `create()` — `this.mountSwitchPanel();` immediately after `this.mountBagPanel();` (line ~831), and `this.disposeSwitchPanel();` in the `shutdown` handler beside the other three disposals.
3. `mountSwitchPanel()` / `disposeSwitchPanel()` — copy `mountMovesPanel()` / `disposeMovesPanel()` verbatim, with `mountBattleSwitch(host, (intent) => this.onBattleSwitchIntent(intent))`.
4. `renderPartyGrid(menu)` — **first statement**, before `this.menuPanel.setVisible(true)`:

   ```ts
   if (DOM_HUD) {
     // The DOM card draws the whole grid, so every canvas piece of it goes dark —
     // the window, the ◀, the cells, the avatars, the labels, the bars, the detail
     // window and its ⓘs. `hideMenu` is that one call.
     this.hideMenu();
     return;
   }
   ```

   The Phaser path below it stays byte-identical (the flag-off game must not move). `hideMenu()` already covers the bag chrome, the move chrome, the party grid and the info control, and it clears the moves' ⓘ pin and the detail's own pins — all of them belong to chips the DOM card does not draw, so nothing the scene still needs is lost (this is the same call `renderMoveMenu` and `renderBagMenu` make under the flag).
5. `refreshHud()` — inside the existing `if (DOM_HUD)` block (line ~3163), after the bag push:
   `this.switchController?.update(this.battleSwitchInput(menu));`
6. `battleSwitchInput(menu)` — the derived card, then the party:

   ```ts
   private battleSwitchInput(menu: Rect): BattleSwitchInput {
     const derived = battleSwitchBox({ width: this.scale.width, height: this.scale.height });
     // Before the first layout the stage has no size; the canvas' own rect is then
     // the only card there is, and an open grid must still land somewhere.
     const card = derived.w > 0 && derived.h > 0 ? derived : menu;
     if (this.mode !== 'party') return { open: false, card, rows: [], selected: 0 };
     const side = this.state.sides.player;
     const switchable = switchablePartyIndices(this.state, 'player');
     const fieldRows = this.double
       ? partyGridFieldRows(side.activeIndex, side.secondActiveIndex)
       : [];
     return {
       open: true,
       card,
       selected: this.menuIndex,
       rows: side.party.slice(0, MAX_PARTY_SIZE).map((fighter, index) => ({
         name: fighter.name,
         level: fighter.level,
         hp: fighter.hp,
         maxHp: fighter.maxHp,
         statusLabel: statusAbbreviation(fighter.status),
         enabled: switchable.includes(index),
         field: fieldRows.includes(index),
       })),
     };
   }
   ```

   (`switchablePartyIndices`, `partyGridFieldRows`, `statusAbbreviation`, `MAX_PARTY_SIZE` and `battleSwitchBox` are already imported or must be added to the existing import blocks — no new module.)
7. `onBattleSwitchIntent(intent)`:

   ```ts
   switch (intent.type) {
     case 'switch': {
       if (this.mode !== 'party') return;
       const index = moveIndexIn(intent.index, this.state.sides.player.party.length);
       if (index === null) return;
       if (!switchablePartyIndices(this.state, 'player').includes(index)) return;
       this.menuIndex = index;
       this.confirmParty(index);   // the row's own `onSelect` in `openParty`, unchanged
       return;
     }
     case 'back': {
       if (this.mode !== 'party') return;
       this.onBack();
       return;
     }
   }
   ```
8. `switchDrawnObjectCount()` — count every **visible** object among `menuPanel`, `backArrow`, `menuCursor`, `partyDetail`, `partyDetailName`, `partyDetailLevel`, `partyDetailEmpty`, each `partyCells[i]`, `partyAvatars[i]`, `partyLabels[i]`, `partyHpBars[i]`, `partyHpFills[i]` (`i < MAX_PARTY_SIZE`), plus `partyDetailTypes`, `partyDetailStats.rows[].label/.value`, `partyDetailMoves[].cell/.name/.pp` when they are visible. `?hud=dom` + `mode === 'party'` must answer `0`.

**Non-negotiable:** the panel is presentation only. `playSwitch()` stays the scene's, called from `applyEvent`'s `case 'switch'`; the panel never imports Phaser, never tween, never calls `performSwitch`, `takeTurn` or `submit`. The switch reaches the engine through `confirmParty`, exactly as the canvas' row click does.

### Determinism and rules

- **Reads no RNG.** No `Rng` stream is opened, no seed is re-pinned, `src/engine/**` is untouched, no `SAVE_VERSION` step: the screen reads state that already exists.
- No engine import in the panel folder; no `src/engine` path in the diff.
- No new dependency: Preact and the kit are already there; no `jsdom`, no testing-library.
- Performance: the view is recomputed only on an emit (`refreshHud`), allocates a handful of small objects and reads no canvas.

## 🧩 Data and configuration

`design/fixtures/05d-battle-pokemon.json` — the board's own copy (`05d Battle · pokemon`). Exactly this shape (the `state` block is the six-key empty `HudState` the other battle fixtures carry; the panel's payload is the `switch` key, family with `05-battle-hud.json`'s `moves` and `05c-battle-bag.json`'s `bag`):

```json
{
  "slug": "05d-battle-pokemon",
  "state": { "party": [], "bag": [], "money": null, "route": null, "battle": null, "notice": null },
  "switch": {
    "open": true,
    "card": { "x": 276, "y": 582, "w": 728, "h": 192 },
    "selected": 0,
    "rows": [
      { "name": "CHARIZARD",  "level": 36, "hp": 98, "maxHp": 112, "statusLabel": null,  "enabled": false, "field": true  },
      { "name": "PIKACHU",    "level": 32, "hp": 84, "maxHp": 112, "statusLabel": null,  "enabled": true,  "field": false },
      { "name": "BULBASAUR",  "level": 30, "hp": 51, "maxHp": 102, "statusLabel": "PAR", "enabled": true,  "field": false },
      { "name": "GASTLY",     "level": 28, "hp": 21, "maxHp": 84,  "statusLabel": "PSN", "enabled": true,  "field": false },
      { "name": "CHARMANDER", "level": 24, "hp": 14, "maxHp": 70,  "statusLabel": null,  "enabled": true,  "field": false },
      { "name": "SQUIRTLE",   "level": 22, "hp": 0,  "maxHp": 78,  "statusLabel": null,  "enabled": false, "field": false }
    ]
  }
}
```

Why these numbers (do not "tidy" them):

- the frame's own four members (Charizard, Pikachu, Bulbasaur, Gastly — portraits `CH`/`PI`/`BU`/`GA`) plus two so the **six**-row pitch is measured on a full party; Charizard is `field: true` (it is the active) and refuses a switch, as the canvas' accent row does;
- the fractions are the three `hpColor` bands **at their boundaries**: 98/112 = 0.875 (`healthy`), 84/112 = 0.75 (`healthy`), 51/102 = **0.5** (`caution`: the `> 0.5` edge), 21/84 = 0.25 (`caution`), 14/70 = **0.2** (`danger`: the `> 0.2` edge), 0/78 = 0 (`hp: null`, the fainted row);
- exactly two rows carry a status (`BULBASAUR` PAR, `GASTLY` PSN), which is the mark's "present exactly for the statused rows" measurement;
- `"card"` is the desktop card and is asserted against `battleSwitchBox({width:1280,height:800})`; the panel always uses the viewport's own box, so the 390×844 pass is honest.

No other data, no `src/data/` change, no i18n key added (`party.rowLabel`, `detail.hp`, `status.*` and `battle.command.switch` already exist).

## 🧪 Test and Validation Plan (for QA)

### Method

- `npm test` — Vitest, headless; green, including the three new `src/ui/hud/panels/battle-switch/*.test.ts`.
- `npm run build` — `tsc --noEmit && vite build`.
- `git diff --name-only main...task-143` — audited against the exclusive-path list.
- `git diff --name-only main...task-143 -- src/engine src/data src/i18n src/main.ts package.json vite.config.ts` — must print nothing.
- Browser: `npm run dev`, then `http://127.0.0.1:5173/?hud=dom&hudFixture=05d-battle-pokemon`. Set the devtools device toolbar to **exactly 1280×800** (then **390×844**) before reading any box; all readings are CSS px from `getBoundingClientRect()`.
- Harness: `CHROME_PATH=$(command -v google-chrome || command -v chromium || command -v chromium-browser) node scripts/hud/diff.mjs --slug 05d-battle-pokemon`. It writes `design/diff/05d-battle-pokemon/{1280x800,390x844}.{shot,diff}.png` and `report.json`. **On Linux it needs `CHROME_PATH`**: without a Chromium on the box it exits 1 with "no Chrome or Edge found", and criterion E is recorded `not-run` with that line — A–D still stand on their own.

### Acceptance criteria

- [ ] `[unit]` It typechecks and builds clean: `npm run build` exits 0.
- [ ] `[unit]` The declared tests exist and pass: `npx vitest run src/ui/hud/panels/battle-switch` green, and `npm test` green with the whole suite.
  - `view.test.ts` pins, at **both** viewports: `battleSwitchBox` (`{276,582,728,192}` / `{16,592,358,236}`); `slots` length 6 with the six `y`s and the pitch of the table above; `row`, `portrait`, `track`, `area`, `label.box`, `status.box` and `back.box` of the same table (0.01 px tolerance); the five non-fainted fills (`76.8 × fraction`); the tone of each fixture fraction including the `0.5 → caution` and `0.2 → danger` edges; `hp === null` for the fainted row; the statused rows' label box being exactly 48 px narrower; the `selected` clamp (`-1`/`99`/`NaN`); a two-member party painting two rows against six slots; and purity (two calls, deep-equal).
  - `fixture.test.ts` asserts `isHudState(fixture.state)` and the empty six-key snapshot, `fixture.switch.card` equal to `battleSwitchBox({width:1280,height:800})`, `fixtureSwitchInput(fixture, {width:1280,height:800}) !== null`, the six names in order, the two `PAR`/`PSN` marks, and `fixtureSwitchInput` returning `null` for `{}`, for a payload without `rows`, and for `null`.
  - `preview.test.ts` pins `previewRequested`'s truth table: true only for `?hud=dom&hudFixture=05d-battle-pokemon` (and with query args reordered); false without `dom`, without a fixture, with another slug, and for `''`.
- [ ] `[unit]` Nothing outside the exclusive paths was touched: `git diff --name-only main...task-143` lists only the twelve paths of the list above — in particular no `src/ui/hud/panels/README.md`, no `src/ui/hud/state.ts`, no `src/ui/hud/commands.ts`, no `package.json`.
- [ ] `[unit]` The diff has no engine, data or i18n path and no version step: `git diff --name-only main...task-143 -- src/engine src/data src/i18n src/main.ts package.json vite.config.ts` prints nothing; `git diff main...task-143 -- src/engine/save.ts` is empty (no `SAVE_VERSION` move).
- [ ] `[unit]` The panel folder is pure: `grep -rn --include='*.ts' --include='*.tsx' "Phaser\|phaser\|tweens\|playSwitch\|performSwitch\|takeTurn" src/ui/hud/panels/battle-switch/` prints nothing.
- [ ] `[unit]` The send-out beat is still the scene's: `grep -n "private playSwitch" src/scenes/BattleScene.ts` prints exactly one line and `grep -n "this.playSwitch(" src/scenes/BattleScene.ts` prints exactly one line, inside `applyEvent`'s `case 'switch'` (above the `case 'faint'` that follows it) — the beat is played by the feed, never by the card.
- [ ] `[unit]` The canvas goes dark under the flag: the body of `renderPartyGrid` opens with `if (DOM_HUD) { this.hideMenu(); return; }` before any `this.menuPanel.setVisible(true)`, and `switchDrawnObjectCount()` is wired to the module-level `battleSwitchDrawnObjectCount` export (read the two functions; both statements must be visible in the diff).
- [ ] `[live]` **The card and the six rows.** On `/?hud=dom&hudFixture=05d-battle-pokemon` at 1280×800, in the console:

  ```js
  const el = document.querySelector('[data-hud-panel="battle-switch"]');
  const c = el.getBoundingClientRect();
  const r = [...document.querySelectorAll('[data-hud-switch-row]')].map((n) => n.getBoundingClientRect());
  ({ card: [c.x, c.y, c.width, c.height], n: r.length, tops: r.map((b) => b.top), pitch: r[1].top - r[0].top, back: (() => { const b = document.querySelector('[data-hud-switch-back]').getBoundingClientRect(); return [b.x, b.y, b.width, b.height]; })() })
  ```

  **Measurement:** `card` = `[276, 582, 728, 192]` ±1 px each side, `n` = 6, `pitch` = `26.667` ±0.01, `tops` = `[606, 632.667, 659.333, 686, 712.667, 739.333]` ±1, `back` = `[298, 664, 48, 36]` ±1. Repeat at 390×844: `card` = `[16, 592, 358, 236]` ±1, `pitch` = `34` ±0.01, `tops` = `[616, 650, 684, 718, 752, 786]` ±1, `back` = `[38, 696, 48, 36]` ±1.
- [ ] `[live]` **The HP bars against the payload.** Same page, same two layouts:

  ```js
  [...document.querySelectorAll('[data-hud-switch-row]')].map((n) => {
    const g = (s) => n.querySelector(s)?.getBoundingClientRect().width ?? null;
    return [Number(n.dataset.hudSwitchRow), g('[data-hud-switch-hp]'), g('[data-hud-switch-hp-area]'), g('[data-hud-switch-hp-fill]')];
  })
  ```

  **Measurement:** `track` = `107.2` on every non-fainted row; `area` = `76.8`; `fill` = `67.2, 57.6, 38.4, 19.2, 15.36` for rows 0–4, i.e. `fill ÷ area` equals `hp ÷ maxHp` (0.875, 0.75, 0.5, 0.25, 0.2) within **1 px** of `area × hp/max`; row 5 (SQUIRTLE, 0 HP) has **no** `[data-hud-switch-hp]`, `-area` or `-fill` element at all. Both viewports must give the same six numbers.
- [ ] `[live]` **The status marks.** Same page, same two layouts:

  ```js
  [...document.querySelectorAll('[data-hud-switch-status]')].map((n) => [n.closest('[data-hud-switch-row]').dataset.hudSwitchRow, n.textContent, n.getBoundingClientRect().width, n.getBoundingClientRect().height])
  ```

  **Measurement:** exactly two entries, `[['2','PAR',44,16],['3','PSN',44,16]]` (all four numbers ±1); no other row carries the attribute; both marks are right-aligned at `row.right − 8 − 44` and vertically centred in the row.
- [ ] `[live]` **The scene still owns the switch and the send-out.** `npm run dev`, open `/?hud=dom`, start a run, press `F`, *Battle* tab, **Wild battle**; in the battle press `E` (confirm) then the arrow keys to **SWITCH** and `E` again. The party card appears with `[data-hud-panel="battle-switch"][data-open="true"]`, and in the console `globalThis.__pkmBattle.switchDrawnObjectCount()` answers **0** (no `menuPanel`, ◀, cell, avatar, label, bar, fill or detail window is visible) while `document.querySelectorAll('[data-hud-switch-row]').length` equals the party size. A press on an enabled row switches (`__pkmBattle.mode` leaves `'party'` and the message window runs the send-out line), the withdrawn/incoming sprite plays the scene's own `playSwitch` beat, and the panel's `data-open` returns `'false'` for the rest of the turn; `Q` (cancel) or a press on the card's ◀ returns to FIGHT/BAG/SWITCH/RUN, exactly as the canvas' ◀ does.
- [ ] `[live]` **The board's harness run, recorded.** `node scripts/hud/diff.mjs --slug 05d-battle-pokemon` completes for both viewports and writes `design/diff/05d-battle-pokemon/report.json`; QA records the two `geometry.median`/`max` and `colour.flat` values in the report. **Measurement:** the run must reach both viewports and both screenshots must contain the card (the six rows visible in `.shot.png`). The **full-frame `pass` flag is recorded, not required**: the arena behind the card is still the Phaser canvas and the board's battle window is 576×216 at (664,544) against the canvas' 728×192 at (36,582) — the card follows the canvas so it lands exactly on the window it replaces (`D49`'s "a screen that cannot pass keeps its Phaser version" binds a whole-screen migration; this is one card over a live battle). A `pass: true` on either viewport is a bonus, never a blocker; a *crash*, a missing screenshot or a card that is absent from the shot **is** a failure.

## 📣 Coordination

- **For the Architect:** `src/scenes/BattleScene.ts` is Task-143's in Batch 64 and must stay a one-owner file; `[Task-144]` (the message box) takes it in Batch 65 and must not touch `renderPartyGrid`, `battleSwitchInput`, `onBattleSwitchIntent`, `mountSwitchPanel`/`disposeSwitchPanel` or `switchDrawnObjectCount`. This task adds no `package.json`, `src/main.ts`, `vite.config.ts`, `src/ui/hud/panels/README.md` or `src/ui/hud/README.md` edit.
- **For the next batch (144 and the rest of 65):** the battle now mounts **four** DOM controllers in `create()` (`hpController`, `movesController`, `bagController`, `switchController`), each disposed in the same `shutdown` handler and pushed in the same `refreshHud()` block; a fifth card follows the identical five-step pattern. The battle card geometry of record is `battleMovesBox` (re-exported as `battleBagBox` and `battleSwitchBox`), **not** the board's 576×216 message box.
- **For Task QA / Integration QA:** the only scene behaviour that changes is under `?hud=dom`: `renderPartyGrid` returns through `hideMenu()` and the party card is Preact. With the flag **off**, `src/scenes/BattleScene.ts` must behave byte-for-byte as before — audit that the Phaser body of `renderPartyGrid` and every other method is unchanged.
- **Board divergence, recorded here on purpose:** `design/frames/05d-battle-pokemon.json` draws the switch window as a 2×2 tile grid (264×70 tiles at (684,600) and (956,600)/(684,678), i.e. the frame's four-member party) inside its 576×216 battle-menu card at (664,544); the shipped canvas lays the switch screen as **one column of six equal rows** inside its 728×192 menu card at (36,582), and `src/ui/hud/panels/README.md` (Task-124) freezes it as "one row per party member". This task reproduces **the canvas' window**, because the card must land exactly where the Phaser window was and because resizing the battle's menu box would move the message box and the HP boxes (Task-144/140 territory). The board is still the source for the row's *contents and paint*: the portrait tile (44×44, radius 8), the name line (Silkscreen 14/18, ink `#F8FAFC`), the HP track (radius 3, white 12 %), the **status mark (44×16, radius 6)** and the selected row's accent fill/stroke. If the human later wants the board's 2×2, it is a new task that changes `refreshHud`'s menu rect and `partyGridLayout` — not this one.

## ⛔ Out of scope

- The party **detail window** (`renderPartyDetail`, the STATS/MOVES popup, its ability and move ⓘs) and the four `partyMoveInfo` controls: they stay in the canvas, un-touched by this task.
- Keyboard, pad and canvas-zone input: the scene's `bindInput` still owns arrows/`E`/`Q`; the card adds pointer input only.
- `commands.ts` / `HudCommand`: the panel has its own intent union, like `BattleMoveIntent`/`BattleBagIntent`; no command variant is added.
- Any change to `partyGridLayout`, `fitPartyLabel`, `battleMovesBox`, the kit, `root.css`, the tokens, the fixture registry, the harness, the i18n tables or `docs/`.
- Any engine change, `SAVE_VERSION` step, RNG stream or seed re-pin, and any art/asset work (the portrait cell stays an empty tile: the sprite is the canvas').
- The board's 2×2 switch grid, a redesigned battle menu box, and the message box / HP boxes of Tasks 144 and 140.
- Merging, pushing `main`, ticking `TODO.md` or writing `CHANGELOG.md` — the Orchestrator's, after QA.

**Dev exit:** `npm test` and `npm run build` green, the twelve paths above and nothing else in `git diff --name-only main`, then an **empty commit** `dev: done task-143` pushed to `origin task-143` (`git commit --allow-empty -m "dev: done task-143"`). No `SAVE_VERSION` change, no RNG stream change, no `src/engine/**` byte touched.
