import { describe, expect, it } from 'vitest';
import { restoreFighter } from '../battle/fighter';
import { createRunPokemon, type RunPokemon } from './progression';
import { healParty } from './heal';
import { addPokemon, createRun, type RunState } from './state';

const starter = createRunPokemon({ id: 'starter', speciesId: 'charmander', level: 5, moves: ['scratch', 'ember'] });
const starterMaxHp = restoreFighter(starter.fighter).maxHp;

function damaged(pokemon: RunPokemon, hp: number, pp: number): RunPokemon {
  return {
    ...pokemon,
    fighter: {
      ...pokemon.fighter,
      hp,
      moves: pokemon.fighter.moves.map((slot) => ({ ...slot, pp })),
    },
  };
}

describe('healParty', () => {
  it('restores HP and PP but keeps status', () => {
    const hurt = damaged({ ...starter, fighter: { ...starter.fighter, status: 'psn' as const } }, 3, 1);
    const run = createRun({ seed: 's', starter: hurt });
    const healed = healParty(run).party[0].fighter;
    expect(healed.hp).toBe(starterMaxHp);
    expect(healed.moves.every((slot) => slot.pp === slot.maxPp)).toBe(true);
    expect(healed.status).toBe('psn');
  });

  it('does not resurrect a fainted member (D5)', () => {
    const run = createRun({ seed: 's', starter: damaged(starter, 0, 1) });
    expect(healParty(run).party[0].fighter.hp).toBe(0);
  });

  it('heals the box too', () => {
    const boxed = damaged(createRunPokemon({ id: 'boxed', speciesId: 'sentret', level: 4 }), 2, 0);
    const full: RunState = { ...createRun({ seed: 's', starter }), party: Array(6).fill(starter) };
    const healed = healParty(addPokemon(full, boxed));
    expect(healed.box[0].fighter.hp).toBeGreaterThan(2);
    expect(healed.box[0].fighter.moves.every((slot) => slot.pp === slot.maxPp)).toBe(true);
  });
});
