# Spec: Task-203 — A move prints its type and its category as icons, never as words

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** data-driven UI kit + two DOM panels + docs.
- **Role:** Dev.
- **Objective:** after this task a move's **type** and **category** are drawn from the two
  packed atlases everywhere the game shows a move outside the canvas: one
  `MoveTypeBadge`/`MoveCategoryIcon` pair in `src/ui/hud/kit/` renders the Añil type badge
  and the official category glyph, the battle's four move cells and the detail panel's four
  move cells both draw them at boxes their views measure, the detail's learnset pool row
  swaps its text `TypeBadge` for the icon, and the battle's description card head draws the
  category as the glyph — so no move surface prints `dragon` / `PHYSICAL` ever again.
- **Environment:** worktree `../wt-pkm-203`, branch `task-203`.
- **Dependencies:** none to merge. It reads (never writes)
  `src/data/typeIcons.ts` (`TYPE_ICON_ATLAS_URL`, `TYPE_ICON_TEXTURE_KEY`,
  `TYPE_ICON_W`, `TYPE_ICON_H`, `typeIconFrame`),
  `src/data/moveCategoryIcons.ts` (`MOVE_CATEGORY_ATLAS_URL`, `MOVE_CATEGORY_ICON_W`,
  `MOVE_CATEGORY_ICON_H`, `categoryIconFrame`), `src/data/frlg/type-icons.json`
  (`cols: 4`, 19 frames, 32×14), `src/data/frlg/move-categories.json` (3 frames,
  32×14, one row) and `src/ui/hud/kit/typeBadge.tsx` (the existing **text** chip, which
  stays: it is the fallback and the species-type chip).

### Exclusive paths (single writer)

Nothing outside this list. No other task in Batch 87 claims any of these.

- `src/ui/hud/kit/moveIcons.tsx` *(new)*
- `src/ui/hud/kit/moveIcons.test.ts` *(new)*
- `src/ui/hud/kit/index.ts`
- `src/ui/hud/kit/index.test.ts`
- `src/ui/hud/kit/kit.css`
- `src/ui/hud/kit/kit.css.test.ts` *(only if the new sprite class needs an anchor)*
- `src/ui/hud/kit/README.md`
- `src/ui/hud/panels/detail/view.ts`
- `src/ui/hud/panels/detail/view.test.ts`
- `src/ui/hud/panels/detail/detailPanel.tsx`
- `src/ui/hud/panels/detail/detail.css`
- `src/ui/hud/panels/detail/README.md`
- `src/ui/hud/panels/battle-moves/view.ts`
- `src/ui/hud/panels/battle-moves/view.test.ts`
- `src/ui/hud/panels/battle-moves/battleMoves.tsx`
- `src/ui/hud/panels/battle-moves/battleMoves.test.ts`
- `src/ui/hud/panels/battle-moves/battleMoves.css`
- `src/ui/hud/panels/battle-moves/README.md`
- `src/ui/hud/panels/battle-moves/index.ts` *(only if a constant is added or renamed)*
- `docs/hud-fidelity.md` — **two blocks of §5 and all of §6**, see the boundary below

No scene, no `src/data/**`, no i18n table, no fixture.

### Inputs (read-only)

Beyond `AGENTS.md`:

- `src/data/typeIcons.ts` + `src/data/typeIcons.test.ts`,
  `src/data/moveCategoryIcons.ts`, `src/data/frlg/type-icons.json`,
  `src/data/frlg/move-categories.json`, `src/assets/placeholders/frlg/{type-icons,move-categories}.png`.
- `src/ui/moveGrid.ts` (`MoveGridCell`, `moveGridCellRects`, `TYPE_ICON_TEXTURE_KEY`
  drawing — the **canvas** already draws both icons; you are not touching it).
- `src/ui/hud/kit/{typeBadge.tsx,kit.css,index.ts,index.test.ts,kit.css.test.ts,README.md}`,
  `src/ui/hud/styles/root.css` (the `--hud-*` tokens).
