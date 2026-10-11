import { describe, expect, it } from 'vitest';
import { restoreFighter } from '../battle/fighter';
import { createRunPokemon, type RunPokemon } from './progression';
import { chargePokevial, fillPokevial, fullHealMember, healParty, usePokevial, POKEVIAL_MAX_CHARGES } from './heal';
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
  it('rests the party and the box and empties the full meter', () => {
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

  it('cures status across the party and the box', () => {
    const sick = { ...starter, fighter: { ...starter.fighter, status: 'par' as const, statusCounter: 3 } };
    const boxed = {
      ...createRunPokemon({ id: 'boxed', speciesId: 'sentret', level: 4 }),
      fighter: {
        ...createRunPokemon({ id: 'b', speciesId: 'sentret', level: 4 }).fighter,
        status: 'brn' as const,
        statusCounter: 0,
      },
    };
    const full: RunState = { ...createRun({ seed: 's', starter: sick }), party: Array(6).fill(sick) };
    const used = usePokevial(addPokemon(full, boxed));
    expect(used.party[0].fighter.status).toBeNull();
    expect(used.party[0].fighter.statusCounter).toBe(0);
    expect(used.box[0].fighter.status).toBeNull();
  });

  it('never resurrects a fainted member (D5)', () => {
    const run = createRun({ seed: 's', starter: damaged(starter, 0, 1) });
    expect(usePokevial(run).party[0].fighter.hp).toBe(0);
  });

  it('is a no-op unless the meter is full', () => {
    const partial = { ...createRun({ seed: 's', starter: damaged(starter, 3, 1) }), pokevialCharges: 1 };
    expect(usePokevial(partial)).toBe(partial);
    const spent = { ...partial, pokevialCharges: 0 };
    expect(usePokevial(spent)).toBe(spent);
  });
});

describe('chargePokevial', () => {
  it('adds a charge per beaten trainer and clamps at the cap', () => {
    const empty = { ...createRun({ seed: 's', starter }), pokevialCharges: 0 };
    const one = chargePokevial(empty);
    expect(one.pokevialCharges).toBe(1);
    const full = chargePokevial(chargePokevial(one));
    expect(full.pokevialCharges).toBe(POKEVIAL_MAX_CHARGES);
    expect(chargePokevial(full)).toBe(full);
  });

  it('treats a non-positive amount as a no-op', () => {
    const empty = { ...createRun({ seed: 's', starter }), pokevialCharges: 0 };
    expect(chargePokevial(empty, 0)).toBe(empty);
  });
});

describe('fillPokevial', () => {
  it('tops the meter up and is a no-op when already full', () => {
    const spent = { ...createRun({ seed: 's', starter }), pokevialCharges: 1 };
    expect(fillPokevial(spent).pokevialCharges).toBe(POKEVIAL_MAX_CHARGES);
    const full = fillPokevial(spent);
    expect(fillPokevial(full)).toBe(full);
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
