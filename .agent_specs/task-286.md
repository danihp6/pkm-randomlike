# Spec: Task-286 — The League: four, a Champion, and a heal between each

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule + Phaser scene.
- **Role:** Dev.
- **Objective:** the League becomes a real finale. `src/engine/region/league.ts` owns its
  five fights as a pure rule — the next unbeaten row, the roster it fields at
  `LEAGUE_LEVEL`, the full heal between two fights that never revives a fallen member,
  the mark a win leaves and the fact the way out only opens once the Champion has
  fallen. `LeagueScene` plays them as one chain with no exit: it heals on entry, starts
  the next row's battle the moment the previous one is folded back, lets the bag work,
  sells nothing, and ends the run on a wipe.
- **Environment:** worktree `../wt-pkm-286`, branch `task-286`.
- **Dependencies (already merged on `main`; read them, do not re-derive):**
  - `src/data/league.ts` — `LEAGUE: readonly LeagueRow[]` (five rows, `index` 1..5,
    `title`, `name`, `className`, `archetypeId`, `type`, `partySize`, `level`).
  - `src/data/region.ts` — `LEAGUE_LEVEL`, `BADGE_CAPS`.
  - `src/engine/region/plan.ts` — `planRegion`, `nodeOf`, `RegionPlan`, `RegionNode`.
  - `src/engine/run/roster.ts` — `trainerRoster(band, rng, idPrefix, { count, levelFor })`
    and `RosterEntry`.
  - `src/engine/run/heal.ts` — `healParty(run)` (rests party + box, never revives).
  - `src/engine/run/resolve.ts` — `resolveBattle(run, result, reward)`,
    `BattleReturn`/`BattleReward`.
  - `src/engine/run/state.ts` — `RunState`, `markTrainerDefeated`, `isTrainerDefeated`,
    `hasLivingParty`, `squadLevel`.
  - `src/engine/run/battleLink.ts` — `BattleLaunch` with `returnScene`.
  - `src/scenes/BattleScene.ts` — returns to `returnSceneOf(launch)` and calls
    `applyBattleResult(result)` on it.
  - `src/scenes/regionScenes.ts` — the folder registry (`regionSceneKey`,
    `regionSceneClass`).
  - `src/scenes/RouteScene.ts` — how a scene builds a `BattleLaunch` and folds a result
    (read it; do not edit it). Its `league` → `'League'` arrival hand-off lands in this
    same batch, written by a batch-mate in its own task: on your branch the hand-off is
    still missing and `RouteScene.ts` is **not** yours to edit. Build the scene so it
    runs when started directly (`scene.start('League', { run })`); the hand-off appears
    at integration.
  - `src/audio/audio.ts` — `playMusic`, `playCue`.

### Exclusive paths (single writer)

**Nothing outside this list.**

- `src/scenes/LeagueScene.ts`
- `src/engine/region/league.ts`
- `src/engine/region/league.test.ts`
- `src/engine/region/index.ts`
- `src/engine/region/README.md`
- `docs/region-spec.md` §7.6 only (create it; do not touch §7.5 or any other section)

### Inputs (read-only)

- `AGENTS.md`, `docs/region-spec.md` §1, §3, §6, §7.
- The engine and scene files named under Dependencies.

## 🔒 Contract

### `src/engine/region/league.ts` (new, pure: no Phaser, no DOM, no clock)

```ts
import type { Rng } from '../rng';
import type { RunState } from '../run/state';
import type { RosterEntry } from '../run/roster';
import type { RegionPlan } from './plan';
import type { LeagueRow } from '../../data/league';

/** One League fight, resolved to the roster it fields. */
export type LeagueFoe = Readonly<{
  /** 1..5, the row's own index. */
  index: number;
  row: LeagueRow;
  roster: readonly RosterEntry[];
}>;

/** The trainer id a League row is remembered by: `league:<index>`. */
export function leagueTrainerId(index: number): string;

/** Every row's `leagueTrainerId`, in order. */
export function leagueIds(): readonly string[];

/** How many rows the run has beaten, 0..5 (a prefix: a later win never completes an earlier one). */
export function leagueProgress(run: RunState): number;

/** The next unbeaten row's index (1..5), or null once the Champion has fallen. */
export function leagueNext(run: RunState): number | null;

/** True once every row is beaten. */
export function leagueCleared(run: RunState): boolean;

/** The fight at 1-based `index`: its roster at its own level, off the run's seed. */
export function leagueFoe(plan: RegionPlan, run: RunState, index: number): LeagueFoe;

/** The entry heal: `healParty`, never a revival, and a no-op when nothing is missing. */
export function leagueEnter(run: RunState): RunState;

/** Marks row `index` beaten; idempotent and never out of order. */
export function leagueWin(run: RunState, index: number): RunState;

/** The reward a beaten row folds into the run: its roster's levels, the trainer mark and its money. */
export function leagueReward(foe: LeagueFoe): Readonly<{
  enemyLevels: readonly number[];
  isTrainer: true;
  trainerId: string;
  money: number;
}>;
```

