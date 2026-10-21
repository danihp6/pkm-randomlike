# Spec: Task-97 — The secret shop: several held items and TMs behind a type-gated vault

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule + data + Phaser scene (the special-room layer).
- **Role:** Dev.
- **Objective:** a new special room kind, `secret-shop`, hangs off a floor's regular
  graph from map 3 on exactly the way the shipped `static` leaf does: it is a quiet
  dead-end leaf whose route carves the shipped one-tile vault behind one obstacle
  (bush / rock / pond). The seal opens when **some living party member has one of the
  obstacle's own types** (Bug or Grass, Rock or Fighting, Water), permanently for that
  floor. Behind it stands a counter whose interact key opens the shipped **Mart card**
  with the secret shop's **own fixed stock**: four held items and two TMs at their
  catalogue prices. The room adds **no run field**, **no RNG draw on any shipped
  stream** and **no export the Mart does not already have** besides the ones frozen
  below.
- **Environment:** worktree `../wt-pkm-97`, branch `task-97`.
- **Dependencies (all merged on `main`):** the special-room layer (`D47`,
  `src/scenes/rooms/types.ts` + `registry.ts`, `MapRoomSpecial` in
  `src/engine/maps/plan.ts`); the gated vault carve (`src/engine/routes/gate.ts`,
  `carveGatedVault`, `gateKindFor`, `GATES`); the type predicate
  (`partyHasType`, `src/engine/run/party.ts`); the static leaf's own roll shape
  (`src/engine/routes/staticSpecies.ts` + `src/data/staticSpecies.ts`) as the pattern
  to copy; the Mart card (`openMart`, `src/scenes/rooms/shop.ts`, `ui` model
  `src/ui/shop.ts`); the notices (`src/ui/notice.ts`).

### Exclusive paths (single writer)

**Nothing outside this list.** Deleting a stray `.gitkeep` from a directory this task
populates is always allowed.

- `src/engine/maps/plan.ts`
- `src/engine/maps/plan.test.ts`
- `src/engine/routes/secretShop.ts` **(new)**
- `src/engine/routes/secretShop.test.ts` **(new)**
- `src/engine/routes/index.ts`
- `src/data/shop.ts`
- `src/data/shop.test.ts`
- `src/scenes/rooms/secretShop.ts` **(new)**
- `src/scenes/rooms/secretShop.test.ts` **(new)**
- `src/scenes/rooms/shop.ts`
- `src/scenes/rooms/registry.test.ts`
- `src/scenes/RouteScene.ts`
- `src/engine/run/curve.test.ts`
- `src/data/run.ts` — **the `TRAINER_XP_PER_MAP` row of a floor that leaves the fill
  window, and nothing else**
- `src/i18n/en.ts`
- `src/i18n/es.ts`
- `src/engine/README.md`
- `src/data/README.md`
- `src/scenes/rooms/README.md`
- `docs/balance/route-curve.md` — **the new re-walk paragraph only**
- `docs/maps-spec.md` — **§7 only** (the special-rooms table, the roll-order paragraph
  and one new subsection)
- `docs/design-spec.md` — **§7 only** (one new bullet in the special-rooms list)

`src/ui/mapView.ts` needs **no** change: `MapRoomMarker` is an alias of
`MapRoomSpecial` (`src/ui/mapView.ts` line 26), so the new kind reaches the minimap
through the descriptor's `drawMarker`. Do not edit it.

### Inputs (read-only)

- `docs/agent-spec-template.md`, `docs/maps-spec.md` §7, `docs/design-spec.md` §7,
  `docs/routes-spec.md` §6 (the notice convention).
- `src/engine/maps/plan.ts` (the `static` roll, `freeParents`, `addSpecial`),
  `src/engine/routes/gate.ts` and `staticSpecies.ts`, `src/data/gates.ts`,
  `src/data/staticSpecies.ts`, `src/engine/run/party.ts`.
