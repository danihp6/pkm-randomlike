# Spec: Task-168 — Dig and Dive dodge on the charge turn, and the second turn never asks for a command

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule (pure logic) + one Phaser scene edit + docs.
- **Role:** Dev.
- **Objective:** after this task a fighter that is *hiding* while a two-turn move
  charges — Dig, Dive, Fly, Bounce, Phantom Force, Shadow Force — cannot be hit by a
  move aimed at it, except by the cartridge's four counters (Earthquake and Magnitude
  against Dig, Gust and Twister against Fly/Bounce, which connect and do **double**
  damage); and the battle screen stops opening its command menu on the second turn of
  any two-turn move, because it submits the locked move itself from `finishFeed`.
  Today both things are missing: nothing marks the fighter as unreachable on the
  charge turn, and the scene asks the player for a second command that the engine
  then throws away (`chosenMove` re-locks the charge move, `src/engine/battle/turn.ts`
  768-775).
- **Environment:** worktree `../wt-pkm-168`, branch `task-168`.
- **Dependencies:** none. Every file this task reads is already merged on `main`
  (`main` @ `f211850`): the charge block in `turn.ts` (1048-1059), the
  `Volatiles.charging` sibling in `fighter.ts` (58-59), `emptyVolatiles()`
  (`fighter.ts` 303-370) and the command builders in `commands.ts`.

### Exclusive paths (single writer)

Nothing outside this list. No other task in the batch claims any of these.

- `src/engine/battle/turn.ts` — the batch's only claimant.
- `src/engine/battle/fighter.ts`
- `src/engine/battle/volatile.ts`
- `src/engine/battle/commands.ts`
- `src/engine/battle/turn.test.ts`
- `src/engine/battle/fighter.test.ts`
- `src/engine/battle/volatile.test.ts`
- `src/engine/battle/commands.test.ts`
- `src/scenes/BattleScene.ts` — the batch's only claimant.
- `docs/battle-spec.md` **§4 only** ("Status and volatility", today lines 235-381,
  ending before `## 5. Permadeath`). `docs/battle-spec.md` is shared with Task-172 in
  this batch: **Task-172 writes §11.1 (today lines 718-733) and this task must not
  touch a line of it.** Touch nothing outside §4 in that file.

No file is added, renamed or deleted, so no folder `README.md` changes.

### Inputs (read-only)

- `AGENTS.md`.
- `docs/battle-spec.md` §4 (the section this task rewrites) and §1
  (lines 6-27, the shape of a turn).
- `src/engine/battle/turn.ts` (the file being edited — read it whole first).
- `src/engine/battle/fighter.ts`, `src/engine/battle/volatile.ts`,
  `src/engine/battle/commands.ts`.
- `src/engine/battle/state.ts` (`BattleState`, `pushText`, `opponentOf`, `SideId`).
- `src/engine/battle/modifiers.ts` (`rollHitWith`), `src/engine/battle/damage.ts`
  (`computeDamage`), `src/engine/battle/effects/registry.ts`.
- `src/data/dex` accessors (`getMove`, `Move`, `Move.flags.charge`).
- `src/i18n/en.ts` (`battle.log.missed` — already present, do not add keys).
- `src/scenes/BattleScene.ts` (the scene being edited).

Rules that hold for every path above: no Phaser import and no DOM access in
`src/engine/`, no `Math.random()`, no `Date.now()`, no new RNG stream, no new
dependency, no new i18n key.

## 🔒 Contract

### TypeScript

`src/engine/battle/fighter.ts` — one new volatile, sibling of `charging` (today
line 58-59) and initialised in `emptyVolatiles()` (today line 319, right after
`charging: null`):

```ts
export type Volatiles = {
  // ... every shipped field unchanged ...
  /** The move a charge turn is hiding behind (Dig, Fly...), or null when reachable. */
  semiInvulnerable: string | null;
};
```

`src/engine/battle/volatile.ts` — the whole dodge rule as pure data and one pure
function. Frozen names:

```ts
/** The charge moves whose charge turn takes the user off the field. */
export const SEMI_INVULNERABLE_CHARGES: ReadonlySet<string>;

/** For each of those moves, the move ids that still connect — and double. */
export const SEMI_INVULNERABLE_COUNTERS: Readonly<Record<string, readonly string[]>>;

/** The multiplier a counter move's damage takes. */
export const SEMI_INVULNERABLE_COUNTER_MULTIPLIER = 2;

export type SemiInvulnerableOutcome = 'miss' | 'hit' | 'double';

/**
 * What a move aimed at `defender` does this turn: 'miss' when it cannot reach a
 * hiding fighter, 'double' when it is one of that move's counters, 'hit' otherwise.
 * Reads no RNG and mutates nothing.
 */
export function semiInvulnerableOutcome(
  defender: BattleFighter,
  move: Move,
): SemiInvulnerableOutcome;
```

