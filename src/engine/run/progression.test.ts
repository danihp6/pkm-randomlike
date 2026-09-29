import { describe, expect, it } from 'vitest';
import {
  MAX_LEVEL,
  awardExperience,
  createRunPokemon,
  evolveIfReady,
  experienceAward,
  experienceFraction,
  levelForXp,
  xpForLevel,
} from './progression';

describe('xp curve', () => {
  it('is the medium-fast cubic curve', () => {
    expect(xpForLevel(1)).toBe(1);
    expect(xpForLevel(5)).toBe(125);
    expect(xpForLevel(16)).toBe(4096);
    expect(xpForLevel(MAX_LEVEL)).toBe(1_000_000);
  });

  it('round-trips a level through its XP', () => {
    for (const level of [1, 2, 5, 16, 40, 100]) {
      expect(levelForXp(xpForLevel(level))).toBe(level);
      expect(levelForXp(xpForLevel(level) - 1)).toBe(Math.max(1, level - 1));
    }
  });

  it('fractions the progress towards the next level and clamps', () => {
    expect(experienceFraction(xpForLevel(5), 5)).toBe(0);
    expect(experienceFraction(xpForLevel(6), 5)).toBe(1);
    expect(experienceFraction(xpForLevel(5) - 1, 5)).toBe(0);
    expect(experienceFraction(xpForLevel(6) + 1000, 5)).toBe(1);
    const mid = (xpForLevel(5) + xpForLevel(6)) / 2;
    expect(experienceFraction(mid, 5)).toBeCloseTo(0.5);
  });
});

describe('experienceAward', () => {
  it('scales with the defeated level and splits across participants', () => {
    expect(experienceAward(4)).toBe(20);
    expect(experienceAward(4, 2)).toBe(10);
    expect(experienceAward(4, 3)).toBe(6);
    expect(experienceAward(0)).toBe(5);
  });

  it('pays more for a trainer battle', () => {
    expect(experienceAward(10, 1, true)).toBe(75);
    expect(experienceAward(10, 1, true)).toBeGreaterThan(experienceAward(10));
  });
});

describe('awardExperience', () => {
  it('levels up, learns the crossed move and stops at the route cap', () => {
    const pokemon = createRunPokemon({ id: 'ember', speciesId: 'charmander', level: 1, moves: ['scratch'] });
    const first = awardExperience(pokemon, 20, 4);
    expect(first.pokemon.fighter.level).toBe(4);
    expect(first.pokemon.xp).toBe(101);
    expect(first.events).toContainEqual({ kind: 'xp', amount: 100, xp: 101 });
    expect(first.events).toContainEqual({ kind: 'level', level: 4 });
    expect(first.events).toContainEqual({ kind: 'learn', moveId: 'ember' });

    const capped = awardExperience(first.pokemon, 30, 4);
    expect(capped.pokemon.fighter.level).toBe(5);
    expect(capped.pokemon.xp).toBe(xpForLevel(5));
    expect(capped.events).toContainEqual({ kind: 'capped', level: 5 });
  });

  it('evolves once the level meets the evolution and the cap allows it', () => {
    const ready = createRunPokemon({ id: 'c', speciesId: 'charmander', level: 15, moves: ['ember'] });
    const evolved = awardExperience(ready, 150, 13);
    expect(evolved.pokemon.fighter.level).toBe(16);
    expect(evolved.pokemon.fighter.speciesId).toBe('charmeleon');
    expect(evolved.events).toContainEqual({ kind: 'evolve', from: 'charmander', into: 'charmeleon' });
  });

  it('holds an evolution that the route cap blocks', () => {
    const pokemon = createRunPokemon({ id: 'c', speciesId: 'charmander', level: 16, moves: ['ember'] });
    const blocked = evolveIfReady(pokemon, 1);
    expect(blocked.pokemon).toBe(pokemon);
    expect(blocked.events).toEqual([]);
    const allowed = evolveIfReady(pokemon, 13);
    expect(allowed.pokemon.fighter.speciesId).toBe('charmeleon');
  });

  it('forgets the oldest move when the fourth slot is full', () => {
    const pokemon = createRunPokemon({
      id: 'four',
      speciesId: 'charmander',
      level: 1,
      moves: ['scratch', 'growl', 'smokescreen', 'dragonbreath'],
    });
    const result = awardExperience(pokemon, 20, 4);
    const moves = result.pokemon.fighter.moves.map((slot) => slot.moveId);
    expect(moves).toContain('ember');
    expect(moves).not.toContain('scratch');
    expect(result.events).toContainEqual({ kind: 'learn', moveId: 'ember' });
    expect(result.events).toContainEqual({ kind: 'forget', moveId: 'scratch' });
  });
});
