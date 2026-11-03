# Spec: Task-287 — The prologue: an empty party, one starter and a closed door

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule + Phaser scene + data + HUD adapter.
- **Role:** Dev.
- **Objective:** a brand-new run now starts **inside the town's laboratory with no
  Pokémon at all**. The professor hands over one starter and the starting bag
  (Poké Balls and potions), the town's exit refuses the walk until that happens, and
  the run neither counts as lost nor is discarded from the save while it has no party.
  The starter pick is the shipped `starter` panel (`04`), mounted by the new
  `InteriorScene` instead of by `StarterScene`, and the `04` frame's spec adapter is
  restored so the screen is measured against its own board again.
- **Environment:** worktree `../wt-pkm-287`, branch `task-287` (already created;
  `node_modules` is installed — do **not** reinstall, do **not** junction or symlink
  any asset tree).
- **Dependencies (already merged, read them, do not edit them):**
  - the region plan — `src/engine/region/plan.ts` (`planRegion`, `nodeOf`, `townKey`);
  - the settlement plan — `src/engine/region/city/plan.ts` (`planCity`);
  - the interior plan — `src/engine/region/interior/plan.ts` (`planInterior`,
    `interiorRoomKind`);
  - the travel seam — `src/engine/region/travel.ts` (this task edits it, see Q2);
  - the scene registry — `src/scenes/regionScenes.ts` (a `*Scene.ts` module that
    exports `regionSceneKey` + `regionSceneClass` registers itself; **never edit it**);
  - the `starter` panel — `src/ui/hud/panels/starter/**` (mount it, do not change its
    view model except the new test file this task adds);
  - the HUD fixture route — `src/ui/hud/fixtures.ts`, `?hud=dom&hudFixture=<slug>`.

### Exclusive paths (single writer)

**Nothing outside this list.** Twenty-one paths. No other task in the batch claims
any of them.

- `src/engine/run/prologue.ts` (new)
- `src/engine/run/prologue.test.ts` (new)
- `src/engine/run/state.ts`
- `src/engine/run/state.test.ts`
- `src/engine/save.ts`
- `src/engine/save.test.ts`
- `src/engine/region/travel.ts`
- `src/engine/region/travel.test.ts`
- `src/data/run.ts`
- `src/data/run.test.ts`
- `src/scenes/InteriorScene.ts` (new)
- `src/scenes/interior.test.ts` (new)
- `src/scenes/MainMenuScene.ts`
- `src/scenes/MainMenuScene.test.ts`
- `src/scenes/README.md`
- `src/engine/run/README.md`
- `src/ui/hud/specGap.views/starter.ts` (new)
- `src/ui/hud/panels/starter/specGap.test.ts` (new)
- `src/ui/hud/panels/starter/README.md`
- `src/ui/hud/specGap.walk.test.ts`
- `docs/region-spec.md` — **§6 only** (`## 6. Services per settlement`, lines
  205-214 of the shipped file). Do not touch §1, §7.x or §8.

`src/scenes/BootScene.ts` is **not** in the list and must **not** be edited: with
`hasLivingParty` treating a prologue run as alive (below), `BootScene.ts:199`
(`if (save.run && !hasLivingParty(save.run)) clearRun(storage);`) already keeps it.

### Inputs (read-only)

- `AGENTS.md`, `docs/agent-spec-template.md`.
- `docs/region-spec.md` — read §1, §2, §5, §6, §7.2 and §7.3 (read, do not edit
  outside §6).
- `design/screens/04-starter-pick.json` and `design/exports/04-starter-pick.png` —
  the routed screen this task mounts, frame caption exactly `04 Starter pick`
  (slug `04-starter-pick`); its box names are `card 1`, `card 2`, `card 3`,
  `card N highlight`, `portrait N`, `type GRASS`… The desk board is measured at
  `1280×800`.
