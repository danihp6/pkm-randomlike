import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAbility } from '../../data/dex';
import { DARK_CHANCE } from '../../data/run';
import { hashSeed, Rng } from '../rng';
import { createRunPokemon, type RunPokemon } from './progression';
import { asDark, darkAbilityNames, isDarkCatch } from './dark';
import { randomAbilityPool } from '../battle/randomAbility';
// The ability table's import is what registers the implemented set the pool reads.
import '../battle/effects/abilities';

const SEED = 'run-dark';

function member(id = 'catch-1', overrides: Partial<RunPokemon['fighter']> = {}): RunPokemon {
  const base = createRunPokemon({
    id,
    speciesId: 'sentret',
    level: 4,
    moves: ['tackle'],
    ability: 'Run Away',
  });
  return { ...base, fighter: { ...base.fighter, ...overrides } };
}

/** The draw rule the module freezes, written out here so a change to it fails loudly. */
function expectedPair(memberId: string, speciesId: string): readonly [string, string] {
  const pool = randomAbilityPool();
  const rng = new Rng(hashSeed(`dark-abilities:${memberId}:${speciesId}`));
  const first = rng.int(0, pool.length - 1);
  const raw = rng.int(0, pool.length - 2);
  const second = raw >= first ? raw + 1 : raw;
  return [pool[first].name, pool[second].name];
}

afterEach(() => {
  vi.doUnmock('../battle/randomAbility');
  vi.resetModules();
});

describe('isDarkCatch', () => {
  it('marks between 4 % and 6 % of 10 000 catches, within a point of DARK_CHANCE', () => {
    let hits = 0;
    for (let i = 1; i <= 10000; i++) {
      if (isDarkCatch(SEED, 1, 0, `catch-${i}`)) hits += 1;
    }
    const share = hits / 10000;
    expect(share).toBeGreaterThanOrEqual(0.04);
    expect(share).toBeLessThanOrEqual(0.06);
    expect(Math.abs(share - DARK_CHANCE)).toBeLessThanOrEqual(0.01);
  });

  it('answers the same pinned seed, map, room and catch id the same way', () => {
    expect(isDarkCatch(SEED, 1, 0, 'catch-8')).toBe(true);
    expect(isDarkCatch(SEED, 1, 0, 'catch-18')).toBe(true);
    expect(isDarkCatch(SEED, 1, 0, 'catch-1')).toBe(false);
    expect(isDarkCatch(SEED, 1, 0, 'catch-2')).toBe(false);
  });

  it('draws from a stream of its own, named by the catch', () => {
    for (const catchId of ['catch-1', 'catch-8']) {
      const own = new Rng(hashSeed(`${SEED}:dark:1:0:${catchId}`)).next() < DARK_CHANCE;
      expect(isDarkCatch(SEED, 1, 0, catchId), catchId).toBe(own);
      // The room and the map are part of the name, so another room reads another draw.
      expect(isDarkCatch(SEED, 2, 0, catchId)).toBe(
        new Rng(hashSeed(`${SEED}:dark:2:0:${catchId}`)).next() < DARK_CHANCE,
      );
    }
  });
});

describe('darkAbilityNames', () => {
  it('rolls two distinct names, both of them real dex abilities', () => {
    const [first, second] = darkAbilityNames('catch-1', 'sentret');
    expect(first).not.toBe(second);
    expect(getAbility(first), first).toBeDefined();
    expect(getAbility(second), second).toBeDefined();
    const ids = randomAbilityPool().map((ability) => ability.id);
    expect(ids).toContain(getAbility(first)!.id);
    expect(ids).toContain(getAbility(second)!.id);
  });

  it('pins the pair a fixed member and species draw', () => {
    expect(darkAbilityNames('catch-1', 'sentret')).toEqual(['Unseen Fist', 'Sticky Hold']);
  });

  it('counts down the pool with the deletion, never the same row twice', () => {
    for (const [memberId, speciesId] of [
      ['catch-1', 'sentret'],
      ['catch-2', 'sentret'],
      ['catch-3', 'zigzagoon'],
      ['member-99', 'gastly'],
    ]) {
      expect(darkAbilityNames(memberId, speciesId), memberId).toEqual(expectedPair(memberId, speciesId));
    }
  });

  it('answers the same pair for the same member and species, and another for another id', () => {
    expect(darkAbilityNames('catch-1', 'sentret')).toEqual(darkAbilityNames('catch-1', 'sentret'));
    expect(darkAbilityNames('catch-1', 'sentret')).not.toEqual(darkAbilityNames('catch-2', 'sentret'));
  });
});

describe('asDark', () => {
  it('writes the rolled pair into both slots, on the member and on its snapshot', () => {
    const plain = member();
    const [first, second] = darkAbilityNames(plain.fighter.id, plain.fighter.speciesId);
    const dark = asDark(plain);
    expect(dark.dark).toBe(true);
    expect(dark.fighter.ability).toBe(first);
    expect(dark.fighter.secondAbility).toBe(second);
    expect(dark.secondAbility).toBe(second);
  });

  it('does not keep the primary the member had', () => {
    const dark = asDark(member('catch-1', { ability: 'Run Away' }));
    expect(dark.fighter.ability).not.toBe('Run Away');
    expect(dark.fighter.ability).toBe(expectedPair('catch-1', 'sentret')[0]);
  });

  it('keeps every other field of the member', () => {
    const plain = member('catch-1', { heldItem: 'oranberry' });
    const dark = asDark(plain);
    expect(dark.fighter).toEqual({
      ...plain.fighter,
      ability: dark.fighter.ability,
      secondAbility: dark.fighter.secondAbility,
    });
    expect(dark.fighter.hp).toBe(plain.fighter.hp);
    expect(dark.fighter.moves).toBe(plain.fighter.moves);
  });

  it('returns an already-dark member as the same reference', () => {
    const dark = asDark(member());
    expect(asDark(dark)).toBe(dark);
  });

  it('replaces a second slot the member already carried with the rolled one', () => {
    const granted = { ...member(), secondAbility: 'Pickup' };
    const dark = asDark(granted);
    expect(dark.fighter.secondAbility).toBe(expectedPair('catch-1', 'sentret')[1]);
    expect(dark.secondAbility).toBe(expectedPair('catch-1', 'sentret')[1]);
  });

  it('reads only the catch’s own stream, so the same member always comes back the same', () => {
    const plain = member();
    expect(asDark(plain)).toEqual(asDark(plain));
  });

  it('leaves the member unchanged when the pool cannot supply two rows', async () => {
    vi.resetModules();
    vi.doMock('../battle/randomAbility', () => ({
      randomAbilityPool: () => [{ id: 'blaze', name: 'Blaze', desc: '', shortDesc: '' }],
      randomAbility: () => undefined,
    }));
    const isolated = await import('./dark');
    expect(isolated.darkAbilityNames('catch-1', 'sentret')).toEqual(['', '']);
    const plain = member();
    expect(isolated.asDark(plain)).toBe(plain);
  });
});
