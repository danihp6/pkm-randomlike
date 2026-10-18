import { describe, expect, it } from 'vitest';
import { createRunPokemon, type RunPokemon } from './progression';
import { releaseFainted } from './perms';
import { addPokemon, createRun } from './state';

const starter = createRunPokemon({
  id: 'starter',
  speciesId: 'charmander',
  level: 5,
  moves: ['scratch'],
});

function hurt(pokemon: RunPokemon, hp: number): RunPokemon {
  return { ...pokemon, fighter: { ...pokemon.fighter, hp } };
}

describe('releaseFainted', () => {
  it('removes a fainted member from the party and reports it', () => {
    const run = createRun({ seed: 's', starter });
    const fallen = hurt(starter, 0);
    const result = releaseFainted({ ...run, party: [fallen, starter] });
    expect(result.released.map((member) => member.fighter.id)).toEqual(['starter']);
    expect(result.run.party.map((member) => member.fighter.id)).toEqual(['starter']);
  });

  it('counts the lost members for the run summary', () => {
    const run = createRun({ seed: 's', starter });
    const fallen = hurt(starter, 0);
    const result = releaseFainted({ ...run, party: [fallen] });
    expect(result.run.stats.casualties).toBe(1);
    expect(releaseFainted(result.run).run.stats.casualties).toBe(1);
  });

  it('removes a fainted member from the box too (D5)', () => {
    const run = createRun({ seed: 's', starter });
    const boxed = createRunPokemon({ id: 'boxed', speciesId: 'sentret', level: 3 });
    const withBox = addPokemon({ ...run, party: Array(6).fill(starter) }, boxed);
    const result = releaseFainted({ ...withBox, box: [hurt(boxed, 0)] });
    expect(result.released.map((member) => member.fighter.id)).toEqual(['boxed']);
    expect(result.run.box).toEqual([]);
  });

  it('returns the same run when nobody fainted', () => {
    const run = createRun({ seed: 's', starter });
    const result = releaseFainted(run);
    expect(result.run).toBe(run);
    expect(result.released).toEqual([]);
  });
});
