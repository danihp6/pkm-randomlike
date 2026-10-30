# Spec: Task-228 — the player's HP box and the battle menu end on the same bottom line

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser/DOM HUD geometry (pure layout functions + one scene call site) and docs.
- **Role:** Dev.
- **Objective:** the player's lead HP card and the command / moves card end on **one
  bottom line**, and that line is the battle square's own bottom margin. The HP column
  keeps the **window anchor** it ships with (`x = 64`), which is exactly the board
  frame `05`'s own `player panel` rect; the square becomes one exported
  `battleStage(viewport)` (`battle-hp/view.ts`, re-exported by `battle-moves/view.ts`)
  and the scene reads it instead of re-deriving `offX`/`offY`. Nothing else moves: the
  foe's box, the phone column, the menu's 564×192 desk card and its 222 px cells, the
  stat chips and the partner rule stay exactly as they are.
- **Environment:** worktree `../wt-pkm-228`, branch `task-228`.
- **Dependencies:** none. Reads `battle-moves/view.ts`'s existing stage arithmetic
  (`BATTLE_STAGE_MAX`, `battleMovesBox`) and `battle-command/view.ts`'s
  `battleCommandBox` (= `battleMovesBox`), both already merged.

> **Amendment (Orchestrator, cut time).** The first revision of this spec moved the HP
> column to `stage.x + 64` (304 at 1280×800). Measured in the running game, that
> narrows the desk menu card from 564 px to 324 px, whose move cells are 102 px: every
> move name is cut to four glyphs (`PUNI…`, `GRAV…`, `POWE…`, `SKY …`), the power
> column collapses to `--`, the accuracy label overlaps the category badge and the
> cells overflow the card by 18 px. The design's own frame (`05 Battle HUD`, 1280×800)
> puts the player panel at `x 64` and the menu at `664..1240`, i.e. both panels are
> **window**-anchored. So the fix is the bottom line only: the HP column stays where
> the board draws it and the menu keeps the width it has.

### Exclusive paths (single writer)

Exactly the `Claims` of `TODO.md`'s `[Task-228]`, nothing else:

- `src/ui/hud/panels/battle-hp/view.ts`
- `src/ui/hud/panels/battle-hp/view.test.ts`
- `src/ui/hud/panels/battle-moves/view.ts`
- `src/scenes/BattleScene.ts`
- `src/ui/hud/panels/battle-hp/README.md`
- `docs/design-spec.md` — **§4 only** (the battle section). Task-232 holds the same
  file on **§2 only**; the two sections are disjoint and neither task may touch the
  other's. Change no line of §1, §3, §5–§10.

No other test file may change **at all**: `battle-moves/view.test.ts`,
`battle-command/view.test.ts`, `battle-bag/view.test.ts` and
`battle-switch/view.test.ts` pin `battleMovesBox(DESKTOP) = {440,582,564,192}` and that
value is **unchanged** by this task.

### Inputs (read-only)

- `AGENTS.md`.
- `docs/design-spec.md` §4 (the bullet this task amends, lines 406–408).
- `src/ui/hud/panels/battle-moves/view.ts` (read it before editing: `CARD_MARGIN`,
  `CARD_FROM_BOTTOM`, `CARD_H`, `CARD_CLEARANCE`, `CARD_MIN_W`, `BATTLE_COMPACT`,
  `battleMovesBox`).
- `src/ui/hud/panels/battle-command/view.ts` (`battleCommandBox` is `battleMovesBox`).
- `src/ui/hud/panels/battle-hp/battleHp.tsx`, `battleHp.css`, `mount.tsx` (read only:
  they paint the view's rects verbatim; `data-hud-hp={box.id}` and `rectStyle` are
  what the live criterion reads).
- `src/ui/hud/panels/battle-log/view.ts`, `battle-bag/view.ts`, `battle-switch/view.ts`
  (read only: they reuse the menu card).
- `src/scenes/BattleScene.ts` (`refreshHud`, lines 2302–2451, and `mountHpPanel`,
  lines 606–615).
- `design/screens/05-battle-hud.{png,svg}` and `design/frames/05-battle-hud.json` —
  the board frame, caption `05 Battle HUD` (mobile twin `M 05 Battle HUD`). The
  imported pair `design/screens/05-battle-hud.json` + `design/exports/05-battle-hud.png`
  of `Task-223` **does not exist in the tree yet**; if it appears in the worktree it
  wins, and nothing here depends on it. Read, never edit. Its `player panel` is
  `{x:64, y:660, w:368, h:100}` and its `battle menu` is `{x:664, y:544, w:576, h:216}`
  — equal bottoms (760) at the frame's own 40 px margin, which is the relation this
  task restores in the shipped 26 px margin.

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

