import { describe, expect, it } from 'vitest';
import { restoreFighter, type StatusId } from '../battle/fighter';
import { getItem } from '../../data/items';
import { itemAppliesTo, useItemOn } from './items';
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
