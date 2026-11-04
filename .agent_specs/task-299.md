# Spec: Task-299 — The docs close in the region's vocabulary

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** docs.
- **Role:** Dev.
- **Objective:** after this task, every claimed spec describes what **shipped** — one
  region of a town, eight gym cities, routes with laterals, the Victory Road, the
  League and the endless tower — instead of the retired Binding-of-Isaac floor model,
  and `docs/tech-decisions.md` holds the complete region record `D59`-`D68` with the
  floor decisions marked **superseded** and pointing at their replacement. No claimed
  doc describes a deleted module, names a path that does not exist, or points at the
  deleted `docs/maps-spec.md`.
- **Environment:** worktree `../wt-pkm-299`, branch `task-299`.
- **Dependencies (already merged):** `Task-298` (the floor modules deleted:
  `src/engine/maps/**`, `src/scenes/rooms/**`, `src/ui/mapView.ts`,
  `src/scenes/StarterScene.ts`) and `Task-304` (the deprecated position fields gone
  from `RunState`). `docs/region-spec.md` shipped with the region itself and is the
  world's source of truth; read it first and do not rewrite it.

### Exclusive paths (single writer)

Only these files may be modified. **Nothing outside this list** — this is a docs task:
no `src/`, no `TODO.md`, no `CHANGELOG.md`, no `AGENTS.md`, no `docs/region-spec.md`.

- `docs/design-spec.md`
- `docs/routes-spec.md`
- `docs/tech-decisions.md`
- `docs/data-spec.md`
- `docs/route-generator.md`
- `docs/art-direction.md`
- `docs/tileset-spec.md`
- `docs/battle-spec.md` — **widened on purpose**: it carries six dead
  `docs/maps-spec.md` references (lines 37, 47, 344, 351, 389, 584, 634) and the
  phase's Check requires none is left. Replace each pointer with the region-spec
  section that says the same thing; change nothing else in that file.
- `docs/balance/campaign.md`
- `docs/balance/economy.md`
- `docs/balance/route-curve.md` — **widened on purpose**: the same rule (dead module
  names and `mapIndex` still presented as live behaviour). Keep these three sheets'
  historical numbers and analyses; only correct the live claims and the dead refs.

### Inputs (read-only)

- `AGENTS.md`, `docs/region-spec.md` (the source of truth), `TODO.md`'s Batch 130 item.
- `src/**` — read the shipped code to check each claim; never edit it.
- `git log`/`git show` for what the two sweeps deleted.

## 🔒 Contract

This is a documentation task: the "public surface" is the doc set itself.

### Required vocabulary

Use `docs/region-spec.md`'s words: **region**, **node**, **nodeKey** (`<kind>:<id>`),
**town**, **city** (gym city), **route**, **lateral**, **Victory Road**, **League**,
**tower** (the one **endless** node), **stretch**, **badge**, **settlement**,
**screens**. The retired words are **map** (as a floor/level group), **floor**,
**room** (as a run position), **portal**, **minimap** (of a floor), **infinite mode**.

Where a sentence is genuinely about route-level internals still shipped (the carver,
POIs, trainers, grass), keep it — a "room" in `route-generator.md`'s *interior* sense
may stay only if the text says `interior`. A route is **not** a room of a floor.

### The `D##` record (the one part the task must author)

`docs/tech-decisions.md` currently **stops at `D62`**. The phase's plan assigns
`D63`-`D68` to earlier tasks, but those specs deliberately left the record open (see
`[Task-280]`'s spec: "Flagged to the Orchestrator/human"), so **this task writes
them**. Add six entries at the end, in this order, each in the file's existing shape
(`## D<n> — <title> *(decided)*` + decision prose + what it supersedes). The facts
below are verified against the shipped tree — do not contradict them:

- **`D63` — A node is one precomputed mesh pair, drawn by one `Tilemap`, generated in
  a worker.** A node's map is generated once off the main thread as two `FrameMesh`es
  (the ground underlay and the tiles over it) through the pure
  `preloadNode(seed, key)` (`src/engine/region/preload.ts`: `NodeMeshes`,
  `NodeWorld`, `NodeRequest`/`NodeReply`); `src/render/tilemapLayer.ts` turns them into
  one `Phaser.Tilemaps.Tilemap` with two culled `TilemapLayer`s, never one `Image` per
  cell; `src/scenes/WorldScene.ts` owns the worker
  (`new Worker(new URL('../workers/nodeWorker.ts', …))`) and `src/workers/nodeWorker.ts`
  is the other end. Supersedes the floor's per-room scene build (the room scenes
  deleted by `Task-298`).
