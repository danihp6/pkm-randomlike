import { describe, expect, it } from 'vitest';
import { LEVEL_BANDS, levelCapForRoute } from '../../data/run';
import { capForRoute, clampToCap, reachedCap } from './levelCap';

describe('level cap', () => {
  it('reads the cap from the route band', () => {
    expect(capForRoute(1)).toBe(levelCapForRoute(1));
    expect(capForRoute(1)).toBe(LEVEL_BANDS[0].maxLevel);
  });

  it('clamps a level into 1..cap', () => {
    expect(clampToCap(99, 1)).toBe(5);
    expect(clampToCap(3.9, 1)).toBe(3);
    expect(clampToCap(0, 1)).toBe(1);
    expect(clampToCap(-4, 1)).toBe(1);
  });

  it('reports when the cap is reached', () => {
    expect(reachedCap(4, 1)).toBe(false);
    expect(reachedCap(5, 1)).toBe(true);
    expect(reachedCap(6, 1)).toBe(true);
  });
});
