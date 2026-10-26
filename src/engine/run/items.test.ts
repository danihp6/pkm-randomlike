import { describe, expect, it } from 'vitest';
import { restoreFighter, type StatusId } from '../battle/fighter';
import { CANDY_COLOURS, CANDY_STATS, getItem } from '../../data/items';
import { isTmItemId } from '../../data/tms';
import { candyTreat, itemAppliesTo, ownedTmIds, useItemOn } from './items';
import { FORCED_FIELD_FLOORS } from './modifiers';
import { createRunPokemon, type RunPokemon } from './progression';
import { createRun, itemCount, type RunState } from './state';

const lead = createRunPokemon({ id: 'lead', speciesId: 'bulbasaur', level: 5 });
const boxed = createRunPokemon({ id: 'boxed', speciesId: 'charmander', level: 5 });

const maxHpOf = (member: RunPokemon): number => restoreFighter(member.fighter).maxHp;

function withHp(member: RunPokemon, hp: number): RunPokemon {
  return { ...member, fighter: { ...member.fighter, hp } };
}

function withStatus(member: RunPokemon, status: StatusId, statusCounter = 3): RunPokemon {
  return { ...member, fighter: { ...member.fighter, status, statusCounter } };
}

const item = (id: string) => getItem(id)!;

function runWith(bag: readonly { itemId: string; count: number }[], ...extra: RunPokemon[]): RunState {
  const run = createRun({ seed: 'items-87', starter: lead, bag });
  return extra.length === 0 ? run : { ...run, box: extra };
}

describe('itemAppliesTo', () => {
  it('spends a heal on a damaged member but not on a full-HP one', () => {
    expect(itemAppliesTo(withHp(lead, maxHpOf(lead) - 5), item('potion'))).toBe(true);
    expect(itemAppliesTo(lead, item('potion'))).toBe(false);
  });

  it('never applies to a fainted member, not even a Full Restore', () => {
    expect(itemAppliesTo(withHp(lead, 0), item('fullrestore'))).toBe(false);
  });

  it('reads the status a cure clears', () => {
    expect(itemAppliesTo(withStatus(lead, 'brn'), item('burnheal'))).toBe(true);
    expect(itemAppliesTo(lead, item('burnheal'))).toBe(false);
    expect(itemAppliesTo(withStatus(lead, 'psn'), item('antidote'))).toBe(true);
    expect(itemAppliesTo(withStatus(lead, 'par'), item('burnheal'))).toBe(false);
    expect(itemAppliesTo(withStatus(lead, 'tox'), item('antidote'))).toBe(true);
  });

  it('applies a heal that also cures to a full-HP statused member', () => {
    const burnt = withStatus(lead, 'brn');
    expect(itemAppliesTo(burnt, item('fullrestore'))).toBe(true);
    expect(itemAppliesTo(burnt, item('burnheal'))).toBe(true);
  });

  it('never applies a ball, a held item, a TM or a valuable', () => {
    const damaged = withHp(lead, maxHpOf(lead) - 5);
    for (const id of ['pokeball', 'leftovers', 'charcoal', 'tm001', 'nugget']) {
      expect(itemAppliesTo(damaged, item(id)), id).toBe(false);
    }
  });
});

