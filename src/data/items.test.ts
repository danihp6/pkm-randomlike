import { describe, expect, it } from 'vitest';
import {
  ITEMS,
  MEGA_STONE_IDS,
  buyPrice,
  getItem,
  isForSale,
  sellPrice,
  type ItemKind,
} from './items';

const KINDS: readonly ItemKind[] = ['ball', 'heal', 'status', 'boost', 'held', 'valuable'];

describe('item catalogue', () => {
  it('has unique ids and a known kind for every row', () => {
    const ids = ITEMS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of ITEMS) {
      expect(KINDS, entry.id).toContain(entry.kind);
      expect(entry.name.length, entry.id).toBeGreaterThan(0);
      expect(entry.shortDesc.length, entry.id).toBeGreaterThan(0);
    }
  });

  it('gives every item a non-negative integer price', () => {
    for (const entry of ITEMS) {
      expect(Number.isInteger(entry.price), entry.id).toBe(true);
      expect(entry.price, entry.id).toBeGreaterThanOrEqual(0);
    }
  });

  it('sells everything except the Master Ball and the Mega Stones', () => {
    for (const entry of ITEMS) {
      const expected = entry.id !== 'masterball' && entry.mega === undefined;
      expect(isForSale(entry), entry.id).toBe(expected);
    }
  });

  it('prices balls by their catch bonus', () => {
    const ballPrices = ITEMS.filter((entry) => entry.kind === 'ball' && entry.id !== 'masterball')
      .map((entry) => entry.price);
    const sorted = [...ballPrices].sort((a, b) => a - b);
    expect(ballPrices).toEqual(sorted);
    for (const entry of ITEMS) {
      if (entry.kind === 'ball') expect(entry.catchBonus, entry.id).toBeGreaterThan(0);
    }
    // The Premier Ball shares the Poke Ball's 1x rate and price.
    expect(getItem('premierball')!.catchBonus).toBe(getItem('pokeball')!.catchBonus);
    expect(getItem('premierball')!.price).toBe(getItem('pokeball')!.price);
  });

  it('never registers a Revive (D5)', () => {
    expect(ITEMS.some((entry) => /revive/i.test(entry.id) || /revive/i.test(entry.name))).toBe(false);
  });
});

describe('prices', () => {
  it('buys at the listed price and sells at half, rounded down', () => {
    const potion = getItem('potion')!;
    expect(buyPrice(potion)).toBe(potion.price);
    expect(sellPrice(potion)).toBe(Math.floor(potion.price / 2));
    expect(sellPrice(getItem('antidote')!)).toBe(50);
    expect(sellPrice(getItem('masterball')!)).toBe(0);
  });

  it('sells a valuable for its whole price', () => {
    const nugget = getItem('nugget')!;
    expect(nugget.kind).toBe('valuable');
    expect(sellPrice(nugget)).toBe(nugget.price);
    expect(sellPrice(getItem('cometshard')!)).toBe(12000);
  });
});

describe('getItem', () => {
  it('resolves every catalogue id', () => {
    for (const entry of ITEMS) expect(getItem(entry.id), entry.id).toBe(entry);
  });

  it('normalises case and punctuation, and misses cleanly', () => {
    expect(getItem('Poke Ball')).toBe(getItem('pokeball'));
    expect(getItem('Never-Melt-Ice')).toBe(getItem('nevermeltice'));
    expect(getItem('revive')).toBeUndefined();
  });
});

describe('Mega Stones', () => {
  it('has one held, unsold stone per Mega forme', () => {
    const stones = ITEMS.filter((entry) => entry.mega !== undefined);
    expect(stones.length).toBe(34);
    for (const stone of stones) {
      expect(stone.kind, stone.id).toBe('held');
      expect(stone.price, stone.id).toBe(0);
      expect(stone.mega!.base, stone.id).not.toBe(stone.mega!.form);
    }
  });

  it('lists every Mega Stone id for the mega-stone room to draw from', () => {
    const stones = ITEMS.filter((entry) => entry.mega !== undefined).map((stone) => stone.id);
    expect(MEGA_STONE_IDS).toEqual(stones);
    expect(MEGA_STONE_IDS.length).toBe(34);
  });

  it('gives each Mega-capable species a matching stone', () => {
    expect(getItem('venusaurite')!.mega).toEqual({ base: 'venusaur', form: 'venusaurmega' });
    expect(getItem('gyaradosite')!.mega).toEqual({ base: 'gyarados', form: 'gyaradosmega' });
    expect(getItem('charizarditex')!.mega).toEqual({ base: 'charizard', form: 'charizardmegax' });
    expect(getItem('charizarditey')!.mega).toEqual({ base: 'charizard', form: 'charizardmegay' });
  });
});
