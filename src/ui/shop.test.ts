import { describe, expect, it } from 'vitest';
import { GMAX_STONE_IDS, buyPrice, getItem } from '../data/items';
import type { BandId } from '../data/run';
import { LEVEL_BANDS } from '../data/run';
import {
  SHOP_BALL_INFINITE,
  SHOP_BALL_PACK,
  SHOP_GMAX_STONE_BANDS,
  SHOP_HELD_ROWS,
  SHOP_POTION,
  SHOP_ROTATION,
  SHOP_TM,
} from '../data/shop';
import { isTmItemId } from '../data/tms';
import { addItem, addMoney, createRun, createRunPokemon, itemCount } from '../engine/run';
import { Rng, hashSeed } from '../engine/rng';
import {
  buildShop,
  buyItem,
  buyRows,
  isInfiniteSlot,
  sellItem,
  sellPriceOf,
  sellRows,
  sellableStacks,
  shopRowKey,
  type ShopSlot,
} from './shop';

const starter = createRunPokemon({
  id: 'starter',
  speciesId: 'charmander',
  level: 5,
  moves: ['scratch'],
});

/** The seed the frozen-stock regression reads the shelves for. */
const FROZEN_SEED = (bandId: BandId): Rng => new Rng(hashSeed(`task-54:${bandId}`));

/**
 * The shelves a fixed seed has to keep opening: the pack, the potion rung, two
 * distinct held rows of that band's pool, the machine the session's frozen draw
 * order lands on and — at `late`/`end` — the sixth row's G-Max Stone (`D44`).
 * Re-pinning these is a deliberate balance act.
 */
const FROZEN: Readonly<Record<BandId, readonly string[]>> = {
  early: ['pokeball', 'potion', 'chestoberry', 'cheriberry', 'tm001'],
  low: ['pokeball', 'superpotion', 'rawstberry', 'oranberry', 'tm044'],
  mid: ['greatball', 'superpotion', 'normalgem', 'ironball', 'tm067'],
  high: ['greatball', 'hyperpotion', 'petayaberry', 'expertbelt', 'tm110'],
  late: ['ultraball', 'hyperpotion', 'colburberry', 'tangaberry', 'tm126', 'duraludoniteg'],
  end: ['ultraball', 'fullrestore', 'focusband', 'lifeorb', 'tm156', 'meowthiteg'],
};

/** The frozen `(itemId, price, count)` triples those ids carried before the endless flag. */
type StockTriple = Readonly<{ itemId: string; price: number; count: number }>;

const FROZEN_STOCK: Readonly<Record<BandId, readonly StockTriple[]>> = {
  early: [
    { itemId: 'pokeball', price: 1000, count: 10 },
    { itemId: 'potion', price: 300, count: 1 },
    { itemId: 'chestoberry', price: 200, count: 1 },
    { itemId: 'cheriberry', price: 200, count: 1 },
    { itemId: 'tm001', price: 3000, count: 1 },
  ],
  low: [
    { itemId: 'pokeball', price: 1000, count: 10 },
    { itemId: 'superpotion', price: 700, count: 1 },
    { itemId: 'rawstberry', price: 200, count: 1 },
    { itemId: 'oranberry', price: 100, count: 1 },
    { itemId: 'tm044', price: 3000, count: 1 },
  ],
  mid: [
    { itemId: 'greatball', price: 3000, count: 10 },
    { itemId: 'superpotion', price: 700, count: 1 },
    { itemId: 'normalgem', price: 4000, count: 1 },
    { itemId: 'ironball', price: 4000, count: 1 },
    { itemId: 'tm067', price: 3000, count: 1 },
  ],
  high: [
    { itemId: 'greatball', price: 3000, count: 10 },
    { itemId: 'hyperpotion', price: 1200, count: 1 },
    { itemId: 'petayaberry', price: 200, count: 1 },
    { itemId: 'expertbelt', price: 4000, count: 1 },
    { itemId: 'tm110', price: 3000, count: 1 },
  ],
  late: [
    { itemId: 'ultraball', price: 6000, count: 10 },
    { itemId: 'hyperpotion', price: 1200, count: 1 },
    { itemId: 'colburberry', price: 200, count: 1 },
    { itemId: 'tangaberry', price: 200, count: 1 },
    { itemId: 'tm126', price: 3000, count: 1 },
    { itemId: 'duraludoniteg', price: 8000, count: 1 },
  ],
  end: [
    { itemId: 'ultraball', price: 6000, count: 10 },
    { itemId: 'fullrestore', price: 3000, count: 1 },
    { itemId: 'focusband', price: 4000, count: 1 },
    { itemId: 'lifeorb', price: 4000, count: 1 },
    { itemId: 'tm156', price: 3000, count: 1 },
    { itemId: 'meowthiteg', price: 8000, count: 1 },
  ],
};

