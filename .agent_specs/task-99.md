# Spec: Task-99 — the special trainers: invisible ninjas, the all-Impostor trainer and the conditional secret battle

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule + data + Phaser scene + docs.
- **Role:** Dev.
- **Objective:** A `trainers` room of a floor can now hold one **special trainer**
  instead of its first ordinary one — an archetype override, never an extra body — and
  three set-piece archetypes exist for it: the **ninja** (its route sprite stays hidden
  until the player stands adjacent, so it ambushes), the **Impostor** trainer (every
  member of its roster starts with the `Imposter` ability, bypassing the run's
  `randomAbility` roll, and a first win pays one Ability Shield through the battle
  fold's `addItem`) and the **secret battle** (its row only joins the draw once the run
  has met a floor mission, i.e. `RunState.missionsCompleted >= 1`). After the task the
  three rows are data in `src/data/trainers.ts`, the presence roll and the sprite
  visibility rule are pure functions in `src/engine/routes/trainers.ts`, the scene
  applies both, and the three docs (`docs/routes-spec.md` §2/§5, `docs/battle-spec.md`
  §9, `docs/design-spec.md` §7) describe them.
- **Environment:** worktree `../wt-pkm-99`, branch `task-99`.
- **Dependencies:** the tasks that must already be merged, by name, with the file each
  one produced that this task reads.
  - **[Task-82]** (merged) — `src/engine/maps/plan.ts`'s `MapRoomRole` / `MapRoom.role`
    and the `trainers` rooms whose first trainer this task overrides, plus
    `src/data/population.ts`.
  - **[Task-98]** (merged) — `src/engine/run/missions.ts` (`MissionProgress`,
    `missionForMap`) and `src/engine/run/state.ts`'s `RunState.mission` /
    `RunState.missionsCompleted`, the record the secret battle's gate reads.
  - **[Task-91]** (merged) — `src/engine/routes/npcs.ts`, the placement precedent
    (its own `${seed}:npc:<roomId>` stream, one presence draw plus one weighted pick,
    a chance scale of `10_000`) this task's roll mirrors.
  - **[Task-95]** (merged) — the `src/engine/run/battleLink.ts` trigger that carries a
    battle's roster, which this task widens by one optional field.

### Exclusive paths (single writer)

The list of paths this task creates or modifies. **Nothing outside this list.**
No other task in the batch may claim the same path. Deleting a stray `.gitkeep` from a
directory this task populates is always allowed.

- `src/data/trainers.ts`
- `src/data/trainers.test.ts`
- `src/engine/routes/trainers.ts`
- `src/engine/routes/trainers.test.ts`
- `src/engine/run/battleLink.ts`
- `src/engine/run/resolve.ts`
- `src/engine/run/resolve.test.ts`
- `src/scenes/RouteScene.ts`
- `docs/routes-spec.md` — **§2** (step 4's closing sentence and the new
  special-trainer paragraph) and **§5** (the trainer-archetype bullet) only.
- `docs/battle-spec.md` — **§9** only.
- `docs/design-spec.md` — **§7** only.

**No folder `README.md` is edited.** This task adds, renames and deletes no file, so
`AGENTS.md`'s README rule does not fire. The `src/data/README.md` line that describes
`src/data/trainers.ts` stays literally true (it already says the set-piece rows live
outside `TRAINER_ARCHETYPES`); do not touch it.

**Not claimed, and must not change:** `package.json`, `src/main.ts`, `vite.config.ts`,
`src/data/dex/**`, `src/i18n/**`, `src/engine/save.ts`, `src/engine/run/state.ts`,
`src/engine/routes/sketch.ts`, `src/engine/routes/streams.ts`, `src/engine/run/roster.ts`,
`src/scenes/BattleScene.ts` and every other scene.

### Inputs (read-only)

Files this task may read, and only these, beyond `AGENTS.md` itself.

- `docs/agent-spec-template.md`, `docs/routes-spec.md`, `docs/battle-spec.md`,
  `docs/design-spec.md`, `docs/maps-spec.md`, `docs/data-spec.md`,
  `docs/tech-decisions.md` (`D11`, `D16`, `D17`, `D33`, `D46`).
- `src/data/trainers.ts`, `src/data/items.ts` (the `abilityshield` row),
  `src/data/npcs.ts`, `src/data/missions.ts`, `src/data/run.ts`.
- `src/engine/routes/{routeMap,sketch,npcs,validate,encounters,streams}.ts`.
- `src/engine/maps/{plan,progress}.ts`, `src/engine/run/{state,missions,battleLink,roster,resolve,floors,heal}.ts`,
  `src/engine/run/party.ts`.
- `src/engine/battle/{fighter,randomAbility,state}.ts`,
  `src/engine/battle/effects/abilities.ts`.
