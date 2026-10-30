# Spec: Task-226 — the battle's HP, faint and stat-stage beat follows the turn's own order

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene + pure HUD projection.
- **Role:** Dev.
- **Objective:** today the battle's DOM HP boxes, faint and stat-stage chips are
  emitted from the **finished** `BattleState` as soon as the command is submitted, so
  both bars read the turn's last HP, both faints drop together and the chips are up
  before their lines. After this task the scene owns the **snapshot the boxes paint**
  (display HP, display status and a display boost vector per slot) and the HUD takes
  that snapshot; every change lands on the frame whose line the engine wrote, in the
  engine's own resolution order (the faster side's line and drop precede the slower
  side's reply). A turn that changes no HP paints no change.
- **Environment:** worktree `../wt-pkm-226`, branch `task-226`.
- **Dependencies:** none.

### Exclusive paths (single writer)

- `src/scenes/BattleScene.ts`
- `src/ui/hud/state.ts`
- `src/ui/hud/state.test.ts`
- `docs/design-spec.md` — **§4 only** (the battle's own section; another batch-mate
  owns §2 and §3, so do not touch them).
- `src/ui/hud/panels/battle-hp/README.md`

Nothing outside this list. No new files: the snapshot logic lives in
`src/ui/hud/state.ts` beside the projection it feeds, so no folder README moves.

### Inputs (read-only)

