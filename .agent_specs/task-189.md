# Spec: Task-189 — The battle's FIGHT window stops covering the HP panel, and a category stops running under its ⓘ

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** DOM HUD (Preact) battle panels + one doc.
- **Role:** Dev.
- **Objective:** two measured defects of the `?hud=dom` battle, plus the ⓘ's missing
  hover. Measured on `main` at 1280×800 with FIGHT open on a wild battle:
  `battle-moves` sits at **x 276, y 582, 728×192** while the foe's HP box
  (`[data-hud-hp="enemy-0"]`) sits at **x 64, y 48, 368×100** — the menu covers the
  box from x 276 on and the box's own HP value is drawn behind the window. The same
  run shows `battle-moves__category` ending at **x 961** while
  `battle-moves__info` starts at **x 940**, a 21-px overlap, so
  `SPECIAL`/`PHYSICAL`/`STATUS` runs under the ⓘ square. And the DOM ⓘ is
  `onClick`-only (`battleMoves.tsx` 124-132), so hovering a move's ⓘ floats nothing
  while the canvas HUD does.
- **Environment:** repository `/home/runner/work/pkm-randomlike/pkm-randomlike`,
  worktree `../wt-pkm-189`, branch `task-189`. Work only inside the worktree.
- **Dependencies:** none. `battleMovesBox`, `battleHpBox` and the move grid all ship.

### Exclusive paths (single writer)

Nothing outside this list:

- `src/ui/hud/panels/battle-moves/**` — `view.ts`, `view.test.ts`,
  `battleMoves.test.ts`, `battleMoves.tsx`, `battleMoves.css`, `README.md`
- `src/ui/hud/panels/battle-hp/**` — `view.ts`, `view.test.ts`, `battleHp.tsx`,
  `battleHp.css`, `README.md`
- `src/ui/hud/panels/battle-bag/*.test.ts` and
  `src/ui/hud/panels/battle-switch/*.test.ts` — **tests only**, and only if the
  shared `battleMovesBox` change re-pins a value they assert. Never their sources.
- `docs/hud-fidelity.md` — **§5 only** (append a "Battle zones" paragraph to it)

Do not touch `src/scenes/**` (another task in this batch holds both scenes),
`src/ui/hud/panels/battle-switch/*.ts` sources, `src/ui/moveGrid.ts`,
`src/ui/hud/panels/battle-bag/*.tsx`, `package.json`, `src/i18n/**`, or
`docs/hud-fidelity.md` §1-§4 and §6-§9 (a sibling task appends §9).

### Inputs (read-only)

- `AGENTS.md`
- `src/ui/moveGrid.ts` (`moveGridCellRects`, `MoveGridSlot`, `isEmptySlot`,
  `MOVE_INFO_SIZE`-adjacent constants)
- `src/ui/hud/panels/battle-hp/view.ts` (`battleHpBox`, `battleHpLayout`)
- `src/scenes/BattleScene.ts` (only to read how the card and the cells reach the
  panels: `battleMovesInput`, 4285-4301 — **do not edit it**)
- `design/fixtures/05-battle-hud.json`, `05c-battle-bag.json`, `05d-battle-pokemon.json`

## 🔒 Contract

### One shared geometry rule: the menu starts where the HP column ends

In `battle-hp/view.ts` the foe's **partner** box stacks **below** its lead instead of
beside it, so the HP column has one right edge at every viewport and in every battle:

```ts
/**
 * The partner box. A partner never sits to the right of its side's column: the foe's
 * partner stacks under its lead the way the player's stacks above its own, so the
 * battle menu has one left edge to clear in a double and in a single alike.
 */
function partnerBox(viewport: Viewport, side: HpSide, lead: Rect): Rect;
```

- `battleHpBox(viewport, 'enemy', 1)` keeps `x` and `w` of the lead and takes
  `y = lead.y + lead.h + GUTTER`. `battleHpBox(viewport, 'player', 1)` is unchanged
  (it already stacks above).
- `battleHpLayout` keeps its order and its ids; only that one rect moves.

In `battle-moves/view.ts`, `battleMovesBox(viewport)` puts the desktop card's left
edge at the foe column's right edge plus a gutter:

```ts
export function battleMovesBox(viewport: Viewport): Rect;
```

- Wide layout (`stageW >= BATTLE_COMPACT`): `left = max(stageOffsetX + 36,
  battleHpBox(viewport, 'enemy', 0).x + battleHpBox(viewport, 'enemy', 0).w + 8)`;
  the right edge stays `stageOffsetX + stageW - 36`; `w = max(240, right - left)`.
  At 1280×800 that is `x 440, w 564` (the right edge 1004 does not move).
  So `card.x >= 440` always, and the card never intersects any `[data-hud-hp]` box.
