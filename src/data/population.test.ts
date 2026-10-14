import { describe, expect, it } from 'vitest';
import { POPULATION } from './population';
import { LEVEL_BANDS } from './run';

const NEUTRAL = { trainerBonus: 0, guardChance: 1 };

describe('POPULATION', () => {
  it('covers every level band', () => {
    for (const band of LEVEL_BANDS) expect(POPULATION[band.id], band.id).toBeDefined();
  });

  it('pins the on-ramp rows and keeps every later band neutral', () => {
    expect(POPULATION.early).toEqual({ trainerBonus: -1, guardChance: 0.5 });
    expect(POPULATION.low).toEqual({ trainerBonus: -1, guardChance: 0.75 });
    expect(POPULATION.mid).toEqual(NEUTRAL);
    expect(POPULATION.high).toEqual(NEUTRAL);
    expect(POPULATION.late).toEqual(NEUTRAL);
    expect(POPULATION.end).toEqual(NEUTRAL);
  });

  it('keeps the trainer bonus an integer and the guard chance a probability', () => {
    for (const band of LEVEL_BANDS) {
      const row = POPULATION[band.id];
      expect(Number.isInteger(row.trainerBonus), `${band.id} bonus`).toBe(true);
      expect(row.guardChance, `${band.id} guard`).toBeGreaterThanOrEqual(0);
      expect(row.guardChance, `${band.id} guard`).toBeLessThanOrEqual(1);
    }
  });

  it('thins the two on-ramp bands, each on a strictly thinner row than neutral', () => {
    for (const id of ['early', 'low'] as const) {
      const row = POPULATION[id];
      expect(row.trainerBonus, `${id} bonus`).toBeLessThan(NEUTRAL.trainerBonus);
      expect(row.guardChance, `${id} guard`).toBeLessThan(NEUTRAL.guardChance);
    }
  });
});
