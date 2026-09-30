import { describe, expect, it } from 'vitest';
import { ITEMS, buyPrice, getItem, isForSale, sellPrice, type ItemKind } from './items';

const KINDS: readonly ItemKind[] = ['ball', 'heal', 'status', 'boost', 'held'];

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

  it('sells everything except the Master Ball', () => {
    for (const entry of ITEMS) {
      expect(isForSale(entry), entry.id).toBe(entry.id !== 'masterball');
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
