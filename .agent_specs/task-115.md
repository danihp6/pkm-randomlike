# Spec: Task-115 — The casino's equipable row is one grouped row

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** data + pure model (no scene).
- **Role:** Dev.
- **Objective:** the slot machine's **fixed held item** becomes **one grouped row**
  that draws from the floor band's own `SHOP_ROTATION` shelf, so a newly banded
  equipable reaches the machine the day the Mart bands it, with no second balance
  table. `early` and `low`, which carry no equipable row today, gain the grouped
  row and fall back to the first band above that has one (`mid`). The draw lives
  **inside the spin's own stream** as its **last** `rng.int`, so no other stream in
  the game moves; the table's measured probabilities and recovery are the ones
  below, and the two bands over break-even (`low`, `mid`) are diluted before
  shipping.
- **Environment:** worktree `../wt-pkm-115`, branch `task-115`.
- **Dependencies (already merged on `main`):** `src/data/casino.ts` (the shipped
  `CASINO` table, Task-64), `src/ui/casino.ts` (`casinoSpin`, `casinoSpinId`,
  `casinoLockId`, `hatchEgg`), `src/data/shop.ts` (`SHOP_ROTATION`, `ShopEntry`),
  `src/data/items.ts` (`getItem`, `Item.consumed`),
  `src/engine/battle/effects/items.ts` (`UNMODELLED_ITEMS`) and
  `src/data/run.ts` (`LEVEL_BANDS`, `BandId`) — all shipped.

### Exclusive paths (single writer)

The list of paths this task creates or modifies. **Nothing outside this list.**
No other task in the batch may claim the same path.

- `src/data/casino.ts`
- `src/data/casino.test.ts`
- `src/ui/casino.ts`
- `src/ui/casino.test.ts`
- `src/data/README.md` — only the `casino.ts` row.
- `src/ui/README.md` — only the `casino.ts` row.
- `docs/maps-spec.md` — **only** §7's special-room table **casino row** and §7's
  `### The casino (the slot machine)` subsection (its prize bullets and its
  probability sentence). No other section, no other table.
- `docs/balance/economy.md` — only a new `## The casino's spin` section appended
  after `## Between-route rewards`.

