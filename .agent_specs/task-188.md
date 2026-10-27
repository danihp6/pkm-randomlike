# Spec: Task-188 — The DOM HUD draws the party's portraits, and the narrow main menu stops colliding

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** DOM HUD (Preact) panels + one shared module + docs.
- **Role:** Dev.
- **Objective:** three measured defects of the `?hud=dom` main menu, one seam.
  **(a)** The CONTINUE row paints four empty outlined cells where frame `01` paints
  the party's own sprites — the placeholder rule (`.main-menu__portrait`, a white-4 %
  fill and a 1-px hairline) is what ships, so the row reads as four empty inventory
  slots instead of "who is in the party". **(b)** A starter card draws the same empty
  square where the offered species' portrait belongs. **(c)** At 390×844 the
  footer's two right stat blocks collide: `MAX ELITE STRIKE` runs into
  `MONTHLY MAX STRIKE` and the value `7` sits on top of `NOVA`, because the three
  blocks are laid out in one fixed row that does not wrap.
- **Environment:** repository `/home/runner/work/pkm-randomlike/pkm-randomlike`,
  worktree `../wt-pkm-188`, branch `task-188`. Work only inside the worktree.
- **Dependencies:** none. The portrait atlas (`src/data/portraits.ts`), the party
  rows (`src/ui/partyScreen.ts`) and both panels ship.

### Exclusive paths (single writer)

Nothing outside this list:

- `src/ui/hud/portrait.ts` (**new**) and `src/ui/hud/portrait.test.ts` (**new**)
- `src/ui/hud/README.md` (one line for the new module)
- `src/ui/hud/panels/main-menu/**` — `view.ts`, `view.test.ts`, `preview.ts`,
  `mainMenuPanel.tsx`, `main-menu.css`, `fixture.test.ts`, `README.md`
- `src/ui/hud/panels/starter/**` — `view.ts`, `view.test.ts`, `preview.ts`,
  `starterPanel.tsx`, `starter.css`, `fixture.test.ts`, `README.md`
- `docs/design-spec.md` — **§2 only, its main-menu bullet**
- `docs/hud-fidelity.md` — **a new §9 appended at the end of the file**

Do not touch `src/ui/hud/panels/**` outside these two, `src/scenes/**`, `src/main.ts`,
`src/i18n/**`, `src/data/**`, `src/assets/**`, `docs/hud-fidelity.md` §1-§8 (another
task in this batch owns §5) or any other doc.

### Inputs (read-only)

- `AGENTS.md`
- `src/data/portraits.ts` (`portraitFor`, `PORTRAIT_SIZE`, `PORTRAIT_COLS`,
  `PORTRAIT_ATLAS_URL`)
- `src/ui/partyScreen.ts` (`PartyRow` carries `speciesId` and `shiny`)
- `src/ui/hud/state.ts`, `src/ui/hud/kit/**` (the shared kit and its style helpers)
- `design/fixtures/01-main-menu.json`, `01b-main-menu-no-save.json`,
  `04-starter-pick.json`
- `src/ui/hud/panels/battle-moves/battleMoves.tsx` (`insetStyle` — the pattern for a
  rect from the model applied inline)

## 🔒 Contract

### TypeScript — `src/ui/hud/portrait.ts` (new, pure)

No Phaser, no `fetch`, no `canvas`, no DOM globals: the module answers plain data and
a CSS property bag, so it is unit-testable headlessly.

```ts
/** One party/starter portrait as the DOM draws it: an atlas cell, not a texture read. */
export type PortraitCrop = Readonly<{
  /** The portrait atlas URL (`PORTRAIT_ATLAS_URL`). */
  url: string;
  /** The cell's column and row in the atlas. */
  col: number;
  row: number;
  /** The atlas's column count, so a renderer can size the whole sheet. */
  cols: number;
  /** The atlas's cell size in px (`PORTRAIT_SIZE`, 64). */
  cell: number;
}>;

/** The species' portrait cell, or null when the atlas has none (the box stays a box). */
export function portraitCrop(speciesId: string, shiny?: boolean): PortraitCrop | null;

/** The inline style a `box`-px square needs to show exactly that cell. */
export function portraitBackground(
  crop: PortraitCrop,
  box: number,
): Readonly<{
  backgroundImage: string;
  backgroundPosition: string;
  backgroundSize: string;
  backgroundRepeat: 'no-repeat';
  imageRendering: 'pixelated';
}>;
```

- `portraitCrop` reads `portraitFor(speciesId, shiny)`; `null` for a null/empty id and
  for a species the atlas does not name (including a Mega with no cell and no base).
  `col = frame % cols`, `row = Math.floor(frame / cols)`, both from
  `PORTRAIT_COLS`/`PORTRAIT_SIZE`. It never invents a cell and never throws.
