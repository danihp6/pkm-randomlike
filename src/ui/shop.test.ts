import { describe, expect, it } from 'vitest';
import { buyPrice, getItem } from '../data/items';
import { LEVEL_BANDS } from '../data/run';
import { SHOP_CORE, SHOP_ROTATION } from '../data/shop';
import { addItem, addMoney, createRun, createRunPokemon } from '../engine/run';
import { Rng } from '../engine/rng';
import {
  buildShop,
  buyItem,
  buyRows,
  sellItem,
  sellPriceOf,
  sellRows,
  sellableStacks,
} from './shop';

const starter = createRunPokemon({ id: 'starter', speciesId: 'charmander', level: 5, moves: ['scratch'] });

describe('buildShop', () => {
  it('is deterministic and stocks the band core at catalogue prices', () => {
    for (const band of LEVEL_BANDS) {
      const a = buildShop(band.id, new Rng(99));
      expect(a).toEqual(buildShop(band.id, new Rng(99)));
      for (const id of SHOP_CORE[band.id]) {
        const slot = a.find((entry) => entry.itemId === id);
        expect(slot, id).toBeDefined();
        expect(slot!.price).toBe(buyPrice(getItem(id)!));
      }
    }
  });

  it('adds one or two distinct rotating items with no core repeats', () => {
    for (let seed = 0; seed < 100; seed++) {
      const stock = buildShop('high', new Rng(seed));
      const ids = stock.map((slot) => slot.itemId);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.length).toBeGreaterThanOrEqual(SHOP_CORE.high.length + 1);
      expect(ids.length).toBeLessThanOrEqual(SHOP_CORE.high.length + 2);
      for (const id of ids.filter((candidate) => !SHOP_CORE.high.includes(candidate))) {
        expect(SHOP_ROTATION.high.some((entry) => entry.itemId === id), id).toBe(true);
      }
    }
  });
});

describe('shop trades', () => {
  it('buys when the run can afford it and refuses otherwise', () => {
    const rich = addMoney(createRun({ seed: 's', starter }), 1000);
    const bought = buyItem(rich, { itemId: 'potion', price: 300 });
    expect(bought.ok).toBe(true);
    expect(bought.run.money).toBe(700);
    expect(bought.run.bag).toEqual([{ itemId: 'potion', count: 1 }]);

    const poor = createRun({ seed: 's', starter });
    const refused = buyItem(poor, { itemId: 'potion', price: 300 });
    expect(refused.ok).toBe(false);
    expect(refused.run).toBe(poor);
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

  it('builds buy and sell rows', () => {
    let run = addMoney(createRun({ seed: 's', starter }), 100);
    run = addItem(run, 'nugget', 1);
    const buy = buyRows(run, [{ itemId: 'potion', price: 300 }]);
    expect(buy[0]).toMatchObject({ name: 'Potion', price: 300, owned: 0, affordable: false });
    const sell = sellRows(run);
    expect(sell[0]).toMatchObject({ itemId: 'nugget', price: 5000, owned: 1, affordable: true });
    expect(sellPriceOf('masterball')).toBe(0);
    expect(sellPriceOf('nugget')).toBe(5000);
  });
});
