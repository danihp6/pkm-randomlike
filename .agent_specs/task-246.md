# Spec: Task-246 — The floor map is wired to its spec (`03o-panels-map-routes`)

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** HUD panel (Preact over the `#hud` layer) — DOM only: no engine rule,
  no Phaser scene, no data table, no asset.
- **Role:** Dev.
- **Objective:** after this task the frame `03o Panels · map routes` is **measured**
  instead of `pending`: a new adapter `src/ui/hud/specGap.views/map.ts` builds the route
  header card's `PanelView` from `design/fixtures/03o-panels-map-routes.json` at 1280×800,
  claims nothing — the frame draws a **region** map card at `928, 24, 304, 198` and the
  shipped panel is the floor **minimap** at `8, 8, 216, 250`, and every string it prints
  misses too — and writes the whole comparison down as measured numbers in the adapter's
  doc comment and in a new test. No game behaviour and no pixel of the route changes.
- **Environment:** worktree `../wt-pkm-246`, branch `task-246`.
- **Dependencies:** none. The adapter contract (`src/ui/hud/specGap.views/README.md`,
  `specGap.ts`, `specGap.walk.test.ts`) and the precedents
  `src/ui/hud/specGap.views/notices.ts` and `.../detail.ts` are already merged.

### The measured facts this task is built on (verify them, then write them down)

- The frame is `03o Panels · map routes` (`design/board.json`, node `6:2250`), **35 boxes,
  4 strings, 18 colours**, viewport 1280×800. Its card is `map routes panel`
  `(928, 24, 304, 198)` with `map routes highlight` `(942.59, 36, 280, 1)`, `key map`
  `(942.59, 36, 29.18, 24)`, the two view toggles `view route` `(1096, 36, 54, 20)` and
  `view map` `(1156, 36, 44, 20)`, and a `viridian all routes` frame
  `(942, 64, 276, 146)` whose `Group` `(28, 22, 222, 96)` holds **32 `Vector` shapes** — one
  per route of the region. Its four strings are `key letter map` `M`,
  `view route label` `ROUTE`, `view map label` `MAP` and `map routes title` `VIRIDIAN
  FOREST` (`976, 48, 118, 12`, 10 px).
- **It is a region map, and the game has no such screen.** The shipped card is the floor
  **minimap** of `docs/maps-spec.md` §8 and `D32`: `mapPanelBox({ width: 1280, height:
  800 })` = `{ x: 8, y: 8, w: 216, h: 250 }`, i.e. **dx −920, dy −16, dw −88, dh +52**
  against the frame's card, docked top-left where the board docks top-right.
- **The shipped card has no view.** `MapPanelView` is `{ open, box, highlight, title,
  empty, grid, links, rooms }` — there is no route/map toggle, no region frame and no
  per-route shape, so the frame's `view route`, `view map`, the `viridian all routes` frame
  and its 32 `Vector`s have no field to be claimed from.
