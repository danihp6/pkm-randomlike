# Spec: Task-227 — A multi-hit move drops the bar one segment per hit, on its own short beat

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene + pure view module (battle presentation).
- **Role:** Dev.
- **Objective:** A damaging move that lands several hits stops spending one full
  message-dwell per hit. After this task the battle message feed gives a plain
  **landing-hit frame** its own short hold — `HIT_FRAME_MS`, the HP fill's own
  `HP_FILL_MS` plus one readable beat — on every hit of a sequence **except the
  last**, which keeps the shipped 900 ms dwell, so the HP bar steps one segment per
  hit and a five-hit move reads as five short beats instead of five long ones. The
  rule is a pure function in the message box's value module (no Phaser, no clock),
  and `BattleScene.showFrame` is its only caller. A miss mid-sequence, a one-hit
  move, a residual/weather chip and a capture frame all keep today's behaviour.
  Nothing about the engine, the feed's frame splitting or the HP panel moves.
- **Environment:** worktree `../wt-pkm-227`, branch `task-227`, cut from `main`.
  Work only inside that worktree.
- **Dependencies (already merged on `main`, read them, do not change them):**
  - **`[Task-226]`** — *the battle's HP, faint and stat-stage beat follows the turn's
    own order.* It produced the seam this task hangs on:
    `src/ui/hud/state.ts` exports `HudBattleDisplay`, `HudBattleSlotDisplay`,
    `battleDisplayOf(battle)` and `advanceBattleDisplay(battle, display, events)`,
    `BattleScene` owns the private field `display: HudBattleDisplay` and
    `showFrame()` advances it **before** `refreshHud()`, and the HP boxes paint that
    snapshot instead of the live turn. Read `showFrame` (around
    `src/scenes/BattleScene.ts:1011`) and `advanceBattleDisplay`
    (`src/ui/hud/state.ts:533`) before writing a line: this task must not undo that
    ordering.
  - `src/ui/hud/panels/battle-hp/view.ts` exports `HP_FILL_MS = 300` (the fill's
    transition, also pushed into the DOM card as `--battle-hp-fill-ms`), which is
    read here (read-only) as the floor of `HIT_FRAME_MS`.

### Exclusive paths (single writer)

**Nothing outside this list.** No other task in the batch claims any of them.

- `src/ui/hud/panels/battle-log/view.ts` — add the hit-frame rule and `HIT_FRAME_MS`.
- `src/ui/hud/panels/battle-log/view.test.ts` — its tests.
- `src/scenes/BattleScene.ts` — one assignment in `showFrame` plus the import.
- `docs/battle-spec.md` — **§3 only**, i.e. one new bullet appended to the bullet
  list of `## 3. Damage and stats` (the list that ends with the stat-stage bullet,
  immediately before the `### 3.1` heading). §3.1–§3.4 and every other section are
  out of bounds.

Explicitly **not** yours (another task, or frozen): `src/ui/feed.ts`,
`src/ui/hud/panels/battle-hp/**` (Task-228 owns it next cycle), `src/ui/hud/state.ts`
(Task-226 shipped it), `src/i18n/**`, `docs/design-spec.md`, `package.json`,
`src/main.ts`, `vite.config.ts`, `src/data/**`, any generated file.

### Inputs (read-only)

- `AGENTS.md`.
- `docs/battle-spec.md` — read §3 and §6 in full; you write one bullet in §3.
- `src/ui/feed.ts` — `FeedFrame` (`{ message, events }`) and `battleFrames`, which
  closes a frame at every `text` event. **This is the frozen frame shape**: every
  engine line becomes one frame, and the non-text events that precede a line ride in
  that line's frame.
- `src/ui/hud/panels/battle-log/view.ts` + `view.test.ts` — the module you extend and
  the shipped `feedStep`/`battleLogLayout`/`battleLogBoard` contract you must keep.
