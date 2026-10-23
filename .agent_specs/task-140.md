# Spec: Task-140 — The battle's HP boxes are the HUD's

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene + Preact panel (`D49`, Phase 12).
- **Role:** Dev.
- **Objective:** The four name-and-HP boxes leave `src/scenes/BattleScene.ts`. With
  `?hud=dom` on, the battle's HP boxes are Preact boxes in the `#hud` layer, drawn to
  the prototype board's own battle panels (`design/frames/05-battle-hud.json`, nodes
  `1:2811` foe and `1:2826` player; `design/frames/m05-battle-hud.json`, nodes
  `8:4005`/`8:4006` on the phone): a 368×100 card at (64,48) over the foe and at
  (64,660) under the player on a 1280×800 screen, 358×80 at (16,16)/(16,504) at
  390×844, each with its highlight, the name-and-level line, the HP track and fill,
  the HP readout and the status mark — and each fill animating its own drop inside the
  frame's dwell. With the flag off every line of the shipped Phaser boxes draws exactly
  as it draws today, and the arena, the combatants, the shake and the effects never
  change in either mode.
- **Environment:** worktree `../wt-pkm-140`, branch `task-140`.
- **Dependencies:** all merged, nothing produced by a batch-mate:
  - `Task-127` (the spike) — `src/ui/hud/panels/options/**` is the pattern this task
    copies, and `src/scenes/SettingsScene.ts` shows the scene-side `DOM_HUD` branch.
  - `Task-124` — `src/ui/hud/mount.ts`, `styles/root.css`, the Silkscreen faces.
  - `Task-125` — `src/ui/hud/kit/**`.
  - `Task-123` — `src/ui/hud/state.ts` (`projectHud`, `syncHud`, `HudState`,
    `HudBattle`, `HudBattleFighter`) and `src/ui/hud/commands.ts` (`HudCommand`).
  - `Task-126` — `src/ui/hud/fixtures/**` (`parseHudFlags`).
  - Read but never changed: `src/ui/metrics.ts` (`hpFraction`),
    `src/engine/battle/state.ts` (`BattleState`, `SideId`, `Slot`),
    `src/ui/feed.ts` (`battleFrames`), `src/scenes/panels/types.ts`.

### Exclusive paths (single writer)

**Nothing outside this list.**