const triples = (stock: readonly { itemId: string; price: number; count: number }[]): StockTriple[] =>
  stock.map((slot) => ({ itemId: slot.itemId, price: slot.price, count: slot.count }));

describe('buildShop', () => {
  it('is deterministic and opens with the ball pack and the potion rung', () => {
    for (const band of LEVEL_BANDS) {
      const a = buildShop(band.id, new Rng(99));
      expect(a).toEqual(buildShop(band.id, new Rng(99)));
      const pack = SHOP_BALL_PACK[band.id];
      expect(a[0], band.id).toEqual({
        itemId: pack.itemId,
        price: pack.price,
        count: pack.count,
        infinite: SHOP_BALL_INFINITE,
      });
      const potion = SHOP_POTION[band.id];
      expect(a[1], band.id).toEqual({ itemId: potion, price: buyPrice(getItem(potion)!), count: 1 });
    }
  });

  it('marks exactly one row endless — the ball pack — for every band', () => {
    expect(SHOP_BALL_INFINITE).toBe(true);
    for (const band of LEVEL_BANDS) {
      for (let seed = 0; seed < 20; seed++) {
        const stock = buildShop(band.id, new Rng(seed));
        const endless = stock.filter(isInfiniteSlot);
        expect(endless, `${band.id}:${seed}`).toHaveLength(1);
        expect(endless[0], `${band.id}:${seed}`).toBe(stock[0]);
        const pack = SHOP_BALL_PACK[band.id];
        expect(stock[0], `${band.id}:${seed}`).toEqual({
          itemId: pack.itemId,
          price: pack.price,
          count: pack.count,
          infinite: true,
        });
        expect(getItem(pack.itemId)!.kind, band.id).toBe('ball');
      }
    }
  });

  it("fills the last two stock rows from the band's own held pool", () => {
    for (const band of LEVEL_BANDS) {
      for (let seed = 0; seed < 100; seed++) {
        const stock = buildShop(band.id, new Rng(seed));
        const held = stock.slice(2, 2 + SHOP_HELD_ROWS);
        expect(held.length, `${band.id}:${seed}`).toBe(SHOP_HELD_ROWS);
        expect(new Set(held.map((slot) => slot.itemId)).size, `${band.id}:${seed}`).toBe(SHOP_HELD_ROWS);
        for (const slot of held) {
          expect(
            SHOP_ROTATION[band.id].some((entry) => entry.itemId === slot.itemId),
            slot.itemId,
          ).toBe(true);
          expect(slot.price, slot.itemId).toBe(buyPrice(getItem(slot.itemId)!));
          expect(slot.count, slot.itemId).toBe(1);
        }
      }
    }
  });

  it('stocks the stock rows plus the machine, and the stone row where it belongs', () => {
    for (const band of LEVEL_BANDS) {
      const extra = SHOP_GMAX_STONE_BANDS.includes(band.id) ? 1 : 0;
      for (let seed = 0; seed < 100; seed++) {
        const ids = buildShop(band.id, new Rng(seed)).map((slot) => slot.itemId);
        expect(ids.length, `${band.id}:${seed}`).toBe(1 + 1 + SHOP_HELD_ROWS + 1 + extra);
        expect(new Set(ids).size, `${band.id}:${seed}`).toBe(ids.length);
      }
    }
  });

  it('appends one machine off the band list at index 4, at the catalogue price', () => {
    for (const band of LEVEL_BANDS) {
      for (let seed = 0; seed < 100; seed++) {
        const stock = buildShop(band.id, new Rng(seed));
        const machine = stock[1 + 1 + SHOP_HELD_ROWS]!;
        expect(SHOP_TM[band.id].includes(machine.itemId), `${band.id}:${seed} ${machine.itemId}`).toBe(
          true,
        );
        expect(stock.filter((slot) => isTmItemId(slot.itemId)).length).toBe(1);
        expect(machine.price).toBe(buyPrice(getItem(machine.itemId)!));
        expect(new Set(stock.map((slot) => slot.itemId)).size).toBe(stock.length);
        if (!SHOP_GMAX_STONE_BANDS.includes(band.id)) {
          expect(stock, band.id).toHaveLength(1 + 1 + SHOP_HELD_ROWS + 1);
          expect(stock[stock.length - 1], band.id).toBe(machine);
        }
      }
    }
  });

  it('shelves one G-Max Stone last, at late and end alone (D44)', () => {
    for (const band of LEVEL_BANDS) {
      const shelves = SHOP_GMAX_STONE_BANDS.includes(band.id);
      for (let seed = 0; seed < 100; seed++) {
        const stock = buildShop(band.id, new Rng(seed));
        const stones = stock.filter((slot) => GMAX_STONE_IDS.includes(slot.itemId));
        if (!shelves) {
          expect(stones, `${band.id}:${seed}`).toEqual([]);
          continue;
        }
        expect(stones, `${band.id}:${seed}`).toHaveLength(1);
        const stone = stock[stock.length - 1]!;
        expect(stones[0], `${band.id}:${seed}`).toBe(stone);
        expect(GMAX_STONE_IDS, stone.itemId).toContain(stone.itemId);
        expect(stone.price, stone.itemId).toBe(8000);
        expect(stone.count, stone.itemId).toBe(1);
        expect(getItem(stone.itemId)!.gmax, stone.itemId).toBeDefined();
        expect(isTmItemId(stock[4]!.itemId), `${band.id}:${seed}`).toBe(true);
        expect(new Set(stock.map((slot) => slot.itemId)).size).toBe(stock.length);
      }
    }
  });

  it('freezes a fixed seed: the same rows, twice', () => {
    for (const band of LEVEL_BANDS) {
      const first = buildShop(band.id, FROZEN_SEED(band.id));
      expect(buildShop(band.id, FROZEN_SEED(band.id)), band.id).toEqual(first);
      expect(
        first.map((slot) => slot.itemId),
        band.id,
      ).toEqual(FROZEN[band.id]);
      // The endless flag is set on an existing row and draws nothing: the shipped
      // `(itemId, price, count)` triples are the same ones, row for row.
      expect(triples(first), band.id).toEqual(FROZEN_STOCK[band.id]);
      const pack = SHOP_BALL_PACK[band.id];
      expect(first[0], band.id).toEqual({
        itemId: pack.itemId,
        price: pack.price,
        count: pack.count,
        infinite: true,
      });
      expect(first[1], band.id).toEqual({
        itemId: SHOP_POTION[band.id],
        price: buyPrice(getItem(SHOP_POTION[band.id])!),
        count: 1,
      });
      expect(
        first.slice(2, 2 + SHOP_HELD_ROWS).map((slot) => slot.itemId),
        band.id,
      ).toEqual(FROZEN[band.id].slice(2, 2 + SHOP_HELD_ROWS));
      expect(isTmItemId(first[1 + 1 + SHOP_HELD_ROWS]!.itemId), band.id).toBe(true);
      if (SHOP_GMAX_STONE_BANDS.includes(band.id)) {
        expect(GMAX_STONE_IDS, `${band.id} ${FROZEN[band.id][first.length - 1]}`).toContain(
          FROZEN[band.id][first.length - 1],
        );
      }
    }
  });
});

