# Spec: Task-228 — the player's HP box and the battle menu end on the same line, inside the stage

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser/DOM HUD geometry (pure layout functions + one scene call site) and docs.
- **Role:** Dev.
- **Objective:** one exported `battleStage(viewport)` owns the battle's centred square,
  and every HP box is placed **inside** it: the player's lead card ends on exactly the
  same bottom line as the command/moves card (`stage bottom - 26` on the desk), its
  column starts where the stage starts, the phone keeps its measured 8 px gutter, and
  the partner/gutter/clearance relations are unchanged. Today the HP panel is laid out
  from the **window** viewport while the menu is laid out with the camera's own
  `offX`/`offY`, so the two disagree on the desk: at 1280×800 the player's card is
  `x 64..432, y 660..760` and the command card `x 440..1004, y 582..774`.
- **Environment:** worktree `../wt-pkm-228`, branch `task-228`.
- **Dependencies:** none. Reads `battle-moves/view.ts`'s existing stage arithmetic
  (`BATTLE_STAGE_MAX`, `battleMovesBox`) and `battle-command/view.ts`'s
  `battleCommandBox` (= `battleMovesBox`), both already merged.

### Exclusive paths (single writer)

The `Claims` of `TODO.md`'s `[Task-228]`, **plus the four test files the geometry move
necessarily re-pins** (amended by the Orchestrator at cut time: they are no other
task's, and they pin the old off-stage numbers this task deletes). Nothing else:

- `src/ui/hud/panels/battle-hp/view.ts`
- `src/ui/hud/panels/battle-hp/view.test.ts`
- `src/ui/hud/panels/battle-moves/view.ts`
- `src/ui/hud/panels/battle-moves/view.test.ts`
- `src/ui/hud/panels/battle-command/view.test.ts`
- `src/ui/hud/panels/battle-bag/view.test.ts`
- `src/ui/hud/panels/battle-switch/view.test.ts`
- `src/scenes/BattleScene.ts`
- `src/ui/hud/panels/battle-hp/README.md`
- `docs/design-spec.md` — **§4 only** (the battle section). Task-232 holds the same
  file on **§2 only**; the two sections are disjoint and neither task may touch the
  other's. Change no line of §1, §3, §5–§10.

### Inputs (read-only)

- `AGENTS.md`.
- `docs/design-spec.md` §4 (the bullet this task amends, lines 406-408).
- `src/ui/hud/panels/battle-moves/view.ts` (read it before editing: `CARD_MARGIN`,
  `CARD_FROM_BOTTOM`, `CARD_H`, `CARD_CLEARANCE`, `CARD_MIN_W`, `BATTLE_COMPACT`,
  `battleMovesBox`).
- `src/ui/hud/panels/battle-command/view.ts` (`battleCommandBox` is `battleMovesBox`).
- `src/ui/hud/panels/battle-hp/battleHp.tsx`, `battleHp.css`, `mount.tsx` (read only:
  they paint the view's rects verbatim; `data-hud-hp={box.id}` and `rectStyle` are
  what the live criterion reads).
- `src/ui/hud/panels/battle-log/view.ts`, `src/ui/hud/panels/battle-bag/view.ts`,
  `src/ui/hud/panels/battle-switch/view.ts` (read only: they reuse the menu card).
- `src/scenes/BattleScene.ts` (`refreshHud`, lines 2302-2451, and `mountHpPanel`,
  lines 606-615).
- `design/screens/05-battle-hud.json` and `design/exports/05-battle-hud.png` — **this
  pair does not exist in the tree yet**: `Task-223`'s import has not landed
  (`design/exports/` is absent and `design/screens/` holds only the old exporter's
  `.svg`/`.png`). The frame's caption is `05 Battle HUD` (mobile twin
  `M 05 Battle HUD`), from `design/import.json` and `design/board.json` (node
  `1:1560`). Until the import lands, the geometry evidence is the old exporter's
  `design/screens/05-battle-hud.png`, `design/screens/05-battle-hud.svg` and
  `design/frames/05-battle-hud.json` — read them, do not edit them. If the JSON/PNG
  pair appears in the worktree, it wins over the old ones; the numbers this spec
  freezes are the entry's own (`TODO.md` `[Task-228]`), so nothing here depends on it.

## 🔒 Contract

### TypeScript

Everything below is **frozen**. Other files in this batch are written against these
names, and `battle-command`/`battle-bag`/`battle-switch`/`battle-log` keep importing
`battleMovesBox`/`BATTLE_STAGE_MAX` unchanged.

