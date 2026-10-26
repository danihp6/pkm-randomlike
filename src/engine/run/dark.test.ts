import { describe, expect, it } from 'vitest';
import { getAbility } from '../../data/dex';
import { DARK_CHANCE } from '../../data/run';
import { hashSeed, Rng } from '../rng';
import { createRunPokemon, type RunPokemon } from './progression';
import { DARK_ABILITY, DARK_ABILITY_NAME, asDark, isDarkCatch } from './dark';

const SEED = 'run-dark';

function member(overrides: Partial<RunPokemon['fighter']> = {}): RunPokemon {
  const base = createRunPokemon({
    id: 'wild',
    speciesId: 'sentret',
    level: 4,
    moves: ['tackle'],
    ability: 'Run Away',
  });
  return { ...base, fighter: { ...base.fighter, ...overrides } };
}

describe('the dark data', () => {
  it('names an ability the dex actually carries', () => {
    expect(DARK_ABILITY).toBe('darkmatter');
    expect(DARK_ABILITY_NAME).toBe('Dark Matter');
    expect(getAbility(DARK_ABILITY)?.name).toBe(DARK_ABILITY_NAME);
    expect(DARK_CHANCE).toBe(0.05);
  });
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

describe('asDark', () => {
  it('makes the old ability the second slot, on the member and on its snapshot', () => {
    const dark = asDark(member());
    expect(dark.dark).toBe(true);
    expect(dark.fighter.ability).toBe(DARK_ABILITY_NAME);
    expect(dark.fighter.secondAbility).toBe('Run Away');
    expect(dark.secondAbility).toBe('Run Away');
  });

  it('keeps every other field of the member', () => {
    const plain = member({ heldItem: 'oranberry' });
    const dark = asDark(plain);
    expect(dark.fighter).toEqual({
      ...plain.fighter,
      ability: DARK_ABILITY_NAME,
      secondAbility: 'Run Away',
    });
    expect(dark.fighter.hp).toBe(plain.fighter.hp);
    expect(dark.fighter.moves).toBe(plain.fighter.moves);
  });

  it('returns an already-dark member as the same reference', () => {
    const dark = asDark(member());
    expect(asDark(dark)).toBe(dark);
  });

  it('writes no second slot when the primary is already Dark Matter', () => {
    const already = member({ ability: DARK_ABILITY_NAME });
    const dark = asDark(already);
    expect(dark.dark).toBe(true);
    expect(dark.fighter.ability).toBe(DARK_ABILITY_NAME);
    expect('secondAbility' in dark.fighter).toBe(false);
    expect('secondAbility' in dark).toBe(false);
  });

  it('falls back to a granted second slot when its primary already is Dark Matter', () => {
    const granted = { ...member({ ability: DARK_ABILITY_NAME }), secondAbility: 'Pickup' };
    const dark = asDark(granted);
    expect(dark.fighter.secondAbility).toBe('Pickup');
    expect(dark.secondAbility).toBe('Pickup');
  });

  it('lets the rolled ability win over a second slot the member already carried', () => {
    const granted = { ...member(), secondAbility: 'Pickup' };
    const dark = asDark(granted);
    expect(dark.fighter.secondAbility).toBe('Run Away');
    expect(dark.secondAbility).toBe('Run Away');
  });

  it('reads no RNG: the same member always comes back the same', () => {
    const plain = member();
    expect(asDark(plain)).toEqual(asDark(plain));
  });
});
