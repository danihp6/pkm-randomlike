# Spec: Task-92 — The merchant replaces the shop room

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule + data + Phaser scene.
- **Role:** Dev.
- **Objective:** the `'shop'` special room kind is gone — `planMap` hangs no
  guaranteed shop leaf, the minimap has no shop marker and no shop descriptor
  exists. The **Mart survives as content**: it becomes the window a **merchant**
  special NPC opens, and the run still gets exactly **one merchant per floor from
  map 2 on**, placed in the floor's **first `trainers` room** (lowest room id with
  `role: 'trainers'`), never rolled, never twice. Map 1 stays merchant-free.
- **Environment:** worktree `../wt-pkm-92`, branch `task-92`.
- **Dependencies (already merged on `main`):**
  - the special-NPC framework: `src/data/npcs.ts` (`NPC_ROWS` empty),
    `src/engine/routes/npcs.ts` (`roomNpc`, `npcSpot`, `npcUseId`,
    `effectiveNpcChance`, `npcRequirementMet`) and `src/ui/npcPanel.ts`
    (`openNpcPanel`) — Batch 37's Task-91;
  - the room registry and the Mart: `src/scenes/rooms/registry.ts`,
    `src/scenes/rooms/shop.ts` (its floating Mart window), `src/ui/shop.ts`
    (`buildShop`, `buyRows`, `buyItem`, `sellRows`, `sellItem`) — shipped;
  - the population roles and `TRAINER_ROOMS_PER_MAP`: `src/engine/maps/plan.ts`
    (`MapRoom.role`, `roleOf`) — shipped (Task-82);
  - the packed NPC sprite sheet (`NPC_SPRITE_KEYS` includes `'merchant'`),
    `src/data/overworldSprites.ts` — shipped (Task-90).

### Exclusive paths (single writer)

The list of paths this task creates or modifies. **Nothing outside this list.**
No other task in the batch may claim the same path. Deleting a stray `.gitkeep`
from a directory this task populates is always allowed.

- `src/engine/maps/plan.ts`
- `src/engine/maps/plan.test.ts`
- `src/data/npcs.ts`
- `src/data/npcs.test.ts`
- `src/engine/routes/npcs.ts`
- `src/engine/routes/npcs.test.ts`
- `src/scenes/RouteScene.ts`
- `src/scenes/rooms/shop.ts`
- `src/scenes/rooms/registry.test.ts`
- `src/scenes/rooms/README.md`
- `src/ui/mapView.test.ts`
- `src/i18n/en.ts`
- `src/i18n/es.ts`
- `docs/maps-spec.md` — **only** the header blockquote (the two lines that name the
  guaranteed shop), §7's special-room table `shop` row and the paragraph under the
  table that describes it, §7's `### The special NPC` section (the `NPC_ROWS` ships
  empty closing line and the bullet that lists a merchant as an example), §7's
  `A room's battle condition` line that lists `shop` among the quiet leaves, and
  §10's resolved record that repeats the shop-from-map-2 guarantee. No other
  section, no other table.
- `docs/design-spec.md` — **only** §7's `shop` bullet and §7's special-NPC bullet.
  No other section.

Do **not** modify `src/ui/mapView.ts` (its `MapRoomMarker` alias narrows by itself
when `MapRoomSpecial` loses `'shop'`), `src/scenes/BootScene.ts` (the counter
texture stays loaded; it is no longer referenced), `src/scenes/rooms/types.ts`,
`src/scenes/rooms/casino.ts`, `src/scenes/rooms/trade.ts` (the generic `counter`
seam keeps serving them) or `src/ui/shop.ts`.

### Inputs (read-only)

Files this task may read, and only these, beyond `AGENTS.md` and your spec.

- `src/engine/maps/plan.ts`, `src/engine/maps/progress.ts`, `src/engine/maps/index.ts`
- `src/engine/routes/npcs.ts`, `src/engine/run/party.ts`
- `src/data/npcs.ts`, `src/data/overworldSprites.ts`, `src/ui/mapView.ts`
- `src/scenes/rooms/{registry.ts,types.ts,shop.ts,casino.ts,trade.ts}`
- `src/scenes/RouteScene.ts`, `src/ui/{npcPanel.ts,shop.ts,floatingPanel.ts}`
- `src/i18n/{en.ts,es.ts,index.ts}`, `src/data/keybinds.ts`
- `docs/{maps-spec.md,design-spec.md,routes-spec.md}`, `docs/agent-ci.md`