- Compact layout (`stageW < BATTLE_COMPACT`) is **unchanged** (`x 16, ws stageW - 32,
  y stageH - 236 - 16, h 236`): on the phone the card already sits below both HP
  boxes and the criterion is that it still does.
- `battleBagBox` and `battleSwitchBox` re-export this function, so they inherit the
  same rule; if their own tests pin a rect that the new edge moves, re-pin **only
  those test files** and say so in the commit message.

### The ⓘ reserve in every move cell

`BattleMoveSlotView` gains the category's own box, so the overlap is a model fact and
not a CSS accident:

```ts
export type BattleMoveSlotView = Readonly<{
  // …every existing field unchanged, `category` stays the printed string…
  /** The category column: it ends left of the ⓘ by at least its gap. */
  categoryBox: Rect;
  /** The ⓘ button, unchanged: `{ x: box.x + box.w - 36, y: box.y + 8, w: 22, h: 22 }`. */
  info: Rect | null;
}>;

/** The gap between the category column and the ⓘ square. */
export const MOVE_CATEGORY_GAP = 8;
```

- For a filled slot, `categoryBox` is a column of the widest category label's own
  width, right-aligned against `info.x - MOVE_CATEGORY_GAP` and at the same baseline
  band the stylesheet already uses: `categoryBox.x + categoryBox.w <= info.x - MOVE_CATEGORY_GAP
  + 0.001` must hold for **every** slot and every card width, including the compact
  one. An empty slot has no `info`, so its `categoryBox` is a zero-width rect at the
  cell's right pad (nothing is printed there).
- `battleMoves.tsx` renders `.battle-moves__category` with `insetStyle(slot.categoryBox,
  card)` **and** the stylesheet sets `right: 44px` on that class (36 px of ⓘ offset +
  8 px gap) with `text-align: right`, so neither path can put the text under the ⓘ.
- Nothing else in the cell moves: the name, the type badge, PP, PWR and ACC keep
  their shipped rects and tones.

### The ⓘ answers the pointer

`battleMoves.tsx`: the ⓘ button gains `onPointerEnter` and `onPointerLeave` that emit
the same intents the click already emits —
`emit({ type: 'info', moveIndex: slot.index })` on enter and
`emit({ type: 'info', moveIndex: null })` on leave. The click keeps its toggle
behaviour. No new intent type, no timer, no other control touched.

## 🧩 Data and configuration

No data file, no i18n key, no balancing value. Every number is a rect derived from the
shipped constants (`DESKTOP_X/W`, `MOVE_GRID_INSET`, `INFO_OFFSET`, `INFO_SIZE`).

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the new tests.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-189` against the exclusive paths above.
  - Browser pass with the DOM HUD: `npm run dev -- --port <free> --strictPort`,
    `/?hud=dom` at 1280×800 and at 390×844, a wild battle open with FIGHT in front.
    Use the dev menu's battle launcher (`onWildBattle`) to reach a battle with no
    walking. Measure with `getBoundingClientRect()`,
    `document.elementFromPoint(...)` and one CDP `Input.dispatchMouseEvent`
    (`mouseMoved`) for the hover — these are DOM facts, not canvas paint.
- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` typechecks and builds clean.
  - [ ] `[unit]` `battleMovesBox({ width: 1280, height: 800 })` returns
        `x === 440` and `y === 582`, and `x + w === 1004`; the card and
        `battleHpBox(viewport, 'enemy', 0)` do not intersect
        (`Rect` intersection computed in the test, empty).
  - [ ] `[unit]` the invariant holds across the **wide** branch (stage side ≥ 700 px:
        700×700, 800×800, 1024×768, 1280×800, 1600×900) — `card.x >= enemyBox.x +
        enemyBox.w + 8` and `card.w >= 240` in each — and across the **phone** branch
        (viewport width < 600: 390×844, 320×568, 480×800) — `card.y >= playerBox.y +
        playerBox.h` in each. *(Revision 2: the first cut swept every width, which
        crossed the pre-existing 600-699 px seam between `BATTLE_HP_BREAKPOINT` (600)
        and `BATTLE_COMPACT` (700); that band is out of this task's scope and its
        status must be evidenced, not fixed — see Coordination.)*
  - [ ] `[unit]` `battleHpLayout(viewport, { enemy: true, player: true })` puts the
        two `enemy` boxes at the same `x` with slot 1 directly below slot 0
        (`y = slot0.y + h + 8`), so `max(enemy.right) === 432`; the player's two boxes
        are unchanged (slot 1 above slot 0).
  - [ ] `[unit]` for a filled slot at the desktop card **and** at the compact card,
        `categoryBox.x + categoryBox.w <= info.x - 8` and `categoryBox` is inside its
        own cell; an empty slot's `categoryBox` has `w === 0` and no `info`.
  - [ ] `[unit]` the desktop card's `x` is unchanged for a viewport the compact branch
        answers (390×844 → `x 16, w 358, y 592, h 236`).
  - [ ] `[unit]` `git diff --name-only main...task-189` lists only the exclusive
        paths (and, if used, only `*.test.ts` under `battle-bag/` and
        `battle-switch/`); no `src/scenes/**`, no `src/ui/moveGrid.ts`.
  - [ ] `[live]` At **1280×800**, FIGHT open on a wild battle:
        `[data-hud-panel="battle-moves"]`'s rect starts at or right of
        `[data-hud-hp="enemy-0"]`'s right edge, and
        `document.elementFromPoint(centre of `[data-hud-hp="enemy-0"]
        [data-hud-hp-value]`)` is that value node or an ancestor of it — never the
        menu. Report both rects and the element found.
  - [ ] `[live]` At **1280×800**: for each of the four
        `[data-hud-move-slot]` cells, `[data-hud-move-info="n"]`'s rect starts at or
        right of that cell's `.battle-moves__category` rect's right edge. Report the
        four pairs.
  - [ ] `[live]` At **390×844**: the menu's rect is below the player HP box
        (`menu.top >= playerBox.bottom`) and the category/ⓘ pairs do not overlap
        either. Report the rects. (The phone layout must not regress.)
  - [ ] `[live]` Hovering a move's ⓘ without clicking floats its description:
        dispatch one `mouseMoved` at the centre of `[data-hud-move-info="0"]`, then
        `[data-hud-move-desc]` exists and its text equals that move's own description
        (read the same string from the canvas cell or the dex); move the pointer to
        the map corner (`mouseMoved` at 4,4) and the node is gone.

