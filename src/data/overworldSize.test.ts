import { describe, expect, it } from 'vitest';
import { heightOf } from './dex';
import { SPRITE_SIZE_EXPONENT, SPRITE_SIZE_REF_HEIGHT } from './spriteSize';
import {
  OVERWORLD_SCALE_EXPONENT,
  OVERWORLD_SCALE_MAX,
  OVERWORLD_SCALE_MIN,
  OVERWORLD_SCALE_REF_HEIGHT,
  overworldCellHeight,
  overworldDrawHeight,
  overworldScale,
} from './overworldSize';

// `heightOf` falls back to 1 m for an id the generated height table misses
// (`onix` and `wailord` are two of them), so the cap and the "decade apart" pair
// are pinned on the tallest species the dex really carries: `eternatus` (20 m).
const SPECIES = ['joltik', 'diglett', 'pikachu', 'bulbasaur', 'charizard', 'snorlax', 'onix', 'wailord'];

describe('overworldScale', () => {
  it('overworldScale is monotonic in canonical height', () => {
    const ascending = [...SPECIES].sort((a, b) => heightOf(a) - heightOf(b));
    for (let i = 1; i < ascending.length; i++) {
      expect(overworldScale(ascending[i]!)).toBeGreaterThanOrEqual(overworldScale(ascending[i - 1]!));
    }
    for (const id of ascending) {
      expect(overworldScale(id)).toBeGreaterThanOrEqual(OVERWORLD_SCALE_MIN);
      expect(overworldScale(id)).toBeLessThanOrEqual(OVERWORLD_SCALE_MAX);
    }
  });

  it('overworldScale is floored at 0.8 and capped at 1.6', () => {
    expect(overworldScale('diglett')).toBe(OVERWORLD_SCALE_MIN);
    expect(overworldScale('eternatus')).toBe(OVERWORLD_SCALE_MAX);
    expect(heightOf('eternatus')).toBe(20);
  });

  it("the curve is the battle sprite's power curve", () => {
    expect(OVERWORLD_SCALE_EXPONENT).toBe(SPRITE_SIZE_EXPONENT);
    expect(OVERWORLD_SCALE_REF_HEIGHT).toBe(SPRITE_SIZE_REF_HEIGHT);
    expect(overworldScale('bulbasaur')).toBeCloseTo(
      Math.pow(heightOf('bulbasaur') / SPRITE_SIZE_REF_HEIGHT, SPRITE_SIZE_EXPONENT),
      9,
    );
    expect(overworldScale('snorlax') / overworldScale('bulbasaur')).toBeCloseTo(Math.sqrt(2.1 / 0.7), 9);
  });

  it('a decade apart lands in the band and differs', () => {
    const small = overworldScale('diglett');
    const huge = overworldScale('eternatus');
    expect(heightOf('eternatus') / heightOf('diglett')).toBeGreaterThanOrEqual(10);
    expect(small).toBeGreaterThanOrEqual(OVERWORLD_SCALE_MIN);
    expect(huge).toBeLessThanOrEqual(OVERWORLD_SCALE_MAX);
    expect(huge / small).toBe(OVERWORLD_SCALE_MAX / OVERWORLD_SCALE_MIN);
    expect(OVERWORLD_SCALE_MAX / OVERWORLD_SCALE_MIN).toBe(2);
  });

  it("the drawn height and the cell height are the scale's own", () => {
    for (const id of ['diglett', 'eternatus']) {
      expect(overworldDrawHeight(id, 24)).toBe(24 * overworldScale(id));
      const cell = overworldCellHeight(id, 24);
      expect(Number.isInteger(cell)).toBe(true);
      expect(cell).toBeGreaterThanOrEqual(1);
      expect(cell).toBeLessThanOrEqual(24);
    }
    expect(overworldDrawHeight('diglett', 24)).toBeCloseTo(19.2, 10);
    expect(overworldDrawHeight('eternatus', 24)).toBeCloseTo(38.4, 10);
    expect(overworldCellHeight('diglett', 24)).toBe(12);
    expect(overworldCellHeight('eternatus', 24)).toBe(24);
    expect(overworldDrawHeight('bulbasaur', 24)).toBeCloseTo(20.08, 2);
    expect(overworldCellHeight('bulbasaur', 24)).toBe(13);
    expect(overworldScale('charizard')).toBeCloseTo(1.303840481, 9);
    expect(overworldCellHeight('charizard', 24)).toBe(20);
    expect(overworldScale('snorlax')).toBeCloseTo(1.449137675, 9);
    expect(overworldCellHeight('snorlax', 24)).toBe(22);
    expect(overworldScale('not-a-species')).toBe(1);
  });
});
