import { describe, expect, it } from 'vitest';
import { getAbility } from '../../data/dex/abilities';
import { getItem } from '../../data/items';
import { MAP_PASSIVES, type MapPassiveTrigger } from '../../data/passives';
import { createRunPokemon } from './progression';
import { passiveMark, runPassives, type PassiveResult } from './passives';
import { addItem, addPokemon, createRun, itemCount, type RunState } from './state';

const ROOM_COUNT = 12;
const MAPS = [1, 2, 3] as const;

function member(id: string, ability: string): ReturnType<typeof createRunPokemon> {
  return createRunPokemon({ id, speciesId: 'bulbasaur', level: 5, ability });
}

function runWith(seed: string, abilities: readonly string[]): RunState {
  const [first, ...rest] = abilities;
  let run = createRun({ seed, starter: member('starter', first) });
  for (const [index, ability] of rest.entries()) {
    run = addPokemon(run, member(`member-${index}`, ability));
  }
  return run;
}

function at(run: RunState, mapIndex: number, room: number): RunState {
  return { ...run, mapIndex, routeInMap: room, pickedItems: [] };
}

function rowFor(trigger: MapPassiveTrigger) {
  return MAP_PASSIVES.find((row) => row.trigger === trigger)!;
}

function payingRoom(run: RunState, trigger: MapPassiveTrigger): number | null {
  for (let room = 0; room < ROOM_COUNT; room++) {
    if (runPassives(at(run, 1, room), trigger).picks.length > 0) return room;
  }
  return null;
}

// One string per (map, room), in maps 1-3 and rooms 0-11: `'-'` when neither
// trigger paid, else each payment as `<trigger>:<ability>:<itemId>`, joined by `|`
// in the rule's own order (`'room'` then `'win'`). Computed once from this build
// for seed `pkm-111` with a party holding both abilities; it pins the two minted
// streams (D11).
const PASSIVE_PINS: readonly (readonly string[])[] = [
  [
    'room:pickup:pokeball|win:honeygather:leppaberry',
    'win:honeygather:persimberry',
    '-',
    '-',
    '-',
    '-',
    'win:honeygather:leppaberry',
    'win:honeygather:persimberry',
    'win:honeygather:leppaberry',
    'room:pickup:stardust',
    'room:pickup:antidote',
    'win:honeygather:sitrusberry',
  ],
  [
    'room:pickup:potion',
    'room:pickup:pokeball|win:honeygather:persimberry',
    'win:honeygather:persimberry',
    'room:pickup:antidote',
    'win:honeygather:persimberry',
    'room:pickup:potion|win:honeygather:persimberry',
    '-',
    'room:pickup:potion|win:honeygather:sitrusberry',
    '-',
    '-',
    '-',
    'room:pickup:stardust|win:honeygather:sitrusberry',
  ],
  [
    '-',
    '-',
    'room:pickup:potion',
    'room:pickup:potion|win:honeygather:persimberry',
    '-',
    'room:pickup:potion|win:honeygather:leppaberry',
    'room:pickup:potion',
    'win:honeygather:sitrusberry',
    'win:honeygather:persimberry',
    'win:honeygather:sitrusberry',
    'room:pickup:pokeball|win:honeygather:sitrusberry',
    'win:honeygather:sitrusberry',
  ],
];

describe('passiveMark', () => {
  it('names the row, the trigger, the floor and the room', () => {
    expect(passiveMark('pickup', 'room', 2, 7)).toBe('passive-pickup-room-2-7');
    expect(passiveMark('honeygather', 'win', 1, 0)).toBe('passive-honeygather-win-1-0');
  });
});

