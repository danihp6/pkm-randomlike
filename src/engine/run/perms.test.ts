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

function dead(id: string): RunPokemon {
  return hurt(createRunPokemon({ id, speciesId: 'sentret', level: 3 }), 0);
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

  it('records the fallen in party-then-box order, once', () => {
    const run = createRun({ seed: 's', starter });
    const alive = createRunPokemon({ id: 'alive', speciesId: 'sentret', level: 3 });
    const withFallen = {
      ...run,
      party: [dead('dead1'), alive, dead('dead2')],
      box: [dead('dead3')],
    };
    const result = releaseFainted(withFallen);
    expect(result.run.rip.map((member) => member.fighter.id)).toEqual(['dead1', 'dead2', 'dead3']);
    expect(result.run.stats.casualties).toBe(3);
    expect(result.run.party.map((member) => member.fighter.id)).toEqual(['alive']);
    expect(result.run.box).toEqual([]);
    // A second pass finds nobody fainted, so nothing is ever recorded twice.
    expect(releaseFainted(result.run).run).toBe(result.run);
    expect(result.run.rip).toHaveLength(3);
  });

  it('keeps the recorded snapshots at 0 HP and the healthy members untouched', () => {
    const run = createRun({ seed: 's', starter });
    const alive = createRunPokemon({ id: 'alive', speciesId: 'sentret', level: 3 });
    const fallen = dead('dead1');
    const result = releaseFainted({ ...run, party: [fallen, alive] });
    expect(result.run.rip).toHaveLength(1);
    expect(result.run.rip[0].fighter.hp).toBe(0);
    expect(result.run.rip[0]).toEqual(fallen);
    expect(result.run.party).toEqual([alive]);
  });
});
