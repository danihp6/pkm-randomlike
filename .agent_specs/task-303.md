## 🎯 Scope

- **Task type:** engine rule + scene wiring + docs.
- **Role:** Dev.
- **Objective:** The eighth badge's city leads east into `victory-road:1`, a node the plan
  already carries between `city:8` and `league:1` and which today accepts the walk and
  draws nothing. After this task the Victory Road **is a route**: four screens of its own
  carve, a `N` entry out of `city:8`, an `E` exit into `league:1`, its own content
  (trainers and tall grass off its own `content` stream), and the League reachable on
  foot. Every kind test on the route path — the layout gate, `preload`'s route branch,
  `travel.walkSpawn`, `content`'s trainer and grass sets, and the two scene gates —
  answers "yes" for `victory-road` through **one** exported predicate.
- **Environment:** worktree `/home/runner/work/pkm-randomlike/wt-pkm-303`, branch
  `task-303`, cut off `origin/main` @ `0ec89dd`.
- **Dependencies (all merged):** the route carver (`src/engine/region/route/map.ts`,
  `sketchRoute`), the route screen (`src/scenes/RouteScene.ts` reading
  `planRouteScreens`, `src/engine/region/routeScreens.ts`) and the node plan
  (`src/engine/region/plan.ts`, which already places `victory-road:1` between `city:8`
  and `league:1` with `LEAGUE_BADGE`).

### Exclusive paths (single writer)

Nothing outside this list. No other task is in this batch.

- `src/engine/region/route/layout.ts`
- `src/engine/region/route/layout.test.ts`
- `src/engine/region/preload.ts`
- `src/engine/region/preload.test.ts`
- `src/engine/region/travel.ts`
- `src/engine/region/travel.test.ts`
- `src/engine/region/content.ts`
- `src/engine/region/content.test.ts`
- `src/engine/region/README.md`
- `src/scenes/RouteScene.ts`
- `src/scenes/CityScene.ts`
- `docs/region-spec.md` — **§7 only** (its subsections, the §7.3 table rows and §7.12,
  plus one new `### 7.13`; do not touch §1-§6 or §8+)

### Inputs (read-only)

- `AGENTS.md`, `docs/agent-spec-template.md`.
- `src/engine/region/plan.ts`, `src/engine/region/route/map.ts`,
  `src/engine/region/route/index.ts`, `src/engine/region/routeScreens.ts`,
  `src/engine/region/encounters.ts`, `src/engine/run/badge.ts`, `src/engine/save.ts`.
- `src/data/region.ts` (`ROUTE_HEIGHTS`, `ROUTE_WIDTH`), `src/data/biomes.ts`
  (`biomeForRoute`), `src/engine/routes/doors.ts` (`openingBandCells`).
- `src/scenes/WorldScene.ts`, `src/scenes/walker.ts`.
- `design/screens/03-route-hud.json` + `design/exports/03-route-hud.png` — the route
  screen's imported frame, caption exactly **`03 Route HUD`**. Read-only: this task adds
  no rect, no string and no colour to that frame; it changes which node kinds the
  existing screen accepts. Do not edit the JSON or the export.

## 🔒 Contract

### TypeScript

```ts
/** The kinds the route screen, the carver, the preload and the content pass treat as a route. */
export function isRouteKind(kind: string): boolean;
// true for 'route', 'lateral' and 'victory-road'; false for every other RegionNodeKind.
```

Live in `src/engine/region/route/layout.ts` (it already has a private `isRouteKind`;
export it, widen it) and re-exported by `src/engine/region/route/index.ts` already
(`export * from './layout'`), so importers use `import { isRouteKind } from
'../engine/region/route'` or the explicit file path. Use this **one** predicate at every
kind test below; do not copy the string comparison into a scene or a module.

