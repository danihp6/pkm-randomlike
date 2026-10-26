# Spec: Task-178 — A held berry costs what a held item costs, and a bought shop row leaves the shelf

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** data (prices) + shop model + two room/panel scenes (+ docs).
- **Role:** Dev.
- **Objective:** two coupled fixes in the Mart.
  1. **Price.** «el precio de las bayas equipables deberia ser mas alto ya que … no se
     consumen». A `kind: 'held'` item the engine **never spends** is a permanent held
     slot, so it costs the held tier: the rule freezes as **a `kind: 'held'` item
     without `consumed: true` costs at least 1000**. The **eleven** catalogue entries
     that break it today are exactly `NOOP_BERRY_ITEMS` (`src/data/items.ts`, the
     berry-class no-ops, all at 200) and they move to **1000**. Every **consumed**
     berry keeps its 100-200 (Sitrus 200, Oran 100, Lum 200, the cures, the pinch and
     the resist berries), because it is spent.
  2. **Shelf.** «al comprar 1 objeto en la tienda … deberia desaparecer de las
     opciones de compra». `buyItem` adds the units and records nothing, so the row
     returns on the next open of either card. After this task a purchase **marks the
     row per floor** in the shipped `pickedItems`, and `buyRows` drops every marked
     row — the 10× pack and the potion rung as much as a held row.
- **Environment:** worktree `../wt-pkm-178`, branch `task-178`.
- **Dependencies:** none.

### Exclusive paths (single writer)