- `src/scenes/BattleScene.ts` — `showFrame`, `startFeed`, `advanceFeed`,
  `finishFeed`, `applyEvents`, `playCapture`, `update`, and the `frameHoldMs` field
  (around line 348). `update()` already does
  `feedStep(typewriterDone(this.typing), this.feedElapsed, this.frameHoldMs, rush, delta)`
  (around line 2855): the hold is the only number you change.
- `src/ui/hud/state.ts` — `HudBattleDisplay` / `advanceBattleDisplay` (the Task-226
  seam; read, never edit).
- `src/ui/hud/panels/battle-hp/view.ts` — `HP_FILL_MS` (line 77) and its doc comment.
- `src/ui/hud/panels/battle-hp/battleHp.tsx` — the DOM markers the `[live]` plan
  reads: `data-hud-hp="<side>-<slot>"`, `data-hud-hp-fill`, and the
  `--battle-hp-fill-ms` custom property.
- `src/ui/hud/panels/battle-command/battleCommandPanel.tsx` — the command card's
  markers: `data-hud-panel="battle-command"`, `data-open="true"|"false"`, and the
  rows' `data-hud-command="fight" | "bag" | "switch" | "run"`.
- `src/ui/hud/panels/battle-moves/battleMoves.tsx` — `data-hud-panel="battle-moves"`
  and the move cells' `data-hud-move-slot="<index>"`.
- `src/engine/battle/turn.ts` — the hit loop: around line 1338 every landing hit
  pushes one `damage` event, then one `battle.log.hit*` line (line 1347); a
  `multiaccuracy` miss pushes `battle.log.missed` and breaks the loop (lines
  1223-1231); a KO pushes `faint` **after** the hit's own line, so the faint lands in
  a later frame.
- `src/engine/battle/state.ts` — the `BattleEvent` union and `BattleTextKey`.
- `src/engine/battle/effects/weather.ts` — `WEATHER_CHIP_MESSAGES`
  (`battle.log.weather.buffeted.<weather>`), the keys a residual frame carries.
- `src/engine/battle/harness.ts` — `scriptedBattle` and `HarnessFighterSpec`, for the
  fixed-seed test the plan asks for.
- `src/i18n/en.ts` — **read only**, to copy the six hit keys verbatim
  (`battle.log.hit`, `.hitCrit`, `.hitSuper`, `.hitCritSuper`, `.hitWeak`,
  `.hitCritWeak`).