describe('useItemOn', () => {
  it('consumes exactly one stack and heals the member', () => {
    const damaged = withHp(lead, maxHpOf(lead) - 5);
    const run = runWith([{ itemId: 'potion', count: 2 }]);
    const next = useItemOn({ ...run, party: [damaged] }, 'lead', 'potion');
    expect(next).not.toBe(run);
    expect(itemCount(next, 'potion')).toBe(1);
    expect(next.party[0].fighter.hp).toBe(maxHpOf(lead));
  });

  it('clamps the gain at maxHp', () => {
    const damaged = withHp(lead, maxHpOf(lead) - 1);
    const next = useItemOn(
      { ...runWith([{ itemId: 'hyperpotion', count: 1 }]), party: [damaged] },
      'lead',
      'hyperpotion',
    );
    expect(next.party[0].fighter.hp).toBe(maxHpOf(lead));
  });

  it('uses the heal fraction on a member with no healAmount', () => {
    const fullRestore = item('fullrestore');
    expect(fullRestore.healFraction).toEqual([1, 1]);
    const damaged = withHp(boxed, 1);
    const next = useItemOn(
      runWith([{ itemId: 'fullrestore', count: 1 }], damaged),
      'boxed',
      'fullrestore',
    );
    expect(next.box[0].fighter.hp).toBe(maxHpOf(boxed));
  });

  it('clears a matching status and its counter, and only that one', () => {
    const burnt = withStatus(lead, 'brn', 2);
    const healed = useItemOn(
      { ...runWith([{ itemId: 'fullrestore', count: 1 }]), party: [burnt] },
      'lead',
      'fullrestore',
    );
    expect(healed.party[0].fighter.status).toBeNull();
    expect(healed.party[0].fighter.statusCounter).toBe(0);

    const poisoned = withStatus(lead, 'psn', 2);
    const potioned = useItemOn(
      { ...runWith([{ itemId: 'potion', count: 1 }]), party: [withHp(poisoned, 1)] },
      'lead',
      'potion',
    );
    expect(potioned.party[0].fighter.status).toBe('psn');
    expect(potioned.party[0].fighter.statusCounter).toBe(2);

    const cured = useItemOn(
      { ...runWith([{ itemId: 'antidote', count: 1 }]), party: [poisoned] },
      'lead',
      'antidote',
    );
    expect(cured.party[0].fighter.status).toBeNull();
    expect(cured.party[0].fighter.statusCounter).toBe(0);
  });

  it('works on a box member', () => {
    const damaged = withHp(boxed, 1);
    const next = useItemOn(runWith([{ itemId: 'potion', count: 1 }], damaged), 'boxed', 'potion');
    expect(next.box[0].fighter.hp).toBe(maxHpOf(boxed));
    expect(itemCount(next, 'potion')).toBe(0);
    expect(next.party[0]).toBe(lead);
  });

  it('returns the same run for every no-op', () => {
    const full = runWith([{ itemId: 'potion', count: 1 }]);
    const damaged = runWith([{ itemId: 'potion', count: 1 }], withHp(boxed, 1));
    const burnt = runWith([{ itemId: 'burnheal', count: 1 }], withStatus(boxed, 'brn'));
    const cases: readonly [RunState, string, string, string][] = [
      [full, 'nobody', 'potion', 'unknown member'],
      [damaged, 'boxed', 'nopotion', 'unknown item'],
      [runWith([], withHp(boxed, 1)), 'boxed', 'potion', 'empty stock'],
      [runWith([{ itemId: 'potion', count: 1 }]), 'lead', 'potion', 'full HP'],
      [burnt, 'boxed', 'antidote', 'wrong status'],
      [
        runWith([{ itemId: 'fullrestore', count: 1 }], withHp(boxed, 0)),
        'boxed',
        'fullrestore',
        'fainted',
      ],
    ];
    for (const [run, memberId, itemId, label] of cases) {
      expect(useItemOn(run, memberId, itemId), label).toBe(run);
    }
  });

  it('refuses a held item on the route', () => {
    const run = runWith([{ itemId: 'leftovers', count: 1 }]);
    expect(useItemOn(run, 'lead', 'leftovers')).toBe(run);
    expect(itemCount(run, 'leftovers')).toBe(1);
  });
});

describe('candyTreat (Task-103)', () => {
  it('pins one seed’s table: red is Speed +1 and green Speed −1', () => {
    expect(candyTreat('items-103', 'red')).toEqual({ stat: 'spd', delta: 1 });
    expect(candyTreat('items-103', 'green')).toEqual({ stat: 'spd', delta: -1 });
    expect(candyTreat('items-103', 'red')).toEqual(candyTreat('items-103', 'red'));
  });

  it('maps a colour to another stat in another run', () => {
    expect(candyTreat('pkm-103', 'red')).toEqual({ stat: 'atk', delta: 1 });
    expect(candyTreat('pkm-103', 'red')).not.toEqual(candyTreat('items-103', 'red'));
  });

  it('resolves every colour on one of the five battle stats with a ±1 delta', () => {
    for (const colour of CANDY_COLOURS) {
      const treat = candyTreat('items-103', colour);
      expect(CANDY_STATS, colour).toContain(treat.stat);
      expect([1, -1], colour).toContain(treat.delta);
    }
  });

  it('throws on a colour the catalogue does not carry', () => {
    expect(() => candyTreat('items-103', 'orange')).toThrow();
  });
});