- **The title misses by more than type.** The fixture's title is
  `Map 1 · Viridian Forest` (`design/fixtures/03o-panels-map-routes.json`'s `map.title`),
  the board's `map routes title` is `VIRIDIAN FOREST`. `gapFor` folds case, so the two would
  still differ by `MAP 1 · `; the title is also a **text node**, not a box, so it is claimed
  as a string only if the board carries it — it does not.
- **The rest of the frame's card is the card's own:** `map routes highlight` at
  `942.59, 36, 280, 1` against the shipped `highlight` (panel-relative `12, 12, 192, 1` →
  viewport `20, 20, 192, 1`), and `key map` against a card that carries **no chip of its
  own** (`panels/map/README.md` rule 3: "`MapPanelView` carries no chip of its own").
- **The fixture is the frame's floor, pasted as data.** Its `map.view` is a 15 × 11 floor
  with **one** room (`id 0`, a 6 × 6 square at `0, 0`, `current`, `captureSpent`, one `E`
  opening of kind `entry`) and **one** link (`0 → 1`), which `panels/map/fixture.test.ts`
  already pins — that test is the adapter's premise, not a duplicate of it: it proves the
  payload, this task proves the comparison.

### Exclusive paths (single writer)

- `src/ui/hud/specGap.views/map.ts` — new.
- `src/ui/hud/panels/map/specGap.test.ts` — new.
- `src/ui/hud/panels/map/README.md` — **one new line** in its `## Layout` list, and nothing
  else in that file.

**Nothing outside this list.** In particular, these two are **the Orchestrator's at
merge, not yours** — do not touch them, and do not "fix" the red they cause:

- `src/ui/hud/specGap.walk.test.ts` — its `PENDING` line for `03o-panels-map-routes`
  (`'the floor map; no view builder is wired'`) is deleted at merge. While it is still
  there the walker **fails on purpose**: its case
  `accounts for every screen: mapped, or a named reason` reports
  `screens both mapped and pending: 03o-panels-map-routes`. That single red is the expected
  state of your branch.
- `docs/hud-fidelity.md` — its `03o-panels-map-routes` row in `The spec gap, measured
  (D57)` flips from `pending` to `wired` at merge, in the same push.

Also do not touch `design/**`, `src/ui/hud/specGap.ts`, `specGap.views/notices.ts`,
`specGap.views/hud.ts`, `specGap.views/detail.ts`, `src/ui/hud/panels/map/view.ts`,
`mapPanel.tsx`, `map.css`, `fixture.test.ts`, `src/ui/hud/panels/{party,bag,pc,hud}/**`,
`src/ui/mapView.ts`, `src/scenes/**`, `src/engine/**` or `package.json`.

### Inputs (read-only)

- `AGENTS.md`, `docs/agent-spec-template.md`, `docs/hud-fidelity.md` (§5 "Panel geometry",
  §6's frame → node map, the measured table's `03o` row, and the `The spec gap, measured
  (D57)` table), `design/README.md`, `docs/maps-spec.md` §8.
- `design/screens/03o-panels-map-routes.json` and
  `design/exports/03o-panels-map-routes.png` — frame **`03o Panels · map routes`**,
  1280×800.
- `design/fixtures/03o-panels-map-routes.json` — its `map` block (`title` and the `MapView`
  verbatim) and its empty six-key `state`.
- `src/ui/hud/panels/map/` — the whole folder, especially `view.ts` (`mapPanelBox`,
  `mapPanelView`, `MapPanelView`, `MapRoomView`, `MapMarkerView`, the `MAP_*` mirror
  constants), `fixture.test.ts` and the `README.md`.
- `src/ui/mapView.ts` — read **only** for the `MapView` / `MapViewRoom` types the fixture is
  cast to.
- `src/ui/hud/specGap.ts`, `src/ui/hud/specGap.test.ts`,
  `src/ui/hud/specGap.walk.test.ts`, `src/ui/hud/specGap.views/README.md`,
  `src/ui/hud/specGap.views/notices.ts`, `src/ui/hud/specGap.views/detail.ts`,
  `src/ui/hud/panels/detail/specGap.test.ts`.

## 🔒 Contract

`src/ui/hud/specGap.views/map.ts` exports exactly two names:

```ts
export const slug = '03o-panels-map-routes';
export function buildView(spec: ScreenSpec): PanelView;
```

- `buildView` imports `design/fixtures/03o-panels-map-routes.json` as a module default and
  builds the card exactly as the route scene does:

  ```ts
  const DESKTOP = { width: 1280, height: 800 };
  const view = mapPanelView(FIXTURE.map.view as unknown as MapView, FIXTURE.map.title, DESKTOP);
  ```

  The cast is the one `panels/map/fixture.test.ts` already uses: a JSON `MapView` is the
  fixture's own data, not a value this adapter computes.
- **Boxes:** `[]`. Claim a box only when the shipped rect for it is within `GAP_TOLERANCE`
  of the frame's box of that name, the way `specGap.views/detail.ts`'s `cardClaim` does, so a
  card that ever lands on the board becomes a claim instead of a silent pass. The candidates
  and their shipped rects, all outside the tolerance here:
  - `map routes panel`: frame `928, 24, 304, 198`; shipped `view.box` = `8, 8, 216, 250`.
  - `map routes highlight`: frame `942.59, 36, 280, 1`; shipped `view.highlight`
    (panel-relative `12, 12, 192, 1`) → viewport `20, 20, 192, 1`.
  - `key map`: frame `942.59, 36, 29.18, 24`; the shipped card draws **no chip**
    (`MapPanelView` has no `chip` field, `panels/map/README.md` rule 3).
- **Strings:** `[]`. The card prints one line, `view.title.text` = `Map 1 · Viridian
  Forest`, and the board's is `VIRIDIAN FOREST`; claim a string only when `gapFor`'s own fold
  makes it the board's, which this one is not (the shipped line carries a map number and a
  separator the board's title does not).
- **Colours:** `[]`. The card's chrome is `map.css`'s tokens; its one content colour set
  (`MAP_CURRENT_FILL`, `MAP_SPECIAL_TONES`, the entry/portal strokes) belongs to rooms and
  markers, and no marker is a box this frame draws.
- **Determinism:** reads no `Rng`, no clock, no DOM and no store. `mapPanelView` is pure and
  the fixture is a module constant.
- You may read `spec` only as a **structural selector** — is this box name in the frame at
  all. Never filter strings or colours by the spec's content beyond that.

### The table the doc comment carries

| frame box | frame rect | shipped | why not claimed |
| --- | --- | --- | --- |
| `map routes panel` | `928, 24, 304, 198` | `view.box` = `8, 8, 216, 250` | dx −920, dy −16, dw −88, dh +52: the board draws a 304 × 198 region card top-right, the game a 216 × 250 floor minimap top-left |
| `map routes highlight` | `942.59, 36, 280, 1` | `view.highlight` = the card's `12, 12, 192, 1` | follows the card |
| `key map` | `942.59, 36, 29.18, 24` | — | the shipped card draws no chip of its own (`panels/map/README.md` rule 3) |
| `view route`, `view map` | `1096, 36, 54, 20` / `1156, 36, 44, 20` | — | there is no route/map toggle: the game has one map and `MapPanelView` has no such field |
| `viridian all routes`, `Group`, `Vector` ×32 | `942, 64, 276, 146` … | — | the board's **region** map of 32 routes; the game draws the floor's own rooms (`view.rooms`) and no region at all |
| `route screenshot` | `0, 0, 1280, 800` | — | the frame's painted scene |

And the line it does not claim: `view.title.text` `Map 1 · Viridian Forest` against the
board's `VIRIDIAN FOREST` (a text node, not a box).

## 🧩 Data and configuration

None. No new key, no new default, no run field, no save version step. The fixture is
read-only — **do not add a region map to `design/fixtures/03o-panels-map-routes.json`**, and
do not change `mapPanelView` to grow one: that is a screen the game does not have.

## 🧪 Test and Validation Plan (for QA)

- **Method:** run from the task's worktree. `npm test` — Vitest, headless.
  `npm run build` — `tsc --noEmit && vite build`.
  `git diff --name-only main...task-246` — audit against the exclusive paths.
  One `[live]` pass, in the browser, below.
- **Acceptance criteria:**
  - [ ] `[unit]` `npx vitest run src/ui/hud/panels/map/specGap.test.ts` is green. It
    asserts: `slug === '03o-panels-map-routes'` and `SPEC.slug` the same; the spec carries
    **35 boxes, 4 text nodes and 18 colours**; `buildView(SPEC)` deep-equals
    `{ boxes: [], strings: [], colours: [] }`; `gapIsEmpty(gapFor(buildView(SPEC), SPEC))`
    is `true`; `buildView(SPEC)` twice deep-equals itself.
  - [ ] `[unit]` The same file pins the **premise**: the frame's five named boxes are
    `map routes panel` `928, 24, 304, 198`, `map routes highlight` `942.59, 36, 280, 1`,
    `key map` `942.59, 36, 29.18, 24`, `view route` `1096, 36, 54, 20` and `view map`
    `1156, 36, 44, 20`; its four strings are `M`, `ROUTE`, `MAP` and `VIRIDIAN FOREST`;
    `mapPanelBox({ width: 1280, height: 800 })` is `{ x: 8, y: 8, w: 216, h: 250 }`, a
    delta of `{ dx: −920, dy: −16, dw: −88, dh: 52 }` whose four numbers all exceed
    `GAP_TOLERANCE`.
  - [ ] `[unit]` The same file pins the shipped card's own copy and content:
    `view.title.text` is `Map 1 · Viridian Forest` and the board's `map routes title`
    characters are `VIRIDIAN FOREST`, so the two differ after `gapFor`'s fold; the fixture's
    floor yields **one** room and **one** link, `view.empty` is `null`, and the room's one
    opening path is `M 90.4 101.995 V 127.339` (the value
    `src/ui/hud/panels/map/fixture.test.ts` already pins — read it, do not change it).
  - [ ] `[unit]` `npm test` fails **only** in `src/ui/hud/specGap.walk.test.ts` → `accounts
    for every screen: mapped, or a named reason`, with the message
    `screens both mapped and pending: 03o-panels-map-routes`. That red is the
    Orchestrator's `PENDING` flip at merge. No other test fails — quote the summary line in
    the report.
  - [ ] `[unit]` `npm run build` exits 0.
  - [ ] `[unit]` `git diff --name-only main...task-246` lists exactly
    `src/ui/hud/specGap.views/map.ts`, `src/ui/hud/panels/map/specGap.test.ts` and
    `src/ui/hud/panels/map/README.md`. Nothing under `design/`, `src/scenes/`,
    `src/engine/`, `src/ui/mapView.ts` or `.agent_specs/`.
  - [ ] `[unit]` `git diff` shows no change to `src/ui/hud/specGap.walk.test.ts`, to
    `docs/hud-fidelity.md`, to `design/fixtures/03o-panels-map-routes.json`, to
    `src/ui/hud/panels/map/fixture.test.ts`, or to any file of `src/ui/hud/panels/map/`
    other than the README's **one added line**.
  - [ ] `[live]` At **1280×800**, after NEW RUN → a starter → the first route, with the map
    card opened (`M` — a fresh save leaves every card but PARTY collapsed), measured over
    CDP with `getBoundingClientRect()` and `textContent`:
    `document.querySelector('[data-hud-panel="header"]')` is exactly
    `8, 8, 216, 250` — `mapPanelBox({ width: 1280, height: 800 })` — and
    `document.querySelector('[data-hud-map="title"]').textContent` is the run's own floor
    title (`Map <n> · <biome>`), not the board's `VIRIDIAN FOREST`. The frame's card is
    `928, 24, 304, 198`: the delta is the adapter's record, not a defect of this task.
- **A `[live]` that compares pixels is not a criterion** (`D57`).

## 📣 Coordination

- **For the Orchestrator:** at merge, delete `'03o-panels-map-routes'` from the `PENDING`
  map in `src/ui/hud/specGap.walk.test.ts` **and** flip the `03o-panels-map-routes` row of
  `docs/hud-fidelity.md`'s `The spec gap, measured (D57)` table to `wired` — one push. The
  row's counts (35 / 4 / 18) stay as they are.
- **For the human / the next cut:** this is the one row of the batch that measures a screen
  the game **does not have** — the board's `03o` draws a region map with a ROUTE/MAP
  toggle and one shape per route, and `docs/maps-spec.md` §8 asks only for the floor
  minimap. If the region map is wanted it is a screen of its own (a `MapView`-level
  feature), not a fix to this panel; the adapter records the delta and claims nothing, so
  nothing here forecloses it.
- **Do not** put a test file inside `src/ui/hud/specGap.views/`: the walker globs
  `./specGap.views/*.ts` and treats **every** module there as an adapter, so a `*.test.ts`
  beside an adapter registers an adapter with an `undefined` slug and breaks the walker.

## ⛔ Out of scope

- Moving the minimap to the board's `928, 24, 304, 198`, growing it into a region map,
  adding a ROUTE/MAP toggle or a per-route shape: each is a `maps-spec`/`D32`-level
  decision above this measurement.
- Renaming the title, dropping the `Map <n> · ` prefix, or giving the card a chip.
- The frame's painted `route screenshot`, the room and marker tones, the phone twin
  (`m03o-panels-map-routes`).
- Touching `mapPanelView`, `buildMapView`, `specGap.ts`, the walker, `docs/hud-fidelity.md`,
  `design/**` or any test other than the one this task adds.
- New dependencies, refactors of `notices.ts`/`detail.ts`, prettier sweeps of unrelated
  files.