- `src/scenes/rooms/{types,registry,gate,staticSpecies,shop,trade}.ts` and their tests,
  `src/scenes/RouteScene.ts` (`buildRoute`, the `gate:` input block),
  `src/ui/shop.ts`, `src/ui/notice.ts`, `src/data/items.ts`, `src/data/tms.ts`.

## 🔒 Contract

### TypeScript — `src/engine/routes/secretShop.ts` (new, pure, no Phaser)

```ts
import type { GateKind } from '../../data/gates';
import type { RunState } from '../run/state';

/** One counter row: an item, its catalogue price and how many units one purchase adds. */
export type SecretShopSlot = Readonly<{ itemId: string; price: number; count: number }>;

/**
 * The seal's stable opening mark in `pickedItems`: `secret-shop-<mapIndex>-<roomId>`.
 * `advanceMap` clears `pickedItems`, so the opening lasts the floor.
 */
export function secretShopSealId(mapIndex: number, roomId: number): string;

/** True when some party member holds one of the obstacle's own types. */
export function secretShopGateOpen(run: RunState, kind: GateKind): boolean;

/** The counter's rows: `SECRET_SHOP.held` then `SECRET_SHOP.tm`, catalogue price, one unit. */
export function secretShopStock(): readonly SecretShopSlot[];
```

- `secretShopGateOpen(run, kind)` is exactly
  `partyHasType(run, GATES[kind].types)` — the seal's art and its rule can never
  disagree, and the box is never asked (the member may sit at 0 HP; `partyHasType`
  already answers that way for the gated leaf).
- `secretShopStock()` reads **no RNG**: it maps `SECRET_SHOP.held` then
  `SECRET_SHOP.tm` in list order, drops any id the catalogue does not hold, and prices
  each at `buyPrice(getItem(id))` with `count: 1`. A run opens the same counter on every
  floor; nothing about the shelf is drawn.
- `src/engine/routes/index.ts` re-exports the module (`export * from './secretShop';`),
  beside `./gate` and `./staticSpecies`.

### Data — `src/data/shop.ts`

```ts
/**
 * The secret shop's own table (`docs/maps-spec.md` §7): the first floor that may hang
 * the leaf, the chance it does (on `${seed}:map:<floor>:secret-shop-room`), the held
 * items on its counter and the machines beside them. Balance, never engine code.
 */
export type SecretShopConfig = Readonly<{
  fromMap: number;
  chance: number;
  held: readonly string[];
  tm: readonly string[];
}>;

export const SECRET_SHOP: SecretShopConfig = {
  fromMap: 3,
  chance: 0.2,
  held: ['leftovers', 'lifeorb', 'choiceband', 'focussash'],
  tm: [tmItemId(88), tmItemId(114)],
};
```

Exact values; do not re-balance them. `tmItemId` is already imported by this file.
The stock is therefore **six** rows (four held + two machines), all at catalogue price
(held: 4000 each; TM: 3000 each). The four held ids are drawn only from the **`late`**
and **`end`** shelves of `SHOP_ROTATION` and the two machines appear in no band's
`SHOP_TM`: this is the late-band gear the Mart withholds, and the leaf from map 3 is
the run's chance to buy it early.

### Plan — `src/engine/maps/plan.ts`

1. `MapRoomSpecial` gains `'secret-shop'`; extend the type's doc comment with the new
   leaf, in the shipped tone.
2. The roll is the **last statement of the special pass**, after the static leaf, on
   its **own minted stream** so no shipped floor moves one byte:

```ts
// The secret-shop leaf rolls on its own minted stream, after the static leaf and
// every shipped draw, so no floor's topology, specials, room ids, sizes, roles or
// static leaf move (`docs/maps-spec.md` §7).
const secretShopRng = new Rng(hashSeed(`${seed}:map:${index}:secret-shop-room`));
if (index >= SECRET_SHOP.fromMap && secretShopRng.next() < SECRET_SHOP.chance) {
  const parents = freeParents();
  if (parents.length > 0) {
    addSpecial('secret-shop', parents[secretShopRng.int(0, parents.length - 1)], secretShopRng);
  }
}
```

