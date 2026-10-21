import { describe, expect, it } from 'vitest';
import {
  BOSS_OPENINGS,
  BOSS_PARTY,
  DOUBLE_ACTIVES,
  bossIsDouble,
  bossPartySize,
  type BossOpening,
} from './bosses';
import { ROOM_BATTLEFIELDS } from './battlefields';
import { BOOST_IDS } from '../engine/battle/fighter';

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

  it('fields at least a full double battle on every row', () => {
    for (const row of Object.values(BOSS_PARTY)) {
      expect(row.size).toBeGreaterThanOrEqual(DOUBLE_ACTIVES);
      expect(row.firstMap).toBeGreaterThanOrEqual(DOUBLE_ACTIVES);
    }
  });
});

describe('bossIsDouble', () => {
  it('makes the map boss a double battle and leaves the mini-boss single', () => {
    expect(bossIsDouble('boss')).toBe(true);
    expect(bossIsDouble('miniboss')).toBe(false);
    expect(DOUBLE_ACTIVES).toBe(2);
  });

  it('agrees with the row flag', () => {
    for (const kind of ['boss', 'miniboss'] as const) {
      expect(bossIsDouble(kind)).toBe(BOSS_PARTY[kind].double);
    }
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

describe('BOSS_OPENINGS', () => {
  function stagesOf(row: BossOpening): number[] {
    const stages: number[] = [];
    for (const stat of BOOST_IDS) {
      const stage = row.boosts[stat];
      if (stage !== undefined) stages.push(stage);
    }
    return stages;
  }
  it('is exactly two rows, one per side, in the order the boss roll draws from', () => {
    expect(BOSS_OPENINGS).toHaveLength(2);
    expect(BOSS_OPENINGS.map((row) => row.side)).toEqual(['run', 'boss']);
  });

  it('pins the two shipped rows', () => {
    expect(BOSS_OPENINGS).toEqual([
      { side: 'run', battlefield: 'endure', boosts: { spe: -1 } },
      { side: 'boss', battlefield: 'crit', boosts: { def: 1 } },
    ]);
  });

  it('names a battlefield row the room table holds', () => {
    const ids = ROOM_BATTLEFIELDS.map((row) => row.id);
    for (const row of BOSS_OPENINGS) {
      expect(ids, row.side).toContain(row.battlefield);
    }
  });

  it('sinks every run stage by at least one and lifts every boss stage by at least one', () => {
    for (const row of BOSS_OPENINGS) {
      const stages = stagesOf(row);
      expect(stages, row.side).not.toHaveLength(0);
      for (const stage of stages) {
        expect(Number.isInteger(stage), row.side).toBe(true);
        expect(stage).not.toBe(0);
        if (row.side === 'run') expect(stage).toBeLessThanOrEqual(-1);
        else expect(stage).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('never lets the two openings share a stat, so the launch merge needs no arithmetic', () => {
    const run = Object.keys(BOSS_OPENINGS[0].boosts);
    const boss = Object.keys(BOSS_OPENINGS[1].boosts);
    expect(run.filter((stat) => boss.includes(stat))).toEqual([]);
  });
});