Rules, all tested:

- `leagueFoe(plan, run, index)` rebuilds the roster **deterministically** from the run
  seed: `trainerRoster(bandForNode(leagueNode), rng, 'league:' + index, { count:
  row.partySize, levelFor: () => row.level })`, where the `rng` is a `Rng` seeded off
  `hashSeed(`${run.seed}:league:${index}`)` (or the run's region stream split the same
  way) — one draw family per row, so a replay fields the same five teams and adding a row
  never moves another one (`D11`, `D60`). `levelFor` is the row's own `level`
  (`LEAGUE_LEVEL`), never a band draw.
- `plan` is used only to read the League node (its `cap`/`badge` for the band); a plan
  with no `league` node is a spec bug: build the band from `LEAGUE_LEVEL` rather than
  throwing.
- `leagueProgress` reads `run.defeatedTrainers` for the five ids and counts the **prefix**
  (row *n* counts only when every earlier row is beaten).
- `leagueWin(run, index)` refuses (returns the run unchanged) when `index` is not
  `leagueNext(run)`; otherwise `markTrainerDefeated`. Idempotent on a repeat.
- `leagueEnter(run)` is `healParty(run)`, and it returns the **same object** when
  `healParty` changed nothing.
- `leagueReward(foe)` pays money with the same shape the shipped `trainerMoney` +
  archetype rule uses (`src/data/trainers.ts`'s `getTrainerArchetype(foe.row.archetypeId)`
  and `src/engine/run/reward.ts`), scaled by the League's own band; keep it simple and
  pure, no clock. A Champion pays more than an Elite Four row (its archetype's base does
  that already).
- No RNG outside `leagueFoe`'s roster stream; no draw for a row already beaten unless
  asked.
- `src/engine/region/index.ts` re-exports the module.

### `src/scenes/LeagueScene.ts` (new)

```ts
export const regionSceneKey = 'League';
export const regionSceneClass = LeagueScene;

export class LeagueScene extends Phaser.Scene {
  init(data?: { run?: RunState }): void;
  create(): void;
  /** Called by `BattleScene` before it stops: folds the row's result and starts the next. */
  applyBattleResult(result: BattleReturn): void;
  /** Dev only: what a browser pass reads. */
  debugLeagueState(): Readonly<{
    key: string;
    progress: number;
    next: number | null;
    cleared: boolean;
    foes: readonly number[];
    healed: number;
    paused: boolean;
  }>;
}

/** The scene key a League row's battle returns to. */
export const LEAGUE_RETURN_SCENE = 'League';
```

Behaviour:

- `create`: `run = leagueEnter(init.run)` and persist it, then start the fight at
  `leagueNext(run)`: build `leagueFoe`, and `scene.launch('Battle', launch)` with
  `returnScene: LEAGUE_RETURN_SCENE`, `trigger: { kind: 'trainer', trainerId:
  leagueTrainerId(index), trainerName: row.name, roster: foe.roster, archetypeId:
  row.archetypeId }`, `player: run.party.map((m) => m.fighter)`, `bag: run.bag`, `xp:
  run.xp`, `seed: <a stable per-row battle seed from the run seed>`, `runSeed`, a
  `routeIndex` the engine tolerates, `canCapture: false`, `firstCatch: false`, `aiLevel`
  from the shipped settings reader (the route's own accessor if it can be imported;
  otherwise `'normal'`). The scene pauses itself (the battle takes the screen) and keeps
  the run.
