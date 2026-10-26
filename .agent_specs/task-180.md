# Spec: Task-180 — The map boss and the mini-boss never open a battle by looking at the player

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule (`src/engine/routes/`) plus the two Phaser call sites that
  stand the boss and the mini-boss on a route, plus two docs paragraphs.
- **Role:** Dev.
- **Objective:** A line of sight stops being able to start a fight for exactly two
  trainers. `RouteTrainer` gains an optional `aggro` flag (absent means "yes"), and
  `seesPlayer` — the one gate both triggers already read, the per-step
  `trainerSpotted()` scan and the spinner tick — answers `false` for a trainer that
  turned it off, before it looks at any geometry. The map boss (`bossTrainer` in
  `RouteScene`) and the mini-boss fixture (`src/scenes/rooms/miniBoss.ts`) set it to
  `false` and keep their `id`, `position`, `facing` and `sight` byte-identical, so no
  seed, topology, roster draw or validation result moves. With the old "it walks over"
  fallback gone, the sealed boss room's anti-soft-lock argument is re-pinned on the
  engine's own terms: on 20 fixed seeds the boss's tile keeps a walkable cardinal
  neighbour that is on the entry's BFS tree, so the player can always reach it and press
  the interact key, which is the only door into either fight.
- **Environment:** worktree `../wt-pkm-180`, branch `task-180`.
- **Dependencies:** none. No task in Batch 79 (or any merged task) produces a file this
  task reads, and the batch's other task (the detail panel's carried tab) touches
  disjoint paths — see Coordination.

### Exclusive paths (single writer)

The list of paths this task creates or modifies. **Nothing outside this list.**
No other task in the batch may claim the same path. Deleting a stray `.gitkeep`
from a directory this task populates is always allowed.

- `src/engine/routes/routeMap.ts`
- `src/engine/routes/trainers.ts`
- `src/engine/routes/trainers.test.ts`
- `src/engine/routes/sketch.test.ts`
- `src/scenes/RouteScene.ts` — **the batch's one owner of this hot file**
- `src/scenes/rooms/miniBoss.ts`
- `src/scenes/rooms/fixtures.test.ts`
- `docs/routes-spec.md` — **§2 only** (`## 2. Generation pipeline`, lines 31–310): one
  clause is added to the line-of-sight sentence. Nothing else in that file changes.
- `docs/maps-spec.md` — **§6 only** (`## 6. Boss & portal (D31)`, lines 251–306): one
  sentence is rewritten. Nothing else in that file changes.

**No README is claimed, and that is deliberate:** this task adds, renames and deletes
**no file**. `src/engine/README.md`'s rule 5 fires only when a module is **added**, and
`routeMap.ts`/`trainers.ts` already appear in its `routes/` line; `miniBoss.ts` and
`fixtures.test.ts` already have their lines in `src/scenes/rooms/README.md` and their
roles do not change. So no README edit is owed and none may be made.

### Inputs (read-only)

Files this task may read, and only these, beyond `AGENTS.md` itself.

- `docs/routes-spec.md` (read §2 in full before editing it), `docs/maps-spec.md` (read §6
  in full before editing it), `docs/agent-spec-template.md`
- `src/engine/routes/sketch.ts` — `bossChamberTile`, `DEFAULT_TRAINER_SIGHT`, the
  `chamber` carve and `RouteRequest.chamber`. **Not edited.**
- `src/engine/routes/validate.ts` — `reachableTiles`, `reachableAvoiding`,
  `validateRoute` and its trainer pose rules. **Not edited.**
- `src/engine/routes/layout.ts` — `chamberFor`, `SHAPES`, `RouteShape`. **Not edited.**
- `src/engine/routes/doors.ts`, `src/engine/grid.ts`, `src/engine/map.ts` —
  `isWalkable`/`Tile`. **Not edited.**
- `src/engine/maps/progress.ts` — `bossTrainerId`, `miniBossTrainerId`. **Not edited.**
- `src/engine/routes/index.ts` — the barrel that re-exports the two modules this task
  edits. **Not edited.**
