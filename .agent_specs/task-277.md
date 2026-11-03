# Spec: Task-277 — What a node holds is rolled per key

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule (pure content roll).
- **Role:** Dev.
- **Objective:** one pure pass decides, per region node and off its own `content`
  stream, what stands in it: how many NPCs, which special NPCs, whether it has
  grass, which shops it holds, how many trainers are posted and — for a lateral's
  terminus — which point of interest it ends on. The same node walked back into rolls
  the same content for ever, and a different seed rolls another region.
- **Environment:** worktree `../wt-pkm-277`, branch `task-277`.
- **Dependencies:** the region plan — `src/engine/region/plan.ts` (`RegionPlan`,
  `RegionNode`, `nodeOf`), `src/engine/region/streams.ts` (`nodeStreams`) and
  `src/data/npcs.ts` (`NPC_ROWS`), all already merged.

### Exclusive paths (single writer)

- `src/engine/region/content.ts`
- `src/engine/region/content.test.ts`
- `src/engine/region/index.ts`
- `src/engine/region/README.md`
- `docs/region-spec.md` **§7.3 only** (create the subsection between §7.2 and §8)

### Inputs (read-only)

- `AGENTS.md`
- `docs/region-spec.md` (§1, §2, §7 and its intro, §7.1, §7.2)
- `src/engine/region/plan.ts`, `src/engine/region/plan.test.ts`,
  `src/engine/region/streams.ts`
- `src/data/npcs.ts`, `src/data/region.ts`
- `src/engine/maps/plan.ts` (only to read what `MapRoomSpecial` used to name; it is
  **not** imported)

## 🔒 Contract

### TypeScript — `src/engine/region/content.ts`

```ts
/** The nine points of interest a lateral's terminus can end on. */
export type PoiKind =
  | 'vault'
  | 'miniboss'
  | 'trade'
  | 'no-heal'
  | 'static'
  | 'secret-shop'
  | 'banned'
  | 'puzzle'
  | 'legendary';

/** The kinds of shop a node holds. The secret shop is a `PoiKind`, not a shop. */
export type ShopKind = 'mart';

export const POI_KINDS: readonly PoiKind[];

export type NodeContent = Readonly<{
  /** The generic NPCs the node stands, in placement order. */
  npcs: readonly { npcId: string }[];
  /** The special NPCs (a tutor, a reroll, a merchant…), 1-2 in a city. */
  specials: readonly { npcId: string }[];
  /** The point of interest a lateral's terminus ends on; null on the main chain. */
  poi: PoiKind | null;
  /** Whether the node rolls wild encounters (its grass corner or its tall grass). */
  grass: boolean;
  /** The shops it holds; a city has the mart, nothing else does. */
  shops: readonly ShopKind[];
  /** How many trainers are posted on its map. */
  trainers: number;
}>;

/**
 * The content a node holds. Pure and total over the plan: it draws only off
 * `nodeStreams(plan.seed, key).content`, in one fixed order, and never throws for a
 * key the plan carries.
 */
export function planNodeContent(plan: RegionPlan, key: string, tier: 1 | 2 | 3): NodeContent;
```

Rules:

- **Draw order is fixed and documented in the file**: (1) the generic NPC count,
  (2) each generic NPC id, (3) the special count, (4) each special id, (5) the
  trainer count, (6) the POI kind **last**. Every draw comes from
  `nodeStreams(plan.seed, key).content` — one `Rng` instance taken once, in that
  order, so a later pass can add a draw at the end without moving an earlier one
  (`D60`). No other stream is read, no clock, no `Math.random()`.
- `nodeOf(plan, key)` is the node; a key the plan does not hold throws
  `` new Error(`unknown node: ${key}`) `` (the house shape the generators use).
- **Generic NPCs** (`npcs`): the count is `tier`'s range — tier 1 `2..3`, tier 2
  `4..6`, tier 3 `7..10` — drawn with `rng.int(min, max)`; the ids are drawn
  **without replacement** from the `NPC_ROWS` ids **in row order** (copy the id
  list, `rng.int(0, pool.length - 1)`, splice). The **town** stands exactly one
  (`NPC_ROWS[0].id`), with **no draw** for the count. The `tier` argument is the
  node's own `tier` for a `city`; every other node passes `1` and its kind overrides
  the tier rule where this spec says so.
- **Special NPCs** (`specials`): a `city` draws a count of `1..2` (one draw) and
  then that many ids without replacement from a **second** copy of the
  `NPC_ROWS` id list (the same commission the generic pass draws from, a separate
  copy). Every other kind stands none and takes no draw. The per-NPC probability is
  **not** rolled here: it is `src/data/npcs.ts`'s to carry in a later task, and this
  pass only decides *which* ones stand in this city for this seed.
