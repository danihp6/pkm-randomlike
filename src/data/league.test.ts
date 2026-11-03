import { describe, expect, it } from 'vitest';
import { isTypeName, TYPE_NAMES } from './dex/types';
import { LEAGUE, TOWER } from './league';
import { BADGE_CAPS, LEAGUE_LEVEL, badgeCap } from './region';
import { TRAINER_ARCHETYPE_IDS } from './trainers';

describe('LEAGUE', () => {
  it('ships five rows at the League level with distinct themes', () => {
    expect(LEAGUE).toHaveLength(5);
    expect(LEAGUE.map((row) => row.index)).toEqual([1, 2, 3, 4, 5]);
    expect(LEAGUE_LEVEL).toBe(60);
    expect(LEAGUE.every((row) => row.level === LEAGUE_LEVEL)).toBe(true);
    expect(new Set(LEAGUE.map((row) => row.type)).size).toBe(LEAGUE.length);
    for (const row of LEAGUE) {
      expect(isTypeName(row.type), row.type).toBe(true);
      expect(TYPE_NAMES, row.type).toContain(row.type);
    }
  });

  it('ends on a Champion row and starts on elite row 1', () => {
    expect(LEAGUE.map((row) => row.title)).toEqual(['elite', 'elite', 'elite', 'elite', 'champion']);
    expect(LEAGUE[LEAGUE.length - 1].className).toBe('Champion');
    expect(LEAGUE[0].className).toBe('Elite Four');
    for (const row of LEAGUE) {
      expect(row.partySize, row.name).toBeGreaterThanOrEqual(1);
    }
  });

  it('gives the tower no leader, no badge and no fixed party', () => {
    expect(TOWER.leaderId).toBeNull();
    expect(TOWER.partySize).toBeNull();
    expect(TOWER.badge).toBeNull();
    expect(TOWER.level).toBe(LEAGUE_LEVEL);
  });

  it('keeps every party size at least one and every archetype real', () => {
    for (const row of LEAGUE) {
      expect(TRAINER_ARCHETYPE_IDS, row.archetypeId).toContain(row.archetypeId);
      expect(row.name, `index ${row.index}`).not.toBe('');
      expect(row.className, `index ${row.index}`).not.toBe('');
      expect(row.partySize, row.name).toBeGreaterThanOrEqual(1);
    }
    for (const row of LEAGUE) expect(row.level, row.name).toBe(badgeCap(9));
    expect(TOWER.level).toBe(badgeCap(9));
    for (const cap of BADGE_CAPS) {
      expect(
        LEAGUE.map((row) => row.level),
        `cap ${cap}`,
      ).not.toContain(cap);
    }
  });
});
