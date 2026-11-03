# Spec: Task-291 — Missions are a stack: one automatic per stretch, one fixed per city, one random from an NPC

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** data + pure engine rule + HUD panel (DOM).
- **Role:** Dev.
- **Objective:** the run's mission system stops being "one row drawn per floor and
  remembered by `RunState.mission`" and becomes a **stack over region nodes**: every
  node the run stands on exposes, in a fixed order, (1) its **stretch's automatic
  mission** ("lose no Pokémon until the leader of the badge stretch falls"), (2) the
  **city's fixed mission** when the node is a city, and (3) the **random mission an
  NPC of that city offers**, drawn deterministically from the run seed. Each row has a
  status — `active`, `failed` or `met` — that is **derived** from state the run already
  persists (`completedMissions`, `stats.casualties`, `floorCasualties`), so the save
  schema, `SAVE_VERSION` and every legacy floor path stay exactly as they are. The
  HUD's mission card draws the stack instead of one row.
- **Environment:** worktree `../wt-pkm-291`, branch `task-291`.
- **Dependencies (already merged on `main`):** the region plan and its node keys
  (`src/engine/region/plan.ts`, `nodeKey`, `RegionNodeKind`, `nodeOf`), the schema that
  carries `completedMissions` (`src/engine/run/state.ts`), the shipped mission card
  (`src/ui/hud/panels/missions/**`) and the shipped mission types
  (`src/data/missions.ts`, `src/engine/run/missions.ts`).

### Exclusive paths (single writer)

- `src/data/missions.ts`
- `src/data/missions.test.ts`
- `src/engine/region/missions.ts` (new)
- `src/engine/region/missions.test.ts` (new)
- `src/engine/region/travel.ts`
- `src/engine/region/travel.test.ts`
- `src/engine/run/badge.ts`
- `src/engine/run/badge.test.ts` (create if absent)
- `src/engine/region/README.md`
- `src/engine/run/README.md`
- `src/i18n/en.ts`
- `src/i18n/es.ts`
- `src/ui/hud/panels/missions/view.ts`
- `src/ui/hud/panels/missions/view.test.ts`
- `src/ui/hud/panels/missions/missionsPanel.tsx`
- `src/ui/hud/panels/missions/missions.css`
- `src/ui/hud/panels/missions/README.md`
- `src/scenes/panels/missions.ts`
- `docs/region-spec.md` — **only** a new `### 7.10` section, inserted between `### 7.9`
  and `### 7.11`. Do not touch any other line of that file.

If a path outside this list must change for the build to stay green, **stop** and say
so in your final report instead of touching it.

### Inputs (read-only)

- `AGENTS.md`.
- `docs/region-spec.md` §1 (identity and node keys), §3 (badge ladder), §7.9, §7.11.
- `docs/design-spec.md` §3 (the HUD card's mission row) and §7 (missions).
- `src/engine/region/plan.ts` (`RegionNode`, `RegionPlan`, `nodeOf`, `nodeKey`,
  `RegionNodeKind`, `badge`, `tier`).
- `src/engine/region/travel.ts` (`travel` builds the run on node entry).
- `src/engine/run/state.ts` (`RunState.mission`, `completedMissions`,
  `missionsCompleted`, `hpLost`, `floorCasualties`, `stats.casualties`).
- `src/engine/run/missions.ts` (the **legacy floor** module — read it, do **not** edit
  or delete it: `RouteScene` and `src/ui/hud/state.ts` still import it, and the sweep
  task removes it later).
- `src/data/missions.ts`, `src/ui/hud/panels/missions/**`, `src/scenes/panels/missions.ts`.
- `design/screens/03-route-hud.json` and `design/exports/03-route-hud.png` — the board
  frame's caption is exactly **`03 Route HUD`** (the card lives in this frame; its
  `party level label` and `detail lv` nodes are not yours).

## 🔒 Contract

### `src/data/missions.ts` — add the node catalogue, keep the legacy rows

The legacy floor exports (`MissionKind = 'flawless'`, `MISSION_TABLE`, `getMission`,
`missionsOfKind`, `MissionReward`) stay **verbatim and working**; the region adds a
separate, node-scoped catalogue beside them:

```ts
/** The three scopes the region's stack uses. */
export type StackMissionKind = 'stretch' | 'city' | 'random';

export type StackMissionRow = Readonly<{
  id: string;
  kind: StackMissionKind;
  nameKey: TranslationKey;
  reward: MissionReward;
}>;

/** One row per kind at least; the stretch row is the automatic one. */
export const STACK_MISSIONS: readonly StackMissionRow[];
export function getStackMission(id: string): StackMissionRow | undefined;
export function stackMissionsOfKind(kind: StackMissionKind): readonly StackMissionRow[];
/** The stretch's automatic row, identical for every badge. */
export const STRETCH_MISSION_ID: string;
/** The city's fixed row for a tier (1 | 2 | 3). */
export function cityMissionFor(tier: 1 | 2 | 3): StackMissionRow;
/** Every random row an NPC can offer, in table order. */
export function randomMissions(): readonly StackMissionRow[];
```