In `src/ui/hud/panels/battle-hp/view.ts` (new exports):

```ts
export type StageRect = Readonly<{ x: number; y: number; w: number; h: number }>;

/** The battle's centred square, in page (canvas) coordinates: exactly the camera
 * viewport `BattleScene.refreshHud` sets. */
export function battleStage(viewport: Viewport): StageRect;

/** The cap on the square's side (was `battle-moves`'s own constant). */
export const BATTLE_STAGE_MAX = 900;

/** The desk card's own bottom margin inside the stage: the one line it shares with
 * the command / moves card. `stage.y + stage.h - 26`. */
export const DESKTOP_BOTTOM_MARGIN = 26;
```

`battleStage` semantics, taken verbatim from today's `refreshHud`:

```ts
const wide = viewport.width > viewport.height;
const w = wide ? Math.min(viewport.height, BATTLE_STAGE_MAX) : viewport.width;
const h = wide ? w : viewport.height;
return { x: Math.round((viewport.width - w) / 2), y: Math.round((viewport.height - h) / 2), w, h };
```

Pinned values (QA asserts these): `{1280,800}` → `{x:240,y:0,w:800,h:800}`;
`{1440,900}` → `{x:270,y:0,w:900,h:900}`; `{900,900}` → `{x:0,y:0,w:900,h:900}`;
`{1024,768}` → `{x:128,y:0,w:768,h:768}`; `{390,844}` → `{x:0,y:0,w:390,h:844}`.

In `src/ui/hud/panels/battle-moves/view.ts` (import + re-export, so the constant and
the function keep one definition and no module cycle is created):

```ts
import { battleHpBox, battleStage } from '../battle-hp/view';
export { BATTLE_STAGE_MAX, battleStage } from '../battle-hp/view';
```

(`battle-moves/view.ts` keeps its own local `Rect` / `Viewport` type aliases — they are
structurally identical to `battle-hp`'s, so no type import is needed, and
`noUnusedLocals` is on. `BATTLE_STAGE_MAX` is only re-exported, so it needs no local
binding.)

Every existing import site (`battle-moves/index.ts`, `battle-moves/view.test.ts`,
`battle-bag`, `battle-switch`, `BattleScene.ts`) keeps working because the names are
still exported from `battle-moves/view.ts`. **Do not** move `battleStage` into
`battle-moves/view.ts`: that module already imports values from `battle-hp/view.ts`
(and uses `STAGE_CHIP` at module scope), so the reverse import is a runtime TDZ
cycle. The definition lives in `battle-hp/view.ts`, the leaf.

`battleMovesBox` keeps its shape and only reads the stage through the new function:

```ts
export function battleMovesBox(viewport: Viewport): Rect {
  const stage = battleStage(viewport);
  const compact = stage.w < BATTLE_COMPACT;
  if (compact) {
    const menu = { x: 16, y: stage.h - 236 - 16, w: stage.w - 32, h: 236 };
    return { x: stage.x + menu.x, y: stage.y + menu.y, w: menu.w, h: menu.h };
  }
  const enemy = battleHpBox(viewport, 'enemy', 0);          // now a page rect
  const left = Math.max(stage.x + CARD_MARGIN, enemy.x + enemy.w + CARD_CLEARANCE);
  const right = stage.x + stage.w - CARD_MARGIN;
  return { x: left, y: stage.y + stage.h - CARD_FROM_BOTTOM, w: Math.max(CARD_MIN_W, right - left), h: CARD_H };
}
```

`battleHpBox(viewport, side, slot)` keeps its signature, its purity and its partner
rule; only its numbers change: every rect is the stage's rect plus the board's
offset.

- Desk branch (viewport width ≥ `BATTLE_HP_BREAKPOINT`, still decided on the
  **viewport** width, as today, so the 600-699 px residue does not move):
  `x = stage.x + 64`, `w = 368`, `h = 100`, foe `y = stage.y + 48`,
  player `y = Math.max(stage.y + 48 + 100 + 8, stage.y + stage.h - DESKTOP_BOTTOM_MARGIN - 100)`,
  so the player's `y + h` **is** `stage.y + stage.h - 26`.
- Phone branch (viewport width < 600, unchanged numbers because a tall phone's stage
  is the viewport): `x = stage.x + 16`, `w = Math.max(0, stage.w - 32)`, `h = 80`,
  foe `y = stage.y + 16`,
  player `y = Math.max(stage.y + 16 + 80 + 8, stage.y + stage.h - 340)`.
