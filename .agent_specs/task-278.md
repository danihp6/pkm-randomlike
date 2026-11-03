# Spec: Task-278 — The guard asks for the badge, and nothing blocks the way back

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule (pure predicate).
- **Role:** Dev.
- **Objective:** one pure predicate answers, for an edge of the region plan and a list
  of badges, whether that edge is a guard at all, whether the badges open it and which
  badge it asks for — plus the badge a node's way forward wants. Leaving a city needs
  that city's badge; every edge back, and every edge inside one stretch, is not a gate
  at all, so walking back is never blocked.
- **Environment:** worktree `../wt-pkm-278`, branch `task-278`.
- **Dependencies:** the region plan — `src/engine/region/plan.ts` (`RegionPlan`,
  `RegionNode`, `nodeOf`) — and `src/data/region.ts` (`BADGE_CAPS`), both merged.

### Exclusive paths (single writer)

- `src/engine/run/gates.ts`
- `src/engine/run/gates.test.ts`
- `docs/region-spec.md` **§4 only**

### Inputs (read-only)

- `AGENTS.md`
- `docs/region-spec.md` (§1, §2, §3, §4)
- `src/engine/region/plan.ts`, `src/engine/region/plan.test.ts`
- `src/data/region.ts`
- `src/engine/run/perms.ts` (the house shape of a pure predicate in `run/`)

## 🔒 Contract

### TypeScript — `src/engine/run/gates.ts`

```ts
/** One edge's answer: the badge it asks for, and whether the run holds it. */
export type ExitGate = Readonly<{ open: boolean; badge: number }>;

/**
 * The guard on `fromKey`'s forward edge, or null when the edge is not a gate.
 * It takes the badge list, never a `RunState`.
 */
export function exitGate(
  plan: RegionPlan,
  fromKey: string,
  toKey: string,
  badges: readonly number[],
): ExitGate | null;

/** The gym badge a node's way forward asks for, or null when no gym is ahead. */
export function nextBadge(plan: RegionPlan, fromKey: string): number | null;
```

Rules, exactly:

1. `exitGate` returns `null` when any of these holds:
   - `nodeOf(plan, fromKey)` or `nodeOf(plan, toKey)` is `undefined`;
   - `toKey` is not in `fromKey`'s `edges`;
   - `fromKey`'s kind is not `'city'` — the town, a route, a lateral, the victory
     road, the league and the tower carry no guard;
   - the edge does not go **forward** on the main chain:
     `plan.chain.indexOf(toKey) !== plan.chain.indexOf(fromKey) + 1`. Walking back
     (`toKey` at `index - 1`) and every off-chain edge (a lateral, which is not on
     `chain`) are therefore `null`.
2. Otherwise the gate is `{ badge: city.badge, open: badges.includes(city.badge) }`,
   where `city` is the `fromKey` node: leaving `city:n` asks for badge `n`, which is
   exactly the badge that city's gym hands over, so no stretch can be skipped.
3. `nextBadge` returns the gym badge of `fromKey`'s stretch, or `null`:
   - `undefined` node → `null`;
   - `node.badge > BADGE_CAPS.length` → `null` (badge 9 is the victory road, the
     league and the tower: no gym ahead of them);
   - otherwise `node.badge`. The town's node carries badge 1, so `nextBadge(plan,
     plan.townKey) === 1`: the first badge is the one the town's way forward names.
4. Both functions are **pure and total**: no throw for an unknown key, no RNG, no
   clock, no DOM, no Phaser, and no import from `src/scenes/**`. They never read a
   `RunState`.

### The town's door

`exitGate` returns `null` for the town's forward edge, and that is deliberate: the
town has no badge to win, and its door is the **prologue's** (`canLeaveTown`, later
batch), which opens when the starter is taken. Badge-gating the town would deadlock
the run at its first step. `nextBadge(plan, townKey)` still answers `1`, because that
is the badge the way forward names. Write this paragraph into `docs/region-spec.md`
§4 in your own words, replacing the "is not shipped code yet" sentence.

### `docs/region-spec.md` §4

Rewrite §4's second paragraph ("The predicate that answers it … not a gate for any
edge back.") so it describes the **shipped** function: `src/engine/run/gates.ts`,
`exitGate` and `nextBadge`, the null conditions above, the forward-edge rule, the
town's door being the prologue's, and that it reads the badge list and never a
`RunState`. Do not touch §1-§3 or §5-§8.

## 🧩 Data and configuration

No new data. `BADGE_CAPS.length + 1` (badge 9) is the only figure read beyond the
plan's own nodes.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`; green.
  - `git diff --name-only main...task-278` against the exclusive paths list.
  - No browser pass: every criterion is `[unit]`.

- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` For every badge `1..8` on a fixed seed: `exitGate(plan, 'city:n',
    'route:n+1', [n])` is `{ open: true, badge: n }`; without `n` in the list it is
    `{ open: false, badge: n }`; and badge `n` missing from `[1..n-1]` reports `n`
    as the missing badge.
  - [ ] `[unit]` `exitGate(plan, 'city:8', 'victory-road:1', [8])` is open, and
    closed without badge 8.
  - [ ] `[unit]` Every edge **back** on the chain is `null` with any badge list
    (including `[]`), and both directions of every lateral edge are `null`.
  - [ ] `[unit]` `nextBadge(plan, plan.townKey) === 1`, `nextBadge(plan, 'city:n') ===
    n` for every gym city, `nextBadge(plan, 'route:n') === n`, and `nextBadge` is
    `null` for the victory road, the league and the tower.
  - [ ] `[unit]` An unknown key and a non-neighbour `toKey` both return `null` from
    `exitGate` and `null` from `nextBadge`, with no throw.
  - [ ] `[unit]` `src/engine/` still imports no Phaser and no DOM, and no
    `Math.random()` or `Date.now()` entered it.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.

## 📣 Coordination

- For the Architect: the plan's line "a town's exit asks for badge 1" is implemented
  as `nextBadge(plan, townKey) === 1` while `exitGate` answers `null` for that edge:
  both the region spec (§4) and the prologue task give the town's door to
  `canLeaveTown`, and a badge-gated town would deadlock the first step of every run.
  §4 states both halves after this task.
- For the next batch: `travel`/`canTravel` (Batch 121) calls `exitGate(plan, from, to,
  run.badges)` and shows `nextBadge` when it is closed; the gym task grants the badge
  the guard asks for. Neither needs any other function from this module.

## ⛔ Out of scope

- Reporting the gate in a scene, a HUD card or a dialogue line.
- Granting a badge (`grantBadge`, later batch), travelling, the prologue's door.
- The old room gate (`src/engine/routes/gate.ts`, `src/data/gates.ts`): it keeps
  feeding the old scene until the sweep.
- Any edit to `src/engine/run/README.md` (the schema sibling writes the `gates.ts`
  line), `src/engine/run/index.ts`, `src/data/**` or `src/scenes/**`.