## 🔒 Contract

The public surface another task will be written against. It is a promise, not a
suggestion. Write the exact exported names and signatures.

### TypeScript

```ts
// src/engine/maps/plan.ts
/** The special leaf kinds a floor can hang. The shop room is gone. */
export type MapRoomSpecial =
  | 'mini-boss'
  | 'mega-stone'
  | 'casino'
  | 'gated'
  | 'trade'
  | 'no-heal';

/**
 * The floor's first population room: the lowest room id whose `role` is
 * `'trainers'`. `-1` when the plan holds none (never happens on a shipped floor,
 * whose topology floor is six rooms and whose `TRAINER_ROOMS_PER_MAP` is 2+).
 */
export function firstTrainerRoom(plan: MapPlan): number;

// Removed outright: `SHOP_FROM_MAP`, `hangsShop` and the whole guaranteed-shop
// branch of `planMap`'s special pass.
```

```ts
// src/data/npcs.ts
export type NpcRow = Readonly<{
  id: string;
  nameKey: TranslationKey;
  greetingKey: TranslationKey;
  spriteKey: string;
  chance: number;
  floorStep: number;
  /**
   * When present, the floor places this row **itself** (no roll) in its first
   * `trainers` room as soon as `mapIndex >= guaranteedFromMap`. The row's
   * `chance` is `0` beside it, so the roll never picks it.
   */
  guaranteedFromMap?: number;
  requires?: NpcRequirement;
  choices?: readonly NpcChoice[];
}>;

export const NPC_ROWS: readonly NpcRow[];
export function getNpcRow(id: string): NpcRow | undefined;
```

`NPC_ROWS` now carries **exactly one row**, the merchant:

```ts
{
  id: 'merchant',
  nameKey: 'npc.merchant.name',
  greetingKey: 'npc.merchant.greeting',
  spriteKey: 'merchant',
  chance: 0,
  floorStep: 0,
  guaranteedFromMap: 2,
  choices: [{ id: 'mart', label: 'npc.merchant.trade' }],
}
```

```ts
// src/engine/routes/npcs.ts
/**
 * The floor's guaranteed NPC for `roomIndex`, or null: the first row, in table
 * order, whose `guaranteedFromMap` is defined and `<= mapIndex`, when
 * `roomIndex === firstTrainerRoom(plan)`. Reads **no RNG** and no run state, so
 * the placement cannot move any other stream.
 */
export function guaranteedNpc(
  plan: MapPlan,
  roomIndex: number,
  mapIndex: number,
  rows?: readonly NpcRow[],
): NpcRow | null;
```

- **`roomNpc` keeps its exact signature** `(seed, roomIndex, mapIndex, rows?)` and
  its stream `Rng(hashSeed(`${seed}:npc:${roomIndex}`))`. It must now **exclude
  every row whose effective chance is 0** from the pick (and from the total), so a
  zero-chance row can never be returned. This is numerically a no-op for the rows
  it could already return; the presence roll and the two draws do not move.
- `effectiveNpcChance`, `npcRequirementMet`, `npcSpot`, `npcUseId` are unchanged.
- **Determinism:** `guaranteedNpc` reads no RNG; `roomNpc` keeps its one presence
  draw plus one weighted pick on the same stream.

### Phaser scene (`src/scenes/RouteScene.ts`)

- `private rollRoomNpc()` tries the guarantee first and the roll second:

  ```ts
  const guaranteed = guaranteedNpc(this.plan!, room.roomId, room.mapIndex);
  const placement = guaranteed
    ? { row: guaranteed, roomIndex: room.roomId }
    : roomNpc(this.run.seed, room.roomId, room.mapIndex, eligible);
  ```

  Everything after it (`npcSpot`, the sprite-frame check, the assignment) is
  unchanged. A guaranteed row whose spot is null or whose frame is missing is
  dropped whole, exactly like a rolled one — no second room, no fallback.