- `partnerBox`, `foeBallRow`, `battleHpStages`, `battleHpView`, `HP_FILL_MS`,
  `BATTLE_HP_BREAKPOINT`, `STAGE_*`, `BATTLE_BALL_*` are unchanged apart from being
  fed by the new rects (they all become page coordinates, which their doc comments
  already claim).

Pinned box values after the change:

| viewport | foe lead | player lead | foe partner | player partner |
| --- | --- | --- | --- | --- |
| 1280×800 | `{304,48,368,100}` | `{304,674,368,100}` | `{304,156,368,100}` | `{304,566,368,100}` |
| 1440×900 | `{334,48,368,100}` | `{334,774,368,100}` | `{334,156,368,100}` | `{334,666,368,100}` |
| 900×900 | `{64,48,368,100}` | `{64,774,368,100}` | `{64,156,368,100}` | `{64,666,368,100}` |
| 390×844 | `{16,16,358,80}` | `{16,504,358,80}` | `{16,104,358,80}` | `{16,416,358,80}` |

Pinned command/moves card (`battleMovesBox` = `battleCommandBox`), after the change:

| viewport | card | bottom |
| --- | --- | --- |
| 1280×800 | `{680,582,324,192}` | 774 |
| 1440×900 | `{710,682,424,192}` | 874 |
| 900×900 | `{440,682,424,192}` | 874 |
| 390×844 | `{16,592,358,236}` | 828 |

In `src/scenes/BattleScene.ts` (`refreshHud`, the **one** call site): delete the
local `MAX_BATTLE_SIZE` and the inline `wide/width/height/offX/offY` arithmetic, and
read the stage:

```ts
const stage = battleStage({ width: this.scale.width, height: this.scale.height });
this.cameras.main.setViewport(stage.x, stage.y, stage.w, stage.h);
```

