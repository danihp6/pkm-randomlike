import { describe, expect, it } from 'vitest';
import { getMove, learnableBy, levelUpMoves } from '../../data/dex';
import { tmItemIdForMove } from '../../data/tms';
import { randomLevelUpMoves } from '../battle/randomLearnset';
import { equipMove, learnsetPool, unequipMove } from './learnset';
import { createRunPokemon, levelUpPokemon } from './progression';
import { addItem, createRun, updatePokemon, type RunState } from './state';

const SEED = 'learnset-test';

function starterRun(moves: readonly string[] = ['scratch'], level = 5): RunState {
  const starter = createRunPokemon({ id: 'starter', speciesId: 'charmander', level, moves });
  return createRun({ seed: SEED, starter });
}

function diglettRun(ability: string, level = 44): RunState {
  const starter = createRunPokemon({
    id: 'starter',
    speciesId: 'diglett',
    level,
    ability,
    moves: ['scratch'],
  });
  return createRun({ seed: SEED, starter });
}

describe('learnsetPool', () => {
  it('lists the learned level-up moves that are not in the slots', () => {
    const run = starterRun();
    const pool = learnsetPool(run, run.party[0]);
    const ids = pool.map((entry) => entry.moveId);
    // 'scratch' is slotted, so the pool no longer offers it.
    expect(ids).not.toContain('scratch');
    expect(ids).toContain('growl');
    expect(ids).toContain('ember');
    // Not learned until level 8.
    expect(ids).not.toContain('smokescreen');
    expect(pool.every((entry) => entry.source === 'level')).toBe(true);
  });

  it('offers a TM move only while the run holds that machine', () => {
    const member = {
      fighter: createRunPokemon({ id: 'starter', speciesId: 'charmander', level: 5, moves: ['scratch'] })
        .fighter,
    };
    const tmMove = learnableBy('charmander', 'tm')[0];
    const tmId = tmItemIdForMove(tmMove)!;
    const without = starterRun();
    expect(learnsetPool(without, member).some((entry) => entry.moveId === tmMove)).toBe(false);
    const withTm = addItem(without, tmId);
    const entry = learnsetPool(withTm, member).find((candidate) => candidate.moveId === tmMove);
    expect(entry?.source).toBe('tm');
    expect(entry?.tmId).toBe(tmId);
  });

  it('omits every move already in the slots', () => {
    const run = starterRun(['scratch', 'splash']);
    const ids = learnsetPool(run, run.party[0]).map((entry) => entry.moveId);
    expect(ids).not.toContain('scratch');
    expect(ids).not.toContain('splash');
    expect(ids).toContain('growl');
  });

  it('follows the run seed\u2019s randomized learnset', () => {
    const run = starterRun(['scratch']);
    const pool = learnsetPool(run, run.party[0], SEED);
    // The randomized level moves, minus the one already slotted.
    const expected = new Set(randomLevelUpMoves('charmander', 5, SEED).map((entry) => entry.moveId));
    for (const slot of run.party[0].fighter.moves) expected.delete(slot.moveId);
    for (const entry of pool) expect(expected.has(entry.moveId), entry.moveId).toBe(true);
  });

  it('offers a move a level-up crossed and equips it only through equipMove', () => {
    const run = starterRun(['scratch'], 1);
    const grown = levelUpPokemon(run.party[0], 4);
    expect(grown.events).toContainEqual({ kind: 'learn', moveId: 'ember', memberId: 'starter' });
    // The level-up crossed 'ember' but equipped nothing.
    expect(grown.pokemon.fighter.moves.map((slot) => slot.moveId)).toEqual(['scratch']);
    const after = updatePokemon(run, grown.pokemon);
    expect(learnsetPool(after, after.party[0]).map((entry) => entry.moveId)).toContain('ember');
    const equipped = equipMove(after, 'starter', 'ember', 1);
    expect(equipped).not.toBe(after);
    expect(equipped.party[0].fighter.moves.map((slot) => slot.moveId)).toEqual(['scratch', 'ember']);
  });

  it('never offers an OHKO move to a No Guard holder, and does offer it to another holder', () => {
    // The premise first, so a data move fails loudly instead of passing vacuously.
    expect(levelUpMoves('diglett', 44)).toContainEqual({ moveId: 'fissure', level: 44 });
    expect(getMove('fissure')?.ohko).toBe(true);
    const noGuardRun = diglettRun('No Guard');
    expect(noGuardRun.party[0].fighter.ability).toBe('No Guard');
    expect(learnsetPool(noGuardRun, noGuardRun.party[0]).map((entry) => entry.moveId)).not.toContain(
      'fissure',
    );
    expect(equipMove(noGuardRun, 'starter', 'fissure', 0)).toBe(noGuardRun);
    const control = diglettRun('Sand Veil');
    expect(learnsetPool(control, control.party[0]).map((entry) => entry.moveId)).toContain('fissure');
  });
});

