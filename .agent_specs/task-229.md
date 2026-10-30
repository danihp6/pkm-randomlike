# Spec: Task-229 — The INFO window goes, and the weather and the terrain live as icons at the stage's top right

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene + DOM HUD panel + data + docs.
- **Role:** Dev.
- **Objective:** The battle's fifth command control and everything behind it are
  gone — no `INFO` cell, no `mode = 'info'`, no `src/ui/battleInfo.ts`, no
  `battle.info.*` table beyond the eight conditions' names — and the field state
  the player actually needs is drawn instead: a new `battle-field` DOM panel that
  paints **one 32 px chip per live weather and per live terrain** at the battle
  stage's top right, each chip a drawn SVG glyph (sun, drops, swirl, flake, bolt,
  blades, mist, rings) with its remaining turns as a small numeral and no text
  row. The four command cells take the width the 62 px INFO column held, the
  `design-spec` §4 INFO bullet is reversed into the chip's line, and `npm test` +
  `npm run build` stay green with two files fewer in `src/ui/`.
- **Environment:** worktree `../wt-pkm-229`, branch `task-229`.
- **Dependencies:** none. The two files this task reads of the stage and the HP
  columns — `src/ui/hud/panels/battle-hp/view.ts` and
  `src/ui/hud/panels/battle-moves/view.ts` — are already on `main` (the exported
  `battleStage`, `battleHpBox`, `BATTLE_HP_BREAKPOINT`, `battleMovesBox`,
  `MOVE_GRID_INSET`, `compactCard`).

### Exclusive paths (single writer)

The only paths this task may create, modify or delete. **Nothing outside this list.**
No globs, no stray edits.

Modified:

- `src/scenes/BattleScene.ts`
- `src/ui/hud/panels/battle-command/view.ts`
- `src/ui/hud/panels/battle-command/view.test.ts`
- `src/ui/hud/panels/battle-command/battleCommandPanel.tsx`
- `src/ui/hud/panels/battle-command/mount.tsx`
- `src/ui/hud/panels/battle-command/battleCommand.css`
- `src/ui/hud/panels/battle-command/README.md`
- `src/i18n/en.ts`
- `src/i18n/es.ts`
- `src/ui/README.md`
- `src/ui/hud/panels/README.md`
- `src/data/README.md`
- `docs/design-spec.md` — **§4 only** (the three INFO clauses named below; no other
  section, no other bullet)
- `docs/hud-fidelity.md` — **the `**Battle zones.**` paragraph only**

Created:

- `src/data/fieldIcons.ts`
- `src/data/fieldIcons.test.ts`
- `src/ui/hud/panels/battle-field/view.ts`
- `src/ui/hud/panels/battle-field/view.test.ts`
- `src/ui/hud/panels/battle-field/battleField.tsx`
- `src/ui/hud/panels/battle-field/battleFieldPanel.test.ts`
- `src/ui/hud/panels/battle-field/battleField.css`
- `src/ui/hud/panels/battle-field/mount.tsx`
- `src/ui/hud/panels/battle-field/index.ts`
- `src/ui/hud/panels/battle-field/README.md`

Deleted:

- `src/ui/battleInfo.ts`
- `src/ui/battleInfo.test.ts`

**Not created:** `scripts/ui/build-field-icons.mjs`, any atlas under
`src/assets/ui/`, any line in `package.json`. The icons take `D49`'s escape hatch
(eight inline SVG paths in `src/data/fieldIcons.ts`) because the packed-atlas
branch of the backlog entry would have needed a `package.json` script edit and a
generated atlas, and this batch owns neither. `src/ui/hud/panels/battle-command/index.ts`
is **not** touched (its exported names do not change).

### Inputs (read-only)

Beyond `AGENTS.md`:

- `docs/agent-spec-template.md`
- `docs/design-spec.md` §4 (the whole section, to edit only its three INFO clauses)
- `docs/hud-fidelity.md` §5's `**Battle zones.**` paragraph
- `docs/tech-decisions.md` — `D49` (the escape hatch, the layer, the tokens)
- `src/ui/hud/panels/battle-hp/view.ts` — `battleStage`, `battleHpBox`,
  `BATTLE_HP_BREAKPOINT`, `Rect`, `Viewport`, the stage-chip precedent
- `src/ui/hud/panels/battle-hp/battleHp.tsx`, `battleHp.css`, `mount.tsx`,
  `index.ts`, `README.md` — the panel folder's shape and the card's paint
- `src/ui/hud/panels/battle-hp/view.test.ts` — the `nodesWith` / `classProps`
  vnode-walking helpers and the `preact/hooks` mock (copy, never edit)
- `src/ui/hud/panels/battle-moves/view.ts` — `battleMovesBox`, `MOVE_GRID_INSET`,
  `MOVE_MEGA_COL` (read only; the constant stays for the moves menu)