- `design/fixtures/04-starter-pick.json` — the panel's own payload.
- `src/ui/hud/panels/starter/view.ts` (read; it already freezes
  `STARTER_BOARD.card = { x: 218, y: 176, w: 260, h: 320, pitch: 292 }`),
  `mount.tsx`, `preview.ts`, `index.ts`.
- `src/ui/hud/specGap.ts`, `src/ui/hud/specGap.walk.test.ts`,
  `src/ui/hud/specGap.views/main-menu.ts` (the adapter shape to copy).
- `src/ui/hud/panels/main-menu/**`, `src/ui/npcPanel.ts` (the panel idiom).
- `src/engine/run/progression.ts` (`createRunPokemon`, `xpForLevel`,
  `RunPokemon`), `src/engine/run/starters.ts` (`starterOffer`),
  `src/engine/run/heal.ts` (`healParty`), `src/engine/run/index.ts` (read only —
  **do not add `prologue` to the barrel**, it is not yours).
- `src/engine/rng.ts` (`randomSeed`, `Rng`).
- `src/scenes/StarterScene.ts` (the DOM panel mounting pattern; **do not edit it**),
  `src/scenes/CityScene.ts` (**do not edit**: Task-288 owns it), `src/scenes/walker.ts`,
  `src/scenes/WorldScene.ts`, `src/scenes/GymScene.ts` (the dev-hook idiom).
- `src/engine/save.ts` (`SAVE_KEY`, `SAVE_VERSION`, `decodeSave`, `encodeSave`,
  `storeRun`, `loadSave`, `defaultSettings`).
- `src/settings.ts`, `src/storage.ts`, `src/dev/env.ts` (`IS_DEVELOP`),
  `src/input/input.ts` (`actionKeys`, `subscribeKeybinds`), `src/i18n/index.ts`.

## 🔒 Contract

The public surface the rest of the batch is written against. Exact names and
signatures. `Readonly<{…}>` and `readonly` arrays, as the codebase spells them.

### `src/engine/run/state.ts`

```ts
export type RunState = Readonly<{
  // … every field it already carries …
  /** True once the professor's starter has been taken. A prologue run is `false`. */
  starterTaken: boolean;
}>;

/** A prologue run passes no `starter`: its party is empty until `takeStarter`. */
export type RunInit = Readonly<{
  seed: string;
  starter?: RunPokemon;
  mode?: RunMode;
  bag?: readonly BagCounts[];
  money?: number;
  xp?: number;
  startedAt?: string;
}>;

export function createRun(init: RunInit): RunState;
export function hasLivingParty(run: RunState): boolean;
```

- `createRun` sets `starterTaken: init.starter !== undefined` and
  `party: init.starter === undefined ? [] : [init.starter]`; `xp` stays
  `init.xp ?? xpForLevel(init.starter?.fighter.level ?? 1)`. A caller that passes
  `starter` gets exactly the run it gets today.
- `hasLivingParty` becomes: an **empty party is alive while the starter has not been
  taken**, and a non-empty party is alive while some member has `hp > 0`:

  ```ts
  export function hasLivingParty(run: RunState): boolean {
    if (run.party.length === 0) return !run.starterTaken;
    return run.party.some((member) => member.fighter.hp > 0);
  }
  ```

  An empty party **with** `starterTaken` (a hand-edited save) is still a loss.

### `src/engine/run/prologue.ts` (new)

```ts
import type { RunState } from './state';

/** The level the professor's starter arrives at (`StarterScene`'s own 5). */
export const STARTER_LEVEL: number;

/** The prologue run: no starter taken yet and no member to field. */
export function isPrologue(run: RunState): boolean;

/** The run a brand-new game starts: no party, no badge, standing in the town. */
export function emptyRun(seed: string, startedAt?: string): RunState;

/** The professor's one gift: one member, the starting bag, the flag. */
export function takeStarter(run: RunState, speciesId: string, level: number): RunState;

/** True once the town's exit bands may be walked. Mirrors `hasLivingParty`'s rule. */
export function canLeaveTown(run: RunState): boolean;
```

