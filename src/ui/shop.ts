import { GMAX_STONE_IDS, buyPrice, getItem, isForSale, sellPrice } from '../data/items';
import { bandForLevel, type BandId, type LevelBand } from '../data/run';
import {
  SHOP_BALL_INFINITE,
  SHOP_BALL_PACK,
  SHOP_GMAX_STONE_BANDS,
  SHOP_HELD_ROWS,
  SHOP_POTION,
  SHOP_ROTATION,
  SHOP_TM,
  type ShopEntry,
} from '../data/shop';
import { bandForNode } from '../engine/run/levelCurve';
import { nodeOf, planRegion } from '../engine/region/plan';
import type { Rng } from '../engine/rng';
import {
  addItem,
  addMoney,
  consumeItem,
  isItemPicked,
  itemCount,
  markItemPicked,
  spendMoney,
  type BagCounts,
  type RunState,
} from '../engine/run';

/**
 * The **shop model** (`docs/maps-spec.md` §7, `docs/region-spec.md` §6, D33): what a
 * counter stocks and the pure trades against a run. It is Phaser-free, so the scene
 * only renders the rows this module builds and the economy is unit-tested headless.
 * The stock is a pure function of `(bandId, rng)`, so a fixed run always opens the
 * same shelf. A bought row is marked per **node** in `pickedItems` and leaves that
 * node's shelf for good — except the endless ball row (`SHOP_BALL_INFINITE`), which
 * is never marked and stays on the shelf; selling marks nothing, so the bag side is
 * unchanged.
 */

/**
 * One thing the shop sells: an item, what one purchase costs and how many units
 * that purchase adds. Every stock row but the pack buys a single unit.
 */
export type ShopSlot = Readonly<{
  itemId: string;
  price: number;
  count: number;
  /** True for a row that never sells out. Absent means false. */
  infinite?: boolean;
}>;

/** The catalogue price of an id; `0` for an id the catalogue does not hold. */
const priceOf = (itemId: string): number => {
  const item = getItem(itemId);
  return item ? buyPrice(item) : 0;
};

/**
 * The shelf a shop shows: the band's **four fixed stock rows** — its ball pack,
 * its potion rung and `SHOP_HELD_ROWS` distinct held items — then the band's
 * one machine off `SHOP_TM` and, from `late` on, its **G-Max Stone** row (`D44`),
 * each appended last when it is not already on the shelf.
 * Deterministic for a fixed `rng`.
 *
 * The draw order is frozen: one `weightedIndex` per held row over that band's held
 * pool, **without replacement**, then one `rng.int` for the machine, then one for
 * the stone at the bands `SHOP_GMAX_STONE_BANDS` names. Every row but the pack
 * takes the catalogue price; the pack carries its own discounted `price` of ten
 * units at half the catalogue sum, and the endless flag the shelf's first row
 * inherits from `SHOP_BALL_INFINITE` (set, never drawn, so the draws do not move).
 */