- `src/ui/hud/panels/battle-command/*` — the panel being edited
- `src/ui/hud/panels/battle-log/README.md` — the folder-map shape
- `src/ui/hud/panels/README.md`, `src/ui/README.md`, `src/data/README.md`
- `src/ui/hud/kit` (`joinClasses`, `panelClass`)
- `src/ui/frlg.ts` (`FRLG_WINDOW_PADDING`)
- `src/ui/hud/styles/root.css` — the `--hud-*` tokens
- `src/ui/hud/state.ts` — `HudBattle.weather` / `weatherTurns` / `terrain` /
  `terrainTurns` (read; **not edited**)
- `src/engine/battle/state.ts` — `WeatherId`, `TerrainId`, `BattleState.weather`,
  `weatherTurns`, `terrain`, `terrainTurns`
- `src/i18n/index.ts` (`t`, `TranslationKey`), `src/i18n/en.ts`, `src/i18n/es.ts`
- `src/assets/README.md` (to confirm no atlas is written)
- `design/screens/05-battle-hud.json` and `design/exports/05-battle-hud.png` — the
  imported board spec and its export for frame **`05 Battle HUD`** (the caption
  exactly as the board draws it, middle dot included: **`05 Battle HUD`**).
  **They are absent from this cut** — they arrive with the operator's run of
  `node scripts/design/import.mjs`, the same run that keeps `[Task-223]` blocked —
  so they are named here for the record and **must not be waited for, searched for
  or worked around**. The geometry this task implements is the frozen fallback
  below, which is this task's own.
- `design/screens/05-battle-hud.svg`, `design/screens/05-battle-hud.png`,
  `design/frames/05-battle-hud.json` — the board's own frame, present on `main`,
  read as a **visual reference only**. The frame draws its `weather chip` node as
  a 144×26 text chip at (1076,40) on a full-window 1280×800 frame; our battle is a
  centred 800 px square, so that rect cannot be inherited. Its **paint** is:
  fill `#fbbf24` at 14 %, a 1 px `#fbbf24` stroke at 70 %, `cornerRadius` 6, the
  text in `#fbbf24` — and that pair is what the chip reuses. No screenshot diff and
  no pixel comparison is a criterion here (`D57`).

## 🔒 Contract

### TypeScript — `src/data/fieldIcons.ts` (new)

```ts
import type { TerrainId, WeatherId } from '../engine/battle/state';
import type { TranslationKey } from '../i18n';

/** The eight conditions the field chips can draw: the four weathers and the four terrains. */
export type FieldIconId = WeatherId | TerrainId;

/** The chip slot a condition takes. */
export type FieldIconKind = 'weather' | 'terrain';

/** The shape family of the drawn glyph, so a chip is never colour-only. */
export type FieldIconShape =
  | 'sun'
  | 'drop'
  | 'swirl'
  | 'flake'
  | 'bolt'
  | 'blades'
  | 'mist'
  | 'rings';

export type FieldIconRow = Readonly<{
  id: FieldIconId;
  kind: FieldIconKind;
  /** The chip's label key, reused from the retired window's table. */
  labelKey: TranslationKey;
  shape: FieldIconShape;
  /** The glyph's viewBox side, in SVG units. Always 24. */
  viewBox: number;
  /** The glyph's SVG `d`, in `viewBox` units, drawn in `currentColor`. Non-empty. */
  path: string;
}>;

/** The eight ids, in the table's own order: weathers first, then terrains. */
export const FIELD_ICON_IDS: readonly FieldIconId[];

/** The table: one row per `WeatherId | TerrainId`, exhaustive by its type. */
export const FIELD_ICONS: Readonly<Record<FieldIconId, FieldIconRow>>;

/** The row for `id`. Pure, total, no RNG, no i18n call. */
export function fieldIcon(id: FieldIconId): FieldIconRow;
```

The eight rows, exactly:

| `id` | `kind` | `labelKey` | `shape` | glyph |
|---|---|---|---|---|
| `sun` | `weather` | `battle.info.weather.sun` | `sun` | disc with eight rays |
| `rain` | `weather` | `battle.info.weather.rain` | `drop` | three drops falling |
| `sand` | `weather` | `battle.info.weather.sand` | `swirl` | two interlocking swirls |
| `snow` | `weather` | `battle.info.weather.snow` | `flake` | six-armed flake |
| `electric` | `terrain` | `battle.info.terrain.electric` | `bolt` | one zigzag bolt |
| `grassy` | `terrain` | `battle.info.terrain.grassy` | `blades` | three blades |
| `misty` | `terrain` | `battle.info.terrain.misty` | `mist` | three wavy lines |
| `psychic` | `terrain` | `battle.info.terrain.psychic` | `rings` | two concentric rings |

Every `viewBox` is `24`. Every `path` starts with `M` or `m`, is drawn as a solid
fill in `currentColor` (no stroke, no second colour), and the eight `path` strings
are pairwise distinct. Draw them so the silhouette alone names the condition at
32 px; no `<img>`, no atlas, no base64, no emoji, no dependency.

### TypeScript — `src/ui/hud/panels/battle-field/view.ts` (new)