- `isPrologue(run)` is `!run.starterTaken && run.party.length === 0`.
- `emptyRun(seed, startedAt?)` is `createRun({ seed, ...(startedAt === undefined ? {} : { startedAt }) })`
  — that is, `createRun` with no `starter`. It returns a fresh object every call and
  reads **no RNG** (`planRegion(seed)` is pure; `compatForNode` draws nothing).
- `takeStarter(run, speciesId, level)`:
  - if `run.starterTaken` is `true`, it returns **the same run object** (`===`), so a
    second press cannot grant a second member or a second bag;
  - otherwise it mints `createRunPokemon({ id: nextMemberId(run), speciesId, level,
    learnsetSeed: run.seed })`, and returns the run with `party: [member]`,
    `xp: xpForLevel(level)`, `starterTaken: true`, and the bag with every
    `STARTING_BAG` row added once through `addItem` (an existing stack is
    incremented, never duplicated);
  - the starter is **not** a catch: `stats.catches`, `caughtSpecies` and
    `recordCatch` are untouched;
  - reads **no RNG** beyond the `learnsetSeed: run.seed` handed to
    `createRunPokemon` — a fixed `(run.seed, speciesId, level)` always yields the
    same member.
- `canLeaveTown(run)` is `!isPrologue(run)`.

### `src/engine/save.ts`

- `SAVE_VERSION` stays **28**. `starterTaken` is read **per field with a default**,
  exactly like `bossDefeated`/`towerStreak`, so this adds no migration.
- `parseRun` changes in exactly two places:
  1. `const starterTaken = value.starterTaken === true;`
  2. the early return becomes
     `if (party.length === 0 && starterTaken) return null;`
     (was `if (party.length === 0) return null;`), and the returned literal carries
     `starterTaken`.
- Nothing else moves: `parseMembers([])` is already `[]`, `highestMemberXp` already
  answers `xpForLevel(1)` for a memberless run, and `encodeSave` already serialises
  the whole run object, so a prologue run round-trips `createRun` →
  `encodeSave` → `decodeSave` losslessly.
- Invariant, in one line: **a run with no party is a legal document only while
  `starterTaken` is false**, and a run with `starterTaken: true` must have a party.

### `src/engine/region/travel.ts`

```ts
export type TravelRefusalReason =
  | 'same-node'
  | 'no-such-node'
  | 'not-neighbour'
  | 'gate'
  | 'unvisited'
  | 'not-settlement'
  /** The town's exit before the starter is taken (Task-287). */
  | 'prologue';

export function canTravel(plan: RegionPlan, run: RunState, toKey: string, mode: TravelMode): TravelRefusal | Readonly<{ ok: true; spawn: Tile }>;
export function travel(plan: RegionPlan, run: RunState, toKey: string, mode: TravelMode): TravelRefusal | TravelArrival;
```

- In `resolveTravel`'s **walk** branch only, and **before** `exitGate`:
  `if (from.kind === 'town' && !canLeaveTown(run)) return refusal('prologue');`
  (`refusal('prologue')` carries `badge: null`). A flight out of the town is not a
  walk and is not refused by this rule (a prologue run has visited nothing anyway).
- The refusal touches nothing: the caller's run stays the same object.

### `src/scenes/InteriorScene.ts` (new)

