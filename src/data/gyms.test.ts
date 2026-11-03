import { describe, expect, it } from 'vitest';
import { getSpecies } from './dex/species';
import { GYMS, gymForBadge } from './gyms';
import { isTmItemId } from './tms';
import {
  LEADER_IDENTITIES,
  TRAINER_ARCHETYPE_IDS,
  getTrainerArchetype,
  leaderIdentity,
} from './trainers';

describe('GYMS', () => {
  it('ships eight gyms in badge order, one TM each, no duplicates', () => {
    expect(GYMS.map((row) => row.badge)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(GYMS.map((row) => row.tmItemId)).size).toBe(GYMS.length);
    for (const row of GYMS) {
      expect(isTmItemId(row.tmItemId), row.tmItemId).toBe(true);
      expect(row.moneyMultiplier, row.tmItemId).toBeGreaterThan(0);
      expect(row.partySize, row.tmItemId).toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps gym 1's fixed three the only fixed party", () => {
    const fixed = GYMS.filter((row) => row.fixedParty !== undefined);
    expect(fixed.map((row) => row.badge)).toEqual([1]);
    const row = fixed[0];
    expect(row.fixedParty).toHaveLength(3);
    expect(new Set(row.fixedParty).size).toBe(3);
    for (const speciesId of row.fixedParty!) {
      expect(getSpecies(speciesId), speciesId).toBeDefined();
    }
    expect(row.partySize).toBe(3);
    for (const other of GYMS) {
      if (other.badge === 1) continue;
      expect(other.fixedParty, `badge ${other.badge}`).toBeUndefined();
    }
  });

  it('rolls a double battle on a tenth of every other gym', () => {
    expect(gymForBadge(1).doubleChance).toBe(0);
    for (const row of GYMS) {
      if (row.badge === 1) continue;
      expect(row.doubleChance, `badge ${row.badge}`).toBe(0.1);
    }
  });

  it('resolves every leader through trainers.ts and every TM through tms.ts', () => {
    for (const row of GYMS) {
      const identity = leaderIdentity(row.leaderId);
      expect(identity, row.leaderId).toBeDefined();
      expect(identity!.name, row.leaderId).not.toBe('');
      expect(identity!.className, row.leaderId).not.toBe('');
      expect(TRAINER_ARCHETYPE_IDS, row.archetypeId).toContain(row.archetypeId);
      expect(getTrainerArchetype(row.leaderId), row.leaderId).toBeUndefined();
      expect(isTmItemId(row.tmItemId), row.tmItemId).toBe(true);
    }
    expect(LEADER_IDENTITIES).toHaveLength(GYMS.length);
    expect(leaderIdentity('leader-9')).toBeUndefined();
  });

  it('gymForBadge reads the ladder and refuses a badge with no gym', () => {
    for (let badge = 1; badge <= 8; badge++) {
      expect(gymForBadge(badge), `badge ${badge}`).toBe(GYMS.find((row) => row.badge === badge));
    }
    for (const badge of [0, 9, 2.5]) {
      expect(() => gymForBadge(badge), `${badge}`).toThrow(`no gym for badge ${badge}`);
    }
  });
});