```ts
import type { TerrainId, WeatherId } from '../../../../engine/battle/state';
import type { FieldIconId, FieldIconKind, FieldIconShape } from '../../../../data/fieldIcons';

export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;

/** The chip's cell side, in px. */
export const FIELD_CHIP = 32;
/** The gutter between two chips. */
export const FIELD_CHIP_GAP = 8;
/** The row's inset from the stage's top and right edges, in px. */
export const FIELD_CHIP_INSET = 16;
/** The clearance a narrow (phone) row keeps under the foe's lowest HP box, in px. */
export const FIELD_CHIP_CLEARANCE = 8;

export type FieldChipView = Readonly<{
  id: FieldIconId;
  kind: FieldIconKind;
  /** `t(row.labelKey, { turns })` — the chip's accessible name: `Sandstorm · 4`. */
  label: string;
  /** The numeral the chip paints: `String(turns)` of the clamped count. */
  turns: string;
  /** `FIELD_ICONS[id].path`, already resolved: the panel reads no data table. */
  path: string;
  /** `FIELD_ICONS[id].viewBox`. */
  viewBox: number;
  shape: FieldIconShape;
  /** Page coordinates: the chip's own `FIELD_CHIP` × `FIELD_CHIP` cell. */
  box: Rect;
}>;

export type BattleFieldInput = Readonly<{
  /** The window's own size — the same one `battleHpBox` and `battleStage` read. */
  viewport: Viewport;
  /** The sides that field a second active, as the HP boxes lay themselves out. Only `enemy` is read. */
  doubles: Readonly<{ enemy: boolean; player: boolean }>;
  weather: WeatherId | null;
  weatherTurns: number;
  terrain: TerrainId | null;
  terrainTurns: number;
}>;

export type BattleFieldView = Readonly<{
  /** Left to right in draw order; the weather, when up, is the last (the corner) chip. */
  chips: readonly FieldChipView[];
  /** The chips' union box in page coordinates, or `null` when nothing is up. */
  row: Rect | null;
}>;

/** The row's union box for `count` chips (clamped to 0…2), or `null` for none. */
export function fieldChipRow(
  viewport: Viewport,
  doubles: Readonly<{ enemy: boolean; player: boolean }>,
  count: number,
): Rect | null;

/** The whole panel as plain data. Pure and total; reads no RNG, no i18n but `t`. */
export function battleFieldView(input: BattleFieldInput): BattleFieldView;
```

**The geometry, frozen.** `stage = battleStage(viewport)`.

- `count` = `(terrain !== null ? 1 : 0) + (weather !== null ? 1 : 0)`. `0` ⇒
  `chips: []`, `row: null`, and the panel paints nothing at all.
- `rowW = count * FIELD_CHIP + (count - 1) * FIELD_CHIP_GAP`.
- Right edge: `stage.x + stage.w - FIELD_CHIP_INSET`.
- Top edge: `stage.y + FIELD_CHIP_INSET` **when `viewport.width >= BATTLE_HP_BREAKPOINT`**
  (600, imported from `../battle-hp/view`); otherwise the bottom of the enemy's
  **lowest** HP box plus `FIELD_CHIP_CLEARANCE` —
  `doubles.enemy ? battleHpBox(viewport, 'enemy', 1) : battleHpBox(viewport, 'enemy', 0)`,
  `+ h + FIELD_CHIP_CLEARANCE`. (On a phone the foe's card spans the width at the
  top, so the corner is taken; the row drops under it and keeps the same right
  edge and the same 16 px inset. This is the one place the frozen fallback needed
  an addition, and it is recorded in Coordination.)
- `row = { x: right - rowW, y: top, w: rowW, h: FIELD_CHIP }`.
- Chip `i` (left to right): `{ x: row.x + i * (FIELD_CHIP + FIELD_CHIP_GAP), y: top, w: FIELD_CHIP, h: FIELD_CHIP }`.
- Chip order: the **terrain** first (when up), the **weather** last. With both up
  the weather therefore holds the corner cell and the terrain sits one gap to its
  left; with only one up that chip takes the corner cell. Rationale: a weather is
  by far the commoner condition, so it must not move when a terrain appears.
- Every value is an integer at every viewport (`battleStage` already rounds).
- `turns`: `String(Math.max(0, Math.trunc(turns)))` from `weatherTurns` /
  `terrainTurns` — the **stored** count, exactly as the retired window read it, so
  a weather under Air Lock still shows. A non-finite count reads `'0'`.
- `label`: `t(FIELD_ICONS[id].labelKey, { turns })` with `turns` the **number**, so
  a sandstorm with 4 turns left reads `Sandstorm · 4` (and `Tormenta de arena · 4`
  under `es`). It is the chip's whole accessible name, numeral included.
  The eight label keys are the chip labels and nothing else — see the note in
  §Data.
- Rules: no Phaser, no DOM, no `Rng`, no clock, no allocation in a loop. The same
  input deep-equals the same output.

### TypeScript — the panel, mount and barrel (new)

`src/ui/hud/panels/battle-field/battleField.tsx`:

```ts
export type BattleFieldProps = Readonly<{ view: BattleFieldView }>;
export function BattleFieldPanel(props: BattleFieldProps): JSX.Element;
```

`src/ui/hud/panels/battle-field/mount.tsx`:

```ts
export type BattleFieldController = Readonly<{
  /** Pushes the battle's field state; a clear sky paints no chip. */
  update(input: BattleFieldInput): void;
  dispose(): void;
}>;

/** Mounts the layer into `host` and paints the empty row, so the panel exists before the first push. */
export function mountBattleField(host: Element): BattleFieldController;
```