```ts
import Phaser from 'phaser';
import type { Tile } from '../engine/grid';
import type { RunState } from '../engine/run';

/** What the debug/dev browser pass reads. */
export type InteriorDebugState = Readonly<{
  /** The scene's registered key: always `'Lab'`. */
  sceneKey: string;
  /** The door's interior key: `'lab'` for the laboratory. */
  interiorKey: string;
  /** The settlement that owns the door: `'town:1'` on a new run. */
  cityKey: string;
  /** `interiorRoomKind(interiorKey)`: `'lab'`. */
  kind: string;
  starterTaken: boolean;
  partySize: number;
  tile: { x: number; y: number };
}>;

/** The cards the laboratory stands: the offer while it is a prologue, `[]` after. */
export function labStarterOffer(run: RunState | undefined, seed: string): readonly string[];

export class InteriorScene extends Phaser.Scene {
  constructor();                                                    // super('Lab')
  init(data?: { run?: RunState; cityKey?: string; interiorKey?: string }): void;
  /** Dev only: the scene's own facts, on `globalThis.__pkmInterior`. */
  debugInteriorState(): InteriorDebugState;
  /** Dev only: stands the player on `tile` and lets that tile's own rule answer. */
  placePlayer(tile: Tile): void;
}

export const regionSceneKey = 'Lab';
export const regionSceneClass = InteriorScene;
```

- `labStarterOffer(run, seed)` is `run === undefined || run.starterTaken ? [] : starterOffer(seed)`.
  Pure, reads no clock and no storage.
- The scene is the **laboratory only** (`'Lab'`, the key `CityScene.openDoor`
  already derives for `interiorKey === 'lab'`). Every other interior door keeps
  today's fade-back; generalising interiors is owed to a later batch (see
  Coordination).
- It builds the room from `planInterior(planRegion(run.seed), interiorKey, cityKey)`,
  draws it the way `WorldScene` draws a world (two culled layers via
  `applyWorld`/`drawWorld`), stands the player on `plan.entry` with `WorldWalker`,
  and returns to `City` when the player steps back onto `plan.entry` after having
  left it (`this.scene.start('City', { run })`).
