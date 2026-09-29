import { describe, expect, it } from 'vitest';
import { levelCapForRoute } from '../../data/run';
import { createRunPokemon } from './progression';
import {
  MAX_PARTY_SIZE,
  addItem,
  addPokemon,
  advanceRoute,
  canCapture,
  consumeItem,
  createRun,
  hasLivingParty,
  isTrainerDefeated,
  itemCount,
  markTrainerDefeated,
  setParty,
  updatePokemon,
  useCapture,
} from './state';

const starter = createRunPokemon({ id: 'starter', speciesId: 'charmander', level: 5, moves: ['scratch'] });

describe('createRun', () => {
  it('starts on route 1 with the starter and an empty box', () => {
    const run = createRun({ seed: 'run-a', starter });
    expect(run.routeIndex).toBe(1);
    expect(run.levelCap).toBe(levelCapForRoute(1));
    expect(run.party).toEqual([starter]);
    expect(run.box).toEqual([]);
    expect(run.captureUsed).toBe(false);
    expect(run.mode).toBe('finite');
  });
});

describe('advanceRoute', () => {
  it('raises the cap and clears the per-route marks', () => {
    let run = createRun({ seed: 'run-a', starter });
    run = useCapture(run);
    run = markTrainerDefeated(run, 'trainer-1-0');
    const next = advanceRoute(run);
    expect(next.routeIndex).toBe(2);
    expect(next.levelCap).toBe(levelCapForRoute(2));
    expect(next.captureUsed).toBe(false);
    expect(next.defeatedTrainers).toEqual([]);
    expect(next.party).toBe(run.party);
  });
});

describe('pokemon moves', () => {
  it('fills the party up to six, then the box', () => {
    let run = createRun({ seed: 'run-a', starter });
    for (let i = 0; i < MAX_PARTY_SIZE - 1; i++) {
      run = addPokemon(run, createRunPokemon({ id: `extra-${i}`, speciesId: 'sentret', level: 3 }));
    }
    expect(run.party).toHaveLength(MAX_PARTY_SIZE);
    expect(run.box).toHaveLength(0);
    run = addPokemon(run, createRunPokemon({ id: 'boxed', speciesId: 'sentret', level: 3 }));
    expect(run.party).toHaveLength(MAX_PARTY_SIZE);
    expect(run.box.map((member) => member.fighter.id)).toEqual(['boxed']);
  });

  it('updates a member in place and ignores an unknown id', () => {
    const run = createRun({ seed: 'run-a', starter });
    const healed = { ...starter, fighter: { ...starter.fighter, hp: 1 } };
    expect(updatePokemon(run, healed).party[0].fighter.hp).toBe(1);
    const stranger = createRunPokemon({ id: 'nobody', speciesId: 'sentret', level: 2 });
    expect(updatePokemon(run, stranger)).toBe(run);
  });

  it('reports a wiped party', () => {
    const run = createRun({ seed: 'run-a', starter });
    expect(hasLivingParty(run)).toBe(true);
    const fainted = { ...starter, fighter: { ...starter.fighter, hp: 0 } };
    expect(hasLivingParty(setParty(run, [fainted]))).toBe(false);
  });
});

describe('capture and trainers', () => {
  it('allows one capture per route', () => {
    let run = createRun({ seed: 'run-a', starter });
    expect(canCapture(run)).toBe(true);
    run = useCapture(run);
    expect(canCapture(run)).toBe(false);
    expect(useCapture(run)).toBe(run);
  });

  it('records a beaten trainer once', () => {
    let run = createRun({ seed: 'run-a', starter });
    run = markTrainerDefeated(run, 'trainer-1-0');
    expect(isTrainerDefeated(run, 'trainer-1-0')).toBe(true);
    expect(markTrainerDefeated(run, 'trainer-1-0')).toBe(run);
  });
});

describe('bag', () => {
  it('stacks, consumes and drops empty stacks', () => {
    let run = createRun({ seed: 'run-a', starter, bag: [{ itemId: 'potion', count: 1 }] });
    expect(itemCount(run, 'potion')).toBe(1);
    run = addItem(run, 'potion', 2);
    run = addItem(run, 'pokeball');
    expect(itemCount(run, 'potion')).toBe(3);
    expect(itemCount(run, 'pokeball')).toBe(1);
    run = consumeItem(run, 'potion', 3);
    expect(itemCount(run, 'potion')).toBe(0);
    expect(run.bag.some((slot) => slot.itemId === 'potion')).toBe(false);
    expect(consumeItem(run, 'greatball')).toBe(run);
    expect(consumeItem(run, 'pokeball', 0)).toBe(run);
  });
});