The mount appends a `<div class="battle-field-mount">` to `host` and paints
`battleFieldView({ viewport: { width: 0, height: 0 }, doubles: { enemy: false, player: false }, weather: null, weatherTurns: 0, terrain: null, terrainTurns: 0 })`
on mount, then `battleFieldView(input)` on every push; `dispose` renders `null`
and removes the container (the `mountBattleCommand` shape, `mount.tsx` 33-57).

`src/ui/hud/panels/battle-field/index.ts` exports the component and its props
type, `mountBattleField` and `BattleFieldController`, `battleFieldView`,
`fieldChipRow` and the four `FIELD_CHIP*` constants, plus the types
`BattleFieldInput`, `BattleFieldView`, `BattleFieldProps`, `FieldChipView`, `Rect`,
`Viewport`.

### TypeScript — the DOM contract the panel paints (frozen names)

- Root layer: `<div class="battle-field" data-hud-panel="battle-field">`, painted
  always (even with no chip), `pointer-events: none`.
- Each chip: `<div class="battle-field__chip" data-hud-field="<id>" data-hud-field-kind="weather|terrain" role="img" aria-label="<label>" style="left/top/width/height">`,
  one per `view.chips`, in `view.chips` order.
- Inside a chip:
  - `<svg class="battle-field__icon" data-hud-field-icon aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="<path>" fill="currentColor" /></svg>`
  - `<span class="battle-field__turn" data-hud-field-turn aria-hidden="true">{turns}</span>`
- `src/ui/hud/panels/battle-field/battleField.css`: the layer is
  `position: fixed; inset: 0; overflow: hidden; pointer-events: none`, the chip
  `position: absolute; box-sizing: border-box; border-radius: 6px`, the glyph
  `position: absolute; inset: 0; width: 100%; height: 100%` (fills the 32 px
  cell), the numeral a `12px × 10px` plate pinned `right: 0; bottom: 0` with
  `border-radius: 3px`, `font-size: var(--hud-type-tag-size)`,
  `line-height: var(--hud-type-tag-line)`, centred, `font-weight: 700`. Every
  tone is a scoped custom property declared once on `.battle-field`, each next to
  the frame node it comes from (the `battleHp.css` precedent):
  `--battle-field-chip-fill: rgb(251 191 36 / 14%)`,
  `--battle-field-chip-border: rgb(251 191 36 / 70%)`,
  `--battle-field-chip-ink: var(--hud-text-warning)`,
  `--battle-field-turn-plate: rgb(16 22 31 / 90%)`.
  No literal colour outside those four declarations; no new `--hud-*` token in
  `root.css` (that file is not in the exclusive paths).

### TypeScript — `src/ui/hud/panels/battle-command/*` (changed)

`view.ts`, the new types (the `info` field and both INFO inputs are **removed**):

```ts
export type BattleCommandInput = Readonly<{
  open: boolean;
  card: Rect;
  rows: readonly BattleCommandRow[];
  selected: number;
}>;

export type BattleCommandView = Readonly<{
  open: boolean;
  compact: boolean;
  card: Rect;
  rows: readonly BattleCommandRowView[];
}>;
```

`battleCommandView` loses the `MOVE_MEGA_COL` reserve: the right edge becomes
`card.x + card.w - pad.x - MOVE_GRID_INSET` (drop `MOVE_MEGA_COL` from the
import; `MOVE_GRID_INSET`, `FRLG_WINDOW_PADDING`, `battleMovesBox`, `compactCard`
stay). `rows[].selected` becomes `index === selected` (no `infoSelected`).

`mount.tsx`: `CLOSED` loses `infoSelected`/`infoLabel`;
`BattleCommandIntent` becomes
`Readonly<{ type: 'hover'; index: number }> | Readonly<{ type: 'press'; index: number }>`.

`battleCommandPanel.tsx`: delete the `view.info === null ? null : (… <button data-hud-command-info …>)`
block; keep rows, classes, `data-hud-panel`, `hidden={!view.open}`.

`battleCommand.css`: delete every `.battle-command__info` selector (lines 37,
58, 76-78, 81) and the "fifth INFO column" phrase from the header comment.

### TypeScript — `src/scenes/BattleScene.ts` (changed)

Remove, at these current lines (re-measured on `main`; do not trust the ids, read
the code):

| lines | what |
|---|---|
| 162 | `import { battleInfoLines, battleInfoRows } from '../ui/battleInfo';` |
| 247-248 | `'info'` in the `Mode` union |
| 396-397 | `private infoSelected = false;` |
| 818-821 | `onPointerDown`'s `this.mode === 'info'` branch |
| 849-852 | `onConfirm`'s `this.mode === 'info'` branch |
| 870-873 | `onCancel`'s `this.mode === 'info'` branch |
| 1683 | `this.infoSelected = false;` in `openMenu` |
| 1714 | `this.infoSelected = false;` in `openPartnerMenu` |
| 1752-1763 | the whole `openInfo()` method |
| 2187 | `const info = this.mode === 'menu' \|\| this.mode === 'partner';` |
| 2189-2198 | the `if (this.infoSelected) { … }` block in `moveMenuGrid` |
| 2230-2234 | the `action === 'right' && info && …` block in `moveMenuGrid` |
| 2249-2252 | `confirmMenu`'s `mode === 'menu' && infoSelected` branch |
| 2495-2496 | `infoSelected` / `infoLabel` in `battleCommandInput` |
| 2512, 2515, 2525 | the `infoSelected` reads in `onBattleCommandIntent` |
| 2529-2533 | the `case 'info':` arm of `onBattleCommandIntent` |