- `portraitBackground(crop, box)` scales the atlas to the box: `backgroundSize` is
  `` `${crop.cols * box}px auto` ``, `backgroundPosition` is
  `` `${-crop.col` * box}px ...` `` (the same for the row), `backgroundImage` is
  `` `url("${crop.url}")` ``, `backgroundRepeat` `'no-repeat'`, `imageRendering`
  `'pixelated'`. A non-finite or negative `box` returns a zero-position bag rather
  than `NaN` in a style.

### Panels

- `MainMenuPortraitView` gains `portrait: PortraitCrop | null`; `liveMainMenuView`
  fills it from `partyRows(run)` (each row already carries `speciesId` and `shiny`),
  and `fixtureMainMenuView` fills it from the fixture state's own `party` rows
  (they carry `speciesId`). The `memberId` and `name` fields keep their meaning.
- `StarterCardView` gains `portrait: PortraitCrop | null`, filled from the card's
  `speciesId` in both the live and the fixture builder.
- Both panels draw the existing box (`.main-menu__portrait`, `.starter__portrait`)
  with `portraitBackground(crop, box)` spread into its `style` when `crop !== null`,
  and with **no** background when it is `null` — the box keeps its 4 % fill and its
  hairline, which is the documented fallback. Keep `role="img"` and the `aria-label`
  the panels already set. The desktop box is 26 px and the compact box 22 px
  (`main-menu.css` already carries both sizes; `starter.css` has its own — read it and
  keep its size).
- No `data-` attribute is renamed or removed: `data-hud-main-menu-portrait` and
  `data-hud-starter-portrait` stay, because QA measures them.

### The compact footer

The three stat blocks stop sharing one fixed row at `≤ 600 px`. Ship one layout and
express it as data:

```ts
/** The compact footer's blocks at 390×844, in page coordinates, one per stat id. */
export const MAIN_MENU_FOOTER_NARROW: Readonly<Record<MainMenuStatId, Rect>>;
```

- Three blocks, **two per row**: `wins` and `elite` on the first row, `monthly` on the
  second, each `w ≥ 160`, a `≥ 8 px` gutter between columns and rows, the left edge at
  `x = 16`, the first row's top at the grid the phone frame uses (`footer.labelY`,
  676). Nothing may leave the 390 px column (`x + w ≤ 374`).
- The stylesheet (or an inline style built from the same table) positions them; either
  way the rendered rects must equal the model's within 1 px, which the `[live]`
  criterion measures. The desktop footer (`columns: [96, 240, 724]`) is **unchanged**.
- The version node's `display: none` at 390 is **accepted as it stands** (rect 0×0,
  nothing painted): do not change it.

### Docs

- `docs/design-spec.md` §2's main-menu bullet: the CONTINUE row shows the party's own
  portraits, and the compact footer wraps into two rows.
- `docs/hud-fidelity.md`: **append a new §9** ("Portraits in the DOM HUD") stating that
  a portrait is the `public/anil/portraits.png` cell drawn by CSS background
  arithmetic (`portraitBackground`), never a Phaser texture read and never a `fetch`;
  that the empty box is only the fallback for a species the atlas does not name; and
  the compact footer's two-row figure. Do not edit §1-§8.

## 🧩 Data and configuration

- No new data file, no new i18n key, no balancing value. The atlas geometry is read
  from `src/data/portraits.ts`; the compact footer's rects are the model above.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the new tests.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-188` against the exclusive paths above.
  - Browser pass with the DOM HUD: `npm run dev -- --port <free> --strictPort`, open
    `/?hud=dom`, and drive it with CDP. Read **computed styles and
    `getBoundingClientRect()`** — the two defects are DOM geometry, not canvas paint.
    For a save with a four-member party, start a run once, add three members through
    the dev menu (`onAddPokemon`), then reload: the main menu reads the save.
    If `public/anil/portraits.png` answers 200 on this tree, also sample the cell's
    pixels; if it 404s (pack-less), say so and mark the pixel branch **not run** — the
    style branch below is still a measurement.
- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` typechecks and builds clean.
  - [ ] `[unit]` `portraitCrop` returns `col`/`row` derived from `portraitFor`'s frame
        for a species the atlas names (pick one from `src/data/portraits.ts`'s own
        manifest, not a guess), `shiny` differing when the shiny cell exists, and
        `null` for an unknown id, for `''`, and for a Mega with no cell and no base.
  - [ ] `[unit]` `portraitBackground(crop, 26)` returns `backgroundSize`
        `` `${cols * 26}px auto` `` and `backgroundPosition` `` `-${col * 26}px
        -${row * 26}px` ``; `portraitBackground(crop, 22)` scales the same way; a
        `NaN` box yields no `NaN` in the strings.
  - [ ] `[unit]` the live main-menu view carries a non-null `portrait` for each party
        member of a run whose species the atlas names, and the fixture view built
        from `design/fixtures/01-main-menu.json` does too (the fixture state carries
        `speciesId`).
  - [ ] `[unit]` the starter view carries a non-null `portrait` for each offered card,
        live and fixture (`04-starter-pick.json`).
  - [ ] `[unit]` `MAIN_MENU_FOOTER_NARROW`'s three rects are pairwise disjoint with a
        ≥ 8 px gutter, each `w ≥ 160`, and `x + w ≤ 374`. The test computes the
        intersections, it does not hard-code booleans.
  - [ ] `[unit]` the desktop footer is untouched: `MAIN_MENU_BOARD.footer.columns`
        still reads `[96, 240, 724]` and the existing desktop assertions still pass.
  - [ ] `[unit]` `git diff --name-only main...task-188` lists only the exclusive
        paths, and `docs/hud-fidelity.md`'s diff starts at a new `## 9.` heading
        (nothing in §1-§8 changed).
  - [ ] `[live]` At **390×844** with a four-member party and `?hud=dom`: each of the
        four `[data-hud-main-menu-portrait]` cells has a computed `background-image`
        of `PORTRAIT_ATLAS_URL` and a `background-position`/`background-size` equal to
        `portraitBackground(portraitCrop(speciesId), 22)` for that member, all four
        inside the CONTINUE row's card (`getBoundingClientRect()`), and
        `document.documentElement.scrollWidth === 390`. Report the four computed
        pairs.
  - [ ] `[live]` At **390×844**: for every pair of
        `[data-hud-main-menu-stat]`, the two `getBoundingClientRect()` do not
        intersect (gap ≥ 8 px), each `.main-menu__stat-label`'s
        `rect.right ≤ ` its block's `rect.right`, and each block's rect equals
        `MAIN_MENU_FOOTER_NARROW[id]` within 1 px. Report the six rects.
  - [ ] `[live]` At **1280×800** the same row draws four portrait cells with a
        background and the desktop footer's three blocks still sit at
        `x = 96, 240, 724` (the frame's own columns), so nothing regressed on the
        wide layout.
  - [ ] `[live]` *(only if `portraits.png` answers 200)*: inside each of the four
        26×26 desktop cells the sampled pixels hold **≥ 2 distinct colours**; on a
        pack-less tree mark this branch **not run** and say why.

## 📣 Coordination

- **For the Architect — one deviation from the backlog entry.** The entry says the
  shared module resolves a species id to a **data URI**. The portrait atlas is one
  64×64-cell sheet served from the gitignored `public/anil/`, so a data URI would need
  a `fetch` plus a canvas round-trip per member and would make the panel's model async
  (and unmeasurable headlessly). This spec draws **the same cell** of the same atlas
  through `background-position`/`background-size`, which is pure, testable and still
  "a portrait, not a texture read". `docs/hud-fidelity.md` §9 records it, and
  `[Task-188]`'s entry should be corrected the same way when it is archived.
- **For the next batch:** `src/ui/hud/portrait.ts` is the one portrait seam for the
  DOM HUD. `[Task-189]` in this same batch owns `battle-hp`/`battle-moves` and
  `docs/hud-fidelity.md` §5; the sections never overlap.
- **Path note:** both panels' folders are claimed whole (their `view`, `tsx`, `css`,
  `preview` and fixture tests), plus the two docs and the new module. `battle-hp`,
  `battle-moves`, the scenes and `src/data/**` are another task's or nobody's.

## ⛔ Out of scope

- Do not change the portrait atlas, pack art, or the Phaser side of either screen.
- Do not touch `run-over`/`trade`/`battle-switch` portraits, even though they share
  the empty-box defect: they belong to their own panels' batches.
- Do not add a new i18n key, a new dependency, or a `fetch` for art.
- Do not reformat files you touch; no Prettier sweep, no CSS rewrite beyond the
  compact footer block and the two portrait rules.

## 📦 Delivery protocol (read this last, then execute it)

1. `npm ci --prefer-offline --no-audit --no-fund` once in the worktree.
2. Implement, then run `npm test` and `npm run build`. Both must be green before you
   commit.
3. Commit in English, imperative; one logical change per commit.
4. Leave the branch tip as an **empty** commit:
   `git commit --allow-empty -m "dev: done task-188"`, then
   `git push origin task-188`.
5. Report: what you changed per file, both gate results, which `[live]` branches you
   could measure on this tree (and which you could not, and why), and the exact
   `git rev-parse HEAD` sha of the tip you pushed. If a gate is red and you cannot fix
   it, say so plainly and do not push a `dev: done`.
