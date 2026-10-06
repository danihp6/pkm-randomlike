import { describe, expect, it } from 'vitest';
import { createRun } from '../engine/run/state';
import { createRunPokemon } from '../engine/run/progression';
import {
  CLOSED_DETAIL,
  closeDetail,
  dropMove,
  grabMove,
  memberDetail,
  openDetail,
  reorderMoves,
  setDetailTab,
} from './partyDetail';

const starter = createRunPokemon({
  id: 'starter',
  speciesId: 'charmander',
  level: 5,
  moves: ['ember', 'scratch', 'growl'],
});

function runWith() {
  const boxed = createRunPokemon({ id: 'boxed', speciesId: 'sentret', level: 3 });
  return { ...createRun({ seed: 'run-a', starter }), box: [boxed] };
}

describe('memberDetail', () => {
  it('resolves the shape, stats and moves of a party member', () => {
    const detail = memberDetail(runWith(), 'starter');
    expect(detail).toMatchObject({
      name: 'Charmander',
      level: 5,
      types: ['Fire'],
      nature: 'serious',
    });
    expect(detail?.moves.map((move) => move.name)).toEqual(['Ember', 'Scratch', 'Growl']);
    expect(detail?.moves[0]).toMatchObject({ type: 'Fire', category: 'Special' });
    expect(detail?.stats.atk).toBeGreaterThan(0);
    expect(detail?.maxHp).toBeGreaterThan(0);
  });

  it('reads a box member and returns null for an unknown id', () => {
    expect(memberDetail(runWith(), 'boxed')?.name).toBe('Sentret');
    expect(memberDetail(runWith(), 'nobody')).toBeNull();
  });
});

describe('detail state', () => {
  it('opens, switches tab, grabs and drops', () => {
    const opened = openDetail('starter');
    expect(opened).toEqual({ memberId: 'starter', tab: 'stats', grab: null });
    const moves = setDetailTab(opened, 'moves');
    expect(moves.tab).toBe('moves');
    const grabbed = grabMove(moves, 1);
    expect(grabbed.grab).toBe(1);
    expect(setDetailTab(grabbed, 'stats').grab).toBeNull();
    expect(dropMove(grabbed).grab).toBeNull();
    expect(closeDetail(grabbed)).toEqual(CLOSED_DETAIL);
    expect(closeDetail(CLOSED_DETAIL)).toBe(CLOSED_DETAIL);
  });
});

describe('reorderMoves', () => {
  it('reorders the grabbed move to the drop slot', () => {
    const run = runWith();
    const grabbed = grabMove(openDetail('starter', 'moves'), 0);
    const moved = reorderMoves(run, grabbed, 2);
    expect(moved.run.party[0].fighter.moves.map((slot) => slot.moveId)).toEqual([
      'scratch',
      'growl',
      'ember',
    ]);
    expect(moved.state.grab).toBe(2);
  });

  it('clamps the target and ignores a grab-less drag', () => {
    const run = runWith();
    const grabbed = grabMove(openDetail('starter', 'moves'), 0);
    expect(reorderMoves(run, grabbed, 9).state.grab).toBe(2);
    const idle = { run, state: openDetail('starter', 'moves') };
    expect(reorderMoves(run, idle.state, 2)).toEqual(idle);
  });
});