Add:

- `private fieldController: BattleFieldController | null = null;` beside the other
  controllers (near line 414).
- `mountBattleFieldPanel()` / `disposeBattleFieldPanel()` in the
  `mountBattleCommandPanel` / `disposeCommandPanel` shape (near 638-651):
  return on `typeof document === 'undefined'` or a null `#hud`, dispose the old
  controller, `this.fieldController = mountBattleField(host)`.
- Call `this.mountBattleFieldPanel();` **immediately after**
  `this.mountHpPanel();` (line 578) and `this.disposeBattleFieldPanel();` inside
  the `shutdown` handler (566-577), beside the other disposers.
- `private battleFieldInput(): BattleFieldInput` beside `battleBagInput`
  (near 2624):

```ts
private battleFieldInput(): BattleFieldInput {
  return {
    viewport: { width: this.scale.width, height: this.scale.height },
    doubles: this.doublesInPlay(),
    weather: this.state.weather,
    weatherTurns: this.state.weatherTurns,
    terrain: this.state.terrain,
    terrainTurns: this.state.terrainTurns,
  };
}
```

- In `refreshHud`, after `this.switchController?.update(this.switchSwitchInput(...))`
  (line 2440) and before `this.updateBattleLog()` (2441):
  `this.fieldController?.update(this.battleFieldInput());`.
- The import: `mountBattleField`, `type BattleFieldController`, `type BattleFieldInput`
  from `'../ui/hud/panels/battle-field'`.

The chips read the **live** battle state on every `refreshHud`, exactly as the
retired window did; they are **not** part of `[Task-226]`'s beat (the weather and
terrain are not in `HudBattleDisplay`, and `src/ui/hud/state.ts` is not in this
task's paths). A weather that starts mid-turn therefore shows from that turn's
first frame. Said out loud here so nobody "fixes" it into the beat.

## 🧩 Data and configuration

### The chips' geometry (the frozen fallback, page coordinates)

| viewport | conditions up | cells (each 32×32) |
|---|---|---|
| 1280×800 | weather only | weather at `x 992, y 16` |
| 1280×800 | terrain only | terrain at `x 992, y 16` |
| 1280×800 | both | terrain `x 952`, weather `x 992`, both `y 16`; row `(952, 16, 72, 32)` |
| 390×844 | weather only | weather at `x 342, y 104` |
| 390×844 | terrain only | terrain at `x 342, y 104` |
| 390×844 | both | terrain `x 302`, weather `x 342`, both `y 104`; row `(302, 104, 72, 32)` |

(`battleStage({1280,800})` = `{x:240,y:0,w:800,h:800}`; `battleStage({390,844})` =
`{x:0,y:0,w:390,h:844}`; the phone top is the foe's box `{16,16,358,80}` bottom 96
plus `FIELD_CHIP_CLEARANCE` 8.)

### The command cells after the INFO column goes

| viewport | rows | cells |
|---|---|---|
| 1280×800, lead | 2 | `(468,606,250,72)`, `(726,606,250,72)`, `(468,686,250,72)`, `(726,686,250,72)` |
| 1280×800, partner | 1 | `(468,606,250,152)`, `(726,606,250,152)` |
| 390×844, lead | 2 | `(44,616,147,94)`, `(199,616,147,94)`, `(44,718,147,94)`, `(199,718,147,94)` |
| 390×844, partner | 1 | `(44,616,147,196)`, `(199,616,147,196)` |

### i18n — the eight surviving keys, and the 29 that go

**Kept** (both tables, unchanged values, unchanged order), and read only by
`src/data/fieldIcons.ts`:

`battle.info.weather.sun`, `battle.info.weather.rain`, `battle.info.weather.sand`,
`battle.info.weather.snow`, `battle.info.terrain.electric`,
`battle.info.terrain.grassy`, `battle.info.terrain.misty`,
`battle.info.terrain.psychic`.

**Deleted from `src/i18n/en.ts` and `src/i18n/es.ts`** (29 keys, leaving no key
whose name starts with `battle.info` beyond the eight above):

`battle.infoControl`, `battle.info.field`, `battle.info.player`,
`battle.info.enemy`, `battle.info.nothing`, `battle.info.weather`,
`battle.info.terrain`, `battle.info.status`, `battle.info.field.trickroom`,
`battle.info.field.gravity`, `battle.info.field.magicroom`,
`battle.info.field.wonderroom`, `battle.info.field.fairylock`,
`battle.info.field.mudsport`, `battle.info.field.watersport`,
`battle.info.side.reflect`, `battle.info.side.lightscreen`,
`battle.info.side.auroraveil`, `battle.info.side.tailwind`,
`battle.info.side.luckychant`, `battle.info.side.mist`,
`battle.info.side.safeguard`, `battle.info.stat.atk`, `battle.info.stat.def`,
`battle.info.stat.spa`, `battle.info.stat.spd`, `battle.info.stat.spe`,
`battle.info.stat.accuracy`, `battle.info.stat.evasion`.