- `planRouteLayout(plan, key)` for `key === 'victory-road:1'`:
  - `height === ROUTE_HEIGHTS[2]` (4 screens: `200`), `width === ROUTE_WIDTH` (60),
    `screens.length === 4`, contiguous (`bottom + 1 === next top`, last `bottom === 199`),
    `biomeId === biomeForRoute(nodeOf(plan, key).id).id` (`'forest'` today).
  - `openings` is **exactly** `[{ edge: 'N', role: 'entry', neighbourKey: 'city:8' },
    { edge: 'E', role: 'exit', neighbourKey: 'league:1' }]`. The generic
    `EXIT_EDGES = ['S', 'E', 'W']` would give the single exit `S`; the Victory Road's
    exit order is `['E', 'S', 'W']` (or an equivalent explicit rule) so its one exit is
    `E`. Every other node kind keeps `['S', 'E', 'W']` and its openings must not move.
  - **Determinism (`D11`):** the screen count is fixed at four **without moving a draw**.
    `planRouteLayout` must still consume `rng.int(2, 4)` off
    `nodeStreams(plan.seed, key).layout` and then `rng.int(0, 0x7fffffff)` (the carve
    seed), in that order, exactly as today; only the used `count` becomes 4 for
    `victory-road` (a forced `screens` argument still wins). `generateRoute`'s
    `carveSeedOf` replays the same two draws, so the carve must stay the same as a
    four-screen route's.
- `planRouteScreens(plan, 'victory-road:1')` needs **no code change**: it delegates to
  `generateRoute` → `planRouteLayout`, so it must now answer four screens, screen 0's
  spawn equal to the carver's `entry`, and the `E` band on the screen holding its first
  tile. If its doc comment or an error message speaks of "route/lateral" only, leave it;
  it is not in the exclusive paths.
- `preloadNode(seed, 'victory-road:1')` returns a `NodeWorld` with `kind:
  'victory-road'`, `tilesetId: 'forest'`, `width: 60`, `height: 200`, `spawn` equal to
  `generateRoute(...).entry`, and both meshes 60×200. `league:1` and `tower:1` stay
  `null`. `preload.test.ts:73`'s pinned `null` flips to the world; keep the other nulls.
- `travel(plan, run, 'victory-road:1', 'walk')` from a run standing on `city:8` with
  badges `[1..8]` answers `ok: true` with `spawn` equal to the carver's `entry`
  (`{x: 30, y: 0}`-shaped for a seed; **never** `{0, 0}` unless the carver really puts
  the entry there) and the next run standing on `victory-road:1`. With badges `[1..7]`
  it refuses `{ ok: false, reason: 'gate', badge: 8 }`. From `victory-road:1` back to
  `city:8` the walk is accepted. Nothing else in `travel` changes: no RNG, no clock, no
  DOM, no Phaser.
- `planNodeContent(plan, 'victory-road:1', tier)` returns `grass: true` and a
  `trainers` count in `[2, 4]`, drawn off `nodeStreams(seed, key).content` after the NPC
  and special rows in the documented order (the `victory-road` is a main-chain node, so
  its `poi` row takes no draw); calling it twice is deep-equal. No other node kind's
  content changes, because the trainer row is drawn after theirs and before a `poi` row
  that a main-chain node skips.
- Scenes:
  - `src/scenes/RouteScene.ts` — `buildNode()`'s guard becomes
    `node === undefined || !isRouteKind(node.kind)`, and the music line at
    `onNodeArrived` (`const route = node?.kind === 'route' || node?.kind === 'lateral'`)
    uses the same predicate. `arrivalSceneFor` already returns `null` for
    `victory-road` (keep it: the screen stays in this scene). Nothing else in the scene
    changes.
  - `src/scenes/CityScene.ts` — `destinationScene(kind)` answers `'Route'` for
    `isRouteKind(kind)` (so an east band into `victory-road:1` starts `RouteScene`);
    `town`/`city`/`league`/`tower` keep their answers and an unknown kind still `null`.

### Data

