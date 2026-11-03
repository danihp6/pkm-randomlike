# Spec: Task-292 — Services live in the Centre and nowhere else

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene + pure engine rule + shop/PC seams + docs section.
- **Role:** Dev.
- **Objective:** a region **Pokémon Centre** becomes a real interior scene
  (`src/scenes/services.ts`, scene key `Centre`) reached from a city's `centre`
  building, and the three services live only there: its **counter** heals party and box
  on entry (HP/PP, never a status, never a revival), its **PC** is the only place the
  party and the box can be swapped, and its **merchant** is the only shop in the
  region, stocked per city. The town's **laboratory** heals on entry without a Centre.
  The PC's edit predicates stop meaning "the floor's entry room" and start meaning
  "inside a Centre".
- **Environment:** worktree `../wt-pkm-292`, branch `task-292`.
- **Dependencies (already merged on `main`):** the interior plan and its kind
  (`planInterior`, `InteriorRoomKind` with `'centre'`, `src/engine/region/interior/plan.ts`),
  the city scene's door hand-off (`CityScene` starts `interiorSceneKey('centre')` =
  `'Centre'` with `{ run, cityKey, interiorKey }`), the shipped Lab scene
  (`src/scenes/InteriorScene.ts`), the shop model (`src/ui/shop.ts`,
  `src/data/shop.ts`), the heal module (`src/engine/run/heal.ts`) and the region plan
  (`bandForNode`, `src/engine/run/levelCurve.ts`).

### Exclusive paths (single writer)

- `src/scenes/services.ts` (new)
- `src/scenes/regionScenes.ts`
- `src/scenes/regionScenes.test.ts`
- `src/scenes/InteriorScene.ts`
- `src/scenes/README.md`
- `src/engine/run/heal.ts`
- `src/engine/run/heal.test.ts`
- `src/engine/run/state.ts`
- `src/engine/run/state.test.ts`
- `src/engine/run/README.md`
- `src/ui/shop.ts`
- `src/ui/shop.test.ts`
- `src/data/shop.ts`
- `src/data/shop.test.ts`
- `src/ui/partyScreen.ts`
- `src/ui/partyScreen.test.ts`
- `src/ui/hud/panels/pc/pcPanel.test.ts`
- `src/scenes/panels/pc.ts`
- `src/scenes/panels/party.ts`
- `src/scenes/panels/shop.ts`
- `src/scenes/panels/detail.ts`
- `src/scenes/rooms/shop.ts` (one call site only — the legacy Mart passes the band and
  key explicitly; do not otherwise touch the rooms folder)
- `docs/region-spec.md` — **only** `## 6. Services per settlement`. Replace that
  section's body in place; do not touch any other section.

If a path outside this list must change for the build to stay green, **stop** and say
so in your final report instead of touching it.

### Inputs (read-only)

- `AGENTS.md`.
- `docs/region-spec.md` §1 (nodes), §5 (the map and doors), §7.2 (the interior list),
  §7.5 (the city screen), §8 (the save).
- `docs/routes-spec.md` §6 (the old heal stop and the PC rule this task replaces).
- `src/engine/region/interior/plan.ts`, `src/scenes/InteriorScene.ts`,
  `src/scenes/CityScene.ts` (the door hand-off and the fade-back rule),
  `src/scenes/WorldScene.ts`, `src/scenes/walker.ts`.
- `src/engine/run/heal.ts`, `src/engine/run/state.ts` (`pcFullyEditable`,
  `pcMemberEditable`), `src/ui/partyScreen.ts`, `src/scenes/panels/**`.
- `src/ui/shop.ts`, `src/data/shop.ts`, `src/ui/hud/panels/shop/**`.
- `design/screens/03d-route-shop-buy.json` and `design/exports/03d-route-shop-buy.png`
  — caption exactly **`03d Route · shop · buy`** — and
  `design/screens/03p-panels-pc-rip.json` and `design/exports/03p-panels-pc-rip.png`
  — caption exactly **`03p Panels · pc rip`**. The Centre reuses those two shipped
  panels unchanged; this task claims no new board frame (the interior is a walked room,
  like the Lab).

## 🔒 Contract

### `src/engine/run/heal.ts`

```ts
/**
 * The Centre's counter, and the laboratory's: party and box, HP and PP back to full,
 * never a status cure and never a revival (D5). Returns the run untouched when there
 * is nothing to heal.
 */
export function serviceHeal(run: RunState): RunState;
```

`serviceHeal` is `restParty(run, false)` (the same rule `healParty` already carries);
keep `healParty` and the Pokevial exports exactly as they are — other modules read them.
Add the "nothing to heal" short-circuit through the shipped `needsHealing`.