export function buildShop(bandId: BandId, rng: Rng): readonly ShopSlot[] {
  const pack = SHOP_BALL_PACK[bandId];
  const potion = SHOP_POTION[bandId];
  const stock: ShopSlot[] = [
    {
      itemId: pack.itemId,
      price: pack.price,
      count: pack.count,
      infinite: SHOP_BALL_INFINITE,
    },
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
  if (SHOP_GMAX_STONE_BANDS.includes(bandId) && GMAX_STONE_IDS.length > 0) {
    const stone = GMAX_STONE_IDS[rng.int(0, GMAX_STONE_IDS.length - 1)];
    if (!stock.some((slot) => slot.itemId === stone)) {
      stock.push({ itemId: stone, price: priceOf(stone), count: 1 });
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

/**
 * The `pickedItems` key a bought shop row marks: **one row, one node**. The shelf is
 * a node's own thing — a city's Centre keeps the shelf it opened with — and
 * `shopRowKey('city:3', 'potion')` is `shop-city:3-potion`.
 */
export function shopRowKey(nodeKey: string, itemId: string): string {
  return `shop-${nodeKey}-${itemId}`;
}

/**
 * The level band a node's shelf reads (`bandForNode`), the region's own anchor
 * (`docs/region-spec.md` §3). A key the plan does not hold falls back to the band the
 * run's compatibility cap reads, so a hand-built or retired key still stocks a shelf.
 */
function bandOfKey(nodeKey: string, seed: string, levelCap: number): LevelBand {
  const node = nodeOf(planRegion(seed), nodeKey);
  return node === undefined ? bandForLevel(levelCap) : bandForNode(node);
}

/** True when the slot carries the endless flag. */
export function isInfiniteSlot(slot: ShopSlot): boolean {
  return slot.infinite === true;
}

/**
 * True when this slot never sells out: its own flag, or — for a caller that rebuilt
 * the slot from a rendered row's `(itemId, price, count)` and dropped the optional
 * flag, as the shop card does — the node's band's ball pack while `SHOP_BALL_INFINITE`
 * holds.
 */
function endlessSlot(slot: ShopSlot, band: BandId): boolean {
  if (isInfiniteSlot(slot)) return true;
  return SHOP_BALL_INFINITE && SHOP_BALL_PACK[band].itemId === slot.itemId;
}

/**
 * Buys one row's units when the run can afford it, and marks the row on its node so
 * `buyRows` stops listing it. An endless row (`isInfiniteSlot`) spends the money and
 * adds the units but writes no mark, so it stays on the shelf. A row the run cannot
 * pay for is a no-op that marks nothing: a refused purchase leaves the shelf as it was.
 */
export function buyItem(run: RunState, slot: ShopSlot, nodeKey: string = run.nodeKey): ShopTrade {
  if (run.money < slot.price) return { run, ok: false, amount: 0 };
  const band = bandOfKey(nodeKey, run.seed, run.levelCap).id;
  const bought = addItem(spendMoney(run, slot.price), slot.itemId, slot.count);
  return {
    run: endlessSlot(slot, band) ? bought : markItemPicked(bought, shopRowKey(nodeKey, slot.itemId)),
    ok: true,
    amount: slot.price,
  };
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
  /** True only for a BUY row the run can afford; a sell row is never draggable. */
  draggable: boolean;
  /**
   * Carried through from the slot: true for the endless ball row. `buyRows` always
   * sets it; a hand-built view row (the HUD fixtures) may leave it off.
   */
  infinite?: boolean;
}>;

/** A row's label: a multi-unit row says how many units one purchase adds. */
const rowName = (name: string, count: number): string => (count > 1 ? `${count}x ${name}` : name);

const toRow = (run: RunState, slot: ShopSlot, infinite: boolean): ShopRow => {
  const item = getItem(slot.itemId);
  const affordable = run.money >= slot.price;
  return {
    itemId: slot.itemId,
    name: item ? rowName(item.name, slot.count) : slot.itemId,
    price: slot.price,
    count: slot.count,
    owned: itemCount(run, slot.itemId),
    affordable,
    draggable: affordable,
    infinite,
  };
};

/**
 * The buy rows still on the shelf: the stock without the rows this **node** has
 * already sold, filtered **before** the rows are built so a row's index is the drawn
 * index and a purchase removes its own row on the next repaint. An endless row is
 * never dropped. Order is the stock's own.
 */
export function buyRows(
  run: RunState,
  stock: readonly ShopSlot[],
  nodeKey: string = run.nodeKey,
): readonly ShopRow[] {
  const band = bandOfKey(nodeKey, run.seed, run.levelCap).id;
  return stock
    .filter((slot) => endlessSlot(slot, band) || !isItemPicked(run, shopRowKey(nodeKey, slot.itemId)))
    .map((slot) => toRow(run, slot, endlessSlot(slot, band)));
}

/** The sell rows: every sellable stack at its `sellPrice`, one unit at a time, in bag order. */
export function sellRows(run: RunState): readonly ShopRow[] {
  return sellableStacks(run).map((stack) => ({
    ...toRow(run, { itemId: stack.itemId, price: sellPriceOf(stack.itemId), count: 1 }, false),
    // A sale is always available: the price is what the shop pays, not a cost.
    affordable: true,
    // Selling stays a click: a row is only a drag source on the BUY tab.
    draggable: false,
  }));
}

/** The Poké Dollars one unit of an item sells for (`0` when the shop will not buy it). */
export function sellPriceOf(itemId: string): number {
  const item = getItem(itemId);
  return item && isForSale(item) ? sellPrice(item) : 0;
}