- `src/data/trainers.ts` — the `ace` archetype. **Not edited.**
- `src/scenes/rooms/types.ts` and `src/scenes/rooms/README.md` — the `RoomHost`/fixture
  port and the folder map. **Not edited.**
- `src/scenes/panels/…` — not needed; read nothing there.
- `src/engine/README.md` — to confirm that no module line is owed.

Nothing under `src/data/dex/**`, `package.json`, `src/main.ts`, `vite.config.ts`,
`src/i18n/` or any generated file is read or written by this task.

## 🔒 Contract

The public surface other tasks will be written against in parallel. It is a
promise, not a suggestion. Write the exact exported names and signatures.

### TypeScript

`src/engine/routes/routeMap.ts` — `RouteTrainer` gains one optional field; every other
member stays exactly as it is:

```ts
export type RouteTrainer = Readonly<{
  /** Stable across a route rebuild: `trainer-<routeIndex>-<i>` (D11). */
  id: string;
  position: Tile;
  facing: Facing;
  /** How many tiles down its facing the trainer watches. */
  sight: number;
  /** Archetype id from `src/data/trainers.ts`, for the sprite and the roster. */
  archetypeId: string;
  /** Facings a spinner cycles through (2+); absent on a fixed trainer. */
  turns?: readonly Facing[];
  /**
   * Whether a line of sight can open a fight. **Absent means `true`** (every trainer
   * that ever shipped). `false` draws, blocks and is talked to exactly as before, but
   * its sight never triggers the spotted/chase path: the map boss and the mini-boss
   * are fought only by interacting with them.
   */
  aggro?: boolean;
}>;
```

`src/engine/routes/trainers.ts` — `seesPlayer` keeps its exact signature and gains one
gate as its **first** statement; everything after it is unchanged:

```ts
export function seesPlayer(
  route: RouteMap,
  trainer: RouteTrainer,
  player: Tile,
  tiles: TileMap = route.tiles,
): boolean;
```

- Exact semantics: `if (trainer.aggro === false) return false;` — i.e.
  - `trainer.aggro === false` → `false`, whatever the geometry, the facing, the `sight`
    and the number of tiles between them;
  - `trainer.aggro === true` and `trainer.aggro === undefined` (absent) → the shipped
    geometry rule, byte-identical: same cardinal lane, `dot > 0`, distance ≤ `sight`,
    nothing impassable or another trainer in between, `tiles` defaulting to
    `route.tiles`;
  - it never mutates the trainer or the route, and it reads no `Rng`.