- `src/data/items.ts` (this batch's **only** claim on that file)
- `src/data/items.test.ts`
- `src/ui/shop.ts`
- `src/ui/shop.test.ts`
- `src/scenes/rooms/shop.ts`
- `src/scenes/panels/shop.ts`
- `docs/balance/economy.md` (this batch's **only** claim on that file)
- `docs/maps-spec.md` — **§7 only, and inside it only the `### The economy (Poké
  Dollars)` Mart-stock bullets** (the "The **shop** always stocks the same **four
  rows** …" bullet and, when the price rule needs it, one new bullet beside it). `§7`
  is shared with another task in this batch that owns the `### A room's battle
  condition` **`endure`** block: do not touch it, do not reflow the section.

Nothing else. **No `SAVE_VERSION` step**: `pickedItems` is already saved and
`advanceMap` already clears it per floor (`src/scenes/RouteScene.ts`, the
`pickedItems: []` of the run the new map starts with), so a new floor gets its own
shelf and no run field is added. Do not touch `src/engine/save.ts` or
`src/engine/run/state.ts`.

### Inputs (read-only)

- `AGENTS.md`, `docs/maps-spec.md` (§7), `docs/balance/economy.md`,
  `src/engine/run/state.ts` (`markItemPicked`, `isItemPicked`, `addItem`,
  `spendMoney`), `src/engine/run/items.ts`, `src/data/shop.ts` (`SHOP_ROTATION`,
  `SHOP_CORE`, `buildShop`), `src/data/items.ts` (`ItemDef`, `consumed`),
  `src/ui/hud/panels/shop/**` (the DOM card's view model), `src/scenes/rooms/shop.ts`
  and `src/scenes/panels/shop.ts` around every `buyRows`/`buyItem` call.

## 🔒 Contract

### TypeScript

`src/ui/shop.ts`:

```ts
/** The `pickedItems` key a bought shop row marks: one row, one floor. */
export function shopRowKey(mapIndex: number, itemId: string): string; // `shop-${mapIndex}-${itemId}`

/** Buys one row's units when the run can afford it; the purchase marks the row on its floor. */
export function buyItem(run: RunState, slot: ShopSlot, mapIndex: number = run.mapIndex): ShopTrade;

/** The buy rows still on the shelf: every stock row whose key the run has not marked. */
export function buyRows(run: RunState, stock: readonly ShopSlot[], mapIndex: number = run.mapIndex): readonly ShopRow[];
```

- `buyItem` keeps its two refusals (not enough money → `{ run, ok: false, amount: 0 }`)
  and, on success, returns `markItemPicked(addItem(spendMoney(run, slot.price), slot.itemId, slot.count), shopRowKey(mapIndex, slot.itemId))`
  so the money, the units and the mark are one run state.
- `buyRows` filters the stock by `isItemPicked(run, shopRowKey(mapIndex, slot.itemId))`
  **before** mapping to rows, so the row's index and the drawn list agree and a
  purchase on the open card removes the row on the next `refresh*`.
- `sellRows`, `sellItem`, `sellPriceOf`, `sellableStacks` and `buildShop` are
  **unchanged**: selling never marks anything.
- Both scenes pass the run's own floor: `host.run.mapIndex` (default parameter keeps
  every shipped call site compiling, but pass it explicitly at each call so the
  intent reads in the code: `src/scenes/rooms/shop.ts` at the card's rows, the row
  press and the desktop list; `src/scenes/panels/shop.ts` at the view model and the
  buy press).

`src/data/items.ts`: the eleven rows of `NOOP_BERRY_ITEMS` change `price: 200` →
`price: 1000`. Nothing else in the catalogue moves.

### Data

- The invariant the test pins: **no `item.kind === 'held'` entry without
  `consumed: true` is priced under 1000**. Verified before this task: exactly the
  eleven no-op berries violate it; every other berry the Mart sells is
  `consumed: true` and stays at 100-200.
- The mark's shape is a **string key in `RunState.pickedItems`**, `shop-<mapIndex>-<itemId>`
  (one unit of state that already ships and already resets per floor). No new field.
- **Do not** add the eleven to `SHOP_ROTATION` or to the Mart's shelves: the rotation
  already excludes `UNMODELLED_ITEMS` and this task reprices, it does not restock. The
  docs must say what is true — a shelf price is not claimed to have changed for an id
  that no band sells.

## 🧩 Data and configuration

| Key | Before | After |
| --- | --- | --- |
| `NOOP_BERRY_ITEMS[*].price` (eleven ids: custap, enigma, jaboca, kee, lansat, leppa, maranga, persim, rowap, starf, tamato) | 200 | **1000** |
| `pickedItems` entry `shop-<mapIndex>-<itemId>` | — | written by a successful `buyItem`, read by `buyRows` |

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-178` against the exclusive paths above.
  - One browser pass (`npm run dev` + CDP) for the single `[live]` criterion.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `items.test.ts`: no `kind: 'held'` item without `consumed: true`
        costs under **1000** (the eleven no-op berries are named, all at 1000), and a
        sample of the consumed berries still costs 100-200.
  - [ ] `[unit]` `shop.test.ts`: a purchase **marks** its row (`pickedItems` contains
        `shopRowKey(mapIndex, itemId)`), the same floor's next `buyRows` **drops** it
        and its row count falls by one, and the rows before it keep their order.
  - [ ] `[unit]` `shop.test.ts`: a **second floor** keeps its own shelf — after a
        purchase on floor 2, `buyRows(run, stock, 3)` still lists every row.
  - [ ] `[unit]` `shop.test.ts`: the 10× pack drops **whole** (one purchase, one
        mark, no row) and the potion rung does the same; a refused purchase (no
        money) marks nothing and the row stays.
  - [ ] `[unit]` `shop.test.ts`: `sellRows`/`sellItem` are unaffected by marks (a
        marked item still sells from the bag side).
  - [ ] `[unit]` Nothing outside the exclusive paths was touched; no
        `SAVE_VERSION` step and no new `RunState` field.
  - [ ] `[live]` **Buy the 10× pack, close and reopen the Mart, and the row is
        gone.** Measurement: `npm run dev` with `?hud=dom`; walk into the floor's
        merchant on a run with money (the debug overlay's bag/general tabs can hand
        money and a bag), read the BUY list's rows from `[data-hud-shop-row]` — one of
        them names the pack (`10x <ball>`); press it once, close the card
        (`[data-hud-shop="close"]`), reopen the merchant, and read the rows again: the
        pack's row is **absent** (the row count fell by exactly one and no row's text
        names `10x`), while the other rows still list in the same order. Walk to the
        next floor's merchant and the pack is back (the mark was per floor). Evidence:
        the two row lists read over CDP; state which method produced each reading.

## 📣 Coordination

- For the Architect: the shelf is now stateful per floor through `pickedItems`; a
  future restock rule would be its own task and its own key space.
- For the next batch: `buyRows`/`buyItem` take an optional `mapIndex` (defaulting to
  `run.mapIndex`); `shopRowKey` is exported.

## ⛔ Out of scope

- The stock's composition, `SHOP_ROTATION`, `SHOP_CORE`, the pack's discount, the
  TM row, the G-Max stone row and the secret shop's own counter.
- Any new run field, any `SAVE_VERSION` step, any save migration.
- The casino's spin prices and the trainer award.
