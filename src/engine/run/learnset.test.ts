import { describe, expect, it } from 'vitest';
import { learnableBy } from '../../data/dex/learnsets';
import { tmItemIdForMove } from '../../data/tms';
import { randomLevelUpMoves } from '../battle/randomLearnset';
import { equipMove, learnsetPool } from './learnset';
import { createRunPokemon } from './progression';
import { addItem, createRun, type RunState } from './state';

const SEED = 'learnset-test';

function starterRun(moves: readonly string[] = ['scratch'], level = 5): RunState {
  const starter = createRunPokemon({ id: 'starter', speciesId: 'charmander', level, moves });
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