- `applyBattleResult(result)`: fold with `resolveBattle(run, result, leagueReward(foe))`;
  persist; then
  - a **loss** with no living party left: `scene.start('RunOver', { run, won: false })`
    and stop;
  - a **win**: `leagueWin(run, index)`, then heal (`leagueEnter`), then start the next
    row; after the fifth, `leagueCleared(run)` is true, the scene shows its own cleared
    state (a notice is fine: the run's own copy through `t()` — no new literal, reuse an
    existing key or add none) and only then accepts the exit: the exit key travels to
    `tower:1` through the shipped `travel(plan, run, 'tower:1', 'walk')` rule; before the
    Champion, the exit refuses.
  - items stay usable (they are the bag the battle already carries) and there is no shop.
- No capture, no wandering, no NPC. The scene is one chain: entry heal → five fights →
  exit.
- `IS_DEVELOP`: `globalThis.__pkmLeague = this` (deleted on shutdown) and
  `debugLeagueState()` as above.

### Data

- No new table: the five rows are `src/data/league.ts` and the money comes from the
  shipped reward helpers. No new i18n key, no new asset.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test`, `npm run build`.
  - `git diff --name-only main...task-286` against the exclusive paths.
  - Browser: `npm run assets:pack` (`$ASSETS_ROOT`), `npm run dev -- --port <free>
    --strictPort --host 127.0.0.1`, headless Chromium over CDP at 1280×800; canvas read
    through `renderer.snapshotArea` + `getImageData`.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `leagueNext` walks 1→5 and answers null once the Champion is beaten;
    `leagueProgress` counts only the prefix (beating row 3 alone is progress 0).
  - [ ] `[unit]` `leagueFoe` at a fixed seed is deep-equal on two calls, fields
    `row.partySize` members all at `row.level`, and rows 1..5 use five different ids; a
    different run seed changes a row's roster (the seed still fixes it).
  - [ ] `[unit]` `leagueEnter` restores HP/PP/status and never a fainted member (a
    `hp: 0` member stays out) and returns the same object when nothing is missing.
  - [ ] `[unit]` `leagueWin` refuses an out-of-order index, is idempotent, and makes
    `leagueCleared` true only after row 5.
  - [ ] `[unit]` `leagueReward` carries the roster's levels, `isTrainer: true`, the row's
    `leagueTrainerId` and a positive integer `money`.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` At 1280×800: start the League from a live run
    (`__pkmRoute.scene.start('League', { run: { ...__pkmRoute.run, nodeKey: 'league:1' } })`
    on the dev server), with a party member hurt beforehand: `__pkmLeague.debugLeagueState()`
    reads `progress === 0`, `next === 1`, `cleared === false`, `foes === [1,2,3,4,5]`
    and the hurt member's HP is full again (the entry heal, read off the live run); the
    first battle's launch carries `returnScene === 'League'` and a roster of
    `LEAGUE[0].partySize` members at `LEAGUE[0].level` (read the launched scene's
    `state.sides.enemy.party` once the battle is up); folding a win through
    `applyBattleResult` (or finishing the fight) advances `next` to 2 and heals again;
    the exit is refused before the Champion (`travel(plan, run, 'tower:1', 'walk')` is not
    `ok: true` at progress 4) and `cleared === true` after row 5.
- **A `[live]` that compares pixels is not a criterion** (`D57`).

## 📣 Coordination

- The gym and the city scenes are separate tasks: no shared path.
- The League scene is registered by the folder registry alone (`regionSceneKey` /
  `regionSceneClass`), and `RouteScene` already hands `league` nodes off to the key
  `'League'`.
- For the Architect: the plan's `[live]` asked for "the tower node appears on the region
  map after the Champion"; the region map draws every node from the first frame, so this
  spec measures the tower's **exit** instead (refused until `leagueCleared`), which is
  the rule the plan's prose describes.

## ⛔ Out of scope

- The gym, the badge rules, the city, the interiors, the prologue, the NPCs, the tower's
  own streak and scenes, the tower scene itself.
- The missions, the shop, the capture rule, the encounters.
- Any HUD panel, notice strip, i18n key, asset or balance table.
