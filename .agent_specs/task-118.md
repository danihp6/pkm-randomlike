# Spec: Task-118 — The capture beat and its message tick together

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** presentation / pure-timing module (headless-testable) + one scene.
- **Role:** Dev.
- **Objective:** the capture sequence becomes **one clock**. Today the ball's tweens and
  the message box run on two independent timers: `captureBeat` clamps a failed attempt
  up to at least one wobble (so a 0-shake break still wobbles once and the count stops
  meaning what the engine measured), and the wobble chain (`BattleScene.playCapture`)
  finishes ~1.66 s after a three-shake break while the line is typed and held for
  `MESSAGE_HOLD_MS = 900`. After this task a single timeline — `captureTimeline(shakes,
  success)` in `src/ui/capture.ts` — drives both the tween chain and the text: the ball
  wobbles exactly the number of times the engine rolled, one dot appears on the wait
  line per completed wobble (capped at three), a failed attempt opens the ball at the
  `break` tick, a success settles the ball on the field, and the frame's dwell is the
  beat's own `totalMs` plus the shipped hold.
- **Environment:** worktree `../wt-pkm-118`, branch `task-118`. Base: `origin/main` @
  `eba1681`. All commands run from the worktree root.
- **Dependencies:** `[Task-114]` (merged) — the battle's log is key plus params and the
  capture lines are already keys: `src/i18n/en.ts` carries
  `battle.log.caught`, `battle.log.capture.shakes0..3`, and `src/ui/feed.ts`'s
  `battleMessage(key, params)` resolves them. No file from Task-114 changes here.

### Exclusive paths (single writer)

The list of paths this task creates or modifies. **Nothing outside this list.**

- `src/ui/capture.ts` — the beat model gains the timeline (and the wait line).
- `src/ui/capture.test.ts` — its tests.
- `src/scenes/BattleScene.ts` — `playCapture` and the feed frame's dwell.
- `src/i18n/en.ts` — **one** new key, `battle.log.captureWait`.
- `src/i18n/es.ts` — the Spanish overlay of that one key.
- `docs/battle-spec.md` — §6 only (the capture section; see the section split).
- `src/ui/README.md` — the `capture.ts` list line only (see the section split).

**Section split (shared documents, do not touch other lines).**
`src/ui/README.md` is also claimed by Task-124, which appends new `hud/` lines **after**
the existing `hud/commands.ts` line. You edit only the `capture.ts` line that already
exists in the `Layout` list. `docs/battle-spec.md` is claimed by no other task in this
batch, but you still edit §6 and nothing else.

### Inputs (read-only)

Beyond `AGENTS.md` and this spec:

- `src/engine/battle/capture.ts` — `attemptCapture` returns `{ success, shakes, value }`
  with `shakes` in 0-4; **do not modify it**. The count is the engine's.
- `src/engine/battle/commands.ts` — `captureMessage(name, shakes, success)` (line ~349)
  to see how the final line is keyed; do not modify.
- `src/ui/feed.ts` — `battleFrames` / `battleMessage`; do not modify.
- `src/ui/typewriter.ts` — `beginTypewriter` / `revealAll` / `typewriterDone`.
- `docs/battle-spec.md` §6, `src/i18n/index.test.ts` (the guards your new key must clear).

## 🔒 Contract

### TypeScript — `src/ui/capture.ts`

Keep the existing exports and their meaning where the contract below does not change
them. `CAPTURE_SHAKES = 3`, `CAPTURE_HELD_SHAKES = 4` and
`CAPTURE_SHAKE_SPEED = 2.4` stay.

```ts
export const CAPTURE_SHAKES = 3;
export const CAPTURE_HELD_SHAKES = 4;
export const CAPTURE_SHAKE_SPEED = 2.4;

/** The throw's flight and the ball's drop, in ms. The shipped values. */
export const CAPTURE_THROW_MS = 260;
export const CAPTURE_DROP_MS = 150;

export type CaptureBeat = Readonly<{ shakes: number; held: boolean }>;

export type CaptureTickKind = 'shake' | 'break' | 'settle';

/** One scheduled moment of the beat: `at` is ms from the frame's start. */
export type CaptureTick = Readonly<{ at: number; kind: CaptureTickKind; index: number }>;

export type CaptureTimeline = Readonly<{
  throwMs: number;
  dropMs: number;
  /** One third of a wobble; the scene's per-tween duration. */
  stepMs: number;
  /** Ordered by `at`; `settle` is always last. */
  beats: readonly CaptureTick[];
  /** Sum of the phases: `throwMs + dropMs + shakes * 3 * stepMs (+ break)`. */
  totalMs: number;
}>;

/** The engine's roll, unclamped: a failure keeps 0-3, a success keeps 4. */
export function captureBeat(shakes: number, success: boolean): CaptureBeat;

export function captureTimeline(shakes: number, success: boolean): CaptureTimeline;

/** The in-progress line: `{name}` plus one dot per completed wobble, capped at three. */
export function captureWaitLine(name: string, completed: number): string;
```