- `src/scenes/RouteScene.ts`.
- The other tests that pin this area, to know what must NOT move:
  `src/engine/routes/sketch.test.ts`, `src/engine/routes/encounters.test.ts`,
  `src/engine/maps/plan.test.ts`, `src/engine/run/curve.test.ts`,
  `src/data/overworldSprites.test.ts`, `src/data/trainerSprites.test.ts`.

## 🔒 Contract

The public surface other tasks will be written against in parallel. It is a
promise, not a suggestion. Write the exact exported names and signatures.

### TypeScript — `src/data/trainers.ts`

Add these two types **above** `TrainerArchetype`, keep the existing `TrainerMoney`
where it is, and add the three optional fields to the end of `TrainerArchetype`
(after `aiFlags`):

```ts
/**
 * How a trainer's **route sprite** is drawn (`docs/routes-spec.md` §2). It never
 * changes `sight` or the line-of-sight rule: an `invisible` trainer still watches its
 * lane and still opens the battle. Absent means `visible`.
 */
export type SightMode = 'visible' | 'invisible';

/** What a beaten trainer of an archetype pays besides money: one bag item and a count. */
export type TrainerItemReward = Readonly<{ itemId: string; count: number }>;

export type TrainerArchetype = Readonly<{
  // ...every existing field, unchanged...
  /** The sprite's draw mode on the route; absent means `visible`. */
  sightMode?: SightMode;
  /**
   * The ability **name** the dex spells (`getAbility('imposter').name` → `'Imposter'`)
   * that every member of this archetype's roster starts with, **bypassing**
   * `randomAbility`'s roll (`src/engine/battle/fighter.ts`'s `resolveAbility` trusts a
   * provided `ability`). Absent means the run's roll applies.
   */
  forcedAbility?: string;
  /** The item a first win over this archetype pays through `addItem`; absent means money only. */
  reward?: TrainerItemReward;
}>;
```

Append the three set-piece rows **inside** `SPECIAL_ARCHETYPES`, after the `rocket`
row, in this exact order and with these exact values (see
`## 🧩 Data and configuration` for the table itself). They are **not** added to
`TRAINER_ARCHETYPES` and therefore not to `TRAINER_ARCHETYPE_IDS`: the population pass
must keep rolling only the ten regular classes, and
`src/data/overworldSprites.test.ts` / `src/data/trainerSprites.test.ts` assert the
route pool's art set (leave those two files untouched — they still pass).

Add the spawn table **after** `SPECIAL_ARCHETYPES`, before `const BY_ID`:

```ts
/**
 * The set-piece trainers a `trainers` room may hold instead of its first ordinary one
 * (`docs/routes-spec.md` §2). One presence roll per room; `chance` is 0..1 and is
 * rounded to `1/10_000` exactly like `src/engine/routes/npcs.ts`'s rows. A row whose
 * `minMissionsCompleted` the run has not reached is out of both the total and the pick,
 * so a gated row is never rolled.
 */
export type SpecialTrainerRow = Readonly<{
  /** The `SPECIAL_ARCHETYPES` id the room's first trainer wears. */
  archetypeId: string;
  /** Chance that a `trainers` room fields it, 0..1. */
  chance: number;
  /** The run's completed-mission count the row needs; absent means none. */
  minMissionsCompleted?: number;
}>;

export const SPECIAL_TRAINER_ROWS: readonly SpecialTrainerRow[] = [
  { archetypeId: 'ninja', chance: 0.1 },
  { archetypeId: 'impostor', chance: 0.08 },
  { archetypeId: 'secret', chance: 0.2, minMissionsCompleted: 1 },
];
```

### TypeScript — `src/engine/routes/trainers.ts`

Keep everything already exported (`blocksSight`, `sightLine`, `seesPlayer`,
`trainerBlockers`, `trainerAt`, `facingVector`) byte-identical. Add exactly these four
exports at the end of the file (no Phaser, no DOM, no storage, no clock):

