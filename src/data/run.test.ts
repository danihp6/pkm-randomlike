import { describe, expect, it } from 'vitest';
import {
  LEVEL_BANDS,
  ROUTES_PER_BAND,
  RUN_CHAIN,
  bandForRoute,
  levelCapForRoute,
} from './run';

describe('level bands', () => {
  it('walks the bands every ROUTES_PER_BAND routes and clamps at the ends', () => {
    expect(bandForRoute(1).id).toBe('early');
    expect(bandForRoute(ROUTES_PER_BAND).id).toBe('early');
    expect(bandForRoute(ROUTES_PER_BAND + 1).id).toBe('low');
    expect(bandForRoute(999).id).toBe('end');
    expect(bandForRoute(0).id).toBe('early');
  });

  it('derives the route level cap from its band', () => {
    expect(levelCapForRoute(1)).toBe(LEVEL_BANDS[0].maxLevel);
    expect(levelCapForRoute(999)).toBe(LEVEL_BANDS[LEVEL_BANDS.length - 1].maxLevel);
  });

  it('keeps band levels monotonically rising', () => {
    for (let i = 1; i < LEVEL_BANDS.length; i++) {
      expect(LEVEL_BANDS[i].minLevel).toBeGreaterThan(LEVEL_BANDS[i - 1].minLevel);
      expect(LEVEL_BANDS[i].maxLevel).toBeGreaterThan(LEVEL_BANDS[i - 1].maxLevel);
    }
  });
});

describe('run chain', () => {
  it('has a finite length divisible into cadences', () => {
    expect(RUN_CHAIN.finiteLength).toBeGreaterThan(RUN_CHAIN.bossBlock);
    expect(RUN_CHAIN.bossBlock % RUN_CHAIN.minibossEvery).toBe(0);
  });
});
