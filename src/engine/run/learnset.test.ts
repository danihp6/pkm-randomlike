import { describe, expect, it } from 'vitest';
import { getMove, learnableBy, levelUpMoves } from '../../data/dex';
import { tmItemIdForMove } from '../../data/tms';
import { randomLevelUpMoves } from '../battle/randomLearnset';
import { equipMove, learnsetPool } from './learnset';
import { createRunPokemon, levelUpPokemon } from './progression';
import { addItem, createRun, updatePokemon, type RunState } from './state';

const SEED = 'learnset-test';

function starterRun(moves: readonly string[] = ['scratch'], level = 5): RunState {
  const starter = createRunPokemon({ id: 'starter', speciesId: 'charmander', level, moves });
  return createRun({ seed: SEED, starter });
}

function diglettRun(ability: string): RunState {
  const starter = createRunPokemon({
    id: 'starter',
    speciesId: 'diglett',
    level: 44,
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
