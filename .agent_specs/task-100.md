# Spec: Task-100 — the boss room's own rules: a forced opening, a sealed door and a free heal

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule + data + one Phaser scene.
- **Role:** Dev.
- **Objective:** the boss room stops being a quiet leaf that *may* roll a condition.
  After this task every map's boss room (a) **always** starts its battles under one
  row of a new two-sided `BOSS_OPENINGS` table — one row favouring the run, one the
  boss — instead of the retired 30 % `BOSS_BATTLEFIELD_CHANCE` roll, (b) **bars the
  door it was entered through** until its boss falls, and (c) gives the party and
  the box **one free heal** when the room is first built on that floor (HP/PP only,
  never a resurrection). All three are pure engine/data rules with tests; the scene
  only asks, paints and refuses the step.
- **Environment:** worktree `../wt-pkm-100`, branch `task-100`.
- **Dependencies** (all merged on `main`):
  - the room-condition seam of `[Task-62]` — `src/data/battlefields.ts`,
    `src/engine/routes/battlefield.ts` (`roomKindOf`, `roomBattlefield`,
    `battlefieldSeeds`), read and extended here;
  - the second half of the condition table from `[Task-106]` — the seventeen
    `ROOM_BATTLEFIELDS` rows and the six whole-field rules, read (the table's
    **order and length must not change**);
  - `BattleSetup.enemyBoosts` and `BattleLaunch.enemyBoosts` (the exorcist's curse,
    `[Task-94]`) — the shipped one-sided channel this task reuses;
  - the boss/portal layer of `D31` — `src/engine/maps/plan.ts` (`MapPlan.bossRoom`),
    `src/engine/maps/progress.ts` (`roomView`, `bossTrainerId`, `isFinalMap`) and
    `src/engine/run/floors.ts` (`routeIndexForRoom`), read only;
  - `src/engine/run/heal.ts` (`healParty`) and `src/engine/run/state.ts`
    (`isItemPicked`, `markItemPicked`, `pickedItems`), reuse only — **no edit to
    either**.

### Exclusive paths (single writer)

The list of paths this task creates or modifies. **Nothing outside this list.**

- `src/data/bosses.ts`
- `src/data/bosses.test.ts`
- `src/data/battlefields.ts` — delete `BOSS_BATTLEFIELD_CHANCE` only; the
  seventeen `ROOM_BATTLEFIELDS` rows, their order, `ROOM_BATTLEFIELD_CHANCE`,
  `ALL_TYPES_OVERRIDE` and `ROOM_CRIT_STAGE` do **not** move.
- `src/data/battlefields.test.ts`
- `src/data/README.md` — the `bosses.ts` line only.
- `src/engine/routes/battlefield.ts`
- `src/engine/routes/battlefield.test.ts`
- `src/engine/routes/bossRoom.ts` — **new file.**
- `src/engine/routes/bossRoom.test.ts` — **new file.**
- `src/engine/routes/index.ts` — one `export * from './bossRoom';` line.
- `src/engine/README.md` — one clause on the `routes/` line for the new module
  (`src/engine/README.md` rule 5).
- `src/scenes/RouteScene.ts`
- `docs/maps-spec.md` — **§6 in full**, plus **only** the first bullet of §7's
  `### A room's battle condition`. No other section, table or bullet of that file.
- `docs/battle-spec.md` — **§4 only**, and only the paragraph that opens
  "A battle can also **begin** under a condition the room it started in carries"
  (plus, if the dev needs it, one clause inside that same paragraph).

`.agent_specs/` itself is gitignored: do not touch it.

### Inputs (read-only)

Files this task may read, and only these, beyond `AGENTS.md` itself.

- `docs/maps-spec.md`, `docs/battle-spec.md` — the two documents it edits; read §6
  and §7 of the first and §4 of the second before writing a line.
- `docs/tech-decisions.md` — `D5` (permadeath), `D11` (one seed, named streams),
  `D31` (the boss and its portal).
- `src/engine/battle/state.ts` — `BattleSetup.enemyBoosts` (line 211) and the single
  application in `createBattle` (line 272: `applyBoosts(state.sides.enemy.party[0], …)`).
- `src/engine/battle/fighter.ts` — `BoostId` (line 20), `BOOST_IDS` and
  `applyBoosts`; the stage ramp is what a `-1`/`+1` means.
- `src/engine/run/battleLink.ts` — `BattleLaunch.enemyBoosts` (line 78).
- `src/engine/run/heal.ts` — `healParty` (party **and** box, HP/PP only).
- `src/engine/run/state.ts` — `RunState.pickedItems`, `isItemPicked`,
  `markItemPicked` and `advanceMap` (which clears `pickedItems`).