```ts
import { getTrainerArchetype, SPECIAL_TRAINER_ROWS, type SpecialTrainerRow, type TrainerArchetype } from '../../data/trainers';
import type { MapRoomRole } from '../maps/plan';
import type { Tile } from '../grid';
import { Rng, hashSeed } from '../rng';
import type { TrainerRosterEntry } from '../run/battleLink';
import type { Facing, RouteMap, RouteTrainer } from './routeMap';

/** The Manhattan distance within which an `invisible` archetype's sprite shows: 1. */
export const INVISIBLE_REVEAL_DISTANCE = 1;

/**
 * True when `archetype`'s route sprite must stay hidden with the player on `player`.
 * Only an `invisible` sight mode hides anything, and only while the Manhattan distance
 * (`|dx| + |dy|`) is greater than `INVISIBLE_REVEAL_DISTANCE`; a `visible` archetype
 * (and an unknown one) is never hidden.
 */
export function trainerHidden(
  archetype: TrainerArchetype | undefined,
  trainer: Tile,
  player: Tile,
): boolean;

export type SpecialTrainerOptions = Readonly<{
  /** The route the room already generated (`sketchRoute(...)`), trainers included. */
  route: RouteMap;
  /** The run's seed. */
  seed: string;
  /** The room's stable per-run index (`routeIndexForRoom(plan, roomId)`). */
  roomIndex: number;
  /** The plan room's population role. Only `trainers` may field one. */
  role: MapRoomRole;
  /** True for the map's entry, its boss room and every special room. */
  quiet: boolean;
  /** `RunState.missionsCompleted`, the mission record's run-scoped counter. */
  missionsCompleted: number;
  /** Rows to read; defaults to `SPECIAL_TRAINER_ROWS`. */
  rows?: readonly SpecialTrainerRow[];
}>;

/**
 * The room's special trainer, or null: the route's **first** trainer with its
 * `archetypeId` swapped for the drawn row. Same `id`, `position`, `facing`, `sight` and
 * `turns`, so the population pass's pose and reachability guarantees still hold and the
 * body is never added twice.
 */
export function specialTrainerFor(options: SpecialTrainerOptions): RouteTrainer | null;

/** The roster with `archetype.forcedAbility` stamped on every entry, or `roster` itself. */
export function withForcedAbility(
  roster: readonly TrainerRosterEntry[],
  archetype: TrainerArchetype | undefined,
): readonly TrainerRosterEntry[];
```

**`specialTrainerFor` rules, in this order.**

1. `if (options.quiet || options.role !== 'trainers' || options.route.trainers.length === 0) return null;`
2. `usable` = the rows whose `getTrainerArchetype(row.archetypeId)` is defined **and**
   whose `minMissionsCompleted` is absent or `<= options.missionsCompleted`, each weighted
   `Math.round(row.chance * 10_000)`; drop the zero weights. `total` = the sum. (A row
   naming an unknown archetype is never rolled, so the room can never hold a trainer
   `startTrainerBattle` refuses to fight.)
3. `const rng = new Rng(hashSeed(`${options.seed}:special-trainer:${options.roomIndex}`));`
   — its own stream (see **Determinism**).
4. `if (total === 0 || rng.next() * 10_000 >= total) return null;` — one presence draw.
5. `const ticket = rng.int(0, total - 1);` then walk `usable` in table order,
   accumulating weights, and take the first whose cumulative weight is `> ticket` — the
   weighted pick, its second and last draw.
6. Return `{ ...options.route.trainers[0], archetypeId: row.archetypeId }`. **Never
   mutate** `route` or the trainer object.

**`withForcedAbility` rules.** If `archetype?.forcedAbility` is `undefined` or blank
(after `.trim()`), return `roster` **as the same reference**. Otherwise read the trimmed
name into a local `const ability: string` and return
`roster.map((entry) => ({ ...entry, ability }))`. **`exactOptionalPropertyTypes` is on**:
never assign `undefined` to an optional property anywhere in this task — narrow first and
build the object with the presence operator (`...(x !== undefined ? { key: x } : {})`)
when a value may be absent. **`verbatimModuleSyntax` is on**: every type-only import
reads `import type`.

### TypeScript — `src/engine/run/battleLink.ts`

Export the roster entry so the engine rule above can type its argument, and widen the
trigger's roster by one optional field. Nothing else in the file changes.

```ts
/** One member of a trainer's roster as the battle builds it. */
export type TrainerRosterEntry = Readonly<{
  id: string;
  speciesId: string;
  level: number;
  /** A held item the member starts with (a Mega Stone, D34). */
  heldItem?: string;
  /**
   * The ability name the member starts with, bypassing the run's `randomAbility` roll
   * (`createFighter` trusts a provided `ability`). Absent means the roll applies.
   */
  ability?: string;
}>;

export type TrainerTrigger = Readonly<{
  kind: 'trainer';
  trainerId: string;
  trainerName: string;
  roster: readonly TrainerRosterEntry[];
  archetypeId?: string;
}>;
```

`BattleScene.init` already does `trigger.roster.map((input) => createFighter({ ...input, learnsetSeed: launch.runSeed }))`,
so the stamped `ability` reaches `resolveAbility` and the roll is skipped. Do **not**
edit `BattleScene.ts`.

### TypeScript — `src/engine/run/resolve.ts`

`BattleReward` gains one optional field and the existing **first-win** block pays it.
This is the only place a trainer's first win is already known (`firstWin`), so the
reward can never double:

```ts
import type { TrainerItemReward } from '../../data/trainers';

export type BattleReward = Readonly<{
  enemyLevels: readonly number[];
  isTrainer: boolean;
  trainerId?: string;
  money?: number;
  /** The archetype's item row: one bag stack, paid with the first win (Task-99). */
  item?: TrainerItemReward;
}>;
```