describe('the coloured candy on the route (Task-103)', () => {
  const baseSpd = (member: RunPokemon): number => restoreFighter(member.fighter).stats.spd;

  function candyRun(bag: readonly { itemId: string; count: number }[]): RunState {
    return createRun({ seed: 'items-103', starter: lead, bag });
  }

  it('writes the colour’s treat, spends one unit and records the colour', () => {
    const run = candyRun([{ itemId: 'candyred', count: 2 }]);
    const next = useItemOn(run, 'lead', 'candyred');
    expect(next).not.toBe(run);
    expect(itemCount(next, 'candyred')).toBe(1);
    expect(next.party[0].fighter.statTreats).toEqual({ spd: 1 });
    expect(restoreFighter(next.party[0].fighter).stats.spd).toBe(baseSpd(lead) + 1);
    expect(next.party[0].fighter.hp).toBe(lead.fighter.hp);
    expect(next.discoveredCandy).toEqual(['red']);
  });

  it('records the colour once, however many candies of it are spent', () => {
    const run = candyRun([{ itemId: 'candyred', count: 2 }]);
    const once = useItemOn(run, 'lead', 'candyred');
    const twice = useItemOn(once, 'lead', 'candyred');
    expect(twice.discoveredCandy).toEqual(['red']);
    expect(twice.party[0].fighter.statTreats).toEqual({ spd: 2 });
  });

  it('lowers the stat with a −1 colour and leaves no key when the treat cancels out', () => {
    const run = candyRun([
      { itemId: 'candyred', count: 1 },
      { itemId: 'candygreen', count: 1 },
    ]);
    const up = useItemOn(run, 'lead', 'candyred');
    const down = useItemOn(up, 'lead', 'candygreen');
    expect('statTreats' in down.party[0].fighter).toBe(false);
    expect(restoreFighter(down.party[0].fighter).stats.spd).toBe(baseSpd(lead));
    expect(down.discoveredCandy).toEqual(['red', 'green']);
    expect(itemCount(down, 'candygreen')).toBe(0);
  });

  it('lowers a single stat by one with a −1 colour, never by more', () => {
    const run = candyRun([{ itemId: 'candygreen', count: 1 }]);
    const next = useItemOn(run, 'lead', 'candygreen');
    expect(next.party[0].fighter.statTreats).toEqual({ spd: -1 });
    expect(restoreFighter(next.party[0].fighter).stats.spd).toBe(baseSpd(lead) - 1);
  });

  it('works on a boxed member', () => {
    const healthy = withHp(boxed, 5);
    const run = { ...candyRun([{ itemId: 'candyred', count: 1 }]), box: [healthy] };
    const next = useItemOn(run, 'boxed', 'candyred');
    expect(next.box[0].fighter.statTreats).toEqual({ spd: 1 });
    expect(next.party[0]).toBe(lead);
    expect(itemCount(next, 'candyred')).toBe(0);
  });

  it('refuses a fainted member with the same object, and an empty stock', () => {
    const fainted = { ...candyRun([{ itemId: 'candyred', count: 1 }]), party: [withHp(lead, 0)] };
    expect(useItemOn(fainted, 'lead', 'candyred')).toBe(fainted);
    expect(itemAppliesTo(withHp(lead, 0), item('candyred'))).toBe(false);
    expect(itemAppliesTo(lead, item('candyred'))).toBe(true);
    const empty = candyRun([]);
    expect(useItemOn(empty, 'lead', 'candyred')).toBe(empty);
  });
});