- **`D64` — The region map is a DOM straight-line graph, not a floor minimap.** The
  header card draws `plan.nodes` as markers on the plan's own grid cells joined by
  straight edges: every settlement visible from the first frame, the visited ones
  marked, the current one blinking, routes not clickable. The pure model is
  `src/ui/regionMap.ts` (`RegionMapView`, `RegionNodeMarker`); the DOM card is
  `src/ui/hud/panels/map/**` and the frame is `design/screens/03o-panels-map-routes.json`
  (`03o Panels · map routes`). **Supersedes `D32`.**
- **`D65` — The guard gates only the way forward.** Leaving a **city** by its
  main-chain forward edge asks that city's badge; a step **back** and a **lateral**
  are never gates; the **town**'s forward door belongs to the prologue
  (`canLeaveTown`), not the guard. `exitGate(plan, fromKey, toKey, badges)` is pure
  and reads the badge list, never a `RunState` (`src/engine/run/gates.ts`); the walk
  applies it in `travel` (`src/engine/region/travel.ts`). **Supersedes `D31`'s sealed
  portal.**
- **`D66` — Levels come from the badge, the distance to the leader and the party
  size.** A node stores no level range: its **cap** is the only anchor,
  `badgeCap(badge)` over `BADGE_CAPS = [9, 16, 23, 30, 37, 43, 49, 55]`
  (`src/data/region.ts`), badge 9 being the League's. A regular trainer's member is
  `trainerLevel(cap, gymDistance, partySize)` = `cap − gymDistance × factor`, with the
  factor **1 / 0.9 / 0.8** for a party of **1 / 2 / 3**
  (`src/engine/run/levelCurve.ts`, `TRAINER_SIZE_FACTOR` in
  `src/data/trainerLevels.ts`), floored and clamped to `1..cap`; the gym leader sits
  at the cap (`leaderLevel`); a wild is 60-75 % of the live squad
  (`wildLevel`, `WILD_LEVEL_FRACTION`); a node's band runs from the previous badge's
  cap to its own (`bandForNode`). **Supersedes `D9` and `D29`'s per-map ranges.**
