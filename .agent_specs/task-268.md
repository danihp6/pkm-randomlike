# Spec: Task-268 — The region: the contract, the plan and the names

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule + data (pure TypeScript, no Phaser, no DOM).
- **Role:** Dev.
- **Objective:** after this task a pure `planRegion(seed)` turns the run seed into the
  whole world of the region phase: one starting town, eight gym cities in badge order,
  one main route per stretch with one or two optional laterals, a Victory Road, the
  League and the tower — every node with a stable `nodeKey`, a seeded unique position,
  the badge/stretch it belongs to, its level cap and its distance to the gym that
  governs it. The plan, its names and its per-node streams are the contract every later
  batch reads, so they are exported from `src/engine/region/index.ts` (and **only**
  `plan`, `names`, `streams`) over the data tables in `src/data/region.ts`.
- **Environment:** worktree `../wt-pkm-268`, branch `task-268`.
- **Dependencies:** none. `src/engine/maps/plan.ts`, `streams.ts` and
  `src/data/maps.ts` are the model being replaced; read them, do not edit them.

### Exclusive paths (single writer)

- `src/engine/region/plan.ts` (new)
- `src/engine/region/plan.test.ts` (new)
- `src/engine/region/names.ts` (new)
- `src/engine/region/names.test.ts` (new)
- `src/engine/region/streams.ts` (new)
- `src/engine/region/streams.test.ts` (new)
- `src/engine/region/index.ts` (new — re-exports only `plan`, `names` and `streams`)
- `src/engine/region/README.md` (new)
- `src/engine/region/route/README.md` (new stub — the generator folder is Batch 118's)
- `src/engine/region/city/README.md` (new stub)
- `src/engine/region/interior/README.md` (new stub)
- `src/engine/README.md` (one new folder line for `region/`)
- `src/data/region.ts` (new)
- `src/data/region.test.ts` (new)
- `src/data/README.md` (one new bullet for `region.ts`; **nothing else**, in
  particular do not add the two city/interior tileset file names — that is another
  batch's task)

Nothing outside this list.

### Inputs (read-only)

- `AGENTS.md`.
- `TODO.md` — the Phase 24 opening and the Batch 117/118/293 rows: they are the
  region's frozen vocabulary (node kinds, sizes, badge ladder, 2-4 screens per route,
  eight gym cities, the League at 60).
- `docs/tech-decisions.md` — `D11` (one seed, named streams), `D29` (a floor's cap is
  its only level anchor), `D12` (English identifiers).
- `src/engine/maps/plan.ts`, `src/engine/maps/streams.ts` — the model being replaced:
  the stream-per-key shape and the seeded topology.
- `src/engine/rng.ts` — `Rng` (`next`, `int`, `split`) and `hashSeed`.
- `src/engine/grid.ts` — `Tile = { x, y }`.
- `src/data/maps.ts` — the shipped cap ladder (`9, 16, 23, 30, 37, 43, 49, 55`) and the
  `<data>.test.ts` shape.
- `src/engine/README.md`, `src/data/README.md` — the map style you are extending.

## 🔒 Contract

### `src/engine/region/streams.ts`

```ts
export type NodeStreams = Readonly<{
  layout: Rng;
  content: Rng;
  encounters: Rng;
  loot: Rng;
}>;

/** The region's own stream: `${seed}:region`. */
export function regionStream(seed: string): Rng;

/** One node's four streams: `${seed}:node:<key>:<pass>`, keyed by `nodeKey`. */
export function nodeStreams(seed: string, key: string): NodeStreams;
```

- Each stream is `new Rng(hashSeed(`${seed}:node:${key}:${pass}`))` with `pass` one of
  `layout | content | encounters | loot`; `regionStream` is
  `new Rng(hashSeed(`${seed}:region`))`.
- **No global prefix:** a node's streams never depend on how many nodes precede it, so
  walking back into a node replays it and adding a node cannot move another.
- Same seed and key ⇒ byte-identical streams; different key ⇒ different sequences.

### `src/engine/region/plan.ts`

```ts
export type RegionNodeKind =
  | 'town'
  | 'city'
  | 'route'
  | 'lateral'
  | 'victory-road'
  | 'league'
  | 'tower';

export type RegionNode = Readonly<{
  /** `nodeKey(kind, id)`, the node's only name. */
  key: string;
  kind: RegionNodeKind;
  /** 1-based within its kind. */
  id: number;
  /** The settlement's generated name, `Route <n>`, `Victory Road`, `League`, `Tower`. */
  name: string;
  /** The badge stretch the node belongs to: 1-8; 9 for the Victory Road, League, tower. */
  badge: number;
  /** `badgeCap(badge)` — the stretch's level cap. */
  cap: number;
  /** Main-chain steps to the gym that closes the stretch: 0 exactly at a gym. */
  gymDistance: number;
  /** 1-3 for a city, `1 | 2 | 3`; null for every other kind. */
  tier: 1 | 2 | 3 | null;
  /** True for the eight gym cities, false elsewhere (a later city may be gym-less). */
  gym: boolean;
  /** The main route key this lateral hangs off; null on the chain. */
  lateralOf: string | null;
  position: Readonly<{ x: number; y: number }>;
  /** Every neighbour's key, no duplicates, both directions present. */
  edges: readonly string[];
}>;

export type RegionPlan = Readonly<{
  seed: string;
  nodes: readonly RegionNode[];
  townKey: string;
  /** The spine, town first, in travel order: it excludes laterals. */
  chain: readonly string[];
  /** The eight gym cities' keys in badge order. */
  gymKeys: readonly string[];
}>;

export function nodeKey(kind: RegionNodeKind, id: number): string; // `${kind}:${id}`
export function parseNodeKey(key: string): Readonly<{ kind: RegionNodeKind; id: number }> | null;
export function nodeOf(plan: RegionPlan, key: string): RegionNode | undefined;
export function planRegion(seed: string): RegionPlan;
```

Plan rules (all seeded from `regionStream(seed).split('plan')`; names from
`regionStream(seed).split('names')` via `names.settlementNames`):

1. Spine: `town, route, city(gym, badge 1), route, city(gym, badge 2), …,
   city(gym, badge 8), victory-road, league, tower` — nine settlements and eight main
   routes. Each stretch (`city n-1 → city n`, with the town as the opening settlement of
   stretch 1) carries exactly one main route plus **1 or 2 laterals** attached to it, so
   the plan holds **16-24 routes** in total (`route` + `lateral`).
2. A lateral hangs off exactly one main route (`lateralOf`), has exactly one edge, and
   terminates there: its POI is its own content (`[Task-277]`), never a node. A later
   task may append a gym-less city at its end; this plan does not.
3. Badges are 1-8 in chain order and every city is a gym (`gym: true`, `tier` from
   `cityTierForBadge`). `victory-road`, `league` and `tower` carry badge 9 and cap 60.
4. `gymDistance`: along a stretch the gym is 0, the node immediately before it is 1,
   and the count rises by one per step back to the settlement that opens the stretch
   (the town therefore carries its own distance to gym 1). A lateral is its parent's
   `gymDistance + 1`. After gym 8 the count keeps rising through the Victory Road, the
   League and the tower.
5. Route names are `Route <n>` in **chain order** over main routes and laterals together
   (1-based); settlements get the generated names, unique per seed.
6. `position` is seeded and unique across all nodes (a small jittered grid: x grows
   along the spine, laterals step off it; two nodes never share a cell).
7. The graph is undirected and connected: every edge appears on both endpoints, no
   duplicate neighbours, and every node is reachable from the town.
8. `planRegion` is pure and total: same seed ⇒ deep-equal plan, no `Math.random`, no
   `Date.now`, no Phaser, no DOM.

### `src/engine/region/names.ts`

```ts
/** `count` unique `Adjective Noun` names drawn from the data lists, in draw order. */
export function settlementNames(rng: Rng, count: number): readonly string[];
/** 'Route 1' for 1, in chain order. */
export function routeName(index: number): string;
```

Names are title-cased, unique per call, and stable for a given stream position and
`count`.

### `src/data/region.ts`

```ts
export type RegionSize = Readonly<{ width: number; height: number }>;
export type CityTier = Readonly<{
  tier: 1 | 2 | 3;
  badges: readonly number[];
  size: RegionSize;
  buildings: number;
}>;

export const TOWN_SIZE: RegionSize = { width: 40, height: 40 };
export const CITY_TIERS: readonly CityTier[]; // 1-2 → 50×50/6, 3-5 → 70×70/10, 6-8 → 90×90/14
export const INTERIOR_SIZE: RegionSize = { width: 24, height: 18 };
export const GYM_SIZE: RegionSize = { width: 40, height: 40 };
export const ROUTE_WIDTH = 60;
export const ROUTE_HEIGHTS: readonly [120, 160, 200];
export const BADGE_CAPS: readonly [9, 16, 23, 30, 37, 43, 49, 55];
export const LEAGUE_LEVEL = 60;
export const NAME_ADJECTIVES: readonly string[]; // at least 12
export const NAME_NOUNS: readonly string[];      // at least 12

export function cityTierForBadge(badge: number): CityTier;
export function badgeCap(badge: number): number;   // 1-8 from BADGE_CAPS, 9 → LEAGUE_LEVEL
export function citySize(badge: number): RegionSize;
```

- All balancing lives here; no engine file hard-codes a size, a cap or a name list.
- `CITY_TIERS`' `badges` are `[1, 2]`, `[3, 4, 5]`, `[6, 7, 8]`; `cityTierForBadge`
  throws on a badge outside 1-8 (an engine caller never passes 9).

## 🧩 Data and configuration

No JSON file is added; the tables above are TypeScript in `src/data/region.ts`, as
`src/data/maps.ts` already does. `src/data/README.md` gains one bullet: `region.ts` —
the region's sizes, badge caps and name lists, plus the three helper functions.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm ci --prefer-offline --no-audit --no-fund` once in the worktree.
  - `npm test` — Vitest, headless, green.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-268` audited against the exclusive paths.
  - No browser pass is owed: every criterion is `[unit]`.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` On eight fixed seeds the plan holds exactly one `town`, eight `city`
    nodes that are gyms with badges 1-8 in chain order, one `victory-road`, one
    `league` and one `tower`; the graph is connected and every edge is reciprocal with
    no duplicate neighbour.
  - [ ] `[unit]` Every node's `position` is unique; every route's name is
    `Route <n>` and the numbers are 1..N in chain order (main routes and laterals
    together).
  - [ ] `[unit]` Every stretch holds 2-3 routes (one `route` plus 1-2 `lateral`),
    every lateral has exactly one edge pointing at its `lateralOf` route, and the
    total route count is 16-24.
  - [ ] `[unit]` `gymDistance` is 0 exactly at the eight gyms, it falls by exactly one
    per main-chain step towards the closing gym, and a lateral is its parent's value
    plus one.
  - [ ] `[unit]` `nodeKey('city', 3) === 'city:3'` and `parseNodeKey` round-trips every
    kind and a positive id, returning `null` for `''`, `'city'`, `'city:x'`,
    `'nope:1'` and `'city:0'`.
  - [ ] `[unit]` Settlement names are unique within a seed and identical on a second
    `planRegion` of the same seed; a different seed changes at least one name.
  - [ ] `[unit]` A fixed seed pins a digest of the whole plan (kind, key, name, badge,
    cap, gymDistance, position, edges), asserted as a literal.
  - [ ] `[unit]` `nodeStreams(seed, key)` gives byte-identical draws on two calls and
    different draws for a different key; `streams.test.ts` proves it for all four
    passes.
  - [ ] `[unit]` `src/engine/` imports no Phaser and no DOM, and no `Math.random()` or
    `Date.now()` entered it.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.

## 📣 Coordination

- For the Architect: `src/engine/region/index.ts` re-exports **only** `plan`, `names`
  and `streams`; Batch 118's three generators add `route/`, `city/` and `interior/`
  without touching it. A lateral currently terminates at itself (its POI is content);
  if a later batch wants a gym-less city at a lateral's end, it appends one there.
- For Batch 118: `planCity(plan, key)` and `planRoute(plan, key)` read
  `nodeStreams(seed, key).layout`; sizes come from `src/data/region.ts`'s
  `CITY_TIERS` / `ROUTE_HEIGHTS`, never from a literal.
- For Batch 119: the run's `nodeKey` starts at `plan.townKey`; the gate and the level
  curve read `badge`, `cap` and `gymDistance` from the node, never recompute them.

## ⛔ Out of scope

- Do not delete `src/engine/maps/**`, `src/data/maps.ts` or `docs/maps-spec.md`; the
  sweep (Batch 125) and the doc task (Batch 117's `[Task-270]`) do that.
- Do not build any generator, any tile map, any scene, any save field or any i18n
  string.
- Do not regenerate the dex and do not touch `package.json`, `src/main.ts`,
  `vite.config.ts` or a `src/scenes/*.ts`.
