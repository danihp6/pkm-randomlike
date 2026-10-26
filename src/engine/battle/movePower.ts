import { getDexItem, type Move, type Stats } from '../../data/dex';
import { getItem } from '../../data/items';
import { UNMODELLED_ITEMS } from './effects/items';

/**
 * The power a move is used at once the holder's items are applied, as one pure
 * rule the battle engine and the party panel both read — the number's twin of
 * `effectiveMoveType` (`src/engine/battle/moveType.ts`). The battle applies it
 * through the held item's own `onModifyMove` (`effects/items.ts`); the panel reads
 * this function, so a berry holder's MOVES row prints the power the fight uses.
 *
 *  - **Natural Gift** is used at its berry's power: the held item's dex
 *    `naturalGift.basePower` (`D37`), the same row the move's type comes from;
 *  - no item, an item with no `naturalGift` pair, or an id in `UNMODELLED_ITEMS`
 *    (the engine skips those handlers, so the type does not change either) answer
 *    the move's own dex `basePower` (today `0` for Natural Gift);
 *  - a **Plate**, **Memory** or **Drive** retypes its move but never changes its
 *    power, so it answers the dex number: the type and the power are two functions
 *    reading one item table;
 *  - any other move answers its dex `basePower`: an ability that changes power is
 *    not this rule.
 *
 * `ivs` is accepted so the signature can grow the way `effectiveMoveType` did; no
 * shipped item or ability reads it, and Hidden Power's power is not modelled.
 */
export function effectiveMovePower(
  itemId: string | null | undefined,
  move: Move,
  ivs?: Partial<Stats> | null,
): number {
  void ivs;
  if (move.id !== 'naturalgift') return move.basePower;
  const item = itemId ? getItem(itemId) : undefined;
  if (!item || UNMODELLED_ITEMS.includes(item.id)) return move.basePower;
  return getDexItem(item.id)?.naturalGift?.basePower ?? move.basePower;
}
