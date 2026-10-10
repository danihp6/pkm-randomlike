import { describe, expect, it } from 'vitest';
import { getTrainerArchetype } from '../../data/trainers';
import { Rng } from '../rng';
import { bandForMap } from './floors';
import { BOSS_MONEY_MULTIPLIER, trainerMoney } from './reward';

const youngster = getTrainerArchetype('youngster')!;
const ace = getTrainerArchetype('ace')!;

describe('trainerMoney', () => {
  it('rolls the fixed base plus a jitter inside the band range', () => {
    const band = bandForMap(1);
    for (let seed = 0; seed < 50; seed++) {
      const amount = trainerMoney(youngster, band, new Rng(seed));
      expect(amount).toBeGreaterThanOrEqual(youngster.money.base);
      expect(amount).toBeLessThanOrEqual(youngster.money.base + youngster.money.jitter);
    }
  });

  it('is deterministic for the same rng seed', () => {
    const band = bandForMap(1);
    expect(trainerMoney(ace, band, new Rng(1234))).toBe(trainerMoney(ace, band, new Rng(1234)));
  });

  it('scales the reward with the map band', () => {
    const early = trainerMoney(youngster, bandForMap(1), new Rng(7));
    const end = trainerMoney(youngster, bandForMap(6), new Rng(7));
    expect(end).toBeGreaterThan(early);
  });

  it('pays a boss more than a regular trainer', () => {
    const band = bandForMap(3);
    const normal = trainerMoney(ace, band, new Rng(42));
    const boss = trainerMoney(ace, band, new Rng(42), BOSS_MONEY_MULTIPLIER);
    expect(boss).toBeGreaterThan(normal);
  });
});
