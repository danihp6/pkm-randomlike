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
  it('lists the level-up moves learned so far, marking the slotted ones', () => {
    const run = starterRun();
    const pool = learnsetPool(run, run.party[0]);
    const ids = pool.map((entry) => entry.moveId);
    expect(ids).toContain('scratch');
    expect(ids).toContain('growl');
    expect(ids).toContain('ember');
    // Not learned until level 8.
    expect(ids).not.toContain('smokescreen');
    expect(pool.find((entry) => entry.moveId === 'scratch')?.slot).toBe(0);
    expect(pool.find((entry) => entry.moveId === 'ember')?.slot).toBeNull();
    expect(pool.every((entry) => entry.source === 'level')).toBe(true);
  });

  it('offers a TM move only while the run holds that machine', () => {
    const member = { fighter: createRunPokemon({ id: 'starter', speciesId: 'charmander', level: 5, moves: ['scratch'] }).fighter };
    const tmMove = learnableBy('charmander', 'tm')[0];
    const tmId = tmItemIdForMove(tmMove)!;
    const without = starterRun();
    expect(learnsetPool(without, member).some((entry) => entry.moveId === tmMove)).toBe(false);
    const withTm = addItem(without, tmId);
    const entry = learnsetPool(withTm, member).find((candidate) => candidate.moveId === tmMove);
    expect(entry?.source).toBe('tm');
    expect(entry?.tmId).toBe(tmId);
    expect(entry?.slot).toBeNull();
  });

  it('keeps a held move the learnset does not cover, so a swap can be undone', () => {
    const run = starterRun(['scratch', 'splash']);
    const entry = learnsetPool(run, run.party[0], SEED).find((candidate) => candidate.moveId === 'splash');
    expect(entry?.slot).toBe(1);
    expect(entry?.source).toBe('level');
  });

  it('follows the run seed\u2019s randomized learnset', () => {
    const run = starterRun();
    const pool = learnsetPool(run, run.party[0], SEED);
    // The randomized level moves, plus the moves the member already holds.
    const expected = new Set([
      ...randomLevelUpMoves('charmander', 5, SEED).map((entry) => entry.moveId),
      ...run.party[0].fighter.moves.map((slot) => slot.moveId),
    ]);
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

  it('swaps two slots when the move already sits in another one', () => {
    const run = addItem(starterRun(['scratch', 'growl']), tmId);
    const taught = equipMove(run, 'starter', tmMove, 1, SEED);
    expect(taught.party[0].fighter.moves[1].moveId).toBe(tmMove);
    // Re-dropping the same move onto an earlier slot swaps them.
    const swapped = equipMove(taught, 'starter', tmMove, 0, SEED);
    expect(swapped.party[0].fighter.moves[0].moveId).toBe(tmMove);
    expect(swapped.party[0].fighter.moves[1].moveId).toBe('scratch');
    expect(new Set(swapped.party[0].fighter.moves.map((slot) => slot.moveId)).size).toBe(2);
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

  it('is a no-op when the move is already in the target slot', () => {
    const run = starterRun(['scratch', 'growl']);
    expect(equipMove(run, 'starter', 'scratch', 0, SEED)).toBe(run);
  });
});