- It mounts the shipped starter panel exactly as `StarterScene.createDom` does:
  `mountStarter(host, liveStarterView(...), intent => …)` into `document.getElementById('hud')`,
  disposed on `SHUTDOWN`. On `choose`/`confirm` it calls
  `takeStarter(this.run, pool[index], STARTER_LEVEL)`, `storeRun(browserStorage(), next)`,
  keeps the new run and repaints the panel with `labStarterOffer` — which is now `[]`,
  so the picker is gone. **Print no new string**: `src/i18n/en.ts` and `src/i18n/es.ts`
  belong to Task-288 in this batch, so the laboratory shows nothing but what already
  exists (the panel's own copy, and `t('starter.blurb')` if you want one line under it).
- Dev hook, exactly like `GymScene`/`LeagueScene`: guarded by `IS_DEVELOP`, set on
  `create` and deleted on `SHUTDOWN`:
  `(globalThis as Record<string, unknown>).__pkmInterior = this;`
- The scene registers itself by exporting `regionSceneKey` + `regionSceneClass`;
  `src/scenes/regionScenes.ts` picks it up from its `./*Scene.ts` glob. **Do not
  edit `regionScenes.ts` and do not touch `src/main.ts`.**

### `src/scenes/MainMenuScene.ts`

- `choose()`'s `'new'` case becomes: draw `const seed = randomSeed()`, build
  `const run = emptyRun(seed, new Date().toISOString())`, persist it with
  `storeRun(browserStorage(), run)`, and
  `this.scene.start('Lab', { run, cityKey: planRegion(seed).townKey, interiorKey: 'lab' })`.
- `'continue'` is **unchanged** (`this.scene.start('Route', { run: this.run })`; the
  route scene already hands a settlement run to `City`).
- Keep `previewSeed`'s single `randomSeed()` draw in `create` and every string the
  shipped `MainMenuScene.test.ts` reads off the source. `'new'` may draw its own seed
  — that draw is inside `choose()`, not `create()`.

### `src/ui/hud/specGap.views/starter.ts` (new)

```ts
import type { PanelView, ScreenSpec } from '../specGap';

/** The screen this adapter answers for: one slug, one spec, one panel. */
export const slug: string;                                   // '04-starter-pick'
export function buildView(spec: ScreenSpec): PanelView;
```

- Module shape is the one `specGap.walk.test.ts` discovers:
  `import.meta.glob('./specGap.views/*.ts')`, each value read as
  `{ slug: string; buildView(spec: ScreenSpec): PanelView }`.
- `buildView` builds the **fixture** view (`fixtureStarterView` over
  `design/fixtures/04-starter-pick.json`), never the live run, and narrows it to the
  frame: the three card boxes only, from `STARTER_BOARD.card` —
  `card 1` at `(218, 176, 260, 320)`, `card 2` at `(510, …)`, `card 3` at `(802, …)`,
  i.e. `x = card.x + i * card.pitch` — and the six strings the frame carries
  (`CHOOSE YOUR STARTER`, `BULBASAUR`, `CHARMANDER`, `SQUIRTLE`,
  `SHARE: PKRL-1-f-1a2b3c`, `HOLD R FOR NEW SEED`). `colours: []`.
- A box the frame does not name is never emitted (filter by the frame's box names,
  the way `main-menu.ts` does), so `gapFor` reports no `missing`/`moved` entry.

### `src/ui/hud/specGap.walk.test.ts`

Delete the `'04-starter-pick'` line from `PENDING` (line 49 today). Change nothing
else.

### Data

- `src/data/run.ts`: `STARTING_BAG` gains potions —

  ```ts
  export const STARTING_BAG: readonly StartingItem[] = [
    { itemId: 'pokeball', count: 10 },
    { itemId: 'potion', count: 3 },
  ];
  ```

- `src/data/run.test.ts`'s assertion (`starts the run with ten Poke Balls, everything
  else earned on the route`) is updated to the two-row bag and renamed to say the
  laboratory's gift is balls **and** potions.
- No other data table changes. `potion` is already `src/data/items.ts:1411`.

## 🧩 Data and configuration

| thing | value | where |
| --- | --- | --- |
| `STARTER_LEVEL` | `5` | `src/engine/run/prologue.ts` |
| starting bag | `pokeball` × 10, `potion` × 3 | `src/data/run.ts` |
| `RunState.starterTaken` | `false` on a prologue run, `true` after `takeStarter` | `state.ts` (persisted, default `false` on read) |
| `SAVE_VERSION` | **28, unchanged** | `src/engine/save.ts` |
| interior scene key | `'Lab'` | `InteriorScene.ts` |
| `Pass` refusal reason | `'prologue'` | `travel.ts` |
| shell of the `04` cards | `x 218 / 510 / 802`, `y 176`, `260 × 320` | `STARTER_BOARD` (already shipped) |

No balancing number lives in engine code: the bag and the level are data/constant in
the two places named above, and nothing else is tunable.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-287` — audit against the twenty-one exclusive
    paths above. `docs/region-spec.md` must show **one** hunk, inside §6.
  - The `[live]` criteria run against the dev server (`npm run dev`), Chromium at
    `1280×800`, driven over CDP. The scene hooks are dev-only (`IS_DEVELOP`), so the
    dev build is required.
  - **The save harness (used by L2 and L3):** the save lives in
    `localStorage['pokerandomlike.save']` (`SAVE_KEY`), and its shape is
    `{"version":28,"settings":{…},"run":{…},"history":[]}`. Every pass starts by
    clearing storage, playing one capture, then rewriting only the keys the pass
    needs. Run each pass **twice**; both runs must print the same numbers.
- **Acceptance criteria:**

  - [ ] `[unit]` It typechecks and builds clean (`npm run build`).
  - [ ] `[unit]` `src/engine/run/prologue.test.ts` proves: `emptyRun('seed')` has
    `party: []`, `starterTaken: false`, `hasLivingParty(run) === true`,
    `isPrologue(run) === true`, `canLeaveTown(run) === false`; calling it twice with
    one seed gives two deep-equal runs; it reads no clock (`startedAt` absent is
    `''`).
  - [ ] `[unit]` `prologue.test.ts` proves `takeStarter` grants the member **and the
    bag once**: on a prologue run the party becomes one member with
    `speciesId === 'charmander'`, `fighter.level === 5`, the bag holds
    `pokeball: 10` and `potion: 3`, `xp === xpForLevel(5)`, `starterTaken === true`,
    `stats.catches === 0`; a second `takeStarter` returns the **same object**
    (`toBe`) and leaves the bag and party untouched.
  - [ ] `[unit]` `prologue.test.ts` pins the starter: `takeStarter(emptyRun('seed'),
    'charmander', 5)` twice from two fresh prologue runs of the same seed is
    deep-equal (fixed seed `'prologue-starter'`), and the member id is `catch-1`.
  - [ ] `[unit]` `state.test.ts` proves the alive rule on all four cases: empty party
    + `starterTaken: false` → alive; empty party + `starterTaken: true` → not alive;
    party with one `hp > 0` → alive; party whose members are all `hp === 0` → not
    alive. And `createRun({ seed, starter })` yields `starterTaken: true`, while
    `createRun({ seed })` yields `party: []` and `starterTaken: false`.
  - [ ] `[unit]` `save.test.ts` proves the round trip: `decodeSave(encodeSave({
    version: SAVE_VERSION, settings: defaultSettings(), run: emptyRun('prologue-save'),
    history: [] })).run` is not null, has `party: []`, `starterTaken: false`,
    `nodeKey === planRegion('prologue-save').townKey`, `SAVE_VERSION === 28`.
  - [ ] `[unit]` `save.test.ts` proves a **normal** run still round-trips with its
    flag: a run from `createRun({ seed, starter })` decodes with
    `starterTaken: true` and its party intact.
  - [ ] `[unit]` `save.test.ts` proves the guard: a document whose run has
    `party: []` **and** `starterTaken: true` decodes to `run: null` (the run is
    dropped, the settings survive).
  - [ ] `[unit]` `travel.test.ts` proves the door: from `town:1`, `travel(plan,
    emptyRun(seed), 'route:1', 'walk')` is `{ ok: false, reason: 'prologue', badge:
    null }`; from the same node with a run that took its starter
    (`takeStarter(emptyRun(seed), 'bulbasaur', 5)`) the same call is `ok: true` and
    lands on `route:1`; a walk **back** into the town from `route:1` is never refused
    for `'prologue'`; and a badge-gated city exit still reports `'gate'`.
  - [ ] `[unit]` `src/scenes/interior.test.ts` proves the pure half:
    `labStarterOffer(emptyRun('seed'), 'seed').length === 3` and equals
    `starterOffer('seed')`; `labStarterOffer(takenRun, 'seed')` is `[]`;
    `labStarterOffer(undefined, 'seed')` is `[]`. It imports the scene module with
    `phaser` mocked the way `MainMenuScene.test.ts` mocks it.
  - [ ] `[unit]` `src/ui/hud/panels/starter/specGap.test.ts` pins the board: the
    fixture view has three cards, and the three card boxes are
    `(218, 176, 260, 320)`, `(510, 176, 260, 320)`, `(802, 176, 260, 320)` from
    `STARTER_BOARD`.
  - [ ] `[unit]` `src/ui/hud/specGap.walk.test.ts` is green with
    `'04-starter-pick'` **absent** from `PENDING`, and the adapter's `slug` is
    `'04-starter-pick'` with `gapIsEmpty(gapFor(buildView(spec), spec)) === true`.
  - [ ] `[unit]` `MainMenuScene.test.ts` proves the new-run seam from the source:
    `this.scene.start('Lab'` and `emptyRun(` and `storeRun(` appear in
    `MainMenuScene.ts`, `this.scene.start('Starter'` does **not**, and the existing
    `previewSeed` assertions still hold.
  - [ ] `[unit]` `src/data/run.test.ts` pins the two-row `STARTING_BAG`.
  - [ ] `[unit]` `src/engine/run/README.md` lists `prologue.ts` and its test;
    `src/scenes/README.md` lists `InteriorScene.ts`, `npcs.ts`, `pois.ts` and the new
    test; `src/ui/hud/panels/starter/README.md` lists `specGap.test.ts`.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` **L1 — the `04` board.** Open
    `http://localhost:<port>/?hud=dom&hudFixture=04-starter-pick` at `1280×800`.
    Read `document.querySelectorAll('[data-hud-starter-card]')` — exactly **3**
    elements — and each one's `getBoundingClientRect()` **relative to the page**
    (`x + window.scrollX`, `y + window.scrollY`). Expected, in DOM order:
    `(218, 176, 260, 320)`, `(510, 176, 260, 320)`, `(802, 176, 260, 320)`,
    each coordinate within `±1` px. (Measurement: three DOM rects, no pixels.)
  - [ ] `[live]` **L2 — a new run opens the laboratory.** Start from an empty slot
    (`localStorage.removeItem('pokerandomlike.save')`, then a full page reload),
    click
    `[data-hud-main-menu-row="new"]` (the NEW RUN row of the menu card). Within 5 s read
    `window.__pkmInterior.debugInteriorState()`. Expected exactly:
    `sceneKey === 'Lab'`, `interiorKey === 'lab'`, `cityKey === 'town:1'`,
    `kind === 'lab'`, `starterTaken === false`, `partySize === 0`, and
    `document.querySelectorAll('[data-hud-starter-card]').length === 3` (the pick is
    mounted). Also read
    `JSON.parse(localStorage.getItem('pokerandomlike.save'))`: `version === 28`,
    `run.starterTaken === false`, `run.party.length === 0`,
    `run.nodeKey === 'town:1'`. (Measurement: one scene-object field read and one
    storage read; both runs of the harness must agree.)
  - [ ] `[live]` **L3 — the door is shut before the pick and open after it.** Two
    passes, same seed.
    *Capture:* in the L2 state, click `[data-hud-starter-card]` (the first card), wait
    for `__pkmInterior.debugInteriorState().starterTaken === true`, then step **up**
    off the room's only door and back **down** onto it until `window.__pkmCity`
    appears (the town). Read
    `localStorage.getItem('pokerandomlike.save')` and keep it as `qa287.json`; assert
    `run.starterTaken === true`, `run.party.length === 1`, `run.nodeKey === 'town:1'`,
    `version === 28`.
    *The walk to the band (both passes).* `planCity` puts the spawn in the **central
    block's** plaza, so a right-hold from the spawn never reaches the town's east
    band: the band rides the street rows `y 13..15` at `x 38..39`, while the spawn
    row `y 19` is a block row. Walk the street: after CONTINUE wait until
    `__pkmCity.debugCityState().tile` is the spawn `(19, 19)`, hold **up** until
    `tile.y === 13` (about 1.4 s at the walk step), then hold **right** for 6 s.
    *Pass A (before the pick):* write
    `JSON.stringify({ ...doc, run: { ...doc.run, party: [], starterTaken: false } })`
    into `pokerandomlike.save`, reload, click CONTINUE, walk to the band as above.
    Expected: `debugCityState().key === 'town:1'`, `debugCityState().tile.x >= 38`
    with `tile.y` in `13..15` (the band is reached and refused),
    `window.__pkmRoute === undefined`, and the save still reads
    `run.nodeKey === 'town:1'` with `run.visitedNodes === ['town:1']`.
    *Pass B (after the pick):* write `qa287.json` back unchanged, reload, click
    CONTINUE, walk to the band the same way. Expected: `window.__pkmRoute` is
    defined, `window.__pkmCity` is gone, and the save reads
    `run.nodeKey === 'route:1'` with
    `run.visitedNodes === ['town:1', 'route:1']` (the walk left the town through the
    rule).
    (Measurement: the scene's own `key`/`tile` fields, the presence of
    `__pkmRoute`/`__pkmCity`, and the save's `run.nodeKey`/`run.visitedNodes`.
    **`travels` is not the door's counter:** `CityScene.walkBand` increments it only
    on arrival at a **settlement**, so a walk out into a route never moves it; the
    two passes are told apart by the save's `nodeKey` and by `__pkmRoute`.)

- **A `[live]` that compares pixels is not a criterion** (`D57`). L1 reads DOM rects,
  L2 and L3 read scene fields and the save's JSON — never a screenshot.

## 📣 Coordination

- **For the Orchestrator (plan changes this spec froze):**
  - Task-287's exclusive list gained `src/engine/save.ts` +
    `src/engine/save.test.ts` (Q1 = A) and `src/engine/region/travel.ts` +
    `src/engine/region/travel.test.ts` (Q2 = A). `src/scenes/BootScene.ts` was
    **not** needed and stays out: `hasLivingParty` is the only change that loader
    reads.
  - `InteriorScene` is the **laboratory only** (`regionSceneKey 'Lab'`, Q3 = A).
    Every other interior door (`Centre`, `House`, `Casino`) keeps today's fade-back
    because `regionScenes.ts` (frozen) allows one key per module; generalising them
    to one interior scene is **owed to a later batch**.
- **For Task-288:** `src/scenes/CityScene.ts` is **yours**, not this task's. This
  task changes no city behaviour, so `src/scenes/walker.test.ts`'s `doorAt`,
  `exitBandAt` and `interiorSceneKey` assertions stay valid as written. Do not edit
  `src/scenes/README.md` — this task writes the `npcs.ts` and `pois.ts` lines for you.
- **For Task-289:** same — `src/scenes/README.md` is written here (including your
  `pois.ts` line, "a route's POI drawn and triggered"). Do not edit it. This task
  adds no `src/data/` file, so `src/data/README.md` is untouched by it.
- **For Task-290 (next batch):** the town's exit is now refused at the **pure**
  travel seam (`reason: 'prologue'`), so `WorldScene`'s grass and the capture rule
  need no prologue branch: a prologue run cannot reach a route.
- **For the save:** a prologue run is a legal v28 document. Any later task reading
  `parseRun` must keep the rule "no party only while `starterTaken` is false"; the
  three `save.test.ts` cases above are the contract.
- **For the next batch:** `InteriorScene` is the one interior screen; a task that
  generalises interiors must either map every `interiorKey` to one registered key
  (which needs `CityScene` or a registry change) or add one module per key.

## ⛔ Out of scope

- Editing `src/scenes/StarterScene.ts` (it keeps its own `START_LEVEL` and its
  module-level preview call; it simply stops being reachable from the menu),
  `src/scenes/regionScenes.ts`, `src/main.ts`, `src/scenes/CityScene.ts`.
- Editing `src/engine/run/index.ts` (no barrel export is added for `prologue.ts`).
- Editing the `starter` panel's view model, CSS or mount (`view.ts`, `mount.tsx`,
  `starterPanel.tsx`, `starter.css`, `preview.ts`) — this task only **adds**
  `specGap.test.ts` and one README line there.
- Any i18n change: `src/i18n/en.ts` and `src/i18n/es.ts` belong to Task-288 in this
  batch. The laboratory prints no new string.
- Touching `src/data/dex/**`, `vite.config.ts`, `package.json`, or any generated data
  file.
- The legacy floor/room scene and its tables (`src/scenes/rooms/**`,
  `src/data/gates.ts`, `noHeal.ts`, `bannedRoom.ts`, `loot.ts`, `shop.ts`,
  `staticSpecies.ts`) — the sweep (Task-298) deletes them.
- Retiring `StarterScene` from `main.ts`, generalising interiors, or wiring the town's
  `Centre`/`house` doors.
- Any new dependency, `Math.random()` or `Date.now()` inside `src/engine/`
  (`MainMenuScene` may pass `new Date().toISOString()` **in**, as `StarterScene` does).

## ✅ Delivery

Commit on `task-287` only, never on `main`. When `npm test` and `npm run build` are
green, leave an **empty commit** `dev: done task-287` on the tip and
`git push origin task-287`. No other role commits to this branch.
