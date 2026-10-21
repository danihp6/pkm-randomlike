import { GATES, type GateKind } from '../../data/gates';
import { buyPrice, getItem } from '../../data/items';
import { SECRET_SHOP } from '../../data/shop';
import { partyHasType } from '../run/party';
import type { RunState } from '../run/state';

/**
 * The **secret shop** (`docs/maps-spec.md` §7): a dead-end leaf whose route carves
 * the shipped one-tile vault behind one obstacle, and whose far side holds a counter
 * with the late-band gear the Mart withholds. The seal opens for a party member of
 * the obstacle's own type — the same rule the gated leaf asks, read through the same
 * predicate — and the shelf is a fixed data list, so the room draws nothing.
 */

/** One counter row: an item, its catalogue price and how many units one purchase adds. */
export type SecretShopSlot = Readonly<{ itemId: string; price: number; count: number }>;

/**
 * The seal's stable opening mark in `pickedItems`: `secret-shop-<mapIndex>-<roomId>`.
 * `advanceMap` clears `pickedItems`, so the opening lasts the floor.
 */
export function secretShopSealId(mapIndex: number, roomId: number): string {
  return `secret-shop-${mapIndex}-${roomId}`;
}

/** True when some party member holds one of the obstacle's own types. */
export function secretShopGateOpen(run: RunState, kind: GateKind): boolean {
  return partyHasType(run, GATES[kind].types);
}

/** The counter's rows: `SECRET_SHOP.held` then `SECRET_SHOP.tm`, catalogue price, one unit. */
export function secretShopStock(): readonly SecretShopSlot[] {
  const rows: SecretShopSlot[] = [];
  for (const itemId of [...SECRET_SHOP.held, ...SECRET_SHOP.tm]) {
    const item = getItem(itemId);
    if (!item) continue;
    rows.push({ itemId, price: buyPrice(item), count: 1 });
  }
  return rows;
}
