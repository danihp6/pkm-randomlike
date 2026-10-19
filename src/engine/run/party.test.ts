import { describe, expect, it } from 'vitest';
import { GATES } from '../../data/gates';
import { getSpecies } from '../../data/dex/species';
import { memberTypes, partyHasType } from './party';
import { createRunPokemon, type RunPokemon } from './progression';
import { createRun, type RunState } from './state';

const SEED = 'pkm-111';

/** One member of a species, at a level that matters to nothing here. */
function member(speciesId: string): RunPokemon {
  return createRunPokemon({ id: speciesId, speciesId, level: 5, moves: ['scratch'] });
}

/** The run a predicate reads: the party and the box are the only inputs. */
function runWith(party: readonly RunPokemon[], box: readonly RunPokemon[] = []): RunState {
  return { ...createRun({ seed: SEED, starter: party[0] }), party, box };
}

/** A party, the day it was caught, before anything had a chance to heal it. */
function fainted(pokemon: RunPokemon): RunPokemon {
  return { ...pokemon, fighter: { ...pokemon.fighter, hp: 0 } };
}

/** Single-typed species: one case isolates one side of each union the table keyed. */
const BUG = member('caterpie');
const GRASS = member('chikorita');
const ROCK = member('nosepass');
const FIGHTING = member('machop');
const WATER = member('squirtle');

describe('memberTypes', () => {
  it('reads the species own types, the values createFighter stamps', () => {
    expect(memberTypes(BUG)).toEqual(getSpecies('caterpie')?.types);
    expect(memberTypes(WATER)).toEqual(['Water']);
  });

  it('answers no types for an unknown species id', () => {
    const unknown: RunPokemon = {
      ...BUG,
      fighter: { ...BUG.fighter, speciesId: 'not-a-species' },
    };
    expect(memberTypes(unknown)).toEqual([]);
  });
});

describe('partyHasType', () => {
  it('stands on single-typed species, so each case isolates one type', () => {
    const fixtures: readonly (readonly [RunPokemon, string])[] = [
      [BUG, 'Bug'],
      [GRASS, 'Grass'],
      [ROCK, 'Rock'],
      [FIGHTING, 'Fighting'],
      [WATER, 'Water'],
    ];
    for (const [pokemon, type] of fixtures) {
      expect(getSpecies(pokemon.fighter.speciesId)?.types, pokemon.fighter.speciesId).toEqual([type]);
    }
  });

  it('opens a bush for a Bug member and for a Grass one', () => {
    expect(partyHasType(runWith([BUG]), GATES.bush.types)).toBe(true);
    expect(partyHasType(runWith([GRASS]), GATES.bush.types)).toBe(true);
  });

  it('opens a rock for a Rock member and for a Fighting one', () => {
    expect(partyHasType(runWith([ROCK]), GATES.rock.types)).toBe(true);
    expect(partyHasType(runWith([FIGHTING]), GATES.rock.types)).toBe(true);
  });

  it('opens a pond for a Water member', () => {
    expect(partyHasType(runWith([WATER]), GATES.water.types)).toBe(true);
  });

  it('sees the type among several members', () => {
    expect(partyHasType(runWith([BUG, ROCK, WATER]), GATES.water.types)).toBe(true);
  });

  it('never asks the box', () => {
    expect(partyHasType(runWith([BUG], [GRASS]), GATES.bush.types)).toBe(true);
    expect(partyHasType(runWith([BUG], [GRASS]), GATES.water.types)).toBe(false);
    expect(partyHasType(runWith([BUG], [ROCK, FIGHTING]), GATES.rock.types)).toBe(false);
  });

  it('answers false for an empty list of types', () => {
    expect(partyHasType(runWith([BUG, GRASS, WATER]), [])).toBe(false);
  });

  it('answers false for an unknown species id on every member', () => {
    const unknown: RunPokemon = {
      ...GRASS,
      fighter: { ...GRASS.fighter, speciesId: 'not-a-species' },
    };
    expect(partyHasType(runWith([unknown]), GATES.bush.types)).toBe(false);
  });

  it('counts a member at 0 HP, whose status is none of its business', () => {
    expect(partyHasType(runWith([fainted(GRASS)]), GATES.bush.types)).toBe(true);
  });

  it('is case-insensitive on both sides', () => {
    expect(partyHasType(runWith([GRASS]), ['gRaSs'])).toBe(true);
    expect(partyHasType(runWith([GRASS]), ['GRASS', 'nowhere'])).toBe(true);
    expect(partyHasType(runWith([GRASS]), ['buG'])).toBe(false);
  });

  it('does not mutate the run it reads', () => {
    const run = runWith([BUG, GRASS]);
    const party = run.party;
    partyHasType(run, GATES.bush.types);
    expect(run.party).toBe(party);
    expect(memberTypes(BUG)).toEqual(['Bug']);
  });

  it('hands out a fresh array when a species is unknown, never a shared local', () => {
    const unknown: RunPokemon = {
      ...BUG,
      fighter: { ...BUG.fighter, speciesId: 'not-a-species' },
    };
    expect(memberTypes(unknown)).not.toBe(memberTypes(unknown));
  });
});