- **Frozen, unchanged exports** in `trainers.ts`: `blocksSight`, `sightLine`,
  `trainerBlockers`, `trainerAt`, `facingVector`, `INVISIBLE_REVEAL_DISTANCE`,
  `trainerHidden`, `SpecialTrainerOptions`, `specialTrainerFor`, `withForcedAbility`.
  `sightLine` **does not** consult `aggro`: the cone stays drawn and every other reader
  (validation's `seesEntry`, the sprite visibility rules, the chase step budget) keeps
  its answer. `specialTrainerFor`'s `{ ...first, archetypeId }` copy keeps the flag by
  construction — do not add a field to that spread.

`src/scenes/RouteScene.ts` — `bossTrainer` (private, no signature change) returns the
same object plus the flag:

```ts
{ id: bossTrainerId(view.mapIndex), position, facing: this.facingFromTo(position, this.route.entry),
  sight: DEFAULT_TRAINER_SIGHT, archetypeId: 'ace', aggro: false }
```

`src/scenes/rooms/miniBoss.ts` — the fixture's single trainer is the same object plus the
flag:

```ts
{ id: miniBossTrainerId(host.view.mapIndex), position, facing: host.facingFromTo(position, host.entryTile()),
  sight: DEFAULT_TRAINER_SIGHT, archetypeId: 'ace', aggro: false }
```

- **Byte-identical otherwise:** the same `id` strings, the same tile source
  (`bossChamberTile(this.route) ?? this.farthestRoomTile()` for the boss,
  `host.farthestRoomTile()` for the mini-boss), the same `facingFromTo` calls, the same
  `sight: DEFAULT_TRAINER_SIGHT`, the same `archetypeId: 'ace'`, the same append sites
  (`route.trainers = [...trainers, boss]` in the room build; the fixture's `trainers`
  array through `specialDescriptor()?.fixture`). Nothing else in `RouteScene.ts` or
  `miniBoss.ts` may be edited.
- **Determinism:** reads no RNG. No `Rng` stream is created, read or advanced; no drawn
  value, no roster key, no room index, no `sight`, no `facing` and no tile moves — the
  engine's `sketchRoute` output for a seed is byte-identical before and after, because
  neither the boss nor the mini-boss is produced by the generator (both are appended
  after the build). No `RunState` field, no save field, so **no `SAVE_VERSION` step**:
  route trainers are never persisted.
- **One gate, both triggers.** `RouteScene.trainerSpotted()` (called after each step) and
  `updateTrainerSpins()` (called on a facing change) both call `seesPlayer`; no second
  check may be added in the scene, and `beginChase`, `stepChase`, `chaseStep`,
  `tryInteract`, `liveTrainerAt` and `startTrainerBattle` stay byte-identical.

### Data

- No data key, no i18n key, no balancing value, no settings field. `DEFAULT_TRAINER_SIGHT`
  stays `5` in `src/engine/routes/sketch.ts` and neither trainer loses it.

## 🧩 Data and configuration

Nothing is added to `src/data/`. The only new word is the optional `aggro` flag on a
route record, which lives and dies inside one room build and is never written to the
save. The docs' own two clauses are the written form of the rule:

- `docs/routes-spec.md` **§2**, added immediately after "…on a timer like a "spinning"
  trainer." in the line-of-sight sentence: *"Two trainers never open a fight by sight at
  all: the **map boss** and the **mini-boss** stand with their line still drawn and
  `aggro: false` on the `RouteTrainer` record, so they are fought only by speaking to
  them (`docs/maps-spec.md` §6)."*
- `docs/maps-spec.md` **§6**, rewriting the sentence that today reads "…with
  `DEFAULT_TRAINER_SIGHT`, so it walks over and opens the fight on its own, and a loss in
  the room is a normal loss (`D5`)." → "…with `DEFAULT_TRAINER_SIGHT` and `aggro: false`,
  so it never opens the fight by sight: it can always be **reached and spoken to** — its
  tile keeps a walkable cardinal neighbour on the entry's own BFS tree, pinned on 20
  seeds — and a loss in the room is a normal loss (`D5`)."

## 🧪 Test and Validation Plan (for QA)

QA runs this verbatim. A criterion that cannot be executed by someone who has not
read the rest of the spec is not a criterion.

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-180` audited against the exclusive paths list.
  - This task has **one** `[live]` criterion, so it owes a browser pass: a dev server
    (`npm run dev`) plus CDP over headless Chromium, as `docs/agent-ci.md` says. The
    readings are scene/scene-state queries in the page plus key presses; no screenshot
    is needed for the pass/fail, only the numeric reads below.
- **Acceptance criteria:** every one is tagged **`[unit]`** (a headless command, a
  decoded asset, a pinned number — seconds and deterministic) or **`[live]`** (it only
  exists in the running game: layering, overlap, a band, a beat, a colour on screen).
  QA runs them all, but its browser budget goes to the `[live]` ones, so an untagged
  criterion is a spec bug. A `[live]` criterion states its **measurement** — what to
  read, on which layout, against which bound — so QA reproduces it instead of
  inventing one.

  - [ ] `[unit]` It typechecks and builds clean (`npm run build`).
  - [ ] `[unit]` The declared tests exist and pass.
        (a) `src/engine/routes/trainers.test.ts`, a new `describe` for the flag, using
        the file's own `fixture('S', { x: 3, y: 1 })` route (sight 3) and the player on
        `{ x: 3, y: 2 }`: **one tile down the trainer's lane, `aggro: false` answers
        `false`, the same trainer with `aggro: true` answers `true`, and the same trainer
        with the field **absent** answers `true`**; and **a spun facing changes nothing
        for `aggro: false`** — `seesPlayer(route, { ...t, facing: 'S', aggro: false },
        { x: 3, y: 2 })` and the same call with `facing: 'E'`/`'N'`/`'W'` are all
        `false`, while `sightLine(route, { ...t, aggro: false })` still lists the tile it
        watches (`[{ x: 3, y: 2 }]`), proving the cone is drawn and only the trigger is
        off.
        (b) `src/engine/routes/sketch.test.ts`, a new test pinning the soft-lock guard on
        **exactly 20 fixed seeds** (one array of 20 literal seed strings in the file):
        for each seed, `sketchRoute({ seed, routeIndex: 4, biomeId: 'forest', width: 30,
        height: 30, shape, chamber: true })` for `shape` in `'straight' | 'cross' |
        'corridor'` (the boss room reads `corridor`; `chamber: true` is the request the
        scene passes for it), then assert `route.chamber` is defined,
        `bossChamberTile(route)` is non-null, the boss tile is in
        `reachableTiles(route.tiles, route.entry)`, and **at least one of its four
        cardinal neighbours is both `isWalkable(route.tiles, neighbour)` and in that same
        `reachableTiles` set** — the tile the player stands on to press the interact key.
        Put the seed and shape in the assertion message.
        (c) `src/scenes/rooms/fixtures.test.ts`: `'the mini-boss room'`'s shipped
        `toEqual` fixture now carries `aggro: false` beside `sight:
        DEFAULT_TRAINER_SIGHT`, and its id/tile/facing assertions are otherwise
        untouched (the position and the facing may not move).
        `npx vitest run src/engine/routes/trainers.test.ts src/engine/routes/sketch.test.ts
        src/scenes/rooms/fixtures.test.ts` must pass with no other test changed.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched: the diff is exactly the
        seven code/test files listed above plus the two documentation clauses.
        `git diff --name-only main...task-180` prints no other file, and
        `git diff main...task-180 -- docs/routes-spec.md docs/maps-spec.md` shows the one
        added clause in §2 and the one rewritten sentence in §6, with no deleted or
        changed line anywhere else in either document (in particular `src/engine/README.md`,
        `src/scenes/rooms/README.md`, `src/engine/routes/index.ts`, `validate.ts`,
        `sketch.ts`, `layout.ts` and `rooms/{noHeal,banned,staticSpecies}.ts` are
        absent from the diff).
  - [ ] `[live]` **The boss and the mini-boss only fight when spoken to, on both rooms of
        one floor.** Dev server, `?debug` on (the HUD flag does not matter), a run on
        **map 2** (so the boss fields six and the mini-boss three). Record the run seed
        from the debug overlay's Route panel in the report. Reach the scenes with
        `(await import('/src/main.ts')).game` — call it `game` below — and read
        `route = game.scene.getScene('Route')`, `game.scene.getScene('Battle')`.
        **Locate each room:** for `i` from `0` to `route.debugRouteContext().roomCount - 1`
        use the debug overlay's *Room* teleport, then read `route.debugTrainerSprites()`;
        stop on the room whose list holds an entry with
        `id === 'boss-' + mapIndex` (the map boss) or `id === 'miniboss-' + mapIndex` (the
        mini-boss), `mapIndex` being `route.debugRouteContext().mapIndex`.
        **Then, for each of the two rooms:**
        1. Let `boss` be that entry. Teleport with the *Tile* field to
           `boss.position + 3 * facingVector(boss.facing)` (the tile three down its own
           lane; if that teleport is refused as unwalkable, use 2 and then 4 — the bound
           holds at any of the three) and assert `route.debugRouteContext().tile` equals
           the tile asked for. Press no key and wait **5000 ms**; assert
           `game.scene.isActive('Battle') === false` and `route.debugRouteContext().tile`
           is still that same tile.
        2. Press **one** step key **toward** the boss; assert the player's tile changed by
           exactly one tile toward it (the walker was never frozen by a chase) and
           `game.scene.isActive('Battle') === false` still.
        3. Press **E** facing the boss (`route.debugRouteContext().tile` one tile from the
           boss's tile, facing it); assert `game.scene.isActive('Battle') === true` within
           **2000 ms** and
           `game.scene.getScene('Battle').state.sides.enemy.party.length === 6` for the
           boss (`3` for the mini-boss). Reload the page to leave the battle and continue
           with the second room.
        All six readings must hold on both rooms; a battle opened by the 5-second idle in
        step 1 is the exact regression this task kills.

## 📣 Coordination

Facts another role needs to know, and the shape of them. Anything another task
depends on that is not in the Contract above.

- **For the Architect:** this task holds the batch's two hot resources and shares
  neither: `src/scenes/RouteScene.ts` (the batch's one owner, and the round's most
  contended scene — Batch 75's `[Task-164]`, Batch 77's `[Task-176]` and Batch 80's
  `[Task-179]` all want it, so 180 must merge before 179's branch is cut) and
  `docs/routes-spec.md` (§2 here; §3 and §6 are `[Task-179]`'s in Batch 80). No
  `package.json`, `src/main.ts`, `vite.config.ts`, `src/data/dex/**` or generated file is
  claimed, no `src/data/**` file is touched, and the batch needs no `SAVE_VERSION` step.
- **For the next batch (`[Task-179]`, Batch 80):** it edits the same `RouteScene.ts` and
  must not undo the flag — a route rebuilt by any path (room build, `regenerateRoute`,
  `transitionTo`) re-derives the boss through `bossTrainer`, which now always answers
  `aggro: false`; a scene-side rebuild that copies an old `RouteTrainer` literal must
  carry the field forward. Its `docs/routes-spec.md` work is §3 and §6, never §2.
- **For any later task that plants a trainer:** `aggro` is **optional and absent means
  true**, so every existing trainer literal (regular trainers, the Rockets, the NPC
  battles built by `startNpcBattle`, the `noHeal`/`banned`/`staticSpecies` room fixtures)
  keeps the shipped behaviour without an edit. Turning sight off is opt-in and, after
  this task, exactly two trainers do it.
- **For QA:** the `[live]` pass needs map 2, not map 1 — the roster bounds (6 and 3)
  differ on map 1 (3 and 2) and the criterion above pins the map-2 numbers.

## ⛔ Out of scope

- Removing, shortening or "cleaning up" the chase machinery (`beginChase`, `stepChase`,
  `chaseStep`, `finishChase`, the spinner tick): regular trainers keep opening fights by
  sight and the chase beat is untouched.
- Any change to `sightLine`, `blocksSight`, `trainerBlockers`, `trainerHidden`,
  `specialTrainerFor`, `withForcedAbility`, `validateRoute`'s pose rules or the
  `sees-entry` guard.
- Making the boss or the mini-boss **not block** their tile, not draw, not spin, or lose
  their `sight`/`facing` — only the trigger is off.
- Any new `RunState` field, any save/`SAVE_VERSION` change, and any new `src/data/` table.
- The no-heal room's, the banned-species room's and every other special room's trainers:
  they keep their line of sight.
- A minimap/HUD marker, a notice, an i18n string, or an "it only fights when spoken to"
  prompt of any kind.
- Editing any file the exclusive-paths list does not name — including
  `src/scenes/rooms/{noHeal,banned,staticSpecies}.ts`, `src/engine/routes/{sketch,validate,layout}.ts`,
  `src/engine/README.md` and every README. A fix that needs one is a new task.
- Reflowing or rewrapping `docs/routes-spec.md` / `docs/maps-spec.md`: one added clause
  and one rewritten sentence, nothing else.