That is 28 of the 36 `battle.info.*` keys plus `battle.infoControl` — **29 keys**,
in each table. The comment above the block (`// battleInfo — the battle-state
window's control and lines`, `en.ts` 387 / `es.ts` 390) becomes
`// the battle field chips — the eight conditions the weather and the terrain chips name`.

> **Note for the record.** The backlog entry's prose says *nine* keys are reused.
> The table carries exactly **eight** keys that name a specific weather or a
> terrain (4 + 4), and the frozen set is those eight: the two group headings
> (`battle.info.weather` = `WEATHER`, `battle.info.terrain` = `TERRAIN`) label no
> chip and retire with the window. Do not invent a ninth key and do not keep a
> heading "because the count was nine"; the test pins eight.

### Docs — the exact replacements

`docs/design-spec.md` §4, three clauses (line numbers re-measured on `main`):

1. Lines 357-362 — drop the fifth control from the command-grid sentence, keep
   the MEGA / G-MAX words for the moves menu:
   > **FIGHT / BAG / SWITCH / RUN** is a 2x2 **grid** that takes the card's whole
   > width — the column the moves menu keeps for **MEGA** and **G-MAX** is the
   > grid's own here — and so is the **moves** menu (all four moves show at once,
   > with no scrolling), which always reserves its full 2x2 and its own 62 px
   > MEGA / G-MAX column (each of those two controls draws the shipped Mega
   > Evolution glyph, the Hard Stone icon every Mega Stone borrows, never a word;
   > an armed one reads as the accent fill plus the accent outline), so a shorter
   > list keeps one cell size …

2. Lines 387-395 — replace the whole INFO paragraph with:
   > - The field's **weather** and **terrain** are the only field state the HUD
   >   draws, as icons at the battle stage's top right
   >   (`src/ui/hud/panels/battle-field/`): one 32 px chip per live condition — a
   >   sun, drops, a swirl or a flake for the weather, a bolt, blades, mist or
   >   rings for the terrain — with its remaining turns as the chip's own small
   >   numeral and no text row, 8 px apart and 16 px inside the square's own
   >   edges, the weather holding the corner and the terrain one gap to its left;
   >   both at once is one row of two and neither draws nothing. The chips read
   >   the stored condition, so a weather under Air Lock still shows. The engine
   >   models no **entry hazards** (Stealth Rock, Spikes, Toxic Spikes and Sticky
   >   Web are absent from the whole engine — `Tidy Up`'s handler in
   >   `src/engine/battle/effects/moves.ts` says so) and keeps the per-fighter
   >   **volatiles** hidden: the state window, its field and side rows and its
   >   stat-stage and status lines were retired with the **INFO** control.

3. Lines 421-423 — the chrome list loses the window:
   > every other window — the HP panels, the **command window** (the FIGHT / BAG
   > / SWITCH / RUN card), the moves menu and the switch grid's detail window — is
   > the default card skin …

After the edit `grep -o INFO docs/design-spec.md | wc -l` is **0**.

`docs/hud-fidelity.md`, the `**Battle zones.**` paragraph (lines 160-163): replace
its command-window sentence and add the chips' line:

> **The command window is that same card**: FIGHT / BAG / SWITCH / RUN is painted
> at `battleMovesBox`'s own rect, and its four cells take the card's whole
> two-column width — **250×72** in the desk's 2×2 and **147×94** on the phone —
> with no fifth control in the moves menu's MEGA column. The **field chips** are
> one 32 px cell per live weather and terrain, 8 px apart, the row's right edge
> 16 px inside `battleStage`'s right edge and its top 16 px inside the square's
> top edge (1280×800 → the corner cell at (992,16), the terrain at (952,16)); a
> viewport under 600 px keeps that right edge and drops the row under the foe's
> lowest HP box, 8 px below it (390×844 → (342,104) and (302,104)).

### Folder maps (AGENTS.md: a task that adds or deletes a file updates that folder's README)