describe('the three route consumables (Task-103)', () => {
  it('rests the party and the box with the medic bottle, curing nothing', () => {
    const burnt = withStatus(withHp(lead, 1), 'brn', 2);
    const hurt = withHp(boxed, 1);
    const fainted = withHp(boxed, 0);
    const run = {
      ...runWith([{ itemId: 'medicbottle', count: 2 }], hurt, fainted),
      party: [burnt],
      stats: { catches: 2, casualties: 1 },
    };
    const next = useItemOn(run, 'lead', 'medicbottle');
    expect(itemCount(next, 'medicbottle')).toBe(1);
    expect(next.party[0].fighter.hp).toBe(maxHpOf(lead));
    expect(next.party[0].fighter.status).toBe('brn');
    expect(next.party[0].fighter.statusCounter).toBe(2);
    for (const slot of next.party[0].fighter.moves) expect(slot.pp).toBe(slot.maxPp);
    expect(next.box[0].fighter.hp).toBe(maxHpOf(boxed));
    expect(next.box[1].fighter.hp).toBe(0);
    expect(next.stats.casualties).toBe(1);
    expect(next.bag.find((slot) => slot.itemId === 'medicbottle')?.count).toBe(1);
  });

  it('sets the exorcist’s curse with the hex bottle and leaves every member untouched', () => {
    const run = runWith([{ itemId: 'exorcistbottle', count: 1 }]);
    const next = useItemOn(run, 'lead', 'exorcistbottle');
    expect(next.modifiers.curse).toBe(true);
    expect(next.party).toBe(run.party);
    expect(next.box).toBe(run.box);
    expect(next.modifiers.forcedField).toBeNull();
    expect(itemCount(next, 'exorcistbottle')).toBe(0);
  });

  it('forces the weather man’s sky with the sun bottle', () => {
    const run = runWith([{ itemId: 'weatherbottle', count: 1 }]);
    const next = useItemOn(run, 'lead', 'weatherbottle');
    expect(next.modifiers.forcedField).toEqual({ id: 'sun', floorsLeft: FORCED_FIELD_FLOORS });
    expect(next.modifiers.curse).toBe(false);
    expect(itemCount(next, 'weatherbottle')).toBe(0);
  });

  it('ignores the carrier’s HP and status, and only needs the id', () => {
    const fainted = { ...runWith([{ itemId: 'medicbottle', count: 1 }]), party: [withHp(lead, 0)] };
    expect(useItemOn(fainted, 'lead', 'medicbottle')).not.toBe(fainted);
    expect(useItemOn(fainted, 'nobody', 'medicbottle')).toBe(fainted);
    expect(itemAppliesTo(withHp(lead, 0), item('exorcistbottle'))).toBe(true);
  });

  it('returns the same run for an empty stock', () => {
    const empty = runWith([]);
    for (const id of ['exorcistbottle', 'weatherbottle', 'medicbottle']) {
      expect(useItemOn(empty, 'lead', id), id).toBe(empty);
    }
  });
});

describe('ownedTmIds', () => {
  it('lists the bag’s TMs in bag order, deduped', () => {
    const run = runWith([
      { itemId: 'tm032', count: 1 },
      { itemId: 'potion', count: 3 },
      { itemId: 'tm001', count: 2 },
      { itemId: 'tm032', count: 1 },
    ]);
    expect(ownedTmIds(run)).toEqual(['tm032', 'tm001']);
  });

  it('answers nothing for an empty bag', () => {
    expect(ownedTmIds(runWith([]))).toEqual([]);
  });

  it('ignores a stack with no stock and an id that is no TM', () => {
    const run = runWith([
      { itemId: 'tm005', count: 0 },
      { itemId: 'tm999', count: 2 },
      { itemId: 'pokeball', count: 1 },
    ]);
    expect(ownedTmIds(run)).toEqual([]);
  });

  it('never answers a non-TM id', () => {
    const run = runWith([
      { itemId: 'potion', count: 2 },
      { itemId: 'tm166', count: 1 },
    ]);
    expect(ownedTmIds(run)).toEqual(['tm166']);
    expect(ownedTmIds(run).every(isTmItemId)).toBe(true);
  });

  it('reads no RNG or clock, so two calls answer the same list', () => {
    const run = runWith([{ itemId: 'tm058', count: 1 }]);
    expect(ownedTmIds(run)).toEqual(ownedTmIds(run));
  });
});
