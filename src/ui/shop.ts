import { buyPrice, getItem, isForSale, sellPrice } from '../data/items';
import type { BandId } from '../data/run';
import {
  SHOP_BALL_PACK,
  SHOP_HELD_ROWS,
  SHOP_POTION,
  SHOP_ROTATION,
  SHOP_TM,
  type ShopEntry,
} from '../data/shop';
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

/**
 * One thing the shop sells: an item, what one purchase costs and how many units
 * that purchase adds. Every stock row but the pack buys a single unit.
 */
export type ShopSlot = Readonly<{ itemId: string; price: number; count: number }>;

/** The catalogue price of an id; `0` for an id the catalogue does not hold. */
const priceOf = (itemId: string): number => {
  const item = getItem(itemId);
  return item ? buyPrice(item) : 0;
};

/**
 * The shelf a shop shows: the band's **four fixed stock rows** — its ball pack,
 * its potion rung and `SHOP_HELD_ROWS` distinct held items — and then the band's
 * one machine off `SHOP_TM`, appended last when it is not already on the shelf.
 * Deterministic for a fixed `rng`.
 *
 * The draw order is frozen: one `weightedIndex` per held row over that band's held
 * pool, **without replacement**, then one `rng.int` for the machine. Every row but
 * the pack takes the catalogue price; the pack carries its own discounted `price`
 * of ten units at half the catalogue sum.
 */
export function buildShop(bandId: BandId, rng: Rng): readonly ShopSlot[] {
  const pack = SHOP_BALL_PACK[bandId];
  const potion = SHOP_POTION[bandId];
  const stock: ShopSlot[] = [
    { itemId: pack.itemId, price: pack.price, count: pack.count },
    { itemId: potion, price: priceOf(potion), count: 1 },
  ];
  const pool = [...SHOP_ROTATION[bandId]];
  for (let picked = 0; picked < SHOP_HELD_ROWS && pool.length > 0; picked++) {
    const index = weightedIndex(pool, rng);
    const id = pool[index].itemId;
    stock.push({ itemId: id, price: priceOf(id), count: 1 });
    pool.splice(index, 1);
  }
  const machines = SHOP_TM[bandId];
  if (machines.length > 0) {
    const machine = machines[rng.int(0, machines.length - 1)];
    if (!stock.some((slot) => slot.itemId === machine)) {
      stock.push({ itemId: machine, price: priceOf(machine), count: 1 });
    }
  }
  return stock.filter((slot) => getItem(slot.itemId) !== undefined);
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

/** Buys one row's units when the run can afford it; otherwise a no-op. */
export function buyItem(run: RunState, slot: ShopSlot): ShopTrade {
  if (run.money < slot.price) return { run, ok: false, amount: 0 };
  const paid = spendMoney(run, slot.price);
  return { run: addItem(paid, slot.itemId, slot.count), ok: true, amount: slot.price };
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
  /** Units one purchase adds; `1` for everything but the pack. */
  count: number;
  owned: number;
  /** True when a **buy** row is affordable; always true for a sell row. */
  affordable: boolean;
}>;

/** A row's label: a multi-unit row says how many units one purchase adds. */
const rowName = (name: string, count: number): string => (count > 1 ? `${count}x ${name}` : name);

const toRow = (run: RunState, slot: ShopSlot): ShopRow => {
  const item = getItem(slot.itemId);
  return {
    itemId: slot.itemId,
    name: item ? rowName(item.name, slot.count) : slot.itemId,
    price: slot.price,
    count: slot.count,
    owned: itemCount(run, slot.itemId),
    affordable: run.money >= slot.price,
  };
};

/** The buy rows for a stock, resolving names, prices and what the run already holds. */
export function buyRows(run: RunState, stock: readonly ShopSlot[]): readonly ShopRow[] {
  return stock.map((slot) => toRow(run, slot));
}

/** The sell rows: every sellable stack at its `sellPrice`, one unit at a time, in bag order. */
export function sellRows(run: RunState): readonly ShopRow[] {
  return sellableStacks(run).map((stack) => ({
    ...toRow(run, { itemId: stack.itemId, price: sellPriceOf(stack.itemId), count: 1 }),
    // A sale is always available: the price is what the shop pays, not a cost.
    affordable: true,
  }));
}

/** The Poké Dollars one unit of an item sells for (`0` when the shop will not buy it). */
export function sellPriceOf(itemId: string): number {
  const item = getItem(itemId);
  return item && isForSale(item) ? sellPrice(item) : 0;
}