## 📣 Coordination

- **For the Architect — two decisions this spec takes, both recorded here because the
  backlog entry did not spell them out.**
  1. The entry asked that "the menu's left edge starts where the HP panel ends" but
     the foe's *partner* box could sit beside its lead in a double, which would put
     the column's right edge at 808 at 1280×800 and leave the menu 186 px wide. The
     DOM partner now stacks below its lead (the player's already stacks above), so
     one rule holds in a single and a double. The canvas is untouched.
  2. `battleMovesBox` is shared with the bag and switch cards (they re-export it), so
     those two cards move with the menu. Their own tests may be re-pinned; their
     sources are not in scope.
- **For the next batch:** the shared card rule, `MOVE_CATEGORY_GAP` and the ⓘ's hover
  are now the battle panels' invariants; `[Task-59]` (the switch window's move ⓘ,
  Batch 13 of the old plan) and `[Task-60]` (the battle info window) build on them.
- **Path note:** `docs/hud-fidelity.md` §5 belongs to this task; a sibling task in the
  same batch appends §9 and touches no earlier section.
- **Revision 2 — the 600-699 px seam (recorded, not fixed).** Task QA's first pass
  found that a viewport whose width is 600-699 while its stage is under
  `BATTLE_COMPACT` (700) gets the desktop HP column and the compact menu at once, so
  the card can overlap the player box. That band is a **pre-existing** split between
  two different breakpoints, not something this task introduced; the entry asks for
  1280×800 and 390×844, both of which are green. The author must **evidence** it
  (measure `main` @ `0d6deaa` and this branch at 640×480 and 800×600: same rects, same
  overlap) and record it as a known residue in `battle-moves/README.md`; making the
  two breakpoints agree is a separate task, not this one.

## ⛔ Out of scope

- Do not change the canvas (`src/scenes/BattleScene.ts`) or `src/ui/moveGrid.ts`: the
  DOM panels carry the fix.
- Do not change the HP boxes' width, height, x, colours, highlight or value rules —
  only the foe partner's `y`.
- Do not redesign the FIGHT cells, their fonts, or the floating description card's own
  size.
- Do not add a key binding, a tooltip library or a timer for the hover.
- Do not reformat files you touch; no Prettier sweep.

## 📦 Delivery protocol (read this last, then execute it)

1. `npm ci --prefer-offline --no-audit --no-fund` once in the worktree.
2. Implement, then run `npm test` and `npm run build`. Both must be green before you
   commit.
3. Commit in English, imperative; one logical change per commit. If you re-pinned a
   `battle-bag`/`battle-switch` test, name it in that commit's body.
4. Leave the branch tip as an **empty** commit:
   `git commit --allow-empty -m "dev: done task-189"`, then
   `git push origin task-189`.
5. Report: what you changed per file, both gate results, each `[live]` measurement you
   took (with its numbers), and the exact `git rev-parse HEAD` sha of the tip you
   pushed. If a gate is red and you cannot fix it, say so plainly and do not push a
   `dev: done`.