describe('the tutor band', () => {
  /** A run whose only member carries `taughtMoves`. */
  function tutoredRun(taughtMoves: readonly string[], ability = 'Sand Veil'): RunState {
    const run = diglettRun(ability, 5);
    return updatePokemon(run, { ...run.party[0], taughtMoves });
  }

  it('offers a tutored move as a tutor entry and keeps it after an unequip', () => {
    const run = tutoredRun(['earthquake']);
    const entry = learnsetPool(run, run.party[0]).find((candidate) => candidate.moveId === 'earthquake');
    expect(entry).toEqual({ moveId: 'earthquake', source: 'tutor', level: null, tmId: null });

    const equipped = equipMove(run, 'starter', 'earthquake', 1);
    expect(equipped.party[0].fighter.moves.map((slot) => slot.moveId)).toEqual([
      'scratch',
      'earthquake',
    ]);
    // The band no longer offers the move it holds...
    expect(learnsetPool(equipped, equipped.party[0]).some((e) => e.moveId === 'earthquake')).toBe(false);
    // ...and an unequip returns it as a tutor entry, not as a level one.
    const removed = unequipMove(equipped, 'starter', 1);
    const back = learnsetPool(removed, removed.party[0]).find((e) => e.moveId === 'earthquake');
    expect(back?.source).toBe('tutor');
    expect(back?.level).toBeNull();
    expect(back?.tmId).toBeNull();
  });

  it('draws level entries, then tutor entries, then TM entries', () => {
    const levelIds = new Set(levelUpMoves('diglett', 5).map((entry) => entry.moveId));
    const tmMove = learnableBy('diglett', 'tm').find(
      (moveId) => !levelIds.has(moveId) && tmItemIdForMove(moveId),
    )!;
    const tmId = tmItemIdForMove(tmMove)!;
    const base = addItem(tutoredRun(['earthquake']), tmId);
    const pool = learnsetPool(base, base.party[0]);
    const rank: Readonly<Record<string, number>> = { level: 0, tutor: 1, tm: 2 };
    for (let index = 1; index < pool.length; index++) {
      expect(rank[pool[index].source], pool[index].moveId).toBeGreaterThanOrEqual(
        rank[pool[index - 1].source],
      );
    }
    const tutorIndex = pool.findIndex((entry) => entry.source === 'tutor');
    const tmIndex = pool.findIndex((entry) => entry.source === 'tm');
    expect(tutorIndex).toBeGreaterThan(0);
    expect(tmIndex).toBeGreaterThan(tutorIndex);
  });

  it('drops a taught id the dex cannot resolve and one already in a slot', () => {
    const run = tutoredRun(['not-a-move', 'scratch', 'earthquake']);
    const ids = learnsetPool(run, run.party[0]).map((entry) => entry.moveId);
    expect(ids).toContain('earthquake');
    expect(ids.filter((id) => id === 'scratch')).toEqual([]);
    expect(ids).not.toContain('not-a-move');
  });

  it('never offers an OHKO tutored move under No Guard, primary or second ability', () => {
    const sand = tutoredRun(['fissure'], 'Sand Veil');
    expect(getMove('fissure')?.ohko).toBe(true);
    expect(learnsetPool(sand, sand.party[0]).map((entry) => entry.moveId)).toContain('fissure');

    const withSecond = updatePokemon(sand, { ...sand.party[0], secondAbility: 'No Guard' });
    expect(learnsetPool(withSecond, withSecond.party[0]).map((entry) => entry.moveId)).not.toContain(
      'fissure',
    );

    const noGuard = tutoredRun(['fissure'], 'No Guard');
    expect(learnsetPool(noGuard, noGuard.party[0]).map((entry) => entry.moveId)).not.toContain(
      'fissure',
    );
  });
});

