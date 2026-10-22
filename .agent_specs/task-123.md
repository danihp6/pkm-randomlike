# Spec: Task-123 — The HUD's state is one projection of the engine

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine-side pure TypeScript (a projection and a command channel under
  `src/ui/`, no renderer): **no Phaser import, no DOM, no Preact/JSX, no localStorage,
  no RNG**. Phase 12 (`D49`) starts here; Batch 59 (`src/ui/hud/shell.tsx`, the kit,
  the fixtures) is written against the contract this task freezes, so the contract is
  the deliverable.
- **Role:** Dev.
- **Objective:** after this task the DOM HUD phase has **one serialisable snapshot of
  the game** and **one command channel back into it**, both pure and both testable
  headless. `src/ui/hud/state.ts` exports `HudState` — a plain-data projection of
  `RunState` (and of `BattleState` when a battle is up) that carries every value the
  panels draw exactly once, already derived, already named, already a fraction or a
  label where the canvas would have divided or translated — plus `projectHud()` and the
  single emit point `syncHud()` that a scene calls and that *notifies* a sink instead of
  holding or mutating anything. `src/ui/hud/commands.ts` exports the `HudCommand` union
  a panel can send and `reduceHudCommand()`, which turns it into the `KeybindAction` a
  key or the touch pad already produces (so `src/data/keybinds.ts` rebinding keeps
  working) or into a row intent a scene already handles, and which can never carry run
  state, so the HUD cannot mutate the run. Nothing else in the repository changes.
- **Environment:** worktree `../wt-pkm-123`, branch `task-123`, cut from `origin/main`
  @ `9182192`. Linux, a headless Chromium is available over CDP, no human in the loop. Install with
  `npm ci --prefer-offline --no-audit --no-fund`. Gates: `npm test` and `npm run build`.
- **Dependencies:** **none** (the TODO entry says so). Everything it reads ships on
  `main` today: `src/engine/run/state.ts`, `src/engine/run/progression.ts`,
  `src/engine/run/missions.ts`, `src/engine/run/heal.ts`, `src/engine/maps/plan.ts`,
  `src/engine/battle/{state,fighter,commands}.ts`, `src/data/keybinds.ts`,
  `src/data/hudLayout.ts`, `src/data/biomes.ts`, `src/data/items.ts`,
  `src/data/missions.ts`, `src/data/dex`, `src/ui/{partyScreen,bag,notice,metrics}.ts`.
  It does **not** depend on `[Task-122]` (`design/`), on Preact, or on the shell.

### Exclusive paths (single writer)

The list of paths this task creates or modifies. **Nothing outside this list.**
No other task in the batch claims the same path. Deleting a stray `.gitkeep` from a
directory this task populates is always allowed.

- `src/ui/hud/state.ts` (new)
- `src/ui/hud/state.test.ts` (new)
- `src/ui/hud/commands.ts` (new)
- `src/ui/hud/commands.test.ts` (new)
- `src/ui/README.md` (modified: exactly two added role lines under `## Layout`)

`src/ui/hud/README.md` is **not** yours: `[Task-124]` owns both HUD folder maps
(`src/ui/hud/README.md` and `src/ui/hud/panels/README.md`) and writes them in Batch 59.
Do not create either file. `src/ui/README.md` gets the two lines below and nothing else.

### Inputs (read-only)

Files this task may read, and only these, beyond `AGENTS.md` itself.

- `docs/tech-decisions.md` — `D49`, `D43`, `D11`, `D4`.
- `docs/hud-dom-proposal.md` — §4 (the bridge and the snapshot), §6 (input), §13.
- `docs/hud-fidelity.md` — §6 (the frame → node map; no number here is used by this task).
- `docs/agent-spec-template.md`.
- `src/engine/run/state.ts`, `src/engine/run/progression.ts`,
  `src/engine/run/missions.ts`, `src/engine/run/heal.ts`, `src/engine/run/battleLink.ts`,
  `src/engine/maps/plan.ts`.
- `src/engine/battle/state.ts`, `src/engine/battle/fighter.ts`,
  `src/engine/battle/commands.ts`.
- `src/data/keybinds.ts`, `src/data/hudLayout.ts`, `src/data/biomes.ts`,
  `src/data/items.ts`, `src/data/missions.ts`, `src/data/dex` (the accessors and their types).
- `src/ui/partyScreen.ts`, `src/ui/bag.ts`, `src/ui/notice.ts`, `src/ui/metrics.ts`,
  `src/ui/README.md`.