Inside `if (firstWin) { ... }`, after the money line and before
`next = markTrainerDefeated(...)`:

```ts
if (reward.item !== undefined) next = addItem(next, reward.item.itemId, reward.item.count);
```

Nothing else in `resolveBattle` changes; the loss/run path still pays nothing.

### Phaser — `src/scenes/RouteScene.ts`

Add the three new names to the existing `import { ... } from '../engine/routes'` list
(`specialTrainerFor`, `trainerHidden`, `withForcedAbility`) and `getTrainerArchetype`
is already imported. Freeze these members:

```ts
/**
 * Overrides the room's first trainer with a special trainer when this room's own roll
 * draws one (`docs/routes-spec.md` §2). Once per build, from `buildRoom`, **before**
 * `rollRoomNpc()`; reads its own stream, so the room's route, trainers, items and the
 * floor's NPC do not move.
 */
private placeSpecialTrainer(roomIndex: number): void;

/** Draws one trainer's sprite (the body of `drawTrainers`' loop), booking it into `created`. */
private drawTrainer(trainer: RouteTrainer, created: Phaser.GameObjects.GameObject[]): void;

/** Shows or hides every drawn trainer's sprite through the pure `trainerHidden` rule. */
private refreshTrainerVisibility(): void;

/** Dev only: the trainers drawn on the route and whether each sprite is showing. */
debugTrainerSprites(): readonly Readonly<{
  id: string;
  archetypeId: string;
  x: number;
  y: number;
  facing: Facing;
  /** Manhattan distance from the player's tile to the trainer's. */
  distance: number;
  visible: boolean;
}>[];

/**
 * Dev only: swaps the room's first undefeated trainer's archetype and redraws just that
 * sprite (`IS_DEVELOP` only). False with no trainer or an unknown id.
 */
debugOverrideTrainer(archetypeId: string): boolean;
```

`placeSpecialTrainer` builds

```ts
const trainer = specialTrainerFor({
  route: this.route,
  seed: this.run.seed,
  roomIndex,
  role: room.role,
  quiet: room.entry || room.boss || room.special !== null,
  missionsCompleted: this.run.missionsCompleted,
});
```

and, when non-null, replaces the matching entry of `this.route.trainers` by `id`
(a new `route` object; the route is never mutated).