- No new key, table or balancing value. The biome, the trainer count (`2..4`) and the
  grass flag are the existing route rules, now reached by the `victory-road` kind.

## 🧩 Data and configuration

None. `src/data/` is untouched. `src/data/dex/` is never edited by hand.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; green, including the tests the task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-303` audit against the exclusive paths list.
  - `[unit]` criteria are all headless. One `[live]` is owed; its procedure is written
    out below so QA reproduces it verbatim.

- **Acceptance criteria:**
  - [ ] `[unit]` `npm test` and `npm run build` are green.
  - [ ] `[unit]` `git diff --name-only main...task-303` names only files in the exclusive
        paths (the spec file `.agent_specs/task-303.md` aside).
  - [ ] `[unit]` `planRouteLayout(planRegion(seed), 'victory-road:1')` on two fixed seeds
        yields `screens.length === 4`, `height === ROUTE_HEIGHTS[2]`, contiguous screens,
        `width === ROUTE_WIDTH`, the biome from `biomeForRoute(1)`, and openings
        **exactly** `N:entry:city:8` + `E:exit:league:1`.
  - [ ] `[unit]` For the same seed, every node whose kind is **not** `victory-road`
        produces the same `openings` and height as at `main` (pin the current values in
        the test: a 3-neighbour route still exits `S` then `E`, a lateral only `N`, a
        4-screen route still rolls its height off the stream). Also
        `isRouteKind('victory-road') === true`, `isRouteKind('league') === false`,
        `isRouteKind('tower') === false`, `isRouteKind('city') === false`.
  - [ ] `[unit]` `preloadNode(seed, 'victory-road:1')` is a 60×200 `forest` world of kind
        `victory-road` whose `spawn` is the carver's `entry` and whose meshes are 60×200;
        `preloadNode(seed, 'league:1')` and `'tower:1'` stay `null` (the pinned null at
        `preload.test.ts:73` for the road is gone).
  - [ ] `[unit]` `travel(plan, run@city:8 badges 1..8, 'victory-road:1', 'walk')` is
        accepted, its `spawn` equals `generateRoute(plan, 'victory-road:1').entry` **and**
        `planRouteScreens(plan, 'victory-road:1').screens[0].spawn`, and it is not
        `{0, 0}`; with badges 1..7 the same call refuses `gate` with badge 8; the walk
        back to `city:8` is accepted; calling the accepted travel twice is equal.
  - [ ] `[unit]` `planNodeContent(plan, 'victory-road:1', 1)` has `grass: true` and
        `trainers` in `[2, 4]`, deep-equal on a second call, and
        `planRouteScreens(plan, 'victory-road:1')` places exactly that many
        `route.trainers`, all off the lane and the bands.
  - [ ] `[unit]` The docs pass: `grep -n "victory-road" docs/region-spec.md` shows the
        §7.3 `grass` and `trainers` rows naming the Victory Road (no longer "none / no
        draw"), §7.12's parenthetical no longer says the Victory Road has no generator
        (only the League and the tower do), and a new `### 7.13 The Victory Road` states
        four screens, the `N` entry from `city:8`, the `E` exit into `league:1`, its
        trainers and grass, and that the League is reachable on foot.
  - [ ] `[live]` **The League is reachable on foot through the road, measured on the
        running game at 1280×800.** Procedure (dev server + CDP; method for each
        evidence in brackets):
        1. `npm run dev -- --host 127.0.0.1 --port 5173`, headless Chromium with
           `--remote-debugging-port=9222`, `Emulation.setDeviceMetricsOverride`
           `{width:1280,height:800,deviceScaleFactor:1,mobile:false}`. [CDP]
        2. In the page, `Runtime.evaluate` with `awaitPromise: true`:
           `const m = await import('/src/main.ts');` then build a v28 save run and start
           the city: with `const s = await import('/src/engine/run/state.ts'); const
           b = await import('/src/engine/run/badge.ts'); let run =
           s.createRun({seed:'live-303', starter: s.createRunPokemon({id:'starter',
           speciesId:'charmander', level:30, moves:['ember','scratch','growl']}), bag:
           [], startedAt: new Date().toISOString()}); for (let n=1;n<=8;n++) run =
           b.grantBadge(run,n); run = {...run, nodeKey:'city:8',
           visitedNodes:[...run.visitedNodes,'city:8']}; m.game.scene.start('City',
           {run});` [game state read from the page]
        3. Read `planRegion('live-303')` (`await import('/src/engine/region/plan.ts')`)
           and assert `planCity(plan,'city:8').exits` carries an `E` band whose
           `neighbourKey === 'victory-road:1'`. Then, on the live `City` scene, call
           `await scene.walkBand({ neighbourKey: 'victory-road:1' })` — the exact
           function an east band press calls. [page state]
        4. Wait until the live scene is the `Route` scene
           (`m.game.scene.getScenes(true)[0]`), then read
           `scene.debugRouteScreen()` and assert: `nodeKey === 'victory-road:1'`,
           `screens.length === 4`, `screens[3].bottom === 199`, `index === 0`, and the
           band with `edge === 'E' && role === 'exit'` has
           `neighbourKey === 'league:1'`; and read the canvas with
           `m.game.renderer.snapshotArea(0,0,1280,800,(image)=>{…drawImage to a 2D canvas
           and getImageData…})` — at least 8 distinct RGB colours in the frame (a blank
           canvas is one). [canvas + `renderer.snapshotArea` + `getImageData`]
        5. Dispatch `Input.dispatchKeyEvent` `ArrowDown` (keyDown, wait, keyUp) until
           `debugRouteScreen().index === 1`; assert the tile moved south and the index
           crossed. [CDP input + page state]
        6. Walk/press into the `E` band (or call `scene.travelToNode('league:1',
           'walk')`) and assert the live scene becomes the League with
           `run.nodeKey === 'league:1'`. [page state]
        PASS = every equality above holds; report the snapshot's distinct-colour count
        and the screen/band numbers actually read.

