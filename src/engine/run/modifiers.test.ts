import { describe, expect, it } from 'vitest';
import { createBattle } from '../battle/state';
import { createFighter, effectiveStat } from '../battle/fighter';
import { Rng } from '../rng';
import {
  FORCED_FIELD_FLOORS,
  decayModifiers,
  emptyModifiers,
  forcedFieldId,
  withCurse,
  withForcedField,
  withNextWildType,
  withoutCurse,
  withoutNextWildType,
  type RunModifiers,
} from './modifiers';

const CURSE: RunModifiers = { curse: true, forcedField: null, nextWildType: null };
const SKY: RunModifiers = {
  curse: false,
  forcedField: { id: 'rain', floorsLeft: 3 },
  nextWildType: null,
};
const TYPE: RunModifiers = { curse: false, forcedField: null, nextWildType: 'bug' };

function fighter(id: string, speciesId: string): ReturnType<typeof createFighter> {
  return createFighter({ id, speciesId, level: 20, moves: ['tackle'] });
}

describe('emptyModifiers', () => {
  it('is curse-free, sky-less and type-less', () => {
    expect(emptyModifiers()).toEqual({ curse: false, forcedField: null, nextWildType: null });
  });

  it('hands out a fresh record every time', () => {
    expect(emptyModifiers()).not.toBe(emptyModifiers());
  });
});

describe('the curse', () => {
  it('sets only the curse and keeps the other two facts', () => {
    const cursed = withCurse({ ...SKY, nextWildType: 'bug' });
    expect(cursed).toEqual({ curse: true, forcedField: SKY.forcedField, nextWildType: 'bug' });
  });

  it('clears only the curse and keeps the other two facts', () => {
    const clean = withoutCurse({ curse: true, forcedField: SKY.forcedField, nextWildType: 'bug' });
    expect(clean).toEqual({ curse: false, forcedField: SKY.forcedField, nextWildType: 'bug' });
  });

  it('never mutates its argument', () => {
    const before = { ...TYPE };
    withCurse(before);
    withoutCurse({ ...before, curse: true });
    expect(before).toEqual(TYPE);
  });
});

describe('the forced sky', () => {
  it('replaces any field with the full floor count under the given id', () => {
    expect(withForcedField(SKY, 'sun')).toEqual({
      curse: false,
      forcedField: { id: 'sun', floorsLeft: FORCED_FIELD_FLOORS },
      nextWildType: null,
    });
    expect(FORCED_FIELD_FLOORS).toBe(3);
  });

  it('decays one floor at a time and turns into null at zero', () => {
    const first = decayModifiers(SKY);
    expect(first.forcedField).toEqual({ id: 'rain', floorsLeft: 2 });
    expect(decayModifiers(first).forcedField).toEqual({ id: 'rain', floorsLeft: 1 });
    expect(decayModifiers(decayModifiers(first)).forcedField).toBeNull();
    expect(
      decayModifiers({ ...emptyModifiers(), forcedField: { id: 'rain', floorsLeft: 1 } }).forcedField,
    ).toBeNull();
  });

  it('leaves the curse and the type alone while it decays', () => {
    const both: RunModifiers = {
      curse: true,
      forcedField: { id: 'sand', floorsLeft: 2 },
      nextWildType: 'fire',
    };
    expect(decayModifiers(both)).toEqual({
      curse: true,
      forcedField: { id: 'sand', floorsLeft: 1 },
      nextWildType: 'fire',
    });
  });

  it('answers no field with no sky, and the same record when there is nothing to spend', () => {
    const bare = emptyModifiers();
    expect(decayModifiers(bare)).toBe(bare);
    expect(forcedFieldId(bare)).toBeNull();
  });

  it('reports the id while it still has floors', () => {
    expect(forcedFieldId(SKY)).toBe('rain');
    expect(forcedFieldId({ ...emptyModifiers(), forcedField: { id: 'fog', floorsLeft: 1 } })).toBe(
      'fog',
    );
    expect(forcedFieldId({ ...emptyModifiers(), forcedField: { id: 'fog', floorsLeft: 0 } })).toBeNull();
  });
});

describe('the narrowed wild type', () => {
  it('sets only the type and keeps the other two facts', () => {
    expect(withNextWildType({ ...CURSE, forcedField: SKY.forcedField }, 'water')).toEqual({
      curse: true,
      forcedField: SKY.forcedField,
      nextWildType: 'water',
    });
  });

  it('clears only the type and keeps the other two facts', () => {
    expect(withoutNextWildType({ ...TYPE, curse: true })).toEqual({
      curse: true,
      forcedField: null,
      nextWildType: null,
    });
  });

  it('never touches the curse or the sky while it is set and spent', () => {
    const both: RunModifiers = {
      curse: true,
      forcedField: { id: 'rain', floorsLeft: 2 },
      nextWildType: null,
    };
    const set = withNextWildType(both, 'bug');
    expect(set.curse).toBe(true);
    expect(set.forcedField).toBe(both.forcedField);
    expect(withoutNextWildType(set).curse).toBe(true);
  });
});

describe('the curse at the battle start', () => {
  function battle(enemyBoosts?: Partial<Record<'atk', number>>) {
    return createBattle({
      player: [fighter('player', 'charmander')],
      enemy: [fighter('enemy-lead', 'sentret'), fighter('enemy-second', 'sentret')],
      rng: new Rng(94),
      isWild: true,
      ...(enemyBoosts ? { enemyBoosts } : {}),
    });
  }

  it('starts the enemy lead one Attack stage down and nothing else down', () => {
    const state = battle({ atk: -1 });
    expect(state.sides.enemy.party[0].boosts.atk).toBe(-1);
    expect(state.sides.enemy.party[1].boosts.atk).toBe(0);
    for (const fighter of state.sides.player.party) expect(fighter.boosts.atk).toBe(0);
    // The stage is the battle's own stat ladder: the lead attacks weaker than raw.
    const cursed = state.sides.enemy.party[0];
    expect(effectiveStat(cursed, 'atk')).toBeLessThan(cursed.stats.atk);
    expect(effectiveStat(cursed, 'atk')).toBeLessThan(
      effectiveStat(fighter('enemy-lead', 'sentret'), 'atk'),
    );
  });

  it('logs no event for the boost it seeds', () => {
    const withCurse = battle({ atk: -1 });
    const plain = battle();
    expect(withCurse.log.filter((event) => event.kind === 'boost')).toEqual([]);
    expect(withCurse.log.map((event) => event.kind)).toEqual(plain.log.map((event) => event.kind));
  });

  it('keeps every stage at zero without the curse', () => {
    const state = battle();
    for (const side of [state.sides.player, state.sides.enemy]) {
      for (const member of side.party) expect(member.boosts.atk).toBe(0);
    }
  });
});