- **Board input.** The imported board spec `design/screens/05b-battle-message.json` and
  its export `design/exports/05b-battle-message.png` **are not on `main`** (they are
  the operator's blocked import, `[Task-223]`/`[Task-224]`), so they are not inputs and
  no criterion depends on them. The committed artifacts below are the **geometry of
  record** for this frame, and QA reads fidelity from them and never from a
  screenshot diff (`D57`):
  - `design/frames/05b-battle-message.json` — the old exporter's geometry dump,
    caption **`05b Battle · message`**.
  - `design/screens/05b-battle-message.png` — its 1280×800 raster.
  - `design/frames/m05b-battle-message.json` + `design/screens/m05b-battle-message.png`
    — the phone twin of the same caption.
  This task changes **pacing**, not geometry: no rect in that dump moves, and the
  message card keeps its measured box (`battleLogLayout`) and its two line insets.

## 🔒 Contract

The public surface other tasks will be written against. It is a promise. Everything
below goes in `src/ui/hud/panels/battle-log/view.ts`, appended after the existing
`feedStep`; every existing export (`BATTLE_LOG_SLUG`, `BATTLE_LOG_SLUGS`,
`BATTLE_LOG_DWELL_MS`, `BATTLE_LOG_BREAKPOINT`, `BATTLE_LOG_NARROW_QUERY`,
`battleLogBoard`, `battleLogLayout`, `liveBattleLogView`, `fixtureBattleLogView`,
`feedStep`, the `Rect`/`BattleLogTone`/`BattleLogLineView`/`BattleLogView` types)
stays exactly as it is, with the same values and the same signatures.

### TypeScript

```ts
import type { BattleEvent } from '../../../engine/battle/state';
import type { FeedFrame } from '../../../feed';
import { HP_FILL_MS } from '../battle-hp/view';

/**
 * The hold a landing-hit frame gets while another hit of the same move follows:
 * the fill's own `HP_FILL_MS` (300) plus one readable 150 ms beat — above the fill,
 * so a segment always finishes before the next one starts, and well under the
 * ordinary `BATTLE_LOG_DWELL_MS` (900).
 */
export const HIT_FRAME_MS: number; // === HP_FILL_MS + 150 === 450

/** The six log keys a landing hit prints — the whole `battle.log.hit*` family. */
export const HIT_FRAME_KEYS: readonly string[]; // the six keys, in the order above

/**
 * True when `frames[index]` is a landing hit of a move's hit loop: the frame
 * carries at least one `damage` event, carries none of `status`, `cure`, `boost`,
 * `switch`, `faint`, `heal`, `mega`, `gmax`, `forme`, `item`, `capture`, `run`,
 * `end`, and carries a `text` event whose `key` is one of `HIT_FRAME_KEYS`.
 * Total: an out-of-range index, a missing frame, a frame with no events → `false`.
 */
export function hitFrameAt(frames: readonly FeedFrame[], index: number): boolean;

/**
 * The hold the frame at `index` gets: `HIT_FRAME_MS` while it is a hit frame **and**
 * `frames[index + 1]` is also a hit frame; `dwellMs` otherwise. Pure and total.
 */
export function frameHoldMs(frames: readonly FeedFrame[], index: number, dwellMs: number): number;
```

- **Why the key is the discriminator, and not the shape.** A residual chip's frame is
  `[damage, text]`, byte-for-byte the same *shape* as a hit's — only the engine's
  `text.key` tells them apart (`battle.log.hit*` versus
  `battle.log.weather.buffeted.*`, `battle.log.residual.*`, …). Reading the key is
  legitimate: the engine already stores keys, never sentences (`D43`), and
  `src/ui/feed.ts` is the only place that resolves them.
- **Why the *next* frame decides.** A sequence's last hit must keep the ordinary
  dwell, and nothing in a frame says "I am the last": the frame after it is the
  answer. A miss (`battle.log.missed`, no `damage`) breaks the chain, so the hit
  before a miss becomes the last one and keeps the ordinary dwell while the segments
  already shown stay.
- **Determinism:** **reads no RNG**, no clock, no DOM, no Phaser, no locale, no
  save. The same arguments always give the same answer.
- Rules: `src/engine/` is untouched and stays Phaser-free; this module stays
  Phaser-free and deterministic (`src/ui/hud/panels/battle-log/` is a pure view
  module — the panel paints, the scene pushes). No per-frame allocation is added to
  a hot path: `frameHoldMs` runs once per frame in `showFrame`, never in `update`.

### Scene change (exact)

In `BattleScene.showFrame`, the first line currently reads
`this.frameHoldMs = BATTLE_LOG_DWELL_MS;`. It becomes:

```ts
this.frameHoldMs = frameHoldMs(this.frames, this.frameIndex, BATTLE_LOG_DWELL_MS);
```

with `frameHoldMs` imported from `'../ui/hud/panels/battle-log/view'` beside the
existing `BATTLE_LOG_DWELL_MS` / `feedStep` imports. Keep the field name
`frameHoldMs` (other code reads it) and keep the assignment **before**
`this.applyEvents(...)`: `playCapture` still overwrites the field later in that same
call (`timeline.totalMs + BATTLE_LOG_DWELL_MS`), and `finishCaptureBeat` still resets
it. Do not touch `startFeed`, `advanceFeed`, `finishFeed`, `update`, `applyEvents`,
`display`, `refreshHud` or any sprite beat.

### Data

- No data table, no JSON key, no i18n key, no default value changes. `HIT_FRAME_MS`
  is a **presentation** constant, not a balance value: it lives in the view module
  beside `BATTLE_LOG_DWELL_MS`, not in `src/data/`.

## 🧩 Data and configuration

None. `HIT_FRAME_MS` and `HIT_FRAME_KEYS` are the only new constants and they are
code, in the panel that owns the message box's clock.

### Docs edit (verbatim)

`docs/battle-spec.md` **§3** gains exactly **one** bullet, appended to the bullet list
of `## 3. Damage and stats` immediately after the stat-stage bullet (the one ending
"…reads that stored value and never recomputes one of its own.") and before the
`### 3.1 The number the formula multiplies` heading:

```
- **A multi-hit move's own beat.** The engine logs one `damage` and one line per
  landing hit, and the feed closes a frame at each line, so every hit of a sequence is
  its own frame. A landing-hit frame holds `HIT_FRAME_MS` — the fill's `HP_FILL_MS`
  plus one readable beat — while another hit of the same move follows it, and the
  ordinary `BATTLE_LOG_DWELL_MS` on the last one, so the bar steps one segment per
  hit. A residual or weather chip, a status line and a faint are never hit frames
  (the engine's own `battle.log.hit*` key is what names a hit), a miss ends the
  sequence with the segments already shown, and a one-hit move keeps the ordinary
  dwell. The bar's transition stays at `HP_FILL_MS`, so a segment finishes before the
  next one starts, and a held confirm still rushes the whole sequence.
```


## 🧪 Test and Validation Plan (for QA)

QA runs this verbatim. **The dev runs `npm test` and `npm run build` before
`dev: done`; QA re-runs both in its own integration worktree** (that task's branch
merged onto the batch base) and audits the diff.

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-227` — must list exactly the four exclusive
    paths.
  - The test file for the new rule is
    `src/ui/hud/panels/battle-log/view.test.ts`; Vitest picks it up by name.
  - One `[live]` criterion below needs a browser (`npm run dev` + CDP over headless
    Chromium at 1280×800). The `[unit]` criteria owe no browser pass.

### Acceptance criteria

- [ ] `[unit]` **It typechecks and builds clean.** `npm run build` exits `0`.
- [ ] `[unit]` **The declared tests exist and pass.** `npm test` exits `0`, and
  `npx vitest run src/ui/hud/panels/battle-log/view.test.ts` names all of:
  `HIT_FRAME_MS is the fill plus one beat`, `a two-hit move gets one frame per
  landing hit`, `only the last hit of a sequence keeps the ordinary dwell`, `a miss
  on the third hit keeps the two segments already shown`, `a one-hit move keeps the
  ordinary dwell`, `a residual chip is not a hit frame`, `the hit rule is total and
  pure`.
- [ ] `[unit]` **Nothing outside the exclusive paths was touched.**
  `git diff --name-only main...task-227` prints exactly
  `docs/battle-spec.md`, `src/scenes/BattleScene.ts`,
  `src/ui/hud/panels/battle-log/view.test.ts`,
  `src/ui/hud/panels/battle-log/view.ts`.
- [ ] `[unit]` **The constant is the fill plus one beat and stays under the dwell.**
  In `view.test.ts`: `expect(HIT_FRAME_MS).toBe(HP_FILL_MS + 150)` and
  `expect(HIT_FRAME_MS).toBeGreaterThan(HP_FILL_MS)` and
  `expect(HIT_FRAME_MS).toBeLessThan(BATTLE_LOG_DWELL_MS)`.
- [ ] `[unit]` **One frame per landing hit, each carrying exactly one `damage`.**
  A fixed-seed scripted battle —
  `scriptedBattle({ player: [{ id: 'p', speciesId: 'hitmonlee', level: 50, moves:
  ['doublekick', 'splash'] }], enemy: [{ id: 'e', speciesId: 'shuckle', level: 50 }],
  seed: 2026, turnCap: 1 })`, then `battleFrames(state.log)` — the player's command is
  the first legal fight move, so slot 0 (`doublekick`) is used — yields exactly
  **two** frames with `hitFrameAt(frames, i) === true`, and each of them carries
  exactly one `event.kind === 'damage'`. (Double Kick's dex `multihit` is the fixed
  number 2, its accuracy is 100 and its `multiaccuracy` is unset, so the count does not
  depend on the seed; `src/engine/battle/turn.test.ts` already pins the two damage
  events it lands.)
- [ ] `[unit]` **Only the last hit of a sequence keeps the ordinary dwell.** On that
  same frame list: `frameHoldMs(frames, iFirst, BATTLE_LOG_DWELL_MS) ===
  HIT_FRAME_MS` for the first hit and `=== BATTLE_LOG_DWELL_MS` for the second,
  where `iFirst`/`iSecond` are the indices found above.
- [ ] `[unit]` **A miss on the third hit keeps the two segments already shown.** Hand-
  build the engine's own shapes (a `move` frame, then two `[damage, text
  battle.log.hit]` frames, then one `text battle.log.missed` frame) and assert:
  `hitFrameAt(..., idx) === true` for the two hit frames and `false` for the miss
  frame, `frameHoldMs` is `HIT_FRAME_MS` on the first hit and `BATTLE_LOG_DWELL_MS`
  on the second, and the frame list has **no** third hit frame.
- [ ] `[unit]` **A one-hit move keeps the ordinary dwell.** A scripted battle whose
  player's slot 0 is `tackle` (`moves: ['tackle', 'splash']`) yields exactly one hit
  frame and `frameHoldMs(frames, i, BATTLE_LOG_DWELL_MS) === BATTLE_LOG_DWELL_MS`.
- [ ] `[unit]` **A residual chip is not a hit frame.** Hand-build
  `[move, text battle.log.used]`, `[damage, text battle.log.hit]`,
  `[damage, text battle.log.weather.buffeted.sand]` and assert the third frame is
  **not** a hit frame and gets `BATTLE_LOG_DWELL_MS`, while the second (a genuine
  last hit, since the next frame is not a hit) also gets `BATTLE_LOG_DWELL_MS`.
- [ ] `[unit]` **The rule is total and pure.** `hitFrameAt([], 0)`, `hitFrameAt([],
  -1)`, `hitFrameAt(frames, 999)` and `frameHoldMs(frames, 999, 900)` all answer
  without throwing (`false` / `900`), and calling any of them twice on the same
  arguments deep-equals the first answer.
- [ ] `[live]` **A two-hit move steps the foe's bar twice, one fill apart, and the
  command menu opens only after the second.** Measurement, at viewport 1280×800 with
  `window.devicePixelRatio === 1`, on a dev server (`npm run dev`) over CDP:
  1. Boot `http://localhost:5173/?hud=dom`, start a run, and reach the route.
  2. In `Runtime.evaluate` (awaitPromise): `const { game } = await
     import('/src/main.ts'); const route = game.scene.getScene('Route');
     route.setDebugSquadLevel(50);
     route.editDebugPokemon(route.debugParty()[0].id, { moves: ['doublekick',
     'splash'] }); route.startDebugWildBattle('shuckle', 50);`.
     (The debug menu is a dev-only overlay; these are the same entries its Party and
     Battle tabs call. A level-50 Shuckle's 95 HP survives two Double Kicks while the
     level-50 lead survives its reply — Shuckle's Attack is 10 base.)
  3. When `[data-hud-command="fight"]` exists, `.click()` it, then `.click()` the
     cell `[data-hud-move-slot="0"]`.
  4. Immediately install a `requestAnimationFrame` sampler that pushes
     `{ t: performance.now(), w: Math.round(fill.getBoundingClientRect().width),
     open: card.dataset.open }` with
     `fill = document.querySelector('[data-hud-hp="enemy-0"] [data-hud-hp-fill]')`
     and `card = document.querySelector('[data-hud-panel="battle-command"]')`, for
     8000 ms into `window.__samples`, then read it.
  5. **Pass** when, on that array: the `w` series **up to the first sample with
     `open === 'true'`** forms **exactly two** falling steps (a step = a run of
     consecutive samples whose `w` is more than 1 px below the previous run's);
     the first sample time of step 2 minus that of step 1 is **≥ `HP_FILL_MS`
     (300 ms) and ≤ 2500 ms**; no sample before the start of step 2 has
     `open === 'true'`; and the first sample with `open === 'true'` comes **≥
     `HP_FILL_MS`** after the start of step 2. Nothing is read from a screenshot
     (`D57`).
     *(If the foe faints on the second hit the run is invalid — Shuckle at level 50
     has 95 HP, so re-run with `route.setDebugSquadLevel(20)` and the same foe level,
     where the two segments still land and the lead still survives.)*
     *(Why the interval is a band and not `=== 300`: each hit's line is typed out at
     the player's text speed, and `feedStep` only starts the hold once the line is
     revealed — the frozen property is that a segment completes and a beat is read
     before the next step, never that the two transitions overlap.)*

## 📣 Coordination

- **For the Architect:** the batch's antichain holds — this task's only exclusive
  path inside `src/scenes/` is `BattleScene.ts`, which no other task in the batch
  claims, and `docs/battle-spec.md` §3 is a single block no batch-mate touches.
- **For the next batch (`[Task-228]`, the player's box and the menu sharing a bottom
  line):** `src/ui/hud/panels/battle-hp/view.ts` is untouched here; `HP_FILL_MS`
  keeps its value and its meaning (one segment's transition), and this task now
  *depends* on it staying ≤ `HIT_FRAME_MS - 150`. If `HP_FILL_MS` ever moves,
  `HIT_FRAME_MS` must be re-read in the same task, and the interval band of the
  `[live]` criterion moves with it.
- **For the next batch:** `HIT_FRAME_MS` and `frameHoldMs` live in the log panel's
  view and are the only place a battle frame's hold is decided. A future task that
  wants a different beat (a crit's accent, a "super effective" pause) extends
  `hitFrameAt`/`frameHoldMs`, never `showFrame`'s neighbours.
- **Known, deliberate boundary:** a hit whose loop prints a line *before* its damage
  (Endure's `battle.log.enduredHit`) has no `damage` in that earlier frame, so the
  frame is not a hit frame and the first damage frame of that move carries the
  ordinary dwell. Cosmetic only; named here so a later task widens the rule on
  purpose instead of by accident.
- **No file was added or renamed**, so no folder `README.md` changes: the
  `battle-log/README.md` map lists files, not exports.

## ⛔ Out of scope

- Do **not** edit `src/ui/feed.ts`. The frame splitting is already per hit and is
  frozen; this task reads `FeedFrame`, never rewrites it.
- Do **not** add a `damage`→move id to the engine's events, and do not touch
  `src/engine/**` at all: the key-based rule is enough and keeps the engine blind to
  presentation.
- Do **not** touch `src/ui/hud/panels/battle-hp/**` (`HP_FILL_MS` is only imported),
  `src/ui/hud/state.ts`, `src/i18n/**`, the HP panel's README, `docs/design-spec.md`
  or any rect in the message box. No re-layout, no font, no colour, no new key.
- Do **not** change the rush path (a held confirm still skips the whole sequence at
  the 45 ms floor), the typewriter, the capture beat, the faint beat or the
  typewriter's own elapsed accounting.
- No new dependency, no config change, no `package.json` edit, no test helper shared
  with another panel.
