import { describe, expect, it } from 'vitest';
import { getSpecies, statAtLevel } from '../../data/dex';
import {
  MAX_LEVEL,
  awardExperience,
  createRunPokemon,
  editRunPokemon,
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
  it('levels up, learns the crossed move and stops at the map cap', () => {
    const pokemon = createRunPokemon({ id: 'ember', speciesId: 'charmander', level: 1, moves: ['scratch'] });
    const first = awardExperience(pokemon, 20, 5);
    expect(first.pokemon.fighter.level).toBe(4);
    expect(first.pokemon.xp).toBe(101);
    expect(first.events).toContainEqual({ kind: 'xp', amount: 100, xp: 101 });
    expect(first.events).toContainEqual({ kind: 'level', level: 4 });
    expect(first.events).toContainEqual({ kind: 'learn', moveId: 'ember' });

    const capped = awardExperience(first.pokemon, 30, 5);
    expect(capped.pokemon.fighter.level).toBe(5);
    expect(capped.pokemon.xp).toBe(xpForLevel(5));
    expect(capped.events).toContainEqual({ kind: 'capped', level: 5 });
  });

  it('evolves once the level meets the evolution and the cap allows it', () => {
    const ready = createRunPokemon({ id: 'c', speciesId: 'charmander', level: 15, moves: ['ember'] });
    const evolved = awardExperience(ready, 150, 20);
    expect(evolved.pokemon.fighter.level).toBe(16);
    expect(evolved.pokemon.fighter.speciesId).toBe('charmeleon');
    expect(evolved.events).toContainEqual({ kind: 'evolve', from: 'charmander', into: 'charmeleon' });
  });

  it('holds an evolution that the map cap blocks', () => {
    const pokemon = createRunPokemon({ id: 'c', speciesId: 'charmander', level: 16, moves: ['ember'] });
    const blocked = evolveIfReady(pokemon, 5);
    expect(blocked.pokemon).toBe(pokemon);
    expect(blocked.events).toEqual([]);
    const allowed = evolveIfReady(pokemon, 20);
    expect(allowed.pokemon.fighter.speciesId).toBe('charmeleon');
  });

  it('forgets the oldest move when the fourth slot is full', () => {
    const pokemon = createRunPokemon({
      id: 'four',
      speciesId: 'charmander',
      level: 1,
      moves: ['scratch', 'growl', 'smokescreen', 'dragonbreath'],
    });
    const result = awardExperience(pokemon, 20, 5);
    const moves = result.pokemon.fighter.moves.map((slot) => slot.moveId);
    expect(moves).toContain('ember');
    expect(moves).not.toContain('scratch');
    expect(result.events).toContainEqual({ kind: 'learn', moveId: 'ember' });
    expect(result.events).toContainEqual({ kind: 'forget', moveId: 'scratch' });
  });
});

describe('editRunPokemon', () => {
  it('changes the level and re-derives its XP, keeping the moveset', () => {
    const pokemon = createRunPokemon({ id: 'c', speciesId: 'charmander', level: 5, moves: ['ember'] });
    const edited = editRunPokemon(pokemon, { level: 20 });
    expect(edited.fighter.level).toBe(20);
    expect(edited.xp).toBe(xpForLevel(20));
    expect(edited.fighter.moves.map((slot) => slot.moveId)).toEqual(['ember']);
  });

  it('clamps the level to 1..MAX and keeps it on a non-finite value', () => {
    const pokemon = createRunPokemon({ id: 'c', speciesId: 'charmander', level: 5 });
    expect(editRunPokemon(pokemon, { level: 0 }).fighter.level).toBe(1);
    expect(editRunPokemon(pokemon, { level: 999 }).fighter.level).toBe(MAX_LEVEL);
    expect(editRunPokemon(pokemon, { level: Number.NaN }).fighter.level).toBe(5);
  });

  it('sets moves from the dex, dropping unknown ids and duplicates', () => {
    const pokemon = createRunPokemon({ id: 'c', speciesId: 'charmander', level: 5, moves: ['scratch'] });
    const edited = editRunPokemon(pokemon, { moves: ['ember', 'not-a-move', 'ember', 'growl'] });
    expect(edited.fighter.moves.map((slot) => slot.moveId)).toEqual(['ember', 'growl']);
    for (const slot of edited.fighter.moves) expect(slot.pp).toBe(slot.maxPp);
  });

  it('keeps the moveset when every proposed move is unknown', () => {
    const pokemon = createRunPokemon({ id: 'c', speciesId: 'charmander', level: 5, moves: ['scratch'] });
    const edited = editRunPokemon(pokemon, { moves: ['not-a-move'] });
    expect(edited.fighter.moves.map((slot) => slot.moveId)).toEqual(['scratch']);
  });

  it('sets an off-species ability and a nature', () => {
    const pokemon = createRunPokemon({ id: 'c', speciesId: 'charmander', level: 10 });
    const edited = editRunPokemon(pokemon, { ability: 'Levitate', nature: 'adamant' });
    expect(edited.fighter.ability).toBe('Levitate');
    expect(edited.fighter.nature).toBe('adamant');
  });

  it('heals to the new maximum on a level change and keeps HP else', () => {
    const pokemon = createRunPokemon({ id: 'c', speciesId: 'charmander', level: 5, moves: ['ember'] });
    const hurt = { ...pokemon, fighter: { ...pokemon.fighter, hp: 1 } };
    const bumped = editRunPokemon(hurt, { level: 20 });
    const maxHp = statAtLevel(getSpecies('charmander')!, 20, hurt.fighter.nature, hurt.fighter.ivs, hurt.fighter.evs).hp;
    expect(bumped.fighter.hp).toBe(maxHp);
    expect(editRunPokemon(hurt, { moves: ['growl'] }).fighter.hp).toBe(1);
  });
});