describe('equipMove', () => {
  const tmMove = learnableBy('charmander', 'tm')[0];
  const tmId = tmItemIdForMove(tmMove)!;

  it('replaces a slot with a move learned from a bag TM, without spending it', () => {
    const run = addItem(starterRun(['scratch', 'growl']), tmId);
    const next = equipMove(run, 'starter', tmMove, 0, SEED);
    expect(next).not.toBe(run);
    expect(next.party[0].fighter.moves[0].moveId).toBe(tmMove);
    expect(next.party[0].fighter.moves[0].pp).toBeGreaterThan(0);
    // The TM is still in the bag: teaching is reusable.
    expect(next.bag.find((slot) => slot.itemId === tmId)?.count).toBe(1);
  });

  it('ignores a move that already sits in one of the slots', () => {
    const run = starterRun(['scratch', 'growl']);
    expect(equipMove(run, 'starter', 'growl', 0, SEED)).toBe(run);
  });

  it('appends a move to a short moveset when dropped past its end', () => {
    const run = addItem(starterRun(['scratch']), tmId);
    const next = equipMove(run, 'starter', tmMove, 2, SEED);
    expect(next.party[0].fighter.moves.map((slot) => slot.moveId)).toEqual(['scratch', tmMove]);
  });

  it('refuses a move the member cannot learn and an unknown member', () => {
    const run = starterRun();
    expect(equipMove(run, 'starter', 'hydropump', 0, SEED)).toBe(run);
    expect(equipMove(run, 'nobody', 'scratch', 0, SEED)).toBe(run);
    expect(equipMove(run, 'starter', 'scratch', 9, SEED)).toBe(run);
  });
});

describe('unequipMove', () => {
  const tmMove = learnableBy('charmander', 'tm')[0];
  const tmId = tmItemIdForMove(tmMove)!;

  it('removes exactly the chosen slot and keeps the rest in order, on a new run', () => {
    const run = starterRun(['scratch', 'growl', 'ember']);
    const next = unequipMove(run, 'starter', 1);
    expect(next).not.toBe(run);
    expect(next.party[0].fighter.moves.map((slot) => slot.moveId)).toEqual(['scratch', 'ember']);
    expect(run.party[0].fighter.moves.map((slot) => slot.moveId)).toEqual(['scratch', 'growl', 'ember']);
  });

  it('returns a removed level-up move to the learnset pool', () => {
    const run = starterRun(['scratch', 'growl', 'ember']);
    expect(learnsetPool(run, run.party[0]).map((entry) => entry.moveId)).not.toContain('growl');
    const next = unequipMove(run, 'starter', 1);
    const entry = learnsetPool(next, next.party[0]).find((candidate) => candidate.moveId === 'growl');
    expect(entry?.source).toBe('level');
  });

  it('returns a removed TM move to the pool with its machine while the bag holds it', () => {
    const run = addItem(starterRun([tmMove, 'scratch']), tmId);
    const next = unequipMove(run, 'starter', 0);
    expect(next.party[0].fighter.moves.map((slot) => slot.moveId)).toEqual(['scratch']);
    const entry = learnsetPool(next, next.party[0]).find((candidate) => candidate.moveId === tmMove);
    expect(entry?.moveId).toBe(tmMove);
    expect(entry?.source).toBe('tm');
    expect(entry?.tmId).toBe(tmId);
  });

  it('refuses to leave a member with no moves at all', () => {
    const run = starterRun(['scratch']);
    expect(unequipMove(run, 'starter', 0)).toBe(run);
  });

  it('returns the run by reference for an unknown member or an out-of-range slot', () => {
    const run = starterRun(['scratch', 'growl', 'ember']);
    expect(unequipMove(run, 'nobody', 0)).toBe(run);
    expect(unequipMove(run, 'starter', -1)).toBe(run);
    expect(unequipMove(run, 'starter', 3)).toBe(run);
    expect(unequipMove(run, 'starter', 1.5)).toBe(run);
  });

  it('re-equips a deleted move into the same slot with fresh PP', () => {
    const run = starterRun(['scratch', 'growl', 'ember']);
    const deleted = unequipMove(run, 'starter', 2);
    expect(deleted.party[0].fighter.moves.map((slot) => slot.moveId)).toEqual(['scratch', 'growl']);
    const restored = equipMove(deleted, 'starter', 'ember', 2);
    expect(restored).not.toBe(deleted);
    expect(restored.party[0].fighter.moves.map((slot) => slot.moveId)).toEqual([
      'scratch',
      'growl',
      'ember',
    ]);
    const slot = restored.party[0].fighter.moves[2];
    expect(slot.pp).toBe(getMove('ember')!.pp);
    expect(slot.maxPp).toBe(getMove('ember')!.pp);
  });
});
