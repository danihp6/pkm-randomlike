# Spec: Task-156 — The double-battle roll: 25 % for the boss, 10 % for the mini-boss

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** data + engine-pure helper + one scene seam + docs.
- **Role:** Dev.
- **Objective:** Whether a floor's hand-placed fight fields **two actives per side** is
  a **roll of the run's own seed**, not a constant: **25 %** for the map boss and **10 %**
  for the mini-boss. `BOSS_PARTY[kind].double` (a boolean) becomes
  `BOSS_PARTY[kind].doubleChance` (a probability), and one pure helper beside the table
  answers the roll from a stream of its own,
  `hashSeed(`${seed}:double:${kind}:${mapIndex}:${routeKey}`)`, so no existing draw
  moves and a replay rebuilds the same answer. The mini-boss's trainer launch starts
  carrying the flag the boss room already carries; the screen, the second slot, the
  target step and the AI need no change, because all of them read `BattleLaunch.double`.
- **Environment:** worktree `../wt-pkm-156`, branch `task-156`.
- **Dependencies:** none. The `double` path ships end to end (`[Task-107]`'s engine
  rule, `[Task-108]`'s screen); this task only changes where the flag comes from.

### Exclusive paths (single writer)

Nothing outside this list. No other task in this batch claims any of these paths.

- `src/data/bosses.ts`
- `src/data/bosses.test.ts`
- `src/scenes/RouteScene.ts` (**this task is the batch's only writer of it** — it is a
  hot file; Task-154 and Task-157 must not appear in its diff)
- `docs/battle-spec.md` §12 "Double battles" — **only** §12
- `docs/maps-spec.md` §6 "Boss & portal (D31)" — **only** §6

### Inputs (read-only)

- `src/engine/rng.ts` (`hashSeed`, `Rng`, `Rng.split`) — read only, never edited
- `src/engine/run/battleLink.ts` (`BattleLaunch.double`, `WildTrigger`, `TrainerTrigger`)
- `src/engine/battle/state.ts` (`BattleSetup.double`, `DOUBLE_ACTIVES`' consumer)
- `src/engine/maps/progress.ts` (`bossTrainerId`, `miniBossTrainerId`)
- `src/scenes/BattleScene.ts` — **read-only for every task in this batch**
- `AGENTS.md`

**Do not touch anything under `src/engine/run/`.** That whole tree belongs to
Task-154 in this batch; this task's pure helper lives in `src/data/bosses.ts` and
only *reads* `hashSeed` from `src/engine/rng.ts`.

## 🔒 Contract

### TypeScript — `src/data/bosses.ts`

```ts
import { hashSeed } from '../engine/rng';

/** Which of a floor's two hand-placed fights a party size belongs to. */
export type BossPartyKind = 'boss' | 'miniboss';

/** One kind's fixed party: its sizes and the chance its fight is a double battle. */
export type BossPartyRow = Readonly<{
  firstMap: number;
  size: number;
  /** Probability in `0..1` that this kind's fight fields two actives per side. */
  doubleChance: number;
}>;

export const BOSS_PARTY: Readonly<Record<BossPartyKind, BossPartyRow>> = {
  boss: { firstMap: 3, size: 6, doubleChance: 0.25 },
  miniboss: { firstMap: 2, size: 3, doubleChance: 0.1 },
};

/**
 * True when `kind`'s fight on `mapIndex` in `routeKey` is a double battle. Draws from
 * its own stream — `hashSeed(`${seed}:double:${kind}:${mapIndex}:${routeKey}`)` — so no
 * existing draw moves and a replay rebuilds the same answer (D11).
 */
export function bossIsDouble(
  kind: BossPartyKind,
  seed: string,
  mapIndex: number,
  routeKey: string,
): boolean;
```

- `bossIsDouble` is exactly
  `new Rng(hashSeed(\`${seed}:double:${kind}:${mapIndex}:${routeKey}\`)).next() < BOSS_PARTY[kind].doubleChance`
  — one `Rng`, one draw, created inside the call. Import `{ hashSeed, Rng }` from
  `'../engine/rng'` (a data module importing an engine value is the shipped pattern:
  `src/data/gates.ts` imports from `src/engine/map.ts`).
- `routeKey` is the room's own key, spelled `` `room:${roomId}` `` by the caller
  (`RouteScene`), so the same floor's boss answers the same way on every visit and from
  a reload.
- `bossPartySize(kind, mapIndex)` is **unchanged** (map 1 fields `firstMap`, every map
  from 2 on fields `size`). `DOUBLE_ACTIVES` stays `2`.
- **`double` is deleted from the row type.** Nothing may keep reading it.

### TypeScript — `src/scenes/RouteScene.ts`

Three edits, all in this file:

1. `type BattleExtras` (line 432) gains the optional flag:

```ts
type BattleExtras = Readonly<{
  noFlee?: boolean;
  enemyBoosts?: Partial<Record<BoostId, number>>;
  /** The fight rolls (or was told) two actives per side (`docs/battle-spec.md` §12). */
  double?: boolean;
}>;
```

2. `startTrainerBattle` (lines 2766-2806) passes the roll for **both** hand-placed
   kinds. Next to the roster key it already builds (lines 2782-2787), add:

```ts
    const roomKey = this.room ? `room:${this.room.roomId}` : '';
```

   and pass it as `startBattle`'s **second argument** (the trigger object itself is
   untouched — `double` is a launch extra, not a trigger field):

```ts
    this.startBattle(
      {
        kind: 'trainer',
        trainerId: trainer.id,
        trainerName: archetype.name,
        roster: withForcedAbility(roster, archetype),
        archetypeId: archetype.id,
      },
      {
        ...(kind !== null && mapIndex !== null
          ? { double: bossIsDouble(kind, this.run.seed, mapIndex, roomKey) }
          : {}),
      },
    );
```

   `kind`, `mapIndex` and `isMiniBoss` are the locals already there (lines 2774-2777) —
   do not recompute them.

3. `startBattle` (lines 3371-3437) replaces the boss-room-only line

```ts
      ...(this.room?.boss === true ? { double: bossIsDouble('boss') } : {}),
```

   with the spread of what the caller decided — the roll is made **once**, in
   `startTrainerBattle`, so a boss room's wild battle and the Mega Stone keeper's stay
   single:

```ts
      ...(extras.double === true ? { double: true } : {}),
```

   Line 3410's comment ("the boss room's battle is the map boss's own — a double battle
   on every floor") is now wrong; rewrite that comment to say the flag is the fight's
   own roll (`src/data/bosses.ts`), carried through `BattleExtras`.

The import on line 35 (`import { bossIsDouble, bossPartySize, type BossPartyKind } from
'../data/bosses';`) keeps its name; only the call arity changes.

Nothing else in the scene changes: `BattleScene` already reads `BattleLaunch.double`
(`createBattle({ ..., double })`), the second slot, the partner menu, the target step
and the AI all read the engine's `double` flag.

### Data

- `BOSS_PARTY.boss.doubleChance = 0.25`, `BOSS_PARTY.miniboss.doubleChance = 0.1`.
- The stream key `\`${seed}:double:${kind}:${mapIndex}:${routeKey}\`` — minted, never
  shared: no other rule reads or advances it.
- No run field, no `SAVE_VERSION` step, no new i18n key.

## 🧩 Data and configuration

Both probabilities are balancing values in `src/data/bosses.ts`, so a future tuning
pass edits the table and nothing else. A `doubleChance` of `0` or `1` is legal and makes
the roll constant (the old behaviour), which is why `bossIsDouble` still goes through
the stream: the shape of the answer never changes when the numbers do.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-156` audit against the exclusive paths list.
  - A task whose criteria are all `[unit]` owes **no** browser pass; **this task owes
    no browser pass** — the roll is a pure function and the launch is read by the
    already-shipped screen.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `src/data/bosses.test.ts` pins the table: `BOSS_PARTY.boss.doubleChance
        === 0.25`, `BOSS_PARTY.miniboss.doubleChance === 0.1`, `firstMap`/`size`
        unchanged (3/6 and 2/3), and `bossPartySize` unchanged for maps 0, 1, 2 and 8.
  - [ ] `[unit]` **The rate.** Over the 10 000 seeds `s0` … `s9999`, with `mapIndex = 3`
        and `routeKey = 'room:5'`, `bossIsDouble` is true for a share of trials that
        rounds to **25 ± 1 points** for `'boss'` and **10 ± 1 points** for `'miniboss'`
        (assert `rate >= 0.24 && rate <= 0.26`, and `rate >= 0.09 && rate <= 0.11`).
  - [ ] `[unit]` **Two fixed seeds.** The test contains, as literals, one `'boss'` seed
        that answers `true` and one that answers `false` on `mapIndex = 3`,
        `routeKey = 'room:5'` (find the first of each in `s0…s99` once, then write the
        value down), and both assertions are exact (`toBe(true)` / `toBe(false)`,
        never `toBeTruthy`).
  - [ ] `[unit]` `bossIsDouble` is **pure and stream-isolated**: the same arguments
        twice return the same boolean; two different `routeKey`s on the same
        `(kind, seed, mapIndex)` do **not** have to agree, and the test proves at least
        one pair of distinct `routeKey`s disagrees (so the room is really part of the
        key).
  - [ ] `[unit]` `git diff main...task-156 --name-only` lists no path outside the
        exclusive list — in particular **no** `src/engine/run/**` file, no
        `src/scenes/BattleScene.ts`, no `package.json`, no `src/main.ts`, no
        `vite.config.ts` and no `src/i18n/*`.
  - [ ] `[unit]` The five docs' sections are the only doc changes: `git diff
        main...task-156 -- docs/battle-spec.md docs/maps-spec.md` shows hunks inside §12
        and §6 only.
  - [ ] `[unit]` `npm test` proves the launch seam: a unit test over the shipped
        `BattleLaunch` type would not see the scene, so instead assert the **contract**
        in `src/data/bosses.test.ts` (the roll) and leave the scene to the typecheck —
        `npm run build` fails if `startBattle`'s `extras.double` is not threaded
        through, because `BattleLaunch.double?: boolean` is optional and the spread
        must be exact.

## 📣 Coordination

- **For the Architect / the plan:** this task holds `src/scenes/RouteScene.ts` alone.
  Task-154 and Task-157 must not appear in that file's diff; if they need a scene
  change they report it instead of making it.
- **For Task-158 (Batch 71):** the boss room's shape becomes `corridor` and its chamber
  sits between the two openings. Nothing here cares: `bossIsDouble` reads the **room
  key and the map index**, not the shape.
- **For `docs/battle-spec.md` §12:** rewrite the **Data** bullet (currently "`BOSS_PARTY[kind]`
  carries `double`: the boss row is `true` … through `bossIsDouble(kind)`") to
  `doubleChance` / `bossIsDouble(kind, seed, mapIndex, routeKey)`, and fix the two
  sentences that still assert a rule — the §12 opening line ("The map boss's fight is a
  **double battle**") and the trailing "screen" paragraph ("`BattleLaunch.double`
  (`true` only for a launch whose room is the boss's)"). Both now describe a roll.
  Every other bullet of §12 (slots, commands, order, moves, faints, partner AI,
  out of scope) is unchanged: the engine did not move.
- **For `docs/maps-spec.md` §6:** add one bullet **after** the "The boss is a fixed,
  themed trainer … fixed party of six" bullet stating that the fight is a double battle
  on **25 %** of floors, that the mini-boss rolls **10 %**, that the answer comes from
  `${seed}:double:<kind>:<mapIndex>:room:<roomId>` and that a one-member party on a
  double fight still degrades to the single layout (`secondActiveIndex = -1`). Do not
  touch §2, §7 or §10.
- **For Task-154 / Task-159:** `docs/battle-spec.md` §7 and §4 are theirs; this task
  writes **only** §12.

## ⛔ Out of scope

- Any engine rule: `BattleSetup.double`, `takeDoubleTurn`, the second slot, the target
  step, the partner menu and `chooseAiCommand` are shipped and untouched.
- Any scene other than the three seams above — `BattleScene.ts` is frozen for this batch.
- Wild battles (always single) and regular trainers (always single).
- A "double battle" chance for a room's own special trainer, a boss **room**'s wild
  battle, or the Mega Stone keeper.
- Re-balancing `BOSS_PARTY`'s sizes, `bossPartySize`, map 1's on-ramp sizes,
  `BOSS_OPENINGS` or any other draw on the floor.
- A save field: the roll is derived, so it stores nothing and takes **no
  `SAVE_VERSION` step** — Task-154, the batch's only save-version step, takes 25.
