import { describe, expect, it } from 'vitest';
import { floorForRoute } from './floors';
import { capForRoute, clampToCap, reachedCap } from './levelCap';

describe('level cap', () => {
  it('reads the cap from the route map', () => {
    expect(capForRoute('run-a', 1)).toBe(floorForRoute('run-a', 1).maxLevel);
  });

  it('clamps a level into 1..cap', () => {
    expect(clampToCap(99, 5)).toBe(5);
    expect(clampToCap(3.9, 5)).toBe(3);
    expect(clampToCap(0, 5)).toBe(1);
    expect(clampToCap(-4, 5)).toBe(1);
  });

  it('reports when the cap is reached', () => {
    expect(reachedCap(4, 5)).toBe(false);
    expect(reachedCap(5, 5)).toBe(true);
    expect(reachedCap(6, 5)).toBe(true);
  });
});
