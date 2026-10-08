import { describe, expect, it } from 'vitest';
import { learnsetOf, type LearnSource } from '../../data/dex/learnsets';
import { getMove, isDamaging } from '../../data/dex/moves';
import { playableSpecies } from '../../data/dex/species';
import { defaultMoveset } from './fighter';
import { randomLearnset, randomLevelUpMoves } from './randomLearnset';

const SEED = 'random-learnset-test';

const FIXED_DAMAGE_IDS = new Set([
  'seismictoss',
  'nightshade',
  'superfang',
  'ruination',
  'endeavor',
  'finalgambit',
]);

const isFixedDamage = (moveId: string): boolean =>
  FIXED_DAMAGE_IDS.has(moveId) || getMove(moveId)?.damage !== undefined;

/** The best level-up level per move of a parsed learnset, sorted ascending. */
function levelMultiset(learnset: Readonly<Record<string, readonly LearnSource[]>>): number[] {
  const levels: number[] = [];
  for (const sources of Object.values(learnset)) {
    let best: LearnSource | undefined;
    for (const source of sources) {
      if (source.method !== 'level' || source.level === null) continue;
      if (!best || source.gen > best.gen) best = source;
    }
    if (best && best.level !== null) levels.push(best.level);
  }
  return levels.sort((a, b) => a - b);
}

const SAMPLE = playableSpecies().filter((_, i) => i % 17 === 0);

describe('randomLearnset', () => {
  it('is a pure function of species and seed', () => {
    expect(randomLearnset('charmander', SEED)).toEqual(randomLearnset('charmander', SEED));
    expect(randomLearnset('charmander', 'one-seed')).not.toEqual(
      randomLearnset('charmander', 'another-seed'),
    );
  });

  it('returns undefined for a species with no learnset', () => {
    expect(randomLearnset('not-a-species', SEED)).toBeUndefined();
  });

  it('keeps the canonical level multiset for every species', () => {
    for (const species of playableSpecies()) {
      const canonical = learnsetOf(species.id);
      if (!canonical) continue;
      const random = randomLearnset(species.id, SEED);
      expect(random, species.id).toBeDefined();
      const before = levelMultiset(canonical);
      const after = levelMultiset(random!);
      // A species with no level-up moves gets one level-1 slot by design.
      expect(after, species.id).toEqual(before.length === 0 ? [1] : before);
    }
  });

  it('never rolls Struggle or an OHKO move', () => {
    for (const species of SAMPLE) {
      const learnset = randomLearnset(species.id, SEED);
      if (!learnset) continue;
      for (const moveId of Object.keys(learnset)) {
        expect(moveId, species.id).not.toBe('struggle');
        expect(getMove(moveId)?.ohko ?? false, `${species.id}:${moveId}`).toBe(false);
      }
    }
  });

  it('keeps fixed-damage moves at level 20 or higher', () => {
    for (const species of SAMPLE) {
      const learnset = randomLearnset(species.id, SEED);
      if (!learnset) continue;
      for (const [moveId, sources] of Object.entries(learnset)) {
        if (!isFixedDamage(moveId)) continue;
        for (const source of sources) {
          if (source.method === 'level') {
            expect(source.level, `${species.id}:${moveId}`).toBeGreaterThanOrEqual(20);
          } else {
            expect(source.method, `${species.id}:${moveId}`).not.toBe('tm');
          }
        }
      }
    }
  });

  it('opens the level-up list with a damaging move', () => {
    for (const species of SAMPLE) {
      const moves = randomLevelUpMoves(species.id, 100, SEED);
      if (moves.length === 0) continue;
      expect(isDamaging(getMove(moves[0].moveId)!), species.id).toBe(true);
    }
  });

  it('keeps at least 60% damage and 20% status in the level-up learnset', () => {
    for (const species of SAMPLE) {
      const moves = randomLevelUpMoves(species.id, 100, SEED);
      if (moves.length < 5) continue;
      const damage = moves.filter((move) => isDamaging(getMove(move.moveId)!)).length;
      const status = moves.length - damage;
      expect(damage / moves.length, species.id).toBeGreaterThanOrEqual(0.6);
      expect(status / moves.length, species.id).toBeGreaterThanOrEqual(0.2);
    }
  });

  it('orders the damaging moves least power to most', () => {
    for (const species of SAMPLE) {
      const powers = randomLevelUpMoves(species.id, 100, SEED)
        .map((move) => move.moveId)
        .filter((moveId) => !isFixedDamage(moveId))
        .map((moveId) => getMove(moveId)!)
        .filter((move) => move.category !== 'Status')
        .map((move) => move.basePower);
      for (let i = 1; i < powers.length; i++) {
        expect(powers[i], species.id).toBeGreaterThanOrEqual(powers[i - 1]);
      }
    }
  });

  it('randomizes every learn method, not only level-up', () => {
    const canonical = learnsetOf('charmander')!;
    const random = randomLearnset('charmander', SEED)!;
    const methods = (learnset: Readonly<Record<string, readonly LearnSource[]>>) => {
      const counts = { level: 0, tm: 0, tutor: 0, egg: 0, other: 0 };
      for (const sources of Object.values(learnset)) {
        for (const source of sources) counts[source.method]++;
      }
      return counts;
    };
    const distinct = (learnset: Readonly<Record<string, readonly LearnSource[]>>) => {
      const counts = { level: 0, tm: 0, tutor: 0, egg: 0 };
      for (const sources of Object.values(learnset)) {
        if (sources.some((source) => source.method === 'level')) counts.level++;
        if (sources.some((source) => source.method === 'tm')) counts.tm++;
        if (sources.some((source) => source.method === 'tutor')) counts.tutor++;
        if (sources.some((source) => source.method === 'egg')) counts.egg++;
      }
      return counts;
    };
    expect(distinct(random)).toEqual(distinct(canonical));
    expect(methods(random).level).toBeGreaterThan(0);
    expect(methods(random).tm).toBeGreaterThan(0);
    expect(methods(random).tutor).toBeGreaterThan(0);
    expect(methods(random).egg).toBeGreaterThan(0);
  });

  it('feeds the runtime moveset through defaultMoveset', () => {
    const moves = defaultMoveset('charmander', 30, SEED);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.length).toBeLessThanOrEqual(4);
    for (const moveId of moves) expect(getMove(moveId), moveId).toBeDefined();
  });
});