Rules: `STRETCH_MISSION_ID` names the one `stretch` row; `cityMissionFor` answers a
`city` row (one per tier is fine); `randomMissions()` is the pool the NPC draw picks
from and is never empty. Every row's `nameKey` is a real key you add to both i18n tables.

### `src/engine/region/missions.ts` — the stack (new, pure, no Phaser/DOM/clock)

```ts
export type MissionStatus = 'active' | 'failed' | 'met';

export type ActiveMission = Readonly<{
  /** The catalogue row's id. */
  id: string;
  /** `stretch`, `city:<key>` or `random:<key>` — stable, and the card's DOM hook. */
  scopeKey: string;
  nameKey: TranslationKey;
  status: MissionStatus;
  /** 0-2 for the stretch row (casualties taken in this node), 0 for the others. */
  progress: number;
}>;

/** The stack of the node the run stands on, in the fixed order stretch → city → random. */
export function activeMissions(run: RunState, plan: RegionPlan): readonly ActiveMission[];

export type MissionEvent =
  | Readonly<{ kind: 'enter-node'; nodeKey: string }>
  | Readonly<{ kind: 'leader-fallen'; badge: number }>
  | Readonly<{ kind: 'mission-met'; id: string; badge: number }>;

/** The run after the event; a no-op returns the same object. */
export function advanceMissions(run: RunState, event: MissionEvent, plan?: RegionPlan): RunState;
```

The derivation, frozen:

- **Stretch row**: always present, for the badge the node belongs to. `progress` is
  `max(0, run.stats.casualties - run.floorCasualties)` (0-2 is enough for the card; the
  raw count is fine too). Status: `met` when `run.completedMissions` holds
  `{ id: STRETCH_MISSION_ID, mapIndex: <that badge> }`; otherwise `failed` when that
  progress is `> 0`; otherwise `active`.
- **City row**: only when `nodeOf(plan, run.nodeKey)?.kind === 'city'`. The row is
  `cityMissionFor(node.tier ?? 1)`, `scopeKey` `city:<run.nodeKey>`, met when
  `completedMissions` holds `{ id, mapIndex: node.badge }`.
- **Random row**: only when the node is a city. The row is drawn **once per city and
  seed** from `new Rng(hashSeed(`${run.seed}:mission:random:${run.nodeKey}`))` over
  `randomMissions()`, so a revisit reads the same row and another seed a different one.
  `scopeKey` `random:<run.nodeKey>`, met as the city row.
- A node that is not a city (town, route, lateral, victory-road, league, tower) shows
  **only** the stretch row.
- `advanceMissions`:
  - `enter-node`: `{ ...run, hpLost: 0, floorCasualties: run.stats.casualties }`.
  - `leader-fallen`: appends `{ id: STRETCH_MISSION_ID, mapIndex: badge }` to
    `completedMissions` (unless already there) and bumps `missionsCompleted` by one;
    returns the same object when it is already recorded.
  - `mission-met`: appends `{ id, mapIndex: badge }` and bumps `missionsCompleted` the
    same way.
- **Determinism (`D11`):** the only stream read is
  `Rng(hashSeed(`${seed}:mission:random:<nodeKey>`))`, one `int` draw. It must not
  touch the `plan`, `layout`, `content` or battle streams.

### `src/engine/region/travel.ts` — the node's window opens

`travel()`'s successful branch runs the run through
`advanceMissions({ ...run, nodeKey: toKey, visitedNodes, ...compatForNode(...) }, { kind: 'enter-node', nodeKey: toKey })`,
so every entry resets the stretch window. A refusal still returns no run.

### `src/engine/run/badge.ts` — the leader completes the stretch

`grantBadge(run, badge)` keeps its guards and, after appending the badge, records the
stretch completion through `advanceMissions(run, { kind: 'leader-fallen', badge })`. A
repeated badge must still return the run unchanged (no double completion).

### i18n

Add to `src/i18n/en.ts` and `src/i18n/es.ts`, same keys both ways (`D43`):

- the catalogue's `nameKey`s (stretch, city, random rows), authored in English first;
- `'hud.missionsStack'` — the card's title (`MISSIONS` already exists as
  `hud.missions`; reuse it if you can, and then do not add a new one);