- `src/ui/README.md` — delete the `battleInfo.ts` line (49-50). Nothing else.
- `src/ui/hud/panels/README.md` — amend the `battle-command/` line (drop "plus the
  INFO control") and add one `battle-field/` line: *the battle field chips: one
  icon per live weather and terrain at the stage's top right, with its remaining
  turns*.
- `src/ui/hud/panels/battle-command/README.md` — the fifth-control sentences
  (lines 5, 13, 16, 20, 36-38, 40-42) are rewritten: four cells over the whole
  card, 250×72 / 147×94, and the intent union without `info`.
- `src/ui/hud/panels/battle-field/README.md` — new, in the `battle-hp/README.md`
  shape: the layer, its files, and the rules (page coordinates from
  `battleStage`; the weather holds the corner; nothing takes a press; the chips
  read the live state, never the beat).
- `src/data/README.md` — one line for `fieldIcons.ts` (the eight drawn glyphs'
  SVG paths, viewBox and label key, read by `ui/hud/panels/battle-field/`).

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task
    adds and the ones it rewrites.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-229` — must equal the exclusive paths list
    exactly (26 entries: 14 modified, 10 created, 2 deleted; a path is listed once).
  - `grep -rn "battleInfo" src` — no output.
  - `grep -o INFO docs/design-spec.md docs/hud-fidelity.md | wc -l` — `0`.
  - One browser pass for the two `[live]` criteria, on `npm run dev` (a dev build,
    so `IS_DEVELOP` is true and the debug menu is live), at **1280×800** and
    **390×844**. Everything else is `[unit]`.
- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` passes: `tsc --noEmit` clean and `vite build`
        green.
  - [ ] `[unit]` `npm test` passes, including the cases below.
  - [ ] `[unit]` `git diff --name-only main...task-229` names nothing outside the
        exclusive paths list, and names every path in it.
  - [ ] `[unit]` `grep -rn "battleInfo" src` prints nothing, and
        `src/ui/battleInfo.ts` + `src/ui/battleInfo.test.ts` do not exist; and
        `grep -o INFO docs/design-spec.md docs/hud-fidelity.md | wc -l` prints `0`.
  - [ ] `[unit]` `src/data/fieldIcons.test.ts`: `FIELD_ICON_IDS` is exactly
        `['sun','rain','sand','snow','electric','grassy','misty','psychic']`;
        `Object.keys(FIELD_ICONS).sort()` equals `[...FIELD_ICON_IDS].sort()`;
        every row's `id` equals its key, `viewBox` is `24`, `path` is non-empty,
        starts with `M` or `m` and contains only `MmLlHhVvCcSsQqTtAaZz0-9.,- ` and
        spaces; the eight `shape`s and the eight `path`s are pairwise distinct;
        `kind` is `'weather'` for the first four and `'terrain'` for the last
        four; `fieldIcon('rain') === FIELD_ICONS.rain`; the four weather
        `labelKey`s start with `battle.info.weather.` and the four terrain ones
        with `battle.info.terrain.`.
  - [ ] `[unit]` `battle-field/view.test.ts`, the table: a clear-sky input
        (`weather: null, terrain: null`) yields `chips: []` and `row: null`;
        `weather: 'sun', weatherTurns: 5` yields one chip with
        `id: 'sun'`, `turns: '5'`, `label: 'Sun · 5'` and
        `box: { x: 992, y: 16, w: 32, h: 32 }` at 1280×800;
        `terrain: 'grassy', terrainTurns: 3` alone yields one chip at the same
        corner box; both up at 1280×800 yields `chips.map((c) => [c.id, c.box.x])`
        equal to `[['grassy', 952], ['sun', 992]]` with `row: { x: 952, y: 16, w: 72, h: 32 }`;
        the same two at 390×844 yield `[['grassy', 302], ['sun', 342]]` at
        `y: 104` with `row: { x: 302, y: 104, w: 72, h: 32 }`; one chip at
        390×844 is `{ x: 342, y: 104, w: 32, h: 32 }`; a doubles enemy at
        390×844 puts the row at `y: 192`; a `weatherTurns` of `-1` reads `'0'`
        and of `4.7` reads `'4'`; the inputs are clamped to 0…2 by
        `fieldChipRow` (`null` at 0, a 32 px row at 1, 72 at 2, 72 at 9).
  - [ ] `[unit]` `battle-field/view.test.ts`, the geometry guards, at 1280×800,
        390×844 and 900×900, single and doubles: no chip box intersects any
        `battleHpBox(viewport, side, slot)` for `side` in `enemy`/`player` and
        `slot` 0/1, and none intersects `battleMovesBox(viewport)`; every chip box
        is inside `battleStage(viewport)`; the row keeps `FIELD_CHIP_INSET` from
        the stage's right edge (and the top one on a viewport ≥ 600 wide).
  - [ ] `[unit]` `battle-field/view.test.ts`: the view is pure —
        `battleFieldView(input)` deep-equals a second call, and the input is
        unchanged; and `setLocale('es')` makes the same input's chip read
        `'Sol · 5'` before `setLocale('en')` in an `afterEach` restores it.
  - [ ] `[unit]` `battle-field/battleFieldPanel.test.ts` (the panel called as a
        function and walked with the copied `nodesWith`/`classProps` helpers): the
        root carries `data-hud-panel="battle-field"`; with two chips
        `nodesWith(tree, 'data-hud-field')` yields the ids `['grassy','sun']`, each
        with `data-hud-field-kind`, `role="img"`, `aria-label` equal to the view's
        `label`, and a `style` of `left/top/width/height` in px equal to its
        `box`; each chip holds one `[data-hud-field-icon]` SVG whose `viewBox` is
        `0 0 24 24` and whose `<path>` `d` equals the referenced row's `path`, and
        one `[data-hud-field-turn]` with `aria-hidden="true"` and the numeral as
        its child text; a clear-sky view paints the root and **no**
        `[data-hud-field]`.
  - [ ] `[unit]` `battle-command/view.test.ts` is rewritten to the new card: no
        `info` key on the view (`expect('info' in view).toBe(false)`), the four
        lead cells exactly the four rects in §The command cells at 1280×800 and at
        390×844, the partner windows `250×152` / `147×196`, every box inside the
        card, none meeting an HP box, the selection and clamping rules unchanged.
  - [ ] `[unit]` the key set: a test (in `battle-field/view.test.ts`) asserts
        `Object.keys(en).filter((key) => key.startsWith('battle.info'))` is
        exactly the eight keys of `src/data/fieldIcons.ts`'s rows
        (`FIELD_ICON_IDS.map((id) => FIELD_ICONS[id].labelKey)`), sorted, that
        `'battle.infoControl' in en` is `false` in both tables, and that the same
        holds for `es`.
  - [ ] `[live]` measured at **1280×800** and **390×844** on `npm run dev`: in a
        live battle, from the console run
        `const b = window.__pkmBattle; b.state.weather = 'sand'; b.state.weatherTurns = 4; b.state.terrain = 'grassy'; b.state.terrainTurns = 3; b.refreshHud();`
        — then `[data-hud-field="sand"]`'s `getBoundingClientRect()` is
        `x 992, y 16, w 32, h 32` at 1280×800 and `x 342, y 104, w 32, h 32` at
        390×844, `[data-hud-field="grassy"]` sits exactly 8 px to its left at the
        same `y`, and **no** chip rect intersects any `[data-hud-hp]` rect at
        either viewport (nor any `[data-hud-panel="battle-command"]` rect).
  - [ ] `[live]` measured at both viewports: with the command menu open,
        `document.querySelector('[data-hud-command-info]')` is `null` and
        `document.querySelectorAll('[data-hud-command-box]')` has **4** entries
        whose widths are `250` at 1280×800 and `147` at 390×844; pressing `→`
        while the cursor is on the last column leaves one row with
        `data-selected="true"` inside the card and no selection outside it.
- A `[live]` that compares pixels is **not** a criterion (`D57`): the board enters
  as an imported spec, and this cut has none — the fallback geometry above is the
  only measurement authority.

## 📣 Coordination

- **For the Orchestrator:** this is a single-task batch and legitimately so: the
  only other open item, `[Task-230]` (Batch 101), claims
  `src/scenes/BattleScene.ts`, the same hot file this task holds, and
  `[Task-194]`, `[Task-223]` and `[Task-224]` are `[!]`. Three dev slots stay
  empty on the scene blocker, and the batch runs as one dev wave and one QA wave.
- **For the Architect of later batches:** the board input
  (`design/screens/05-battle-hud.json` + `design/exports/05-battle-hud.png`) is
  still absent; when the operator's import lands, re-measure the chip row against
  frame `05 Battle HUD` — the entry's own geometry (32 px cell, 8 px gap, 16 px
  inset, stage-anchored) is what shipped until then.