describe('runPassives', () => {
  it('pays once on a room the pickup stream hits, then never again', () => {
    const run = runWith('pkm-111', ['Pickup']);
    const room = payingRoom(run, 'room');
    expect(room).not.toBeNull();

    const before = at(run, 1, room!);
    const { run: paid, picks } = runPassives(before, 'room');
    expect(picks).toHaveLength(1);
    const pick = picks[0];
    expect(pick.mark).toBe(`passive-pickup-room-1-${room}`);
    expect(pick.ability).toBe('pickup');
    expect(getAbility(pick.ability)?.id).toBe(pick.ability);
    expect(pick.trigger).toBe('room');
    expect(rowFor('room').effect.itemIds).toContain(pick.itemId);
    expect(getItem(pick.itemId), pick.itemId).toBeDefined();
    expect(itemCount(paid, pick.itemId)).toBe(itemCount(before, pick.itemId) + 1);
    expect(paid.pickedItems).toContain(pick.mark);
    expect(paid).not.toBe(before);

    const again = runPassives(paid, 'room');
    expect(again.run).toBe(paid);
    expect(again.picks).toEqual([]);
  });

  it('pays nothing on a miss, on the other trigger, or off the party', () => {
    const pickupRun = runWith('pkm-111', ['Pickup']);
    const honeyRun = runWith('pkm-111', ['Honey Gather']);
    const room = payingRoom(pickupRun, 'room')!;
    let missed: number | null = null;
    for (let candidate = 0; candidate < ROOM_COUNT; candidate++) {
      if (candidate !== room && runPassives(at(pickupRun, 1, candidate), 'room').picks.length === 0) {
        missed = candidate;
        break;
      }
    }
    expect(missed).not.toBeNull();
    const missedRun = at(pickupRun, 1, missed!);
    const result = runPassives(missedRun, 'room');
    expect(result.run).toBe(missedRun);
    expect(result.picks).toEqual([]);

    expect(runPassives(at(pickupRun, 1, room), 'win').picks).toEqual([]);
    expect(runPassives(at(honeyRun, 1, room), 'room').picks).toEqual([]);
  });

  it('never asks the box', () => {
    const partyMember = createRunPokemon({ id: 'starter', speciesId: 'bulbasaur', level: 5 });
    const boxed = member('boxed', 'Pickup');
    const base = createRun({ seed: 'pkm-111', starter: partyMember });
    let run: RunState = { ...base, box: [boxed] };
    for (let room = 0; room < ROOM_COUNT; room++) {
      expect(runPassives(at(run, 1, room), 'room').picks, String(room)).toEqual([]);
    }
    run = { ...run, party: [partyMember, boxed], box: [] };
    expect(payingRoom(run, 'room')).not.toBeNull();
  });

  it('pays once per row even when two members hold the ability', () => {
    const run = runWith('pkm-111', ['Pickup', 'Pickup']);
    expect(run.party).toHaveLength(2);
    const room = payingRoom(run, 'room')!;
    const before = at(run, 1, room);
    const { run: paid, picks } = runPassives(before, 'room');
    expect(picks).toHaveLength(1);
    expect(picks.filter((pick) => pick.ability === 'pickup')).toHaveLength(1);
    expect(itemCount(paid, picks[0].itemId)).toBe(itemCount(before, picks[0].itemId) + 1);
  });

  it('pays a row held as a member second ability, on the same stream', () => {
    const plain = runWith('pkm-111', ['Blaze']);
    const granted: RunState = {
      ...plain,
      party: plain.party.map((entry) => ({ ...entry, secondAbility: 'Pickup' })),
    };
    expect(plain.party[0].fighter.ability).toBe('Blaze');
    const room = payingRoom(granted, 'room');
    expect(room).not.toBeNull();
    const before = at(granted, 1, room!);
    const { run: paid, picks } = runPassives(before, 'room');
    expect(picks).toHaveLength(1);
    expect(picks[0].ability).toBe('pickup');
    expect(picks[0].mark).toBe(`passive-pickup-room-1-${room}`);
    expect(itemCount(paid, picks[0].itemId)).toBe(itemCount(before, picks[0].itemId) + 1);
    // The draw is the row's own, so the same room pays the same item as a primary holder.
    const primary = runPassives(at(runWith('pkm-111', ['Pickup']), 1, room!), 'room');
    expect(primary.picks[0].itemId).toBe(picks[0].itemId);
  });

  it('skips a blank or unknown ability without throwing', () => {
    const run = runWith('pkm-111', ['', 'Not An Ability']);
    for (const trigger of ['room', 'win'] as const) {
      for (let room = 0; room < ROOM_COUNT; room++) {
        const input = at(run, 1, room);
        const result: PassiveResult = runPassives(input, trigger);
        expect(result.run).toBe(input);
        expect(result.picks).toEqual([]);
      }
    }
  });

  it('draws only from the row its (seed, floor, room, ability) mints', () => {
    const one = runWith('pkm-111', ['Pickup']);
    const two = runWith('pkm-111', ['Pickup']);
    const picked: string[] = [];
    for (let room = 0; room < ROOM_COUNT; room++) {
      const a = runPassives(at(one, 1, room), 'room');
      const b = runPassives(at(two, 1, room), 'room');
      expect(b, String(room)).toEqual(a);
      if (a.picks.length > 0) picked.push(String(room));
    }
    expect(picked.length).toBeGreaterThan(0);
    expect(picked.length).toBeLessThan(ROOM_COUNT);
  });

  it('ignores the rest of the run: an unrelated member, a bag row, money', () => {
    const run = runWith('pkm-111', ['Pickup']);
    const room = payingRoom(run, 'room')!;
    const untouched = runPassives(at(run, 1, room), 'room');
    const disturbed = {
      ...at(run, 1, room),
      box: [...run.box, member('unrelated', 'Blaze')],
      bag: addItem(run, 'oranberry', 3).bag,
      money: run.money + 10000,
    };
    expect(runPassives(disturbed, 'room').picks).toEqual(untouched.picks);
  });
});

describe('the fixed-seed pins (D11)', () => {
  it('reports the same payments on two equal runs', () => {
    const one = runWith('pkm-111', ['Pickup', 'Honey Gather']);
    const two = runWith('pkm-111', ['Pickup', 'Honey Gather']);
    for (const mapIndex of MAPS) {
      for (let room = 0; room < ROOM_COUNT; room++) {
        const a = runPassives(at(one, mapIndex, room), 'room');
        const b = runPassives(at(two, mapIndex, room), 'room');
        expect(b, `${mapIndex}/${room}`).toEqual(a);
      }
    }
  });

  it('matches PASSIVE_PINS for seed pkm-111, maps 1-3, rooms 0-11', () => {
    const run = runWith('pkm-111', ['Pickup', 'Honey Gather']);
    const pins = MAPS.map((mapIndex) =>
      Array.from({ length: ROOM_COUNT }, (_, room) => {
        const start = at(run, mapIndex, room);
        const folded = runPassives(start, 'room');
        const won = runPassives(folded.run, 'win');
        const picks = [...folded.picks, ...won.picks];
        return picks.length === 0
          ? '-'
          : picks.map((pick) => `${pick.trigger}:${pick.ability}:${pick.itemId}`).join('|');
      }),
    );
    expect(pins).toEqual(PASSIVE_PINS);
  });
});