- `src/scenes/RouteScene.ts` and `src/scenes/BattleScene.ts` **to read the shipped rules
  you must not re-derive** (`refreshHud`, `handleAction`, `toggleHudPanel`,
  `PANEL_KEY_ACTIONS`, `confirmMenu`, `openMoves`, `openBag`, `openParty`, `usableBag`,
  `switchablePartyIndices` call sites). Neither file is imported and neither is edited.

Do not read or import `src/scenes/**`, `src/render/**`, `src/input/**`, `src/audio/**`,
`src/main.ts` or Phaser at runtime. `src/input/input.ts` imports Phaser, so it is
off-limits even for a type.

## 🔒 Contract

Two modules. Everything below is a promise Batch 59+ is written against; the names,
the key spelling and the units are exact. Type-only imports use `import type`
(`verbatimModuleSyntax` is on). `exactOptionalPropertyTypes` is on, so a field is
**required and nullable**, never optional-with-`undefined`.

### `src/ui/hud/state.ts` — the projection

```ts
import type { BiomeId } from '../../data/biomes';
import type { MoveCategory } from '../../data/dex';
import type { Gender, StatusId } from '../../engine/battle/fighter';
import type { BattleState, SideId, Slot, TerrainId, WeatherId } from '../../engine/battle/state';
import type { RunMode, RunState, RunStats } from '../../engine/run/state';
import type { BagCategory } from '../bag';
import type { Notice } from '../notice';
import type { PartyRow } from '../partyScreen';

/** One party row: the shipped party/PC row plus the bar's fraction, derived once. */
export type HudPartyRow = Readonly<PartyRow & { hpFraction: number }>;

/** One bag stack. `category` is null for an item id the catalogue does not know. */
export type HudBagRow = Readonly<{
  itemId: string;
  name: string;
  count: number;
  category: BagCategory | null;
}>;

/** The floor's mission: its id, its display name and whether the floor has met it. */
export type HudMission = Readonly<{ id: string; name: string; met: boolean }>;

/** The route's own chrome: the header line, the shared XP bar and the Pokevial meter. */
export type HudRoute = Readonly<{
  mode: RunMode;
  mapIndex: number;
  routeInMap: number;
  routeIndex: number;
  biomeId: BiomeId;
  biomeName: string;
  levelCap: number;
  squadLevel: number;
  xp: number;
  xpFraction: number;
  pokevialCharges: number;
  pokevialMax: number;
  bossDefeated: boolean;
  entryDeparted: boolean;
  discoveredRooms: readonly number[];
  mission: HudMission | null;
  missionsCompleted: number;
  stats: RunStats;
}>;

/** One move cell of the battle's move menu. */
export type HudBattleMove = Readonly<{
  moveId: string;
  name: string;
  type: string;
  category: MoveCategory;
  pp: number;
  maxPp: number;
  /** The move's base power (`getMove().basePower`), 0 for a status move. */
  power: number;
  /** The move's printed accuracy; null when it never misses (`Move.accuracy === true`). */
  accuracy: number | null;
  desc: string;
  /** True when `legalMoveIndices` offers this slot right now. */
  usable: boolean;
}>;

/** One member of a battle side, as a row the switch screen lists. */
export type HudBattleFighter = Readonly<{
  fighterId: string;
  speciesId: string;
  name: string;
  level: number;
  gender: Gender;
  shiny: boolean;
  hp: number;
  maxHp: number;
  hpFraction: number;
  status: StatusId | null;
  statusLabel: string | null;
  /** The player's side: `switchablePartyIndices` offers this row. The enemy's: always false. */
  canSwitchTo: boolean;
}>;

/** One live active: the row plus its slot and the moves its menu offers. */
export type HudBattleActive = Readonly<
  HudBattleFighter & { slot: Slot; moves: readonly HudBattleMove[] }
>;

export type HudBattleSide = Readonly<{
  name: string;
  party: readonly HudBattleFighter[];
  actives: readonly HudBattleActive[];
  awaitingReplacement: boolean;
}>;

/** One row of the battle bag. `usable` is the battlefield's own enablement. */
export type HudBattleBagRow = Readonly<{
  itemId: string;
  name: string;
  count: number;
  category: BagCategory;
  usable: boolean;
}>;

/** The battle chrome's whole input: the four HP boxes, the move menu and the bag. */
export type HudBattle = Readonly<{
  turn: number;
  double: boolean;
  isWild: boolean;
  winner: SideId | 'draw' | null;
  weather: WeatherId | null;
  weatherTurns: number;
  terrain: TerrainId | null;
  terrainTurns: number;
  fog: boolean;
  noHeal: boolean;
  noFlee: boolean;
  bannedSpecies: string | null;
  sides: Readonly<Record<SideId, HudBattleSide>>;
  bag: readonly HudBattleBagRow[];
}>;

/**
 * The one snapshot the HUD renders. Plain data: JSON round-trips it unchanged.
 * On the route `route` is set and `battle` is null; in battle it is the other way
 * round (`battle !== null` is the single test for "a battle is up").
 */
export type HudState = Readonly<{
  party: readonly HudPartyRow[];
  bag: readonly HudBagRow[];
  /** The run's Poké Dollars on the route, null in battle. */
  money: number | null;
  route: HudRoute | null;
  battle: HudBattle | null;
  notice: Notice | null;
}>;

/** The screen a snapshot comes from: the only field a projection reads to branch. */
export type HudScreen = 'route' | 'battle';

/**
 * Everything the projection may read. A route emit needs the run; a battle emit
 * needs the battle state and the run's *launch-time* `canCapture`, because the
 * battle scene never holds a `RunState` (`BattleLaunch` carries that flag).
 */
export type HudProjection =
  | Readonly<{ screen: 'route'; run: RunState; notice: Notice | null }>
  | Readonly<{ screen: 'battle'; battle: BattleState; canCapture: boolean }>;

/** The one consumer the HUD installs. It is handed a value; it never gets the engine. */
export type HudSink = (state: HudState) => void;

/** Builds the snapshot. Pure: same input (and locale) ⇒ deep-equal output, always. */
export function projectHud(input: HudProjection): HudState;

/**
 * The one emit point (`D49`). Builds the snapshot, calls `sink(next)` **once**,
 * and returns `next`. It holds no cache, no last value, no subscription: a
 * notification, never a mutation.
 */
export function syncHud(input: HudProjection, sink: HudSink): HudState;
```

