import { describe, expect, it } from 'vitest';
import { GMAX_STONE_IDS, buyPrice, getItem } from '../data/items';
import type { BandId } from '../data/run';
import { LEVEL_BANDS } from '../data/run';
import {
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
import { buildShop, buyItem, buyRows, sellItem, sellPriceOf, sellRows, sellableStacks } from './shop';

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

describe('buildShop', () => {
  it('is deterministic and opens with the ball pack and the potion rung', () => {
    for (const band of LEVEL_BANDS) {
      const a = buildShop(band.id, new Rng(99));
      expect(a).toEqual(buildShop(band.id, new Rng(99)));
      const pack = SHOP_BALL_PACK[band.id];
      expect(a[0], band.id).toEqual({ itemId: pack.itemId, price: pack.price, count: pack.count });
      const potion = SHOP_POTION[band.id];
      expect(a[1], band.id).toEqual({ itemId: potion, price: buyPrice(getItem(potion)!), count: 1 });
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
      const pack = SHOP_BALL_PACK[band.id];
      expect(first[0], band.id).toEqual({ itemId: pack.itemId, price: pack.price, count: pack.count });
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
    });
    run = buyItem(run, pack).run;
    expect(buyRows(run, [pack])[0].owned).toBe(10);
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
