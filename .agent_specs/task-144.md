# Spec: Task-144 — The battle's message box is the HUD's, and its pacing is one clock

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene + DOM/Preact UI panel (no engine change).
- **Role:** Dev.
- **Objective:** Under `?hud=dom`, the battle's message box stops being drawn by
  `src/scenes/BattleScene.ts` and becomes a Preact panel in
  `src/ui/hud/panels/battle-log/`, placed at frame `05b`'s own box on both viewports.
  The feed's frame still advances on the same measured clock (900 ms after the line
  is fully revealed), so a "Critical hit!" line lands with the HP drop it describes.
  With the flag off the canvas path is byte-for-byte what ships today.
- **Environment:** worktree `../wt-pkm-144`, branch `task-144`, base `origin/main`
  `4cdd1da` (Batch 65). Install once with
  `npm ci --prefer-offline --no-audit --no-fund`.
- **Dependencies (already merged on `main`, read them, do not edit them):**
  - `Task-140` — `src/ui/hud/panels/battle-hp/` and the `mountBattleHp` pattern in
    `BattleScene` (`mountHpPanel`/`disposeHpPanel`), the DOM HP boxes already at the
    board's coordinates.
  - `Task-143` — `src/ui/hud/panels/battle-switch/`, the newest battle-panel
    migration: copy its folder shape (`view.ts`, `view.test.ts`, panel `.tsx`,
  `.css`, `mount.tsx`, `preview.ts`, `preview.test.ts`, `fixture.test.ts`, `index.ts`,
    `README.md`).
  - `Task-124`/`Task-125`/`Task-127` — the shell, the kit and the fixture store.

### Exclusive paths (single writer)

Nothing outside this list. Do **not** edit `src/i18n/**`, `src/ui/feed.ts`,
`src/ui/typewriter.ts`, `src/engine/**`, any other panel, `TODO.md`, `CHANGELOG.md`
or `.agent_specs/`.