Import `SECRET_SHOP` from `../../data/shop`. The leaf is a quiet `wild` dead-end exactly
like the others (the existing quiet/role passes already do that: `special !== null`).

### Scene — `src/scenes/rooms/secretShop.ts` (new descriptor)

`descriptor: RoomDescriptor` with `kind: 'secret-shop'`, `marker: 'secret-shop'`:

- `fixture(host)`: `const gate = host.route().gate; if (!gate) return null;` else
  `return { counter: gate.pocket };` — the counter is the vault's own pocket tile.
- `interact(host, tile)`, in this order:
  1. **The seal** (`gate.tile`): if `isItemPicked(host.run, secretShopSealId(mapIndex, roomId))`
     return `false` (the opened seal is not an object any more). If
     `!secretShopGateOpen(host.run, gate.kind)` → `host.showNotice(gateLockedNotice(gate.kind))`
     and return `true`. Otherwise `host.commitRun(markItemPicked(host.run, id))`,
     `host.rebuildRoom()`, `host.showNotice(gateOpenedNotice())`, return `true`.
  2. **The counter** (`gate.pocket`): if `host.panelOpen()` return `true` (the card owns
     the key). Otherwise `openMart(host, { key: 'secret-shop', slots: secretShopStock(), title: 'mart.secretTitle' })`
     and return `true`.
  3. Anything else: `false`.
- `drawFixture(host)`: guard `host.generatorStepActive()`; draw the shipped counter
  sprite (`SHOP_COUNTER_TEXTURE_KEY` from `../BootScene`) at the pocket centre, scaled
  `TILE_SIZE / TRADE_COUNTER_SIZE`-style as `src/scenes/rooms/trade.ts` does (reuse its
  two constants locally rather than importing a private one; keep the depth above the
  tiles as trade does). It is drawn whether or not the seal is open, like the gated
  leaf's reward.
- `drawMarker(graphics, cx, cy, radius)`: `graphics.fillStyle(0x14b8a6, 1)` then
  `fillCircle(cx, cy, radius * 0.85)`, then `graphics.fillStyle(0x10161f, 1)` and
  `fillCircle(cx, cy, radius * 0.34)` — the static leaf's ring shape in its own teal, so
  the marker is a colour no other kind uses.

### Scene — `src/scenes/rooms/shop.ts` (the Mart card, extended)

Add an optional stock override; the merchant's call site (`npcPanel.ts`) stays
untouched and keeps today's behaviour:

```ts
export type MartStock = Readonly<{
  /** The cache key the shelf belongs to; a different key re-rolls the rows. */
  key: string;
  /** The BUY tab's rows, in order. */
  slots: readonly ShopSlot[];
  /** The card's title key; undefined reads `mart.title`. */
  title?: TranslationKey;
}>;

export function openMart(host: RoomHost, stock?: MartStock): void;
```

- With no `stock`, `openMart(host)` behaves exactly as today (the floor's band, its own
  `…:shop:<mapIndex>` stream, the cached `${seed}:${mapIndex}` key, `mart.title`).
- With `stock`, the cache key is `stock.key` and the rows are `stock.slots`; the title
  is `t(stock.title ?? 'mart.title')`. The SELL tab, the money line, the drag, the ✕ and
  the floating (non-modal) behaviour are unchanged.
- Do not change `src/ui/shop.ts`, its tests, or the panel's geometry.

### Scene — `src/scenes/RouteScene.ts` (one block only)