- `src/ui/hud/panels/{battle-moves,detail}/**`.
- `design/frames/05-battle-hud.json`, `design/frames/03m-panels-pokemon-moves.json`
  (`move chip N` and `move category N` are 24×24 boxes with an `IMAGE` fill,
  `scaleMode: FIT`, at the cell's +12 / +6 and +12 / +34; the text column starts at +44).
- `docs/hud-fidelity.md` §5–§6, `docs/design-spec.md` §4 (read only — its command window
  belongs to `[Task-206]`).

## 🔒 Contract

### TypeScript — the kit pair

```ts
// src/ui/hud/kit/moveIcons.tsx  (new)
import type { JSX } from 'preact';

/** The px square a move icon is laid out in: the board's `move chip` / `move category` box. */
export const MOVE_ICON_BOX: 24;

/** One packed atlas frame, plus the grid it lives in. */
export type MoveIconSprite = Readonly<{
  /** The packed atlas URL (the placeholder on a tree without the rip). */
  url: string;
  /** The frame's index in the atlas, row-major. */
  frame: number;
  /** One frame's pixel size inside the atlas. */
  w: number;
  h: number;
  /** The atlas grid's column count, for the frame's offset. */
  cols: number;
  /** The atlas grid's row count: the whole grid is what the background scales. */
  rows: number;
}>;

/** The type badge's sprite, or null when the atlas has no frame for `type`. */
export function moveTypeSprite(type: string): MoveIconSprite | null;

/** The category glyph's sprite, or null for a category the atlas does not name. */
export function moveCategorySprite(category: string): MoveIconSprite | null;

/**
 * The inline background that draws `sprite` inside a `box`-sided square: the frame
 * **contained** (FIT) and centred, one cell of the atlas, so 32×14 becomes 24×10.5 in a
 * 24 px box. Pure arithmetic; no DOM.
 */
export function spriteBox(sprite: MoveIconSprite, box?: number): Readonly<{
  backgroundImage: string;
  backgroundSize: string;
  backgroundPosition: string;
  backgroundRepeat: 'no-repeat';
  imageRendering: 'pixelated';
  clipPath: string;
}>;

export type MoveTypeBadgeProps = Readonly<{ type: string }>;
export type MoveCategoryIconProps = Readonly<{ category: string }>;

/** The canon type badge. Falls back to the `TypeBadge` word chip for a type with no frame. */
export function MoveTypeBadge(props: MoveTypeBadgeProps): JSX.Element;

/** The official category glyph. Falls back to the raw category word for no frame. */
export function MoveCategoryIcon(props: MoveCategoryIconProps): JSX.Element;
```

Frozen details:

- `spriteBox`'s numbers: `scale = Math.min(box / sprite.w, box / sprite.h)`;
  `backgroundSize` is the **whole packed atlas scaled**, never one frame:
  `` `${sprite.w * scale * sprite.cols}px ${sprite.h * scale * sprite.rows}px` ``;
  `col = sprite.frame % sprite.cols`, `row = Math.floor(sprite.frame / sprite.cols)`;
  `backgroundPosition: \`${-col * sprite.w * scale}px ${(box - sprite.h * scale) / 2 - row * sprite.h * scale}px\``;
  `backgroundImage: \`url("${sprite.url}")\``. `box` defaults to `MOVE_ICON_BOX`.
  *(Corrected after Integration QA round 1: with a one-frame `background-size`, every frame
  but row 0 / column 0 lands outside the 24 px element and paints nothing — only `normal` and
  `Physical` were visible. The frame's own scaled size `w·scale × h·scale` is only the
  **position step**; the box's background is the grid.)*
  The band must also be **clipped** to the frame: `spriteBox` returns
  ``clipPath: `inset(${(box - h·scale) / 2}px 0px)` `` (top/bottom = the centring gap, left/right
  `0`), so a 24 px box with a 10.5 px frame paints only its own 24 × 10.5 band. *(Corrected
  after Task QA round 2: without the clip the whole grid shows through and a type icon paints
  the rows above and below it — `psychic` drew the bottom of `fire`, itself and the top of
  `fairy`.)*
- Resolvers read the frame from the **accessors** (`typeIconFrame`, `categoryIconFrame`) and
  the grid from the **manifests** (`cols` and `rows` from `type-icons.json`, which declares
  `cols: 4`, `rows: 5`; the category atlas is one row, so its `cols` is its `frames.length`
  and its `rows` is `1` — read `move-categories.json`'s `frames` array, never a literal `3`).
  Case is the accessors': `typeIconFrame` lowercases, so `'Fire'` and `'fire'` both resolve
  to frame `10`.
- Fallbacks: `MoveTypeBadge` with `moveTypeSprite(type) === null` returns
  `TypeBadge({ type })` — the **word**, never an empty box; `MoveCategoryIcon` with a null
  sprite returns a `<span class="kit-move-category-text">{props.category}</span>`.
- The rendered icon span is `class="kit-move-type"` / `class="kit-move-category"`,
  `role="img"`, `aria-label` = the raw type/`category` string, and `style` = `spriteBox(...)`
  plus `width`/`height` = the box it was given (24 by default). It draws **no text node**.
- `kit/moveIcons.tsx` imports only `preact`, the two `src/data` accessors and the two
  manifests: no Phaser, no DOM query, no i18n, no engine, no clock, no RNG.
  (`kit/typeBadge.tsx` already reads `src/ui/typeColors`, so a data read is in the kit's
  precedent; the kit's "no i18n" rule stands.)

### TypeScript — the barrel

`src/ui/hud/kit/index.ts` re-exports, in addition to today's list:

```ts
export { MoveCategoryIcon, MoveTypeBadge, MOVE_ICON_BOX, moveCategorySprite, moveTypeSprite, spriteBox } from './moveIcons';
export type { MoveCategoryIconProps, MoveIconSprite, MoveTypeBadgeProps } from './moveIcons';
```

`src/ui/hud/kit/index.test.ts`'s `CONTRACT` gains the six runtime names, and its
"exports only functions at runtime" case becomes: every name but `MOVE_ICON_BOX` is a
`function`, and `MOVE_ICON_BOX === 24`. No other export may be added.

### TypeScript — battle-moves view (`src/ui/hud/panels/battle-moves/view.ts`)

`BattleMoveSlotView` keeps every field it has; these three change shape and meaning:

- `categoryBox` — was the widest **text** column (`CATEGORY_W`, 60 px). It becomes the
  category **glyph's** box: `w === 24`, `h === 24` on the wide cell and `h === BODY_LINE_H`
  (13) on the compact cell, still ending `MOVE_CATEGORY_GAP` (8) left of the ⓘ.
- `typeBox` — was the type **chip's** text box (`chipWidth(type)` × 10). It becomes the
  badge's **24×24** box:
  - wide cell: `{ x: content.x, y: band + BODY_LINE_H + 1, w: 24, h: 24 }` — the stat
    gutter, centred over the two 13 px stat lines;
  - compact cell: `{ x: content.x, y: band, w: 24, h: 24 }` — the first row's left, where
    the type chip already was (it overhangs into the second line the way the 22 px ⓘ
    already does; the category glyph sits at the right of that second line, so the two
    never meet).
- `boxes.name` — the **name column** shrinks by the difference between the old 60 px text
  column and the 24 px glyph (wide cell: 96 px → **132 px** in the 222 px cell at
  1280×800). The compact cell's name is `plane(2)`, unchanged at the 91 px content width.
- The stat gutter: `boxes.pp`/`boxes.power` start at `boxes.name.x + 24 + CELL_GAP`
  (was `name.x + chipWidth(type) + CELL_GAP`).
- `CATEGORY_LABELS` and `CATEGORY_W` are **deleted**; `MOVE_CATEGORY_GAP` and every other
  exported constant keep their name and value. `category` stays the raw word on the view
  (`'Physical' | 'Special' | 'Status'` as the data gives it) — the component decides
  between the glyph and the word.
- `typeBox` and `categoryBox` of an **empty** slot stay zero-width marks (unchanged rule).
- **`battleMovesBox`, `compactCard`, `fitsInside`, `cellTextBoxes`'s signature,
  `MOVE_MEGA_COL`, `MOVE_GMAX_COL`, `MOVE_BACK_COL`, `MOVE_GRID_INSET`, `MOVE_INFO_SIZE`,
  `MOVE_TARGET_TOP`, `MOVE_TARGET_H`, `BATTLE_COMPACT` and `battleMovesView`'s input shape
  are frozen**: `[Task-206]` imports `battleMovesBox` and `MOVE_MEGA_COL` from this module
  in the same batch.

### TypeScript — detail view (`src/ui/hud/panels/detail/view.ts`)

`DetailMoveSlotView` keeps every field and **adds** five boxes, all panel-relative like
`box`/`info` (i.e. already `inner()`-ed from the grid's absolute rect):

```ts
/** The badge's box: the cell's left column, the board's own insets. */
typeBox: Rect;      // { x: box.x + 10, y: box.y + 10, w: 24, h: 24 }
/** The category glyph's box, 2 px under the badge. */
categoryBox: Rect;  // { x: box.x + 10, y: box.y + 36, w: 24, h: 24 }
/** The move's own name line: right of the icon column and clear of the ⓘ. */
nameBox: Rect;      // { x: box.x + 44, y: box.y + 8,  w: max(0, box.w - 44 - 14 - 28), h: 13 }
/** `PP 12/15` on its own line, the board's three-line column. */
ppBox: Rect;        // { x: box.x + 44, y: box.y + 24, w: max(0, box.w - 44 - 14), h: 13 }
/** The power / accuracy pair's line: power left-aligned, accuracy right-aligned inside it. */
statsBox: Rect;     // { x: box.x + 44, y: box.y + 38, w: max(0, box.w - 44 - 14), h: 13 }
```

- An **empty** slot gets the same five boxes with `w: 0` (the `mark()` rule the view already
  uses) so the panel can paint unconditionally.
- `info` (the ⓘ box) is unchanged (`{ x: box.w - 36, y: 8, w: 22, h: 22 }`).
- `DetailPoolRowView` is unchanged; the pool row keeps its flow layout and swaps only the
  component it renders.
- Nothing else in `detailPanelView` changes: `stats`, `tabs`, `evolution`, `nickname`,
  `search`, `pool` keep their shape and rects.

## 🧩 Data and configuration

No new data. The two atlases and their manifests ship already
(`src/assets/frlg/type-icons.png` + `type-icons.json`; `src/assets/frlg/move-categories.png`
+ `move-categories.json`), each with a committed placeholder under
`src/assets/placeholders/`, so a clean clone draws the badges.

The icon map you must **record** in `docs/hud-fidelity.md` §6 (it is the atlas's own
contents, read from the manifests, not invented):

| badge | frame | grid |
| --- | --- | --- |
| type (19 rows: normal 0, fighting 1, flying 2, poison 3, ground 4, rock 5, bug 6, ghost 7, steel 8, unknown 9, fire 10, water 11, grass 12, electric 13, psychic 14, ice 15, dragon 16, dark 17, fairy 18) | as listed | 4 columns × 5 rows, 32×14 a frame |
| category (Physical 0, Special 1, Status 2) | as listed | 1 row of 3, 32×14 a frame |

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; green.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-203` audited against the exclusive-path list.
  - **Browser pass:** `npm run dev` (port **5175**), Chromium `/usr/bin/chromium`, the DOM
    HUD at `http://localhost:5175/?hud=dom`, viewports exactly **1280×800** and
    **390×844**; every measurement is a `getBoundingClientRect()` or a
    `getComputedStyle(...).backgroundImage` read over CDP, never a screenshot. The asset
    store is at `$ASSETS_ROOT` and is **never** symlinked into the worktree; the committed
    placeholders are the shipped fallback and the icons must render from them.
- **Two browser paths, both needed:**
  1. **A battle's four cells.** Boot, pick a starter, walk into tall grass (or a trainer's
     line of sight) until a battle opens; the command window is up. Press `confirm`
     (default key `E`) on FIGHT so the four move cells paint.
  2. **The detail panel's four cells.** On the route press `P` (party panel), click a
     party row (`[data-hud-party-member]`) so the detail card opens, then click
     `[data-hud-detail-tab="moves"]`.

- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` clean.
  - [ ] `[unit]` `npm test` green.
  - [ ] `[unit]` `kit/moveIcons.test.ts`: for **every** type in `type-icons.json`'s `types`
    map, `moveTypeSprite(type)` returns that frame with `w: 32, h: 14, cols: 4, rows: 5`;
    for `'Physical'`, `'Special'` and `'Status'`, `moveCategorySprite` returns frames 0, 1, 2
    with `cols: 3, rows: 1`; `moveTypeSprite('nonsense')` and
    `moveCategorySprite('nonsense')` are `null`; `spriteBox(moveTypeSprite('fire')!)` has
    `backgroundSize` parsing to **96 × 52.5** (the whole 4×5 atlas scaled, *not* one frame)
    and `backgroundPosition` parsing to **-48 × -14.25** within 0.01, and
    `spriteBox(moveCategorySprite('Status')!)` parses to `backgroundSize` **72 × 10.5** (three
    columns × one row at the same FIT scale) and `backgroundPosition` **-48 × 6.75**. A frame
    whose index is not 0 must therefore sit inside the box: add a case that for `frame = 14`
    (psychic) the painted rect `[-col·w·scale, -row·h·scale]` falls within `[0, box]` after
    the centring offset.
  - [ ] `[unit]` `kit/moveIcons.test.ts`: `spriteBox` returns a `clipPath` of
    `inset(6.75px 0px)` for a 24 px box (the `(24 − 10.5) / 2` centring gap, types and
    categories alike), and the value scales with the box: `spriteBox(sprite, 48)` gives the
    same doubled band and `inset(13.5px 0px)`. The icon's inline style keeps every key the
    contract lists.
  - [ ] `[unit]` `kit/index.test.ts`: the barrel's runtime keys equal the new `CONTRACT`
    exactly (existing names + `MoveCategoryIcon`, `MoveTypeBadge`, `MOVE_ICON_BOX`,
    `moveCategorySprite`, `moveTypeSprite`, `spriteBox`), `MOVE_ICON_BOX === 24`, and
    `MoveTypeBadge({ type: 'fire' })` renders a node whose class is `kit-move-type` and
    whose children are `undefined`/empty, while `MoveTypeBadge({ type: 'nonsense' })`
    renders the `TypeBadge` word chip carrying the raw string.
  - [ ] `[unit]` `battle-moves/view.test.ts`: at 1280×800 the wide cell's
    `categoryBox.w === 24 && categoryBox.h === 24`, `categoryBox.x + 24 === info.x - 8`,
    `typeBox.w === 24 && typeBox.h === 24`, `nameBox.w === 132` and
    `nameBox.x + nameBox.w === categoryBox.x - 8`; at 390×844 the compact cell's
    `typeBox` is `{ x: content.x, y: band, w: 24, h: 24 }`, `categoryBox.h === 13` and the
    name line is still the 91 px content width; in both classes `typeBox` and
    `categoryBox` lie inside the cell and do not intersect each other. **The old pins
    `categoryBox.w === 60`, `typeBox` `{ w: 36, h: 10 }` /
    `{ w: 42, h: 10 }` and the "category prints its own label" cases are replaced, not
    deleted silently: the same file keeps a case asserting the glyph fits its box.**
  - [ ] `[unit]` `battle-moves/battleMoves.test.ts`: each filled slot paints exactly one
    span whose class is `kit-move-type`, placed at `slot.typeBox`, and exactly one whose
    class is `kit-move-category`, placed at `slot.categoryBox`; an empty slot paints
    neither; the description card's head paints the category glyph (`kit-move-category`),
    not the word.
  - [ ] `[unit]` `detail/view.test.ts`: for the four moves at 1280×800
    (`box.w === 202`) `nameBox.w === 116`; at 390×844 (`box.w === 159`) `nameBox.w === 73`;
    in both, `typeBox`/`categoryBox` are 24×24 inside the cell, `categoryBox.y ===
    typeBox.y + 26`, `nameBox.x === typeBox.x + 34`, `ppBox.y === nameBox.y + 16`,
    `statsBox.y === ppBox.y + 14`, and the five boxes sit inside `slot.box` and clear of
    the ⓘ box (`nameBox`, `ppBox`, `statsBox` may not intersect it).
  - [ ] `[unit]` `detail/fixture.test.ts` still passes unchanged (the fixture's own copy).
  - [ ] `[unit]` no runtime string `PHYSICAL`, `SPECIAL` or `STATUS` remains in
    `battle-moves/**` or `detail/**` outside a test, and `CATEGORY_LABELS`/`CATEGORY_W` no
    longer appear anywhere in `src/`.
  - [ ] `[live]` **Battle, 1280×800:** with the four move cells open, each
        `[data-hud-move-slot]` contains exactly one `.kit-move-type` and one
        `.kit-move-category`; each icon's `getBoundingClientRect()` lies inside its cell's
        rect (±0.5 px on all four edges) and does not intersect the cell's
        `.battle-moves__name` rect; each icon's `getComputedStyle(...).backgroundImage`
        contains `/frlg/type-icons.png` and `/frlg/move-categories.png` respectively; no
        cell's text content matches `/PHYSICAL|SPECIAL|STATUS/`.
  - [ ] `[live]` **Battle, 1280×800 — the icons actually paint their own frame.** This is
        the criterion round 1 failed and it must be a **painted-pixel** measurement, never
        an element/URL presence check: for a type whose frame is not 0 (e.g. `psychic`,
        frame 14) and a category whose frame is not 0 (e.g. `Special`, frame 1), crop the
        icon's own 24×24 rect twice — once as drawn and once with `background-image: none`
        forced on that element — and count the pixels that differ. **Pass:** each
        non-first-frame icon has a painted area of **at least 100 px** that changes when the
        image is removed, and its crop is **not byte-identical** to the no-image crop; a
        first-frame icon (`normal`, `Physical`) serves as the control. Distinct RGB count is
        **not** a criterion: a type badge is a flat single-colour silhouette (Psychic
        legitimately measures 1 RGB over 576 px), so colour count alone would red a correct
        icon. A crop that is byte-identical with and without the image is a **fail** — that
        is exactly the defect `background-size: 24×10.5` produced. Category glyphs are
        anti-aliased and typically show 2–3 RGB values over ~264 px.
  - [ ] `[live]` **Battle, 1280×800 — the frame is clipped to its own band.** The round-2
        failure: with the whole atlas as the background and no clip, the 24 px box paints the
        two neighbouring rows' bands too (`psychic` measured 568 painted px: the bottom of
        `fire`, itself, the top of `fairy`; forcing `clip-path: inset(6.75px 0px)` on the
        same element measured 282). Measure on a non-first type frame: (a) the icon's painted
        area is **between 100 and 320 px** — one badge, never two rows — and (b) the box's
        top and bottom bands (the first and last 6 px rows of the 24×24 rect) are
        **byte-identical** with and without `background-image`, while the middle band
        differs. The category glyph may be measured with (a) only (one-row atlas). A painted
        count near 568, or a top band that changes when the image is removed, is a **fail**.
  - [ ] `[live]` **Battle, 390×844:** the same five assertions hold with the compact card
        (`[data-hud-panel="battle-moves"][data-compact="true"]`), and the type icon's box
        (24 px at the cell's left) does not intersect the ⓘ button's box (`x` ranges must
        be disjoint: the icon ends ≤ `info.x - 8`).
  - [ ] `[live]` **Detail, 1280×800 and 390×844:** on the MOVES tab every
        `[data-hud-detail-slot]:not([data-empty="true"])` contains one `.kit-move-type` and
        one `.kit-move-category`; each icon's rect lies inside the slot's rect and clears
        the slot's `[data-hud-detail-info]` button, the `.detail__slot-name` span and the
        `PP`/`PWR`/`ACC` spans (no intersection at 0.5 px tolerance, i.e. no text and no
        icon overlap); and every `[data-hud-detail-pool]` row shows a `.kit-move-type`
        instead of a `.kit-type`.
  - [ ] `[live]` **Detail, 390×844:** the four icons still fit their slots (same
        containment), and no name/PP/PWR/ACC span is clipped by the icon column — measured
        as: each span's `getBoundingClientRect().left ≥ slot.left + 44`.

## 📣 Coordination

**Premises of the task entry I corrected against the tree:**

1. **`CATEGORY_LABELS` is at `src/ui/hud/panels/battle-moves/view.ts` line 66, not 57**, and
   the sibling `CATEGORY_W` (line 68) is the widest label's *measured* width (60 px), not a
   constant you can keep. Both are deleted by this task.
2. **The detail's move cells do not print the type word at all.** `MoveSlot` in
   `detailPanel.tsx` paints `name` + a `pp/pwr/acc` row and nothing else; the only move-type
   text in that panel is the **learnset pool row's** `TypeBadge`, which `.kit-type`
   uppercases (`DRAGON`, not `dragon`). So the detail half of this task is an **omission to
   fill** (both icons in the four cells) plus a **swap** (the pool row's word → icon), not a
   word to replace.
3. **The learnset pool cannot show a category glyph**: `DetailPoolRow` (`view.ts`) carries
   `moveId`, `name`, `type`, `source`, `enabled` — no category, and the scene that builds
   the pool is outside this task's paths. The pool row therefore gets the **type badge
   only**; the four cells get both.
4. The entry's "`src/data/typeIcons.ts` (read-only)" holds — and note the type atlas is
   19 frames in **4 columns × 5 rows**, so a DOM sprite needs the column count from
   `src/data/frlg/type-icons.json`; `typeIcons.ts` does not export it. The category atlas is
   one row, so its column count is its frame count.
5. `TypeBadge` stays the **word** chip: it is the species-type chip in the detail header and
   the starter cards, and it is the fallback this task needs. Do not restyle it.
6. `kit/index.test.ts` pins the barrel's exact runtime export list; the new names are a
   deliberate contract change and that test is yours to update.

**The `docs/hud-fidelity.md` boundary (law for this batch):**

- **You own, and may rewrite:** §5's block that opens
  `**A cell's text is bounded by its own box.**` and §5's block that opens
  `**The compact battle has its own cell.**`, plus all of `## 6. Frame → node map` (append
  the icon-map table; keep the existing frame table's rows intact).
- **You may not touch** §5's other blocks — those that open `**Desktop.**`, `**Mobile.**`,
  `**Chips.**`, `**The pad**` and `**The target step's prompt.**` — nor §5's opening
  heading, nor any other section of the file. Do not re-flow a shared block: 199 holds §9, 206
  holds the `**Battle zones.**` block, and integration QA diffs the merged document.
- Inside your two blocks, the numbers that must change are: the name column
  (**96 px → 132 px** in the 222 px cell at 1280×800), the category column
  (**60 px text column → 24 px glyph box**, still ending `MOVE_CATEGORY_GAP` left of the ⓘ),
  the type chip's description (a **24×24 box in the stat gutter**, no longer a text chip on
  the stat block's first column), and on the compact cell: the glyph's box is the second
  line's 13 px band at the same right edge, drawn 24×10.5, and the name keeps its full
  91 px line. Any sentence that says the category "prints right-aligned" or names
  `PHYSICAL`/`SPECIAL`/`STATUS` as painted text is now false and must be rewritten.

- **For the Architect:** the entry's `[live]` says "both widths, in the battle and in the
  detail panel" — delivered as four `[live]` criteria (two surfaces × two viewports)
  because QA reaches them on two different screens.
- **For `[Task-206]` (same batch, other half of the card):** it imports `battleMovesBox`,
  `MOVE_MEGA_COL` and `MOVE_GRID_INSET` from `battle-moves`; those names, their values and
  their signatures are frozen by this task. It also owns the `**Battle zones.**` block of §5,
  whose closing sentence about the category column becomes stale the moment your change
  lands — 206 is instructed to correct it; do not edit it yourself.

### Round-1 correction (after Integration QA, 2026-10-27)

Integration QA measured the **combined Batch-87 tree** and found the icons blank for every
frame but the atlas's first: `spriteBox` set `backgroundSize` to a **single frame's** scaled
size while moving the background by whole frames, so `psychic` (`-48px -24.75px` over a
`24×10.5` background) painted 0 px² and only `normal` / `Physical` survived. The Task QA that
passed it checked element presence, rects and the atlas URL, not painted pixels — which is
why the `[unit]` pin (`24 × 10.5`) and the live check both stayed green. This spec is
corrected above: `MoveIconSprite` gains `rows`, `backgroundSize` is the **whole atlas scaled**
(`w·scale·cols × h·scale·rows`), and the `[live]` plan gains a painted-pixel criterion that a
crop of a non-first frame cannot pass with a blank box. Existing consumers and the frozen
`battleMovesBox` / `MOVE_MEGA_COL` / `MOVE_GRID_INSET` names do not move; only
`moveIcons.tsx`'s arithmetic, its type and its test change. Corrective round **1 of 2**.

### Round-2 correction (after Task QA's measured-pixel pass, 2026-10-27)

The whole-atlas background fixed the blank frames but exposed the next band: nothing clipped
the background to the frame, so a type icon painted the rows above and below it (`psychic`
measured **568** painted px — the bottom of `fire`, its own badge, the top of `fairy` — against
**282** with a forced `clip-path: inset(6.75px 0px)`). The contract now freezes
`clipPath: inset(${(box − h·scale) / 2}px 0px)`, the `[unit]` plan pins it, and the `[live]`
plan gains a band-clipping criterion (painted area 100–320 px, top/bottom bands byte-identical
with and without the image). This is corrective round **2 of 2**: if this pass is red, the
batch stops and the task is escaped to the human rather than patched again.
- **For `[Task-205]`** (the evolution tab, next batch): the detail view's `moves` array
  keeps its shape; only the five boxes above are added.
- **For `[Task-214]`** (the move card without the ⓘ, Batch 89): the category glyph and the
  type badge stay where this task puts them; only the ⓘ and the cells' name column change.

## ⛔ Out of scope

- **No canvas change.** `src/ui/moveGrid.ts` and both scenes already draw both icons; the
  Phaser side is not touched and must not be "unified" with the DOM one.
- No change to `TypeBadge`, `typeBadgeTone` or the type palette.
- No data change: no atlas regenerated, no manifest edited, no `src/data/**` write.
- No i18n, no new key, no `t()` call inside the icons (a badge is content, not chrome).
- No new fixture, no `?hudFixture` slug, no `preview.ts` for either panel.
- No change to a cell's *outer* rect, the card's rect, the HP clearance, the ⓘ box, the
  target step's prompt row, the MEGA/G-MAX columns or the ◀ back control.
- No "fallback colour block" for a missing frame: the word is the fallback.