### `src/engine/run/state.ts` — the PC is editable in a Centre

```ts
export function pcFullyEditable(run: RunState, inCentre?: boolean): boolean;
export function pcMemberEditable(run: RunState, inCentre?: boolean): boolean;
```

`run` is still the first parameter (existing call sites must compile). The rule is
**`inCentre === true`**, defaulted to `false`: outside a Centre every box edit is
refused, inside one it is allowed, on every visit. `pcMemberEditable` delegates to
`pcFullyEditable` as it does today. Update the two doc comments and the module's
`docs/routes-spec.md` §6 references to `docs/region-spec.md` §6.

### `src/ui/partyScreen.ts`, `src/scenes/panels/**` — the flag travels

Thread the Centre flag from the panel that knows its scene down to the predicate:

- `partyScreen`'s exported pure entry points that can move a box member
  (`partyScreenMove`, `dropOnCard`, and any other that reaches `pcMemberEditable`) gain
  an optional last parameter **`inCentre = false`** (or an options object with that
  field; pick one and use it everywhere). Internal helpers take it too.
- The panel modules pass it: `src/scenes/panels/pc.ts` / `party.ts` / `detail.ts` read
  it from their host. Add one helper on the panel host side, e.g.
  `pcInCentre(host)` = `host.scene.scene.key === 'Centre'`, and use it at every call
  site of those pure functions.
- No behaviour changes beyond that flag: a route keeps refusing every box edit.

### `src/ui/shop.ts` + `src/data/shop.ts` — the shelf is a node's

```ts
/** One row's cache key: `shop-<nodeKey>-<itemId>`. */
export function shopRowKey(nodeKey: string, itemId: string): string;
export function buyItem(run: RunState, slot: ShopSlot, nodeKey?: string): ShopTrade;
export function buyRows(
  run: RunState,
  stock: readonly ShopSlot[],
  nodeKey?: string,
): readonly ShopRow[];
```

The default is `run.nodeKey`. The endless ball row is computed from the **band of the
node** instead of `bandForMap`: add an internal `bandOfKey(nodeKey, seed)` that resolves
`nodeOf(planRegion(seed), nodeKey)` through `bandForNode` (falling back to the run's
`levelCap` band when the node is unknown), so `buyRows(run, stock)` needs no extra
argument. `src/data/shop.ts` gains the per-city-tier stock the Centre sells:

```ts
/** The band a city's tier buys at: 1 → early, 2 → mid, 3 → late. */
export function shopBandForTier(tier: 1 | 2 | 3): BandId;
```

`buildShop(band.id, rng)` is unchanged; the Centre rolls its stock once per city from
`Rng(hashSeed(`${seed}:shop:${cityKey}`))` (`D11` — one stream per city, no other draw
moves). The legacy `openMart` (`src/scenes/rooms/shop.ts`) keeps working by passing
`host.run.nodeKey` (and it may keep reading `bandForMap`; it is deleted by the sweep).

### `src/scenes/services.ts` — the Centre

- Exports `regionSceneKey = 'Centre'` and `regionSceneClass` (the class), extended from
  `WorldScene` exactly as `InteriorScene` is, so `REGION_SCENES` picks it up.
- Receives the same payload as the Lab: `{ run?: RunState; cityKey?: string;
  interiorKey?: string }`, with `interiorKey` defaulting to `'centre'`.
- Resolves its room with `planInterior(planRegion(run.seed), interiorKey, cityKey)`,
  draws the interior tileset, places the player on `entry` and walks with the shared
  `WorldWalker`; the door walks back to the city through the shipped travel seam.
  A `planInterior` throw is a `console.warn` on an empty camera, never a crash.
- **On entry** runs `serviceHeal(run)` and commits it (`storeRun`), so the counter's
  heal is what the save holds. It **does not** cure status and never revives.
- Its roles are the room's own slots (`heal`, `pc`, `counter`): standing on the `heal`
  slot re-heals, the `pc` slot opens the shipped PC panel (`openPcPanel` from
  `src/scenes/panels/pc.ts`), the `counter` slot opens the shipped shop card
  (`src/scenes/panels/shop.ts`) with the city's stock.
- **Dev surface (the QA reads it, so it is part of the contract):**

```ts
export type ServicesDebugState = Readonly<{
  sceneKey: string;        // always 'Centre'
  interiorKey: string;
  cityKey: string;
  healed: boolean;         // the entry heal ran and was committed
  pcEditable: boolean;     // pcMemberEditable(this.run, true)
  shopRows: number;        // the city's stock rows (buyRows), 0 before it is rolled
  stockKey: string;        // the city's shelf key: `${seed}:shop:${cityKey}`
}>;

// scene methods, dev-only like InteriorScene's placePlayer:
debugServicesState(): ServicesDebugState;
openCounter(): void;   // walks the counter: heal + commit
openPc(): void;        // opens the PC panel
openShop(): void;      // opens the merchant card
```