- `src/scenes/BattleScene.ts` (modify; this batch's one `BattleScene.ts` holder)
- `src/ui/hud/panels/battle-log/**` (new folder: the eight files below + README)
- `design/fixtures/05b-battle-message.json` (new)

The code-folder README rule: the new folder's `README.md` is yours to write. The
existing `src/ui/hud/panels/README.md` already lists `battle-log/` — do not touch it.

### Inputs (read-only)

- `design/frames/05b-battle-message.json` and `design/frames/m05b-battle-message.json`
  — the layout and copy source (the `text` tree carries the strings; the `geometry`
  tree carries the boxes).
- `design/tokens.json`, `src/ui/hud/styles/root.css` (the `--hud-*` tokens),
  `src/ui/hud/kit/**`, `src/ui/hud/fixtures/**` (store + flags),
  `docs/hud-fidelity.md`, `docs/hud-dom-proposal.md`, `docs/tech-decisions.md` `D49`.
- `src/ui/hud/panels/battle-hp/**` and `src/ui/hud/panels/battle-switch/**` as the
  reference migrations (mount/dispose, preview, fixture test).
- `src/ui/typewriter.ts` (the pure typewriter), `src/ui/feed.ts` (frame building),
  `src/scenes/BattleScene.ts` (the code you are changing).
- `AGENTS.md`.

## 🔒 Contract

Exact exports of `src/ui/hud/panels/battle-log/` (the barrel `index.ts` re-exports
all of this):

```ts
export const BATTLE_LOG_SLUG: '05b-battle-message';
export const BATTLE_LOG_SLUGS: readonly ['05b-battle-message', 'm05b-battle-message'];
export const BATTLE_LOG_DWELL_MS: 900;

export type BattleLogTone = 'primary' | 'effect';
export type BattleLogLineView = Readonly<{ text: string; tone: BattleLogTone }>;
/** 0..2 lines. Live is at most one; the fixture carries the frame's two. */
export type BattleLogView = Readonly<{ visible: boolean; lines: readonly BattleLogLineView[] }>;

/** The live line the scene is revealing (already localised). `null` = no line. */
export function liveBattleLogView(visible: boolean, line: string | null): BattleLogView;
/** The frame's own payload, or null when it is not one this panel can draw. */
export function fixtureBattleLogView(payload: unknown): BattleLogView | null;
/** The two boards' measured rects, exported for the fixture test and the diff. */
export function battleLogBoard(viewport: 'desktop' | 'narrow'): Readonly<{
  box: Readonly<{ x: number; y: number; w: number; h: number }>;
  line1: Readonly<{ x: number; y: number; w: number; h: number }>;
  line2: Readonly<{ x: number; y: number; w: number; h: number }>;
}>;

export type BattleLogHandle = Readonly<{
  /** Repaints only when `visible` or a line's text/tone changed; one render per change. */
  update(view: BattleLogView): void;
  dispose(): void;
}>;
export function mountBattleLog(host: Element, view: BattleLogView): BattleLogHandle;

export function battleLogPreviewRequested(search: string): boolean;
export function installBattleLogPreview(search: string): (() => void) | null;

/** The feed step, so the pacing is one pure rule the scene calls and a test pins. */
export function feedStep(
  typingDone: boolean,
  elapsedMs: number,
  holdMs: number,
  rush: boolean,
  deltaMs: number,
): Readonly<{ elapsedMs: number; advance: boolean }>;
```

`feedStep` semantics (the shipped behaviour, now testable):

- `!typingDone` → `{ elapsedMs: 0, advance: false }` (the hold only starts once the
  line is fully revealed).
- `typingDone` → `elapsed = elapsedMs + deltaMs`;
  `advance = elapsed >= (rush ? FAST_HOLD_MS : holdMs)`. `FAST_HOLD_MS` is the
  scene's existing 45 ms rush floor; pass it as `holdMs` when `rush` is true, or
  keep the comparison inside the helper with the same numbers — the tests pin
  `holdMs = 900`: 899 → no advance, 900 → advance, and `rush` → 45.

`mountBattleLog` writes:

- the panel root `[data-hud-battle-log]`, `data-visible="true|false"`;
- line 1 `[data-hud-battle-log-line="1"]` (always primary tone) and line 2
  `[data-hud-battle-log-line="2"]` when the view carries it (effect tone).
- It is presentation only: no listener, no clock, no Phaser, no run, no i18n.

### Scene contract (`src/scenes/BattleScene.ts`)

1. `BATTLE_LOG_DWELL_MS` is the **single** home of 900: replace
   `const MESSAGE_HOLD_MS = 900` with an import of `BATTLE_LOG_DWELL_MS` used
   wherever `MESSAGE_HOLD_MS` was used (capture timing included). No second literal
   900.
2. Under `DOM_HUD` the scene must not draw the message box: `messagePanel` and
   `messageText` are hidden (never visible) on every `refreshHud()`; the DOM panel is
   mounted once in `create()` (after `buildScene`) and disposed on `SHUTDOWN`, via
   `mountBattleLog`/`disposeBattleLog` mirroring `mountHpPanel`/`mountSwitchPanel`.
3. `refreshHud()` (and every typing tick) pushes
   `liveBattleLogView(!menuOpen, currentLine)` to the panel, where `currentLine` is
   `visibleText(this.typing)` (the typewriter's visible slice), or `null` when the
   box is closed. `visible` is exactly the old `messagePanel.setVisible(!menuOpen)`
   condition. No second copy of the text and no re-derivation: the scene pushes, the
   panel paints.
4. `update()` replaces its inline feed arithmetic with `feedStep(...)`; behaviour
   must be identical: `rush` completes the typing, `!done` resets the hold, and the
   frame advances at the hold; the capture beat's special case
   (`frameHoldMs = timeline.totalMs + BATTLE_LOG_DWELL_MS`) is unchanged.
5. Export
   `export function battleLogDrawnObjectCount(scene: BattleScene): number` returning
   the number of message-box display objects currently **visible** on the canvas
   (`messagePanel` visible ? 1 : 0) + (`messageText` visible ? 1 : 0). The live
   contract reads it via a dynamic import, exactly like `battleHpDrawnObjectCount`.
6. With `?hud=dom&hudFixture=<05b slug>` the scene must not mount a second log:
   `battleLogPreviewRequested` makes the scene step aside (the preview owns the
   layer), the way `MainMenuScene` does.
7. Flag off: unchanged canvas rendering and pacing; `npm test` and the existing
   battle tests must stay green with no re-pin.

## 🧩 Data and configuration

`design/fixtures/05b-battle-message.json` is the frame's own payload. It carries a
valid `HudState` under `state` (copy a minimal valid one from
`design/fixtures/05d-battle-pokemon.json`: all six keys `party`, `bag`, `money`,
`route`, `battle`, `notice`) plus:

```json
{
  "slug": "05b-battle-message",
  "state": { "party": [], "bag": [], "money": null, "route": null, "battle": {}, "notice": null },
  "battleLog": {
    "visible": true,
    "lines": [
      { "text": "VENUSAUR used SLUDGE BOMB!", "tone": "primary" },
      { "text": "CHARIZARD lost 38 HP and is poisoned.", "tone": "effect" }
    ]
  }
}
```

`fixtureBattleLogView` rejects anything else (missing key, wrong types, >2 lines,
unknown tone) with `null`; it never throws.

Board measurements (read from the two frames, do not retype from memory):

- desktop `05b`: `message box` `664,544 576×216` r11 fill `#10161f` @0.92, highlight
  `676,556 552×1` white @0.14, `message line 1` `696,580 292×20` ink `#F8FAFC`,
  `message line 2` `696,612 294×15` `#FCA5A5`; type cursor `696,648 10×16` r2.
- mobile `m05b`: `m menu panel` `16,592 358×236` r11; two lines at `32,620` and
  `32,646` (the frame's own copy), same tones.

The CSS takes every colour, size and radius from the `--hud-*` tokens (`root.css`)
or a scoped custom property on the panel; no literal colour. The 900 ms dwell is
the only timing constant and it lives in `view.ts`.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; green, including the new tests.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-144` against the exclusive list; nothing else.
  - Live reading over CDP against `npm run dev -- --port <free> --strictPort` on the
    machine's `/usr/bin/chromium`. Use `getBoundingClientRect()`/computed styles on
    the DOM, not screenshots; name the method in the report. The board's raster is
    the diff's reference, not the gate.
  - `npm run hud:diff -- 05b-battle-message` is evidence if it runs in this
    environment; if it cannot run, say so — it is not a criterion.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `npm test` green; the new tests exist and cover `feedStep` (899/900/45,
    not-done resets), `liveBattleLogView` (visible/hidden, one line, empty), the
    fixture parser (good payload + four rejection cases) and the board rects.
  - [ ] `[unit]` `BATTLE_LOG_DWELL_MS === 900` is the only 900 in `BattleScene.ts`
    (grep) and the capture hold still adds it.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched, and no
    `src/engine/**`, `src/i18n/**` or other panel changed.
  - [ ] `[live]` With `?hud=dom&hudFixture=05b-battle-message` at 1280×800, the
    `[data-hud-battle-log]` rect is `664,544 576×216` ±2 px, line 1's rect is
    `696,580 292×20` ±2, line 2's is `696,612` ±2; line 1's computed colour is
    `rgb(248, 250, 252)` and line 2's `rgb(252, 165, 165)`; the panel's computed
    background is `rgba(16, 22, 31, 0.92)` and its border is 1 px inside its box.
  - [ ] `[live]` The same URL at 390×844 gives the panel `16,592 358×236` ±2 and the
    two lines at `32,620` / `32,646` ±2; `document.documentElement.scrollWidth` is
    390 (no horizontal overflow).
  - [ ] `[live]` In a live wild battle (debug overlay → wild battle) under
    `?hud=dom`, `battleLogDrawnObjectCount(game.scene.getScene('Battle'))` is **0**;
    with the flag off it is **2**. The DOM log exists in the flag-on battle.
  - [ ] `[live]` In that live battle, two `textContent` samples of
    `[data-hud-battle-log-line="1"]` taken 250 ms apart while the line is being
    revealed have strictly increasing length, and each sample is a prefix of the
    full line read after completion; the line then stays unchanged for at least
    850 ms before the next frame's text replaces it (timestamps of the two
    `MutationObserver` records).

## 📣 Coordination

- For the next batch: the battle's chrome is now fully DOM under `?hud=dom`
  (HP boxes, moves, bag, switch, message box); `src/ui/feed.ts` and
  `src/ui/typewriter.ts` stay the pure clock and were not modified.
- For QA: the 900 ms is measured from the **end of the typewriter**, not from the
  frame's start; a 40-character line at the default 20 ms/char takes ~800 ms to
  type, so the next frame starts ~1.7 s after the previous one began — that is the
  shipped behaviour and the spec freezes it.
- No new i18n key: the engine's `battle.log.*` keys and `battleMessage` already
  produce the text.

## ⛔ Out of scope

- The command menu, the move/bag/switch panels, the HP boxes, the arena, the
  combatants, the capture beat's animation and the floating damage numbers.
- Any change to `src/engine/**`, `src/ui/feed.ts`, `src/ui/typewriter.ts`, the i18n
  tables or the save format.
- New dependencies, new fonts, or a second way to read the battle state.