then keep the existing local aliases (`const width = stage.w; const height = stage.h;`)
so **every other line of `refreshHud` is untouched**: `COMPACT_SIZE`, `box`, `foeInfo`,
`playerInfo`, the sprite caps and `syncHud` keep reading the same numbers. Import
`battleStage` from `'../ui/hud/panels/battle-moves/view'` (the claimed file; the
`battle-moves/index.ts` barrel is not this task's to edit). Nothing else in the scene
changes.

- **Determinism:** no RNG is read anywhere in this task. The functions are pure
  (`viewport` in, rects out) and the same input always yields a deep-equal result.
- Rules: `src/engine/` is not touched; no Phaser import enters `battle-hp/view.ts` or
  `battle-moves/view.ts` (they take a `{width,height}` value); no DOM read; no clock.

### Data

No data file, no JSON key, no i18n key. The only new numbers are the exported
constants above (`BATTLE_STAGE_MAX = 900`, `DESKTOP_BOTTOM_MARGIN = 26`) and the
private board offsets (`DESKTOP_X = 64`, `DESKTOP_W = 368`, `DESKTOP_H = 100`,
`DESKTOP_FOE_Y = 48`, `PHONE_*` as today).

## 🧩 Data and configuration

None. This task moves geometry only; nothing becomes data-driven.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green in full, including the tests this
    task adds and the five re-pinned assertions of the section below.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-228` audit against the exclusive paths list.
  - `npx vitest run src/ui/hud/panels/battle-hp/view.test.ts` for the geometry.
  - Live pass: dev server + headless Chromium over CDP (`docs/agent-ci.md` §"The
    `[live]` criteria"). Open the page **at each viewport** (do not resize a live
    battle: the HP panel captures its viewport at mount).

Note for the Dev: `battle-hp/view.test.ts` pins today's desk numbers and the chip
grid, and every one of them moves. Update them to the tables above; do not weaken an
assertion to a range where this spec pins an equality.

### ⚠ The four test files this move re-pins (claims amended at cut time)

Moving the HP column onto the stage moves the **foe lead box**, and `battleMovesBox`
derives the menu card's left edge from that box (`enemy.x + enemy.w + CARD_CLEARANCE`).
The desk card therefore narrows from `{440,582,564,192}` to `{680,582,324,192}` at
1280×800 (and from 440/574 to 590/424 at 1200×900). Five assertions in four test
files pin those old numbers, and the four files are **part of this task's exclusive
paths** (see above): no other task in the batch holds them.

- `src/ui/hud/panels/battle-moves/view.test.ts:207` — `{ x: 440, y: 582, w: 564, h: 192 }`
  → `{ x: 680, y: 582, w: 324, h: 192 }` (the `x + w === 1004` line beside it is
  unchanged).
- `src/ui/hud/panels/battle-moves/view.test.ts:283-284` — `square.w === 574`,
  `square.x === 440` → `424` and `590` (the `x + w === 150 + BATTLE_STAGE_MAX - 36`
  line is unchanged).
- `src/ui/hud/panels/battle-command/view.test.ts:50` — → `{ x: 680, y: 582, w: 324, h: 192 }`.
- `src/ui/hud/panels/battle-bag/view.test.ts:70` — → `{ x: 680, y: 582, w: 324, h: 192 }`.
- `src/ui/hud/panels/battle-switch/view.test.ts:97` — → `{ x: 680, y: 582, w: 324, h: 192 }`.

Rules for those four files: change **only** the numbers those five assertions pin, and
keep every relative invariant they carry (the card starts at `enemy.x + enemy.w + 8`,
its right edge is the stage's right edge minus 36, its width stays ≥ `CARD_MIN_W`, it
never intersects the foe's lead box). The three panels' own `CARD` fixtures
(`{ x: 276, y: 582, w: 728, h: 192 }`) and their view-geometry tests take the card as a
literal input and do **not** move. `battle-moves/fixture.test.ts`, the `battle-log`
tests and every other suite must stay untouched and green.

- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean (`npm run build` exits 0).
  - [ ] `[unit]` The declared tests exist and pass: `npm test` is green **in full**,
        including the five re-pinned geometry assertions above.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched:
        `git diff --name-only main...task-228` lists only the ten paths above.
  - [ ] `[unit]` `battleStage` pins the square at five viewports:
        `expect(battleStage({width:1280,height:800})).toStrictEqual({x:240,y:0,w:800,h:800})`,
        `{1440,900}` → `{270,0,900,900}`, `{900,900}` → `{0,0,900,900}`,
        `{1024,768}` → `{128,0,768,768}`, `{390,844}` → `{0,0,390,844}`.
  - [ ] `[unit]` `battleHpBox` equals the pinned table: at 1280×800
        `player,0` = `{304,674,368,100}` and `enemy,0` = `{304,48,368,100}`; at
        1440×900 `{334,774,368,100}` / `{334,48,368,100}`; at 900×900
        `{64,774,368,100}` / `{64,48,368,100}`; at 390×844 the four phone boxes of
        the table (unchanged).
  - [ ] `[unit]` The one bottom line: for `v` in `{1280,800}`, `{1440,900}`,
        `{900,900}`,
        `battleHpBox(v,'player',0).y + battleHpBox(v,'player',0).h ===
        battleCommandBox(v).y + battleCommandBox(v).h` **and** both equal
        `battleStage(v).y + battleStage(v).h - DESKTOP_BOTTOM_MARGIN` (774, 874, 874).
  - [ ] `[unit]` Both stay inside the stage: at those three viewports,
        `fitsInside(battleHpBox(v,'player',0), battleStage(v))` and
        `fitsInside(battleCommandBox(v), battleStage(v))` are true, and no HP box of
        `battleHpLayout(v, {enemy:true, player:true})` leaves the stage.
  - [ ] `[unit]` The phone keeps its gutter and changes nothing: at 390×844,
        `battleCommandBox(PHONE).y - (player.y + player.h) === 8` (592 - 584),
        `player` is `{16,504,358,80}`, and every box fits inside the stage.
  - [ ] `[unit]` The partner clearance is unchanged: at 1280×800,
        `battleHpBox(DESKTOP,'player',1).y + 100 === battleHpBox(DESKTOP,'player',0).y - 8`
        and `battleHpBox(DESKTOP,'enemy',1).y === battleHpBox(DESKTOP,'enemy',0).y + 108`.
  - [ ] `[unit]` The foe's column still clears the card by `CARD_CLEARANCE`:
        at `{1280,800}`, `{1440,900}` and `{900,900}`,
        `battleMovesBox(v).x === battleHpBox(v,'enemy',0).x + battleHpBox(v,'enemy',0).w + 8`
        (680, 710, 440) and `battleMovesBox(v).x + battleMovesBox(v).w ===
        battleStage(v).x + battleStage(v).w - 36` (1004, 1134, 864).
  - [ ] `[unit]` Purity holds: `battleStage(v)` twice is deep-equal and not the same
        object; `battleHpView(state, v, doubles)` twice is deep-equal.
  - [ ] `[unit]` The scene reads the one function:
        `grep -n "battleStage" src/scenes/BattleScene.ts` shows the import and one call
        in `refreshHud`, and `grep -n "MAX_BATTLE_SIZE" src/scenes/BattleScene.ts`
        prints nothing.
  - [ ] `[live]` **Equal bottoms and containment at 1280×800.** With
        `/?hud=dom`, reach a battle (`window.__pkmRoute.startDebugWildBattle('pidgey', 5)`
        from CDP `Runtime.evaluate`), wait until
        `[data-hud-panel="battle-command"][data-open="true"]` exists, then read
        `getBoundingClientRect()` of `[data-hud-hp="player-0"]` and of
        `[data-hud-panel="battle-command"]`: their `bottom` values are equal within
        0.5 px and both are 774 ± 1; the HP rect's `left` is 304 ± 1 and its `right`
        672 ± 1; both rects lie inside the camera viewport read from
        `window.__pkmBattle.cameras.main.viewport` (`x, y, width, height` =
        240, 0, 800, 800).
  - [ ] `[live]` **The same at 1440×900.** Repeat the previous measurement on a page
        loaded at 1440×900: equal `bottom` = 874 ± 1, HP `left` = 334 ± 1, camera
        viewport 270,0,900,900.
  - [ ] `[live]` **The same at 900×900.** Repeat at 900×900 (a tall/equal screen keeps
        the full stage): equal `bottom` = 874 ± 1, HP `left` = 64 ± 1, camera viewport
        0,0,900,900.
  - [ ] `[live]` **The phone keeps the 8 px gutter, at 390×844.**
        `[data-hud-panel="battle-command"].getBoundingClientRect().top` minus
        `[data-hud-hp="player-0"].getBoundingClientRect().bottom` is 8 ± 1, the HP box
        is `{16,504,358,80}` ± 1, and both rects lie inside the 390×844 viewport.

## 📣 Coordination

- For the Orchestrator: the four test files that re-pin the moved card
  (`battle-moves`, `battle-command`, `battle-bag`, `battle-switch`) are part of this
  task's exclusive paths, so the batch has no foreign claim left. Nothing else in the
  plan moves.
- For the next batch: `battleStage(viewport)` is the single source of the square. Any
  later panel that needs "inside the stage" reads it (or `battleMovesBox`) instead of
  re-deriving `offX`/`offY`. `BATTLE_STAGE_MAX` now lives in
  `src/ui/hud/panels/battle-hp/view.ts` and is re-exported from `battle-moves/view.ts`;
  import it from either.
- Docs to update, exactly:
  - `docs/design-spec.md` §4, the bullet at lines 406-408, replaced by:
    "On a wide screen the battle is a centred **square** (at most 900 px a side) —
    `battleStage(viewport)`, the rect the camera viewport is set to; a tall phone
    screen keeps the stacked, full-height layout, with both battlers drawn 25%
    smaller so they sit clear of the stacked panels. Every HUD panel places itself
    **inside** that square: the player's HP column and the command / moves card share
    one bottom line, 26 px above the square's bottom edge, and no box of either side
    leaves the square (on the phone the card keeps the measured 8 px gutter above the
    player's box)."
  - `src/ui/hud/panels/battle-hp/README.md`: the header paragraph (lines 3-5) names
    the rect instead of the window offsets ("the board's 368×100 cards at (64,48)
    over the foe and (64,674) under the player **inside `battleStage(viewport)`**, and
    the phone's 358×80 cards at (16,16)/(16,504)"), and **rule 1** gains the sentence
    "Every rect it paints is a page coordinate: the board's column offset from the
    stage square `battleStage(viewport)` (`battle-moves/view.ts`), whose bottom edge
    the player's lead card and the command card both end on, `DESKTOP_BOTTOM_MARGIN`
    (26 px) above it." (The entry says "rule 1 names the rect"; today no rule does, so
    the header and rule 1 both take it.)
- Known doc drift this task must **not** fix (outside the claims):
  `src/ui/hud/panels/battle-moves/README.md:127` still says "this menu starts at 440".

## ⛔ Out of scope

- No change to `battle-hp/battleHp.tsx`, `battleHp.css`, `mount.tsx`, `index.ts`, or to
  the HP panel's viewport-at-mount behaviour (a live resize still keeps the mount
  viewport; that is a separate task).
- No change to `battle-command`, `battle-bag`, `battle-switch`, `battle-log` views,
  CSS or barrels — including `battle-moves/index.ts` and `battle-hp/index.ts`.
- No change to the stage's size rule (`BATTLE_STAGE_MAX` stays 900, the square stays
  centred) and no change to `COMPACT_SIZE`/`BATTLE_COMPACT` (700).
- No change to the artists' canvas HUD, to the sprites, or to any `src/data/` file.
- No `docs/design-spec.md` section other than §4.