### `src/scenes/regionScenes.ts` — the folder registry sees the new file

`MODULES` today globs `./*Scene.ts`; `services.ts` does not match. Extend the pattern to
`['./*Scene.ts', './services.ts', '!./*.test.ts']` (order and the duplicate-key throw
stay as shipped) and pin the change in `regionScenes.test.ts`.

### `src/scenes/InteriorScene.ts` — the laboratory heals

On entry, when the room's kind is `'lab'`, run `serviceHeal` and commit it. Nothing
else about the Lab changes (the starter panel, the prologue gate).

### `docs/region-spec.md` §6

Rewrite `## 6. Services per settlement` in place: the Centre's counter, PC and merchant
as the only services, the laboratory's free entry heal in the town, the per-city stock,
the PC rule ("only inside a Centre"), and the fact that a route has no service at all.
Keep the section's existing heading and its position; no other section moves.

## 📣 Coordination

- For the QA: the legacy Mart (`src/scenes/rooms/shop.ts`) and `RouteScene` are out of
  scope beyond the one call-site fix; the rooms folder dies in the sweep.
- For the sweep task: `openMart` and the rooms shop can go once `services.ts` is the
  only counter.

## 🧪 Test and Validation Plan (for QA)

- **Method:** `npm test`, `npm run build`, `git diff --name-only main...task-292`
  audited against the exclusive paths, then the browser pass below.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `heal.test.ts`: `serviceHeal` restores HP and PP across party **and**
    box, leaves a status in place, never revives a `0 HP` member, and returns the same
    object when nothing is missing.
  - [ ] `[unit]` `shop.test.ts`: `shopRowKey('city:3', 'potion')` is
    `'shop-city:3-potion'`; two different nodes never share a row; the ball row stays
    endless at every band; `buyRows`/`buyItem` default to `run.nodeKey`.
  - [ ] `[unit]` `shop.test.ts` (data): `shopBandForTier(1|2|3)` answers `early`, `mid`,
    `late`.
  - [ ] `[unit]` `state.test.ts`: `pcMemberEditable(run, false)` is false on any run;
    `pcMemberEditable(run, true)` is true; with the second argument omitted it is false.
  - [ ] `[unit]` `partyScreen.test.ts`: a box drag with `inCentre = false` moves
    nothing; with `true` it withdraws/deposits.
  - [ ] `[unit]` `pcPanel.test.ts`: the box drag is a **Centre** gesture — with a
    Centre host (`scene.sys.settings.key === 'Centre'`) a box cell let go on the party
    card withdraws once and a party row let go on the PC card deposits once; with a
    route host (`'Route'`) the same two gestures move nothing.
  - [ ] `[unit]` `regionScenes.test.ts`: `collectRegionScenes` still throws on a
    duplicate key and the new Centre entry is collected with key `Centre`.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` At 1280×800 on the Vite dev server: with a v28 save standing on
    `city:2` whose lead and box member are both damaged (build it in the page with
    `await import('/src/engine/run/state.ts')`/`'/src/engine/save.ts'` + `storeRun`),
    start the scene from the page (`(await import('/src/main.ts')).game.scene.start('Centre', { run, cityKey: 'city:2', interiorKey: 'centre:2' })`),
    wait for two animation frames and then read
    `(game.scene.getScene('Centre') as any).debugServicesState()`:
    `healed === true`, `pcEditable === true`, `shopRows > 0`, and the save's lead and box
    member both have `hp === maxHp`. Then `openShop()` and read
    `document.querySelectorAll('[data-hud-panel="shop"] [data-hud-shop-row]').length`
    equal to `shopRows`. **Refused outside:** on a `route:1` save, call
    `pcMemberEditable(run, false)` from the page's engine import: `false`, and no
    `[data-hud-panel="shop"]` is mounted after the same two frames.
    **Measurement:** report `debugServicesState()`, the two members' `hp`/`maxHp` read
    from the stored save, and the shop row count.
- **No pixel comparison:** fidelity is read from the board frames named above, never
  from a screenshot diff (`D57`).

## ⛔ Out of scope

- Do not create a `Centre` design frame; the interior is a walked room.
- Do not delete `openMart`, the rooms folder, `RouteScene` or `StarterScene`.
- Do not change `SAVE_VERSION` or the save's shape.
- No new dependency; no `docs/` file other than §6.