Rules the implementation must satisfy (and the tests must pin):

1. `stepMs = Math.round(1000 / CAPTURE_SHAKE_SPEED / 3)` (139 today). A wobble is
   `3 * stepMs` (417 today).
2. `captureBeat(0, false)` is `{ shakes: 0, held: false }`. No clamping to 1. A negative
   or fractional count floors to 0; above `CAPTURE_SHAKES` on a failure it caps at
   `CAPTURE_SHAKES`; a success always reads `CAPTURE_HELD_SHAKES`.
3. `captureTimeline` builds `throwMs` and `dropMs` from the constants above, one `shake`
   tick per wobble at `at = throwMs + dropMs + (i + 1) * 3 * stepMs` (`index` is the
   1-based wobble number), a `break` tick at the end of the last wobble **only when the
   beat failed**, and `settle` last at `at = totalMs`.
4. `totalMs` is the sum of the phases and equals the last tick's `at`. On a failure the
   break phase is `stepMs`; on a success it is 0.
5. `captureWaitLine(name, completed)` resolves the new key and appends dots so the
   visible dot count is `Math.min(completed + 1, 3)` — the key's own `…` is the first.
   `completed` is floored and clamped at 0. The result for a name never exceeds three
   dot glyphs.
6. Reads no RNG, imports no Phaser, is a pure function module (it already is).

### i18n

One new key in `src/i18n/en.ts`, inside the existing capture block:

```ts
'battle.log.captureWait': '{name}…',
```

and its overlay in `src/i18n/es.ts` (the same `…`, one line, same params — the type
there is `Record<TranslationKey, string>`, so a missing key is a type error). Both must
clear `src/i18n/index.test.ts`'s guards: no param Spanish does not declare, every
character in the FRLG font (`…` and `.` already are), no em dash.

### Scene — `src/scenes/BattleScene.ts`

`playCapture` reads the timeline instead of computing `step`/tween lists itself:

- Its tween chain uses `throwMs`, `dropMs` and `stepMs` from the timeline, and the
  `shake` count is the beat's own (a 0-shake break builds **no** wobble tweens: throw,
  drop, open).
- The wait line is **set**, not typed: at the drop (tick `shake` 0 or immediately after
  the drop when there are no wobbles) show `captureWaitLine(name, 0)`; at each completed
  wobble set `captureWaitLine(name, i)`; the message box's `this.typing` is marked
  complete so `update()` does not run the typewriter on this frame
  (`revealAll(beginTypewriter(text))` is the shipped way to show text at once).
- `name` is the enemy's active fighter name — the same value the log's
  `{name}` carries (`this.enemyFighters[0].name` after the capture event is applied).
- At `settle` the box shows the frame's own message (the string `battleMessage` already
  produced for the frame) and `this.captured = beat.held`.
- On a failure the ball **opens** at the `break` tick: if the item-icon atlas carries an
  open-ball frame, swap to it; otherwise hide the ball plus a short flash (alpha tween
  `1 → 0.2 → 1` over `stepMs`). Keep the open-ball lookup a small local helper; do not
  add a data file.
- The `capture` frame's dwell is `timeline.totalMs + MESSAGE_HOLD_MS` instead of
  `MESSAGE_HOLD_MS`: add one field (e.g. `private frameHoldMs = MESSAGE_HOLD_MS`) set in
  `showFrame` (reset to `MESSAGE_HOLD_MS` for every other frame) and read by `update()`.
- Input during the beat completes the whole reveal in one step — final line printed,
  tweens stopped, ball at rest (success) or open/visible per the failed case,
  `this.captured` set — and the frame then holds normally from that moment; the next
  press advances it as today. Never a partial state (no half-typed line, no ball mid-air).
- Every other frame keeps typing exactly as today.

