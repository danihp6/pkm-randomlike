import { describe, expect, it } from 'vitest';
import { capForRoute } from './levelCap';
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
  equipHeldItem,
  hasLivingParty,
  isItemPicked,
  isTrainerDefeated,
  itemCount,
  markItemPicked,
  markTrainerDefeated,
  moveInBox,
  moveInParty,
  moveMoves,
  recordCatch,
  setParty,
  swapPartyBox,
  unequipHeldItem,
  updatePokemon,
  useCapture,
  withdrawToParty,
} from './state';

const starter = createRunPokemon({ id: 'starter', speciesId: 'charmander', level: 5, moves: ['scratch'] });

describe('createRun', () => {
  it('starts on route 1 with the starter and an empty box', () => {
    const run = createRun({ seed: 'run-a', starter });
    expect(run.routeIndex).toBe(1);
    expect(run.levelCap).toBe(capForRoute('run-a', 1));
    expect(run.party).toEqual([starter]);
    expect(run.box).toEqual([]);
    expect(run.pickedItems).toEqual([]);
    expect(run.captureUsed).toBe(false);
    expect(run.mode).toBe('finite');
    expect(run.stats).toEqual({ catches: 0, casualties: 0 });
  });
});

describe('advanceRoute', () => {
  it('raises the cap and clears the per-route marks', () => {
    let run = createRun({ seed: 'run-a', starter });
    run = useCapture(run);
    run = markTrainerDefeated(run, 'trainer-1-0');
    run = markItemPicked(run, 'item-1-0');
    const next = advanceRoute(run);
    expect(next.routeIndex).toBe(2);
    expect(next.levelCap).toBe(capForRoute('run-a', 2));
    expect(next.captureUsed).toBe(false);
    expect(next.defeatedTrainers).toEqual([]);
    expect(next.pickedItems).toEqual([]);
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

  it('swaps a party member for a boxed one, keeping both slots', () => {
    const full = withParty(['a', 'b', 'c', 'd', 'e', 'f']);
    const run = {
      ...full,
      box: [createRunPokemon({ id: 'x', speciesId: 'sentret', level: 3 }), createRunPokemon({ id: 'y', speciesId: 'sentret', level: 3 })],
    };
    const next = swapPartyBox(run, 2, 0);
    expect(next.party.map((m) => m.fighter.id)).toEqual(['a', 'b', 'x', 'd', 'e', 'f']);
    expect(next.box.map((m) => m.fighter.id)).toEqual(['c', 'y']);
  });

  it('refuses a swap when one of the slots is empty', () => {
    const run = withParty(['a', 'b']);
    expect(swapPartyBox(run, 0, 0)).toBe(run);
    expect(swapPartyBox(run, 9, 0)).toBe(run);
    expect(swapPartyBox(run, 0, 9)).toBe(run);
  });
});

describe('move reorder', () => {
  const moves = (member: ReturnType<typeof createRunPokemon>): readonly string[] =>
    member.fighter.moves.map((slot) => slot.moveId);

  it('reorders a member\'s moves in place', () => {
    const mon = createRunPokemon({ id: 'starter', speciesId: 'charmander', level: 5, moves: ['ember', 'scratch', 'growl'] });
    const run = createRun({ seed: 'run-a', starter: mon });
    const next = moveMoves(run, 'starter', 0, 2);
    expect(moves(next.party[0])).toEqual(['scratch', 'growl', 'ember']);
    expect(moveMoves(next, 'starter', 1, 0).party[0].fighter.moves.map((slot) => slot.moveId)).toEqual([
      'growl',
      'scratch',
      'ember',
    ]);
  });

  it('reorders a boxed member and ignores a bad move or member', () => {
    const boxed = createRunPokemon({ id: 'boxed', speciesId: 'charmander', level: 5, moves: ['ember', 'scratch'] });
    const run = { ...createRun({ seed: 'run-a', starter }), box: [boxed] };
    expect(moveMoves(run, 'boxed', 0, 1).box[0].fighter.moves.map((slot) => slot.moveId)).toEqual(['scratch', 'ember']);
    expect(moveMoves(run, 'boxed', 0, 0)).toBe(run);
    expect(moveMoves(run, 'boxed', 0, 9)).toBe(run);
    expect(moveMoves(run, 'nobody', 0, 1)).toBe(run);
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

  it('counts a catch for the run summary', () => {
    const run = createRun({ seed: 'run-a', starter });
    expect(recordCatch(run).stats).toEqual({ catches: 1, casualties: 0 });
  });
});

describe('ground items', () => {
  it('marks a picked item once and reports it', () => {
    let run = createRun({ seed: 'run-a', starter });
    expect(isItemPicked(run, 'item-1-0')).toBe(false);
    run = markItemPicked(run, 'item-1-0');
    expect(isItemPicked(run, 'item-1-0')).toBe(true);
    expect(markItemPicked(run, 'item-1-0')).toBe(run);
    expect(run.pickedItems).toEqual(['item-1-0']);
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

describe('held items', () => {
  function runWithBag(): ReturnType<typeof createRun> {
    return createRun({ seed: 'run-a', starter, bag: [{ itemId: 'charcoal', count: 2 }] });
  }

  it('takes a stack from the bag and puts it on the member', () => {
    const run = runWithBag();
    const next = equipHeldItem(run, 'starter', 'charcoal');
    expect(next.party[0].fighter.heldItem).toBe('charcoal');
    expect(itemCount(next, 'charcoal')).toBe(1);
  });

  it('returns whatever the member already held to the bag', () => {
    const run = equipHeldItem(runWithBag(), 'starter', 'charcoal');
    const swapped = equipHeldItem(addItem(run, 'leftovers'), 'starter', 'leftovers');
    expect(swapped.party[0].fighter.heldItem).toBe('leftovers');
    expect(itemCount(swapped, 'leftovers')).toBe(0);
    expect(itemCount(swapped, 'charcoal')).toBe(2);
  });

  it('equips a boxed member too', () => {
    const boxed = createRunPokemon({ id: 'boxed', speciesId: 'sentret', level: 3 });
    const run = { ...runWithBag(), box: [boxed] };
    const next = equipHeldItem(run, 'boxed', 'charcoal');
    expect(next.box[0].fighter.heldItem).toBe('charcoal');
  });

  it('is a no-op for the same item, an empty stack or an unknown member', () => {
    const run = equipHeldItem(runWithBag(), 'starter', 'charcoal');
    expect(equipHeldItem(run, 'starter', 'charcoal')).toBe(run);
    expect(equipHeldItem(run, 'starter', 'leftovers')).toBe(run);
    expect(equipHeldItem(run, 'nobody', 'charcoal')).toBe(run);
    const bare = createRun({ seed: 'run-a', starter });
    expect(equipHeldItem(bare, 'starter', 'charcoal')).toBe(bare);
  });

  it('unequips a held item back to the bag', () => {
    const run = equipHeldItem(runWithBag(), 'starter', 'charcoal');
    const bare = unequipHeldItem(run, 'starter');
    expect(bare.party[0].fighter.heldItem).toBeNull();
    expect(itemCount(bare, 'charcoal')).toBe(2);
  });

  it('will not unequip a member holding nothing', () => {
    const run = createRun({ seed: 'run-a', starter });
    expect(unequipHeldItem(run, 'starter')).toBe(run);
  });
});
