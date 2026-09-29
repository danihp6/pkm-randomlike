import { describe, expect, it } from 'vitest';
import type { BattleReturn, BattleOutcome } from './battleLink';
import { createRunPokemon, xpForLevel, type RunPokemon } from './progression';
import { resolveBattle, type BattleReward } from './resolve';
import { createRun, type RunState } from './state';

const starter = createRunPokemon({ id: 'starter', speciesId: 'charmander', level: 3, moves: ['scratch'] });

function hurt(pokemon: RunPokemon, hp: number): RunPokemon {
  return { ...pokemon, fighter: { ...pokemon.fighter, hp } };
}

function returned(run: RunState, outcome: BattleOutcome, extra: Partial<BattleReturn> = {}): BattleReturn {
  return {
    outcome,
    message: 'done',
    player: run.party.map((member) => member.fighter),
    bag: run.bag,
    captured: null,
    ...extra,
  };
}

const wild: BattleReward = { enemyLevels: [4], isTrainer: false };

describe('resolveBattle', () => {
  it('awards XP to the survivors on a win and adopts the bag', () => {
    const run = createRun({ seed: 's', starter, bag: [{ itemId: 'potion', count: 1 }] });
    const result = resolveBattle(run, returned(run, 'win', { bag: [{ itemId: 'pokeball', count: 2 }] }), wild);
    expect(result.run.bag).toEqual([{ itemId: 'pokeball', count: 2 }]);
    expect(result.run.party[0].xp).toBeGreaterThan(starter.xp);
    expect(result.released).toEqual([]);
  });

  it('clamps a win at the route cap', () => {
    const run = createRun({ seed: 's', starter });
    const result = resolveBattle(run, returned(run, 'win'), { enemyLevels: [40], isTrainer: false });
    expect(result.run.party[0].fighter.level).toBe(5);
    expect(result.run.party[0].xp).toBe(xpForLevel(5));
    expect(result.events).toContainEqual({ kind: 'capped', level: 5 });
  });

  it('marks the trainer beaten on a trainer win', () => {
    const run = createRun({ seed: 's', starter });
    const reward: BattleReward = { enemyLevels: [4], isTrainer: true, trainerId: 'trainer-1-0' };
    const result = resolveBattle(run, returned(run, 'win'), reward);
    expect(result.run.defeatedTrainers).toEqual(['trainer-1-0']);
  });

  it('places a catch, spends the route capture and awards XP', () => {
    const run = createRun({ seed: 's', starter });
    const caught = createRunPokemon({ id: 'wild', speciesId: 'sentret', level: 3 });
    const result = resolveBattle(run, returned(run, 'capture', { captured: caught.fighter }), wild);
    expect(result.run.captureUsed).toBe(true);
    expect(result.run.party.map((member) => member.fighter.id)).toEqual(['starter', 'wild']);
    expect(result.run.party[0].xp).toBeGreaterThan(starter.xp);
  });

  it('sends a catch to the box when the party is full', () => {
    const full: RunState = { ...createRun({ seed: 's', starter }), party: Array(6).fill(starter) };
    const caught = createRunPokemon({ id: 'wild', speciesId: 'sentret', level: 3 });
    const result = resolveBattle(full, returned(full, 'capture', { captured: caught.fighter }), wild);
    expect(result.run.party).toHaveLength(6);
    expect(result.run.box.map((member) => member.fighter.id)).toEqual(['wild']);
  });

  it('releases every fainted member on a loss', () => {
    const run = createRun({ seed: 's', starter });
    const wiped = { ...run, party: [hurt(starter, 0)] };
    const result = resolveBattle(wiped, returned(wiped, 'lose'), wild);
    expect(result.run.party).toEqual([]);
    expect(result.released.map((member) => member.fighter.id)).toEqual(['starter']);
    expect(result.events).toEqual([]);
  });

  it('awards nothing when the player flees', () => {
    const run = createRun({ seed: 's', starter });
    const result = resolveBattle(run, returned(run, 'run'), wild);
    expect(result.run.party[0]).toBe(starter);
    expect(result.events).toEqual([]);
  });
});