#### Field by field: what each value derives from

Every value below is computed here and **nowhere else**. A field that is a fraction,
a label or a boolean rule is in the snapshot precisely so the HUD never derives it a
second way.

**Route emit** — `projectHud({ screen: 'route', run, notice })`:

| HudState field | From |
| --- | --- |
| `party` | `run.party.map(partyRow)` (`src/ui/partyScreen.ts`), each row spread, plus `hpFraction: hpFraction(row.hp, row.maxHp)` (`src/ui/metrics.ts`) |
| `bag` | `run.bag.map(stack => ({ itemId, count, name: getItem(itemId)?.name ?? itemId, category: bagCategoryFor(itemId) }))` (`src/data/items.ts`, `src/ui/bag.ts`) |
| `money` | `run.money` |
| `battle` | `null` |
| `notice` | the `notice` input, unchanged |
| `route.mode` | `run.mode` |
| `route.mapIndex` | `run.mapIndex` |
| `route.routeInMap` | `run.routeInMap` |
| `route.routeIndex` | `run.routeIndex` |
| `route.biomeId` | `biomeForMap(run.seed, run.mapIndex)` (`src/engine/maps/plan.ts`) |
| `route.biomeName` | `getBiome(biomeId).name` (`src/data/biomes.ts`) |
| `route.levelCap` | `run.levelCap` |
| `route.squadLevel` | `squadLevel(run)` (`src/engine/run/state.ts`) |
| `route.xp` | `run.xp` |
| `route.xpFraction` | `experienceFraction(run.xp, squadLevel(run))` (`src/engine/run/progression.ts`) |
| `route.pokevialCharges` | `run.pokevialCharges` |
| `route.pokevialMax` | `POKEVIAL_MAX_CHARGES` (`src/engine/run/heal.ts`) |
| `route.bossDefeated` | `run.bossDefeated` |
| `route.entryDeparted` | `run.entryDeparted` |
| `route.discoveredRooms` | a copy of `run.discoveredRooms` |
| `route.mission` | `null` when `run.mission === null`; else `{ id: run.mission.id, name, met: missionMet(run) }`, where `name` is `t(getMission(id)!.nameKey)` (`src/i18n`) and falls back to `id` when `getMission` has no row |
| `route.missionsCompleted` | `run.missionsCompleted` |
| `route.stats` | a copy of `run.stats` (`{ catches, casualties }`) |

**Battle emit** — `projectHud({ screen: 'battle', battle, canCapture })`:

`party: []`, `bag: []`, `money: null`, `route: null`, `notice: null`, and