Exact contents:

- `SEMI_INVULNERABLE_CHARGES` = `new Set(['dig', 'dive', 'fly', 'bounce', 'phantomforce', 'shadowforce'])`.
- `SEMI_INVULNERABLE_COUNTERS` =
  `{ dig: ['earthquake', 'magnitude'], fly: ['gust', 'twister'], bounce: ['gust', 'twister'] }`.
  An entry with no counters must not be listed (`dive`, `phantomforce`,
  `shadowforce` stay absent; a missing key means "nothing connects").
- `semiInvulnerableOutcome(defender, move)`:
  1. `const hiding = defender.volatiles.semiInvulnerable;`
  2. `if (hiding === null) return 'hit';`
  3. `return (SEMI_INVULNERABLE_COUNTERS[hiding] ?? []).includes(move.id) ? 'double' : 'miss';`

`src/engine/battle/commands.ts` — one new exported predicate, next to
`replacementOwed` (today line 242), same style (pure, no RNG, no DOM):

```ts
/**
 * The locked command a charging fighter answers by itself, or null when it must
 * choose: null when the battle is over, when the side owes a replacement, when its
 * lead is not charging, or when the locked move is no longer in its moveset.
 * Ignores PP, Taunt and Disable on purpose — the engine's own charge lock
 * (`chosenMove`) already ignores the chosen command.
 */
export function chargingCommand(state: BattleState, side: SideId): FightCommand | null;
```

Body, exactly:

```ts
if (state.winner !== null) return null;
if (state.sides[side].awaitingReplacement) return null;
const fighter = activeFighter(state, side);
const charging = fighter.volatiles.charging;
if (charging === null) return null;
const moveIndex = findMoveIndex(fighter, charging);
if (moveIndex < 0) return null;
return { type: 'fight', moveIndex };
```

It reads slot 0 only (`activeFighter(state, side)`), like `replacementOwed` reads the
player side only, and returns no `slot`, `mega` or `gmax` field.

`src/engine/battle/turn.ts` — three integration points, no new RNG draw:

1. **Set the volatile on the charge turn.** Inside the `move.flags.charge` block
   (today 1048-1059), in the branch that returns after the charge line (today
   1049-1057), after `attacker.volatiles.charging = move.id;` (today 1050):

   ```ts
   attacker.volatiles.semiInvulnerable = SEMI_INVULNERABLE_CHARGES.has(move.id) ? move.id : null;
   ```

   The "fire" branch (today 1058, `attacker.volatiles.charging = null;`) also sets
   `attacker.volatiles.semiInvulnerable = null;`. Charge moves that do not hide
   (Solar Beam, Solar Blade, Meteor Beam, Electro Shot, Sky Attack, Freeze Shock,
   Ice Burn, Razor Wind) therefore always leave the field `null`, and a fighter that
   swaps from a hiding charge to a non-hiding one cannot carry a stale value.

   **Invariant (assert it in the test):** the two fields are written in the same two
   statements, so at every point outside `resolveMove`'s charge block
   `semiInvulnerable === charging` holds for a hiding move and both are `null`
   otherwise. Nothing else may clear or set either one; a charge lock that outlives
   its second turn (the shipped behaviour when the move keeps failing) therefore keeps
   hiding exactly as long as it keeps the lock, and never one turn longer.

