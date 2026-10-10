import { buyPrice, getItem, isForSale, sellPrice } from '../data/items';
import type { BandId } from '../data/run';
import { SHOP_CORE, SHOP_ROTATION, SHOP_ROTATION_COUNT, type ShopEntry } from '../data/shop';
import type { Rng } from '../engine/rng';
import {
  addItem,
  addMoney,
  consumeItem,
  itemCount,
  spendMoney,
  type BagCounts,
  type RunState,
} from '../engine/run';

/**
 * The **shop model** (`docs/maps-spec.md` §7, D33): what a floor's Mart stocks and
 * the pure trades against a run. It is Phaser-free, so the scene only renders the
 * rows this module builds and the economy is unit-tested headless. The stock is a
 * pure function of `(bandId, rng)`, so a fixed run always opens the same Mart.
 */

/** One thing the shop sells: an item and what a single unit costs. */
export type ShopSlot = Readonly<{ itemId: string; price: number }>;

/**
 * The stock a shop shows: the band's fixed core of Balls/Potions plus one or two
 * rotating items drawn (weighted, without replacement) from the band's pool,
 * never repeating a core id. Deterministic for a fixed `rng`.
 */
export function buildShop(bandId: BandId, rng: Rng): readonly ShopSlot[] {
  const ids = [...SHOP_CORE[bandId]];
  const pool = SHOP_ROTATION[bandId].filter((entry) => !ids.includes(entry.itemId));
  const count = rng.int(SHOP_ROTATION_COUNT.min, SHOP_ROTATION_COUNT.max);
  const remaining = [...pool];
  for (let picked = 0; picked < count && remaining.length > 0; picked++) {
    const index = weightedIndex(remaining, rng);
    ids.push(remaining[index].itemId);
    remaining.splice(index, 1);
  }
  return ids.flatMap((id) => {
    const item = getItem(id);
    return item ? [{ itemId: id, price: buyPrice(item) }] : [];
  });
}

/** A weighted pick from a pool: the item whose cumulative weight covers the roll. */
function weightedIndex(pool: readonly ShopEntry[], rng: Rng): number {
  const total = pool.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (total <= 0) return 0;
  let roll = rng.int(0, total - 1);
  for (let i = 0; i < pool.length; i++) {
    roll -= Math.max(0, pool[i].weight);
    if (roll < 0) return i;
  }
  return pool.length - 1;
}

/** A shop trade: the run afterwards, whether it happened, and the money moved. */
export type ShopTrade = Readonly<{ run: RunState; ok: boolean; amount: number }>;

/** Buys one unit of `slot` when the run can afford it; otherwise a no-op. */
export function buyItem(run: RunState, slot: ShopSlot): ShopTrade {
  if (run.money < slot.price) return { run, ok: false, amount: 0 };
  return { run: addItem(spendMoney(run, slot.price), slot.itemId), ok: true, amount: slot.price };
}

/** The bag stacks the shop will buy: any catalogue stack worth real money, in bag order. */
export function sellableStacks(run: RunState): readonly BagCounts[] {
  return run.bag.filter((stack) => {
    const item = getItem(stack.itemId);
    return stack.count > 0 && item !== undefined && isForSale(item) && sellPrice(item) > 0;
  });
}

/** Sells one unit of `itemId` at its `sellPrice`; a stack the shop will not buy is a no-op. */
export function sellItem(run: RunState, itemId: string): ShopTrade {
  if (itemCount(run, itemId) <= 0) return { run, ok: false, amount: 0 };
  const item = getItem(itemId);
  if (!item || !isForSale(item)) return { run, ok: false, amount: 0 };
  const gain = sellPrice(item);
  if (gain <= 0) return { run, ok: false, amount: 0 };
  return { run: addMoney(consumeItem(run, itemId), gain), ok: true, amount: gain };
}

/** A rendered shop row: the item, the price the mode shows, its name and owned count. */
export type ShopRow = Readonly<{
  itemId: string;
  name: string;
  price: number;
  owned: number;
  /** True when a **buy** row is affordable; always true for a sell row. */
  affordable: boolean;
}>;

const toRow = (run: RunState, slot: ShopSlot): ShopRow => {
  const item = getItem(slot.itemId);
  return {
    itemId: slot.itemId,
    name: item?.name ?? slot.itemId,
    price: slot.price,
    owned: itemCount(run, slot.itemId),
    affordable: run.money >= slot.price,
  };
};

/** The buy rows for a stock, resolving names, prices and what the run already holds. */
export function buyRows(run: RunState, stock: readonly ShopSlot[]): readonly ShopRow[] {
  return stock.map((slot) => toRow(run, slot));
}

/** The sell rows: every sellable stack at its `sellPrice`, in bag order. */
export function sellRows(run: RunState): readonly ShopRow[] {
  return sellableStacks(run).map((stack) => ({
    ...toRow(run, { itemId: stack.itemId, price: sellPriceOf(stack.itemId) }),
    // A sale is always available: the price is what the shop pays, not a cost.
    affordable: true,
  }));
}

/** The Poké Dollars one unit of an item sells for (`0` when the shop will not buy it). */
export function sellPriceOf(itemId: string): number {
  const item = getItem(itemId);
  return item && isForSale(item) ? sellPrice(item) : 0;
}
