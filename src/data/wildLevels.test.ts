import { describe, expect, it } from 'vitest';
import { MAP_MAX_LEVEL } from './maps';
import { WILD_LEVEL_FRACTION, wildLevel } from './wildLevels';

describe('WILD_LEVEL_FRACTION', () => {
  it('pins the share of the live squad level a wild lands in', () => {
    expect(WILD_LEVEL_FRACTION).toEqual({ min: 0.6, max: 0.75 });
    expect(Object.keys(WILD_LEVEL_FRACTION)).toHaveLength(2);
  });
});

describe('wildLevel', () => {
  it('holds the pinned values', () => {
    expect(wildLevel(0.6, 5, 9)).toBe(3);
    expect(wildLevel(0.75, 5, 9)).toBe(3);
    expect(wildLevel(0.6, 9, 9)).toBe(5);
    expect(wildLevel(0.6, 100, 30)).toBe(30);
    expect(wildLevel(0.75, 20, 30)).toBe(15);
    expect(wildLevel(Number.NaN, 20, 30)).toBe(12);
    expect(wildLevel(0.6, 20, Number.NaN)).toBe(12);
  });

  it('floors the product instead of rounding it', () => {
    expect(wildLevel(0.6, 20, 30)).toBe(12);
    expect(wildLevel(0.749, 20, 30)).toBe(14);
    expect(wildLevel(0.75, 21, 30)).toBe(15);
    expect(wildLevel(0.6, 21, 30)).toBe(12);
  });

  it('never returns more than the cap', () => {
    expect(wildLevel(1, 55, 9)).toBe(9);
    expect(wildLevel(0.75, 30, 9)).toBe(9);
    expect(wildLevel(0.6, 20, 1)).toBe(1);
    expect(wildLevel(0.6, 20, 0)).toBe(1);
    expect(wildLevel(0.6, 20, 12.9)).toBe(12);
    expect(wildLevel(0.6, 20, Number.POSITIVE_INFINITY)).toBe(12);
  });

  it('never climbs above the squad level while the share is below one', () => {
    expect(wildLevel(WILD_LEVEL_FRACTION.min, 1, MAP_MAX_LEVEL)).toBe(1);
    for (let squadLevel = 2; squadLevel <= 100; squadLevel++) {
      expect(wildLevel(WILD_LEVEL_FRACTION.min, squadLevel, MAP_MAX_LEVEL)).toBeLessThan(squadLevel);
      expect(wildLevel(WILD_LEVEL_FRACTION.max, squadLevel, MAP_MAX_LEVEL)).toBeLessThan(squadLevel);
    }
  });

  it('clamps the share into 0..1 and the squad level into zero or more', () => {
    expect(wildLevel(1, 20, 30)).toBe(20);
    expect(wildLevel(2, 20, 30)).toBe(20);
    expect(wildLevel(-1, 20, 30)).toBe(1);
    expect(wildLevel(0, 20, 30)).toBe(1);
    expect(wildLevel(Number.POSITIVE_INFINITY, 20, 30)).toBe(12);
    expect(wildLevel(0.6, Number.NaN, 30)).toBe(1);
    expect(wildLevel(0.6, Number.POSITIVE_INFINITY, 30)).toBe(1);
    expect(wildLevel(0.6, -5, 30)).toBe(1);
    expect(wildLevel(0.6, 0, 30)).toBe(1);
  });
});
