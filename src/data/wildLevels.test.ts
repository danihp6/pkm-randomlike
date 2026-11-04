import { describe, expect, it } from 'vitest';
import { MAP_MAX_LEVEL } from './maps';
import { BADGE_CAPS, badgeCap } from './region';
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

/**
 * A fresh run's starter level (`src/engine/run/prologue.ts`): the squad level the
 * first stretch is entered at. Every later stretch is entered at the previous one's
 * cap.
 *
 * The block below is the region's ladder measured against this module, one fixed
 * figure per stretch and per end of the shipped fraction — `docs/balance/campaign.md`
 * prints exactly these numbers, and they are read off nothing but `BADGE_CAPS` and
 * `WILD_LEVEL_FRACTION`, so the block rolls no RNG and needs no seed of its own.
 */
const START_LEVEL = 5;

describe('the eight stretches’ wild band', () => {
  /** `entry` is the level the squad enters the stretch at, `cap` the one it enforces. */
  const STRETCHES: readonly { badge: number; entry: number; cap: number; min: number; max: number }[] = [
    { badge: 1, entry: START_LEVEL, cap: 9, min: 3, max: 3 },
    { badge: 2, entry: 9, cap: 16, min: 5, max: 6 },
    { badge: 3, entry: 16, cap: 23, min: 9, max: 12 },
    { badge: 4, entry: 23, cap: 30, min: 13, max: 17 },
    { badge: 5, entry: 30, cap: 37, min: 18, max: 22 },
    { badge: 6, entry: 37, cap: 43, min: 22, max: 27 },
    { badge: 7, entry: 43, cap: 49, min: 25, max: 32 },
    { badge: 8, entry: 49, cap: 55, min: 29, max: 36 },
  ];

  it('pins one entry level and one cap per badge, off the region ladder', () => {
    expect(STRETCHES.map((row) => row.badge)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(BADGE_CAPS.length).toBe(STRETCHES.length);
    for (const row of STRETCHES) {
      expect(row.cap, `badge ${row.badge} cap`).toBe(badgeCap(row.badge));
      expect(row.entry, `badge ${row.badge} entry`).toBe(
        row.badge <= 1 ? START_LEVEL : badgeCap(row.badge - 1),
      );
    }
  });

  it('prints the band this module returns at the entry level of each stretch', () => {
    for (const row of STRETCHES) {
      const label = `badge ${row.badge}`;
      expect(wildLevel(WILD_LEVEL_FRACTION.min, row.entry, row.cap), `${label} min`).toBe(row.min);
      expect(wildLevel(WILD_LEVEL_FRACTION.max, row.entry, row.cap), `${label} max`).toBe(row.max);
      expect(row.min, `${label} floors`).toBe(Math.floor(row.entry * WILD_LEVEL_FRACTION.min));
      expect(row.max, `${label} floors`).toBe(Math.floor(row.entry * WILD_LEVEL_FRACTION.max));
    }
  });

  it('keeps every value under its stretch cap and never above the squad it is drawn from', () => {
    for (const row of STRETCHES) {
      expect(row.max, `badge ${row.badge} max`).toBeLessThanOrEqual(row.cap);
      expect(row.min, `badge ${row.badge} min`).toBeLessThanOrEqual(row.max);
      expect(row.max, `badge ${row.badge} under entry`).toBeLessThan(row.entry);
    }
  });

  /** The same eight stretches read at their cap: a squad at the ceiling draws this band. */
  const CAP_BANDS: readonly { badge: number; cap: number; min: number; max: number }[] = [
    { badge: 1, cap: 9, min: 5, max: 6 },
    { badge: 2, cap: 16, min: 9, max: 12 },
    { badge: 3, cap: 23, min: 13, max: 17 },
    { badge: 4, cap: 30, min: 18, max: 22 },
    { badge: 5, cap: 37, min: 22, max: 27 },
    { badge: 6, cap: 43, min: 25, max: 32 },
    { badge: 7, cap: 49, min: 29, max: 36 },
    { badge: 8, cap: 55, min: 33, max: 41 },
  ];

  it('reads the band at the cap too, so the sheet can print both ends of the stretch', () => {
    for (const row of CAP_BANDS) {
      expect(wildLevel(WILD_LEVEL_FRACTION.min, row.cap, row.cap), `badge ${row.badge} cap min`).toBe(
        row.min,
      );
      expect(wildLevel(WILD_LEVEL_FRACTION.max, row.cap, row.cap), `badge ${row.badge} cap max`).toBe(
        row.max,
      );
      expect(row.min, `badge ${row.badge} cap min floors`).toBe(
        Math.floor(row.cap * WILD_LEVEL_FRACTION.min),
      );
      expect(row.max, `badge ${row.badge} cap max floors`).toBe(
        Math.floor(row.cap * WILD_LEVEL_FRACTION.max),
      );
    }
  });
});