| HudBattle field | From |
| --- | --- |
| `turn`, `double`, `isWild`, `winner`, `weather`, `weatherTurns`, `terrain`, `terrainTurns`, `fog`, `noHeal`, `noFlee`, `bannedSpecies` | the same-named `BattleState` field, unchanged |
| `sides[side].name` | `battle.sides[side].name` |
| `sides[side].awaitingReplacement` | `battle.sides[side].awaitingReplacement` |
| `sides[side].party` | `battle.sides[side].party.map((fighter, index) => row)` — one row per member, in party order |
| `sides[side].actives` | `liveSlots(battle, side).map(slot => ({ ...row(activeFighter(battle, side, slot)), slot, moves }))` — **`liveSlots`, never `[0, 1]`**: `activeFighter` throws on slot 1 without a second active |
| `bag` | `battle.bag.map(slot => ({ itemId: slot.item.id, name: slot.item.name, count: slot.count, category: bagCategoryForKind(slot.item.kind), usable }))` |

`row(fighter, index)` is `{ fighterId: fighter.id, speciesId, name: fighter.name, level,
gender, shiny, hp, maxHp, hpFraction: hpFraction(hp, maxHp), status, statusLabel:
statusAbbreviation(status), canSwitchTo }` where

- `canSwitchTo` for the **player** side is
  `switchablePartyIndices(battle, 'player').includes(index)` (`src/engine/battle/commands.ts`);
  for the **enemy** side it is always `false` (the HUD never offers the foe's bench).
- `moves` for the **player** side is `fighter.moves.map((slot, i) => …)`, each with
  `usable: legalMoveIndices(fighter, barredMovesFor(battle, 'player')).includes(i)` and
  `name`/`type`/`category`/`pp`/`power`/`accuracy`/`desc` read once from
  `getMove(slot.moveId)` (`null` → `name: slot.moveId`, `type: ''`, `category: 'Status'`,
  `power: 0`, `accuracy: null`, `desc: ''`). `pp`/`maxPp` come from the fighter's slot.
  For the **enemy** side `moves` is always `[]`: the battle never shows the foe's moveset.
- `usable` on a battle bag row is `BattleScene.usableBag()` written once, here:
  `!battle.noHeal && slot.count > 0 && slot.item.kind !== 'held' &&
  slot.item.kind !== 'valuable' && (slot.item.kind !== 'ball' || (battle.isWild && canCapture))`.

#### Invariants (each one is a test below)

1. **JSON-safe.** `JSON.parse(JSON.stringify(snapshot))` is `toStrictEqual` to the
   snapshot: no `undefined`, no `Date`, no `Map`/`Set`, no function, no class instance.
2. **No engine object leaks.** No `Rng`, no `BattleFighter`, no `RunPokemon`, no
   `Move`, no `ItemDef` in a snapshot — every nested value is a plain object of
   primitives.
3. **No shared arrays.** Every array in a snapshot is a fresh array: `snapshot.party !==
   run.party`, `snapshot.route!.discoveredRooms !== run.discoveredRooms`,
   `snapshot.battle!.sides.player.party` is not `battle.sides.player.party`. Arrays are
   built with `map`/spread, never reused by reference. `notice` is the one exception
   (it is the caller's immutable `Notice`).
4. **Read-only.** Neither `run` nor `battle` is written: the same object references and
   the same field values are observed before and after a projection.
5. **Deterministic.** Two `projectHud` calls with the same input are deep-equal. No
   RNG stream, no clock, no storage, no `Math.random`, no module-level mutable state.
6. **Locale.** Display strings (`name`, `statusLabel`, `biomeName`, `mission.name`) are
   resolved through the current i18n locale (`D43`); the snapshot is a function of the
   input *and* the locale, which is why the shell re-emits on `onLocaleChange`.
7. **The screen rule.** `battle !== null` ⇒ `route === null && money === null && party`
   and `bag` are empty and `notice === null`; `battle === null` ⇒ `route !== null &&
   typeof money === 'number'`.
8. **`syncHud` emits once.** The sink is called exactly once per call, with the very
   object `syncHud` returns; it is never called before the snapshot is complete and it
   is never called twice.

### `src/ui/hud/commands.ts` — the command channel

```ts
import { isKeybindAction, type KeybindAction } from '../../data/keybinds';
import { HUD_PANEL_IDS, type HudPanelId } from '../../data/hudLayout';
import { MAX_MOVES } from '../../engine/run/progression';

/** The four rows of the battle's command grid, in the order the grid draws them. */
export const BATTLE_COMMAND_ROWS = ['fight', 'bag', 'switch', 'run'] as const;
export type BattleCommandRow = (typeof BATTLE_COMMAND_ROWS)[number];

/** Every variant of the union, for a total test and for a component's own switch. */
export const HUD_COMMAND_TYPES = [
  'press',
  'battleCommand',
  'move',
  'item',
  'member',
  'panel',
  'answer',
] as const;
export type HudCommandType = (typeof HUD_COMMAND_TYPES)[number];

/** What a HUD control can ask for. Plain data: it can carry no run or battle state. */
export type HudCommand =
  | Readonly<{ type: 'press'; action: KeybindAction }>
  | Readonly<{ type: 'battleCommand'; row: BattleCommandRow }>
  | Readonly<{ type: 'move'; moveIndex: number }>
  | Readonly<{ type: 'item'; itemId: string }>
  | Readonly<{ type: 'member'; memberId: string }>
  | Readonly<{ type: 'panel'; panel: HudPanelId }>
  | Readonly<{ type: 'answer'; accept: boolean }>;

/** What a scene receives. `kind: 'action'` is the path a key or pad press already takes. */
export type HudIntent =
  | Readonly<{ kind: 'action'; action: KeybindAction }>
  | Readonly<{ kind: 'battleCommand'; row: BattleCommandRow }>
  | Readonly<{ kind: 'move'; moveIndex: number }>
  | Readonly<{ kind: 'item'; itemId: string }>
  | Readonly<{ kind: 'member'; memberId: string }>
  | Readonly<{ kind: 'panel'; panel: HudPanelId }>
  | Readonly<{ kind: 'answer'; accept: boolean }>;

/** Total, state-free, and `null` when the command cannot reach a scene. */
export function reduceHudCommand(command: HudCommand): HudIntent | null;
```

**What the reducer maps onto, and what it must not decide.**

- `{ type: 'press', action }` → `{ kind: 'action', action }` where `action` is a shipped
  `KeybindAction` (`src/data/keybinds.ts`). This is the rebinding path: a HUD control
  that stands for a key sends the **action**, never a key name, so the scene calls its
  own `handleAction(action)` and `settings.keybinds` keeps working. A value that is not
  a `KeybindAction` (`isKeybindAction` says no) → `null`.
  The shipped ids a panel will actually send, and the scene call each one already
  reaches: `confirm`/`cancel` (the battle's `onConfirm`/`onCancel`, the route's
  `handleAction`), `up`/`down`/`left`/`right` (`navigateMenu`, the party cursor, the
  bag's pocket cycle), `party`/`bag`/`map`/`box` (`RouteScene.handleAction`'s
  `toggleHudPanel`), `settings` (`RouteScene.openSettings`), `interact`, `run`,
  `reset`.
- `{ type: 'battleCommand', row }` → `{ kind: 'battleCommand', row }`, `row` one of
  `BATTLE_COMMAND_ROWS`. The four rows are the player's command grid, the shipped
  `menuItems` of `BattleScene.openMenu()` (`battle.command.fight`/`bag`/`switch`/`run`),
  whose `onSelect` closures are `openMoves` / `openBag` / `openParty` /
  `submit({ type: 'run' })`. The partner's menu (`openPartnerMenu`, a double battle's
  slot 1) draws `fight` and `switch` only: a scene that receives `bag` or `run` there
  ignores it — that decision is the scene's, not the reducer's. A row outside the list
  → `null`.
- `{ type: 'move', moveIndex }` → `{ kind: 'move', moveIndex }` when `moveIndex` is an
  integer in `0 … MAX_MOVES - 1`; otherwise `null`. **No legality check here**: whether
  that slot has PP, is disabled, taunted or barred is `validateCommand`'s and
  `legalMoveIndices`' business (`src/engine/battle/commands.ts`) and the snapshot's
  `usable` flag — the reducer duplicates none of it.
- `{ type: 'item', itemId }` → `{ kind: 'item', itemId }` with the id trimmed; an empty
  id → `null`.
- `{ type: 'member', memberId }` → `{ kind: 'member', memberId }` with the id trimmed;
  an empty id → `null`.
- `{ type: 'panel', panel }` → `{ kind: 'panel', panel }` for an id in `HUD_PANEL_IDS`;
  otherwise `null`. The id vocabulary is the shipped `src/data/hudLayout.ts` one
  (`header`, `party`, `bag`, `box`, `detail`) — the same ids `RouteScene.toggleHudPanel`
  takes and the save keys on.
- `{ type: 'answer', accept }` → `{ kind: 'answer', accept }` for a boolean; otherwise
  `null`. This is the modal card's accept/decline (the NPC card, the trade, the reward).

Rules the reducer must **not** contain: any run or battle field, any legality rule
(`validateCommand`, `canRun`, `validateBag`, `switchablePartyIndices`), any key name,
any `Rng`, any state argument. Its signature takes a command and nothing else, so it
structurally cannot mutate anything.

### Data

Nothing. This task adds no JSON, no i18n key, no token, no default and no balancing
value; it also writes no `SAVE_VERSION` step and re-pins no seed (it adds no run field
and moves no draw).

## 🧩 Data and configuration

None. The two modules read existing tables (`src/data/items.ts`, `src/data/missions.ts`,
`src/data/biomes.ts`, `src/data/keybinds.ts`, `src/data/hudLayout.ts`) and add none.

The only file outside the new modules is `src/ui/README.md`, which gains **exactly two**
lines at the end of its `## Layout` list (no exported names, per `AGENTS.md`):

```
- `hud/state.ts` — the DOM HUD's one projection: the serialisable snapshot of the run and the battle (party, bag, money, route, battle, notice) and the single emit point a scene notifies.
- `hud/commands.ts` — the HUD's command channel: the intents a panel can send and the reducer that maps them onto the action a key or pad press already produces.
```

No other line of that file changes; do not add rows to `## Rules`, and do not list the
two `*.test.ts` files.

## 🧪 Test and Validation Plan (for QA)

QA runs this verbatim. A criterion that cannot be executed by someone who has not
read the rest of the spec is not a criterion.

- **Method:**
  - `npx vitest run src/ui/hud/state.test.ts src/ui/hud/commands.test.ts` — the two new
    files, alone, must be green.
  - `npm test` — Vitest, headless; must be green, including the two new files.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only origin/main...task-123` — the audit against the exclusive
    paths list.
  - **This task is pure and owes no browser pass: it has no `[live]` criterion, and QA
    must not open the game for it.** Every criterion below is a headless command or a
    decoded value.

- **The tests this task must contain** (names are the checklist; the assertions are the
  contract above). `state.test.ts` builds its fixtures from the real engine — a fixed
  seed for the run, `new Rng(1)` for the battle — so nothing hangs on a live roll:

  - `state.test.ts`
    - `it('projects a fresh run into a JSON-safe snapshot')` — `createRun({ seed: 'task-123', starter })`
      with `starter = { fighter: snapshotFighter(createFighter({ id: 'starter', speciesId: 'charmander', level: 5, moves: ['ember', 'scratch', 'growl'] })) }`;
      assert `JSON.parse(JSON.stringify(state))` `toStrictEqual` the snapshot, `money === 0`,
      `route.pokevialCharges === 3`, `route.squadLevel === 5`, `route.xpFraction === 0`,
      `route.biomeId === 'forest'`, `route.biomeName === 'Deep Forest'`, `party.length === 1`,
      `party[0].hpFraction === 1`, `battle === null`, `money` is a number.
    - `it('derives each route field from the run and from nowhere else')` — a run with
      `money`, `bag`, `xp`, `pokevialCharges`, `discoveredRooms`, `mission` and `stats`
      set by hand (spread the `createRun` result), then one field per assertion against
      its documented source; include `route.missionsCompleted`, `route.stats` deep-equal
      `run.stats` and `route.mission.met === missionMet(run)`.
    - `it('copies every array it hands out')` — `not.toBe` for `snapshot.party`,
      `snapshot.bag`, `snapshot.route.discoveredRooms`.
    - `it('does not touch the run')` — capture `run.money`, `run.xp`, `run.pokevialCharges`,
      the party's `hp`/`pp` values and the `run.party` reference before, project twice,
      compare after.
    - `it('projects a single battle with one active a side')` —
      `createBattle({ player: [charmander], enemy: [bulbasaur], rng: new Rng(1), isWild: true, bag: [{ item: getItem('pokeball')!, count: 2 }, { item: getItem('potion')!, count: 1 }] })`;
      assert `route === null`, `money === null`, `party`/`bag` empty, `notice === null`,
      `battle.sides.player.actives.length === 1`, `actives[0].slot === 0`,
      `actives[0].moves.length === 2`, `sides.enemy.actives[0].moves` empty,
      `sides.player.party[0].hpFraction === 1`, and `JSON.parse(JSON.stringify(state))`
      `toStrictEqual` the snapshot.
    - `it('fields two actives a side in a double battle')` — the same build with
      `double: true` and two members a side: `battle.double === true`,
      `actives.map(a => a.slot)` is `[0, 1]` per side, and both player actives carry moves.
    - `it('marks the switchable rows and only the player's')` — a three-member player
      party in a single battle: `sides.player.party[0].canSwitchTo === false` (it is out),
      `[1]` and `[2]` `true`, and every `sides.enemy.party[i].canSwitchTo === false`.
    - `it('carries the move menu's usable flags from legalMoveIndices')` — spend one
      move's PP in the battle state, re-project, and assert the `moves[i].usable` array
      equals `fighter.moves.map((_, i) => legalMoveIndices(fighter, barredMovesFor(battle, 'player')).includes(i))`.
    - `it('carries the battle bag's usability')` — `pokeball` `usable === true` with
      `isWild` and `canCapture: true`; `false` with `isWild: false`; a `choicescarf`
      (`kind: 'held'`) row `usable === false`; a `nugget` (`kind: 'valuable'`) row
      `usable === false`; `potion` `true`; and with `noHeal: true` **every** row false.
    - `it('emits once through syncHud')` — a counter sink: called once, with the object
      returned, and two calls with the same input are `toStrictEqual`.
    - `it('names a mission the floor has met')` — a run whose `mission` is a real
      `getMission` row and whose `hpLost`/`floorCasualties` are clean: `mission.name`
      is the row's `t(nameKey)` and `mission.met === true`; with one casualty recorded
      `met === false`.
  - `commands.test.ts`
    - `it('turns a press into the shipped action id')` — `'confirm'`, `'cancel'`,
      `'up'`, `'bag'`, `'party'`, `'run'`, `'settings'`: `{ kind: 'action', action: X }`.
    - `it('maps the four battle command rows')` — fight / bag / switch / run as
      `{ kind: 'battleCommand', row }`.
    - `it('maps a move index')` — 0 and 3; and `-1`, `4`, `1.5` → `null`.
    - `it('maps an item id')` — `'potion'`; `''` and `'   '` → `null`.
    - `it('maps a member id')` — `'catch-1'`; `''` → `null`.
    - `it('maps a panel id')` — each of `HUD_PANEL_IDS`; `'nope'` → `null`.
    - `it('maps a modal answer')` — `true` and `false`.
    - `it('refuses anything that is not a shipped action')` — `{ type: 'press', action: 'fight' }`
      cast through `as unknown as HudCommand` → `null`; same for a `battleCommand` row
      `'menu'` and an `answer` of `'yes'`.
    - `it('covers every variant')` — iterating `HUD_COMMAND_TYPES`, every type has a
      case that returns a non-null intent for a valid payload (so the const list and
      the union cannot drift).
    - `it('carries no run state')` — for every command, `Object.keys(reduceHudCommand(c)!).sort()`
      is one of the fixed key sets: no `run`, `battle`, `money`, `state` or `rng` key ever.

- **Acceptance criteria:**
  - [ ] `[unit]` `npx vitest run src/ui/hud/state.test.ts src/ui/hud/commands.test.ts` is green.
  - [ ] `[unit]` `npm test` is green (whole suite, headless).
  - [ ] `[unit]` `npm run build` is green (`tsc --noEmit` + `vite build`).
  - [ ] `[unit]` `git diff --name-only origin/main...task-123` lists exactly the five
        exclusive paths (plus nothing else; a deleted stray `.gitkeep` is the only
        allowed extra).
  - [ ] `[unit]` No renderer, no DOM, no storage, no clock, no RNG in the two modules:
        `grep -nE "from '(phaser|preact|@preact|.*scenes/|.*render/|.*input/)" src/ui/hud/state.ts src/ui/hud/commands.ts`
        and
        `grep -nE "localStorage|sessionStorage|Math\.random|Date\.now|performance\.now|new Rng|from '.*engine/rng'" src/ui/hud/state.ts src/ui/hud/commands.ts`
        both print nothing.
  - [ ] `[unit]` The module exports on disk are exactly the names in the Contract:
        `grep -nE "^export (type|const|function) " src/ui/hud/state.ts src/ui/hud/commands.ts`
        lists `HudPartyRow`, `HudBagRow`, `HudMission`, `HudRoute`, `HudBattleMove`,
        `HudBattleFighter`, `HudBattleActive`, `HudBattleSide`, `HudBattleBagRow`,
        `HudBattle`, `HudState`, `HudScreen`, `HudProjection`, `HudSink`, `projectHud`,
        `syncHud`; and `BATTLE_COMMAND_ROWS`, `BattleCommandRow`, `HUD_COMMAND_TYPES`,
        `HudCommandType`, `HudCommand`, `HudIntent`, `reduceHudCommand`. Nothing else is
        exported.
  - [ ] `[unit]` `git diff origin/main...task-123 -- src/ui/README.md` adds exactly the
        two role lines above and removes nothing.
  - [ ] `[unit]` No file `src/ui/hud/README.md` or `src/ui/hud/panels/README.md` exists on
        the task branch (`git ls-files src/ui/hud` lists the four files only).
  - [ ] `[unit]` `git diff origin/main...task-123 -- src/engine src/scenes src/data package.json`
        prints nothing: no engine, scene, data or dependency was touched.

## 📣 Coordination

- **For the Orchestrator:** this task turns green fully headless. It adds no dependency
  (`package.json` untouched), so Batch 59's `[Task-124]` is the task that adds `preact`
  and `@preact/signals`.
- **For `[Task-124]` (shell, Batch 59):** the store's one input is
  `syncHud(projection, sink)`; the shell installs the sink and re-emits on
  `onLocaleChange` (invariant 6). `HudState` has six top-level keys and no others; the
  HUD is in battle exactly when `battle !== null`. `HudState` is guaranteed
  JSON-round-trippable, which is what makes a fixture a `HudState` document.
- **For `[Task-125]` (kit):** every panel decides layout from `HudState` alone. No
  component imports an engine module to re-derive a value that is already in the
  snapshot (`hpFraction`, `statusLabel`, `usable`, `canSwitchTo`, `met`, `xpFraction`).
- **For `[Task-126]` (fixtures):** `design/fixtures/<slug>.json` may be a literal
  `HudState`; the fixture loader hands it to the same sink `syncHud` uses, and the live
  run feed is held while the flag is on.
- **For `[Task-140]`–`[Task-144]` (battle chrome):** the four HP boxes read
  `battle.sides[side].actives` in slot order; the move menu reads `actives[].moves`
  (the enemy's is `[]` by contract); the bag reads `battle.bag[].usable`; the switch
  screen reads `sides.player.party[].canSwitchTo`. **`[Task-142]` deletes
  `BattleScene.usableBag()`** once it owns the battle bag, because this snapshot is now
  its one home — and if that task changes the rule, it changes it in `state.ts` in the
  same commit. The message box (`[Task-144]`) does **not** read `HudState`: the battle's
  pacing stays `src/ui/feed.ts` and `src/ui/beats.ts`.
- **For the panels that need more than this snapshot (Batches 61–65):** `HudState`
  deliberately does not carry `box`/`rip` (the PC panel adds them when its task runs),
  `RunState.pcCatch`, `capturedRooms`, `caughtSpecies`, `discoveredCandy`, `modifiers`,
  the run seed, `BattleState.log`, `boosts`, `volatiles`, `field`, `roomField`,
  `usedFighterIds` or `mission.progress`. A task that needs one **claims
  `src/ui/hud/state.ts` in its own batch** and extends the group it belongs to,
  following the field tables above; the same rule applies to
  `src/ui/hud/commands.ts` for a new intent (the shop's quantity, the box's release,
  the trade's answer) — the reducer's shape (`kind`, `null` on an unreachable command)
  is the extension pattern.
- **For the Architect:** the one deviation from `AGENTS.md`'s folder-README rule is
  deliberate and already planned: `src/ui/hud/` ships without its own `README.md` in
  this task because `[Task-124]` owns both HUD folder maps and writes one line per
  planned subfolder. `src/ui/README.md` is the map that moves here. This task shares
  `src/ui/README.md` with `[Task-117]` (a later batch), so the two never run together.

## ⛔ Out of scope

- **Any renderer.** No Preact, no JSX/`.tsx`, no CSS, no `src/ui/hud/shell.tsx`, no
  `mount.ts`, no styles, no DOM node, no `#hud`. Batch 59 owns all of it.
- **Any scene edit.** `src/scenes/RouteScene.ts` and `src/scenes/BattleScene.ts` are
  untouched; `BattleScene.usableBag()` is mirrored, not moved, until `[Task-142]`.
  Nothing calls `syncHud` yet: the wiring is `[Task-124]`'s mount plus each migration
  task's own scene work.
- **Any engine change.** No `src/engine/**` file, no RNG stream, no save field, no
  `SAVE_VERSION` step, no re-pinned seed.
- **Any document.** No `docs/*.md`, no `design/`, no `docs/tech-decisions.md` addendum
  (the pad decision is `[Task-139]`'s).
- **Any dependency.** No `preact`, no `@preact/signals`, no `jsdom`, no
  `@testing-library/*`, no snapshot serialiser. Vitest's own assertions are enough.
- **Over-design.** No bridge class, no event emitter, no observable store, no `revision`
  counter, no last-value cache in `syncHud`, no diffing, no throttling, no `async`, no
  timers, no i18n keys of its own, no fixture loader.