In `buildRoute`'s `gate:` input block (the `params.room?.special === 'gated' ||
params.room?.special === 'static'` condition), include `'secret-shop'` and key its mark
on `secretShopSealId(params.room.mapIndex, params.room.roomId)`. Nothing else in the
scene changes: the registry glob discovers the descriptor, `quiet` is already true for
every special, and the marker reaches the minimap through the alias.

### i18n

One key, both locales, in each file's `mart.*` block:

- `src/i18n/en.ts`: `'mart.secretTitle': 'SECRET SHOP',`
- `src/i18n/es.ts`: `'mart.secretTitle': 'TIENDA SECRETA',`

The locked line and the opening line are the shipped `gate.locked.*` / `gate.opened`
notices; add no other key. `src/i18n/index.test.ts` must stay green (it enforces the
two locales' key parity).

## 🧩 Data and configuration

| Key | Value | Meaning |
| --- | --- | --- |
| `SECRET_SHOP.fromMap` | `3` | the first floor that may hang the leaf |
| `SECRET_SHOP.chance` | `0.2` | chance a floor hangs it, on `${seed}:map:<floor>:secret-shop-room` |
| `SECRET_SHOP.held` | `leftovers`, `lifeorb`, `choiceband`, `focussash` | the counter's held rows, in order, one unit each at 4000 |
| `SECRET_SHOP.tm` | `tmItemId(88)`, `tmItemId(114)` (Swords Dance, Shadow Ball) | the machines beside them, one unit each at 3000 |
| `secretShopSealId(m, r)` | `secret-shop-<m>-<r>` | the seal's `pickedItems` mark; `advanceMap` clears it |

Determinism: the leaf's parent and presence read the **minted**
`${seed}:map:<floor>:secret-shop-room` stream only; the seal's obstacle kind is the
shipped `gateKindFor(seed, routeIndex)` (the carve's own `${seed}:gate:<routeIndex>`
stream) and its site the carve's `…:site` stream; the stock reads no stream at all.
No shipped draw moves. A pinned seed that **gains** the leaf is a deliberate re-pin:
change the expectation and say so in the test's comment.

### The curve's own re-walk (the leaf's room-count fallout)

A floor that hangs the leaf holds **one room more**, and `routeIndexForRoom` sums the
previous floors' room counts, so every later floor's rooms build from a shifted route
index and place a trainer more or less. `src/engine/run/curve.test.ts` measures that
walk (`MEASURED_FILL`) and holds two rules: every floor's fill stays inside
`[1.05, 1.5]`, and it reads the pinned column to two decimals.

- Re-measure the column with the harness the test already has. Re-pin `MEASURED_FILL`
  to the new column and add the "re-pinned by Task-97 with the secret-shop leaf"
  paragraph to its doc comment and to `docs/balance/route-curve.md`, in the shipped
  tone (`Task-92`'s and `Task-96`'s paragraphs are the model).
- If — and only if — a floor's new fill lands **outside** `[1.05, 1.5]`, re-solve **that
  floor's** row of `TRAINER_XP_PER_MAP` with the documented recipe
  `factor' = round2(factor × 1.25 / fill)`, re-measure, and let the column and the doc
  show the result. Any floor already inside the window keeps its factor: a broad
  re-solve is a balance task, not this room's.
- `docs/balance/route-curve.md`'s per-map `fill` column is **not** rewritten (it is
  `0.75 × T̄(m) × A(m) / needed(m)` and reads no route index); the new paragraph states
  which factor moved, from what to what, and that the rest are untouched.

## 🧪 Test and Validation Plan (for QA)

