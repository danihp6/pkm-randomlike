import { describe, expect, it } from 'vitest';
import { createRun, type RunState } from '../engine/run/state';
import { createRunPokemon, type RunPokemon } from '../engine/run/progression';
import { resolveBattle } from '../engine/run/resolve';
import type { BattleReturn } from '../engine/run/battleLink';
import { createFighter } from '../engine/battle/fighter';
import { getAbility } from '../data/dex';
import {
  CLOSED_DETAIL,
  DETAIL_TABS,
  closeDetail,
  detailStops,
  dropMove,
  fighterDetail,
  grabMove,
  memberDetail,
  natureEffect,
  nextDetailTab,
  openDetail,
  reorderMoves,
  setDetailTab,
  stepStop,
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
      'charizardmegax',
      'charizardmegay',
      'charizardgmax',
    ]);
    expect(detail?.evolutions[0]?.current).toBe(true);
    expect(detail?.evolutions.some((node) => node.ready)).toBe(false);
  });

  it('reads a box member and returns null for an unknown id', () => {
    expect(memberDetail(runWith(), 'boxed')?.name).toBe('Sentret');
    expect(memberDetail(runWith(), 'nobody')).toBeNull();
  });

  it('prefers the nickname and exposes the raw field', () => {
    const named = createRunPokemon({
      id: 'named',
      speciesId: 'charmander',
      level: 5,
      nickname: 'Sparky',
    });
    const detail = memberDetail({ ...runWith(), party: [named] }, 'named');
    expect(detail?.name).toBe('Sparky');
    expect(detail?.nickname).toBe('Sparky');
  });

  it('reads the species name and a null nickname for a member that has none', () => {
    const detail = memberDetail(runWith(), 'starter');
    expect(detail?.name).toBe('Charmander');
    expect(detail?.nickname).toBeNull();
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

describe('memberDetail on two catches of the same species', () => {
  const reward = { enemyLevels: [4], isTrainer: false };

  function captureReturn(run: RunState, captured: RunPokemon): BattleReturn {
    return {
      outcome: 'capture',
      message: 'done',
      player: run.party.map((member) => member.fighter),
      bag: run.bag,
      captured: captured.fighter,
    };
  }

  function withMoves(member: RunPokemon, moveIds: readonly string[]): RunPokemon {
    return {
      ...member,
      fighter: {
        ...member.fighter,
        moves: moveIds.map((moveId) => ({ moveId, pp: 20, maxPp: 20 })),
      },
    };
  }

  it("resolves each member id to that member's own moves", () => {
    // Two wild fighters built the way `BattleScene` builds them: both called `wild`.
    const first = createRunPokemon({ id: 'wild', speciesId: 'sentret', level: 4 });
    const second = createRunPokemon({ id: 'wild', speciesId: 'sentret', level: 4 });
    let run = createRun({ seed: 'catch-a', starter });
    run = resolveBattle(run, captureReturn(run, first), reward).run;
    run = resolveBattle(run, captureReturn(run, second), reward).run;
    run = {
      ...run,
      party: run.party.map((member, index) =>
        index === 1
          ? withMoves(member, ['tackle'])
          : index === 2
            ? withMoves(member, ['scratch'])
            : member,
      ),
    };

    const firstId = run.party[1].fighter.id;
    const secondId = run.party[2].fighter.id;
    expect(firstId).not.toBe(secondId);
    expect(memberDetail(run, firstId)?.moves.map((move) => move.moveId)).toEqual(['tackle']);
    expect(memberDetail(run, secondId)?.moves.map((move) => move.moveId)).toEqual(['scratch']);
  });
});

describe('ability descriptions', () => {
  it('reads the ability text of a member with a known ability', () => {
    const detail = memberDetail(runWith(), 'starter');
    expect(detail?.ability.length).toBeGreaterThan(0);
    expect(detail?.abilityDesc?.length).toBeGreaterThan(0);
  });

  it('is null when the ability id the member carries is unknown', () => {
    const member = createRunPokemon({ id: 'odd', speciesId: 'sentret', level: 3 });
    const run = {
      ...createRun({ seed: 'run-a', starter }),
      party: [{ ...member, fighter: { ...member.fighter, ability: 'not-an-ability' } }],
    };
    expect(memberDetail(run, 'odd')?.abilityDesc).toBeNull();
  });

  it('takes the hand-authored override over the dex blurb for Run Away', () => {
    const member = createRunPokemon({ id: 'runner', speciesId: 'sentret', level: 3 });
    const run = {
      ...createRun({ seed: 'run-a', starter }),
      party: [{ ...member, fighter: { ...member.fighter, ability: 'Run Away' } }],
    };
    expect(memberDetail(run, 'runner')?.abilityDesc).toBe(
      'Always escapes from a wild Pokémon. A trapping effect still stops it.',
    );
    expect(memberDetail(run, 'runner')?.abilityDesc).not.toBe(getAbility('runaway')!.shortDesc);
  });

  it('falls back to the dex blurb for an ability with no override', () => {
    const member = createRunPokemon({ id: 'blazing', speciesId: 'sentret', level: 3 });
    const run = {
      ...createRun({ seed: 'run-a', starter }),
      party: [{ ...member, fighter: { ...member.fighter, ability: 'Blaze' } }],
    };
    const blaze = getAbility('blaze')!;
    expect(memberDetail(run, 'blazing')?.abilityDesc).toBe(blaze.shortDesc || blaze.desc);
    expect(memberDetail(run, 'blazing')?.abilityDesc).not.toBeNull();
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

  it('names a live fighter from its nickname when it has one', () => {
    const fighter = createFighter({
      id: 'named',
      speciesId: 'charmander',
      level: 5,
      moves: ['ember', 'scratch', 'growl'],
      nickname: 'Sparky',
    });
    expect(fighterDetail(fighter)).toMatchObject({ name: 'Sparky', nickname: 'Sparky' });
  });

  it('floats the hand-authored override for Run Away, like the run detail does', () => {
    const fighter = createFighter({
      id: 'runner',
      speciesId: 'sentret',
      level: 5,
      moves: ['tackle'],
      ability: 'Run Away',
    });
    expect(fighterDetail(fighter).abilityDesc).toBe(
      'Always escapes from a wild Pokémon. A trapping effect still stops it.',
    );
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

describe('detail stops', () => {
  it('lists the tabs and wraps between them', () => {
    expect(DETAIL_TABS).toEqual(['stats', 'moves']);
    expect(nextDetailTab('stats', 1)).toBe('moves');
    expect(nextDetailTab('moves', 1)).toBe('stats');
    expect(nextDetailTab('stats', -1)).toBe('moves');
    expect(nextDetailTab('moves', 2)).toBe('moves');
  });

  it('reads the STATS stops as name, ability and one per ready branch', () => {
    expect(detailStops('stats', { evolutions: 2, slots: 0, pool: 0 })).toEqual([
      { kind: 'name', index: 0 },
      { kind: 'ability', index: 0 },
      { kind: 'evolution', index: 0 },
      { kind: 'evolution', index: 1 },
    ]);
    expect(detailStops('stats', { evolutions: 0, slots: 4, pool: 2 })).toEqual([
      { kind: 'name', index: 0 },
      { kind: 'ability', index: 0 },
    ]);
  });

  it('reads the MOVES stops as search, the slots then the pool', () => {
    expect(detailStops('moves', { evolutions: 0, slots: 4, pool: 2 })).toEqual([
      { kind: 'search', index: 0 },
      { kind: 'slot', index: 0 },
      { kind: 'slot', index: 1 },
      { kind: 'slot', index: 2 },
      { kind: 'slot', index: 3 },
      { kind: 'pool', index: 0 },
      { kind: 'pool', index: 1 },
    ]);
    expect(detailStops('moves', { evolutions: 3, slots: 0, pool: 0 })).toEqual([
      { kind: 'search', index: 0 },
    ]);
  });

  it('steps a stop list and wraps it at both ends', () => {
    const stops = detailStops('moves', { evolutions: 0, slots: 2, pool: 1 });
    expect(stops.map((stop) => stop.kind)).toEqual(['search', 'slot', 'slot', 'pool']);
    expect(stepStop(stops, 0, 1)).toBe(1);
    expect(stepStop(stops, 3, 1)).toBe(0);
    expect(stepStop(stops, 0, -1)).toBe(3);
    expect(stepStop(stops, 2, 0)).toBe(2);
    expect(stepStop(stops, 9, 1)).toBe(0);
    expect(stepStop([], 0, 1)).toBe(0);
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

describe('the Tera Crystal on the STATS tab (Task-103)', () => {
  const plain = createRunPokemon({ id: 'plain', speciesId: 'bulbasaur', level: 5 });
  const crystal = createRunPokemon({ id: 'crystal', speciesId: 'bulbasaur', level: 5 });
  const holding = { ...crystal, fighter: { ...crystal.fighter, heldItem: 'teracrystalfire' } };

  it('shows the crystal’s single type instead of the species’ pair', () => {
    const run = { ...createRun({ seed: 'run-a', starter: plain }), party: [holding] };
    expect(memberDetail(run, 'crystal')?.types).toEqual(['Fire']);
    expect(memberDetail(run, 'crystal')?.heldItemName).toBe('Fire Tera Crystal');
  });

  it('leaves a plain member on its species types', () => {
    const run = createRun({ seed: 'run-a', starter: plain });
    expect(memberDetail(run, 'plain')?.types).toEqual(['Grass', 'Poison']);
  });

  it('shows a live Mega its forme’s types when no crystal is held', () => {
    const mega = createFighter({ id: 'mega', speciesId: 'charizardmegax', level: 40 });
    expect(fighterDetail(mega).types).toEqual(['Fire', 'Dragon']);
    const battleHeld = createFighter({
      id: 'lead',
      speciesId: 'bulbasaur',
      level: 40,
      heldItem: 'teracrystalwater',
    });
    expect(fighterDetail(battleHeld).types).toEqual(['Water']);
  });
});