`buildRoom` calls it **after** the room fixture block and **before**
`this.rollRoomNpc();` (so the NPC's `npcSpot` already sees the swapped trainer).

`refreshTrainerVisibility` loops `this.trainerSprites` and calls
`entry.sprite.setVisible(!trainerHidden(getTrainerArchetype(entry.trainer.archetypeId), entry.trainer.position, this.player))`.

Call it in exactly these places: at the end of `create` (after
`this.movePlayerTo(this.player.x, this.player.y)`), at the end of `transitionTo` (after
its `movePlayerTo`), at the end of `rebuildRoom` (after its `movePlayerTo`), at the
**top** of `onTileEntered`, in `teleportToTile` right after `this.movePlayerTo(...)`
(the doc comment keeps saying a teleport runs no sight check — it only re-paints
visibility), and in `beginChase` right after the sprite entry is found
(`entry.sprite.setVisible(true)`), so the ninja is on screen while it dashes in.

`debugOverrideTrainer` finds the first trainer of `this.route.trainers` that
`isTrainerDefeated(this.run, trainer.id)` is false for, refuses an id
`getTrainerArchetype` does not know, rewrites that trainer's `archetypeId` in
`this.route`, calls `this.removeTrainerSprite(trainer.id)`, then
`this.drawTrainer(swapped, created)`, `this.hudCamera?.ignore(created)` and
`this.refreshTrainerVisibility()`. `drawTrainer` is the extracted body of
`drawTrainers` (same sprite construction, `faceTrainerSprite`, `trainerFacing.set`,
`trainerSprites.push`, `entitySprites.push`, `created.push`), so `drawTrainers` becomes a
loop that calls it and then `drawRoomNpc`/`hudCamera.ignore` as today.

`startTrainerBattle` passes the roster through the rule:

```ts
roster: withForcedAbility(roster, archetype),
```

`rewardFor(trigger)` adds the archetype's item row beside the money:

```ts
...(archetype?.reward !== undefined ? { item: archetype.reward } : {}),
```

### Data

- Keys this task introduces or freezes, with their shape, unit and default:
  - `TrainerArchetype.sightMode?: 'visible' | 'invisible'` — default `visible`.
  - `TrainerArchetype.forcedAbility?: string` — default absent (the roll applies); the
    value is the dex ability **name**, `'Imposter'`.
  - `TrainerArchetype.reward?: { itemId: string; count: number }` — default absent (no
    item).
  - `SpecialTrainerRow.chance` — 0..1, rounded to `1/10_000` by the engine.
  - `SpecialTrainerRow.minMissionsCompleted?: number` — default absent (no gate).
  - `TrainerRosterEntry.ability?: string` — default absent (the roll applies).
  - `BattleReward.item?` — default absent (money only).
  - No run field, no `SAVE_VERSION` step (`RunState.mission` / `missionsCompleted` are
    Task-98's shipped fields; `src/engine/save.ts` is untouched and stays at
    `SAVE_VERSION = 21`, the value `[Task-94]`'s 20 → 21 step left behind — Task-99 adds
    no field, so the plan's next step is still `[Task-101]`'s 21 → 22).

### Determinism

- **The special trainer reads one new stream and nothing else:**
  `Rng(hashSeed(`${seed}:special-trainer:${roomIndex}`))` — one `next()` for presence,
  one `int()` for the weighted row pick. `roomIndex` is the stable per-run room index
  `routeIndexForRoom(plan, roomId)` the room's own route is generated from. No layout,
  terrain, populate, item, validation, encounter, roster, money, reward or battle draw
  moves, so a fixed seed keeps reproducing **the same rooms, the same trainers, the
  same items, the same encounters and the same rosters** it already produced.
- **The forced ability consumes no stream at all:** `randomAbility` is a pure
  `hashSeed(`${seed}:ability:${speciesId}`)` per species, not a sequential stream, and
  `resolveAbility` returns the provided name before calling it. Bypassing it therefore
  shifts nothing else in the battle.
- **The reward is deterministic:** it is the archetype's data row read inside the
  existing `firstWin` guard; it draws no RNG.
- **No fixed-seed re-pin is expected or allowed.** `src/data/trainers.test.ts` changes
  are **table assertions** (the set-piece id list and the new rows), not pins. These
  files pin the generator and must stay untouched: `src/engine/routes/sketch.test.ts`,
  `src/engine/routes/encounters.test.ts`, `src/engine/routes/trainers.test.ts`'s existing
  placement pins, `src/engine/maps/plan.test.ts`, `src/engine/run/curve.test.ts`,
  `src/engine/run/roster.test.ts`, and the existing cases of
  `src/engine/run/resolve.test.ts` (only new cases are appended there). If any of them
  starts failing, a draw moved: fix the code, never the pin. The only new pin this task
  adds is its own fixed-seed case for `specialTrainerFor` (below), and it is deliberate:
  it freezes the presence/pick draw order of the new stream.

## 🧩 Data and configuration

All balancing lives in `src/data/trainers.ts`; the engine hardcodes none of it.

**The three set-piece archetypes** (appended to `SPECIAL_ARCHETYPES`, after `rocket`):

| id | name / className | spriteKey | battleSprite | colour | money | sightMode | forcedAbility | reward | aiFlags |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ninja` | `Ninja` / `Ninja` | `ninja` | `ninja` | `0x475569` | `{ base: 150, jitter: 60 }` | `invisible` | — | — | `checkBadMove`, `tryToFaint`, `risky` |
| `impostor` | `Impostor` / `Impostor` | `psychic` | `psychic` | `0xa78bfa` | `{ base: 160, jitter: 70 }` | — (`visible`) | `Imposter` | `{ itemId: 'abilityshield', count: 1 }` | `checkBadMove`, `checkViability`, `tryToFaint` |
| `secret` | `Secret Trainer` / `Secret Trainer` | `ace` | `ace` | `0x334155` | `{ base: 300, jitter: 120 }` | — (`visible`) | — | — | `checkBadMove`, `tryToFaint`, `checkViability`, `setupFirstTurn`, `risky`, `preferBatonPass` |

- `ninja`'s `spriteKey` is the packed overworld atlas's own `ninja` row
  (`src/data/frlg/overworld.json`). `battleSprite: 'ninja'` has **no frame** in the
  packed trainer sheet, so `BattleScene` hides the enemy trainer image for that battle
  (`trainerSpriteFrame` returns null → `setVisible(false)`) — the path the `rocket` row
  already takes. That is the right read for a ninja: it does not pose on the platform.
  Do not repack the atlas and do not invent art.
- `impostor` and `secret` **borrow** existing art rows (`psychic`, `ace`) so no atlas
  is repacked; a borrowed row is the shipped NPC convention.
- `money` is read by `trainerMoney(archetype, band, rng, multiplier)` unchanged, so the
  band scale still applies (`TRAINER_MONEY_BAND_SCALE`).
- `abilityshield` is an existing `held` catalogue row (`src/data/items.ts`); this task
  adds no item.
- **No new i18n key.** Trainer `name` / `className` already travel as data strings
  through `TrainerTrigger.trainerName` (the shipped archetypes do the same); the item
  notice reuses `itemPickupNotice` and `getItem`'s own name.

**The spawn table** (`SPECIAL_TRAINER_ROWS`, table order = pick order):

| archetypeId | chance | minMissionsCompleted |
| --- | --- | --- |
| `ninja` | `0.1` | — |
| `impostor` | `0.08` | — |
| `secret` | `0.2` | `1` |

So a `trainers` room has an **18 %** chance of a special trainer before the run has met
a mission (1000 + 800 = 1800 of 10 000) and a **38 %** chance after one
(1800 + 2000 = 3800 of 10 000); the room still fields 1–2 trainers total, because the
special one replaces the first. Retuning is an edit to these two tables and to nothing
else.

### Documentation (same task)

Four edits, each inside its section, each naming the facts above. No other line of those
three files changes.

- **`docs/routes-spec.md` §2** — two edits:
  1. the end of **step 4**'s trainer sentence gains one clause: a `trainers` room's
     first trainer may instead wear its **special** archetype (next paragraph).
  2. a new paragraph **after** *“The special NPC is a per-room fixture, not a pass.”*,
     opening **“The special trainer is an archetype override, not a pass.”** It must
     state: at most one per `trainers` room, never in the entry, boss or a special room;
     the presence roll and the weighted row pick draw, in that order, on
     `Rng(hashSeed(`${seed}:special-trainer:<roomIndex>`))` where `roomIndex` is the
     same stable per-room index the room's route is generated from; the drawn row
     **replaces the room's first trainer's archetype**, keeping its id, tile, facing,
     sight and spin, so the population count, the pose rules and the reachability guard
     are untouched and the body is never added twice; the three rows and their chances
     (`ninja` 0.1, `impostor` 0.08, `secret` 0.2 gated on `missionsCompleted >= 1`); the
     ninja's `sightMode: 'invisible'` hides **only its sprite** while the player is more
     than one tile away (its line of sight is unchanged, so it still spots and opens the
     battle) and the sprite is re-painted after every step, room rebuild and debug
     teleport; the Impostor's `forcedAbility: 'Imposter'` is stamped on every member of
     its roster and bypasses the run's ability roll, and its `reward` pays one Ability
     Shield with the first win; and no layout, terrain, populate, item, validation or
     encounter stream moves, so a fixed seed keeps every route it already generated.
- **`docs/routes-spec.md` §5** — the *“Each trainer archetype is presentation and reward
  only (identity, sprites, money)”* bullet gains: the three **set-piece** rows
  (`ninja`, `impostor`, `secret`) live in `SPECIAL_ARCHETYPES`, so the route never rolls
  them; `sightMode` is the route sprite's draw mode, not its `sight`; `forcedAbility` is
  the ability name its roster starts with, bypassing `D17`'s roll for that roster only;
  `reward` is a bag item paid with a first win through `addItem`, on top of the money the
  band still scales; and the secret row's gate reads the mission record's run-scoped
  counter, `RunState.missionsCompleted`.
- **`docs/battle-spec.md` §9** — one bullet: an archetype's `forcedAbility` is the
  **starting** ability of every member of its roster and is decided **before** the run's
  `randomAbility` roll, which is then skipped (no draw moves anywhere else, because the
  roll is a per-species hash); a Mega Evolution still replaces it, because
  `changeBattleForm` swaps the forme's own ability; and none of the three set-piece
  trainers carries a Mega Stone (`carriesMega` stays absent), so `allowMega` remains with
  the bosses, the mini-bosses and the `ace` archetype.
- **`docs/design-spec.md` §7** — one new bullet **after** the special-NPC bullet: the
  **special trainer** — at most one per regular trainer room, replacing that room's first
  trainer — with its three faces: the **ninja** (its sprite is hidden until the player
  stands adjacent, but it watches its lane and opens the battle), the **Impostor**
  trainer (its whole team starts with Imposter, and beating it pays an Ability Shield)
  and the **secret battle** (it only joins the draw once the run has met a floor
  mission, `missionsCompleted >= 1`); name the three chances.


## 🧪 Test and Validation Plan (for QA)

QA runs this verbatim. A criterion that cannot be executed by someone who has not
read the rest of the spec is not a criterion.

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-99` audit against the exclusive paths list.
  - The `[live]` criteria need a browser: `npm run dev`, open the served page in the
    cycle's headless Chromium over CDP, reach the **Route** scene through the menu (a
    fresh dev run, its starter), then evaluate in the page:
    `const { game } = await import('/src/main.ts'); const route = game.scene.getScene('Route');`
    `IS_DEVELOP` is true under `npm run dev`, so the `debug*` members exist.
  - **Nothing here is measured from a screenshot**; every `[live]` reading is a value
    the scene returns.

