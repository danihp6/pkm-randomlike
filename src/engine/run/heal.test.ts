import { describe, expect, it } from 'vitest';
import { restoreFighter } from '../battle/fighter';
import { createRunPokemon, type RunPokemon } from './progression';
import { fullHealMember, healParty, usePokevial } from './heal';
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

describe('usePokevial', () => {
  it('rests the party and the box, spending one charge', () => {
    const hurt = damaged(starter, 3, 1);
    const boxed = damaged(createRunPokemon({ id: 'boxed', speciesId: 'sentret', level: 4 }), 2, 0);
    const full: RunState = { ...createRun({ seed: 's', starter: hurt }), party: Array(6).fill(hurt) };
    const used = usePokevial(addPokemon(full, boxed));
    expect(used.pokevialCharges).toBe(0);
    expect(used.party[0].fighter.hp).toBe(starterMaxHp);
    expect(used.party[0].fighter.moves.every((slot) => slot.pp === slot.maxPp)).toBe(true);
    expect(used.box[0].fighter.hp).toBeGreaterThan(2);
    expect(used.box[0].fighter.moves.every((slot) => slot.pp === slot.maxPp)).toBe(true);
  });

  it('never resurrects a fainted member (D5)', () => {
    const run = createRun({ seed: 's', starter: damaged(starter, 0, 1) });
    expect(usePokevial(run).party[0].fighter.hp).toBe(0);
  });

  it('is a no-op when no charge is left', () => {
    const spent = { ...createRun({ seed: 's', starter: damaged(starter, 3, 1) }), pokevialCharges: 0 };
    expect(usePokevial(spent)).toBe(spent);
  });
});

describe('fullHealMember', () => {
  it('restores HP, PP and status, and revives a fainted member', () => {
    const hurt = damaged({ ...starter, fighter: { ...starter.fighter, status: 'psn' as const } }, 0, 0);
    const healed = fullHealMember(hurt).fighter;
    expect(healed.hp).toBe(starterMaxHp);
    expect(healed.status).toBeNull();
    expect(healed.moves.every((slot) => slot.pp === slot.maxPp)).toBe(true);
  });
});