- `openNpcCard` passes the chosen row's **id** to
  `chooseNpc(row, mapIndex, roomId, choiceId)`; `chooseNpc` resolves the effect:
  - `row.id === 'merchant'` → **not** a use: close the card (`this.closePanel()`)
    and open the Mart (`openMart(this.roomHost())`), so the merchant can be
    visited again for the rest of the floor. It never writes an `npcUseId` mark.
  - every other row → the shipped behaviour: mark
    `npcUseId(mapIndex, roomId, row.id)` through `markItemPicked`, then close.
  Keep this as one explicit `switch (row.id)` (or an if/else chain) that later NPC
  tasks extend — no dynamic dispatch module.

### The Mart module (`src/scenes/rooms/shop.ts`)

- **Drop the `descriptor` export** (the registry collects only modules that export
  an object with a string `kind`, so the file stays in the folder and is skipped).
- Export exactly one new function:

  ```ts
  /** Opens the floating Mart for `host`, at the floor's band and stock. */
  export function openMart(host: RoomHost): void;
  ```

  It keeps the module's whole existing behaviour: the per-`(seed, mapIndex)` stock
  key, `buildShop`, the BUY/SELL tabs, the drag rows, the SELL click, the close ✕
  and `host.openPanel(PANEL)`.
- Delete the descriptor-only code and its imports: `fixture`, `interact`,
  `drawFixture`, `drawMarker`, `SHOP_COUNTER_TEXTURE_KEY`, `TILE_SIZE`, the
  `centerX`/`centerY` helpers, `MapRoomSpecial`/`RoomDescriptor` types. The Mart
  no longer refuses to open outside a shop room — there is no such room.
- Keep the module **Phaser-side** (it already imports `Phaser`); it owns no rule
  beyond the shipped `src/ui/shop.ts` model.

### Data

- `src/data/npcs.ts`: the optional `guaranteedFromMap?: number` field and the one
  merchant row above.
- `src/i18n/en.ts` / `src/i18n/es.ts`: three keys, in the table's own style, in
  **both** locales —

  | key | en | es |
  | --- | --- | --- |
  | `npc.merchant.name` | `MERCHANT` | `MERCADER` |
  | `npc.merchant.greeting` | `A merchant with a full pack. Pick what you carry.` | `Un mercader con la mochila llena. Elige que te llevas.` |
  | `npc.merchant.trade` | `TRADE` | `COMERCIAR` |

  No em dash and no character the FRLG font cannot draw (`src/i18n/index.test.ts`
  enforces both).

## 🧩 Data and configuration

- The guarantee is a **placement, not a roll**: `guaranteedFromMap: 2` on the row,
  `firstTrainerRoom(plan)` in the engine, and the scene asks the roll only for the
  trainer rooms after that first one. **Map 1 is merchant-free** (`mapIndex >= 2`).
- A floor cannot lack a `trainers` room: `TRAINER_ROOMS_PER_MAP` is
  `2,2,3,3,3,4,4,4` and the topology floor is six rooms.
- **No run field and no `SAVE_VERSION` step**: the guarantee reads the plan; the
  merchant writes no save fact.
- **Fixed-seed re-pin is this task's own:** deleting the guaranteed shop leaf
  removes two `rng.int` size draws before the mini-boss/mega-stone/casino/gated/
  trade/no-heal rolls, so every fixed-seed floor from map 2 on moves. Re-pin
  `src/engine/maps/plan.test.ts`'s `SHIPPED_FLOORS` digests deliberately, run the
  suite until it is green, and say so in your report. The columns every floor keeps
  are the ones the tests already assert (`TRAINER_ROOMS_PER_MAP` still holds,
  exactly one boss, one boss room farthest from the entry, the six shipped room
  shapes, and the other specials still capped at one each).

## 🧪 Test and Validation Plan (for QA)

