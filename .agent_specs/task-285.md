# Spec: Task-285 — The gym: trainers, the puzzle, the leader and the badge

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule (`src/engine/run/badge.ts`) + Phaser scene
  (`src/scenes/GymScene.ts`).
- **Role:** Dev.
- **Objective:** a gym becomes a place you walk, fight through, puzzle through and win.
  `src/engine/run/badge.ts` owns the badge as a run fact — who hands over which badge, the
  roster a gym's trainers and its leader field, the money and the TM one win pays — and
  `grantBadge` refuses a badge that is not this city's, a badge that would skip the
  ladder's order, and a badge already held (and then it hands back the *same* run).
  `GymScene` draws the gym's own four rooms from `planGym` on the interior tileset, walks
  them with the shared `WorldWalker`, runs the ice room's slide rule through `slideStep`,
  fields the room's trainer and the leader as ordinary `Battle` launches that fold back
  through the shipped `resolveBattle`, writes the gym's solved mark, and walks the player
  back out to the city door it came through. Once the badge is in `RunState.badges`, the
  city's forward exit opens through the shipped `exitGate` — no new gate code.
- **Environment:** worktree `../wt-pkm-285`, branch `task-285`.
- **Dependencies (already merged on `main`; read them, do not re-derive):**
  - `src/engine/region/gym/plan.ts` — `planGym(plan, cityKey)`, `GymPlan`
    (`cityKey`, `interior`, `puzzle.entry`, `puzzle.ice`, `solvedKey`), `gymSolvedKey`,
    `gymSolved(run, gym)`.
  - `src/engine/region/interior/plan.ts` — `InteriorPlan` (`tiles`, `entry`, `returnTo`,
    `slots`, `rooms`), `InteriorRoom` (`index`, `name`, `rect`, `doorIn`), `InteriorSlot`.
  - `src/engine/region/gym/ice.ts` — `IceRoom`, `slideStep(room, from, dir)`,
    `iceCellAt(room, tile)`, `IceLanding`.
  - `src/engine/region/plan.ts` — `planRegion`, `nodeOf`, `RegionPlan`, `RegionNode`
    (`badge`, `cap`, `gym`, `gymDistance`).
  - `src/engine/region/city/plan.ts` — `planCity(plan, key)`, `CityBuilding`
    (`interiorKey`, `door`).
  - `src/engine/region/preload.ts` — `buildNodeMeshes(tiles, tileset, pad?)`, `NodeMeshes`.
  - `src/data/tilesets/interior.ts` — `FRLG_INTERIOR_TILESET`.
  - `src/data/gyms.ts` — `GYMS`, `gymForBadge(badge)`, `GymRow` (`badge`, `leaderId`,
    `archetypeId`, `partySize`, `fixedParty?`, `doubleChance`, `tmItemId`,
    `moneyMultiplier`).
  - `src/data/trainers.ts` — `getTrainerArchetype(id)`, `LeaderIdentity`,
    `leaderIdentity(id)`, `TRAINER_MONEY_BAND_SCALE`, `TrainerItemReward`.
  - `src/data/region.ts` — `BADGE_CAPS`, `badgeCap(badge)`.
  - `src/data/run.ts` — `LevelBand` (the `band` a `GymFoe` carries).
  - `src/engine/map.ts` — `TileMap`, `DOOR`, `tileAt(map, tile)`, `isWalkable`.
  - `src/engine/tileset.ts` — `TILE_SIZE`; `src/engine/grid.ts` — `Tile`.
  - `src/data/keybinds.ts` — `KeybindAction` (the `interact` / `confirm` the scene reads).
  - `src/engine/run/levelCurve.ts` — `leaderLevel(cap)`, `bandForNode(node)`
    (`trainerLevel` is reached through `trainerRoster`'s `node` option, never called here).
  - `src/engine/run/roster.ts` — `trainerRoster(band, rng, idPrefix, { count, levelFor,
    boss, allowMega, node })`, `RosterEntry`.
  - `src/engine/run/gates.ts` — `nextBadge(plan, fromKey)`, `exitGate(plan, from, to,
    badges)` (read only: no new gate).
  - `src/engine/run/state.ts` — `RunState` (`badges`, `defeatedTrainers`, `pickedItems`,
    `bag`, `money`), `createRun`, `isTrainerDefeated`, `markItemPicked`, `itemCount`,
    `hasLivingParty`, `compatForNode` (the test fixtures);
    `src/engine/run/progression.ts` — `createRunPokemon` (the fixture's starter).
  - `src/engine/run/resolve.ts` — `resolveBattle(run, result, reward)`, `BattleReward`
    (`enemyLevels`, `isTrainer`, `trainerId`, `money`, `item` — money and item are paid
    on a **first** win only).
  - `src/engine/run/battleLink.ts` — `BattleLaunch`, `BattleReturn`,
    `battleSeed(runSeed, routeIndex, key)`.
  - `src/engine/rng.ts` — `Rng`, `hashSeed(seed)`.
  - `src/scenes/WorldScene.ts` — `WorldScene` (`drawWorld`, `followCamera`, `centerX/Y`,
    `actorDepth` is exported from it), `WORLD_TRANSITION_MS`.
  - `src/scenes/walker.ts` — `WorldWalker` (`place`, `step`, `tile`, `stepping`),
    `MoveDirection`, `canWalkStep`, `WALK_STEP_MS`, `RUN_STEP_MS`.
  - `src/scenes/CityScene.ts` — the model this task extends: the door hand-off starts the
    scene `interiorSceneKey('gym')` names (`'Gym'`) with `{ run, cityKey, interiorKey }`,
    and `CityScene.init` already accepts `{ run, spawn }`.
  - `src/scenes/LeagueScene.ts` — the model for a battle chain: pause, `scene.launch
    ('Battle', launch)` with `returnScene`, and `applyBattleResult(result)` called back by
    `BattleScene`.
  - `src/scenes/BattleScene.ts` — calls `applyBattleResult(result)` on the scene
    `returnSceneOf(launch)` names, then resumes it.
  - `src/data/playerSprite.ts` — `PLAYER_SPRITE_TEXTURE_KEY`, `PLAYER_SPRITE_WIDTH`,
    `playerSpriteFrame`.
  - `src/data/overworldSprites.ts` — `OVERWORLD_SPRITE_TEXTURE_KEY`,
    `OVERWORLD_SPRITE_WIDTH`, `overworldSpriteFrame(name, facing)`.
  - `src/scenes/BootScene.ts` — `TRAINER_TEXTURE_KEY` (the fallback host sprite).
  - `src/scenes/regionScenes.ts` — the folder registry (`regionSceneKey`,
    `regionSceneClass`); `src/main.ts` is **not** edited.
  - `src/input/input.ts` — `actionKeys`, `subscribeKeybinds`, `KeybindInput`.
  - `src/engine/save.ts` — `loadSave(storage).run`, `storeRun(storage, run)`;
    `src/storage.ts` — `browserStorage()`; `src/settings.ts` — `loadSettings()`.
  - `src/audio/audio.ts` — `playMusic`, `playCue`; cues `menu-music`, `victory`.
  - `src/dev/env.ts` — `IS_DEVELOP`.

### Exclusive paths (single writer)

**Nothing outside this list.**

- `src/scenes/GymScene.ts` (new)
- `src/engine/run/badge.ts` (new)
- `src/engine/run/badge.test.ts` (new)
- `src/engine/run/index.ts` (one added line: `export * from './badge';`, placed right
  after the `./battleLink` line)
- `src/engine/run/README.md` (two added lines, `badge.ts` and `badge.test.ts`, inserted
  right after the `gates.test.ts` line — one role line each, no exported names)
- `docs/region-spec.md` §3 only: one new paragraph block appended at the **end of §3**,
  immediately before the `## 4` heading, with no new heading of its own

Not this task's, though it touches the same feature: `src/scenes/README.md` (this batch's
other task holds it — see Coordination), `src/main.ts` (region scenes self-register),
`src/scenes/CityScene.ts`, `src/scenes/walker.ts`, `src/scenes/WorldScene.ts`,
`src/engine/region/**` (the gym plan, the ice rule and the puzzle stack are merged and
read-only here), `src/data/**`.

### Inputs (read-only)

- `AGENTS.md`, `docs/region-spec.md` §1, §2, §3, §4, §6, §7.2, §7.4, §8.
- The files named under Dependencies.
- **No `design/screens/` frame exists for this screen.** The board holds no city, gym or
  League frame (`design/screens/` lists `01`…`09b`, none of them a settlement or a gym), so
  this screen task names no imported spec and takes its look from §3/§7.2/§7.4 and from
  the shipped `CityScene`/`LeagueScene`. A `[live]` that compares pixels is therefore not
  a criterion (`D57`).

## 🔒 Contract

### `src/engine/run/badge.ts` (new, pure: no Phaser, no DOM, no clock, no storage)

```ts
import type { GymRow } from '../../data/gyms';
import type { LevelBand } from '../../data/run';
import type { TrainerItemReward } from '../../data/trainers';
import type { RegionPlan } from '../region/plan';
import type { RosterEntry } from './roster';
import type { RunState } from './state';

/** One gym fight, resolved to the roster it fields. */
export type GymFoe = Readonly<{
  /** The trainer id it is remembered by in `RunState.defeatedTrainers`. */
  id: string;
  role: 'trainer' | 'leader';
  /** Room 1's trainer is `0`; the leader is `-1`. */
  index: number;
  /** The badge this gym hands over, 1..8: the number `grantBadge` guards. */
  badge: number;
  /** The gym's own `GYMS` row (`src/data/gyms.ts`). */
  row: GymRow;
  /** The archetype whose sprite, AI flags and money base the fight borrows. */
  archetypeId: string;
  /** What the battle prints: the leader's own name, or the archetype's class. */
  name: string;
  /** The band the fight is posted on: the gym city node's own band. */
  band: LevelBand;
  roster: readonly RosterEntry[];
}>;

/** What a beaten gym fight folds into the run (`resolveBattle`'s reward). */
export type GymReward = Readonly<{
  enemyLevels: readonly number[];
  isTrainer: true;
  trainerId: string;
  money: number;
  item?: TrainerItemReward;
}>;

/** The trainer id a gym's leader is remembered by: `gym-leader:<cityKey>`. */
export function gymLeaderId(cityKey: string): string;

/** The trainer id a gym's room-1 trainer is remembered by: `gym-trainer:<cityKey>:<index>`. */
export function gymTrainerId(cityKey: string, index: number): string;

/** True when the run carries `badge`. */
export function hasBadge(run: RunState, badge: number): boolean;

/** The badge the city's gym hands over, or null when the key is no gym city. */
export function gymBadge(plan: RegionPlan, cityKey: string): number | null;

/**
 * Adds `badge` to the run — the ladder's next rung, handed over by the gym the run
 * stands in — or returns the run **it was given** (`===`) when it may not.
 */
export function grantBadge(run: RunState, badge: number): RunState;

/**
 * The gym leader's fight: `count` members at the node's cap, off the gym's own stream.
 * Refuses a key that is not a gym city with `Error("not a gym: <cityKey>")`.
 */
export function gymLeaderFoe(plan: RegionPlan, run: RunState, cityKey: string): GymFoe;

/**
 * The gym's room-1 trainer `index`: the band's own party size at this node's distance.
 * Refuses a key that is not a gym city with `Error("not a gym: <cityKey>")`.
 */
export function gymTrainerFoe(
  plan: RegionPlan,
  run: RunState,
  cityKey: string,
  index: number,
): GymFoe;

/** What a beaten gym fight pays: its roster's levels, the mark, the money, and a leader's TM. */
export function gymReward(foe: GymFoe): GymReward;
```

Rules, all tested:

- **`grantBadge(run, badge)`** appends in order and never twice. In this order:
  1. `badge` not an integer `1..BADGE_CAPS.length` (8) → return `run` (`===`).
  2. `run.badges.includes(badge)` → return `run` (`===`). Idempotence is a reference
     equality, so a second call cannot dirty a save.
  3. `badge !== run.badges.length + 1` → return `run` (`===`): the ladder never skips and
     never fills a gap.
  4. `const plan = planRegion(run.seed); const node = nodeOf(plan, run.nodeKey);` — when
     `node` is undefined, `node.gym` is false, or `node.badge !== badge` → return `run`
     (`===`). The badge's number must be the city's own: the town and a route hand over
     nothing, and `city:2` can never hand over badge 1.
  5. `nextBadge(plan, run.nodeKey) !== badge` → return `run` (`===`). This is
     `src/engine/run/gates.ts`'s shipped rule, quoted, so the badge and the gate on the way
     out of the city can never disagree.
  6. Otherwise `{ ...run, badges: [...run.badges, badge] }`. The list stays ascending and
     deduplicated because of rules 2 and 3.
- **`gymBadge`** is total: the node's `badge` when the plan holds a `city` whose `gym` is
  `true`, `null` otherwise. No throw, no RNG.
- **`gymLeaderFoe(plan, run, cityKey)`** reads the city node, then `gymForBadge(node.badge)`,
  then the archetype (`getTrainerArchetype(row.archetypeId)`), and:
  - `id = gymLeaderId(cityKey)`, `index = -1`, `role = 'leader'`, `badge = row.badge`,
    `archetypeId = row.archetypeId`, `name = leaderIdentity(row.leaderId)?.name ??
    row.leaderId`, `band = bandForNode(node)`, `row`.
  - **`row.fixedParty` present (gym 1)**: `roster = row.fixedParty.map((speciesId, i) => ({
    id: `${id}:${i}`, speciesId, level: leaderLevel(node.cap) }))` — three members, all at
    the cap, and **no draw at all**, so gym 1's team is seed-independent.
  - **otherwise**: `const rng = new Rng(hashSeed(`${run.seed}:gym:${cityKey}:leader`));`
    then `trainerRoster(band, rng, id, { count: row.partySize, levelFor: () =>
    leaderLevel(node.cap), boss: true, allowMega: archetype?.carriesMega === true })` — six
    members, every one at the cap, deterministic for a seed.
- **`gymTrainerFoe(plan, run, cityKey, index)`**: `id = gymTrainerId(cityKey,
  Math.max(0, Math.floor(index)))`, `index` that same non-negative integer,
  `role = 'trainer'`, `badge = row.badge`, `name = archetype?.className ?? archetype?.name
  ?? row.archetypeId`, `band = bandForNode(node)`, and
  `const rng = new Rng(hashSeed(`${run.seed}:gym:${cityKey}:trainer:${safeIndex}`));`
  with `trainerRoster(band, rng, id, { node, allowMega: archetype?.carriesMega === true })`
  — no `count` and no `levelFor`, so the roster is the band's own `trainerSize` at
  `trainerLevel(node.cap, node.gymDistance, size)`, the shipped rule.
- **`gymReward(foe)`** pays what `resolveBattle` pays once:
  `enemyLevels = foe.roster.map((entry) => entry.level)`, `isTrainer: true`,
  `trainerId = foe.id`, `money = gymMoney(foe.archetypeId, foe.band,
  foe.role === 'leader' ? foe.row.moneyMultiplier : 1)`, and **only for a leader**
  `item = { itemId: foe.row.tmItemId, count: 1 }`. `gymMoney` is the **expected value** of
  `trainerMoney`'s roll, exactly as `leagueReward` does it (`src/engine/region/league.ts`):
  `Math.max(1, Math.round((archetype.money.base + archetype.money.jitter / 2) *
  TRAINER_MONEY_BAND_SCALE[band.id] * Math.max(1, multiplier)))`, and
  `Math.max(1, Math.round(band.maxLevel * TRAINER_MONEY_BAND_SCALE[band.id]))` when the
  archetype id resolves to nothing. No clock, no storage.
- **Determinism (`D11`, `D60`):** the only draws in this module are the two roster
  families above, each off `hashSeed` of the run seed **and its own `cityKey` and role**, so
  no generator's stream moves, two gyms never share a draw, and appending a third family
  (an item roll, a doubling roll) could not move the first two. `grantBadge`, `hasBadge`,
  `gymBadge`, `gymLeaderId`, `gymTrainerId` and `gymReward` **read no RNG**.
- `src/engine/run/index.ts` re-exports the module (the one added line).

### `src/scenes/GymScene.ts` (new)

```ts
import type { MoveDirection } from './walker';

export const regionSceneKey = 'Gym';

/** The scene key a gym battle returns to. */
export const GYM_RETURN_SCENE = 'Gym';

/** What the debug/dev browser pass reads. */
export type GymDebugState = Readonly<{
  /** The gym's city node key, `city:1`; `''` before the plan resolves. */
  key: string;
  tile: { x: number; y: number };
  /** The gym room the player stands in, `0..3` (`entrance`, `trainer`, `puzzle`, `leader`); `-1` off the plan. */
  room: number;
  /** How many rooms the gym's own plan holds: `4`. */
  rooms: number;
  /** The puzzle's stack entry id: `'ice'`. */
  puzzle: string;
  /** The door the player enters the puzzle room through, or null. */
  puzzleDoor: { x: number; y: number } | null;
  /** The door that leads into the leader's room, or null. */
  leaderDoor: { x: number; y: number } | null;
  /** True when the run carries `gym-solved:<key>`. */
  solved: boolean;
  /** Slides and hole falls played since this scene started. */
  slides: number;
  falls: number;
  /** The regular trainers still unbeaten, with the tile each stands on. */
  trainers: readonly { index: number; id: string; tile: { x: number; y: number } }[];
  /** The leader: its id, its tile, and the roster it fields. */
  leader: { id: string; tile: { x: number; y: number }; size: number; levels: readonly number[] };
  /** The run's badges, and the ladder's width (`BADGE_CAPS.length`). */
  badges: readonly number[];
  badgeTotal: number;
  /** The gym's one way out: the door the player arrived on. */
  entry: { x: number; y: number };
  /** True while a step's tween is in flight. */
  stepping: boolean;
  fighting: boolean;
}>;

export class GymScene extends WorldScene {
  /** `'Gym'` — the key `interiorSceneKey('gym')` names. */
  constructor();
  init(data?: { run?: RunState; cityKey?: string; interiorKey?: string }): void;
  create(): void;
  update(time: number, delta: number): void;
  /** Called by `BattleScene` before it stops: folds the fight and marks what it left. */
  applyBattleResult(result: BattleReturn): void;
  /** Opens the room-1 trainer `index`'s battle; false when there is none to open. */
  startTrainerFight(index: number): boolean;
  /** Opens the leader's battle; false when there is no leader left or no plan. */
  startLeaderFight(): boolean;
  /** Walks back out to the city door the gym was entered through; false when refused. */
  exitToCity(): boolean;
  /** Dev only. */
  debugGymState(): GymDebugState;
  /** Dev only: stands the player on `tile` and lets that tile's own landing rule answer. */
  placePlayer(tile: Tile): void;
  /** Dev only: one step through the same dispatch `update` uses; false when nothing moved. */
  stepDirection(direction: MoveDirection): boolean;
}

export const regionSceneClass = GymScene;
```

Behaviour:

- **Entry.** `init` takes `{ run, cityKey, interiorKey }` (the payload `CityScene`'s door
  already sends) and keeps `run`; `interiorKey` is carried by the seam and unused (the scene
  *is* the gym). A missing `run` falls back to `loadSave(browserStorage()).run`; an absent
  `cityKey` falls back to that run's own `nodeKey`. No run at all →
  `this.scene.start('MainMenu')` and return.
- **The plan.** `create` plans `planRegion(run.seed)` and `planGym(plan, cityKey)` inside one
  `try`, because `planGym` throws `not a gym: <key>`; a throw is a `console.warn` and an
  empty camera, never a crash (the `CityScene` rule). Nothing is cached between entries: a
  revisit recomputes the same deep-equal plan (§7.4).
- **The draw.** The gym is not a region node, so there is no worker and no `preload`:
  `this.drawWorld({ tiles: gym.interior.tiles, meshes:
  buildNodeMeshes(gym.interior.tiles, FRLG_INTERIOR_TILESET), tilesetId: 'interior' })`.
  `drawWorld` sets the camera's bounds; `camera.fadeIn(WORLD_TRANSITION_MS)` opens the
  screen. The texture is already loaded (`BootScene` loads every `TILESET_IDS` entry).
- **The player.** The player sprite (`PLAYER_SPRITE_TEXTURE_KEY`, `playerSpriteFrame('down')`,
  `TILE_SIZE / PLAYER_SPRITE_WIDTH`, origin `0.5, 1`) is placed on `gym.interior.entry`
  through a `WorldWalker(this, sprite, gym.interior.tiles, { onStep: (_from, to) =>
  this.landed(to) })`, with `actorDepth(sprite.y)` and `followCamera(sprite)`.
- **The hosts.** One sprite per slot of `gym.interior.slots` whose role is `trainer` or
  `leader` **that the run has not beaten** (`isTrainerDefeated(run, gymTrainerId(gym.cityKey,
  i))` / `gymLeaderId(gym.cityKey)`), drawn exactly as `RouteScene.drawTrainer` draws a
  route trainer: `getTrainerArchetype(gymForBadge(node.badge).archetypeId)` gives the
  sprite key and colour, `overworldSpriteFrame(spriteKey ?? '', 'down')` the frame, on
  `OVERWORLD_SPRITE_TEXTURE_KEY` at `centerX(tile.x)` and `centerY(tile.y) + TILE_SIZE / 2`,
  scaled `TILE_SIZE / OVERWORLD_SPRITE_WIDTH`, origin `0.5, 1`, `actorDepth(footY)`; the
  `TRAINER_TEXTURE_KEY` stand-in tinted the archetype's `colour` when the sheet has no
  frame. A beaten host is not drawn: re-enter the gym and it is gone.
- **Walking.** `update` hands ordinary walking to the shared walker and takes over only in the
  ice room:
  - nothing happens while `this.foe !== null`, `this.leaving` or `this.walker === null`;
  - while the player does **not** stand on an ice cell, the scene calls
    `this.walker.update(delta, running)` and touches nothing else — the walker's own tween
    cadence, walk cycle, corner-cut rule and run speed stay the single source of movement.
    `running = settings.alwaysRun || runKey.isDown`, with `runKey` taken **once in `create`**
    as `actionKeys(this, 'run', settings.keybinds)[0]` (the accessor reads the bindings at
    call time, not per frame);
  - while the player **does** stand on an ice cell (`iceCellAt(gym.puzzle.ice, walker.tile)
    === 'ice'`) the walker is not updated at all and the scene drives the press:
    - the direction is polled from four `Phaser.Input.Keyboard.Key[]` pairs taken once in
      `create` with `actionKeys(this, 'up' | 'down' | 'left' | 'right')`, in the walker's own
      precedence — **left, right, up, down**, `isDown || JustDown` — because two readers of
      the same keys must agree;
    - one press is one slide: `time < this.nextStepAt` returns, otherwise
      `this.nextStepAt = time + (running ? RUN_STEP_MS : WALK_STEP_MS)` and one slide runs;
    - a direction the slide refused (it did not move) is remembered in `this.blocked` and not
      re-asked until the key is released or another is pressed, so a held key allocates
      nothing per frame;
  - one press is one tile: the walker's tween for an ordinary step, one `walker.place` for a
    slide, and `sprite.setDepth(actorDepth(sprite.y))` after either.
- **The ice room (`docs/region-spec.md` §7.4).** When `gym.puzzle.ice !== null`:
  - a step whose target tile is a `DOOR` (`tileAt(gym.interior.tiles, target) === DOOR`) is an
    ordinary one-tile walk even from an ice cell: the doors sit on the room's wall ring, so
    `slideStep` sees them as `solid` and could never end on one, and the player must be able
    to reach them to leave the room;
  - otherwise, from an ice cell, the press is `slideStep(ice, walker.tile, direction)`: a
    `landing` places the player on `landing.tile` and increments `falls`; any other result
    places the player on `result.stop` and increments `slides`; a `stop` equal to the tile
    the player stood on is a refusal and sets `blocked`;
  - the room's own `holes`/`landings` decide everything: the scene adds no geometry, fixes no
    hole and re-rolls nothing.
- **The solved mark.** A landed step whose destination lies in `gym.interior.rooms[3]`
  (the `leader` room's `rect`) and whose run does not carry `gym.solvedKey` sets
  `this.run = markItemPicked(this.run, gym.solvedKey)` and persists. Room 3 is reachable
  only through room 2 (§7.2: the entrance/leader wall is never opened), so the mark is proof
  the room was crossed. `debugGymState().solved` reads `gymSolved(this.run, gym)` — the
  run's fact, never a local flag. The slide rule applies whether or not the room is
  already marked: the floor is the floor.
- **The fights.** `subscribeKeybinds(this, ({ action }) => this.handleAction(action))`:
  `interact` or `confirm`, while `this.scene.isActive()` and no fight is open, starts the
  fight of the unbeaten host the player stands **on or next to** (the four orthogonal
  neighbours, or the host's own tile — the hosts are markers, not walls).
  `startTrainerFight(index)` / `startLeaderFight()` resolve the foe
  (`gymTrainerFoe`/`gymLeaderFoe`), refuse (`false`) when it is already beaten or a fight is
  open, store it in `this.foe`, `this.scene.pause()`, and
  `this.scene.launch('Battle', launch)` with:
  `trigger: { kind: 'trainer', trainerId: foe.id, trainerName: foe.name, roster:
  foe.roster, archetypeId: foe.archetypeId }`, `player: run.party.map((m) => m.fighter)`,
  `bag: run.bag`, `xp: run.xp`, `seed: battleSeed(run.seed, run.routeIndex, foe.id)`,
  `runSeed: run.seed`, `routeIndex: run.routeIndex`, `canCapture: false`, `firstCatch:
  false`, `aiLevel: loadSettings().aiLevel`, `returnScene: GYM_RETURN_SCENE`. No
  `battlefield`, no `noHeal`, no `double`.
- **The fold.** `applyBattleResult(result)`: `resolveBattle(this.run, result,
  gymReward(fight.foe))`; then, on `result.outcome === 'win'` **and a leader fight**,
  `this.run = grantBadge(this.run, fight.foe.badge)`. `this.persistRun()` runs before any
  hand-off. No living party left → `this.scene.start('RunOver', { run, won: false })` and
  stop. A win plays `playCue(this, 'victory')`; a loss or a flee leaves the host unbeaten,
  so the press opens the same fight again. `redrawHosts()` drops and redraws the host
  sprites from the run (a beaten host disappears).
- **The way out.** A landed step onto `gym.interior.entry` (the door the player arrived on,
  never the arrival itself, which is a `place`) calls `exitToCity()`: persist, then
  `this.scene.start('City', { run: this.run, spawn: door })` where `door` is
  `planCity(plan, cityKey).buildings.find((b) => b.interiorKey === 'gym')?.door` when the
  city holds one (so the player stands back on the gym's door, `CityScene.spawnFor` reads
  it). The gym's own way out is never locked; what the badge opens is the **city's** forward
  band, through the shipped `exitGate` — this scene writes no gate code.
- The gym **heals nothing** and shows no shop (§6 puts the heal at the Centre, `[Task-292]`),
  draws no HUD panel of its own (the route's panel layer owns the header; the badge reaches
  it through the run's `badges`), and prints no text, so it adds no i18n key and no literal
  (`D43`). Music: `playMusic(this, 'menu-music')` on `create` and again on the scene's
  `RESUME` event, so the bed comes back after a battle.
- `IS_DEVELOP`: `globalThis.__pkmGym = this` on `create`, deleted on `SHUTDOWN`, plus
  `debugGymState()`, `placePlayer(tile)` and `stepDirection(direction)` — the last one is one
  `walker.step` off the ice and one `slideStep` on it, with no key press and no cadence. The
  accessor answers `leader.size`/`leader.levels` from `gymLeaderFoe(plan, run, cityKey)`,
  whose roster is a function of the seed alone, so a repeated read is deep-equal; `solved`
  comes from `gymSolved(run, gym)`, never from a field of the scene.
- It registers itself through `regionSceneKey`/`regionSceneClass` alone: `src/main.ts` is not
  edited. It must import cleanly under the minimal Phaser mock `src/scenes/regionScenes.test.ts`
  installs, which loads every `*Scene.ts` in the folder eagerly — no Phaser API call at module
  scope beyond subclassing `Scene`.

### Docs (`docs/region-spec.md` §3, one block)

Append **one** paragraph block to the end of §3, after the table's closing prose (the
paragraph ending "…reads the ladder.") and immediately before the `## 4` heading, with **no
new heading** of its own. It states, in the spec's voice:

- a gym hands its badge over only from **its own city**: `grantBadge(run, badge)` appends the
  ladder's next rung and refuses a badge that is not the city's, one that would skip a rung,
  one already held (returning the same run) and any badge asked of the town or a route;
- the badge is the very number `exitGate` reads (§4), so a city's forward band opens the
  moment `badges` carries it;
- a gym's fights use §3's own level rules — the leader at `leaderLevel(cap)` (the cap
  itself, a fixed party when the row names one), a room-1 trainer at `trainerLevel(cap,
  gymDistance, size)` — and the badge pays the row's `tmItemId` and its money (the
  archetype's base plus half its jitter, at the band's scale, times `moneyMultiplier`)
  **once**: a second win over the same leader pays nothing;
- the gym's facts are run facts in the fields §8 already lists: the leader and its trainers
  are marked in `defeatedTrainers` as `gym-leader:<cityKey>` and `gym-trainer:<cityKey>:<n>`,
  and the solved room is §7.4's `gym-solved:<cityKey>` in `pickedItems`, written the first
  time the player reaches the leader's room, so a revisit replays the room and re-pays
  nothing.

## 🧩 Data and configuration

This task introduces **no** JSON entry, key, default, balance value, asset, packer or i18n
string, and `RunState` gains no field: what it writes are run facts in fields that already
exist, with the exact shapes the save's §8 rules decode.

| field | value this task writes | meaning |
| --- | --- | --- |
| `RunState.badges` | `[1]`, `[1, 2]`, … (ascending, deduplicated, each = held + 1) | badge `n` is `city:n`'s gym, handed over by the gym's leader |
| `RunState.defeatedTrainers` | `gym-leader:<cityKey>`, `gym-trainer:<cityKey>:<n>` | one entry per beaten gym host, written by `resolveBattle`'s `trainerId` |
| `RunState.pickedItems` | `gym-solved:<cityKey>` | §7.4's solved-room mark, written once, on the first arrival in the leader's room |
| `RunState.bag` | the row's `tmItemId` at `count: 1` | the TM the badge pays, through `resolveBattle`'s `item` |
| `RunState.money` | `+ gymReward(foe).money` | the leader's payout, once |

Levels and payouts are read, never re-tuned: `leaderLevel(node.cap)` for a leader,
`trainerLevel(node.cap, node.gymDistance, size)` through `trainerRoster`'s `node` option for a
room trainer, `TRAINER_MONEY_BAND_SCALE` × the archetype's `money` × the row's
`moneyMultiplier` for the payout, and `GYMS`'s `tmItemId` for the machine.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including `src/engine/run/badge.test.ts`.
  - `npx vitest run src/engine/run/badge.test.ts` — the task's own file alone.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-285` audit against the exclusive paths list.
  - Browser (for the two `[live]` criteria): `npm run assets:pack` (`$ASSETS_ROOT`), then
    `npm run dev -- --port <free> --strictPort --host 127.0.0.1` and a headless Chromium
    over CDP at **1280×800**. The page can `await import('/src/ui/regionMap.ts')`,
    `await import('/src/engine/region/plan.ts')`, `await import('/src/engine/run/gates.ts')`,
    `await import('/src/engine/run/badge.ts')`, `await import('/src/engine/save.ts')` and
    `await import('/src/storage.ts')`, plus
    `await import('/src/engine/region/travel.ts')` for `canTravel`, to read the pure views
    the scene feeds. A fight opened
    by `startTrainerFight`/`startLeaderFight` leaves the real `Battle` scene on screen; stop
    it and resume the gym (`__pkmGym.scene.stop('Battle'); __pkmGym.scene.resume('Gym')`)
    between reads — every measurement is of the run and of the gym's own fields, never of the
    battle's.
- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` is clean (typecheck + bundle).
  - [ ] `[unit]` `npx vitest run src/engine/run/badge.test.ts` passes, and it covers:
    `gymLeaderId('city:1') === 'gym-leader:city:1'` and
    `gymTrainerId('city:1', 0) === 'gym-trainer:city:1:0'`, both carrying the gym's own city
    key so two cities' ids can never collide.
  - [ ] `[unit]` `grantBadge` appends in order and never skips: a run on `city:1` gets
    `badges === [1]`; the same call on a run already holding `[1]` returns the **same object**
    (`toBe`) and still `[1]`; a run on `city:1` asked for badge `2`, `0` or `9` is unchanged
    (`toBe`); a run on `city:2` holding `[]` is refused for badge `2`; three successive
    grants on `city:1`, `city:2`, `city:3` yield `[1, 2, 3]`; a run on `town:1` and one on
    `route:1` are refused badge `1`.
  - [ ] `[unit]` `gymBadge(planRegion('task-285'), key)` is `1` for `city:1` and `null` for
    `town:1`, `route:2` and `league:1`.
  - [ ] `[unit]` `gymLeaderFoe` on `city:1` at a fixed seed: `id === 'gym-leader:city:1'`,
    `role === 'leader'`, `badge === 1`, `roster.length === 3`, species `['geodude',
    'machop', 'onix']`, every level `leaderLevel(badgeCap(1)) === 9`, `archetypeId ===
    'blackbelt'`; on `city:2`: `roster.length === 6`, every level `badgeCap(2) === 16`,
    two calls deep-equal, and a second run seed changes the species list.
  - [ ] `[unit]` `gymTrainerFoe(plan, run, 'city:1', 0)`: `id === 'gym-trainer:city:1:0'`,
    `role === 'trainer'`, roster length `1` at level `9`; `gymTrainerFoe` on `town:1` throws
    `/not a gym: town:1/`.
  - [ ] `[unit]` A leader win pays exactly once: folding the **same** win twice through
    `resolveBattle(run, win, gymReward(foe))` plus `grantBadge(next, foe.badge)` leaves
    `badges === [1]`, `itemCount(bag, 'tm058') === 1` and `money` raised by exactly
    `gymReward(foe).money` once; `gymReward` of the trainer foe carries no `item`.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched: `git diff --name-only
    main...task-285` lists exactly `src/scenes/GymScene.ts`, `src/engine/run/badge.ts`,
    `src/engine/run/badge.test.ts`, `src/engine/run/index.ts`, `src/engine/run/README.md` and
    `docs/region-spec.md`; `git diff main...task-285 -- docs/region-spec.md` has exactly one
    hunk, sitting between §3's last paragraph and the `## 4` heading, so §5, §7.5 and §7.6
    are byte-identical to what the previous batches wrote.
  - [ ] `[live]` At 1280×800, with a live run started on `city:1`
    (`__pkmRoute.scene.start('Gym', { run: { ...__pkmRoute.run, nodeKey: 'city:1' },
    cityKey: 'city:1', interiorKey: 'gym' })`): `__pkmGym.debugGymState()` reads
    `key === 'city:1'`, `rooms === 4`, `puzzle === 'ice'`, `solved === false`, `badges`
    deep-equal `[]`, `badgeTotal === 8`, `trainers.length === 1` (one id
    `gym-trainer:city:1:0`), `leader.size === 3` and `leader.levels` deep-equal `[9, 9, 9]`;
    `startTrainerFight(0)` sets `fighting === true`, folding a win
    (`applyBattleResult({ outcome: 'win', message: '', player: __pkmGym.run.party.map((m) =>
    m.fighter), bag: __pkmGym.run.bag, captured: null })`) leaves `trainers` empty and
    `__pkmGym.run.defeatedTrainers` holding `gym-trainer:city:1:0`; then `startLeaderFight()`
    sets `fighting === true`, folding a win gives `badges` deep-equal `[1]`, `badgeTotal ===
    8`, the bag's `tm058` stack a count of exactly `1` (`__pkmGym.run.bag.find((slot) =>
    slot.itemId === 'tm058')?.count`), `__pkmGym.run.money` raised by exactly
    `gymReward(gymLeaderFoe(planRegion(seed), run, 'city:1')).money`, and the header card's
    own view read on the page — `regionMapView(planRegion(seed), __pkmGym.run)` — answers
    `badges === 1` and `badgeTotal === 8`; a second `startLeaderFight()` returns `false` and
    `badges` stays `[1]`; the city's way forward, read on the page, is now
    `canTravel(plan, __pkmGym.run, 'route:2', 'walk').ok === true` while the same call on
    `{ ...__pkmGym.run, badges: [] }` answers `{ ok: false, reason: 'gate', badge: 1 }`.
  - [ ] `[live]` At 1280×800 on the same gym: `placePlayer(debugGymState().puzzleDoor)` then
    `stepDirection('down')`, waiting until `debugGymState().stepping === false` (one
    `WALK_STEP_MS` = 200 ms), steps onto an ice cell, and a second `stepDirection('down')`
    makes `slides + falls === 1` (one slide or one hole fall — either is one press);
    `placePlayer(debugGymState().leaderDoor)` then `stepDirection('left')`, again waiting for
    `stepping === false`, sets `solved === true`, and
    `loadSave(browserStorage()).run.pickedItems` (or a reload of the page's run) still
    contains `gym-solved:city:1` — the mark is persisted, not a screen flag.
- **A `[live]` that compares pixels is not a criterion** (`D57`): no frame exists for this
  screen, and none is invented.

## 📣 Coordination

- **`src/scenes/README.md` is not this task's path.** The folder map owes a `GymScene.ts`
  line and has none today (it carries `CityScene.ts` and `walker.ts` only). `Task-289`, which
  holds that path in this batch, adds it; the exact line is:
  ``- `GymScene.ts` — a gym as a place you walk: the four rooms drawn from the interior plan on the interior tileset, the ice room's slide rule read from `planGym`, the room's trainer and the leader fought on the interact key, the leader's badge, TM and money folded through the run's reward, the solved mark in `pickedItems` and the door back to the city. Its dev-only surface is `__pkmGym` with `debugGymState`, `placePlayer`, `stepDirection`, `startTrainerFight` and `startLeaderFight`.``
  The same file still owes the League its line from the previous batch:
  ``- `LeagueScene.ts` — the League's five fights as one chain: the entry heal, the next unbeaten row's battle, the heal after every win and the tower door that opens only once the Champion has fallen. Its dev-only surface is `__pkmLeague` with `debugLeagueState`.``
- **Integration QA.** `src/scenes/regionScenes.test.ts` imports every `*Scene.ts` in the
  folder eagerly under a minimal Phaser mock; `GymScene.ts` must therefore import cleanly
  there (it already imports what `CityScene`/`LeagueScene`/`RouteScene` import). The
  `docs/region-spec.md` diff must land inside §3 only, and §7.5 / §7.6 must be byte-identical
  to what the previous batch wrote.
- **For the next batch.** `CityScene`'s door hand-off already starts `'Gym'` with
  `{ run, cityKey, interiorKey }` and falls back to fading in when no such scene exists; this
  scene makes that branch live, so nothing in `CityScene` changes. `[Task-287]`'s
  `InteriorScene` may later generalise the draw/walk half of this scene; until it ships,
  `GymScene` owns its own `drawWorld` call and its own `planGym` read. `[Task-292]` owns the
  Centre's services: the gym heals nothing.
- **For the Architect (two facts read off `main`).**
  1. The plan's `[live]` says the badge lands "in the header (1/8)"; a node scene draws no
     HUD (`CityScene`'s rule, kept here), so the spec measures the header's **own pure view**
     — `regionMapView(plan, run)` → `badges: 1`, `badgeTotal: 8` — instead of a mounted DOM
     card.
  2. `src/engine/region/gym/ice.ts` places holes anywhere at Manhattan distance ≥ 2 from the
     room's **entry** door and never excludes the cell east of the **exit** door
     (`rooms[3].doorIn`), which is the only approach to the leader's room. A hole there
     leaves that room unreachable, so a seed can ship an unsolvable gym. It is outside this
     task's paths; the next task that owns `ice.ts` should exclude that cell.

## ⛔ Out of scope

- Any change to `src/engine/region/**` (the gym plan, the ice rule, the puzzle stack, the
  travel seam, `planRegion`), to `src/data/**`, to `src/main.ts`, to `CityScene`, `walker.ts`,
  `WorldScene`, `BattleScene` or the HUD/panel layer.
- `src/scenes/README.md`, `src/engine/region/README.md`, `docs/region-spec.md` outside §3,
  every other `docs/*.md`.
- Interior scenes other than the gym (`InteriorScene`, the Centre, the laboratory, the
  houses, the casino): `[Task-287]`'s.
- The gym's double battle (`GymRow.doubleChance` stays unread by this task), trainer line of
  sight, NPC dialogue, the badge notice/`t()` copy, the Centre's heal, the shop, the catch,
  wild encounters, missions and the tower.
- A retry/reset affordance inside the puzzle room beyond walking back into it, and any
  change to the ice floor's geometry.
- New dependencies, assets, packers, i18n keys or balance numbers.