- **Acceptance criteria:**

  - [ ] `[unit]` It typechecks and builds clean: `npm run build` exits 0.
  - [ ] `[unit]` `npm test` is green, including the new cases:
    - `src/data/trainers.test.ts`: `SPECIAL_ARCHETYPES.map((a) => a.id)` equals
      `['rocket', 'ninja', 'impostor', 'secret']`; `ninja.sightMode === 'invisible'`;
      `impostor.forcedAbility === 'Imposter'`;
      `impostor.reward` equals `{ itemId: 'abilityshield', count: 1 }`;
      `getItem('abilityshield')` is defined; none of the three sets `carriesMega`;
      `TRAINER_ARCHETYPE_IDS` is still the ten regular ids and contains none of the
      four set-piece ids; `getTrainerArchetype('ninja' | 'impostor' | 'secret')` returns
      the row; every `SPECIAL_TRAINER_ROWS` row's `archetypeId` resolves and is not in
      `TRAINER_ARCHETYPE_IDS`; `SPECIAL_TRAINER_ROWS`'s chances are within `0..1`.
    - `src/engine/routes/trainers.test.ts` (new `describe`s): the rules of
      `trainerHidden`, `specialTrainerFor` and `withForcedAbility` below.
    - `src/engine/run/resolve.test.ts`: the first-win item payout below.
  - [ ] `[unit]` `trainerHidden` is `true` only for an `invisible` archetype at
    Manhattan distance `>= 2`, and `false` at distance `0` and `1`; a `visible`
    archetype and an `undefined` archetype are `false` at every distance (0, 1, 2, 5).
  - [ ] `[unit]` `specialTrainerFor` is pure and deterministic: two calls with the same
    options deep-equal each other; `options.route.trainers[0].archetypeId` is unchanged
    afterwards; one fixed-seed pin asserts the exact result for
    `{ seed: 'tt-special', roomIndex: 1, missionsCompleted: 0 }` against a two-trainer
    fixture route (the dev records the value the implementation produces, and the test
    title says it is the fixed-seed pin); the result's `id`, `position`, `facing`,
    `sight` and `turns` equal the fixture's first trainer's and its `archetypeId` is
    the drawn row's.
  - [ ] `[unit]` `specialTrainerFor` gates correctly: `quiet: true`, or
    `role: 'wild'`, or a route with `trainers: []` returns `null`; with
    `rows: [{ archetypeId: 'secret', chance: 1, minMissionsCompleted: 1 }]` it returns
    `null` at `missionsCompleted: 0` and a `'secret'` trainer at `1`; with
    `rows: [{ archetypeId: 'ninja', chance: 0 }]` it returns `null`; with
    `rows: [{ archetypeId: 'not-a-class', chance: 1 }]` it returns `null`.
  - [ ] `[unit]` `withForcedAbility` stamps `ability: 'Imposter'` on **every** entry of
    a two-member roster for `getTrainerArchetype('impostor')`, leaves the input array
    untouched, and returns an archetype without `forcedAbility` (`'ninja'`, `undefined`)
    by the **same reference**; and `createFighter({ ...stamped, learnsetSeed: 'run-1' })`
    has `ability === 'Imposter'` for each entry while
    `createFighter({ ...plain, learnsetSeed: 'run-1' }).ability` equals
    `randomAbility(speciesId, 'run-1')?.name`.
  - [ ] `[unit]` `resolveBattle` pays a `BattleReward.item` exactly once: a `'win'`
    against an undefeated `trainerId` adds `{ itemId: 'abilityshield', count: 1 }` to
    the returned run's bag (stacked when present); a second `resolveBattle` of the same
    reward against that returned run — with the `BattleReturn`'s `bag` set to the first
    result's bag, as a replay would carry it — adds nothing; and a `'lose'` outcome adds
    nothing.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched:
    `git diff --name-only main...task-99` lists only the eleven paths above (plus
    untracked files under `.agent_specs/`, which are not part of the diff) and
    `git diff --name-only main...task-99 -- src/engine/save.ts src/main.ts package.json src/data/dex src/i18n src/scenes/BattleScene.ts` is empty.
  - [ ] `[unit]` The generator's pins did not move: `git diff --name-only main...task-99`
    contains none of `src/engine/routes/sketch.test.ts`,
    `src/engine/routes/encounters.test.ts`, `src/engine/maps/plan.test.ts`,
    `src/engine/run/curve.test.ts`, `src/engine/run/roster.test.ts`,
    `src/data/overworldSprites.test.ts`, `src/data/trainerSprites.test.ts`.
  - [ ] `[unit]` No run field and no save step: `git diff main...task-99 -- src/engine/save.ts src/engine/run/state.ts` is empty and `grep -n "SAVE_VERSION = " src/engine/save.ts` still reads `export const SAVE_VERSION = 21;`.
  - [ ] `[live]` On the room found in step 1, `route.debugOverrideTrainer('ninja')`
    returns `true` and the entry **whose `archetypeId === 'ninja'`** in
    `route.debugTrainerSprites()` reports `distance >= 2` and `visible === false`.
    **Measurement:** the two fields of the scene's own accessor, on the first `trainers`
    room of map 1 (`teleportToRoom(r)` for `r = 0 .. debugRouteContext().roomCount - 1`,
    first room whose `debugTrainerSprites().length > 0`; the player spawns on the room's
    entry, and the population pass keeps every trainer at least three tiles from it).
  - [ ] `[live]` The hide is the archetype's, not a global one: with the player still at
    `distance >= 2`, `route.debugOverrideTrainer('psychic')` returns `true` and the entry
    whose `archetypeId === 'psychic'` reports `distance >= 2` and `visible === true`.
    **Measurement:** equality on `visible` at the same distance on the same layout.
  - [ ] `[live]` The ninja becomes visible when adjacent: with
    `route.debugOverrideTrainer('ninja')` applied again and `t` the entry whose
    `archetypeId === 'ninja'`, the facing step is
    `v = { x: t.facing === 'E' ? 1 : t.facing === 'W' ? -1 : 0, y: t.facing === 'S' ? 1 : t.facing === 'N' ? -1 : 0 }`;
    `route.teleportToTile(t.x + v.x, t.y + v.y)` returns `{ ok: true }` and the next
    `debugTrainerSprites()` entry with that `id` reports `distance === 1` and
    `visible === true`, and `game.scene.isActive('Battle') === false` (a teleport runs no
    sight check). **Measurement:** equality on `distance`, `visible` and the battle
    scene's activity. The tile ahead of a trainer is walkable by the population pass's own
    `openFacings` rule.

