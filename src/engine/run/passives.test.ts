import { describe, expect, it } from 'vitest';
import { getAbility } from '../../data/dex/abilities';
import { getItem } from '../../data/items';
import { MAP_PASSIVES, type MapPassiveTrigger } from '../../data/passives';
import { createRunPokemon } from './progression';
import { passiveMark, runPassives, type PassiveResult } from './passives';
import { addItem, addPokemon, createRun, itemCount, type RunState } from './state';

/** The node keys the pins walk: a town, three routes, a city and the Victory Road. */
const NODES: readonly string[] = [
  'town:1',
  'route:1',
  'city:1',
  'route:2',
  'lateral:1',
  'victory-road:1',
];

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

/** The run standing on `key` with the node's marks clear. */
function onNode(run: RunState, key: string): RunState {
  return { ...run, nodeKey: key, pickedItems: [] };
}

function rowFor(trigger: MapPassiveTrigger) {
  return MAP_PASSIVES.find((row) => row.trigger === trigger)!;
}

/** The first node of the pin set that pays `trigger`, or null when none does. */
function payingNode(run: RunState, trigger: MapPassiveTrigger): string | null {
  for (const key of NODES) {
    if (runPassives(onNode(run, key), trigger).picks.length > 0) return key;
  }
  return null;
}

// One string per node, in NODES order: `'-'` when neither trigger paid, else each
// payment as `<trigger>:<ability>:<itemId>`, joined by `|` in the rule's own order
// (`'room'` then `'win'`). Computed once from this build for seed `pkm-111` with a
// party holding both abilities; it pins the two minted streams (D11).
const PASSIVE_PINS: readonly string[] = [
  'room:pickup:potion|win:honeygather:sitrusberry',
  '-',
  'room:pickup:potion|win:honeygather:sitrusberry',
  'win:honeygather:leppaberry',
  'room:pickup:stardust',
  'room:pickup:antidote|win:honeygather:persimberry',
];

describe('passiveMark', () => {
  it('names the row, the trigger and the node', () => {
    expect(passiveMark('pickup', 'room', 'route:2')).toBe('passive-pickup-room-route:2');
    expect(passiveMark('honeygather', 'win', 'town:1')).toBe('passive-honeygather-win-town:1');
  });
});

describe('runPassives', () => {
  it('pays once on a node the pickup stream hits, then never again', () => {
    const run = runWith('pkm-111', ['Pickup']);
    const key = payingNode(run, 'room');
    expect(key).not.toBeNull();

    const before = onNode(run, key!);
    const { run: paid, picks } = runPassives(before, 'room');
    expect(picks).toHaveLength(1);
    const pick = picks[0];
    expect(pick.mark).toBe(`passive-pickup-room-${key}`);
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
    const key = payingNode(pickupRun, 'room')!;
    let missed: string | null = null;
    for (const candidate of NODES) {
      if (candidate !== key && runPassives(onNode(pickupRun, candidate), 'room').picks.length === 0) {
        missed = candidate;
        break;
      }
    }
    expect(missed).not.toBeNull();
    const missedRun = onNode(pickupRun, missed!);
    const result = runPassives(missedRun, 'room');
    expect(result.run).toBe(missedRun);
    expect(result.picks).toEqual([]);

    expect(runPassives(onNode(pickupRun, key), 'win').picks).toEqual([]);
    expect(runPassives(onNode(honeyRun, key), 'room').picks).toEqual([]);
  });

  it('never asks the box', () => {
    const partyMember = createRunPokemon({ id: 'starter', speciesId: 'bulbasaur', level: 5 });
    const boxed = member('boxed', 'Pickup');
    const base = createRun({ seed: 'pkm-111', starter: partyMember });
    let run: RunState = { ...base, box: [boxed] };
    for (const key of NODES) {
      expect(runPassives(onNode(run, key), 'room').picks, key).toEqual([]);
    }
    run = { ...run, party: [partyMember, boxed], box: [] };
    expect(payingNode(run, 'room')).not.toBeNull();
  });

  it('pays once per row even when two members hold the ability', () => {
    const run = runWith('pkm-111', ['Pickup', 'Pickup']);
    expect(run.party).toHaveLength(2);
    const key = payingNode(run, 'room')!;
    const before = onNode(run, key);
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
    const key = payingNode(granted, 'room');
    expect(key).not.toBeNull();
    const before = onNode(granted, key!);
    const { run: paid, picks } = runPassives(before, 'room');
    expect(picks).toHaveLength(1);
    expect(picks[0].ability).toBe('pickup');
    expect(picks[0].mark).toBe(`passive-pickup-room-${key}`);
    expect(itemCount(paid, picks[0].itemId)).toBe(itemCount(before, picks[0].itemId) + 1);
    // The draw is the row's own, so the same node pays the same item as a primary holder.
    const primary = runPassives(onNode(runWith('pkm-111', ['Pickup']), key!), 'room');
    expect(primary.picks[0].itemId).toBe(picks[0].itemId);
  });

  it('skips a blank or unknown ability without throwing', () => {
    const run = runWith('pkm-111', ['', 'Not An Ability']);
    for (const trigger of ['room', 'win'] as const) {
      for (const key of NODES) {
        const input = onNode(run, key);
        const result: PassiveResult = runPassives(input, trigger);
        expect(result.run).toBe(input);
        expect(result.picks).toEqual([]);
      }
    }
  });

  it('draws only from the row its (seed, node, ability) mints', () => {
    const one = runWith('pkm-111', ['Pickup']);
    const two = runWith('pkm-111', ['Pickup']);
    const picked: string[] = [];
    for (const key of NODES) {
      const a = runPassives(onNode(one, key), 'room');
      const b = runPassives(onNode(two, key), 'room');
      expect(b, key).toEqual(a);
      if (a.picks.length > 0) picked.push(key);
    }
    expect(picked.length).toBeGreaterThan(0);
    expect(picked.length).toBeLessThan(NODES.length);
  });

  it('ignores the rest of the run: an unrelated member, a bag row, money', () => {
    const run = runWith('pkm-111', ['Pickup']);
    const key = payingNode(run, 'room')!;
    const untouched = runPassives(onNode(run, key), 'room');
    const disturbed = {
      ...onNode(run, key),
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
    for (const key of NODES) {
      const a = runPassives(onNode(one, key), 'room');
      const b = runPassives(onNode(two, key), 'room');
      expect(b, key).toEqual(a);
    }
  });

  it('matches PASSIVE_PINS for seed pkm-111 over the pin nodes', () => {
    const run = runWith('pkm-111', ['Pickup', 'Honey Gather']);
    const pins = NODES.map((key) => {
      const folded = runPassives(onNode(run, key), 'room');
      const won = runPassives(folded.run, 'win');
      const picks = [...folded.picks, ...won.picks];
      return picks.length === 0
        ? '-'
        : picks.map((pick) => `${pick.trigger}:${pick.ability}:${pick.itemId}`).join('|');
    });
    expect(pins).toEqual(PASSIVE_PINS);
  });
});
