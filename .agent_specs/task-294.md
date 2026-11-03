# Spec: Task-294 — The Champion opens the tower, and the run ends only when the party does

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule + Phaser scenes + one docs section.
- **Role:** Dev.
- **Objective:** after this task the region has an **endless tower** that the Champion
  opens and nothing else does. The plan already holds the node (`tower:1`, the last
  link of `planRegion`'s spine) and the region map already draws every plan node, so
  what this task builds is the **way in** and the **rule that plays it**: a new pure
  `src/engine/region/tower.ts` answering the next level-60, five-member, leaderless
  trainer fight off its own rung stream, bumping the run's `towerStreak` per win,
  healing between fights the League's way, and ending the run when and only when the
  party has nobody living left. `LeagueScene` plays it as its own endless mode (the
  tower has no world and no carver, so it is never a route), `src/engine/run/history.ts`
  records the streak beside the badge count, and `RunOverScene` draws the defeat card
  with the record's figures — the badge count and the streak — and has no victory
  state at all.
- **Environment:** worktree `../wt-pkm-<ID>` (here `../wt-pkm-294`), branch `task-294`.
- **Dependencies:** all three are merged on `main` and are read, never edited:
  - the League — `src/engine/region/league.ts` (`leagueCleared`, `leagueNext`,
    `leagueProgress`, `leagueEnter`, `leagueWin`, `leagueReward`, `LeagueFoe`) and
    `src/scenes/LeagueScene.ts` (Batch 121);
  - the schema — `src/engine/run/state.ts`'s `RunState`, which already carries
    `towerStreak: number` and `badges: readonly number[]` (Batch 119);
  - the record — `src/engine/run/history.ts`'s `RunHistoryRecord` / `makeHistoryRecord`
    and `src/engine/save.ts`'s `parseHistoryRecord` (Batch 119).

### Exclusive paths (single writer)

The list of paths this task creates or modifies. **Nothing outside this list.** No
other task in the batch may claim the same path.

- `src/engine/region/tower.ts` (new)
- `src/engine/region/tower.test.ts` (new)
- `src/scenes/LeagueScene.ts`
- `src/scenes/RunOverScene.ts`
- `src/scenes/RunOverScene.test.ts`
- `src/scenes/RouteScene.ts`
- `src/engine/run/history.ts`
- `src/engine/run/history.test.ts`
- `src/engine/save.ts`
- `src/engine/save.test.ts`
- `src/engine/region/README.md`
- `docs/region-spec.md`

Four of these are additions to the backlog entry's claim list, and each one is here
for a stated reason (the Architect must record them in the batch plan):

- **`src/scenes/RunOverScene.test.ts`** — the scene's own unit test, which exists and
  which gains the criterion for the card's figures. No batch-mate claims it, and a
  scene change whose test is edited by nobody is how a test rots.
- **`src/scenes/RouteScene.ts`** — **one line** in `arrivalSceneFor` (`:609`) so a run
  saved on the tower resumes into `LeagueScene` instead of a floor the plan does not
  hold. It is a hot file and this task is its holder for the batch.
- **`src/engine/save.ts`** — the record's new figure must survive its own decoder: a
  history row with no `towerStreak` in `parseHistoryRecord` would be written and then
  silently dropped on the next load. **`SAVE_VERSION` does not move** (see below).
- **`src/engine/save.test.ts`** — two existing assertions compare decoded history rows
  with `toEqual`; adding a defaulted field makes them fail, so they are updated here.

Explicitly **not** claimed, and why:

- `src/engine/region/index.ts` — the barrel re-exports `plan`, `names`, `streams`,
  `content`, `league` and `travel` **only** (`src/engine/region/README.md`), and every
  consumer in the tree imports a leaf path (`LeagueScene` imports
  `'../engine/region/league'`, not the barrel). `tower.ts` is imported leaf-first the
  same way, so the barrel gains nothing and touching it would mean editing its README
  line for a re-export no file uses.
- `src/engine/run/index.ts` and `src/engine/run/README.md` — a batch-mate owns both.
  Nothing this task needs goes through that barrel: `RunState` is there already,
  `RunHistory` is imported straight from `'./history'` (the `save.ts` precedent), and
  the only caller of `endRun` (`RouteScene.endRun`) passes a `RunState`, which already
  satisfies the widened `RunHistory` structurally.
- `src/data/league.ts`, `src/data/region.ts`, `src/i18n/**` — the `TOWER` row already
  exists with `leaderId: null`, `badge: null` and `partySize: null`; `LEAGUE_LEVEL`
  already exists; and **no i18n key is added** (see Contract → Rules).

### Inputs (read-only)

Files this task may read, and only these, beyond `AGENTS.md` itself.

- `docs/region-spec.md` — §1 (what a region is), §5 (the map and flying), §6 (the
  services), §7.6 (the League, the neighbour section) and §8 (the save's v28 rules).
  The only edit is §7.11 plus its entry in §7's subsection list.
- `docs/tech-decisions.md` — `D5` (permadeath), `D11` (one seed), `D60` (node identity
  and its stream family), `D62` (the record is the badges, the tower's streak is
  apart), `D57` (the board enters as a spec, never a pixel diff).
- `docs/agent-spec-template.md` — this file's shape.
- `TODO.md` — the Batch 123 block (its hot-file list and its `SAVE_VERSION` stance).
- Engine: `src/engine/region/plan.ts`, `src/engine/region/league.ts`,
  `src/engine/region/streams.ts`, `src/engine/region/travel.ts`,
  `src/engine/run/state.ts`, `src/engine/run/history.ts`, `src/engine/run/heal.ts`,
  `src/engine/run/resolve.ts`, `src/engine/run/roster.ts`, `src/engine/run/gates.ts`,
  `src/engine/run/battleLink.ts`, `src/engine/run/progression.ts`,
  `src/engine/run/perms.ts`, `src/engine/rng.ts`, `src/engine/save.ts`.
- Data: `src/data/league.ts`, `src/data/region.ts`, `src/data/run.ts`,
  `src/data/trainers.ts`.
- Scenes and UI: `src/scenes/LeagueScene.ts`, `src/scenes/RunOverScene.ts`,
  `src/scenes/RouteScene.ts` (only `arrivalSceneFor`), `src/scenes/BattleScene.ts` (how
  `applyBattleResult` is called), `src/ui/hud/panels/run-over/view.ts`,
  `src/ui/hud/panels/run-over/mount.tsx`, `src/ui/hud/panels/run-over/preview.ts`,
  `src/ui/regionMap.ts`, `src/ui/runSummary.ts`, `src/i18n/en.ts`, `src/dev/env.ts`,
  `src/settings.ts`, `src/storage.ts`, `src/input/input.ts`, `src/audio/audio.ts`,
  `src/ui/frlg.ts`, `src/ui/frlgFont.ts`.
- `design/screens/06-run-over-defeat.json` and `design/exports/06-run-over-defeat.png`
  — **mandatory**: `src/scenes/RunOverScene.ts` is a routed screen with an imported
  frame, and the frame's `caption` is exactly **`06 Run over · defeat`** (middle dot
  U+00B7 included). The board's figures are the four rows the panel already draws
  (`ROUTES CLEARED`, `POKEMON CAUGHT`, `POKEMON LOST`, `ENEMIES FAINTED`) on the
  `720x480` panel at `280,170`; this task changes *what two of those figures read*, not
  the board's geometry, and the copy comes from `src/i18n/en.ts`. Fidelity is read from
  the JSON, never from a screenshot diff (`D57`).
- `design/screens/07-run-over-victory.json` and `design/exports/07-run-over-victory.png`
  — read **only** to prove what is being retired: the frame `07 Run over · victory` (and
  its `07b Run over · victory · pokemon` twin) must have **no live producer** after this
  task. They are not deleted, not rewritten and not compared.

## 🔒 Contract

The public surface other tasks will be written against in parallel. It is a promise,
not a suggestion. Write the exact exported names and signatures.

### TypeScript

**New: `src/engine/region/tower.ts`** (pure: no Phaser, no DOM, no `localStorage`, no
clock, no `Math.random`).

```ts
import type { TowerRow } from '../../data/league';
import type { RosterEntry } from '../run/roster';
import type { BattleReward } from '../run/resolve';
import type { RunState } from '../run/state';

/** The tower's node: the plan holds exactly one, `tower:1`. */
export const TOWER_NODE_KEY: string; // === nodeKey('tower', 1)

/** One tower fight, resolved to the five-member party it fields. */
export type TowerFoe = Readonly<{
  /** The fight's rung: `streak + 1`, so the first fight after the Champion is 1. */
  rung: number;
  /** `tower:<rung>` — the battle seed's entity key and the mark a win leaves. */
  trainerId: string;
  /** The plan's own name for the node the fight happens on (`'Tower'`). */
  name: string;
  /** The level every member of the party carries: `LEAGUE_LEVEL` (60). */
  level: number;
  /** The shipped `TOWER` row: no leader, no badge, no fixed party. */
  row: TowerRow;
  /** The party it fields, drawn off `${seed}:tower:<rung>`. */
  roster: readonly RosterEntry[];
}>;

/** What a finished tower fight does to the run. */
export type TowerResult = Readonly<{
  /** The run after the fight: the streak bumped on a win, healed; a loss is unchanged. */
  run: RunState;
  /** True exactly when nobody in the party is living: the run is over. */
  over: boolean;
}>;

/** The tower's door: open only once the Champion has fallen (`leagueCleared`). */
export function towerOpen(run: RunState): boolean;

/** The fight after `streak` wins, or null before the Champion down to row 5. */
export function towerStep(run: RunState, streak: number): TowerFoe | null;

/** The run after a won fight: `towerStreak` steps to `streak + 1`, never backwards. */
export function towerWin(run: RunState, streak: number): RunState;

/** The heal between two fights: HP/PP, party and box, no status cure, no revival. */
export function towerHeal(run: RunState): RunState;

/** The whole rule of one finished fight: bump and heal on a win, `over` on a wipe. */
export function towerResolve(run: RunState, foe: TowerFoe, won: boolean): TowerResult;

/** What a beaten tower fight folds into the run through `resolveBattle`. */
export function towerReward(foe: TowerFoe): BattleReward;
```

Rules the four functions must hold, exactly:

- `towerOpen(run)` is `leagueCleared(run)`. Nothing else opens the tower: not the
  streak, not a history row, not the node's presence in the plan, not `badges`.
- `towerStep(run, streak)` answers `null` when `towerOpen(run)` is false. Otherwise
  `rung = Math.max(1, Math.floor(Number.isFinite(streak) ? streak : 0) + 1)`,
  `trainerId = `tower:${rung}``, `name = nodeOf(planRegion(run.seed), TOWER_NODE_KEY)?.name ?? 'Tower'`,
  `level = LEAGUE_LEVEL` (`60`), `row = TOWER`, and
  `roster = trainerRoster(bandForLevel(LEAGUE_LEVEL), new Rng(hashSeed(`${run.seed}:tower:${rung}`)), trainerId, { count: TOWER_PARTY_SIZE, levelFor: () => level })`.
  `TOWER_PARTY_SIZE` is the module constant `5` (see 🧩). No `allowMega`, no `boss`, no
  `node` option: the tower is an ordinary trainer roster.
- `towerWin(run, streak)` sets `towerStreak` to
  `Math.max(run.towerStreak, Math.max(1, Math.floor(streak) + 1))`; a call that would not
  raise it returns the run **by reference**.
- `towerHeal(run)` is `needsHealing(run) ? healParty(run) : run` — the League's own
  entry heal, byte for byte the shape of `leagueEnter`. It never cures a primary status
  and never resurrects a 0-HP member (`D5`), and a run with nothing missing comes back
  as the same object.
- `towerResolve(run, foe, won)` is: `won` → `towerHeal(towerWin(run, foe.rung - 1))`;
  otherwise `run` untouched. `over` is `!hasLivingParty(next)`, read **after** the heal.
  A loss with a living member is not an ending (the same rung is re-fought).
- `towerReward(foe)` is `{ enemyLevels: foe.roster.map((entry) => entry.level), isTrainer: true, trainerId: foe.trainerId }`
  and **no `money` and no `item`**: the endless mode has no shop behind it (see §7.11).
- **Determinism:** the only draw is the rung's roster, off `${seed}:tower:<rung>` — the
  `D60` family keyed by the rung, so rung *n* replays alone and appending a rung cannot
  move an earlier one. `planRegion` inside `towerStep` reads the region's own streams
  and is deterministic; nothing here reads a clock or the world.
- Allocation: one `planRegion` and one roster per call; `towerStep` is called once per
  fight, never per frame.

**Changed: `src/scenes/LeagueScene.ts`** (extend, do not rewrite — it shipped in
Batch 121 and its five-row paint, its exit and its dev surface stay).

```ts
/** Which of the League node's two modes the scene is playing. */
export type LeagueSceneMode = 'league' | 'tower';

/** Dev only: what a browser pass reads. Replaces the shipped shape, one call. */
debugLeagueState(): Readonly<{
  key: string;                 // regionSceneKey ('League')
  mode: LeagueSceneMode;       // 'tower' when run.nodeKey === nodeKey('tower', 1)
  progress: number;            // leagueProgress, 0..5, in both modes
  next: number | null;         // leagueNext in league mode; null in tower mode
  cleared: boolean;            // leagueCleared
  foes: readonly number[];     // LEAGUE's row indices, always
  healed: number;              // how many heals actually rested something, both modes
  paused: boolean;             // this.scene.isPaused()
  streak: number;              // run.towerStreak
  towerOpen: boolean;          // towerOpen(run)
  towerFoe: Readonly<{ rung: number; trainerId: string; name: string; level: number; partySize: number }> | null;
  // towerFoe is the fight in progress (`this.foe`, tower mode), never the next one;
  // partySize is `roster.length` (5). Null when no fight is open or in league mode.
  run: RunState;               // the live run, so a browser pass can seed the next entry
}>;
```

Behaviour, frozen:

- `create` derives `mode` from the run it is handed: `'tower'` iff
  `incoming.nodeKey === nodeKey('tower', 1)`, else `'league'`. Both modes read the run
  the same way (`data?.run`, else `loadSave(browserStorage()).run`). The scene's private
  `TOWER_NODE_KEY` const is deleted in favour of `TOWER_NODE_KEY` from
  `src/engine/region/tower.ts`, so the key is minted once.
- The entry heal is `towerHeal(this.run)` in tower mode and `leagueEnter(this.run)` in
  league mode; `healed` counts the calls that actually rested something, in both.
- League mode is untouched: `leagueNext` starts the next unbeaten row, `applyBattleResult`
  folds with `leagueReward`, `leagueWin`, the heal after a win and the wipe hand-off.
- Tower mode: `create` (and every resumed repaint) starts the fight
  `towerStep(this.run, this.run.towerStreak)` immediately, exactly as the League opens
  its next row. The battle launch is the shipped `BattleLaunch` with
  `trigger: { kind: 'trainer', trainerId: foe.trainerId, trainerName: foe.name, roster: foe.roster }`
  (no `archetypeId`: the tower has no archetype row), `canCapture: false`,
  `firstCatch: false`, `returnScene: LEAGUE_RETURN_SCENE`, and
  `seed: battleSeed(run.seed, run.routeIndex, foe.trainerId)`.
- `applyBattleResult` in tower mode: fold through
  `resolveBattle(run, result, towerReward(foe))`, then
  `towerResolve(folded.run, foe, won)` where `won` is `result.outcome === 'win' || 'capture'`.
  If `over` → paint, set `ending`, `this.scene.start('RunOver', { run: this.run })` and
  return. If `!won` → re-open the **same** rung. If `won` → paint, `playCue(this, 'victory')`
  and open the next rung.
- `exitToTower()` (the shipped name and its docstring's promise): refused in tower mode
  and while a fight is open; otherwise `towerOpen(this.run)` gates it, and it commits
  through `travel(planRegion(run.seed), run, TOWER_NODE_KEY, 'walk')` exactly as today.
  The shipped tail (`scene.start('Route', …)` then `scene.stop()`) is replaced by
  `this.scene.restart({ run: arrived.run })`: the tower has no world and no carver
  (`preloadNode('tower:1') === null`), so the run re-enters **this scene**, whose `init`
  resets `leaving` and whose `create` reads `nodeKey === 'tower:1'` and plays tower mode.
  Do **not** pair a self-`start` with `this.scene.stop()`: `stop` would kill the scene it
  just restarted.
- `paint()` gains one branch: in tower mode it destroys and redraws the panel with the
  tower node's name as the title, one row at `top + PANEL_PADDING + ROW_HEIGHT` whose
  left text is **the streak as a bare figure** (`String(run.towerStreak)`, tinted
  `FRLG_ACCENT`) and whose right text is `t('hud.level', { level: LEAGUE_LEVEL })`
  (tinted `FRLG_MUTED`, origin `[1, 0]`), and **no** cleared footer. `panelWidth` and
  `panelHeight` are computed exactly as shipped, so the panel's box does not move.
- Keybinds: in tower mode a confirm/interact press is refused by `exitToTower()` and
  does nothing else. Music stays `menu-music`; no new cue.
- `debugLeagueState()` is installed on `globalThis.__pkmLeague` exactly as shipped
  (`IS_DEVELOP` only, deleted on `SHUTDOWN`) — this task does not move that.

**Changed: `src/scenes/RunOverScene.ts`** (the end card).

```ts
/**
 * The four figures the card prints, in the panel's own stat order:
 * the record's badge count, the catches, the losses and the tower's streak.
 */
export function runOverStatValues(run: RunState): readonly [number, number, number, number];

/** Dev only: what a browser pass reads off the defeat card. */
debugRunOverState(): Readonly<{
  won: boolean;          // always false: the run has no victory state
  title: string;         // the mounted card's title (runOver.headlineLoss)
  blurb: string;         // runOver.blurbLoss
  badges: number;        // run.badges.length
  towerStreak: number;   // run.towerStreak, floored at 0
  tab: RunOverTab;
  stats: readonly Readonly<{ id: string; value: string }>[];
}>;
```

Behaviour, frozen:

- `init(data: { run: RunState; won?: boolean })` still accepts `won` (the route passes
  it) and **ignores it**: the field is not stored, the view is always built with
  `won: false`. No live path can draw a victory card.
- `view()` is `liveRunOverView(this.run, false, this.tab, keyLabel(...))` with its
  `stats` replaced, row for row, by `runOverStatValues(run)` padded to two figures
  (`String(n).padStart(2, '0')`), and the fourth row's `label` replaced by
  `t('menu.stat.elite')`. Everything else — title, blurb, share, rows, tab labels,
  portraits, button — stays the panel's.
- `id`s stay structural and unchanged: `routes`, `catches`, `lost`, `fainted` — the
  panel's fixture parser (`RUN_OVER_STAT_IDS`) pins exactly these four in this order and
  is not this task's file. The **values** move: `routes` prints the badge count,
  `fainted` prints the streak.
- `debugRunOverState()` reads the same view `mountPanel` mounts; it is registered on
  `globalThis.__pkmRunOver` in `create` under `IS_DEVELOP` and deleted on `SHUTDOWN`,
  the pattern `LeagueScene` already uses. `src/main.ts` is not touched.
- The permadeath clear (`clearRun`), the input delay, the tab keys and the return to the
  main menu are untouched.

**Changed: `src/scenes/RouteScene.ts`** — one line, nothing else:

```ts
private arrivalSceneFor(kind: RegionNodeKind): string | null {
  if (kind === 'town' || kind === 'city') return 'City';
  if (kind === 'league') return 'League';
  if (kind === 'tower') return 'League';   // <- the only added line
  return null;
}
```

and its docstring loses "and the tower" from the kinds this scene keeps. That is the
whole diff: a run the save puts on `tower:1` (Continue → `'Route'`) is handed to
`LeagueScene`, which plays its tower mode.

**Changed: `src/engine/run/history.ts`**

```ts
export type RunHistoryRecord = Readonly<{
  // …unchanged fields…
  /**
   * The tower's own streak, beside the record and apart from it (`D62`): how many
   * tower fights the run won before it ended. Optional only because the shipped
   * history fixtures build a record literal without it; the decoder fills 0 and
   * `makeHistoryRecord` always writes it, exactly like `badges`.
   */
  towerStreak?: number;
}>;

export type RunHistory = Readonly<{
  // …unchanged fields…
  /** The streak the run ended on; `RunState` already satisfies this. */
  towerStreak: number;
}>;
```

`makeHistoryRecord` writes `towerStreak` **beside** `badges` (never folded into it):
`Math.max(0, Math.floor(Number.isFinite(run.towerStreak) ? run.towerStreak : 0))`. Nothing
else in the module changes: no clock, no RNG, no reordering.

**Changed: `src/engine/save.ts`** — inside `parseHistoryRecord` only, one field beside
`mapReached`:

```ts
towerStreak: isInteger(value.towerStreak) && value.towerStreak >= 0 ? value.towerStreak : 0,
```

The required-field checks above it are untouched (a row is still dropped only for the
fields it needed before). **`SAVE_VERSION` stays `28`** and `SAVE_MIGRATIONS` gains
nothing: the field is optional and defaults to `0`, the same shape `mapReached` already
uses, so an old document decodes unchanged and no run is discarded by this task.

**Written: `src/engine/region/README.md`** — exactly two bullets, inserted under
`## Layout` right after the `league.test.ts` bullet, and nothing else in the file (no
exported names, one role line per file, per `AGENTS.md`):

```
- `tower.ts` — the endless node behind the Champion: whether its door is open, the next
  fight at `LEAGUE_LEVEL` off its own rung stream, the streak a win steps, the heal
  between two fights and the fact a wipe is the only ending (`towerStep`, `towerWin`,
  `towerHeal`, `towerResolve`, `towerReward`, `towerOpen`, `TowerFoe`, `TowerResult`,
  `TOWER_NODE_KEY`).
- `tower.test.ts` — the door before and after the Champion, the five-at-60 leaderless
  roster and its replay, the pinned rung digest, the streak and the heal, the wipe that
  ends the run and the reward that pays no money.
```

**Written: `docs/region-spec.md`** — one new section, `### 7.11`, inserted after the last
`### 7.x` (today §7.6, before `## 8`), plus `, §7.11 the tower` appended to §7's
subsection list in the sentence that already ends "`§7.10` the missions' schema". Every
other section — §1-§7.6, the rest of §7, §8 — stays byte-identical. The section's body:

```md
### 7.11 The tower behind the Champion

The tower is the region's one **endless** node, `tower:1`, and its rule is
`src/engine/region/tower.ts`. The plan already holds it — `planRegion` appends it after
the League — and the region map draws it with every other node, because the map is the
straight-line graph of the plan (§5), not a list of what a run has unlocked. What the
Champion opens is the **way in**: the tower's door is `towerOpen(run)`, true exactly when
`leagueCleared(run)` is, and both `LeagueScene`'s exit and `towerStep` read it. Before
the Champion there is no tower fight to ask for.

`towerStep(run, streak)` is the fight after `streak` wins: five members at
`LEAGUE_LEVEL` (60), every level forced by `levelFor`, drawn off one stream per rung —
`${seed}:tower:<rung>`, the `D60` family keyed by the rung, so a rung replays alone and
appending one cannot move an earlier rung (`D11`). The foe carries the shipped `TOWER`
row: no leader, no badge and no party table of its own. The tower is an ordinary trainer
battle with no rule the routes do not have, and `towerStep` answers `null` before the
Champion, so a streak can never stand in for the badge.

`towerWin(run, streak)` steps the run's `towerStreak` to `streak + 1` and never
backwards; `towerHeal` is the League's own heal (§6) — HP and PP across the party and
the box, never a status cure and never a revival (`D5`) — and it runs after every won
fight. `towerResolve(run, foe, won)` is the rule in one answer: a win bumps the streak
and heals, and `over` is true exactly when nobody in the party is living. A loss that
leaves a living member re-asks for the same rung: the tower never ends a run that still
has a party. `towerReward(foe)` folds the roster's levels for the XP and the fight's
`tower:<rung>` mark, and pays no Poké Dollars — the endless mode has no shop behind it.

The streak is the tower's **record** and it stays apart from the badge record (`D62`):
`RunHistoryRecord` carries it as `towerStreak` beside `badges`, the badge count is still
the record, and a row written without that figure reads `0`. The run's own `towerStreak`
already travelled the save (§8), so this adds no `SAVE_VERSION` step. `LeagueScene`
plays the tower as its own endless mode — the entry heal, the next rung off the run's own
streak, the heal after a win and the wipe that ends the run — and `RunOverScene` draws
the defeat card with the badge count and the streak. The run ends only when its party
does, so there is no victory state: every ending is the defeat card.
```

### Data

- One new record key: `RunHistoryRecord.towerStreak`, `number`, unit *wins*, optional
  on read (absent → `0`), always written by `makeHistoryRecord`.
- No new `RunState` field (`towerStreak` already exists, `state.ts:108`), no new
  `src/data/` table, no new i18n key, no new asset, no new dependency.

### Rules

- No Phaser import, no DOM, no `localStorage` and no clock inside
  `src/engine/region/tower.ts` (`AGENTS.md`, `src/engine/README.md`).
- **No new i18n key** (`src/i18n/**` is another task's). The strings this task prints
  are all existing keys: `hud.level` (the tower row's level), `menu.stat.elite`
  (`MAX ELITE STRIKE`, the card's streak label), and whatever `liveRunOverView` already
  resolves. A bare figure (`String(n)`) is not copy: the map card's `3/8` is the
  shipped precedent.
- **No new balance number**: `TOWER_PARTY_SIZE = 5` and `LEAGUE_LEVEL = 60` are the
  backlog's own figures, and `LEAGUE_LEVEL` is read from `src/data/region.ts`.
- Every draw is `Rng`, never `Math.random`; the run's seed reproduces the fight.

## 🧩 Data and configuration

- `TOWER_PARTY_SIZE = 5` — a module constant in `src/engine/region/tower.ts` with a
  one-line rationale comment: the tower fields five at `LEAGUE_LEVEL`; the region's
  size table (`src/data/region.ts`) is another task's file in this batch, so the
  constant moves there when the batch closes. It is not a tuning knob for this task.
- `LEAGUE_LEVEL` (`src/data/region.ts`, `60`) — read, never retyped.
- `TOWER` (`src/data/league.ts`) — read as `TowerFoe.row`; its `leaderId: null`,
  `badge: null` and `partySize: null` are the "no leader, no badge, no fixed party"
  facts the tests assert. It is **not** edited.
- The rung stream: `${seed}:tower:<rung>` — the `D60` family with the rung as its key.
- The tower's battle key: `battleSeed(run.seed, run.routeIndex, 'tower:<rung>')`, the
  shipped `battleSeed` (`${seed}:battle:<routeIndex>:<key>`), so every rung fights on
  its own seed.
- Record key: `towerStreak` (see Contract → Data).

## 🧪 Test and Validation Plan (for QA)

QA runs this verbatim. A criterion that cannot be executed by someone who has not read
the rest of the spec is not a criterion.

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `npx vitest run src/engine/region/tower.test.ts src/engine/run/history.test.ts src/engine/save.test.ts src/scenes/RunOverScene.test.ts`
    — the four files this task touches, alone.
  - `git diff --name-only main...task-294` — audit against the exclusive path list.
  - A browser pass **is** owed: the `[live]` criteria below, at 1280×800, on `npm run
    dev` (a develop build, so `__pkmLeague` / `__pkmRunOver` exist), with the dev menu
    available on `F`.
- **Acceptance criteria:** every one is tagged **`[unit]`** (a headless command, a
  decoded asset, a pinned number — seconds and deterministic) or **`[live]`** (it only
  exists in the running game). QA runs them all, but its browser budget goes to the
  `[live]` ones.
  - [ ] `[unit]` It typechecks and builds clean: `npm run build` exits 0.
  - [ ] `[unit]` The declared tests exist and pass: the four-file `vitest run` above exits 0 and each file has a `describe`/`it` for the cases listed under "Tests the dev writes" below.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched: `git diff --name-only main...task-294` lists only the twelve paths above.
  - [ ] `[unit]` Every tower foe is level 60, five members, leaderless and ruleless: for seed `task-294` and rungs 1..20, `towerStep(...)` is non-null, `roster.length === 5`, every `roster[i].level === 60`, `row.leaderId === null`, `row.badge === null`, `row.partySize === null`, and `towerReward(foe)` has no `money` and no `item` key (asserted in `tower.test.ts`).
  - [ ] `[unit]` The rung stream is `${seed}:tower:<rung>`: the same rung twice is identical (two-call replay), two different rungs never field the same party, two seeds never field the same first rung, and a **literal** pinned digest of the first three rungs' `speciesId`s for seed `task-294` sits in `tower.test.ts` (the dev captures it on the first run; QA confirms it is a literal, not a recomputation).
  - [ ] `[unit]` A win bumps the streak and heals, a loss ends the run: `towerResolve(run, foe, true)` gives `run.towerStreak + 1` and a fully rested party (HP and PP), `towerResolve(run, foe, false)` leaves the streak and returns `over: false` while a living member remains, and a folded wipe (a returned party at 0 HP through `releaseFainted`) gives `over: true` with `hasLivingParty === false`.
  - [ ] `[unit]` `towerHeal` never cures a status and never revives: a party member with `status: 'psn'` keeps it and a 0-HP member keeps 0 HP after the heal, while `towerHeal` on a whole run returns the run by reference.
  - [ ] `[unit]` The record stores badges and the streak apart: `makeHistoryRecord({...run, badges: [1,2,3], towerStreak: 7})` gives `badges: 3` and `towerStreak: 7`; `badges` never moves when the streak does and vice versa; a negative or `NaN` streak writes `0`; `pushHistory`/`endRun` carry both through.
  - [ ] `[unit]` The stored row keeps the figure: a history document with `towerStreak: 4` decodes to `4`, one without the key decodes to `0`, and `SAVE_VERSION` is still `28`.
  - [ ] `[unit]` No history row can leave the tower unlocked before the Champion: `towerOpen` is `false` and `towerStep` answers `null` for a fresh run and for a run whose `towerStreak` is 7 but which has not beaten `league:1..5`; it is `true` and answers rung 1 exactly when all five ids are in `defeatedTrainers`. No field of `RunHistoryRecord` is read by `towerOpen`/`towerStep`.
  - [ ] `[unit]` The end card reports badges, not floors: `runOverStatValues({...run, routeIndex: 20, badges: [1,2,3]})` is `[3, …]` — the deprecated floor counter never reaches the card — and its fourth figure is `run.towerStreak`; the panel is mounted with `won: false` even when `init` was handed `{ won: true }` (`RunOverScene.test.ts`, reading `mocks.mountRunOver`'s view).
  - [ ] `[unit]` No live victory path remains: `grep -n "headlineWin\|blurbWin\|won: true" src/scenes/RunOverScene.ts` prints **no line** (the scene never names the win copy and never passes `won: true`), the file's one `liveRunOverView(this.run, false, …)` call is there, and `grep -rn "towerStreak" src/engine/run/history.ts src/engine/save.ts src/engine/region/tower.ts` is non-empty.
  - [ ] `[live]` **The Champion opens the tower.** At 1280×800 on `npm run dev`: from an active run, in the console, `__pkmRoute.scene.start('League', { run: { ...__pkmRoute.run, nodeKey: 'league:1', visitedNodes: ['league:1'], badges: [1,2,3,4,5,6,7,8], defeatedTrainers: ['league:1','league:2','league:3','league:4','league:5'] } })`. Measurement: `__pkmLeague.debugLeagueState()` reads `cleared: true`, `towerOpen: true`, `mode: 'league'`, `next: null`; pressing the confirm key then reads `mode: 'tower'`, `streak: 0`, `towerFoe.rung: 1`, `towerFoe.level: 60`, `towerFoe.partySize: 5`, `paused: true`; and with the header map open (`M`) `document.querySelector('[data-hud-region-node="tower:1"]')` exists and carries `data-current="true"` and `data-visited="true"` (before the press it is `data-current="false"`).
  - [ ] `[live]` **A win shows the streak.** At 1280×800, from the tower state above, in the console `const r = __pkmLeague.debugLeagueState().run; __pkmLeague.scene.start('League', { run: { ...r, towerStreak: 1 } })` — the state a first win leaves. Measurement: `__pkmLeague.debugLeagueState()` reads `mode: 'tower'`, `streak: 1`, `towerFoe.rung: 2`, `towerFoe.level: 60`, and the panel repaints the streak figure (the same `run.towerStreak` the accessor reads, drawn as a bare figure on the tower's one row).
  - [ ] `[live]` **A wipe shows the defeat card with the badge count, and no victory card exists.** At 1280×800, in the tower with the injected level-5 party, take the fight and keep choosing the first move until the party faints (the level-60 foe wipes it in one or two turns). Measurement: the scene hands off to `RunOver`; `__pkmRunOver.debugRunOverState()` reads `won: false`, `badges: 8`, `stats[0]` = `{ id: 'routes', value: '08' }`, `stats[3].value` = the streak the run ended on, and `document.querySelector('[data-hud-run-over]')` carries `data-won="false"` and `data-actions="1"`, `[data-hud-run-over-title]`'s text equals `t('runOver.headlineLoss')` and `[data-hud-run-over-secondary]` is absent. No live state anywhere in the session reads `data-won="true"`; frame `07 Run over · victory` is reachable only through the design fixture `?hudFixture=07-run-over-victory`, which is not the game.
- **A `[live]` that compares pixels is not a criterion** (`D57`): the board enters as an
  imported spec, so fidelity is read from `design/screens/06-run-over-defeat.json`,
  never from a screenshot diff.

**Tests the dev writes** (names are the dev's; the cases are not):

- `src/engine/region/tower.test.ts` — the `towerOpen` prefix, `towerStep` before and
  after the Champion, the five-at-60 leaderless roster, the two-call replay and the
  cross-rung/cross-seed difference, the pinned digest, `towerWin` (bump, never
  backwards, same object at or above), `towerHeal` (HP/PP, status kept, no revival,
  reference when nothing missing), `towerResolve` (win heals, loss keeps, wipe ends),
  `towerReward` (no money, no item, `tower:<rung>`), and a source-level assertion that
  `tower.ts` reads no clock and no `Math.random` (the `history.test.ts` precedent at
  the bottom of that file). It builds its run the way `league.test.ts` does: a
  `createRun` + `compatForNode(seed, 'tower:1')` shape with the five `league:<n>` ids
  in `defeatedTrainers`.
- `src/engine/run/history.test.ts` — the `history()` helper gains `towerStreak`, the two
  exact `toEqual` record literals (the `makeHistoryRecord` case and the "builds no row
  for a rippen member" case) gain `towerStreak: 0`, a streak-apart-from-badges case, the
  negative/`NaN` case, and `endRun` carrying both.
- `src/engine/save.test.ts` — the `FINISHED`/`record(seed)` fixtures gain `towerStreak`
  where a `toEqual` compares a decoded row, plus the two decode cases (present, absent).
- `src/scenes/RunOverScene.test.ts` — `runOverStatValues` (badges not `routeIndex`,
  catches, casualties, streak) and the `won: true` input still mounting a `won: false`
  view with the fourth figure = the streak.

## 📣 Coordination

- **For the Architect:** this task's claim list adds four paths to the backlog entry's
  list (`src/scenes/RunOverScene.test.ts`, `src/scenes/RouteScene.ts`,
  `src/engine/save.ts`, `src/engine/save.test.ts`), each with its reason above. Batch
  123's hot-file note names no holder for `src/scenes/RouteScene.ts`; this task is that
  holder for the batch. `src/engine/region/README.md` is named as **Task-293's** in
  TODO.md's Batch 123 block, while this spec edits the two bullets it adds for its own
  new file: either the plan moves the README to this task, or Task-293's dev pastes
  these two lines verbatim from here (its own `plan.ts` line is untouched by this
  task). Two follow-ups this batch does not carry: (a) `docs/region-spec.md` §8's
  sentence "the tower's own streak travels **beside** the record" now predates the
  row's field and wants the same wording §7.11 uses — no task owns §8, so it needs a
  ticket or an extension of `Task-299`; (b) the card's fourth stat still has the
  structural id `fainted` while its figure is the streak, and its label is
  `menu.stat.elite`: `src/ui/hud/panels/run-over/view.ts` pins the four ids and no task
  in Batches 123-125 claims that file, so a `streak` id + key is a follow-up.
- **For Task-291 (Batch 123, §7.10):** this task appends `### 7.11` at the same seam
  (after the last `### 7.x`, before `## 8`) and adds `, §7.11 the tower` to §7's
  subsection list. Merge order is by ID (291 then 294), so both entries must survive in
  numeric order; Integration QA reads the combined document for lost lines.
- **For Task-295 (Batch 124, `src/i18n/**`):** the card's first row prints the badge
  count under `runOver.routes`'s label ("Routes cleared") until the key's text moves to
  the badge vocabulary, and the streak row prints under `menu.stat.elite`
  ("MAX ELITE STRIKE"). `runOver.enemiesFainted` loses its only reader in this task, so
  the unused-key walker will report it: retire it or repoint it, and give the badge row
  its own key.
- **For Task-296 (Batch 124, the debug menu):** the `[live]` recipes above need no new
  dev surface — they enter through `scene.start` with an injected run. `onSetTowerStreak(n)`
  is still the right debug handler; it should write `RunState.towerStreak`.
- **For the next batch:** `LeagueScene` now has two modes and three dev facts
  (`mode`, `streak`, `towerFoe`) on `debugLeagueState()`; a browser test of the tower
  reads those, never the canvas.

## ⛔ Out of scope

- **The plan, the map and the world.** `src/engine/region/plan.ts`,
  `src/engine/region/travel.ts`, `src/engine/region/gates.ts`, `src/engine/region/preload.ts`,
  `src/ui/regionMap.ts` and the map panel are untouched. The tower node already exists
  and is already drawn; the map card's markers, the flight rule and the exit gates are
  frozen by earlier batches. Giving the tower a carved world (`preloadNode('tower:1')`)
  is a different task: the tower is a scene, not a map.
- **A new battle engine or a new battle launch shape.** The tower replays the shipped
  trainer battle and `resolveBattle`; no `BattleLaunch` field is added.
- **The victory frames.** `design/screens/07-*` and the `07`/`07b` panel fixtures stay
  in `src/ui/**` (not this task's path) and remain reachable only through the design
  preview `?hudFixture=…`. This task retires the **live** victory state, it does not
  delete the board's frames, the panel's `secondary` action or its slug list.
- **Balance.** No tuning of the tower's party, levels, XP, money or the streak's ramp;
  Task-297 owns the campaign's numbers. The tower pays no Poké Dollars — that is a rule
  decision recorded in §7.11, not a knob.
- **The stats and ranking panels.** They keep reading `mapReached` and `stats.*`
  untouched; only the record gains a field, and no screen but the defeat card reads it.
- **`src/main.ts`, `package.json`, `vite.config.ts`, `src/i18n/**`, `src/data/**`.** No
  new scene registration (the League scene already registers itself through
  `regionScenes`), no dependency, no asset, no key, no data table.
- **The floors.** `RouteScene` is touched for the one `arrivalSceneFor` line and for its
  docstring; its floor logic, its dev surface and its end seam are not rewritten —
  Task-298 deletes the scene.
