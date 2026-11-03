import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { es } from '../i18n/es';
import { t } from '../i18n';
import {
  cityMissionFor,
  getMission,
  getStackMission,
  missionsOfKind,
  MISSION_TABLE,
  randomMissions,
  stackMissionsOfKind,
  STACK_MISSIONS,
  STRETCH_MISSION,
  STRETCH_MISSION_ID,
  type StackMissionKind,
} from './missions';

describe('MISSION_TABLE', () => {
  it('ships the flawless floor as its first row', () => {
    expect(MISSION_TABLE).toHaveLength(1);
    expect(MISSION_TABLE[0]).toEqual({
      id: 'flawless',
      kind: 'flawless',
      nameKey: 'mission.flawless',
      reward: { kind: 'room' },
    });
  });

  it('keeps the ids unique and resolves each name in both locales', () => {
    const ids = MISSION_TABLE.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const row of MISSION_TABLE) expect(t(row.nameKey)).not.toBe('');
  });

  it('names only rewards the engine can pay', () => {
    for (const row of MISSION_TABLE) {
      expect(['room', 'item', 'money']).toContain(row.reward.kind);
    }
  });
});

describe('getMission', () => {
  it('reads a row back by id', () => {
    expect(getMission('flawless')?.kind).toBe('flawless');
    expect(getMission('flawless')).toBe(MISSION_TABLE[0]);
  });

  it('reads an unknown or empty id as nothing', () => {
    expect(getMission('no-such-mission')).toBeUndefined();
    expect(getMission('')).toBeUndefined();
  });
});

describe('missionsOfKind', () => {
  it('returns every row of a kind, in table order', () => {
    expect(missionsOfKind('flawless')).toEqual(MISSION_TABLE.filter((row) => row.kind === 'flawless'));
    expect(missionsOfKind('flawless')).toHaveLength(1);
  });

  it('covers the whole table, because one kind ships', () => {
    const ofKind = missionsOfKind('flawless');
    expect(ofKind.length).toBe(MISSION_TABLE.length);
  });
});

const KINDS: readonly StackMissionKind[] = ['stretch', 'city', 'random'];

describe('STACK_MISSIONS', () => {
  it('keeps the ids unique and names every scope at least once', () => {
    const ids = STACK_MISSIONS.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const kind of KINDS) expect(stackMissionsOfKind(kind).length, kind).toBeGreaterThan(0);
    for (const row of stackMissionsOfKind('stretch')) expect(row.kind).toBe('stretch');
    for (const row of stackMissionsOfKind('city')) expect(row.kind).toBe('city');
    for (const row of stackMissionsOfKind('random')) expect(row.kind).toBe('random');
  });

  it('names every row in both locales, with the same keys both ways', () => {
    for (const row of STACK_MISSIONS) {
      expect(row.nameKey in en, row.id).toBe(true);
      expect(row.nameKey in es, row.id).toBe(true);
      expect(en[row.nameKey], row.id).not.toBe('');
      expect(es[row.nameKey], row.id).not.toBe('');
      expect(t(row.nameKey), row.id).not.toBe('');
    }
  });

  it('names only rewards the engine can pay', () => {
    for (const row of STACK_MISSIONS) {
      expect(['room', 'item', 'money']).toContain(row.reward.kind);
    }
  });

  it('holds the stretch row once, as the automatic one', () => {
    expect(STACK_MISSIONS).toContain(STRETCH_MISSION);
    expect(stackMissionsOfKind('stretch')).toHaveLength(1);
    expect(STRETCH_MISSION_ID).toBe(STRETCH_MISSION.id);
    expect(STRETCH_MISSION.kind).toBe('stretch');
    expect(getStackMission(STRETCH_MISSION_ID)).toBe(STRETCH_MISSION);
    expect(stackMissionsOfKind('stretch')).toStrictEqual([STRETCH_MISSION]);
  });
});

describe('getStackMission', () => {
  it('reads a row back by id, and an unknown id as nothing', () => {
    for (const row of STACK_MISSIONS) expect(getStackMission(row.id)).toBe(row);
    expect(getStackMission('no-such-mission')).toBeUndefined();
    expect(getStackMission('')).toBeUndefined();
    // The two catalogues never collide: the legacy row is not a stack row.
    expect(getStackMission('flawless')).toBeUndefined();
  });
});

describe('cityMissionFor', () => {
  it('answers a city row for every rung of the ladder', () => {
    const tiers = [1, 2, 3] as const;
    const ids = tiers.map((tier) => cityMissionFor(tier).id);
    for (const tier of tiers) {
      const row = cityMissionFor(tier);
      expect(row.kind, String(tier)).toBe('city');
      expect(getStackMission(row.id), String(tier)).toBe(row);
      expect(stackMissionsOfKind('city'), String(tier)).toContain(row);
    }
    expect(new Set(ids).size).toBe(tiers.length);
    expect(cityMissionFor(1)).toBe(cityMissionFor(1));
  });

  it('scales the pay with the rung', () => {
    const amounts = [1, 2, 3].map((tier) => {
      const reward = cityMissionFor(tier as 1 | 2 | 3).reward;
      return reward.kind === 'money' ? reward.amount : 0;
    });
    expect(amounts[0]).toBeGreaterThan(0);
    expect(amounts[1]).toBeGreaterThan(amounts[0]);
    expect(amounts[2]).toBeGreaterThan(amounts[1]);
  });
});

describe('randomMissions', () => {
  it('is the NPC s pool: never empty, all of one scope, in table order', () => {
    const pool = randomMissions();
    expect(pool.length).toBeGreaterThan(0);
    expect(pool).toStrictEqual(STACK_MISSIONS.filter((row) => row.kind === 'random'));
    for (const row of pool) expect(row.kind).toBe('random');
  });
});

describe('the legacy floor exports', () => {
  it('still answer exactly as before, beside the stack catalogue', () => {
    expect(MISSION_TABLE).toHaveLength(1);
    expect(MISSION_TABLE[0]).toEqual({
      id: 'flawless',
      kind: 'flawless',
      nameKey: 'mission.flawless',
      reward: { kind: 'room' },
    });
    expect(getMission('flawless')).toBe(MISSION_TABLE[0]);
    expect(missionsOfKind('flawless')).toStrictEqual(MISSION_TABLE);
    expect(t('mission.flawless')).not.toBe('');
  });
});