QA runs this verbatim. A criterion that cannot be executed by someone who has not read
the rest of the spec is not a criterion.

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-97` audit against the exclusive paths list.
  - The `[live]` criteria need the dev server + the machine's headless Chromium over
    CDP; the protocol is written out at the end of this section, and the seed it needs
    is pinned by the dev (see **Coordination**).
  - A clean worktree cannot boot until the gitignored packed audio exists
    (`npm run assets:pack` from `$ASSETS_ROOT`, or the store's own build); if it is
    absent, placeholder WAVs under the gitignored `src/assets/audio/` are enough for
    this pass and are removed afterwards. Portrait and tile art may fall back to
    placeholders: no `[live]` criterion below reads it.

- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` is clean (`tsc --noEmit && vite build`).
  - [ ] `[unit]` `npm test` is green, including every test below.
  - [ ] `[unit]` `git diff --name-only main...task-97` lists only the exclusive paths
        above (plus `.agent_specs/task-97.md`).
  - [ ] `[unit]` `src/engine/routes/secretShop.test.ts` covers: `secretShopSealId` =
        `secret-shop-<m>-<r>`; `secretShopStock()` is six rows in table order, each
        `price === getItem(id)!.price` and `count === 1`, the four held ids have
        `kind === 'held'`, the two machine ids satisfy `isTmItemId`, and no id is
        missing from the catalogue; `secretShopGateOpen` is `true` for a run whose party
        holds a member of one of the row's types and `false` for a party that holds none
        (build the run with `createRun`/`createRunPokemon`), for all three
        `GateKind`s.
  - [ ] `[unit]` `src/engine/routes/secretShop.test.ts` pins `SECRET_SHOP_QA` (see
        **Coordination**) and re-derives every field of it from
        `specialRoom(planMap(seed, mapIndex), 'secret-shop')` plus the room's own
        `sketchRoute` (same request `buildRoute` builds: seed, `routeIndexForRoom`,
        the room's biome, `openings`, width/height, `role`, `quiet: true`,
        `gate: 'sealed'`), so `roomId`, `obstacle`, `mouth`, `pocket` and `direction`
        cannot rot.
  - [ ] `[unit]` `src/data/shop.test.ts` covers `SECRET_SHOP`: `fromMap === 3`,
        `0 < chance < 1`, every id in the catalogue, no id twice in the table, every
        `held` row `kind === 'held'` (a consumed held item such as the Focus Sash is
        allowed: the Mart sells it too), every `tm` row `isTmItemId`, and none of them
        a Mega Stone, a G-Max Stone or a `valuable`.
  - [ ] `[unit]` `src/engine/maps/plan.test.ts` covers: no `secret-shop` leaf on map 1
        or 2 for 100 seeds; the leaf's frequency over 100 seeds on map 5 lies in
        `[0.10, 0.35]`; a floor never holds two (the existing
        `toBeLessThanOrEqual(1)` block gains its row); the leaf is a dead-end with one
        link and is never farther from the entry than the boss; `planMap` stays
        deterministic; and `SHIPPED_SPECIALS` (the pinned table) **does not move** —
        add `'secret-shop'` to that test's "not a shipped draw" filter list, exactly
        as `'casino'`, `'gated'`, `'trade'`, `'no-heal'` and `'static'` already are.
  - [ ] `[unit]` `src/scenes/rooms/secretShop.test.ts` covers, with the shipped fake
        host pattern (`src/scenes/rooms/staticSpecies.test.ts`): the fixture is `null`
        without a `gate` and `{ counter: pocket }` with one; the seal's refusal prints
        `gateLockedNotice(kind)` and commits nothing; its opening marks
        `secretShopSealId`, asks for `rebuildRoom` and prints `gateOpenedNotice`; the
        counter calls `openMart` with six slots and the `mart.secretTitle` title (mock
        `./shop`); a second press while `panelOpen()` does not reopen it; and
        `drawMarker` paints `0x14b8a6` then `0x10161f` (a fake graphics recording
        `fillStyle`).
  - [ ] `[unit]` `src/scenes/rooms/registry.test.ts` lists `'secret-shop'` in
        `SHIPPED_KINDS` (so the folder has eight descriptors and each kind owns its
        marker).
  - [ ] `[unit]` `src/engine/run/curve.test.ts` is green: every floor's fill lies in
        `[1.05, 1.5]`, every floor reads its re-pinned `MEASURED_FILL` to two decimals,
        and each `TRAINER_XP_PER_MAP` row is a positive two-decimal factor. Read the
        test's own new paragraph: it must name Task-97, the new column and the factor —
        if any — that moved, and `docs/balance/route-curve.md` must carry the same
        paragraph. A factor moved for a floor whose fill already sat inside the window
        is a defect.
  - [ ] `[live]` **The seal holds until the party qualifies, then opens for good.**
        Protocol steps 1-6 below. Measurement, all from the dev overlay's
        `#debug-location` text (`map <m> · room <r>/<n> · (x,y)`): with no party member
        of the obstacle's type, stepping into the seal leaves the player's tile
        **equal** to the pinned `mouth`, twice; after adding one member of the pinned
        `obstacle`'s type and pressing `E` while facing it, one step moves the player
        onto the seal tile — the text equals `(mouth + direction)`. The pocket itself is
        **not** walked onto: the counter fixture blocks its tile exactly as the trade
        room's does, so a further step stays on the seal tile.
  - [ ] `[live]` **The counter opens the Mart card with the secret stock.** Protocol
        step 7: from the tile in front of the counter (the seal tile, `mouth +
        direction`), facing the pocket. Method: with the panel closed, read the canvas
        patch `(620..660, 132..142)` (the card is the shipped 640×540
        `addFloatingPanel`, centred in the 1280×800 viewport, so its top edge is
        y=130); press `E`; read the same patch again.
        **Measurement — a blend equality against the shipped chrome, not a rise.** The
        card's field is `src/assets/ui/window.png`'s own pixel, **`(16, 22, 31)`**, drawn
        at `FRLG_WINDOW_ALPHA` **0.72** over what is behind it
        (`src/data/ui/chrome.json`), so the open patch must equal
        `0.72 × (16, 22, 31) + 0.28 × closed` on every channel, within **±6**; and the
        closed patch must sit **more than 20** away from that value on at least one
        channel, so the change is real. This bound is derived from the asset and the
        alpha constant alone — it was corrected from an earlier "+40 rise" wording after
        that wording's premise (a light field) was measured false. State the closed
        triple, the predicted triple and the measured open triple. Prefer
        `renderer.snapshotArea` + `getImageData`; `Page.captureScreenshot` + a crop of
        the same patch is acceptable — say which was used.
  - [ ] `[live]` **The BUY tab lists six rows.** Protocol step 7, same open card.
        Measurement: the card's list window starts at `content.y + 68` and each row is
        44 px tall inside `640 - 2*20` px of width; the six shipped rows must all paint
        their name text inside the list, so the seventh row's band
        (`listY + 12 + 6*44` .. `+44`) stays the list window's own field with **no**
        row highlight and no icon. Verify by reading the row-icon column
        (x ≈ cardLeft + 20 + 26) at the centre of each of the first six rows: each
        pixel differs from its own row's field, and the seventh row's centre equals the
        sixth's field colour. If the alpha blend makes that equality unusable, report
        the six measured colours and their pairwise difference instead — that is the
        measurement, and it is objective either way.