/** The desk card's own bottom margin inside the stage: the one line the player's
 * lead card and the command / moves card share. `stage.y + stage.h - 26`. */
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
structurally identical to `battle-hp`'s. `BATTLE_STAGE_MAX` is only re-exported, so it
needs no local binding. **Do not** move `battleStage` into `battle-moves/view.ts`: that
module already imports values from `battle-hp/view.ts` (and uses `STAGE_CHIP` at
module scope), so the reverse import is a runtime TDZ cycle. The definition lives in
`battle-hp/view.ts`, the leaf.)

`battleMovesBox` keeps its shape and its **exact numbers**; it only reads the stage
through the new function, so its output is byte-identical to today:

```ts
export function battleMovesBox(viewport: Viewport): Rect {
  const stage = battleStage(viewport);
  const compact = stage.w < BATTLE_COMPACT;
  if (compact) {
    const menu = { x: 16, y: stage.h - 236 - 16, w: stage.w - 32, h: 236 };
    return { x: stage.x + menu.x, y: stage.y + menu.y, w: menu.w, h: menu.h };
  }
  const enemy = battleHpBox(viewport, 'enemy', 0);
  const left = Math.max(stage.x + CARD_MARGIN, enemy.x + enemy.w + CARD_CLEARANCE);
  const right = stage.x + stage.w - CARD_MARGIN;
  return { x: left, y: stage.y + stage.h - CARD_FROM_BOTTOM, w: Math.max(CARD_MIN_W, right - left), h: CARD_H };
}
```

`battleHpBox(viewport, side, slot)` keeps its signature, its purity, its `x`, its
widths and the partner rule. **Only the player lead's `y` on the desk moves**, and it
moves so that the card's bottom is the shared line:

- Desk branch (viewport width ≥ `BATTLE_HP_BREAKPOINT`, decided on the **viewport**
  width as today): `x = DESKTOP_X` (**64**, the window anchor — do **not** add
  `stage.x`), `w = 368`, `h = 100`, foe `y = DESKTOP_FOE_Y` (**48**, unchanged),
  player
  `y = Math.max(DESKTOP_FOE_Y + DESKTOP_H + GUTTER, stage.y + stage.h - DESKTOP_BOTTOM_MARGIN - DESKTOP_H)`,
  so the player's `y + h` **is** `stage.y + stage.h - 26`.
- Phone branch (viewport width < 600): **completely unchanged** — `x = PHONE_X` (16),
  `w = viewport.width - 32`, `h = 80`, foe `y = 16`,
  player `y = Math.max(PHONE_FOE_Y + PHONE_H + GUTTER, viewport.height - PHONE_PLAYER_FROM_BOTTOM)`,
  which already leaves the 8 px gutter above the phone card.
- `partnerBox`, `foeBallRow`, `battleHpStages`, `battleHpView`, `HP_FILL_MS`,
  `BATTLE_HP_BREAKPOINT`, `STAGE_*`, `BATTLE_BALL_*` keep their code; they only inherit
  the moved lead rect.

Pinned box values after the change (the moved cells are in bold):

| viewport | foe lead | player lead | foe partner | player partner |
| --- | --- | --- | --- | --- |
| 1280×800 | `{64,48,368,100}` | `{64,674,368,100}` | `{64,156,368,100}` | `{64,566,368,100}` |
| 1440×900 | `{64,48,368,100}` | `{64,774,368,100}` | `{64,156,368,100}` | `{64,666,368,100}` |
| 900×900 | `{64,48,368,100}` | `{64,774,368,100}` | `{64,156,368,100}` | `{64,666,368,100}` |
| 390×844 | `{16,16,358,80}` | `{16,504,358,80}` | `{16,104,358,80}` | `{16,416,358,80}` |

Pinned command/moves card (`battleMovesBox` = `battleCommandBox`) — **unchanged from
today**:

| viewport | card | bottom |
| --- | --- | --- |
| 1280×800 | `{440,582,564,192}` | 774 |
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
so **every other line of `refreshHud` is untouched**. Import `battleStage` from
`'../ui/hud/panels/battle-moves/view'` (the claimed file; the `battle-moves/index.ts`
barrel is not this task's to edit). Nothing else in the scene changes.

- **Determinism:** no RNG anywhere in this task; the functions are pure (`viewport` in,
  rects out) and the same input always yields a deep-equal result.
- Rules: `src/engine/` is not touched; no Phaser import enters `battle-hp/view.ts` or
  `battle-moves/view.ts`; no DOM read; no clock.

### Data

No data file, no JSON key, no i18n key. The only new numbers are the exported
constants above (`BATTLE_STAGE_MAX = 900`, `DESKTOP_BOTTOM_MARGIN = 26`).

## 🧩 Data and configuration

None. Geometry only; nothing becomes data-driven.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green **in full**, with no file outside the
    six exclusive paths modified.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-228` audit against the exclusive paths list.
  - `npx vitest run src/ui/hud/panels/battle-hp/view.test.ts src/ui/hud/panels/battle-moves/view.test.ts`.
  - Live pass: dev server + headless Chromium over CDP. Open the page **at each
    viewport** (do not resize a live battle: the HP panel captures its viewport at
    mount), reach a battle and wait until the command panel is open.

Note for the Dev: `battle-hp/view.test.ts` pins today's desk numbers (`player,0` at
`y 660`, its partner at `y 552`) and the chip grid; only the player column's `y` moves.
Do not weaken an assertion to a range where this spec pins an equality, and do not
touch the four other HUD panels' tests.

- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean (`npm run build` exits 0).
  - [ ] `[unit]` The declared tests exist and pass: `npm test` is green in full.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched:
        `git diff --name-only main...task-228` lists only the six paths above (plus the
        spec file the branch already carries).
  - [ ] `[unit]` `battleMovesBox` is unchanged: `battleMovesBox({1280,800})` is
        `{440,582,564,192}`, `{1200,900}` is `{440,682,574,192}`, `{700,800}` is
        `{440,582,240,192}`, `{390,844}` is `{16,592,358,236}` — the four panels'
        existing suites are untouched and pass.
  - [ ] `[unit]` `battleStage` pins the square at five viewports:
        `{1280,800}` → `{240,0,800,800}`, `{1440,900}` → `{270,0,900,900}`,
        `{900,900}` → `{0,0,900,900}`, `{1024,768}` → `{128,0,768,768}`,
        `{390,844}` → `{0,0,390,844}`.
  - [ ] `[unit]` `battleHpBox` equals the pinned table: at 1280×800 `player,0` =
        `{64,674,368,100}`, `player,1` = `{64,566,368,100}`, `enemy,0` =
        `{64,48,368,100}`, `enemy,1` = `{64,156,368,100}`; at 1440×900 and 900×900
        `player,0` = `{64,774,368,100}`; at 390×844 the four phone boxes are unchanged.
  - [ ] `[unit]` The one bottom line: for `v` in `{1280,800}`, `{1440,900}`,
        `{900,900}`, `{1440,1000}`,
        `battleHpBox(v,'player',0).y + battleHpBox(v,'player',0).h ===
        battleCommandBox(v).y + battleCommandBox(v).h ===
        battleStage(v).y + battleStage(v).h - DESKTOP_BOTTOM_MARGIN`
        (774, 874, 874, 924).
  - [ ] `[unit]` The HP column keeps its window anchor and its clearance: at those
        viewports `battleHpBox(v,'player',0).x === 64` (it is **not** `stage.x + 64`),
        `battleMovesBox(v).x === battleHpBox(v,'enemy',0).x + battleHpBox(v,'enemy',0).w + 8`
        (440 / 440 / 440 / 440) and the two cards do not intersect.
  - [ ] `[unit]` The phone keeps its gutter and changes nothing: at 390×844,
        `battleCommandBox(PHONE).y - (player.y + player.h) === 8` (592 − 584),
        `player` is `{16,504,358,80}`, and the menu card is `{16,592,358,236}`.
  - [ ] `[unit]` The partner clearance is unchanged: at 1280×800,
        `battleHpBox(DESKTOP,'player',1).y + 100 === battleHpBox(DESKTOP,'player',0).y - 8`
        and `battleHpBox(DESKTOP,'enemy',1).y === battleHpBox(DESKTOP,'enemy',0).y + 108`.
  - [ ] `[unit]` Purity holds: `battleStage(v)` twice is deep-equal and not the same
        object; `battleHpView(state, v, doubles)` twice is deep-equal.
  - [ ] `[unit]` The scene reads the one function:
        `grep -n "battleStage" src/scenes/BattleScene.ts` shows the import and one call
        in `refreshHud`, and `grep -n "MAX_BATTLE_SIZE" src/scenes/BattleScene.ts`
        prints nothing.
  - [ ] `[live]` **Equal bottoms at 1280×800.** With `?hud=dom`, reach a battle
        (`window.__pkmRoute.startDebugWildBattle('pidgey', 5)` from CDP
        `Runtime.evaluate`), step through the intro until
        `[data-hud-panel="battle-command"]` has `data-open="true"`, then read
        `getBoundingClientRect()` of `[data-hud-hp="player-0"]` and of
        `[data-hud-panel="battle-command"]`: their `bottom` values are equal within
        0.5 px and both are 774 ± 1; the HP rect is `x 64 ± 1` / `right 432 ± 1`; the
        camera reads `x 240, y 0, width 800, height 800` from
        `window.__pkmBattle.cameras.main` (`x`/`y`/`width`/`height`; Phaser 3.90 has no
        `viewport` rect).
  - [ ] `[live]` **The same at 1440×900.** Equal `bottom` = 874 ± 1, HP `x` = 64 ± 1,
        camera `270,0,900,900`.
  - [ ] `[live]` **The same at 900×900.** Equal `bottom` = 874 ± 1, HP `x` = 64 ± 1,
        camera `0,0,900,900`.
  - [ ] `[live]` **The phone keeps the 8 px gutter, at 390×844.**
        `[data-hud-panel="battle-command"].getBoundingClientRect().top` minus
        `[data-hud-hp="player-0"].getBoundingClientRect().bottom` is 8 ± 1, the HP box
        is `{16,504,358,80}` ± 1, and both rects lie inside the 390×844 viewport.
  - [ ] `[live]` **The desk move grid is unharmed, at 1280×800.** With the moves card
        open, `[data-hud-panel="battle-moves"]`'s rect is `{440,582,564,192}` ± 1 and
        none of its four painted move names contains `…` (the card is 564 px wide with
        the 222 px cells the board draws, so `PUNISHMENT`, `GRAVITY`, `POWER GEM` and
        `SKY ATTACK` are painted whole).

## 📣 Coordination

- For the Orchestrator: this is the amended revision (bottom line only, window-anchored
  HP column, menu untouched). The four foreign test files named in the earlier revision
  must come back unchanged.
- For the next batch: `battleStage(viewport)` is the single source of the square; any
  later panel that needs it reads it (or `battleMovesBox`) instead of re-deriving
  `offX`/`offY`. `BATTLE_STAGE_MAX` now lives in `src/ui/hud/panels/battle-hp/view.ts`
  and is re-exported from `battle-moves/view.ts`; import it from either. The battle HUD
  is **window**-anchored (frame `05`: player panel `x 64`, menu `664..1240` at 1280);
  the square only bounds the art.
- Docs to update, exactly:
  - `docs/design-spec.md` §4, the bullet at lines 406–408, replaced by:
    "On a wide screen the battle is a centred **square** (at most 900 px a side) —
    `battleStage(viewport)`, the rect the camera viewport is set to; a tall phone
    screen keeps the stacked, full-height layout, with both battlers drawn 25%
    smaller so they sit clear of the stacked panels. The HUD is window-anchored, as
    frame `05` draws it: the HP column keeps its 64 px margin, the command / moves card
    keeps its 36 px margin inside the square, and the player's lead card and that card
    end on **one bottom line**, 26 px above the square's bottom edge (on the phone the
    card keeps the measured 8 px gutter above the player's box)."
  - `src/ui/hud/panels/battle-hp/README.md`: the header paragraph (lines 3–5) names
    the shared bottom line ("… and the player's card `(64, 674)` under the player
    **inside `battleStage(viewport)`**, whose bottom edge it shares with the command
    card, `DESKTOP_BOTTOM_MARGIN` (26 px) above it"), and **rule 1** gains the
    sentence "Every rect it paints is a page coordinate: the board's column keeps the
    window's 64 px margin while its player lead ends on `battleStage(viewport)`'s
    bottom edge minus `DESKTOP_BOTTOM_MARGIN`, the one line the command card shares."
- Known doc drift this task must **not** fix (outside the claims):
  `src/ui/hud/panels/battle-moves/README.md:127` still says "this menu starts at 440"
  (true again).

## ⛔ Out of scope

- No change to `battle-hp/battleHp.tsx`, `battleHp.css`, `mount.tsx`, `index.ts`, or to
  the HP panel's viewport-at-mount behaviour.
- No change to `battle-command`, `battle-bag`, `battle-switch`, `battle-log` views,
  tests, CSS or barrels — including `battle-moves/index.ts`, `battle-hp/index.ts` and
  `battle-moves/view.test.ts`.
- No change to the stage's size rule (`BATTLE_STAGE_MAX` stays 900, the square stays
  centred), to `COMPACT_SIZE`/`BATTLE_COMPACT` (700), or to the menu card's geometry
  (`CARD_MARGIN`, `CARD_FROM_BOTTOM`, `CARD_CLEARANCE`, `CARD_MIN_W`, `CARD_H`).
- No change to the artists' canvas HUD, to the sprites, or to any `src/data/` file.
- No `docs/design-spec.md` section other than §4.