- `src/engine/run/floors.ts` — `routeIndexForRoom(plan, roomId)` (line 65).
- `src/engine/maps/plan.ts` — `MapPlan`, `MapRoomSpecial`, `planMap`.
- `src/engine/maps/progress.ts` — `RoomView`, `roomView`, `bossTrainerId`,
  `isFinalMap`.
- `src/scenes/BattleScene.ts` — read only, to confirm the launch's
  `enemyBoosts` reaches `createBattle` (line 568); **this file is not edited.**
- `src/ui/battleInfo.ts` — read only: the INFO window prints every non-zero stat stage,
  which is how the live plan reads the opening's stage.
- `src/scenes/rooms/types.ts` — `RoomHost` (the scene already satisfies it).
- `src/dev/debugMenu.ts` — the panels the live criteria read (the floor/room
  teleport, `Route`'s battlefield readout, `Party`).
- `src/engine/maps/plan.test.ts`, `src/engine/run/roster.test.ts`,
  `src/engine/routes/trainers.test.ts` — read only; they must stay **unchanged and
  green**, which is how QA sees that no plan, roster or trainer draw moved.

## 🔒 Contract

The public surface other tasks will be written against. It is a promise, not a
suggestion. Every name below is exact.

### TypeScript

```ts
// src/data/bosses.ts  (added beside BOSS_PARTY; nothing existing changes)
import type { BoostId } from '../engine/battle/fighter';
import type { RoomConditionId } from './battlefields';

/** Which side a boss opening favours. */
export type BossOpeningSide = 'run' | 'boss';

/**
 * One of the boss room's two openings (`docs/maps-spec.md` §6). `battlefield` is the
 * arena's condition, a `ROOM_BATTLEFIELDS` id; `boosts` is the **one-sided** part:
 * the stat stages the boss's lead (`sides.enemy.party[0]`, the double battle's first
 * active) starts the battle with, through the shipped `BattleSetup.enemyBoosts`.
 */
export type BossOpening = Readonly<{
  side: BossOpeningSide;
  battlefield: RoomConditionId;
  boosts: Readonly<Partial<Record<BoostId, number>>>;
}>;

/** The boss room's own opening, in draw order (the index space of its roll). */
export const BOSS_OPENINGS: readonly BossOpening[];
```

The two rows, **exactly**, in this order:

```ts
export const BOSS_OPENINGS: readonly BossOpening[] = [
  { side: 'run', battlefield: 'endure', boosts: { spe: -1 } },
  { side: 'boss', battlefield: 'crit', boosts: { def: 1 } },
];
```

```ts
// src/engine/routes/battlefield.ts  (added; RoomKind, roomBattlefield and
// battlefieldSeeds keep their signatures and their behaviour for the other kinds)
import type { BoostId } from '../battle/fighter';
import type { BossOpeningSide } from '../../data/bosses';

/** The resolved opening: the data row's side and boosts, its battlefield row looked up. */
export type BossOpeningRoll = Readonly<{
  side: BossOpeningSide;
  battlefield: RoomBattlefield;
  boosts: Readonly<Partial<Record<BoostId, number>>>;
}>;

/**
 * The boss room's opening on its own stream, `Rng(hashSeed(`${seed}:battlefield:${roomIndex}`))`:
 * **one** `rng.int(0, BOSS_OPENINGS.length - 1)`, no `rng.next()`. `battlefield` is the
 * `ROOM_BATTLEFIELDS` row whose `id` the drawn `BOSS_OPENINGS` row names.
 */
export function bossOpeningRoll(seed: string, roomIndex: number): BossOpeningRoll;

/**
 * Unchanged signature. `quiet` still returns null; `trainer` still draws
 * `ROOM_BATTLEFIELD_CHANCE` then a row; **`boss` now always returns
 * `bossOpeningRoll(seed, roomIndex).battlefield`** — never null, never a chance roll.
 */
export function roomBattlefield(
  seed: string,
  roomIndex: number,
  kind: RoomKind,
): RoomBattlefield | null;
```

```ts
// src/engine/routes/bossRoom.ts  (new module: the boss room's own rules)
import type { RunState } from '../run/state';

/** The `pickedItems` mark of the boss room's one heal on `mapIndex`: `boss-heal-<mapIndex>`. */
export function bossHealId(mapIndex: number): string;

/**
 * True while the boss room refuses to let the run walk back out (`docs/maps-spec.md`
 * §6): `boss && !bossDefeated`. Reads no RNG and no run state.
 */
export function bossRoomSealed(boss: boolean, bossDefeated: boolean): boolean;

/**
 * The boss room's one free heal: `healParty` (party **and** box, HP and PP, never a
 * resurrection, D5) once per floor, recorded as `bossHealId(mapIndex)` in
 * `pickedItems` — which `advanceMap` clears, so the next floor heals again. A second
 * call on the same floor returns the **same object**. Reads no RNG.
 */
export function bossRoomHeal(run: RunState, mapIndex: number): RunState;
```

`src/engine/routes/bossRoom.ts` imports `healParty` from `../run/heal` and
`isItemPicked` / `markItemPicked` / `type RunState` from `../run/state`; body order is
`markItemPicked(healParty(run), bossHealId(mapIndex))`, the same shape as
`medicHeal` (`src/engine/routes/npcs.ts` 201-205). **Do not add the heal to
`src/engine/run/heal.ts`**: `state.ts` already imports `healParty`, so a value import
back would close a cycle.

#### `src/scenes/RouteScene.ts` — the exact wiring (not exported, but frozen)

1. A new field beside `battlefield` (line 842):
   `private bossOpening: BossOpeningRoll | null = null;`
2. `buildRoom` (lines 1159-1205), **before** the `buildRoute` call:
   - `const kind = roomKindOf(view);`
   - `if (kind === 'boss') { const opening = bossOpeningRoll(this.run.seed, roomIndex); this.battlefield = opening.battlefield; this.bossOpening = opening; }`
     `else { this.battlefield = roomBattlefield(this.run.seed, roomIndex, kind); this.bossOpening = null; }`
     (both branches assign, so no stale opening survives a room change);
   - when `view.boss`, run `const healed = bossRoomHeal(this.run, view.mapIndex);` and, only
     when `healed !== this.run`, `this.run = healed; this.persistRun();`.
3. `startBattle` (lines 6585-6643): the launch's `enemyBoosts` is the merge of three
   data rows, in this order and **without arithmetic**:
   `{ ...(extras.enemyBoosts ?? {}), ...(this.bossOpening?.boosts ?? {}), ...(this.run.modifiers.curse ? CURSE_ENEMY_BOOST : {}) }`,
   spread into `BattleLaunch` only when at least one of them is present. The three rows'
   keys never collide — the curse is `atk`, the run's opening `spe`, the boss's opening
   `def` — and the existing comment about that must stay true.
4. `tryLeaveRoom` (lines 5483-5506): immediately after `if (!edge) return false;` and
   **before** the portal branch,
   `if (bossRoomSealed(room.boss, this.run.bossDefeated)) return false;` — the step is
   not a room change, so nothing is committed, persisted or re-rolled. The portal branch
   below already reads `room.portalOpen`, which is false while the boss stands.
5. No notice, no window and no new string for any of the three rules: the room's tint
   already says the opening is on, and this task adds **no** `src/i18n/` key.

- **Determinism.** The boss room's stream `${seed}:battlefield:<roomIndex>` — minted by
  `hashSeed`, read by **nothing else** — stops drawing its `next()` chance roll and now
  draws exactly one `rng.int(0, BOSS_OPENINGS.length - 1)` for the row. `planMap`'s `map`
  stream, every route, encounter, roster, money, NPC and battle stream (`battleSeed`), and
  every non-boss room's condition are untouched: the plan, the rooms, their ids, sizes and
  roles must not move for a fixed seed. The heal and the seal draw no RNG at all.
  `bossOpeningRoll` resolves the drawn `RoomConditionId` through `ROOM_BATTLEFIELDS`; a
  missing row is a data bug, so it throws a plain `Error` (and
  `src/data/bosses.test.ts` is the guard that keeps that branch dead).
- **Rules:** no Phaser import, no DOM and no `localStorage` in `src/data/bosses.ts`,
  `src/engine/routes/battlefield.ts` or `src/engine/routes/bossRoom.ts`; no new run
  field and therefore **no `SAVE_VERSION` step**; no new dependency.
- **Ordering:** `BOSS_OPENINGS`' order is the index space its draw reads, so the two rows
  are frozen in the order written above and a third row would **append**.

### Data

- `BOSS_OPENINGS` — two rows, keys `side` (`'run' | 'boss'`), `battlefield`
  (a `RoomConditionId` present in `ROOM_BATTLEFIELDS`) and `boosts`
  (`Partial<Record<BoostId, number>>`, applied to the boss's lead only).
  - `run` = `{ battlefield: 'endure', boosts: { spe: -1 } }`: the boss's lead opens one
    Speed stage down, so the run's lead moves first.
  - `boss` = `{ battlefield: 'crit', boosts: { def: 1 } }`: the boss's lead opens one
    Defence stage up.
  - The **arena row is symmetric by the engine's own rules** (Endure and the crit stage
    apply to both sides); the **side** is the stat stage, which is the only one-sided
    channel `createBattle` already has. `docs/maps-spec.md` §6 must say exactly that and
    must not claim the weather/field itself favours anyone.
- `boss-heal-<mapIndex>` — a `pickedItems` record, `advanceMap`-scoped, no new field.
- Retired: `BOSS_BATTLEFIELD_CHANCE` (`src/data/battlefields.ts` line 77). After this
  task `grep -rn "BOSS_BATTLEFIELD_CHANCE" src docs` prints **nothing**.

## 🧩 Data and configuration

No JSON and no generated file. The only balancing surface is the two `BOSS_OPENINGS`
rows above (and they are data: a re-balance edits `src/data/bosses.ts`, never the
engine). `ROOM_BATTLEFIELDS` keeps **seventeen** rows in their shipped order, and
`ROOM_BATTLEFIELD_CHANCE` stays `0.15`.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-100` audited against the exclusive paths list.
  - This task has `[live]` criteria, so it **owes a browser pass**: `npm run dev`,
    the dev overlay (the debug menu) open.
- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` is clean (`tsc --noEmit && vite build`).
  - [ ] `[unit]` `npm test` is green.
  - [ ] `[unit]` `git diff --name-only main...task-100` lists only the exclusive paths,
    and in particular **no** file under `src/engine/maps/`, `src/engine/run/` or
    `src/i18n/` appears.
  - [ ] `[unit]` `grep -rn "BOSS_BATTLEFIELD_CHANCE" src docs` prints nothing.
  - [ ] `[unit]` `src/data/bosses.test.ts` pins `BOSS_OPENINGS`: exactly two rows, sides
    `['run', 'boss']` in that order; each `battlefield` id resolves in
    `ROOM_BATTLEFIELDS`; the `run` row's every stage is `<= -1` and the `boss` row's
    every stage is `>= 1`; the existing `BOSS_PARTY` / `bossPartySize` / `bossIsDouble`
    pins still pass unchanged.
  - [ ] `[unit]` `src/data/battlefields.test.ts` asserts `ROOM_BATTLEFIELDS` is still
    `toHaveLength(17)` and `ROOM_BATTLEFIELD_CHANCE` is still `0.15`, and no longer
    mentions `BOSS_BATTLEFIELD_CHANCE`.
  - [ ] `[unit]` `src/engine/routes/battlefield.test.ts` proves: `roomBattlefield(seed,
    index, 'boss')` is **never** null over 200 indices × 3 seeds and always equals one of
    the two `BOSS_OPENINGS` rows; the boss path draws **one** `int` and **no** `next()`
    (replay it from a fresh `Rng(hashSeed(...))` and compare); the `trainer` path still
    replays with `ROOM_BATTLEFIELD_CHANCE`; `quiet` still returns null.
  - [ ] `[unit]` `src/engine/routes/battlefield.test.ts` pins, as literals, the
    `trainer`-kind result for indices 1-32 of `dev-seed` and `battlefield-test`, with the
    values captured from `main` **before** the change — so a stray edit to the shared
    chance or to the table is caught.
  - [ ] `[unit]` `src/engine/routes/battlefield.test.ts` pins `bossOpeningRoll` for a
    fixed seed: for `dev-seed` and `pkm-64`, maps 1-8, with
    `index = routeIndexForRoom(planMap(seed, map), planMap(seed, map).bossRoom)`, the
    returned `side`, `battlefield.id` and `boosts` match a literal table.
  - [ ] `[unit]` `src/engine/routes/bossRoom.test.ts` proves: `bossRoomSealed` is true
    only for `(true, false)`; `bossRoomHeal` restores HP **and** PP across party and box,
    leaves a 0-HP member at 0 HP, returns the **same object** on a second call, writes
    `boss-heal-<map>` into `pickedItems`, and `advanceMap(run)` leaves that mark absent
    (so the next floor heals again); two calls on identical inputs are deeply equal (no
    RNG).
  - [ ] `[unit]` `src/engine/maps/plan.test.ts`, `src/engine/routes/trainers.test.ts` and
    `src/engine/run/roster.test.ts` are byte-identical to `main` and pass.
  - [ ] `[unit]` `docs/maps-spec.md` §6 names `BOSS_OPENINGS`, `bossRoomSealed`,
    `bossRoomHeal` and `boss-heal-`; §7's first battle-condition bullet names
    `BOSS_OPENINGS` and no longer names `BOSS_BATTLEFIELD_CHANCE`; `docs/battle-spec.md`
    §4 states the boss room always takes one opening and that its `boosts` land on the
    enemy's lead. `grep -n "casino" docs/maps-spec.md` still finds it in that same §7
    bullet: **it is not this task's to remove** (see Coordination).
  - [ ] `[live]` Dev menu → teleport to a floor's **boss room** on map 1 with the party
    damaged (take a wild battle first, or use the debug `Party` panel): on arrival every
    living member reads full HP and full PP in the party panel, and any member at 0 HP
    still reads 0 HP (no resurrection). Reload the page in that same room: the party reads
    the same HP/PP (the heal is persisted and its mark rides `pickedItems`, so it cannot
    run twice on one floor).
  - [ ] `[live]` In the boss room the `Route` panel of the debug overlay reports a
    battlefield whose `id` is exactly `endure` or `crit` and whose `visible` is `true`;
    the room shows its tint over the whole screen; reloading the page in that room
    reports the **same** `id` for the same seed. In a non-boss room of the same floor the
    `id` is whatever it was before (null or a row of `ROOM_BATTLEFIELDS`).
  - [ ] `[live]` In the boss room, walking into the door you came through does not change
    the `roomInMap` the debug overlay prints (press several times against the door); beat
    the boss, and the same door now leads back out (the overlay's `roomInMap` changes).
  - [ ] `[live]` In the boss battle, at turn 1, the enemy's **lead** shows the opening's
    stage in the battle's INFO window (`src/ui/battleInfo.ts` prints every non-zero stage
    in `BOOST_IDS` order): Speed `-1` on the `run` row, Defence `+1` on the `boss` row,
    and the second enemy active shows none of them. State whether the row you saw was
    `endure` (Speed −1) or `crit` (Defence +1), so the two agree with the room's tint.

## 📣 Coordination

- For the Architect: this task owns `src/scenes/RouteScene.ts` for the batch. **No other
  task in Batch 45 may claim it.** `[Task-117]` was refused a seat in this batch for
  exactly that reason: its rocket panel cannot open without a branch in this scene's
  `chooseNpc` id switch (lines 5895-6010, whose `default` only marks the row used), and
  `src/scenes/rooms/registry.ts` collects **room** descriptors only — there is no NPC
  registry — so no data-driven path exists.
- For the next reader of `docs/maps-spec.md` §7: the first bullet of
  `### A room's battle condition` still lists `casino` among the quiet special leaves,
  because the casino room is still in the plan on `main`. The task that retires the room
  removes that word; this task must not.
- For the next batch: the boss room's condition is now a table read
  (`BOSS_OPENINGS`, `src/data/bosses.ts`) resolved by
  `bossOpeningRoll(seed, roomIndex)`; anything that wants the boss's opening must call
  that function, never re-roll and never read `this.battlefield` for the boosts. The
  boss's touchable rules are `bossRoomSealed` / `bossRoomHeal`
  (`src/engine/routes/bossRoom.ts`) — reuse them, do not re-implement them in a scene.
- For QA: the one stream that moves is the boss room's own
  `${seed}:battlefield:<roomIndex>`; if a plan, a room id, a size, a role, a trainer, a
  roster or a non-boss room's condition changes anywhere, the task is wrong, not the pin.
- For the human's fair-play question: the seal cannot soft-lock a run. The boss stands at
  the room's farthest tile with `DEFAULT_TRAINER_SIGHT`, so it walks over and starts the
  fight without the player touching the door, and a loss in the room is a **normal loss**
  (`D5`) — the same outcome the run had before this task.

## ⛔ Out of scope

- The boss's roster, its level and its party size (`[Task-71]`, shipped) — only how the
  fight *opens*.
- The portal's own rule (`D31`): it is still carved from the start and opened by
  `bossDefeated`; the seal is about the door back, not the portal.
- The `ROOM_BATTLEFIELDS` table: no new row, no re-order, no tint/alpha change, and the
  regular rooms' `ROOM_BATTLEFIELD_CHANCE` (15 %) stays.
- The conditions themselves (`[Task-62]`, `[Task-106]`) and the forced-sky modifier of
  the weather-man NPC, which still replaces the room's condition.
- Boosting **both** enemy actives (that needs an engine change in
  `src/engine/battle/state.ts`), and any player-side stat field.
- A notice, a window or any player-facing text for the opening, the seal or the heal
  (`src/i18n/` untouched).
- The casino room, the rocket NPC and the whole `[Task-117]` scope.
- The `docs/battle-spec.md` §4 bullets about fog and the six whole-field rules, and
  `docs/maps-spec.md` §7's second and later bullets.
