import { describe, expect, it } from 'vitest';
import { buyPrice, getItem } from '../data/items';
import { LEVEL_BANDS, type BandId } from '../data/run';
import { SHOP_CORE, SHOP_ROTATION, SHOP_ROTATION_COUNT, SHOP_TM } from '../data/shop';
import { isTmItemId } from '../data/tms';
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

/**
 * The stock `buildShop` returned before the TM slot existed: the band's core plus
 * its weighted rotation, on the pre-change draw order, so the new **last** draw
 * can be shown not to have shifted a single earlier pick.
 */
function coreAndRotation(bandId: BandId, rng: Rng): readonly { itemId: string; price: number }[] {
  const ids = [...SHOP_CORE[bandId]];
  const pool = SHOP_ROTATION[bandId].filter((entry) => !ids.includes(entry.itemId));
  const count = rng.int(SHOP_ROTATION_COUNT.min, SHOP_ROTATION_COUNT.max);
  const remaining = [...pool];
  for (let picked = 0; picked < count && remaining.length > 0; picked++) {
    const total = remaining.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
    let roll = rng.int(0, total - 1);
    let index = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      roll -= Math.max(0, remaining[i].weight);
      if (roll < 0) {
        index = i;
        break;
      }
    }
    ids.push(remaining[index].itemId);
    remaining.splice(index, 1);
  }
  return ids.map((id) => ({ itemId: id, price: buyPrice(getItem(id)!) }));
}

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

  it('adds one or two distinct rotating items and one machine, with no id repeats', () => {
    for (let seed = 0; seed < 100; seed++) {
      const stock = buildShop('high', new Rng(seed));
      const ids = stock.map((slot) => slot.itemId);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.length).toBeGreaterThanOrEqual(SHOP_CORE.high.length + 1 + 1);
      expect(ids.length).toBeLessThanOrEqual(SHOP_CORE.high.length + 2 + 1);
      for (const id of ids.filter((candidate) => !SHOP_CORE.high.includes(candidate) && !isTmItemId(candidate))) {
        expect(SHOP_ROTATION.high.some((entry) => entry.itemId === id), id).toBe(true);
      }
    }
  });

  it('appends one machine off the band list last, at the catalogue price', () => {
    for (const band of LEVEL_BANDS) {
      for (let seed = 0; seed < 100; seed++) {
        const stock = buildShop(band.id, new Rng(seed));
        const last = stock[stock.length - 1];
        expect(SHOP_TM[band.id].includes(last.itemId), `${band.id}:${seed} ${last.itemId}`).toBe(true);
        expect(stock.filter((slot) => isTmItemId(slot.itemId)).length).toBe(1);
        expect(last.price).toBe(buyPrice(getItem(last.itemId)!));
        expect(new Set(stock.map((slot) => slot.itemId)).size).toBe(stock.length);
      }
    }
  });

  it('leaves every pre-TM pick exactly where it was', () => {
    for (const band of LEVEL_BANDS) {
      for (let seed = 0; seed < 100; seed++) {
        const stock = buildShop(band.id, new Rng(seed));
        expect(stock.slice(0, -1), `${band.id}:${seed}`).toEqual(coreAndRotation(band.id, new Rng(seed)));
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