- **`grass`**: `true` for `town`, `city`, `route` and `lateral` (a settlement's grass
  corner, a route's tall grass); `false` for `victory-road`, `league` and `tower`.
  No draw.
- **`shops`**: `['mart']` for a `city`; `[]` for every other kind. No draw.
- **`trainers`**: a `city` draws `1..2`, `2..3` or `3..4` by `tier` 1, 2, 3; a
  `route` or a `lateral` draws `2..4`; the `town`, the `victory-road`, the `league`
  and the `tower` post none and take no draw.
- **`poi`**: a node whose `lateralOf` is not `null` (a lateral, i.e. a terminus)
  draws one kind **last** with `POI_KINDS[rng.int(0, POI_KINDS.length - 1)]`; every
  node on the main chain has `null` and takes no draw.
- The returned object is fresh on every call (never a shared array) and holds only
  the fields above.

### `src/engine/region/index.ts`

Append exactly one line:

```ts
export * from './content';
```

### README

`src/engine/region/README.md` gains, in its Layout list, after the `streams.test.ts`
line and **not** inside the three folder bullets:

```
- `content.ts` — what a node holds: its NPCs, its special NPCs, its grass, its shops, its
  posted trainers and a lateral's point of interest, all off the node's `content` stream
  (`planNodeContent`, `PoiKind`, `ShopKind`, `POI_KINDS`).
- `content.test.ts` — the tier counts, the lateral-only POI, the replay and a fixed seed's
  content digest.
```

### Data

No new data table. The ranges above are constants of this module, each with a doc
comment; `docs/region-spec.md` §7.3 states them, and the full campaign scale may move
them into `src/data/` in a later task.

## 🧩 Data and configuration

- `POI_KINDS`, in this exact order: `vault`, `miniboss`, `trade`, `no-heal`,
  `static`, `secret-shop`, `banned`, `puzzle`, `legendary` — the nine the retired
  `MapRoomSpecial` named, spelled for a zone on a route.
- `ShopKind`: `mart` only.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`; green.
  - `git diff --name-only main...task-277` against the exclusive paths list.
  - No browser pass: every criterion is `[unit]`.

- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` For a `city` of tier 1, 2 and 3 over 200 seeds each, `npcs.length` is
    inside `2..3`, `4..6` and `7..10`; over the same sample the tier-3 mean is
    strictly greater than the tier-1 mean.
  - [ ] `[unit]` `specials.length` is `1..2` for every city over 200 seeds and `0` for
    the town and for a route; no city's `specials` repeats an `npcId`.
  - [ ] `[unit]` Every `lateral` of a plan has exactly one `poi` from `POI_KINDS`, and
    every main-chain node has `poi: null` (all eight seeds of `plan.test.ts`'s sample
    or an equivalent eight-seed loop).
  - [ ] `[unit]` `grass` is `true` for the town, the first city, the first route and a
    lateral, and `false` for the victory road, the league and the tower.
  - [ ] `[unit]` `shops` is `['mart']` on a city and `[]` on the town and a route.
  - [ ] `[unit]` Two calls for one node and seed are deeply equal; the same node on
    another seed differs (compare the JSON of a city's content across the eight
    seeds and require at least two distinct values); a fixed seed's whole-plan
    content digest is pinned as a literal in the test.
  - [ ] `[unit]` `planNodeContent` throws `unknown node: nope:1` for a key the plan
    does not hold.
  - [ ] `[unit]` `src/engine/` still imports no Phaser and no DOM, and no
    `Math.random()` or `Date.now()` entered it.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.

## 📣 Coordination

- For the Architect: the `specials` row is `{ npcId }` only — a per-NPC `chance`
  needs a figure no table carries yet (`src/data/npcs.ts` has no `chance` today, and
  it belongs to the NPC task of Batch 122). The count and the draw are this task's;
  the probability stays the later task's. The tier NPC counts, the trainer counts and
  the town's single NPC are module constants here, stated in `§7.3`, until the
  full-scale task moves the campaign's numbers into `src/data/`.
- For the next batch: `planNodeContent(plan, key, tier)` is the only source of a
  node's NPCs, shops, grass and trainers; `NodeContent.poi` names a lateral's
  terminus as one of `POI_KINDS`, and `src/data/pois.ts` (Batch 122) attaches each
  kind's own data to it. The scene tasks read the returned object, never re-roll.

## ⛔ Out of scope

- Placing the NPCs in a scene, their lines, their actions and their shops' stock.
- The POI data (`src/data/pois.ts`), its zone rect and its trigger — Batch 122.
- The encounter table and the wild level — later tasks.
- Any edit to `src/data/**`, `src/scenes/**`, `src/ui/**` or the region plan itself.
