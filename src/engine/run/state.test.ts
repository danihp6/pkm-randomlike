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
  depositToBox,
  hasLivingParty,
  isTrainerDefeated,
  itemCount,
  markTrainerDefeated,
  moveInBox,
  moveInParty,
  setParty,
  updatePokemon,
  useCapture,
  withdrawToParty,
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

describe('party/PC moves', () => {
  function withParty(ids: readonly string[]): ReturnType<typeof createRun> {
    const members = ids.map((id, index) =>
      index === 0 ? { ...starter, fighter: { ...starter.fighter, id } } : createRunPokemon({ id, speciesId: 'sentret', level: 3 }),
    );
    return { ...createRun({ seed: 'run-a', starter }), party: members };
  }

  it('reorders the party and the box', () => {
    const run = withParty(['a', 'b', 'c']);
    expect(moveInParty(run, 0, 2).party.map((m) => m.fighter.id)).toEqual(['b', 'c', 'a']);
    expect(moveInParty(run, 2, 0).party.map((m) => m.fighter.id)).toEqual(['c', 'a', 'b']);
    expect(moveInParty(run, 1, 1)).toBe(run);
    expect(moveInParty(run, 0, 5)).toBe(run);
    const boxed = {
      ...run,
      box: [createRunPokemon({ id: 'x', speciesId: 'sentret', level: 3 }), createRunPokemon({ id: 'y', speciesId: 'sentret', level: 3 })],
    };
    expect(moveInBox(boxed, 0, 1).box.map((m) => m.fighter.id)).toEqual(['y', 'x']);
  });

  it('deposits a party member in the box', () => {
    const run = withParty(['a', 'b']);
    const next = depositToBox(run, 0);
    expect(next.party.map((m) => m.fighter.id)).toEqual(['b']);
    expect(next.box.map((m) => m.fighter.id)).toEqual(['a']);
  });

  it('refuses to deposit the last party member', () => {
    const run = withParty(['a']);
    expect(depositToBox(run, 0)).toBe(run);
  });

  it('withdraws a boxed member while the party has room', () => {
    const run = { ...withParty(['a']), box: [createRunPokemon({ id: 'boxed', speciesId: 'sentret', level: 3 })] };
    const next = withdrawToParty(run, 0);
    expect(next.party.map((m) => m.fighter.id)).toEqual(['a', 'boxed']);
    expect(next.box).toEqual([]);
  });

  it('refuses to withdraw into a full party', () => {
    const full = withParty(['a', 'b', 'c', 'd', 'e', 'f']);
    const run = { ...full, box: [createRunPokemon({ id: 'boxed', speciesId: 'sentret', level: 3 })] };
    expect(withdrawToParty(run, 0)).toBe(run);
    expect(withdrawToParty(run, 7)).toBe(run);
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
