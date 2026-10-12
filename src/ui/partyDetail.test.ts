import { describe, expect, it } from 'vitest';
import { createRun } from '../engine/run/state';
import { createRunPokemon } from '../engine/run/progression';
import { createFighter } from '../engine/battle/fighter';
import {
  CLOSED_DETAIL,
  closeDetail,
  dropMove,
  fighterDetail,
  grabMove,
  memberDetail,
  natureEffect,
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

  it('carries the whole evolution family as a graph', () => {
    const detail = memberDetail(runWith(), 'starter');
    expect(detail?.evolutions.map((node) => node.id)).toEqual([
      'charmander',
      'charmeleon',
      'charizard',
    ]);
    expect(detail?.evolutions[0]?.current).toBe(true);
    expect(detail?.evolutions.some((node) => node.ready)).toBe(false);
  });

  it('reads a box member and returns null for an unknown id', () => {
    expect(memberDetail(runWith(), 'boxed')?.name).toBe('Sentret');
    expect(memberDetail(runWith(), 'nobody')).toBeNull();
  });

  it('shows where a caught member was found, and nothing for the starter', () => {
    const run = runWith();
    expect(memberDetail(run, 'starter')?.caughtLabel).toBeNull();
    const caught = {
      ...createRunPokemon({ id: 'caught', speciesId: 'sentret', level: 4 }),
      caughtAt: { biomeId: 'forest', mapIndex: 2, routeInMap: 1 },
    };
    const withCaught = { ...run, party: [...run.party, caught] };
    expect(memberDetail(withCaught, 'caught')?.caughtLabel).toBe('Deep Forest · Map 2 · Route 2');
  });
});

describe('natureEffect', () => {
  it('flags the raised and lowered stats and leaves HP neutral', () => {
    // Adamant is +Attack / -Sp. Atk.
    expect(natureEffect('adamant', 'atk')).toBe('up');
    expect(natureEffect('adamant', 'spa')).toBe('down');
    expect(natureEffect('adamant', 'def')).toBe('neutral');
    expect(natureEffect('adamant', 'hp')).toBe('neutral');
    expect(natureEffect('serious', 'atk')).toBe('neutral');
    expect(natureEffect('not-a-nature', 'atk')).toBe('neutral');
  });
});

describe('fighterDetail', () => {
  it('resolves a live battle fighter', () => {
    const fighter = createFighter({
      id: 'starter',
      speciesId: 'charmander',
      level: 5,
      moves: ['ember', 'scratch', 'growl'],
    });
    const detail = fighterDetail(fighter);
    expect(detail).toMatchObject({ name: 'Charmander', level: 5, types: ['Fire'] });
    expect(detail.moves.map((move) => move.name)).toEqual(['Ember', 'Scratch', 'Growl']);
    expect(detail.maxHp).toBe(fighter.maxHp);
    expect(detail.stats.atk).toBe(fighter.stats.atk);
  });
});

describe('Hidden Power type', () => {
  const FIRE_IVS = { hp: 0, atk: 31, def: 0, spa: 0, spd: 31, spe: 0 };

  it('shows the IV-derived type on a live fighter detail', () => {
    const fighter = createFighter({
      id: 'hp',
      speciesId: 'charmander',
      level: 5,
      moves: ['hiddenpower'],
      ivs: FIRE_IVS,
    });
    expect(fighterDetail(fighter).moves[0]?.type).toBe('Fire');
  });

  it('shows it on a run member detail too', () => {
    const member = createRunPokemon({
      id: 'hp',
      speciesId: 'charmander',
      level: 5,
      moves: ['hiddenpower'],
      ivs: FIRE_IVS,
    });
    const run = { ...createRun({ seed: 'run-a', starter }), party: [member] };
    expect(memberDetail(run, 'hp')?.moves[0]?.type).toBe('Fire');
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