- **For the next batch:** `HudBattle` already carries `weather`, `weatherTurns`,
  `terrain` and `terrainTurns` (`src/ui/hud/state.ts` 142-145), so a later task can
  feed `battle-field` from `HudState` instead of the scene's own input without a
  schema change. This task does not: the panel takes `BattleFieldInput` from the
  scene (`battle-command`'s shape), and `hud/state.ts` is untouched.
- **For whoever reads the panels' map:** `src/ui/hud/panels/battle-field/` is the
  battle's seventh card and the only one with no press, no `HudState` read and no
  i18n call in its component (the view resolves the label through
  `t(row.labelKey)`).
- **Two frozen assumptions to confirm with the human** (both written above, both
  deliberate):
  1. the reused key count is **eight**, not the entry's "nine";
  2. the narrow (phone) layout drops the chip row **under** the foe's HP card, 8 px
     below its lowest box, because on a phone that card spans the full width and
     the stage's top-right corner is occupied — the entry's 16 px top inset holds
     on every viewport 600 px wide or wider.

## ⛔ Out of scope

- No `scripts/ui/build-field-icons.mjs`, no atlas under `src/assets/ui/`, no
  `npm run data:ui` line, no `package.json` edit, no new dependency.
- No other panel, scene, data table, `package.json` line, `src/main.ts` or
  `vite.config.ts` change.
- No weather or terrain **beat**: the chips read the live state; `HudBattleDisplay`,
  `advanceBattleDisplay` and `src/ui/hud/state.ts` are not touched.
- No chip for `fog`, `noHeal`, `noFlee`, the field conditions (Trick Room, Gravity,
  Magic Room, Wonder Room, Fairy Lock, Mud Sport, Water Sport) or the side
  conditions — the replacement keeps only what the human named.
- No dragging, collapsing, tooltip, hover, press or focus behaviour on the chips;
  they take no pointer event and spend no turn.
- No new `--hud-*` token, no palette change, no change to `battle-hp/`,
  `battle-moves/`, `battle-log/`, `battle-bag/` or `battle-switch/`.
- No `CHANGELOG.md` or `TODO.md` edit (the Orchestrator writes both at merge).
- No pixel-diff harness, no screenshot comparison, no `design/` file written.