- **Not owed:** no pixel diff against `design/exports/03-route-hud.png` (D57); the frame
  enters as a spec, and this task changes no rect on it.

## 📣 Coordination

- **For the Architect:** the item's `[live]` says "tilemap 60×240" and "the last
  screen's `E` band". Measured against the shipped carver: four screens are **60×200**
  (`ROUTE_HEIGHTS[2]`, last screen rows 120-199, not 240), and with a `N` entry + `E`
  exit the carver draws the `E` opening's row off its own stream, so the band's screen
  is seed-dependent (8 seeds → screens 0-2, never 3). This spec therefore keeps the
  requirement that the `E` band names `league:1` and that walking it lands on the
  League, and drops the false "last screen" clause. If a later task must pin the band
  to the last screen, the carver needs an anchor override; today it has none.
- **For the next batch:** `[Task-298]` may now delete the floor modules **and**
  `src/scenes/RouteScene.ts` only if its route screen is dead; note that `RouteScene` is
  the live route/lateral/Victory-Road screen after `Task-302` and `Task-303`, so that
  claim needs re-checking before the sweep runs.
- **For the merge:** the Orchestrator ticks `TODO.md` and writes `CHANGELOG.md`; the dev
  must not touch either.

## ⛔ Out of scope

- Any new screen, scene, panel, HUD rect, art, audio cue or `src/data/` table.
- The region map's DOM drawing of the node, the League scene, the tower, the save schema.
- A fifth screen, a randomised screen count for the road, or a different biome.
- Deleting the floor modules or the compat fields (that is `[Task-298]`).
- Touching `src/engine/region/route/map.ts`, `routeScreens.ts`, `plan.ts`,
  `src/main.ts`, `package.json` or `vite.config.ts`.
- Rerunning `npm run data:dex`.