describe('shop trades', () => {
  it('buys when the run can afford it and refuses otherwise', () => {
    const rich = addMoney(createRun({ seed: 's', starter }), 1000);
    const bought = buyItem(rich, { itemId: 'potion', price: 300, count: 1 });
    expect(bought.ok).toBe(true);
    expect(bought.run.money).toBe(700);
    expect(bought.run.bag).toEqual([{ itemId: 'potion', count: 1 }]);

    const poor = createRun({ seed: 's', starter });
    const refused = buyItem(poor, { itemId: 'potion', price: 300, count: 1 });
    expect(refused.ok).toBe(false);
    expect(refused.run).toBe(poor);
  });

  it('charges the pack price once and adds all ten units as one bag stack', () => {
    const run = addMoney(createRun({ seed: 's', starter }), 1500);
    const pack = buildShop('early', new Rng(7))[0];
    const trade = buyItem(run, pack);
    expect(trade.ok).toBe(true);
    expect(trade.amount).toBe(1000);
    expect(trade.run.money).toBe(500);
    expect(itemCount(trade.run, 'pokeball')).toBe(10);
    expect(trade.run.bag).toEqual([{ itemId: 'pokeball', count: 10 }]);
  });

  it('refuses a pack the run cannot afford, with the same run object', () => {
    const run = addMoney(createRun({ seed: 's', starter }), 900);
    const refused = buyItem(run, buildShop('early', new Rng(7))[0]);
    expect(refused.ok).toBe(false);
    expect(refused.run).toBe(run);
  });

  it('labels the pack row with its ten units and the bag own count', () => {
    let run = addMoney(createRun({ seed: 's', starter }), 2500);
    const pack = buildShop('early', new Rng(7))[0];
    expect(buyRows(run, [pack])[0]).toEqual({
      itemId: 'pokeball',
      name: '10x Poke Ball',
      price: 1000,
      count: 10,
      owned: 0,
      affordable: true,
      draggable: true,
      infinite: true,
    });
    run = buyItem(run, pack).run;
    expect(itemCount(run, 'pokeball')).toBe(10);
    // The endless row stays on the shelf and reads the new owned count from the bag.
    expect(buyRows(run, [pack])[0].owned).toBe(10);
    expect(buyRows(run, [pack], run.mapIndex + 1)[0].owned).toBe(10);
  });

  it('sells one unit and refuses what the shop will not buy', () => {
    let run = createRun({ seed: 's', starter });
    run = addItem(run, 'nugget', 2);
    const sold = sellItem(run, 'nugget');
    expect(sold.ok).toBe(true);
    expect(sold.amount).toBe(5000);
    expect(sold.run.money).toBe(5000);
    expect(sold.run.bag).toEqual([{ itemId: 'nugget', count: 1 }]);

    expect(sellItem(run, 'masterball').ok).toBe(false);
    expect(sellItem(run, 'not-an-item').ok).toBe(false);
  });

  it('lists only the stacks the shop will buy', () => {
    let run = createRun({ seed: 's', starter });
    run = addItem(run, 'nugget', 1);
    run = addItem(run, 'masterball', 1);
    run = addItem(run, 'potion', 1);
    expect(sellableStacks(run).map((stack) => stack.itemId)).toEqual(['nugget', 'potion']);
  });

  it('builds buy and sell rows, a sale always one unit at a time', () => {
    let run = addMoney(createRun({ seed: 's', starter }), 100);
    run = addItem(run, 'nugget', 2);
    const buy = buyRows(run, [{ itemId: 'potion', price: 300, count: 1 }]);
    expect(buy[0]).toMatchObject({
      name: 'Potion',
      price: 300,
      count: 1,
      owned: 0,
      affordable: false,
      draggable: false,
    });
    const sell = sellRows(run);
    expect(sell[0]).toMatchObject({
      itemId: 'nugget',
      price: 5000,
      count: 1,
      owned: 2,
      affordable: true,
      draggable: false,
    });
    run = sellItem(run, 'nugget').run;
    expect(sellableStacks(run)).toEqual([{ itemId: 'nugget', count: 1 }]);
    expect(sellPriceOf('masterball')).toBe(0);
    expect(sellPriceOf('nugget')).toBe(5000);
  });

  it('makes an affordable BUY row draggable and a SELL row never', () => {
    let run = addMoney(createRun({ seed: 's', starter }), 1200);
    run = addItem(run, 'nugget', 1);
    const stock = [{ itemId: 'pokeball', price: 1000, count: 10 }];
    expect(buyRows(run, stock)[0].draggable).toBe(true);
    expect(sellRows(run)[0]).toMatchObject({ itemId: 'nugget', draggable: false });

    const poor = createRun({ seed: 's', starter });
    expect(buyRows(poor, stock)[0]).toMatchObject({ affordable: false, draggable: false });
  });
});