- **`D67` — Flight is free from the region map, at visited settlements.** Outside
  battle, a press on a **visited settlement** flies there, ignoring the badge gate; a
  flight lands on that settlement's **Centre door** (the **laboratory**'s door in the
  town), not on the walk spawn, which is what an exit-band arrival uses. Refusals are
  named (`same-node`, `no-such-node`, `not-neighbour`, `gate`, `unvisited`,
  `not-settlement`, and the town's prologue refusal) and a refusal touches nothing
  (`src/engine/region/travel.ts`, `docs/region-spec.md` §5).
- **`D68` — Missions are a stack.** Every node the run stands on exposes, in a fixed
  order, its stretch's automatic mission, its city's fixed one (on a city) and one
  random row one of that city's NPCs offers, drawn from `random:<nodeKey>`. Every
  status is **derived** from facts the run already persists — `completedMissions`,
  `stats.casualties`, `floorCasualties` — so the stack adds no save field and no
  `SAVE_VERSION` step (the one draw is `random:<nodeKey>`'s stream, so no
  plan/layout/content/battle draw moves). The catalogue is `STACK_MISSIONS`
  (`src/data/missions.ts`) and the whole rule is `src/engine/region/missions.ts`; the
  card is `src/ui/hud/panels/missions/**` (`D58`).

Then mark the retired floor entries **superseded** — never delete them. Each keeps
its prose and gains, immediately under the heading, one line
`**Superseded** by `D##` (`<what replaced it`); the body may be re-worded in region
vocabulary but keeps the decision it recorded:

| entry | marked superseded by |
| --- | --- |
| `D8` run structure (routes, mini-boss, boss, final boss, infinite mode) | `D59` |
| `D9` classic XP with a per-route cap | `D66` |
| `D28` a map groups routes of one biome | `D59` |
| `D29` map composition rolled from per-map ranges (+ its addendum) | `D66`, `D59` |
| `D30` the map is a closed room graph (+ its addendum) | `D59`, `D60` |
| `D31` the map boss seals the exit and opens the portal | `D65`, `D59` |
| `D32` the route HUD shows the map with fog of discovery | `D64` |
| `D33` special rooms and the Poké Dollar economy | `D59` (the Mart survives as each city's merchant; `D68` for missions) |
| `D47` a special room kind is a descriptor module | `D59` (the room registry is deleted with the floors) |

`D58` is **not** superseded: the missions card shipped and is live. Add one sentence
to it saying the card now draws the node's stack (`D68`) and that its
`completedMissions` rows are keyed by badge, not by a floor. `D61`'s "deprecated
fields stay" sentence is now false (`Task-304` deleted them) — correct it in place
and point at the deletion, keeping the decision.

### Required factual repairs

The measured state of the claimed docs before this task (verify each, then fix):

1. `docs/design-spec.md` §2 still calls a run "a chain of **maps** (floors)" with a
   "graph of routes (rooms)", portals and `docs/maps-spec.md`; §6 and §7 still
   describe floors/rooms. Rewrite them to the region: the chain
   `town → route 1 → city 1 → … → route 8 → city 8 → Victory Road → League → tower`,
   eight badges, routes of two to four screens with one or two laterals, the town's
   laboratory, and the endless tower — all from `docs/region-spec.md` §1, §4, §5.
2. `docs/routes-spec.md` §1 says "a route is one room of a floor"; §2's passives
   stream is still `${seed}:passive:${mapIndex}:…` and `advanceMap`; §5 still builds
   trainers from `trainerRoomsForMap(mapIndex)` and `docs/maps-spec.md` §2/§6;
   §(static vault) still names `src/scenes/rooms/puzzle.ts`. Rewrite to the shipped
   node key (`${seed}:passive:${nodeKey}:${ability}`, `passive-…-${nodeKey}`,
   `src/engine/run/passives.ts`) and to the region's trainer/roster rules
   (`trainerLevel(node.cap, node.gymDistance, size)`, `src/engine/run/roster.ts`).
   Check every `src/` path the file names.
3. `docs/data-spec.md` rows describe floors and `docs/maps-spec.md`; it also rows
   `src/data/population.ts` with the per-map trainer-room table. Correct the
   descriptions to region vocabulary and the shipped readers; **remove a row only if
   its module no longer exists** (check with `ls`), never because its prose is stale.
4. `docs/route-generator.md` and `docs/tech-decisions.md` still name
   `MapRoom`/`MapRoomSpecial`, `src/engine/maps/plan.ts`, `src/ui/mapView.ts`,
   `src/scenes/rooms/`, `routeIndexForRoom` and `docs/maps-spec.md`. Replace dead
   paths with the live equivalent (`src/engine/region/plan.ts`, `src/engine/region/route.ts`,
   `src/engine/routes/sketch.ts`, `src/ui/regionMap.ts`, `docs/region-spec.md`) or
   state in prose that the module was deleted with the floors. `route-generator.md`
   describes route-level generation that still ships — keep it, but drop the floor
   frame around it.
5. `docs/art-direction.md`, `docs/tileset-spec.md` and `docs/battle-spec.md` are
   mostly live; fix their dead `docs/maps-spec.md`/room-module references and any
   floor-as-position sentence. Their `src/assets/**` names are **packed output** and
   stay: those files are gitignored and rebuilt by `npm run assets:pack`, so they are
   not a broken reference.
6. The three `docs/balance/` sheets present `mapIndex`/`map` as live; correct the
   live claims (the shop stream is `${seed}:node:<key>:…`, not `${seed}:shop:<mapIndex>`;
   the mission rows are keyed by badge) and keep their numbers and conclusions.

### Rules

- **No new file.** No test, no script, no README.
- English, `AGENTS.md`'s conventions, the file's own voice and heading levels.
- Do not restructure a doc wholesale: rewrite the stale section in place, keep every
  live section's content.
- If a doc and the code disagree on a fact you cannot resolve from
  `docs/region-spec.md` and the shipped source, **do not invent**: leave the sentence
  unchanged, list it under *Coordination* in your final report, and open no issue
  yourself (the Orchestrator does).
- No browser pass is owed.

## 🧩 Data and configuration

None. This task introduces no engine value, table or key.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green and **unchanged** (this task adds no
    test; a red suite is a regression).
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-299` — every changed path must be in the
    exclusive list above.
  - The three doc checks below, run from the worktree root. **All are `[unit]`: no
    browser pass is owed.**
- **Acceptance criteria:**
  - [ ] `[unit]` `npm test` is green with the same test count as `main`, and
        `npm run build` is green.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[unit]` **`D59`-`D68` all exist**, each as a `## D<n> — …` heading, and each
        of `D8`, `D9`, `D28`, `D29`, `D30`, `D31`, `D32`, `D33`, `D47` carries an
        explicit supersede line naming an existing `D##` (the table above).
        Command: `grep -n "^## D\(8\|9\|2[89]\|3[0-3]\|47\|5[89]\|6[0-8]\) " docs/tech-decisions.md`
        plus `grep -c "^\*\*Superseded\*\* by" docs/tech-decisions.md` ≥ 10.
  - [ ] `[unit]` **No live floor vocabulary in the claimed docs.** This command
        prints nothing:
        `grep -rnE "planMap|MapRoomSpecial|MapRoom\b|sealed portal|routeIndexForRoom|trainerRoomsForMap|docs/maps-spec|mapIndex|infinite mode" docs/design-spec.md docs/routes-spec.md docs/tech-decisions.md docs/data-spec.md docs/route-generator.md docs/art-direction.md docs/tileset-spec.md docs/battle-spec.md docs/balance/campaign.md docs/balance/economy.md docs/balance/route-curve.md`
        (`docs/region-spec.md` is not edited by this task and keeps its own
        `completedMissions` / deprecated-field wording; it is not in the list.)
  - [ ] `[unit]` **Every `src/` source path a claimed doc names exists.** Run:
        ```
        python3 - <<'EOF'
        import re,os
        files = [<the eleven paths above>]
        pat = re.compile(r'`(src/[A-Za-z0-9_./*-]+)`')
        for f in files:
            for p in sorted(set(pat.findall(open(f).read()))):
                if '*' in p or p.startswith('src/assets/'):
                    continue        # globs and gitignored packed output
                assert os.path.exists(p), (f, p)
        print('ok')
        ```
        and it prints `ok`. `src/data/...`/`src/engine/...` placeholders do not occur
        in the claimed docs; if one is introduced, it fails like any other path.
  - [ ] `[unit]` **No dead doc pointer.** Every `docs/*.md` path named in the eleven
        files exists:
        ```
        python3 - <<'EOF'
        import re,os
        files = [<the eleven paths above>]
        pat = re.compile(r'`(docs/[A-Za-z0-9_./-]+\.md)`')
        for f in files:
            for p in sorted(set(pat.findall(open(f).read()))):
                assert os.path.exists(p), (f, p)
        print('ok')
        ```
  - [ ] `[unit]` `docs/design-spec.md` §2 describes the region chain (town, eight gym
        cities, routes of two to four screens, laterals, Victory Road, League, endless
        tower) and contains no "chain of **maps** (floors)" sentence; read the section
        and confirm, and confirm `docs/routes-spec.md` §1 no longer calls a route a
        room of a floor.
  - [ ] `[unit]` **Spot-check the six new decisions against the shipped source**: for
        each of `D63`-`D68`, every `src/` path it names exists and the named symbol is
        exported there (`preloadNode`/`NodeMeshes`; `regionMap`/`RegionNodeMarker`;
        `exitGate`; `trainerLevel`/`badgeCap`/`BADGE_CAPS`; `travel`; `STACK_MISSIONS`).
        `grep -n "<symbol>" <path>` for each, and report what it printed.

## 📣 Coordination

- **For the Architect:** Batch 130's original *Claims* line names seven docs; this
  spec **widens** it with `docs/battle-spec.md` and the three `docs/balance/` sheets,
  because the item's own Check ("no doc under `docs/` mentions …") and "no dead
  reference left" cannot be met while `docs/battle-spec.md` still points at the
  deleted `docs/maps-spec.md` and the sheets present `mapIndex` as live. The batch is
  a single docs task, so no batch-mate can collide.
- **For the Architect, record:** `D63`-`D68` were never written by their assigned
  tasks (the file stopped at `D62`; `[Task-280]`'s spec flagged it on purpose). This
  task authors them from the shipped code and `docs/region-spec.md`, as `D59` already
  announced the docs pass would.
- **For the next batch:** none — this is the phase's last task. Its merge closes
  Batch 130 and Phase 24's tail.
- **Report back** (the dev's final message) with: the files changed, the exact
  `grep`/`python3` results, every `src/` path you replaced and with what, and any
  sentence you could not resolve (with the literal contradiction).

## ⛔ Out of scope

- Editing `docs/region-spec.md`, `AGENTS.md`, `TODO.md`, `CHANGELOG.md` or any
  `src/` file — including the source comments that still cite `docs/maps-spec.md`
  (they are read by the code sweep, not this task; mention them in your report).
- Deleting a `D##` entry, renaming a heading level, or reordering the decision file.
- Any code, data, asset, test, dependency or generated file.
- Any browser pass.
- Rewriting a balance sheet's numbers or conclusions.