- `'hud.missionsBadge': 'Badge {badge}'` (the row's tag);
- `'hud.missionsFailed': 'failed'` and `'hud.missionsMet': 'met'` (the row's status tag).

The shipped `mission.flawless` key may be reused as the stretch row's `nameKey` if its
value fits; otherwise add the new one and leave `mission.flawless` alone (the legacy
module still reads it).

### The card — `src/ui/hud/panels/missions/`

- `view.ts`: `missionsPanelView(input)` maps the stack to rows **in the order
  `activeMissions` returns**, one row each, keeping the shipped box math and the
  `MISSIONS_MAX_ROWS` clamp. Each row's view carries
  `{ name, tag, progress: string | null, status: MissionStatus, scopeKey }`.
- `missionsPanel.tsx`: each row prints `data-hud-missions-row={scopeKey}` and
  `data-state={status}`. The head row and the empty state stay as shipped, but the
  empty state is only drawn when the stack is empty (never in practice, because the
  stretch row is always there — keep the branch anyway).
- `src/scenes/panels/missions.ts`: `missionsInput` reads
  `activeMissions(host.run(), planRegion(host.run().seed))`; no `run.mission` read
  remains in this file. `routePaused`/`panelExpanded` behaviour is unchanged.

## 📣 Coordination

- For the QA: the legacy floor mission module is intentionally untouched; a diff that
  touches `src/engine/run/missions.ts`, `src/engine/run/state.ts` or `save.ts` is a
  failure of this spec.
- For the next batch: `activeMissions` is the only entry point a scene needs; the
  region sweep task deletes the legacy floor module and the `run.mission` field later.

## 🧪 Test and Validation Plan (for QA)

- **Method:** `npm test` (Vitest, headless), `npm run build`
  (`tsc --noEmit && vite build`), `git diff --name-only main...task-291` audited
  against the exclusive paths, then the browser pass below.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `src/engine/region/missions.test.ts` proves: a stretch's automatic
    mission is `failed` after a casualty (`stats.casualties` above `floorCasualties`)
    and `met` after `{ kind: 'leader-fallen' }`; the same city mission is returned on a
    revisit of that city; the random row is identical for one seed twice and differs for
    at least one other seed (assert over two seeds you fix in the test); the stack's
    order is exactly `stretch → city → random` on a city node and `[stretch]` on a
    route node.
  - [ ] `[unit]` `src/engine/region/travel.test.ts` proves an accepted travel resets
    `hpLost` to 0 and `floorCasualties` to `stats.casualties`, and a refusal leaves the
    run object identical.
  - [ ] `[unit]` `src/engine/run/badge.test.ts` proves `grantBadge` records the stretch
    completion once and a repeated badge completes nothing twice.
  - [ ] `[unit]` `src/data/missions.test.ts` proves the catalogue is well-formed: ids
    unique, every `nameKey` exists in `en` and `es`, `cityMissionFor` answers all three
    tiers, `randomMissions()` is non-empty, and the legacy exports still answer as
    before.
  - [ ] `[unit]` `src/ui/hud/panels/missions/view.test.ts` proves the view keeps the
    stack's order, prints one row per mission, and carries `status`/`scopeKey`.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` At 1280×800, with a v28 save standing on `route:1` whose
    `stats.casualties` is `floorCasualties + 1` (inject it through the page's own engine
    modules — `await import('/src/engine/run/state.ts')` and
    `await import('/src/engine/save.ts')` on the Vite dev server — write it with
    `storeRun`, reload): `document.querySelector('[data-hud-panel="missions"]')` holds
    exactly **one** `[data-hud-missions-row]` and it has
    `data-state="failed"`; the same save with `stats.casualties === floorCasualties`
    renders `data-state="active"`. On a `city:2` save the card holds **three** rows in
    order `stretch`, `city:city:2`, `random:city:2` (the `data-hud-missions-row`
    values), the first with `data-state="active"`.
    **Measurement:** read the DOM with `document.querySelectorAll`, report the row
    count, the ordered `data-hud-missions-row` values and each `data-state`.
- **No pixel comparison:** fidelity is read from `design/screens/03-route-hud.json`,
  never from a screenshot diff (`D57`).

## ⛔ Out of scope

- Do not delete `src/engine/run/missions.ts`, `RunState.mission`, `hpLost` or
  `floorCasualties`; the sweep task does that.
- Do not touch `save.ts`, `SAVE_VERSION`, `src/scenes/RouteScene.ts` or any battle
  scene.
- No new `docs/` file; only `docs/region-spec.md` §7.10, in the region's vocabulary
  (nodes, badges, stretches) — never "floor" as live behaviour.
- No new dependency.
