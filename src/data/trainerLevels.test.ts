import { describe, expect, it } from 'vitest';
import { LEVEL_BANDS } from './run';
import { MAP_MAX_LEVEL } from './maps';
import { TRAINER_LEVEL_PERCENT, trainerLevel, trainerLevelPercent } from './trainerLevels';

describe('TRAINER_LEVEL_PERCENT', () => {
  it('pins every row of the table', () => {
    expect(TRAINER_LEVEL_PERCENT[1]).toBe(1);
    expect(TRAINER_LEVEL_PERCENT[2]).toBe(0.9);
    expect(TRAINER_LEVEL_PERCENT[3]).toBe(0.8);
    expect(TRAINER_LEVEL_PERCENT[4]).toBe(0.7);
    expect(Object.keys(TRAINER_LEVEL_PERCENT)).toHaveLength(4);
  });

  it('gives every shipped band a row, strictly weaker as the party grows', () => {
    let previous = Number.POSITIVE_INFINITY;
    for (const size of [1, 2, 3, 4]) {
      const percent = TRAINER_LEVEL_PERCENT[size as 1 | 2 | 3 | 4];
      expect(percent).toBeDefined();
      expect(percent).toBeLessThan(previous);
      previous = percent;
    }
    for (const band of LEVEL_BANDS) {
      expect([1, 2, 3, 4]).toContain(band.trainerSize);
      expect(TRAINER_LEVEL_PERCENT[band.trainerSize as 1 | 2 | 3 | 4]).toBeDefined();
    }
  });
});

describe('trainerLevelPercent', () => {
  it('reads the row of the party size', () => {
    expect(trainerLevelPercent(1)).toBe(1);
    expect(trainerLevelPercent(2)).toBe(0.9);
    expect(trainerLevelPercent(3)).toBe(0.8);
    expect(trainerLevelPercent(4)).toBe(0.7);
  });

  it('floors the size before reading the row', () => {
    expect(trainerLevelPercent(2.6)).toBe(0.9);
    expect(trainerLevelPercent(1.99)).toBe(1);
  });

  it('clamps an out-of-table size to the nearest row', () => {
    expect(trainerLevelPercent(0)).toBe(1);
    expect(trainerLevelPercent(-3)).toBe(1);
    expect(trainerLevelPercent(5)).toBe(0.7);
    expect(trainerLevelPercent(9)).toBe(0.7);
    expect(trainerLevelPercent(Number.NaN)).toBe(1);
    expect(trainerLevelPercent(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe('trainerLevel', () => {
  it('holds the pinned values', () => {
    expect(trainerLevel(20, 1, 30)).toBe(20);
    expect(trainerLevel(20, 2, 30)).toBe(18);
    expect(trainerLevel(20, 3, 30)).toBe(16);
    expect(trainerLevel(20, 4, 30)).toBe(14);
    expect(trainerLevel(15, 4, 30)).toBe(10);
    expect(trainerLevel(5, 4, 30)).toBe(3);
    expect(trainerLevel(1, 4, 30)).toBe(1);
    expect(trainerLevel(0, 1, 30)).toBe(1);
    expect(trainerLevel(40, 1, 30)).toBe(30);
    expect(trainerLevel(60, 2, 30)).toBe(30);
    expect(trainerLevel(55, 1, 55)).toBe(55);
    expect(trainerLevel(9, 1, 9)).toBe(9);
    expect(trainerLevel(10, 1, 9)).toBe(9);
  });

  it('floors the product instead of rounding it', () => {
    expect(trainerLevel(15, 4, 30)).toBe(10);
    expect(trainerLevel(13, 4, 30)).toBe(9);
    expect(trainerLevel(23, 3, 30)).toBe(18);
  });

  it('falls back to the map ceiling when the cap is not finite', () => {
    expect(trainerLevel(500, 1, Number.NaN)).toBe(MAP_MAX_LEVEL);
    expect(trainerLevel(500, 1, Number.POSITIVE_INFINITY)).toBe(MAP_MAX_LEVEL);
  });

  it('treats a non-finite squad level as zero and never drops below one', () => {
    expect(trainerLevel(Number.NaN, 1, 30)).toBe(1);
    expect(trainerLevel(Number.POSITIVE_INFINITY, 1, 30)).toBe(1);
    expect(trainerLevel(-5, 1, 30)).toBe(1);
  });
});
