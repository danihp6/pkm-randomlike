import { describe, expect, it } from 'vitest';
import { BOSS_PARTY, bossPartySize } from './bosses';

describe('BOSS_PARTY', () => {
  it('pins the four numbers', () => {
    expect(BOSS_PARTY.boss.firstMap).toBe(3);
    expect(BOSS_PARTY.boss.size).toBe(6);
    expect(BOSS_PARTY.miniboss.firstMap).toBe(2);
    expect(BOSS_PARTY.miniboss.size).toBe(3);
  });

  it('keeps every row a whole, positive party', () => {
    for (const row of Object.values(BOSS_PARTY)) {
      expect(Number.isInteger(row.firstMap)).toBe(true);
      expect(Number.isInteger(row.size)).toBe(true);
      expect(row.firstMap).toBeGreaterThan(0);
      expect(row.size).toBeGreaterThan(0);
      expect(row.size).toBeGreaterThanOrEqual(row.firstMap);
    }
    expect(BOSS_PARTY.boss.size).toBeGreaterThan(BOSS_PARTY.miniboss.size);
  });
});

describe('bossPartySize', () => {
  it('fields a boss strictly more than a mini-boss on every map', () => {
    for (let mapIndex = 1; mapIndex <= 99; mapIndex++) {
      expect(bossPartySize('boss', mapIndex)).toBeGreaterThan(bossPartySize('miniboss', mapIndex));
    }
  });

  it('fields map 1 its own two numbers', () => {
    expect(bossPartySize('boss', 1)).toBe(3);
    expect(bossPartySize('miniboss', 1)).toBe(2);
  });

  it('fields the fixed size from map 2 on, infinite maps included', () => {
    for (const mapIndex of [2, 8, 99]) {
      expect(bossPartySize('boss', mapIndex)).toBe(6);
      expect(bossPartySize('miniboss', mapIndex)).toBe(3);
    }
  });

  it('falls back to the map-1 row on a degenerate index', () => {
    for (const mapIndex of [0, -1, -99, Number.NaN]) {
      expect(bossPartySize('boss', mapIndex)).toBe(BOSS_PARTY.boss.firstMap);
      expect(bossPartySize('miniboss', mapIndex)).toBe(BOSS_PARTY.miniboss.firstMap);
    }
  });
});
