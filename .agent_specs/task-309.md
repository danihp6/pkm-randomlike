# Spec: Task-309 — The type badges are Añil's mini glyphs

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** data + tooling + HUD + Phaser layout.
- **Role:** Dev.
- **Objective:** The game's type badges become the **24×24 glyphs** of Pokémon
  Añil's `Graphics/UI/types_mini.png` — the sheet the design board uses — instead of
  the 32×14 long text badges packed from `Graphics/UI/types.png`. The starter pick's
  cards draw the glyph through the kit's `MoveTypeBadge` and the move grid draws the
  same square glyph above its category glyph, with no clipped word and no overlap.
- **Environment:** worktree `../wt-pkm-309`, branch `task-309`.
- **Dependencies:** the starter pick (`Task-287`, shipped) and the kit's
  `MoveTypeBadge` (`src/ui/hud/kit/moveIcons.tsx`, shipped). The Añil store is at
  `C:\Users\Dani\projects\pkm-randomlike\sprite-sources`.

### Exclusive paths (single writer)

Nothing outside this list.

- `scripts/frlg/build-type-icons.mjs`
- `scripts/assets/pack.mjs`
- `src/data/frlg/type-icons.json` (generated, committed)
- `src/assets/frlg/type-icons.png` (generated, gitignored)
- `src/assets/placeholders/frlg/type-icons.png` (committed blank)
- `src/data/typeIcons.ts`
- `src/data/typeIcons.test.ts`
- `src/ui/hud/panels/starter/starterPanel.tsx`
- `src/ui/hud/panels/starter/starter.css`
- `src/ui/hud/panels/starter/README.md`
- `src/ui/hud/panels/starter/starterPanel.test.ts` (new)
- `src/ui/moveGrid.ts`
- `src/ui/moveGrid.test.ts`
- `docs/art-direction.md`
- `docs/hud-fidelity.md`

### Inputs (read-only)

- `AGENTS.md`.
- `design/screens/04-starter-pick.json` and `design/exports/04-starter-pick.png`
  (caption `04 Starter pick`) — the starter cards' 24×24 type cells.
- `design/screens/03m-panels-pokemon-moves.json` and
  `design/exports/03m-panels-pokemon-moves.png` (caption `03m Panels · Pokémon /
  moves`) — the move cells' square type glyphs.
- `src/data/typeIcons.ts`, `src/data/frlg/type-icons.json`.
- `src/ui/hud/kit/moveIcons.tsx`, `src/ui/hud/kit/index.ts`.
- `src/ui/moveGrid.ts`, `src/ui/moveGrid.test.ts`.
- `src/scenes/BootScene.ts` (lines 58 and 118-119, the spritesheet cut).
- `src/ui/hud/panels/starter/starterPanel.tsx`, `starter.css`, `view.ts`, `README.md`.
- `src/assets/optional.ts`, `src/assets/placeholders/`, `src/data/README.md`.
- `docs/art-direction.md`, `docs/hud-fidelity.md`.
- The source sheet: `C:\Users\Dani\projects\pkm-randomlike\sprite-sources\anil\Graphics\UI\types_mini.png`
  (456×24: 19 cells of 24×24, dex order with `???` between Steel and Fire and Fairy
  last). The worktree does **not** carry the store; pass this absolute path to the
  packer and never link the store into the worktree.

## 🔒 Contract

### TypeScript

`src/data/typeIcons.ts` keeps its public surface; only the comment and the numbers
behind it change:

```ts
export const TYPE_ICON_ATLAS_URL: string; // packed or placeholder
export const TYPE_ICON_TEXTURE_KEY = 'frlg:type-icons';
export const TYPE_ICON_W: number; // 24, from the manifest
export const TYPE_ICON_H: number; // 24, from the manifest
export function typeIconFrame(type: string): number | null; // unchanged
```

`src/ui/moveGrid.ts` gains one pure, exported layout helper so the square glyph's
geometry is testable headless; `layout` must read it and nothing else may duplicate
the numbers:

```ts
export type MoveGridIconLayout = Readonly<{
  /** The sprite scale the type and category glyphs share. */
  scale: number;
  /** The type glyph's y offset from the cell's top. */
  typeY: number;
  /** The category glyph's y offset from the cell's top. */
  categoryY: number;
  /** The PP/PWR/ACC line's y offset from the cell's top. */
  statY: number;
  /** The name's x offset from the cell's left, past the glyph. */
  nameX: number;
}>;
export function moveGridIconLayout(narrow: boolean): MoveGridIconLayout;
```

The returned offsets are in the cell's own pixels; `layout` adds `CELL_TOP` /
`CELL_PAD`. `typeY + TYPE_ICON_H * scale <= categoryY` and
`categoryY + 24 * scale <= statY` must hold for both viewports, and `nameX` must
clear `TYPE_ICON_W * scale`.

### Data

`src/data/frlg/type-icons.json` is written by the packer as:

```json
{
  "width": 24,
  "height": 24,
  "cols": 19,
  "rows": 1,
  "frames": ["normal", "...", "fairy"],
  "types": { "normal": 0, "...": 0, "fairy": 18 }
}
```

The frame order is exactly the old `FRAMES` order with the blank 20th entry removed:
`normal, fighting, flying, poison, ground, rock, bug, ghost, steel, unknown, fire,
water, grass, electric, psychic, ice, dragon, dark, fairy`. The atlas is
`19 * 24 = 456` wide and `24` tall; the committed blank is the same size.

## 🧩 Data and configuration

- The packer reads the **horizontal** strip `types_mini.png`: cell `index` starts at
  `x = index * 24, y = 0`, not the old vertical column. Bounds check the width
  (`sheet.width >= 19 * 24`) and the height (`>= 24`).
- `COLS = 19`, `ROWS = 1`, `ICON_W = ICON_H = 24`. Each cell is copied at 1:1; no
  scaling.
- `scripts/assets/pack.mjs`'s `frlg type icons` step requires and passes
  `anil/Graphics/UI/types_mini.png`.
- The starter card's 24×24 cell uses `MoveTypeBadge` (the kit's Añil glyph) inside
  the existing `data-hud-starter-badge={type}` wrapper; the word `TypeBadge` stays as
  the fallback inside `MoveTypeBadge` only.
- The move cell's type glyph is the same 24×24 frame; the category glyph stays its
  own 32×14 sheet. Both are drawn at the same scale, so the type glyph is 24×24 and
  the category 32×14; the stack must not overlap. The design's move cell has the
  type glyph at the top-left and the category glyph below it; the name starts to the
  right, and the PP/PWR/ACC lines sit under the name, not under the glyph column.
  Re-measure against `03m`; the exact scale/offsets are yours to pin.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - Run the packer before the tests, so `hasArt('frlg/type-icons.png')` is true and
    `typeIcons.test.ts` is not skipped:
    `node scripts/frlg/build-type-icons.mjs "C:\Users\Dani\projects\pkm-randomlike\sprite-sources\anil\Graphics\UI\types_mini.png"`
  - Regenerate the committed blank:
    `node scripts/assets/build-placeholders.mjs frlg/type-icons.png`
  - `npm test`
  - `npm run build`
  - `git diff --name-only main...task-309` against the exclusive paths.
- **Acceptance criteria:**
  - [ ] `[unit]` `TYPE_ICON_W === 24`, `TYPE_ICON_H === 24`, the manifest is
    `cols: 19, rows: 1`, the decoded atlas is 456×24, and every dex type plus Fairy
    has a non-empty frame (the existing `typeIcons.test.ts` re-pinned).
  - [ ] `[unit]` `MoveTypeBadge({type:'fire'})` still paints a `kit-move-type` span
    with the type-icons background in a 24 px box, and an unknown type still falls
    back to the word chip (the kit's existing tests stay green).
  - [ ] `[unit]` `moveGridIconLayout(false)` and `moveGridIconLayout(true)` satisfy
    `typeY + TYPE_ICON_H * scale <= categoryY`, `categoryY + 24 * scale <= statY` and
    `nameX >= TYPE_ICON_W * scale`; the test lives in `src/ui/moveGrid.test.ts`.
  - [ ] `[unit]` `starterPanel.tsx` names `MoveTypeBadge` and does not name
    `TypeBadge`; `starter.css` names `.starter__badge > .kit-move-type` (a source
    pin in the new `starterPanel.test.ts`).
  - [ ] `[unit]` The suite and the build are green.
  - [ ] `[live]` At 1280×800 on a new run, the three starter cards draw the Añil
    GRASS/POISON, FIRE and WATER glyphs in the frame's 24×24 cells (read the three
    `[data-hud-starter-badge]` nodes: each is a 24×24 `kit-move-type` with the
    type-icons background and no text), and in `03m` the four move cells draw the
    same square glyphs above their category glyphs with no clipped word and no
    overlap (read the cell's glyph boxes against the name and PP/PWR lines).

## 📣 Coordination

- For the Architect: the type atlas is now 456×24 / 19×1; any future task that pins
  the old 32×14 / 4×5 grid must move.
- For the next batch: the starter cards and the move cells are the only two
  consumers of `type-icons.png`; the battle's floating info popup uses the same
  texture key and frame numbers, so it follows for free.
- The generated atlas and the placeholder are separate: the atlas is gitignored,
  the placeholder is committed.

## ⛔ Out of scope

- No new type art beyond `types_mini.png`; no CSS redesign of the starter card.
- No change to `src/ui/hud/kit/**` (the kit already ships `MoveTypeBadge`).
- No change to the `TypeBadge` word chip itself.
- No change to the `type-icons.json` frame order or the `types` map keys.
- No change to the battle's move grid cell text/size beyond the glyph geometry.