QA runs this verbatim. A criterion that cannot be executed by someone who has not
read the rest of the spec is not a criterion.

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task
    adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-92` audit against the exclusive paths list.
  - One `[live]` pass on the dev server, per the recipe below.

- **Acceptance criteria:**

  - [ ] `[unit]` `firstTrainerRoom` returns the lowest id whose `role` is
    `'trainers'` on fixed seeds and every map 1..8, and `-1` for a plan whose rooms
    are all `'wild'` (build the tiny plan literal in the test). `planMap(seed, n)`
    holds `TRAINER_ROOMS_PER_MAP[n-1]` rooms with `role: 'trainers'` for every
    fixed seed the file already uses.
  - [ ] `[unit]` No floor of any fixed seed 1..8 holds a room or special with
    `special === 'shop'`; `planMap` still hangs at most one of each other special
    and never on the entry or the boss.
  - [ ] `[unit]` `guaranteedNpc(planMap(seed, 2), firstTrainerRoom(plan), 2)` is the
    merchant row on every fixed seed; on map 1 it is `null`; on any room other than
    the first trainers room it is `null`; and `guaranteedNpc` called twice returns
    the same row (no RNG).
  - [ ] `[unit]` `roomNpc` never returns the merchant row (chance 0) for the
    shipped `NPC_ROWS`, and two calls on the same `(seed, roomIndex, mapIndex)`
    return the same placement.
  - [ ] `[unit]` The merchant row is one of `NPC_SPRITE_KEYS`, its `nameKey`,
    `greetingKey` and every choice label exist in `en` and in `es`, its `chance` is
    `0` and its `guaranteedFromMap` is `2`.
  - [ ] `[unit]` The three i18n keys render through `t()` in both locales and trip
    neither the missing-key throw nor the FRLG-font/em-dash guards in
    `src/i18n/index.test.ts`.
  - [ ] `[unit]` `src/scenes/rooms/registry.test.ts` collects the shipped folder
    with no `'shop'` kind, still one descriptor per shipped kind
    (`mini-boss`, `mega-stone`, `casino`, `gated`, `trade`, `no-heal`), and still
    rejects two modules claiming one kind.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` In the running game the merchant is placed where the plan says and
    opens the Mart. Recipe, on the dev server, over CDP (`Runtime.evaluate`,
    `awaitPromise: true`), after starting a run and reaching a route:
    1. `const { game } = await import('/src/main.ts'); const route = game.scene.getScene('Route');`
    2. `route.teleportToFloor(2)` → `{ ok: true }`, then
       `const plan = route.plan; const id = (await import('/src/engine/maps/plan.ts')).firstTrainerRoom(plan);`
       and require `id >= 0`.
    3. `route.teleportToRoom(id)` → wait for the room to build, then require
       `route.npc && route.npc.row.id === 'merchant'` and that `route.npc.tile`
       equals a walkable tile of the room (the tile is on `route.route`).
    4. Require `route.roomRegistry.byKind.has('shop') === false` and
       `!plan.rooms.some((r) => r.special === 'shop')`.
    5. Dispatch the interact key (`E`, `Input.dispatchKeyEvent` keyDown+keyUp), then
       `E` again to confirm the merchant's first choice; require
       `route.panelOpen() === true` and that the scene's display list holds a
       `BitmapText` whose text starts with `¥` (the Mart's money row) — read with
       `route.children.getAll(true)` (recursive). Report the state values you read.
    The measurement is a set of equalities against the repo's own functions and the
    live scene state, not a screenshot judgement.

## 📣 Coordination

- For the Architect: the shop **room** is retired; the Mart lives behind the
  merchant NPC. `SHOP_FROM_MAP` / `hangsShop` no longer exist, so any later task
  that wants a shop row in the plan must be re-planned.
- For the next batch: `NPC_ROWS` is no longer empty — Tasks 93–95 add their rows
  beside the merchant's. `guaranteedNpc` is the seam the floor guarantee uses; a
  later zero-chance row (Task-117's rocket) is never rolled by `roomNpc`.
- The Mart module is `src/scenes/rooms/shop.ts` and exports `openMart(host)`; the
  registry skips it because it has no `descriptor`.

## ⛔ Out of scope

- The Mart's stock, prices, tabs or drag rules (`src/ui/shop.ts`, shipped).
- Any other NPC's row or effect (Tasks 93–95).
- The counter seam (`RoomFixture.counter`, `RoomHost.counterTile`,
  `farthestRoomTile`) — the casino and trade rooms use it.
- `src/scenes/BootScene.ts` and the now-unreferenced counter texture.
- Any `SAVE_VERSION` change: this task adds no run field.
