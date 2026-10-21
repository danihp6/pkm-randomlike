import { describe, expect, it } from 'vitest';
import { restoreFighter } from '../battle/fighter';
import { createRunPokemon, type RunPokemon } from '../run/progression';
import { addPokemon, advanceMap, createRun, type RunState } from '../run/state';
import { bossHealId, bossRoomHeal, bossRoomSealed } from './bossRoom';

const starter = createRunPokemon({
  id: 'starter',
  speciesId: 'charmander',
  level: 5,
  moves: ['scratch', 'ember'],
});
const starterMaxHp = restoreFighter(starter.fighter).maxHp;

const boxed = createRunPokemon({ id: 'boxed', speciesId: 'sentret', level: 4 });

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

/** A run with a full party (five hurt members, one fainted) and one hurt member boxed. */
function hurtRun(): RunState {
  const base: RunState = createRun({ seed: 'boss-room', starter: damaged(starter, 3, 1) });
  const party = [
    damaged(starter, 3, 1),
    damaged(starter, 0, 0),
    damaged(starter, 1, 0),
    damaged(starter, 2, 0),
    damaged(starter, 3, 0),
    damaged(starter, 4, 0),
  ];
  return addPokemon({ ...base, party }, damaged(boxed, 2, 0));
}

function hurtAgain(run: RunState): RunState {
  return { ...run, party: run.party.map((member) => damaged(member, 3, 1)) };
}

describe('bossHealId', () => {
  it('names the floor it marks', () => {
    expect(bossHealId(1)).toBe('boss-heal-1');
    expect(bossHealId(8)).toBe('boss-heal-8');
    expect(bossHealId(1)).not.toBe(bossHealId(2));
  });
});

describe('bossRoomSealed', () => {
  it('bars the door only while a boss stands in the room', () => {
    expect(bossRoomSealed(true, false)).toBe(true);
    expect(bossRoomSealed(true, true)).toBe(false);
    expect(bossRoomSealed(false, false)).toBe(false);
    expect(bossRoomSealed(false, true)).toBe(false);
  });
});

describe('bossRoomHeal', () => {
  it('restores HP and PP across the party and the box', () => {
    const healed = bossRoomHeal(hurtRun(), 1);
    expect(healed.party[0].fighter.hp).toBe(starterMaxHp);
    expect(healed.party[0].fighter.moves.every((slot) => slot.pp === slot.maxPp)).toBe(true);
    expect(healed.box[0].fighter.hp).toBeGreaterThan(2);
    expect(healed.box[0].fighter.moves.every((slot) => slot.pp === slot.maxPp)).toBe(true);
  });

  it('never resurrects a fainted member (D5)', () => {
    expect(bossRoomHeal(hurtRun(), 1).party[1].fighter.hp).toBe(0);
  });

  it('records its floor mark in pickedItems', () => {
    const healed = bossRoomHeal(hurtRun(), 3);
    expect(healed.pickedItems).toContain('boss-heal-3');
    expect(healed.pickedItems).toHaveLength(1);
  });

  it('hands back the same object on a second call on the same floor', () => {
    const once = bossRoomHeal(hurtRun(), 1);
    expect(bossRoomHeal(once, 1)).toBe(once);
  });

  it('draws no RNG: two calls on identical inputs are deeply equal', () => {
    expect(bossRoomHeal(hurtRun(), 2)).toEqual(bossRoomHeal(hurtRun(), 2));
  });

  it('heals again on the next floor, because advanceMap clears its mark', () => {
    const healed = bossRoomHeal(hurtRun(), 1);
    const advanced = advanceMap(healed);
    expect(advanced.pickedItems).not.toContain('boss-heal-1');
    const next = bossRoomHeal(hurtAgain(advanced), advanced.mapIndex);
    expect(next.pickedItems).toContain(bossHealId(advanced.mapIndex));
    expect(next.party[0].fighter.hp).toBe(starterMaxHp);
  });
});