describe('the shelf (Task-178)', () => {
  const rich = (money: number) => addMoney(createRun({ seed: 's', starter }), money);
  const early = () => buildShop('early', new Rng(7));

  it('keys a row by its floor: one row, one map', () => {
    expect(shopRowKey(2, 'potion')).toBe('shop-2-potion');
  });

  it('marks the bought row on its own floor', () => {
    const trade = buyItem(rich(1000), early()[1]!, 2);
    expect(trade.ok).toBe(true);
    expect(trade.run.pickedItems).toEqual(['shop-2-potion']);
    // A different floor of the same item is a different key.
    expect(buyItem(trade.run, early()[1]!, 3).run.pickedItems).toEqual([
      'shop-2-potion',
      'shop-3-potion',
    ]);
  });

  it('drops the bought row from the same floor and keeps the rest in order', () => {
    const stock = early();
    let run = rich(20_000);
    const before = buyRows(run, stock).map((row) => row.itemId);
    expect(before).toEqual(stock.map((slot) => slot.itemId));
    run = buyItem(run, stock[2]!).run;
    const after = buyRows(run, stock);
    expect(after.map((row) => row.itemId)).toEqual(before.filter((id) => id !== stock[2]!.itemId));
    expect(after).toHaveLength(before.length - 1);
  });

  it('keeps another floor its own shelf: the mark is per map', () => {
    const stock = early();
    const run = buyItem(rich(20_000), stock[1]!, 2).run;
    expect(buyRows(run, stock, 2)).toHaveLength(stock.length - 1);
    expect(buyRows(run, stock, 3).map((row) => row.itemId)).toEqual(stock.map((slot) => slot.itemId));
  });

  it('keeps the endless ball row on the shelf, sale after sale', () => {
    const stock = early();
    const pack = stock[0]!;
    expect(pack.count).toBe(10);
    let run = rich(20_000);
    const first = buyItem(run, pack);
    const second = buyItem(first.run, pack);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(first.amount).toBe(pack.price);
    expect(second.amount).toBe(pack.price);
    run = second.run;
    expect(itemCount(run, pack.itemId)).toBe(2 * pack.count);
    expect(run.money).toBe(20_000 - 2 * pack.price);
    expect(run.pickedItems).toEqual([]);
    const rows = buyRows(run, stock);
    expect(rows[0]).toMatchObject({ itemId: pack.itemId, owned: 2 * pack.count, infinite: true });
    expect(rows).toHaveLength(stock.length);
  });

  it('retires the potion rung the same way', () => {
    const stock = early();
    const potion = stock[1]!;
    let run = rich(20_000);
    run = buyItem(run, potion).run;
    expect(buyRows(run, stock).map((row) => row.itemId)).not.toContain(potion.itemId);
  });

  it('marks nothing when the run cannot pay, so the row stays', () => {
    const stock = early();
    const poor = createRun({ seed: 's', starter });
    const refused = buyItem(poor, stock[0]!);
    expect(refused.ok).toBe(false);
    expect(refused.run).toBe(poor);
    expect(refused.run.pickedItems).toEqual([]);
    expect(buyRows(refused.run, stock)).toHaveLength(stock.length);
  });

  it('leaves the sell side alone: a marked item still sells from the bag', () => {
    const stock = early();
    const potion = stock[1]!;
    let run = rich(5000);
    run = buyItem(run, potion).run;
    expect(sellRows(run).map((row) => row.itemId)).toContain(potion.itemId);
    const sold = sellItem(run, potion.itemId);
    expect(sold.ok).toBe(true);
    expect(sold.run.pickedItems).toEqual(run.pickedItems);
    // A sale restocks nothing: the row stays sold out on its floor.
    expect(buyRows(sold.run, stock)).toHaveLength(stock.length - 1);
  });
});