**Dev-only probe (required, so the beat is measurable).** In `create()`, after the
scene's own setup, expose the scene for the browser harness — and only on a dev build:

```ts
if (IS_DEVELOP) (globalThis as Record<string, unknown>).__pkmBattle = this;
```

`IS_DEVELOP` is `src/dev/env.ts`'s build-time constant (`ENVIRONMENT === 'develop'`), so
Vite drops the branch from a production build. Remove it on the scene's `shutdown`
event (`delete (globalThis as Record<string, unknown>).__pkmBattle`) so a destroyed
scene is never read. Nothing else about the probe: no new file, no API surface, and no
other module may read `__pkmBattle`.

## 🧩 Data and configuration

No new data file, no balancing value, no run field. The amplitudes stay ±22°, the
**count** is the signal, and no RNG draw moves (`D11`).

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including `src/ui/capture.test.ts`.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only origin/main...task-118` — must list only the exclusive paths.
  - The two `[live]` criteria need the dev build (`npm run dev`, port 5175) driven over
    CDP by the Orchestrator/QA; they are written so the measurement is a number.

- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean (`npm run build`).
  - [ ] `[unit]` `captureTimeline(shakes, success)` for shakes 0-4: one `shake` tick per
        wobble, `break` present exactly when `success === false` and always before
        `settle`, `settle` is the last tick at `at === totalMs`, and `totalMs` equals
        `throwMs + dropMs + shakes * 3 * stepMs + (failed ? stepMs : 0)`.
  - [ ] `[unit]` `captureBeat(0, false)` is `{ shakes: 0, held: false }`;
        `captureBeat(-3, false)` and `captureBeat(1.9, false)` read 0 / 1;
        `captureBeat(9, false)` caps at `CAPTURE_SHAKES`; `captureBeat(0, true)` reads
        `CAPTURE_HELD_SHAKES`.
  - [ ] `[unit]` `captureWaitLine('X', n)` for n = 0,1,2,3,9 has a dot count of 1,2,3,3,3
        (`…` counts as one dot) and always starts with `X`.
  - [ ] `[unit]` The new key exists in `en.ts` and `es.ts` and `src/i18n/index.test.ts`'s
        font and param guards are green.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` **Zero-shake break plays no wobble.** On the dev build (`npm run dev`),
        driving `captureTimeline(0, false)`'s beat through the scene, sampling
        `__pkmBattle.captureBall.angle` every 30 ms from the capture event until
        `settle` records **no** reading with |angle| ≥ 20, the ball ends not visible
        mid-air (hidden or open), and the message box reads the wait line first and then
        the `shakes0` line (`Oh no! … broke free!`).
  - [ ] `[live]` **Three-shake break ticks three times.** Driving the beat for
        `captureTimeline(3, false)`, the same sampling records exactly **three**
        excursions to |angle| ≥ 20, the message box's text grows by exactly one dot per
        wobble (1 → 2 → 3 dots, never four), and at `settle` it reads the `shakes3` line
        (`… was so close, too!`); the frame's dwell is at least `totalMs` before the next
        frame is shown. Report the sampled angles, the three lines and the dwell in ms.

## 📣 Coordination

- For the Architect: `src/ui/capture.ts` still exports `captureBeat`; Task-118 adds
  `captureTimeline`, `captureWaitLine` and the three timing constants. No other task in
  the batch reads them.
- For the next batch: the wait key `battle.log.captureWait` is authored; a future task
  that changes the capture screen (out of scope here) reuses `captureTimeline` and does
  not re-derive durations.

## ⛔ Out of scope

- The catch formula, `attemptCapture`, `catchValue`, the five final lines and their keys
  (`[Task-114]`, shipped).
- The capture **screen** (the full-screen summary) and the release beat.
- The player's text-speed setting: it governs prose, and this line is punctuation — it
  bypasses the typewriter by design.
- Any sound cue, any new atlas frame, any change to `src/engine/**`, `src/ui/feed.ts`,
  `src/ui/typewriter.ts` or `src/assets/**`.

## ✅ Definition of done

1. `npm test` and `npm run build` green in `../wt-pkm-118`.
2. Only the exclusive paths appear in `git diff --name-only origin/main...HEAD`.
3. Commit the work, then leave an **empty** commit on the tip and push:
   `git commit --allow-empty -m "dev: done task-118"` followed by
   `git push origin task-118`. The branch tip must read `dev: done task-118` when you
   report; `git ls-remote origin task-118` must show the same sha you pushed.