2. **Dodge in the aim loop.** In `resolveMove`, inside `for (const aim of aims)`
   (today 1123), **after** `protectStops` (today 1125) and **before** the
   `lockedOn`/`rollHitWith` block (today 1127-1131):

   ```ts
   const hiding = aim.side === side ? 'hit' : semiInvulnerableOutcome(defender, move);
   if (hiding === 'miss') {
     pushText(state, 'battle.log.missed', { name: attacker.name });
     continue;
   }
   ```

   Two consequences that are part of the contract, not an accident:
   - a dodged move spends **no** accuracy roll, because the check runs before
     `rollHitWith` — so no shipped fixed-seed battle log moves (no test outside this
     task's list may need re-pinning);
   - a self-aimed move is never dodged by its own user (`aim.side === side`).

3. **Double the counter's damage.** In the damage branch, immediately after
   `let damage = runModifyDamage(...)` (today 1284-1290):

   ```ts
   if (hiding === 'double') damage = damage * SEMI_INVULNERABLE_COUNTER_MULTIPLIER;
   ```

   `hiding` is the per-aim value computed in step 2 (compute it once per aim and
   reuse it; do not recompute it per hit — a multi-hit counter must double every
   hit). The message text is unaffected (`damageMessage`, today line 261, prints
   effectiveness and crit only).

`src/scenes/BattleScene.ts` — one branch in `finishFeed` (today lines 1819-1842);
add `chargingCommand` to the existing import from `../engine/battle/commands`
(today lines 16-23). Insert between the two `pending` branches and the closing
`this.openMenu()` (today 1841):

```ts
// A charging fighter answers its own second turn: the engine locks the move and
// discards a command anyway, so no menu is opened for it.
if (!this.double) {
  const locked = chargingCommand(this.state, 'player');
  if (locked) {
    this.submit(locked);
    return;
  }
}
```

`this.double` is the scene's own field (today line 465). Double battles keep the
shipped behaviour and are out of scope.

**Determinism:** this task adds **no** RNG draw — not one `rng.next()`, not one new
stream and not one new seed key. The dodge is decided from state before any roll and
the counter path takes the ordinary accuracy roll it already took. The fixed-seed
regression the batch owes is therefore a *behaviour* regression on two pinned seeds
(below), not a re-pin: nothing else in the suite may need its expectations moved.

### Data

- One `Volatiles` field: `semiInvulnerable: string | null`, default `null`, holding a
  **move id** (the dex id, e.g. `'dig'`), exactly like `charging`.
- No save field: `SAVE_VERSION` stays **25**. `Volatiles` is battle-only
  (`FighterSnapshot` drops it, `clearVolatiles`/`resetBattleState` rebuild it), so
  nothing is persisted.

## 🧩 Data and configuration

No JSON, no balancing table and no i18n key is added. The move ids and the four
counter pairs are the cartridge's, and they live in `volatile.ts` as the two frozen
constants above — not in `src/data/`, because they are a rule about the dex's own
`flags.charge`, not a tunable. The counter multiplier is the named constant
`SEMI_INVULNERABLE_COUNTER_MULTIPLIER = 2`, never a literal `2` at the call site.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-168` audited against the exclusive paths list.
  - One `[live]` criterion exists, so QA owes one browser pass; the `[unit]` ones cost
    seconds.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean (`npm run build`).
  - [ ] `[unit]` `npm test` is green in full, with no expectation moved outside this
        task's four test files (proves the dodge spends no accuracy roll).
  - [ ] `[unit]` `npm test -- volatile` proves the pure rule:
        `semiInvulnerableOutcome` answers `'hit'` for a fighter whose
        `semiInvulnerable` is `null`; `'miss'` for each of the six charges against an
        unrelated move; `'double'` for `earthquake` and `magnitude` against
        `semiInvulnerable: 'dig'`, and for `gust` and `twister` against `'fly'` and
        `'bounce'`; `'miss'` for `earthquake` against `'dive'`. Also
        `SEMI_INVULNERABLE_CHARGES.size === 6` and
        `SEMI_INVULNERABLE_COUNTER_MULTIPLIER === 2`.
  - [ ] `[unit]` `npm test -- fighter` proves `emptyVolatiles().semiInvulnerable` is
        `null` and that a fighter built by `createFighter` carries it.
  - [ ] `[unit]` `npm test -- turn` proves the two seeded behaviours, each pinned to a
        literal seed inside the test (search 1..200 while writing, then hard-code the
        first seed that satisfies it; the test asserts the pinned seed so a re-run is
        deterministic):
        1. **The Dig dodge.** Player knows `dig` and `tackle`, foe knows `tackle`.
           Turn 1: player `dig`, foe `tackle` → `volatiles.charging === 'dig'`,
           `volatiles.semiInvulnerable === 'dig'`, the log holds a `battle.log.missed`
           text and the player's HP is unchanged. Turn 2: the player's command is
           anything (e.g. `tackle`) → both `charging` and `semiInvulnerable` are
           `null` (assert the invariant `semiInvulnerable === charging`), the player's
           HP drops (the foe's Tackle lands) and the foe's HP drops (Dig fired).
        2. **The counter still hits.** Player charges `dig`, foe uses `earthquake` →
           no `battle.log.missed` from the foe, and the player's HP dropped. Add a
           control battle with the same two fighters and the same seed where the foe
           uses `tackle` instead: the `earthquake` battle's single damage event on the
           player is **strictly greater** than the control's (the doubling), and both
           are recorded as fixed-seed regressions.
  - [ ] `[unit]` `npm test -- commands` proves `chargingCommand`: `null` when the lead
        is not charging; `{ type: 'fight', moveIndex: 0 }` (exact equality, no `slot`,
        no `mega`, no `gmax` key) while `charging === 'dig'` and `dig` is slot 0;
        the slot index of the charge move when it sits at index 2; `null` when the
        charging move is not in the moveset; `null` when
        `state.sides.player.awaitingReplacement`; `null` when `state.winner` is set.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched
        (`git diff --name-only main...task-168`), and in particular the diff of
        `docs/battle-spec.md` is inside §4 only (`git diff main...task-168 --
        docs/battle-spec.md` touches no line ≥ 382).
  - [ ] `[live]` **The menu never opens on turn two.** Measured over CDP on the live
        canvas (`renderer.snapshotArea` + `getImageData`) of a dev server
        (`npm run dev -- --port <free> --strictPort`) at **1280×800** (the
        non-compact layout: below 700 px the boxes move and these rects are void),
        with the battle scene in a **single** battle: in the dev-only `#debug-menu`,
        give the starter `dig` (party editor, `moves`), then start a wild battle.
        Take **A** = `renderer.snapshotArea(36, 582, 1208, 192)` on the first command
        menu (the FIGHT/BAG/SWITCH/RUN grid; that rect is the menu box,
        `box = {x: 36, y: 582, w: 1208, h: 192}`), once the prompt has finished typing
        — confirm it is static by taking two A samples 500 ms apart and requiring them
        to be byte-identical, and use the second. Click FIGHT and DIG with the
        pointer, then send **no further input at all** and take **B** =
        `renderer.snapshotArea(36, 582, 1208, 192)` six seconds later. Pass when
        **B is not byte-identical to A** (the second turn ran itself and the box moved
        on to the Dig line) — before the fix B is pixel-identical to A, because the
        same grid reopens on the same prompt and nothing in that rect animates. Report
        the differing-pixel count and the two sample times with the verdict.

## 📣 Coordination

- **For Task-172 (same batch):** `docs/battle-spec.md` is shared by section only —
  this task writes §4 (lines 235-381 today) and Task-172 writes §11.1 (lines
  718-733). Do not reflow, renumber or touch §11.1; Integration QA checks the
  combined file for lost lines.
- **For the next batch:** `Volatiles.semiInvulnerable` and
  `semiInvulnerableOutcome` already exist, so no later task may invent a second
  dodge flag; a move that must reach a hiding fighter is a new entry in
  `SEMI_INVULNERABLE_COUNTERS`, not a new function. `chargingCommand(state, side)`
  is the one entry point for "this side does not choose this turn", and it is the
  model any future auto-command rule (Encore, Gorilla Tactics, a two-turn lock)
  should follow rather than a second predicate.
- **For the Orchestrator:** double battles keep the old behaviour on purpose (the
  scene's `submitDouble` collects slot commands and a slot-1 lock would need a
  second auto-submit path); that is a follow-up task, not a defect in this one.
- **Known read-only neighbours.** `src/engine/battle/effects/moves.test.ts` (its charge
  rows are Solar Beam, which does not hide) and
  `src/engine/battle/moveAudit.test.ts` (its board's enemy uses `splash` by default)
  both exercise `takeTurn` and are **not** this task's to edit: the dodge must leave
  them green. If either goes red, stop and report it as a spec deviation instead of
  editing it — that would mean the dodge needs a narrower condition than the Contract
  above, which is an Architect decision.

## ⛔ Out of scope

- No Power Herb / "charge instantly" item, no `ui` text, no new `battle.log.*` key.
- No No Guard / Lock-On interaction with semi-invulnerability (the cartridge lets No
  Guard ignore it; this task does not).
- No AI change: `chooseAiCommand` / `preview.ts` keeps scoring a hiding target as if
  it were reachable, so the AI may fire a move that then misses. That is accepted.
- No double-battle auto-command, no `takeDoubleTurn` change.
- No `FighterSnapshot`, save, `SAVE_VERSION` or `src/data/` change.
- No touching `src/data/dex/**`, `package.json`, or any path in another task's list
  (`src/data/tilesets/props.ts`, `src/ui/evolutionGraph.ts`, `src/i18n/*`).