describe('the endless ball row (Task-265)', () => {
  const rich = (money: number) => addMoney(createRun({ seed: 's', starter }), money);

  it('reads the endless flag only from an explicit true', () => {
    expect(isInfiniteSlot({ itemId: 'pokeball', price: 1000, count: 10, infinite: true })).toBe(true);
    expect(isInfiniteSlot({ itemId: 'pokeball', price: 1000, count: 10 })).toBe(false);
    expect(isInfiniteSlot({ itemId: 'pokeball', price: 1000, count: 10, infinite: false })).toBe(false);
    // An absent flag and a present `undefined` are the same thing at runtime.
    const explicit = { itemId: 'pokeball', price: 1000, count: 10, infinite: undefined };
    expect(isInfiniteSlot(explicit as unknown as ShopSlot)).toBe(false);
  });

  it('keeps any flagged row, not just a ball, so a city shelf can say so', () => {
    const stock = [{ itemId: 'nugget', price: 5000, count: 1, infinite: true }];
    const trade = buyItem(rich(20_000), stock[0]!);
    expect(trade.ok).toBe(true);
    expect(trade.run.pickedItems).toEqual([]);
    expect(buyRows(trade.run, stock)).toHaveLength(1);
  });

  it('still keeps the ball row endless when a caller rebuilds the slot from its row', () => {
    // The Mart card hands `buyItem` the `(itemId, price, count)` triple it painted,
    // so the optional flag does not survive the round trip.
    const stock = buildShop('early', new Rng(7));
    const rebuilt = { itemId: stock[0]!.itemId, price: stock[0]!.price, count: stock[0]!.count };
    const trade = buyItem(rich(20_000), rebuilt);
    expect(trade.ok).toBe(true);
    expect(trade.run.pickedItems).toEqual([]);
    expect(buyRows(trade.run, [rebuilt])).toHaveLength(1);
  });

  it('retires a non-ball row on its first purchase and leaves the ball row listed', () => {
    const stock = buildShop('early', new Rng(7));
    let run = rich(20_000);
    run = buyItem(run, stock[0]!).run;
    const potion = stock[1]!;
    const bought = buyItem(run, potion);
    expect(bought.ok).toBe(true);
    run = bought.run;
    expect(run.pickedItems).toEqual([shopRowKey(run.mapIndex, potion.itemId)]);
    const rows = buyRows(run, stock);
    expect(rows.map((row) => row.itemId)).not.toContain(potion.itemId);
    expect(rows.filter(isInfiniteSlot)).toHaveLength(1);
    expect(rows.map((row) => row.itemId)).toContain(stock[0]!.itemId);
    expect(rows).toHaveLength(stock.length - 1);
  });

  it('never marks an endless row on any floor', () => {
    const stock = buildShop('late', new Rng(7));
    const run = buyItem(rich(20_000), stock[0]!, 4).run;
    expect(run.pickedItems).toEqual([]);
    expect(buyRows(run, stock, 4)).toHaveLength(stock.length);
  });
});
