# Spec: Task-177 — Natural Gift's power follows its berry, not only its type

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule (pure) + UI model (+ docs).
- **Role:** Dev.
- **Objective:** the move **`naturalgift`** (*Don Natural*) already takes its **type**
  from the holder's berry on every surface, but its **power** only changes inside the
  battle: `effectiveMoveType` reads the berry's dex `naturalGift.type`
  (`src/engine/battle/moveType.ts`), and the engine's own item handler rewrites both
  type and `basePower` (`naturalGiftHandlers`, `src/engine/battle/effects/items.ts`).
  The party panel builds its row from the dex alone
  (`moveDetails`, `src/ui/partyDetail.ts`: `basePower = move?.basePower ?? 0`), so the
  MOVES tab prints Natural Gift's dex **0** for a berry it has already retyped. After
  this task a berry holder's Natural Gift row reads the berry's power on the panel
  too, and the panel and the engine are provably the same rule.
- **Environment:** worktree `../wt-pkm-177`, branch `task-177`.
- **Dependencies:** none.

### Exclusive paths (single writer)

- `src/engine/battle/movePower.ts` (new)
- `src/engine/battle/movePower.test.ts` (new)
- `src/ui/partyDetail.ts` (this batch's **only** claim on that file)
- `src/ui/partyDetail.test.ts`
- `src/engine/README.md` — **only the `battle/` role line** (the bullet that lists
  `battle/fighter.ts`, `battle/state.ts`, … `battle/ai.ts`): append
  `battle/movePower.ts` in that list's own order, no other line of the file.
- `docs/battle-spec.md` — **§4 only, and inside it only the
  `- **Item-driven retypes**: …` bullet** (the one that ends "…spends the berry once
  the move has resolved (`src/engine/battle/effects/items.ts`)"). `§4` is shared with
  another task in this batch that owns the **`- **Endure**: …`** bullet: do not touch
  it, do not reflow the section, do not edit any other section.

Nothing else. No `src/data/dex/**`, no data table, no scene, no i18n table, no
`package.json`.

### Inputs (read-only)

- `AGENTS.md`, `docs/battle-spec.md` (§4), `docs/data-spec.md`,
  `src/engine/battle/moveType.ts` (the rule this one mirrors), `moveType.test.ts`
  (the shape of the agreement test), `effects/items.ts` (`naturalGiftHandlers`,
  `UNMODELLED_ITEMS`, `runModifyMove`), `effects/registry.ts` (`makeContext`,
  `runModifyMove`), `src/data/items.ts` (`NOOP_BERRY_ITEMS`, the berries),
  `src/data/dex/items.ts` (`getDexItem(...).naturalGift`),
  `src/ui/hud/panels/detail/**` (who reads `MoveDetail.power`/`basePower`).

## 🔒 Contract

### TypeScript

New pure module `src/engine/battle/movePower.ts`, mirroring `moveType.ts`'s shape
and export style (no Phaser, no DOM, no RNG):

```ts
import type { Move, Stats } from '../../data/dex';

/**
 * The power a move is used at once the holder's items are applied: exactly the
 * held-item rows `effectiveMoveType` reads for the type, read for the number.
 */
export function effectiveMovePower(
  itemId: string | null | undefined,
  move: Move,
  ivs?: Partial<Stats> | null,
): number;
```

- `naturalgift` held by a berry whose dex row carries `naturalGift` →
  `getDexItem(itemId)!.naturalGift.basePower`.
- `naturalgift` with no item, an item with no `naturalGift` pair, or an id in
  `UNMODELLED_ITEMS` (the engine skips its handlers, so the type does not change
  either) → the move's own dex `basePower` (today `0`).
- Any other move id → its dex `basePower` (an ability that changes power is not this
  task; `ivs` is accepted so the signature can grow the way `effectiveMoveType` did,
  and it is unused today — do not add a Hidden Power power rule).
- Plate / Memory / Drive retype but do not change power, so they answer the dex
  number: the type and the power stay two functions reading one item table.

`src/ui/partyDetail.ts` — `moveDetails` calls it for the number it prints:

```ts
const basePower = move ? effectiveMovePower(heldItem, move, ivs) : 0;
```

`power` and `basePower` both take that value (they are the same number on this
panel today); the **type** keeps coming from `effectiveMoveType`. Nothing else in
the function moves: the same `accuracy`, `pp`, `desc`, `status` and the same row
order.

### Data

No new key. The eleven hand-authored berries the engine never spends
(`NOOP_BERRY_ITEMS`, `src/data/items.ts`) are in `UNMODELLED_ITEMS`, so their
Natural Gift keeps the dex power in **both** functions — the agreement test must
assert that, not the opposite.

## 🧩 Data and configuration

Nothing new; the numbers come from `getDexItem(id).naturalGift.basePower`
(`sitrusberry` → `80`, `oranberry` → `80`, and so on) which the dex already ships.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-177` against the exclusive paths above.
  - One browser pass (`npm run dev` + CDP) for the single `[live]` criterion.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `movePower.test.ts`: `effectiveMovePower('sitrusberry', naturalgift)`
        answers the berry's dex power (**80**), and `null`/`charcoal` answer the dex
        value (**0**).
  - [ ] `[unit]` `movePower.test.ts`: an id from `NOOP_BERRY_ITEMS` (e.g.
        `custapberry`) answers the dex value, because `UNMODELLED_ITEMS` skips it.
  - [ ] `[unit]` `movePower.test.ts`: every other move keeps its dex `basePower` for
        a berry holder and for no item (a sample of several ids, including a
        variable-power move such as `flail`).
  - [ ] `[unit]` The **agreement test**: for `naturalgift` with each of the eleven
        hand-authored berries and with the real berries the dex carries (at least
        `sitrusberry`, `oranberry`, `lumberry`, `cheriberry`) and with no item,
        `runModifyMove(ctx, naturalgift).basePower` (`src/engine/battle/effects/registry`)
        equals `effectiveMovePower(itemId, naturalgift)` — one rule, two readers.
  - [ ] `[unit]` `partyDetail.test.ts`: the detail's `naturalgift` row carries the
        berry's power (`80` for `sitrusberry`) while the **type** stays the berry's
        (`Psychic`), and the row reads the dex `0` with no berry equipped.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched, and
        `src/engine/README.md` gained only its `battle/movePower.ts` entry.
  - [ ] `[live]` **The MOVES tab prints the berry's power.** Measurement: `npm run
        dev` with `?hud=dom`; give a party member a `sitrusberry` (route bag → equip,
        or the debug overlay's bag tab) and that member `naturalgift` in its four
        slots (debug party tab, or the learnset band); open the party panel's
        **MOVES** tab and read the power text inside
        `[data-hud-detail-slot="<n>"]` for the Natural Gift row — it must equal the
        berry's dex `naturalGift.basePower` (**80**), and the same row's type badge
        must still be the berry's type (`Psychic`); unequip the berry (bag → take it
        off) and re-read: the power is the dex **0** and the type returns to
        `Normal`. Evidence: the two strings read over CDP. Canvas cross-check: the
        same row's power digits read from `renderer.snapshotArea` + `getImageData`
        of the detail card's row rect, before and after. State which method produced
        each reading.

## 📣 Coordination

- For the Architect: the panel now has one function per number and one per type; a
  future item-driven power (Thick Club, Light Ball) extends `movePower.ts` alone.
- For the next batch: `effectiveMovePower(itemId, move, ivs)` is exported from
  `src/engine/battle/movePower.ts`; `effectiveMoveType` is unchanged.

## ⛔ Out of scope

- The engine's `onModifyMove` / `naturalGiftHandlers` (it stays the in-battle
  authority), the berry being spent, and `UNMODELLED_ITEMS`.
- Ability-driven power changes, Hidden Power's power, Thick Club, Light Ball, and
  the damage preview (`src/engine/battle/preview.ts`).
- Any i18n string: the berry's and the move's names already ship.