- **`[live]` protocol** (no human; CDP over the machine's headless Chromium):
  1. In the integration worktree: `npm run dev -- --port 5173` (Vite dev mode, so
     `IS_DEVELOP` installs the debug overlay). Launch the machine's Chromium with
     `--headless=new --remote-debugging-port=9222 --window-size=1280,800` and open
     `http://localhost:5173`.
  2. Main menu → play → the starter screen. Press `S`: the DOM seed prompt
     (`#seed-prompt`) opens. Set its text input to `SECRET_SHOP_QA.seed` (read the
     literal out of `src/engine/routes/secretShop.test.ts`), confirm, then pick any
     starter.
  3. In the debug overlay (`#debug-menu`): floor field `3`, click its Go; read
     `#debug-location` → `map 3 · room <r>/<n>`. Then set the room field to
     `SECRET_SHOP_QA.roomId` and click its Go; `#debug-location` must read
     `room <roomId>/…`.
  4. Set the tile fields to `mouth.x`, `mouth.y` and click the tile Go;
     `#debug-location` must read `(mouth.x,mouth.y)`.
  5. Dispatch one keydown of `SECRET_SHOP_QA.direction` → the tile text is unchanged
     (the seal is solid). Press `E` (nothing to open yet: the party holds no member of
     the type). Dispatch the direction key again → still `(mouth.x,mouth.y)`.
  6. In the overlay's add-Pokémon row, add one species of the pinned `obstacle`'s type
     (`bush` → `caterpie`, `rock` → `geodude`, `water` → `magikarp`) and confirm it
     landed in the party list. Repeat the direction key (sets the facing, still
     blocked), dispatch `E`, then the direction key twice: `#debug-location` must walk
     `mouth` → the seal tile (`mouth + direction`) → the tile one step past it. The
     counter sits on the **pocket** and blocks it, so the player never stands there.
  7. Now stand on the seal tile (one step in from `mouth`) facing `direction`, so the
     pocket — the counter — is the faced tile. Capture the closed-panel patch, dispatch
     `E` and capture the open-panel patch; run the two measurements of the last two
     criteria. Then close the card with its ✕ and confirm the route answers a direction
     key again (the card is floating, so this only proves the ✕ tears it down).

## 📣 Coordination

- **For QA (mandatory):** `src/engine/routes/secretShop.test.ts` must export, as plain
  literals with a comment saying QA's `[live]` protocol reads them:

  ```ts
  export const SECRET_SHOP_QA = {
    seed: '<a seed whose map 3 hangs the leaf>',
    mapIndex: 3,
    roomId: <the leaf's room id>,
    obstacle: 'bush' | 'rock' | 'water',
    mouth: { x: <int>, y: <int> },
    pocket: { x: <int>, y: <int> },
    direction: 'N' | 'E' | 'S' | 'W',
  } as const;
  ```

  Find them by running the leaf search over candidate seeds
  (`secret-shop-qa`, `secret-shop-qa-2`, …) until
  `specialRoom(planMap(seed, 3), 'secret-shop')` answers a room, then building that
  room's route exactly as `RouteScene.buildRoute` does and reading `route.gate`
  (`kind`, `tile`, `pocket`); `mouth` is the walkable tile the seal faces, `direction`
  the cardinal from `mouth` to the seal. Pin the literals and keep the test that
  re-derives them. The QA protocol walks `mouth` → the seal tile; the pocket is the
  counter and blocks its own tile, so no step lands on it.
- **For the next batch:** `MapRoomSpecial` now has eight kinds; the plan's special pass
  ends with two minted rolls (static, then secret shop). The Mart card's
  `openMart(host, stock?)` is the seam a second counter should reuse; no other task
  may edit `src/scenes/rooms/shop.ts` without reading that signature. The formula floor
  curve was re-walked: `src/engine/run/curve.test.ts`'s `MEASURED_FILL` and
  `docs/balance/route-curve.md` carry the new column, so a later room leaf must re-walk
  it again rather than trust the old one.
- **For the Architect:** the leaf ships at **20 %** from map 3, stock fixed at six
  rows (four held + two TMs) from the catalogue; the run-field chain and `SAVE_VERSION`
  are untouched. The leaf's extra room shifts `routeIndexForRoom` on the floors after
  it, so this task also re-walks the floor curve (`curve.test.ts` + `route-curve.md`)
  and re-solves only a factor that left the `[1.05, 1.5]` window.

## ⛔ Out of scope

- The Mart's own four-row stock, its band rolls, the merchant NPC and
  `src/ui/shop.ts`. The TM catalogue's content. `src/data/items.ts`'s prices.
- A second counter beyond this room; a "secret" second tab; a discount or a
  per-floor stock roll.
- Any `SAVE_VERSION` step (this leaf stores nothing but a `pickedItems` mark).
- Any change to `src/ui/mapView.ts`, the minimap geometry or the HUD.
- The vault carve itself (`src/engine/routes/gate.ts`): reuse it, do not extend it.