- `docs/design-spec.md` §4 (the battle panels' paragraph).
- `src/ui/hud/panels/battle-hp/view.ts` and its `README.md` — how the box reads
  `hpFraction` and `stages`.
- `src/ui/hud/panels/battle-log/view.ts` — `feedStep` and the dwell rules.
- `src/ui/feed.ts` — `battleFrames` closes one frame per text line.
- `src/engine/battle/state.ts` — `BattleEvent` (the `boost` event has **no**
  `fighterId`: `{ kind: 'boost'; side; stat; stages }`), `activeFighter`.
- `src/engine/battle/turn.ts` 1330-1350 and `order.ts` — the resolution order the log
  already carries.
- `src/engine/battle/harness.ts` — `scriptedBattle` for the fixed-seed tests.
- `design/frames/05-battle-hud.json` + `design/screens/05-battle-hud.png` — caption
  `05 Battle HUD`; and `design/frames/m05-battle-hud.json` +
  `design/screens/m05-battle-hud.png` — caption `M 05 Battle HUD`. They are read-only:
  this task changes no geometry the board draws.

## 🔒 Contract

### `src/ui/hud/state.ts`

```ts
export type HudBattleSlotDisplay = Readonly<{
  hp: number;
  maxHp: number;
  status: StatusId | null;
  boosts: Readonly<Record<BoostId, number>>;
}>;

/** Two slots per side, in field order; `null` is an empty slot. Plain data. */
export type HudBattleDisplay = Readonly<
  Record<SideId, readonly (HudBattleSlotDisplay | null)[]>
>;

/** The snapshot a battle starts from: each live slot's hp, status and boosts. */
export function battleDisplayOf(battle: BattleState): HudBattleDisplay;

/** Applies one frame's events to the snapshot. Pure: never mutates `display`. */
export function advanceBattleDisplay(
  battle: BattleState,
  display: HudBattleDisplay,
  events: readonly BattleEvent[],
): HudBattleDisplay;
```

- `advanceBattleDisplay` handles `damage` and `heal` (write `hp`, `maxHp`),
  `status`, `cure`, `boost` (`boosts[stat]` is the event's absolute `stages`, not a
  delta), `faint` (`hp = 0` on that slot, keep maxHp/status/boosts as they were) and
  `switch` (the incoming fighter's hp/status/boosts onto its slot). Every other
  event kind is a no-op. Events out of order within a frame are applied in order.
- **Slot resolution.** A single battle has one slot per side: always slot 0. In a
  double, a `damage`/`heal` event carries only its side (no slot, no fighterId), so
  pick the slot whose current displayed `hp` differs from the event's `hp` by the
  event's `amount`; if two or none match, the slot whose `maxHp` equals the event's
  `maxHp`; if neither resolves, slot 0. `switch`/`faint` carry `fighterId`: find the
  fighter in `battle.sides[side].party` and use the slot the display already points
  at for it (its hp/maxHp/status match), else slot 0 for the lead and slot 1 for
  `secondActiveIndex`. Keep the existing doubles behaviour: the shipped scene's
  `damageSlot`/`statusEventSlot` heuristics are the reference, not a new rule.

### `HudProjection` (compatible extension)

The battle arm gains an **optional** `display`:

```ts
| Readonly<{
    screen: 'battle';
    battle: BattleState;
    canCapture: boolean;
    /** The beat the boxes paint. Omitted ⇒ the live state (headless fixtures). */
    display?: HudBattleDisplay;
  }>
```

- `projectBattle(battle, canCapture, display?)` paints each **active** row's `hp`,
  `hpFraction`, `status`, `statusLabel` and `stages` from `display[side][slot]` when
  a display is given; species, name, level, gender, shiny, `fighterId`, `moves`,
  `canSwitchTo` and every off-field party row still come from the live state.
- `canSwitchTo` and `switchablePartyIndices` are untouched: the command gate is the
  live state's, never the beat's.
- With no `display`, the output is byte-for-byte today's (all 20 existing
  `projectHud({ screen: 'battle', ... })` call sites in `state.test.ts` and
  `battle-hp/view.test.ts` keep compiling untouched; you update only the ones in
  `state.test.ts` where the new tests need it).
- `HudBattle` shape does not change; `syncHud` and `projectHud` stay pure.

### `src/scenes/BattleScene.ts`

- Replace the per-slot `displayHp`, `displayHp2`, `displayStatus`, `displayStatus2`
  stores with **one** `private display: HudBattleDisplay`, initialised with
  `battleDisplayOf(this.state)` when the battle is created (and re-derived at the
  start of a double turn for the two second slots, as `resolveDoubleTurn` does today).
- `showFrame()` applies the frame's events to the snapshot with
  `advanceBattleDisplay(this.state, this.display, frame.events)` **before**
  `refreshHud()`. `refreshHud()` passes it:
  `syncHud({ screen: 'battle', battle: this.state, display: this.display, canCapture })`.
- `applyEvents` keeps its sprite/audio work. `displayActive`/`displayActive2` stay
  (they are what `showMon` and the sprite visibility read); `setDisplayHp`,
  `setDisplayStatus` and `setDisplayActive` become writes into `this.display`, and
  every sprite read that used `this.displayHp[...]` reads the snapshot instead. Do
  not change any sprite, tween, cue or capture beat.
- `boost` is a real event: its chip moves on its own frame, never before it.
- A slot whose HP does not move on a frame paints nothing: `advanceBattleDisplay`
  returns the same `hp`, so no re-paint is triggered by comparison.

- **Determinism:** reads no RNG, moves no draw. The engine's log and order are
  untouched; this task only decides **when** the HUD paints what the log already
  says.

## 🧩 Data and configuration

No new data, no new key, no state field, no `SAVE_VERSION` step. The snapshot is
presentation only and is not persisted.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task
    adds in `src/ui/hud/state.test.ts`.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-226` audited against the exclusive paths.
- **Acceptance criteria:**
  - [ ] `[unit]` `battleDisplayOf` on a fresh `createBattle`/`scriptedBattle` returns
        each live slot's hp, maxHp, status and a zeroed boost vector.
  - [ ] `[unit]` a fixed-seed `scriptedBattle` whose faster foe hits first, split with
        `battleFrames`: applying the frames in order, after the frame whose line is
        the foe's attack the foe's HP is unchanged and the player's equals the HP that
        line reports (`damage.hp`); after the player's reply frame the foe's HP equals
        its own `damage.hp`. The first frame's player HP still reads the pre-turn HP.
  - [ ] `[unit]` a `boost` event moves `boosts[stat]` to the event's absolute
        `stages` on its own frame and on no earlier one.
  - [ ] `[unit]` a `faint` frame sets that slot's `hp` to 0 and leaves the other
        side's HP untouched; a `switch` event repoints the slot to the incoming
        fighter's hp/status/boosts.
  - [ ] `[unit]` a turn that emits no `damage`/`heal`/`status`/`boost` leaves
        `advanceBattleDisplay` returning a deep-equal snapshot.
  - [ ] `[unit]` `projectBattle` with a display paints `hpFraction` from the display
        and keeps the live species/level/party rows; with no display the output
        equals the live projection.
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` at 1280×800 with `?hud=dom`, in a wild battle started from the debug
        overlay (`startDebugWildBattle('pidgey', 5)`, FOE FASTER so the foe's line is
        first): sample `[data-hud-hp="player-0"]` and `[data-hud-hp="enemy-0"]`'s
        inner fill width every animation frame from the FIGHT press. **Measurement:**
        before the first revealed feed line, both widths equal their pre-turn widths
        (±1 px); from then on, each side's width changes only after a line that
        reports damage to that side, and its final width equals the fill computed
        from the last `hp` that side's lines report (fraction × track width, ±1 px).
  - [ ] `[live]` in the same battle a `boost` line (use a move that raises a stage, or
        the debug battle's own scripted turn) shows its chip on the frame of the
        line and not before: the `[data-hud-stage]` row count is unchanged at the
        press and gains its chip on the line's frame.
- **A `[live]` that compares pixels is not a criterion** (`D57`): the checks above
  read DOM rects, text and widths, never a screenshot.

## 📣 Coordination

- For the next batch: `src/ui/hud/state.ts` exports `HudBattleSlotDisplay`,
  `HudBattleDisplay`, `battleDisplayOf` and `advanceBattleDisplay`, and the battle
  projection accepts `display?: HudBattleDisplay`. Batch 98's `[Task-227]` times the
  frames on top of this beat: it must read the snapshot the scene passes, never the
  live state.
- For the Architect: the `boost` event has no `fighterId`; the doubles slot rule is
  the scene's shipped heuristic lifted into the pure function.
- The box's own README rule 4 gains the sentence "the box reads the beat, never the
  finished turn".

## ⛔ Out of scope

- No change to `src/ui/feed.ts`, the log dwell, `HIT_FRAME_MS` (that is
  `[Task-227]`), the panels' geometry, the battle engine, or the capture beat.
- No new file, no new panel, no new key and no `SAVE_VERSION` step.
