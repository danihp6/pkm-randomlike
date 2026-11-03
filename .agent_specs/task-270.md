# Spec: Task-270 — `docs/region-spec.md` is the world's new source of truth

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** docs.
- **Role:** Dev.
- **Objective:** the region has one written source of truth. `docs/region-spec.md`
  exists with the eight sections below, in the vocabulary the shipped
  `src/engine/region/` contract freezes — node kinds, `nodeKey`, the per-node stream
  family, the sizes and badge caps of `src/data/region.ts`, the guard, flying, the
  services of a settlement and the save's v28 rules — and `docs/maps-spec.md`, the
  floor model's spec, is gone. `docs/tech-decisions.md` gains `D59`-`D62` so the
  four rules the pivot rests on are decided where decisions live, and `AGENTS.md`
  stops telling a reader that a run is "a chain of maps" and stops sending anyone to
  the dead file.
- **Environment:** worktree `../wt-pkm-270`, branch `task-270`.
- **Dependencies:** the region contract (`[Task-268]`, merged on `main`) — this task
  documents exactly the modules and tables it shipped, and it must not invent a
  symbol that `src/engine/region/` or `src/data/region.ts` does not export.

### Exclusive paths (single writer)

- `docs/region-spec.md` (new)
- `docs/maps-spec.md` (deleted)
- `docs/tech-decisions.md`
- `AGENTS.md`
- `.prettierignore` (one line: drop `docs/maps-spec.md`, add `docs/region-spec.md`)

Nothing else. **Not** `docs/routes-spec.md`, `docs/design-spec.md`,
`docs/battle-spec.md`, `docs/data-spec.md`, `docs/tileset-spec.md`,
`docs/route-generator.md`, `docs/art-direction.md`, `docs/balance/**`, `TODO.md`,
`CHANGELOG.md`, and **not one file under `src/`**.

### Inputs (read-only)

- `src/engine/region/plan.ts` (`regionPlan`'s contract: `RegionNode`, `RegionPlan`,
  `RegionNodeKind`, `planRegion`, `nodeKey`, `parseNodeKey`, `nodeOf`).
- `src/engine/region/names.ts` (`settlementNames`, `routeName`).
- `src/engine/region/streams.ts` (`NodeStreams`, `NodeStreamPass`, `regionStream`,
  `nodeStreams`).
- `src/engine/region/index.ts` (what the barrel re-exports).
- `src/engine/region/README.md`, `src/engine/region/route/README.md`,
  `src/engine/region/city/README.md`, `src/engine/region/interior/README.md`.
- `src/engine/region/plan.test.ts`, `names.test.ts`, `streams.test.ts`.
- `src/data/region.ts` (`RegionSize`, `CityTier`, `TOWN_SIZE`, `CITY_TIERS`,
  `INTERIOR_SIZE`, `GYM_SIZE`, `ROUTE_WIDTH`, `ROUTE_HEIGHTS`, `BADGE_CAPS`,
  `LEAGUE_LEVEL`, `NAME_ADJECTIVES`, `NAME_NOUNS`, `cityTierForBadge`, `badgeCap`,
  `citySize`).
- `src/engine/rng.ts` (`Rng`, `hashSeed`) — only to describe a stream honestly.
- `docs/maps-spec.md` — read before deleting, so a rule the floors owned and the
  region still needs is carried across rather than lost.
- `docs/tech-decisions.md` — `D58` is the last entry; `D8`, `D9`, `D28`-`D33` are
  the floor decisions this phase supersedes.
- `docs/showdown-reuse.md`, `docs/data-spec.md`, `docs/routes-spec.md`,
  `docs/design-spec.md` — **read only**, to link to them, never to edit.
- `TODO.md`'s "Batch plan" paragraph for Phase 24 (the human's `2026-11-02`
  decision, and which task owns which `D##`).

## 🔒 Contract

This task ships a document, so its contract is the document's shape. Every heading
below is a literal line, in this order, in `docs/region-spec.md`:

```
# PokeRandomLike — Region Spec
## 1. What a region is
## 2. Identity and streams
## 3. The badge ladder and the caps
## 4. The guard, and walking back
## 5. The map and flying
## 6. Services per settlement
## 7. What a route and a city hold
## 8. The save's v28 rules and the record
```

What each section must contain (the facts are the shipped code's, not new rules):

1. **What a region is.** One run is one region: the starting **town**, **eight gym
   cities** in badge order, one **main route** per stretch plus **one or two
   laterals**, the **Victory Road**, the **League** and the endless **tower**. The
   seven `RegionNodeKind` values, spelled as the code spells them (`town`, `city`,
   `route`, `lateral`, `victory-road`, `league`, `tower`), with what each is. The
   chain (`town → route 1 → city 1 → … → route 8 → city 8 → victory road → league →
   tower`, 20 nodes) and that a lateral hangs off a `route` and terminates. The
   **sizes table**, read off `src/data/region.ts`: `TOWN_SIZE` 40×40;
   `CITY_TIERS` tier 1 = badges 1-2, 50×50, 6 buildings; tier 2 = badges 3-5, 70×70,
   10 buildings; tier 3 = badges 6-8, 90×90, 14 buildings; `INTERIOR_SIZE` 24×18;
   `GYM_SIZE` 40×40; `ROUTE_WIDTH` 60 with `ROUTE_HEIGHTS` 120/160/200; and the rule
   that these numbers live in `src/data/region.ts` and no engine file hard-codes one.
2. **Identity and streams.** `nodeKey = <kind>:<id>` is the only name a piece of the
   world has (`nodeKey`/`parseNodeKey`/`nodeOf`), ids are 1-based within their kind,
   and the name list comes from `settlementNames` (`Adjective Noun`, unique per
   region) with `routeName(n)` = `Route <n>` numbered in chain order. The stream
   family, literally: the region's own stream `${seed}:region`, split into `plan`
   and `names` by `planRegion`, and each node's four streams
   `${seed}:node:<key>:layout`, `:content`, `:encounters`, `:loot` (`nodeStreams`,
   `NodeStreams`, `NodeStreamPass`). State the two consequences: no node's stream
   depends on how many nodes precede it, so a node replays alone when it is walked
   back into; and the old global route prefix (`routeIndexForRoom`'s running sum of
   every earlier floor's room count) is retired.
3. **The badge ladder and the caps.** Eight gyms, one badge each, in chain order;
   `BADGE_CAPS` = 9, 16, 23, 30, 37, 43, 49, 55 with `badgeCap(badge)` reading it,
   and badge 9 (`BADGE_CAPS.length + 1`) for the Victory Road, the League and the
   tower, whose cap is `LEAGUE_LEVEL` = 60. `RegionNode.cap` is `badgeCap(badge)`;
   the cap is the only level anchor (`D29`), so **no node stores a level range**.
   `gymDistance` is the number of main-chain steps to the gym that closes the
   stretch and is 0 exactly at a gym.
4. **The guard, and walking back.** Leaving a city needs its badge; walking back
   never does; a locked exit names the badge it wants. Written as the rule only —
   the predicate (`exitGate`, `nextBadge`) is `[Task-278]`'s and is **not** named as
   shipped code here; describe it in one sentence under this heading and say the
   task that implements it is Batch 119. The town's exit asks for badge 1, and an
   edge back or an edge inside the same stretch is never a gate.
5. **The map and flying.** The region map is the DOM straight-line graph of the
   plan's nodes (`D64`, `[Task-281]`): every settlement visible from the start, visited
   ones marked, the current one blinking, routes not clickable. Flight is free, out
   of battle, and only to a **visited settlement** (`D67`, `[Task-283]`); a flight
   lands on that settlement's Centre door (the laboratory in the town). Say plainly
   which tasks own the implementations (Batch 120 and Batch 121) so no reader
   mistakes this section for shipped code.
6. **Services per settlement.** A city has a **Pokémon Centre** (heal + PC), a shop
   and its **gym**; the **town** has no Centre, one laboratory and one house; the
   League heals between battles and sells nothing. The **laboratory** is where a run
   starts: no Pokémon, one starter, and the town's exit stays shut until it is
   taken. Services are doors like any other (Batch 118's city plan emits them).
7. **What a route and a city hold.** One short stub: what a node holds is rolled
   per node off its `content` stream by `[Task-277]` (Batch 119) and drawn by the
   scene tasks. **Write the heading and at most two sentences of intro and stop.**
   Subsections `§7.1`-`§7.11` are **not written here** — each belongs to its own
   later task (`§7.1` the city plan, `§7.2` the interior list, `§7.3` node content,
   `§7.4` the gym's puzzle, `§7.5` the city screen, `§7.6` the League, `§7.10` the
   missions' schema), so leave the number space visibly open in one sentence ("its
   subsections are written by the tasks that ship each piece").
8. **The save's v28 rules and the record.** `SAVE_VERSION` steps **27 → 28 with no
   migration**: an older document decodes with its run discarded, while settings and
   history survive; there is nothing in production to migrate (`D61`). A run stands
   on a **node** — `nodeKey`, `visitedNodes`, `badges`, `capturedNodes` — not on a
   floor, and `mapIndex`/`routeIndex`/`routeInMap` are the deprecated compatibility
   fields the old scene still reads until the sweep. The record is the **badge
   count**, and the tower's streak is tracked apart from it (`D62`). These are the
   rules `[Task-276]` implements; say so.

Also required in the document:

- A short opening paragraph naming `docs/region-spec.md` as the world's source of
  truth and pointing at `docs/design-spec.md` (gameplay), `docs/tileset-spec.md`
  (art) and `docs/tech-decisions.md` (`D59`-`D68`) as the neighbours it does not
  replace.
- **Every one of these names must appear verbatim somewhere in the file** (QA greps
  for each): `planRegion`, `RegionNode`, `RegionPlan`, `RegionNodeKind`, `nodeKey`,
  `parseNodeKey`, `nodeOf`, `settlementNames`, `routeName`, `regionStream`,
  `nodeStreams`, `NodeStreams`, `NodeStreamPass`, `TOWN_SIZE`, `CITY_TIERS`,
  `INTERIOR_SIZE`, `GYM_SIZE`, `ROUTE_WIDTH`, `ROUTE_HEIGHTS`, `BADGE_CAPS`,
  `LEAGUE_LEVEL`, `NAME_ADJECTIVES`, `NAME_NOUNS`, `cityTierForBadge`, `badgeCap`,
  `citySize`, `src/engine/region/plan.ts`, `src/engine/region/names.ts`,
  `src/engine/region/streams.ts`, `src/engine/region/index.ts`,
  `src/engine/region/route/`, `src/engine/region/city/`,
  `src/engine/region/interior/`, `src/data/region.ts`.
- No invented engine symbol: every `camelCase` identifier in backticks that looks
  like a function or a table must exist in `src/engine/region/` or
  `src/data/region.ts` — **except** the four names this spec explicitly marks as
  later tasks' (`exitGate`, `nextBadge`, `planNodeContent`, `travel`), which must be
  written with the task that owns them in the same sentence.

### Data — `docs/tech-decisions.md`

Append four entries **after `D58`**, in this order and with these headings exactly
(the file's own shape: `## D<n> — <title> *(decided)*`, then one or more paragraphs;
`D58` at line 1500 is the model to copy):

- `## D59 — The region replaces the floors *(decided)*` — the human's `2026-11-02`
  decision: a run is one region (town, eight gym cities, long routes with laterals,
  the Victory Road, the League, the tower) and no longer a chain of maps of rooms;
  `docs/maps-spec.md` dies with the floors and `docs/region-spec.md` is born; the
  vertical slice still closes after the city-1 gym.
- `## D60 — Node identity is nodeKey, and its stream family is per node *(decided)*`
  (write `nodeKey` in backticks inside the heading, as `D2` writes `src/engine`) —
  `<kind>:<id>` is the only name a piece of the world has;
  `${seed}:node:<key>:<layout|content|encounters|loot>` is its stream family; no
  node's draw depends on how many nodes precede it, so a node replays alone and
  appending one cannot move another (`D11`); the global route prefix is retired.
- `## D61 — The save cuts to v28 with no migration *(decided)*` — the version steps
  27 → 28, an older document keeps settings and history and discards the run, and
  no migration code exists because nothing is in production.
- `## D62 — The record is the badges, and the tower's streak is apart *(decided)*` —
  the record is the number of badges held (not floors walked), and the endless
  tower's streak is its own figure, so an endless run can never inflate the record.

Each entry must say what it supersedes where it supersedes something (`D59`
supersedes `D8`; `D60` supersedes the per-map stream family of `D29`/`D30`;
`D61`/`D62` supersede the floor-shaped save and record). Do **not** edit `D8`, `D9`
or `D28`-`D33`: marking them superseded is `[Task-299]`'s (Batch 125).

### Data — `AGENTS.md`

- The opening pitch (the block above `## Stack decisions`) stops describing a run as
  "a chain of **maps**: Binding of Isaac-style floors — a grid of routes (rooms) of
  one biome, closed into a loop…" and describes the region instead: a procedurally
  named starting town, eight gym cities, long routes of 2-4 screens with optional
  laterals, the Victory Road, the League and the tower behind the Champion. Keep
  the sentences about tall grass, trainer sight lines, the classic menu battle, one
  catch per route, permadeath and the run ending with nothing carried over — those
  are unchanged.
- Its doc list gains `docs/region-spec.md` (the region's source of truth) and loses
  `docs/maps-spec.md`.
- Nothing else in `AGENTS.md` changes: not the stack decisions, not the directory
  layout, not the multi-agent workflow, not the git rules.

### Data — `.prettierignore`

`docs/maps-spec.md` is listed at line 55 because prettier's markdown printer would
rewrite a prose spec. Replace that line with `docs/region-spec.md`; keep the file's
comment and every other line as they are.

## 🧩 Data and configuration

No runtime data, no JSON, no balancing value. The only new prose numbers are the
ones already in `src/data/region.ts`; the document quotes them, it never introduces
one. If the document and the code disagree, the code wins and the document is
wrong.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless. It must stay green: this task changes no code,
    and a red suite means the diff escaped its paths.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-270` — must be exactly
    `AGENTS.md`, `.prettierignore`, `docs/maps-spec.md` (deleted),
    `docs/region-spec.md` (added) and `docs/tech-decisions.md`.
  - `npm run lint` is **not** a gate for this batch, but `docs/region-spec.md` must
    be in `.prettierignore` so it does not become one.
  - **No browser pass is owed:** every criterion below is `[unit]`, and no player-
    facing string, screen or scene is touched.
- **Acceptance criteria:**
  - [ ] `[unit]` `test -f docs/maps-spec.md` fails (the file is gone) and
        `test -f docs/region-spec.md` passes.
  - [ ] `[unit]` `grep -n "^## " docs/region-spec.md` lists exactly
        `## 1. What a region is`, `## 2. Identity and streams`,
        `## 3. The badge ladder and the caps`, `## 4. The guard, and walking back`,
        `## 5. The map and flying`, `## 6. Services per settlement`,
        `## 7. What a route and a city hold`,
        `## 8. The save's v28 rules and the record`, in that order, and **no**
        `## 7.1`-`## 7.11` heading exists.
  - [ ] `[unit]` Every name in the contract's verbatim list appears in
        `docs/region-spec.md`: `for n in planRegion RegionNode RegionPlan
        RegionNodeKind nodeKey parseNodeKey nodeOf settlementNames routeName
        regionStream nodeStreams NodeStreams NodeStreamPass TOWN_SIZE CITY_TIERS
        INTERIOR_SIZE GYM_SIZE ROUTE_WIDTH ROUTE_HEIGHTS BADGE_CAPS LEAGUE_LEVEL
        NAME_ADJECTIVES NAME_NOUNS cityTierForBadge badgeCap citySize
        src/engine/region/plan.ts src/engine/region/names.ts
        src/engine/region/streams.ts src/engine/region/index.ts
        src/engine/region/route/ src/engine/region/city/
        src/engine/region/interior/ src/data/region.ts; do grep -qF -- "$n"
        docs/region-spec.md || echo "MISSING $n"; done` prints nothing.
  - [ ] `[unit]` No dead reference in the three files this task owns:
        `grep -n "maps-spec" AGENTS.md docs/region-spec.md docs/tech-decisions.md`
        prints nothing. (It is **expected** to still match elsewhere: roughly 90
        further references live in `docs/design-spec.md`, `docs/routes-spec.md`,
        `docs/battle-spec.md`, `docs/route-generator.md`, `docs/balance/*.md`,
        `docs/data-spec.md`, `src/**` comments, `TODO.md` and `CHANGELOG.md`. They
        belong to `[Task-298]` (which deletes the floor modules) and `[Task-299]`
        (the docs close) — QA must **not** fail this task for them, and must
        confirm the count did not grow.)
  - [ ] `[unit]` `grep -c "^## D" docs/tech-decisions.md` is `62` and
        `grep -n "^## D5[89]\|^## D6[0-2]" docs/tech-decisions.md` lists `D58`,
        `D59`, `D60`, `D61`, `D62` in that order, each followed by at least three
        lines before the next heading. `D59`-`D62`'s titles read as frozen above.
  - [ ] `[unit]` `AGENTS.md` no longer contains `chain of **maps**`
        (`grep -qF 'chain of **maps**' AGENTS.md` exits `1`) and no longer contains
        `docs/maps-spec.md` (`grep -qF 'docs/maps-spec.md' AGENTS.md` exits `1`), and
        does contain `docs/region-spec.md` (`grep -qF` exits `0`).
  - [ ] `[unit]` The numbers quoted in §1 and §3 match the code:
        `grep -n "BADGE_CAPS\|LEAGUE_LEVEL\|ROUTE_HEIGHTS\|TOWN_SIZE\|CITY_TIERS"`
        in `src/data/region.ts` agrees with the document's tables for all eight
        caps, the League's 60 and the 40/50/70/90 sizes.
  - [ ] `[unit]` `npm test` and `npm run build` are green.
  - [ ] `[unit]` `git diff --name-only main...task-270` lists only the five paths
        above.

## 📣 Coordination

- **For `[Task-271]` (the art task, same batch):** `docs/tileset-spec.md` is **not**
  touched here. It keeps describing map values, the atlas contract and the frames;
  this task never repeats its table.
- **For `[Task-276]` (Batch 119):** §8 is written here as the **rules**; `[Task-276]`
  rewrites the section with what its v28 schema actually shipped. Do not leave §8
  with a placeholder sentence — the next batch plans against it.
- **For `[Task-299]` (Batch 125, the docs close):** the remaining `docs/maps-spec.md`
  references (≈90 in `docs/*.md`, `src/**` code comments, `TODO.md` and
  `CHANGELOG.md`) are yours; `[Task-298]`'s deletions take the `src/**` ones with
  them. This task deliberately leaves them so the batch stays an antichain.
- **For the Architect:** this task **opens** the `docs/region-spec.md` section
  space. `§7.1`-`§7.11` and §3/§4/§5/§8 are written by the later tasks that own
  those pieces, all of which are outside this batch.

## ⛔ Out of scope

- Rewriting `docs/routes-spec.md`, `docs/design-spec.md`, `docs/battle-spec.md`,
  `docs/data-spec.md`, `docs/route-generator.md`, `docs/art-direction.md`,
  `docs/tileset-spec.md` or `docs/balance/**` — Batches 122-125 own them.
- Marking `D8`, `D9`, `D28`-`D33` superseded, or writing `D63`-`D68`
  (Batches 118-124 own those).
- Deleting any module under `src/`, editing a comment in `src/`, or touching
  `src/data/region.ts`.
- `TODO.md`, `CHANGELOG.md` and `.prettierignore`'s other lines (the Orchestrator
  owns the first two).
- Writing §7.1-§7.11, a guard predicate, a level curve, or a save schema — this task
  writes what the shipped code already does, plus the rules `D59`-`D62` freeze.
