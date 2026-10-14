import { describe, expect, it } from 'vitest';
import { UNMODELLED_ITEMS } from '../engine/battle/effects/items';
import { COMPETITIVE_HELD_IDS, buyPrice, getItem, sellPrice } from './items';
import type { BandId } from './run';
import { LEVEL_BANDS } from './run';
import { SHOP_BALL_PACK, SHOP_HELD_ROWS, SHOP_POTION, SHOP_ROTATION, SHOP_TM } from './shop';
import { TM_MOVE_IDS, isTmItemId } from './tms';

/** Every competitive held item the engine models, so the Mart is the way to buy it. */
const PORT_IDS = COMPETITIVE_HELD_IDS.filter((id) => !UNMODELLED_ITEMS.includes(id));

/** The band's own ball and its pack price, both frozen (`docs/balance/economy.md`). */
const PACKS: Readonly<Record<BandId, readonly [string, number]>> = {
  early: ['pokeball', 1000],
  low: ['pokeball', 1000],
  mid: ['greatball', 3000],
  high: ['greatball', 3000],
  late: ['ultraball', 6000],
  end: ['ultraball', 6000],
};

/** The band's own heal rung, frozen. */
const POTIONS: Readonly<Record<BandId, string>> = {
  early: 'potion',
  low: 'superpotion',
  mid: 'superpotion',
  high: 'hyperpotion',
  late: 'hyperpotion',
  end: 'fullrestore',
};

/** The TM catalogue position of a machine id, read back through the move it teaches. */
const tmIndex = (id: string): number => TM_MOVE_IDS.indexOf(getItem(id)!.teaches!);

describe('shop tables', () => {
  it('stocks only catalogue items that exist', () => {
    for (const band of LEVEL_BANDS) {
      const pack = SHOP_BALL_PACK[band.id];
      expect(getItem(pack.itemId), pack.itemId).toBeDefined();
      expect(getItem(SHOP_POTION[band.id]), SHOP_POTION[band.id]).toBeDefined();
      for (const entry of SHOP_ROTATION[band.id]) {
        expect(getItem(entry.itemId), entry.itemId).toBeDefined();
        expect(entry.weight, entry.itemId).toBeGreaterThan(0);
      }
    }
  });

  it("sells the band's own ball in tens at half the catalogue sum", () => {
    for (const band of LEVEL_BANDS) {
      const [itemId, price] = PACKS[band.id];
      const pack = SHOP_BALL_PACK[band.id];
      expect(pack, band.id).toEqual({ itemId, count: 10, price });
      expect(pack.price, band.id).toBe((buyPrice(getItem(itemId)!) * pack.count) / 2);
      expect(pack.price % 100, band.id).toBe(0);
    }
  });

  it('sells a heal rung at the catalogue price, and never an X-item or a cure', () => {
    for (const band of LEVEL_BANDS) {
      const potion = getItem(SHOP_POTION[band.id])!;
      expect(SHOP_POTION[band.id], band.id).toBe(POTIONS[band.id]);
      expect(potion.kind, band.id).toBe('heal');
      expect(potion.price, band.id).toBeGreaterThan(0);
      for (const entry of SHOP_ROTATION[band.id]) {
        const item = getItem(entry.itemId)!;
        expect(item.kind, entry.itemId).toBe('held');
        expect(item.kind, entry.itemId).not.toBe('status');
        expect(item.kind, entry.itemId).not.toBe('boost');
      }
    }
  });

  it('stocks enough distinct held rows to fill the shelf', () => {
    expect(SHOP_HELD_ROWS).toBe(2);
    for (const band of LEVEL_BANDS) {
      const ids = SHOP_ROTATION[band.id].map((entry) => entry.itemId);
      expect(new Set(ids).size, band.id).toBe(ids.length);
      expect(new Set(ids).size, band.id).toBeGreaterThanOrEqual(SHOP_HELD_ROWS);
    }
  });

  it('stocks every modelled competitive held item, never twice in one band', () => {
    const stocked = new Set<string>();
    for (const band of LEVEL_BANDS) {
      for (const entry of SHOP_ROTATION[band.id]) stocked.add(entry.itemId);
    }
    for (const id of PORT_IDS) expect(stocked.has(id), id).toBe(true);
  });

  it('never rotates a valuable, a Mega Stone or the Master Ball', () => {
    for (const band of LEVEL_BANDS) {
      for (const entry of SHOP_ROTATION[band.id]) {
        const item = getItem(entry.itemId)!;
        expect(item.kind, entry.itemId).not.toBe('valuable');
        expect(item.mega, entry.itemId).toBeUndefined();
        expect(item.id, entry.itemId).not.toBe('masterball');
      }
    }
  });

  it('leaves no buy-and-sell loop on the pack: ten units resell for what they cost', () => {
    for (const band of LEVEL_BANDS) {
      const pack = SHOP_BALL_PACK[band.id];
      const unit = sellPrice(getItem(pack.itemId)!);
      expect(pack.price, band.id).toBeLessThanOrEqual(unit * pack.count);
    }
  });
});

describe('shop TM table', () => {
  it('gives every band at least six catalogue machines, in catalogue order', () => {
    const seen = new Set<string>();
    for (const band of LEVEL_BANDS) {
      const ids = SHOP_TM[band.id];
      expect(ids.length, band.id).toBeGreaterThanOrEqual(6);
      expect(new Set(ids).size, band.id).toBe(ids.length);
      const indexes = ids.map((id) => {
        expect(isTmItemId(id), id).toBe(true);
        expect(getItem(id)?.kind, id).toBe('tm');
        return tmIndex(id);
      });
      for (let i = 1; i < indexes.length; i++) {
        expect(indexes[i], ids[i]).toBeGreaterThan(indexes[i - 1]);
      }
      for (const id of ids) {
        expect(seen.has(id), id).toBe(false);
        seen.add(id);
      }
    }
  });

  it("lets no band borrow the previous band's range", () => {
    for (let i = 1; i < LEVEL_BANDS.length; i++) {
      const previous = SHOP_TM[LEVEL_BANDS[i - 1].id];
      const previousLast = Math.max(...previous.map(tmIndex));
      const first = Math.min(...SHOP_TM[LEVEL_BANDS[i].id].map(tmIndex));
      expect(first, LEVEL_BANDS[i].id).toBeGreaterThan(previousLast);
    }
  });

  it('prices every machine at the catalogue price, with no buy-and-sell loop', () => {
    for (const band of LEVEL_BANDS) {
      for (const id of SHOP_TM[band.id]) {
        const item = getItem(id)!;
        expect(buyPrice(item), id).toBe(3000);
        expect(sellPrice(item), id).toBeLessThan(buyPrice(item));
      }
    }
  });
});