Do **not** touch `src/scenes/rooms/casino.ts` (the window, Task-116's), any
`src/scenes/RouteScene.ts`, `src/data/shop.ts` (`SHOP_ROTATION` is read, never
edited), `src/data/items.ts`, `src/i18n/**`, `package.json` or `src/data/dex/**`.

### Inputs (read-only)

- `src/data/casino.ts`, `src/ui/casino.ts`, `src/data/shop.ts`, `src/data/items.ts`,
  `src/data/run.ts`, `src/engine/rng.ts`, `src/engine/battle/effects/items.ts`
- `src/scenes/rooms/casino.ts` (to confirm it only reads `CasinoOutcome`)
- `docs/maps-spec.md` §7, `docs/balance/economy.md`, `docs/data-spec.md`
- `src/data/README.md`, `src/ui/README.md`

## 🔒 Contract

### TypeScript

```ts
// src/data/casino.ts
export type CasinoPrize = Readonly<{
  kind: 'item' | 'held' | 'egg';
  /** The catalogue id; required for `kind: 'item'`, absent for `'held'` and `'egg'`. */
  itemId?: string;
  /** The row's weight in the band's weighted pick; `> 0`. */
  weight: number;
}>;
```

```ts
// src/ui/casino.ts
/**
 * The band's equipable pool: `SHOP_ROTATION[band]` in **table order**, filtered to
 * ids the catalogue holds, `getItem(id)?.consumed !== true` and ids
 * `UNMODELLED_ITEMS` does not list, deduplicated preserving order. A band whose
 * list is empty falls back to the **first band above** it that has one
 * (`LEVEL_BANDS` order); `[]` only when no band above has one.
 */
export function casinoHeldPool(band: BandId): readonly string[];
```

- **`CasinoOutcome` does not change.** A grouped row resolves to
  `{ kind: 'item'; itemId }` **before** `casinoSpin` returns, so every reader (the
  window, the tests) sees one paid item id.
- `casinoSpin` keeps its signature, its refusal rules (`locked`, `no-money`), its
  price spend and its floor mark. The grouped draw is the **last** `rng.int` on the
  spin's own stream `Rng(hashSeed(`${seed}:casino:${mapIndex}:${index}`))`, taken
  **only** after the weighted pick landed on a `'held'` row; every other outcome
  draws exactly what it drew before.
- `drawPrize`'s usability filter accepts all three kinds: a row is usable when its
  weight is `> 0` and (`'egg'` or `'held'` or a non-empty `itemId`).
- **No `CasinoOutcome`, `CasinoSpin`, `hatchEgg` signature change**, no new module,
  no Phaser import in `src/ui/casino.ts` (it stays a pure model).

### Data — the shipped `CASINO.prizes` tables

The fixed equipable row of `mid`, `high`, `late` and `end` becomes one
`{ kind: 'held', weight: 1 }` row in the same position; `early` and `low` gain it
before the Egg. `low` and `mid` are **diluted** as measured; the other four keep
their first-measured weights.

| band | rows (id × weight) | total | grouped share |
| --- | --- | --- | --- |
| `early` | potion 4, pokeball 4, oranberry 2, held 1, egg 1 | 12 | ≈ 7.1 % |
| `low` | superpotion 4, greatball 4, oranberry 2, nugget 1, held 1, egg 1 | 13 | ≈ 6.5 % |
| `mid` | hyperpotion 3, greatball 3, held 1, nugget 1, egg 1 | 9 | ≈ 9.4 % |
| `high` | hyperpotion 2, ultraball 2, held 1, nugget 1, egg 1 | 7 | ≈ 12.1 % |
| `late` | fullrestore 2, ultraball 2, held 1, nugget 2, egg 1 | 8 | ≈ 10.6 % |
| `end` | fullrestore 2, ultraball 2, held 1, nugget 2, egg 1 | 8 | ≈ 10.6 % |

`CASINO.price` and `CASINO.battleChance` do **not** move. The removed fixed ids
(`charcoal`, `expertbelt`, `lifeorb`, `leftovers`) still reach the machine through
`casinoHeldPool`.

## 🧩 Data and configuration

- Expected recovery per spin (resale plus the grunt's 15 % purse over the price):
  early **63 %**, low **≈ 90 %** after dilution, mid **≈ 91 %** after dilution,
  high **75 %**, late **88 %**, end **71 %**. The numbers are the ones to write in
  `docs/balance/economy.md`, not new balance.
- **Fixed-seed re-pin is this task's own:** `src/ui/casino.test.ts`'s `pkm-64` map
  5 pins read `nugget → ultraball → fullrestore → lifeorb → egg`; the fourth spin is
  now the grouped draw. Re-pin it to the id the stream actually pays (run the suite,
  read the actual, record it in the file's comment the way the file already pins its
  sequence) and say so in your report. Spins 1–3, the fifth (Egg), the reload rule
  and `pkm-111`'s sequence must be re-measured; pin whatever they now read and state
  which, if any, moved.
- No run field, no `SAVE_VERSION` step, no RNG draw outside the spin's own stream.

## 🧪 Test and Validation Plan (for QA)

QA runs this verbatim. A criterion that cannot be executed by someone who has not
read the rest of the spec is not a criterion.

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task
    adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-115` audit against the exclusive paths list.
  - **This task is all-`[unit]`**: it changes no layout and no drawn string, so it
    owes **no** browser pass — say so in the QA report.

- **Acceptance criteria:**

  - [ ] `[unit]` Every band of `CASINO.prizes` has exactly **one** `'held'` row
    with no `itemId`, exactly one `'egg'` row, the other rows exactly as the table
    above (ids and weights), every weight `> 0`, and the totals 12 / 13 / 9 / 7 / 8 /
    8 in `LEVEL_BANDS` order.
  - [ ] `[unit]` `casinoHeldPool('early')` and `casinoHeldPool('low')` each equal
    `casinoHeldPool('mid')` exactly (the fallback), and that list is
    `charcoal, mysticwater, widelens, muscleband, wiseglasses, ironball,
    laggingtail` in `SHOP_ROTATION.mid` table order.
  - [ ] `[unit]` `casinoHeldPool` for every `BandId` is non-empty, has no
    duplicates, and every id is a catalogue item that is not consumed and is not in
    `UNMODELLED_ITEMS`; the list is a subsequence of that band's
    `SHOP_ROTATION` order (bow to the fallback for `early`/`low`).
  - [ ] `[unit]` The grouped row's absolute chance is
    `0.85 × 1 / total` per band (assert ≈ 0.071 / 0.065 / 0.094 / 0.121 / 0.106 /
    0.106 within 0.001), and the `'egg'` and other rows keep their share where the
    table above keeps it.
  - [ ] `[unit]` A spin whose weighted pick lands on the grouped row pays exactly
    one member of `casinoHeldPool(band)` as `{ kind: 'item', itemId }`, spends the
    price, writes the spin mark and takes **one** extra draw after the pick; the
    same `RunState` spun twice returns the same outcome (purity).
  - [ ] `[unit]` The fixed-seed pins are re-measured and green: `pkm-64` map 5's
    five spins, its reload reproduction, `pkm-111`'s sequence, and the shipped
    battle/lock/refusal cases still hold.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.

## 📣 Coordination

- For the Architect: the machine no longer names an equipable id in `CASINO`;
  `src/scenes/rooms/casino.ts` (Task-116) can keep reading `CasinoOutcome` unchanged,
  and Task-117's rocket row changes none of this.
- For the next batch: `casinoHeldPool` is the one place a band's equipables are
  filtered; a new banded equipable needs only `SHOP_ROTATION`.

## ⛔ Out of scope

- The slot machine's window, reels or animation (Task-116).
- The rocket's placement, the room's retirement (Task-117).
- The Mart's own stock and `SHOP_ROTATION` itself.
- `CASINO.price`, `CASINO.battleChance`, the grunt battle and the Egg's hatch.