- `src/scenes/BattleScene.ts` (modify — **this batch's only claim on it**)
- `src/ui/hud/panels/battle-hp/view.ts` (new)
- `src/ui/hud/panels/battle-hp/view.test.ts` (new)
- `src/ui/hud/panels/battle-hp/battleHp.tsx` (new)
- `src/ui/hud/panels/battle-hp/battleHp.css` (new)
- `src/ui/hud/panels/battle-hp/mount.tsx` (new)
- `src/ui/hud/panels/battle-hp/index.ts` (new)
- `src/ui/hud/panels/battle-hp/README.md` (new)

Do **not** touch `src/ui/hud/panels/README.md` (Task-124 already wrote the
`battle-hp/` line), `src/ui/README.md`, `src/scenes/README.md`, `design/fixtures/**`
(see *Fixture decision*), `package.json`, `src/main.ts`, `vite.config.ts`,
`src/ui/hud/state.ts`, `src/ui/hud/commands.ts`, `src/ui/hud/mount.ts`,
`src/ui/hud/kit/**`, `src/scenes/RouteScene.ts`, `src/scenes/panels/**`.

### Fixture decision (read this before planning the work)

Every battle frame (`05-battle-hud`, `05b`, `05c`, `05d`, `05e`) carries the foe/player
HP panels **and** the battle menu, so none of them can pass until both the HP boxes
(this task) and the move menu/message box (Tasks 141 and 144) are DOM. On top of that
the board's `05` battle field is the board's own arena, not the game's canvas, so the
whole-frame `hud:diff` colour gate cannot pass at a fresh boot even with every box
migrated. **This task therefore claims no `design/fixtures/<slug>.json` and must not
create one.** `npm run hud:diff` is **not** a gate for this task; the gate is the DOM
measurement in the Test and Validation Plan.

### Inputs (read-only)

- `AGENTS.md`, this spec.
- `design/frames/05-battle-hud.json` (foe panel `1:2811`, player panel `1:2826`) and
  `design/frames/m05-battle-hud.json` (foe panel `8:4005`, player panel `8:4006`) —
  the authority for every number below.
- `design/tokens.json`, `src/ui/hud/styles/root.css`, `src/ui/hud/kit/kit.css`.
- `src/ui/hud/panels/options/**` (the pattern), `src/ui/hud/panels/README.md`.
- `src/ui/hud/state.ts`, `src/ui/hud/commands.ts`, `src/ui/hud/fixtures/index.ts`,
  `src/ui/metrics.ts`, `src/ui/feed.ts`.
- `src/scenes/BattleScene.ts` (your file), `src/engine/battle/state.ts`,
  `src/engine/battle/fighter.ts`.
- `docs/hud-fidelity.md` §2–§5, `docs/hud-dom-proposal.md` §4–§6, `D49` in
  `docs/tech-decisions.md`.

## 🔒 Contract

Two halves, frozen. Names and signatures are exact.

### A. The panel folder (`src/ui/hud/panels/battle-hp/`) — no Phaser, no scene, no run

```ts
// view.ts
import type { HudState } from '../../state';

export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;
export type HpSide = 'enemy' | 'player';

/** One box: which side, which of the side's two actives, and what it paints. */
export type HpBoxView = Readonly<{
  id: 'enemy-0' | 'enemy-1' | 'player-0' | 'player-1';
  side: HpSide;
  slot: 0 | 1;
  /** Viewport coordinates, from `battleHpLayout`. */
  box: Rect;
  /** Panel-relative. */
  highlight: Rect;
  name: string;
  level: number;
  /** `hp + '/' + maxHp`, exactly as `HudBattleFighter.hp`/`maxHp` read. */
  hpText: string;
  /** 0…1, from `HudBattleFighter.hpFraction`. */
  fraction: number;
  statusLabel: string | null;
}>;

export type BattleHpView = Readonly<{
  /** Every box the battle fields right now, in draw order: foe lead, foe partner,
   * player lead, player partner. A side that fields one active has one box. */
  boxes: readonly HpBoxView[];
}>;

/** How long a fill takes to reach its new fraction, in ms. Below the 900 ms frame
 * dwell (`MESSAGE_HOLD_MS`), so a drop lands with its line. */
export const HP_FILL_MS = 300;
/** 600: below it the phone column's boxes are used (`m05`). */
export const BATTLE_HP_BREAKPOINT = 600;

/** The rect of one box at this viewport and side, for `slot` 0 or 1. */
export function battleHpBox(viewport: Viewport, side: HpSide, slot: 0 | 1): Rect;
/** The whole layout: four rects in draw order, `null` for a side that fields one. */
export function battleHpLayout(
  viewport: Viewport,
  doubles: Readonly<{ enemy: boolean; player: boolean }>,
): readonly Readonly<{ side: HpSide; slot: 0 | 1; box: Rect }>[];
export function battleHpView(
  state: HudState,
  viewport: Viewport,
  doubles: Readonly<{ enemy: boolean; player: boolean }>,
): BattleHpView;
```

`battleHpView` reads only `state.battle` (`null` ⇒ `{ boxes: [] }`), and inside it
`sides[side].actives` in order. It is pure: same inputs ⇒ deep-equal view.

```ts
// battleHp.tsx
import type { JSX } from 'preact';
import type { BattleHpView } from './view';

export type BattleHpProps = Readonly<{ view: BattleHpView }>;
export function BattleHp(props: BattleHpProps): JSX.Element;
```

```ts
// mount.tsx
import type { HudState } from '../../state';
export type BattleHpController = Readonly<{
  /** Pushes a snapshot; a changed `fraction` starts that box's fill transition. */
  update(state: HudState): void;
  dispose(): void;
}>;
/** Mounts the boxes into `host` and returns the controller the scene feeds. */
export function mountBattleHp(
  host: Element,
  doubles: Readonly<{ enemy: boolean; player: boolean }>,
  viewport: Viewport,
): BattleHpController;
```

```ts
// index.ts — the barrel the scene imports
export { BattleHp } from './battleHp';
export type { BattleHpProps } from './battleHp';
export { mountBattleHp } from './mount';
export type { BattleHpController } from './mount';
export {
  BATTLE_HP_BREAKPOINT,
  HP_FILL_MS,
  battleHpBox,
  battleHpLayout,
  battleHpView,
} from './view';
export type { BattleHpView, HpBoxView, HpSide, Rect, Viewport } from './view';
```

**Measured geometry this task must hit** (all of it from the frames):

| viewport | box | rect | fill |
| --- | --- | --- | --- |
| 1280×800 | foe slot 0 | 368×100 at (64,48) | `rgb(16 22 31 / 90%)` |
| 1280×800 | player slot 0 | 368×100 at (64,660) | `rgb(16 22 31 / 90%)` |
| 390×844 | foe slot 0 | 358×80 at (16,16) | `rgb(16 22 31 / 88%)` |
| 390×844 | player slot 0 | 358×80 at (16,504) | `rgb(16 22 31 / 88%)` |

- Both columns: radius 11, 1 px `--hud-panel-border` hairline, highlight at rel
  (12,12) `w - 24` × 1 in `#FFFFFF` at 14 %.
- Desktop internals, **foe** box: name-and-level at rel (24,20) 114×20 (16 px / 20 px,
  `--hud-text-ink`), level right-aligned at rel (276,22) 35×13 (10/13,
  `--hud-text-muted`), HP track at rel (24,78) 220×8 radius 4 (`#FFFFFF` at 12 %), HP
  readout at rel (252,74) 49×13 (10/13, `--hud-text-ink`). **Player** box: the same
  three, with the track at rel (24,80) and the readout at rel (252,76) — the board
  measures the player track 2 px lower; follow it.
- Desktop HP fill: `#4AD15C` (the board's `foe hp fill`), height 8, radius 4, width
  `fraction × 220`, left-aligned inside the track.
- Phone internals: the board carries no name/level/readout node for `m05`; draw them
  at the body scale (10 px / 13 px) inside the box, and the HP track at rel (20,54)
  214×10, radius 0, with the same `#4AD15C` fill at `fraction × 214`. The measurement
  covers the box, the highlight and the track only.
- **The second active (2 vs 2), which the board does not draw:** the partner box is
  the same rect as its side's lead, placed by one rule —
  - foe partner: beside the lead at `x = lead.x + lead.w + 8` **when**
    `lead.x + 2 × lead.w + 8 <= viewport.width`, else directly below at
    `y = lead.y + lead.h + 8`, same `x`;
  - player partner: always directly above at `y = lead.y - lead.h - 8`, same `x`.
  At 1280×800 that is foe (440,48) and player (64,552); at 390×844 foe (16,104) and
  player (16,416). The 8 is `--hud-gutter`.
- `view` is data only: the component reads no scene, no run, no engine, no save and no
  RNG. It imports `HudState` as a **type**, the kit, `./battleHp.css` and
  `../../../../i18n` if it needs a string. **It must not import Phaser,
  `src/scenes/**`, `src/engine/**` (including `src/engine/save.ts`), `src/data/**`
  directly, or write any save field.**
- DOM contract QA reads: one root `[data-hud-battle-hp]` (a full-viewport,
  `pointer-events: none` layer inside `#hud`), then one
  `[data-hud-hp="enemy-0"|"enemy-1"|"player-0"|"player-1"]` per box, with
  `[data-hud-hp-track]`, `[data-hud-hp-fill]` and `[data-hud-hp-value]` inside it. The
  boxes take no presses; the layer never eats a pointer event.
- **Animation:** a box whose `fraction` changed transitions its fill width over
  `HP_FILL_MS = 300` ms; the first paint sets it with no transition; when
  `matchMedia('(prefers-reduced-motion: reduce)').matches` it jumps.

### B. `src/scenes/BattleScene.ts` — the flag branch

```ts
/** The number of display objects the HP boxes draw right now: 0 under `?hud=dom`. */
export function battleHpDrawnObjectCount(scene: BattleScene): number;
```

- `DOM_HUD` is read once at module load:
  `const DOM_HUD = typeof window === 'undefined' ? false : parseHudFlags(window.location.search).dom;`
  (`parseHudFlags` from `../ui/hud/fixtures`).
- **Flag off:** not one line of the shipped behaviour changes. `drawSidePanel` and
  `drawSecondPanel` paint the four kits exactly as today and
  `battleHpDrawnObjectCount(scene)` counts the visible objects of `panelKits` (> 0).
- **Flag on:** the scene draws **no** HP box:
  - `buildScene` still builds the four windows and the kits (so `panelKits` keeps its
    shape and every other consumer keeps working) but leaves every object hidden, and
    `drawSidePanel`/`drawSecondPanel`/`drawFoeBallRow` return before painting
    (call `hideSecondPanel`'s shape for both slots of both sides);
  - `create` mounts the DOM boxes once with
    `mountBattleHp(document.getElementById('hud')!, doubles, { width, height })`
    where `width`/`height` are `this.scale.width`/`this.scale.height`; on
    `SHUTDOWN` it disposes them;
  - `refreshHud` keeps **all** its layout arithmetic (the combatants' caps and
    positions read `foeInfo`/`playerInfo`, so the arena must not move) and, after it,
    pushes the snapshot through the one emit point:
    `syncHud({ screen: 'battle', battle: this.state, canCapture: this.launch?.canCapture === true }, (next) => this.hpController?.update(next))`;
  - `doubles` is `{ enemy: this.displayActive2.enemy, player: this.displayActive2.player }`
    (the same fields the shipped second panel reads).
- **The pacing is not touched.** `showFrame`/`advanceFeed` stay synchronous; the fill's
  300 ms runs inside the existing 900 ms `MESSAGE_HOLD_MS` dwell, so a drop still
  lands with its line. Do not add an `await` to the feed.
- **No RNG, no save field, no engine rule change, no new run field, no
  `SAVE_VERSION` step.** The battle's own state, its frames and its menu are untouched;
  the arena, sprites, platforms, effects, shake, flash and fade are untouched.
- Under the flag, nothing else in the scene may change shape: the message box, the
  command/move menus, the party grid and the bag list stay Phaser (Tasks 141–144).

## 🧩 Data and configuration

No new data table, no `src/data/**` path, no balancing value. The constants this task
introduces are `HP_FILL_MS`, `BATTLE_HP_BREAKPOINT` and the two columns' rects in
`view.ts`; `battleHp.css` reads `root.css`'s custom properties and adds one scoped
property per board value it needs (the 90 %/88 % fills, the 14 % highlight, the
`#4AD15C` fill). Do not edit `kit.css`: its `.kit-panel` fill is 72 % and its
`::before` highlight is white 8 %, while the battle boxes are 90 %/88 % with a 14 %
highlight — override both on `.battle-hp` in `battleHp.css`.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including `view.test.ts`.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-140` must list only the eight exclusive paths.
  - The `[live]` criteria need a browser: on this host set
    `CHROME_PATH=/tmp/opencode/chrome-nosandbox` (a wrapper adding
    `--no-sandbox --remote-debugging-address=127.0.0.1`) and serve the game with
    `npm run dev -- --port 5199 --strictPort` (the dev server is required: the checks
    import `/src/main.ts`). Drive it over CDP exactly as `scripts/hud/diff.mjs` does.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean: `npm run build`.
  - [ ] `[unit]` `npm test` is green and
        `src/ui/hud/panels/battle-hp/view.test.ts` asserts:
        `battleHpBox({ width: 1280, height: 800 }, 'enemy', 0)` =
        `{ x: 64, y: 48, w: 368, h: 100 }` and `… 'player', 0` =
        `{ x: 64, y: 660, w: 368, h: 100 }`;
        `battleHpBox({ width: 390, height: 844 }, 'enemy', 0)` =
        `{ x: 16, y: 16, w: 358, h: 80 }` and `… 'player', 0` =
        `{ x: 16, y: 504, w: 358, h: 80 }`;
        `battleHpLayout({ width: 1280, height: 800 }, { enemy: true, player: true })`
        returns four entries in the order enemy 0, enemy 1, player 0, player 1, with
        `{ side: 'enemy', slot: 1 }` at `{ x: 440, y: 48, w: 368, h: 100 }` and
        `{ side: 'player', slot: 1 }` at `{ x: 64, y: 552, w: 368, h: 100 }`;
        `battleHpLayout({ width: 390, height: 844 }, { enemy: true, player: true })`
        puts `{ side: 'enemy', slot: 1 }` at `{ x: 16, y: 104, w: 358, h: 80 }` and
        `{ side: 'player', slot: 1 }` at `{ x: 16, y: 416, w: 358, h: 80 }`;
        and a single battle's layout has exactly two entries.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` **The boxes.** With `?hud=dom`, a started run and a debug wild battle
        (`game.scene.getScene('Route').startDebugWildBattle('pidgey', 5)`), the two
        roots read at 1280×800:
        `[data-hud-hp="enemy-0"]` = `x 64, y 48, width 368, height 100` and
        `[data-hud-hp="player-0"]` = `x 64, y 660, width 368, height 100`, each within
        ±2 px; at 390×844 they read `x 16, y 16, 358×80` and `x 16, y 504, 358×80`
        within ±2 px, and `document.documentElement.scrollWidth <= window.innerWidth`
        at both viewports.
  - [ ] `[live]` **The chrome.** `getComputedStyle` on the enemy box reports
        `border-top-left-radius: 11px`, `border-top-width: 1px`,
        `border-top-color: rgba(255, 255, 255, 0.16)` and
        `background-color: rgba(16, 22, 31, 0.9)`; `[data-hud-hp-track]` inside it is
        220×8 at `x = box.x + 24`, `y = box.y + 78`; `[data-hud-hp-fill]` is
        `#4AD15C` (`rgb(74, 209, 92)`) and its width equals `round(fraction × 220)`
        within ±2 px; `[data-hud-hp-value]`'s text equals
        `hp + '/' + maxHp` read from `game.scene.getScene('Battle').state` for the same
        side.
  - [ ] `[live]` **The flag contract.** `?hud=dom` **off**: the battle draws its boxes,
        `(await import('/src/scenes/BattleScene.ts')).battleHpDrawnObjectCount(game.scene.getScene('Battle')) > 0`
        and `document.querySelector('[data-hud-battle-hp]') === null`. `?hud=dom`
        **on**: the count is `0`, the layer exists, and the canvas is otherwise
        untouched — both combatants are still drawn:
        `game.scene.getScene('Battle').playerSprite.visible === true` and
        `game.scene.getScene('Battle').foeSprite.visible === true`, and the platforms,
        the background rectangles and the effect sprite are untouched
        (`scene.foePlatform.visible === true`, `scene.bgTop.visible === true`).
  - [ ] `[live]` **A turn still lands with its line.** With `?hud=dom` on, from the
        battle menu press `E` (FIGHT) then `E` (first move), wait 2500 ms: the log grew
        (`game.scene.getScene('Battle').state.log.length` is larger than before), the
        battle is still running (the Battle scene is active) and the foe box's
        `[data-hud-hp-value]` matches the foe's live `hp + '/' + maxHp` (so the drop and
        its line agree), with `[data-hud-hp-fill]`'s width equal to
        `round(fraction × 220)` within ±2 px once the animation has settled.
- **Live recipe:**
  1. `CHROME_PATH=/tmp/opencode/chrome-nosandbox npm run dev -- --port 5199 --strictPort`
  2. Launch that Chrome headless with `--remote-debugging-port=9222`, attach to the page
     target, `Page.enable`, `Emulation.setDeviceMetricsOverride` with
     `{ width, height, deviceScaleFactor: 2, mobile: width < 600 }`.
  3. `Page.navigate` to `http://127.0.0.1:5199/?hud=dom`; wait for the load event.
  4. Poll `(await import('/src/main.ts')).game.scene.isActive('MainMenu')` every 200 ms
     (up to 20 s), dispatch `Enter` twice with 600 ms between (new run → starter → first
     card), then poll `game.scene.isActive('Route')`.
  5. `Runtime.evaluate`:
     `(await import('/src/main.ts')).game.scene.getScene('Route').startDebugWildBattle('pidgey', 5)`,
     then poll `game.scene.isActive('Battle')` and wait 800 ms.
  6. `Runtime.evaluate` with `awaitPromise: true` and an async IIFE returning the JSON
     of the expressions above.
  7. Repeat with the flag off, and with `{ width: 390, height: 844, mobile: true }`.
     `startDebugWildBattle` is dev-only (`IS_DEVELOP`), which the dev server satisfies.

## 📣 Coordination

- **For the Orchestrator / the human — two assumptions to confirm:**
  1. The board draws **one** box per side; a 2 vs 2 has no frame. The partner rule
     above (foe beside-or-below by the gutter, player always above) is this task's
     decision, taken from the shipped rule's shape and the board's 8 px gutter.
  2. The type badges inside the box (`foe type GRASS` on `05`) are **not** drawn: the
     HUD's snapshot (`HudBattleFighter` in `src/ui/hud/state.ts`) does not carry the
     fighter's types, and that file is not this task's to change. The box draws the
     name, the level, the HP track/fill/readout and the status label. A later batch
     adds `types` to `HudBattleFighter` (one field, one test) and the badges with it.
- **For the next batch:** this is the first battle-side migration, so the shape the
  battle lane copies is: `DOM_HUD` read once, the kit objects built but hidden, the
  layout arithmetic untouched, one `syncHud(...)` push in `refreshHud`, one controller
  mounted from `create` and disposed on `SHUTDOWN`. Task-141 owns the next
  `src/scenes/BattleScene.ts` slot and must not re-mount this layer.
- `battleHpDrawnObjectCount(scene)` is the flag-contract probe, read with
  `(await import('/src/scenes/BattleScene.ts'))`.
- No fixture, no `hud:diff` gate, no `docs/` change, no `src/data/` change, no
  `SAVE_VERSION` step.

## ⛔ Out of scope

- The move menu (Task-141), the battle bag (142), the switch screen (143) and the
  message box (144); the message box's `hud.play()` pacing.
- Type badges (see Coordination), floating damage numbers (`D49` keeps them in the
  canvas), the foe's ball row.
- Any change to the battle's own rules, frames, RNG draws or `BattleState`.
- `design/fixtures/**`, any `hud:diff` pass, any change to `scripts/hud/**` or
  `design/**`.
- `src/ui/hud/state.ts`, `src/ui/hud/commands.ts`, `src/ui/hud/mount.ts`, the engine,
  the RNG or the save.
