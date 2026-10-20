import { describe, expect, it } from 'vitest';
import { t } from '../i18n';
import { getMission, missionsOfKind, MISSION_TABLE } from './missions';

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