## 📣 Coordination

- **For the Architect / the plan:** this task holds
  `src/data/trainers.ts` (+ test), `src/engine/routes/trainers.ts` (+ test),
  `src/engine/run/battleLink.ts`, `src/engine/run/resolve.ts` (+ test),
  `src/scenes/RouteScene.ts` and three docs' sections — the wider record than the
  one-line table entry for Batch 42, which predates `battleLink.ts` and `resolve.ts`
  (the same way Batch 41's entry predated its four extra paths). `[Task-103]` also
  rewrites the first-win block of `src/engine/run/resolve.ts`, so it now collides with
  this task on a code path as well as on `docs/battle-spec.md` §9.
- **For the next batch:** the frozen seams are
  `specialTrainerFor` / `trainerHidden` / `withForcedAbility` in
  `src/engine/routes/trainers.ts`, `TrainerArchetype.sightMode / forcedAbility / reward`,
  `SPECIAL_TRAINER_ROWS` / `SpecialTrainerRow`, `TrainerRosterEntry.ability` and
  `BattleReward.item`. A later task that adds a set-piece trainer adds **a row to
  `SPECIAL_ARCHETYPES` and a row to `SPECIAL_TRAINER_ROWS`**, never a branch in the
  scene; a later task that wants a different hide distance changes
  `INVISIBLE_REVEAL_DISTANCE` (and its own docs), not the scene.
- **For QA:** the dev-only accessors this task adds are `debugTrainerSprites()` and
  `debugOverrideTrainer(id)`; both are `IS_DEVELOP`-only, both read the live sprite
  list, and `debugOverrideTrainer` changes only the room in memory (never the run, the
  save or the seed).
- **Doc rot, not fixed here:** `src/data/README.md`'s `trainers.ts` line names the
  rocket grunt as *the* set-piece example; the sentence stays true but is now partial.
  It is left for a docs pass because this task adds no file.

## ⛔ Out of scope

- The trainer rooms' composition and count (`TRAINER_ROOMS_PER_MAP`, `[Task-82]`), the
  population pass's placement and pose rules (`src/engine/routes/sketch.ts`), the roster
  sizes, levels and species pool (`[Task-78]`, `D39`).
- The ability registry and any ability handler: Imposter/Transform already ships
  (`transformInto`, `imposter()`); this task adds **no** `effects/abilities.ts` entry and
  **no** coverage row, and does not touch `docs/balance/effect-coverage.md`.
- The battle scene, its feed, its platforms or its trainer art
  (`src/scenes/BattleScene.ts` is read-only here): the trigger's roster already carries
  the stamped ability.
- New art, new items, new i18n keys, new rooms, a `MapRoomSpecial` value, the minimap
  (`src/ui/mapView.ts`), the mission table or its rewards (`[Task-98]`), and the
  `SAVE_VERSION` chain.
- A second special trainer in one room, or a second special trainer per floor: one per
  room, one roll, no re-roll, no fallback room.
- Any change to `src/engine/routes/sketch.ts`, `streams.ts` or the layout/terrain
  streams, and any fixed-seed re-pin anywhere.
