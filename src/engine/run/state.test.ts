import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { restoreFighter } from '../battle/fighter';
import { FINITE_MAPS, levelCapForMap } from '../../data/maps';
import { BADGE_CAPS, REGION_COUNTS, badgeCap } from '../../data/region';
import { evolutionBranches } from '../../data/dex/evolutions';
import { planNodeContent } from '../region/content';
import { nodeKey, planRegion } from '../region/plan';
import { POKEVIAL_MAX_CHARGES, autoPokevial, fillPokevial, healParty } from './heal';
import { createRunPokemon, runPokemonFromSnapshot, xpForLevel } from './progression';
import { missionForMap, recordHpLost } from './missions';
import {
  MAP_EDGES,
  MAX_PARTY_SIZE,
  addCaughtPokemon,
  addFaints,
  addItem,
  addMoney,
  addPokemon,
  advanceMap,
  advanceRoute,
  canCapture,
  compatForNode,
  consumeItem,
  createRun,
  dedupeMemberIds,
  depositToBox,
  discoverCandy,
  emptyRunStats,
  equipHeldItem,
  evolveMember,
  gainExperience,
  hasLivingParty,
  isItemPicked,
  isRoomDiscovered,
  isTrainerDefeated,
  itemCount,
  markBossDefeated,
  markItemPicked,
  markTrainerDefeated,
  moveInBox,
  moveInParty,
  moveMoves,
  nextMemberId,
  pcFullyEditable,
  pcMemberEditable,
  recordCatch,
  reorderParty,
  runFaints,
  setParty,
  spendMoney,
  swapPartyBox,
  unequipHeldItem,
  updatePokemon,
  useCapture,
  withdrawToParty,
  type MapEdge,
  type RunState,
} from './state';

const starter = createRunPokemon({
  id: 'starter',
  speciesId: 'charmander',
  level: 5,
  moves: ['scratch'],
});
const starterMaxHp = restoreFighter(starter.fighter).maxHp;

function member(id: string, speciesId = 'sentret', level = 3): ReturnType<typeof createRunPokemon> {
  return createRunPokemon({ id, speciesId, level });
}

function withCatches(catches: number): ReturnType<typeof createRun> {
  return { ...createRun({ seed: 'run-a', starter }), stats: { catches, casualties: 0, faints: 0 } };
}

describe('createRun', () => {
  it('starts on route 1 of map 1 with the starter and an empty box', () => {
    const run = createRun({ seed: 'run-a', starter });
    expect(run.routeIndex).toBe(1);
    expect(run.mapIndex).toBe(1);
    expect(run.routeInMap).toBe(0);
    expect(run.discoveredRooms).toEqual([0]);
    expect(run.bossDefeated).toBe(false);
    expect(run.levelCap).toBe(levelCapForMap(1));
    expect(run.pokevialCharges).toBe(POKEVIAL_MAX_CHARGES);
    expect(run.party).toEqual([starter]);
    expect(run.box).toEqual([]);
    expect(run.rip).toEqual([]);
    expect(run.pickedItems).toEqual([]);
    expect(run.capturedRooms).toEqual([]);
    expect(run.money).toBe(0);
    expect(run.mode).toBe('finite');
    expect(run.stats).toEqual({ catches: 0, casualties: 0, faints: 0 });
  });

  it('honours a starting money amount, floored at zero', () => {
    expect(createRun({ seed: 'run-a', starter, money: 500 }).money).toBe(500);
    expect(createRun({ seed: 'run-a', starter, money: -20 }).money).toBe(0);
  });

  it('reads the instant its caller passed in, or blank when it passed none', () => {
    const instant = '2026-10-27T09:30:00.000Z';
    expect(createRun({ seed: 'run-a', starter, startedAt: instant }).startedAt).toBe(instant);
    expect(createRun({ seed: 'run-a', starter, startedAt: '' }).startedAt).toBe('');
    expect(createRun({ seed: 'run-a', starter }).startedAt).toBe('');
  });

  it('starts with no faint on the run’s own counter', () => {
    expect(emptyRunStats()).toEqual({ catches: 0, casualties: 0, faints: 0 });
    expect(createRun({ seed: 'run-a', starter }).stats.faints).toBe(0);
    expect(runFaints(createRun({ seed: 'run-a', starter }).stats)).toBe(0);
  });
});

describe('the node a run stands on', () => {
  it('opens the run on the region’s town with no badge, no catch spent and no streak', () => {
    const run = createRun({ seed: 'run-a', starter });
    const plan = planRegion('run-a');
    expect(run.nodeKey).toBe(plan.townKey);
    expect(run.visitedNodes).toEqual([plan.townKey]);
    expect(run.badges).toEqual([]);
    expect(run.capturedNodes).toEqual([]);
    expect(run.towerStreak).toBe(0);
  });

  it('derives the deprecated floor fields from the town exactly as compatForNode does', () => {
    const run = createRun({ seed: 'run-a', starter });
    const compat = compatForNode('run-a', run.nodeKey);
    expect(run.mapIndex).toBe(compat.mapIndex);
    expect(run.routeIndex).toBe(compat.routeIndex);
    expect(run.routeInMap).toBe(compat.routeInMap);
    expect(run.arrivalEdge).toBe(compat.arrivalEdge);
    expect(run.discoveredRooms).toEqual(compat.discoveredRooms);
    expect(run.bossDefeated).toBe(compat.bossDefeated);
    expect(run.levelCap).toBe(compat.levelCap);
  });

  it('reads a chain node as its own rung of the ladder', () => {
    const plan = planRegion('run-a');
    const compat = compatForNode('run-a', plan.townKey);
    expect(compat.mapIndex).toBe(1);
    expect(compat.routeIndex).toBe(1);
    expect(compat.routeInMap).toBe(0);
    expect(compat.arrivalEdge).toBe('N');
    expect(compat.discoveredRooms).toEqual([0]);
    expect(compat.bossDefeated).toBe(false);
    expect(compat.levelCap).toBe(badgeCap(1));

    const firstRoute = compatForNode('run-a', nodeKey('route', 1));
    expect(firstRoute.mapIndex).toBe(2);
    expect(firstRoute.routeIndex).toBe(2);
    expect(firstRoute.levelCap).toBe(badgeCap(1));
  });

  it('reads a lateral off the main route it hangs from, and clamps the floor to the ladder', () => {
    const plan = planRegion('run-a');
    const lateral = plan.nodes.find((node) => node.kind === 'lateral');
    expect(lateral).toBeDefined();
    const compat = compatForNode('run-a', lateral!.key);
    const parent = plan.chain.indexOf(lateral!.lateralOf!);
    expect(compat.mapIndex).toBe(Math.min(FINITE_MAPS, parent + 1));
    expect(compat.routeIndex).toBe(parent + 1);
    expect(compat.levelCap).toBe(lateral!.cap);

    const tower = compatForNode('run-a', nodeKey('tower', 1));
    expect(tower.mapIndex).toBe(FINITE_MAPS);
    expect(tower.routeIndex).toBe(plan.chain.length);
    expect(tower.levelCap).toBe(badgeCap(BADGE_CAPS.length + 1));
  });

  it('reads an unknown key as the town, never an error', () => {
    const plan = planRegion('run-a');
    for (const key of ['', 'no-such-node', 'city:99', 'town:0']) {
      expect(compatForNode('run-a', key)).toEqual(compatForNode('run-a', plan.townKey));
    }
  });

  it('draws nothing from any stream: a node reads its floor off the ladder alone', () => {
    expect(compatForNode('run-a', 'route:3')).toEqual(compatForNode('run-a', 'route:3'));
    // The floor aliases came from the ladder and a compass fallback, so the seed
    // reaches them only through the region's own shape, never through a draw.
    expect(compatForNode('run-a', 'route:3')).toEqual(compatForNode('run-b', 'route:3'));
  });

  it('leaves the node fields alone when the old floor scene walks a room or a floor', () => {
    const run = createRun({ seed: 'run-a', starter });
    const walked = advanceRoute(run, 1);
    const floored = advanceMap(walked);
    for (const next of [walked, floored]) {
      expect(next.nodeKey).toBe(run.nodeKey);
      expect(next.visitedNodes).toBe(run.visitedNodes);
      expect(next.badges).toBe(run.badges);
      expect(next.capturedNodes).toBe(run.capturedNodes);
      expect(next.towerStreak).toBe(run.towerStreak);
    }
  });
});

describe('the run’s faint counter', () => {
  it('adds the battle’s KOs onto the run', () => {
    const run = createRun({ seed: 'run-a', starter });
    const once = addFaints(run, 3);
    expect(once.stats).toEqual({ catches: 0, casualties: 0, faints: 3 });
    expect(addFaints(once, 2).stats.faints).toBe(5);
    expect(run.stats.faints).toBe(0);
  });

  it('never counts a negative or an unreadable gain', () => {
    const run = createRun({ seed: 'run-a', starter });
    expect(addFaints(run, 0)).toBe(run);
    expect(addFaints(run, -4)).toBe(run);
    expect(addFaints(run, Number.NaN)).toBe(run);
    expect(addFaints(run, 2.7).stats.faints).toBe(2);
  });

  it('reads an absent counter as none, so an older run counts from zero', () => {
    const run = createRun({ seed: 'run-a', starter });
    const legacy: RunState = { ...run, stats: { catches: 1, casualties: 0 } };
    expect(runFaints(legacy.stats)).toBe(0);
    expect(addFaints(legacy, 1).stats.faints).toBe(1);
  });
});

describe('money', () => {
  it('adds a trainer drop, ignoring a zero or negative amount', () => {
    const run = createRun({ seed: 'run-a', starter });
    expect(addMoney(run, 250).money).toBe(250);
    expect(addMoney(run, 0)).toBe(run);
    expect(addMoney(run, -5)).toBe(run);
  });

  it('spends only what the run can afford', () => {
    const run = addMoney(createRun({ seed: 'run-a', starter }), 300);
    expect(spendMoney(run, 200).money).toBe(100);
    expect(spendMoney(run, 300).money).toBe(0);
    expect(spendMoney(run, 500)).toBe(run);
    expect(spendMoney(run, 0)).toBe(run);
  });
});

describe('advanceRoute', () => {
  it('enters a room of the same map and keeps the floor marks and the node capture', () => {
    let run = createRun({ seed: 'run-a', starter });
    run = useCapture(run);
    run = markTrainerDefeated(run, 'trainer-1-0');
    run = markItemPicked(run, 'item-1-0');
    const next = advanceRoute(run, 2);
    expect(next.routeIndex).toBe(2);
    expect(next.mapIndex).toBe(1);
    expect(next.routeInMap).toBe(2);
    expect(next.levelCap).toBe(run.levelCap);
    expect(next.defeatedTrainers).toEqual(['trainer-1-0']);
    expect(next.pickedItems).toEqual(['item-1-0']);
    expect(next.capturedRooms).toEqual(run.capturedRooms);
    expect(next.party).toBe(run.party);
    // The capture is per node: every room of this node reads it spent, another node not.
    expect(canCapture(next)).toBe(false);
    expect(canCapture({ ...run, nodeKey: nodeKey('route', 2) })).toBe(true);
  });

  it('discovers each room once, even when it is re-entered', () => {
    let run = advanceRoute(createRun({ seed: 'run-a', starter }), 1);
    run = advanceRoute(run, 2);
    run = advanceRoute(run, 1);
    expect(run.routeInMap).toBe(1);
    expect(run.discoveredRooms).toEqual([0, 1, 2]);
    expect(isRoomDiscovered(run, 1)).toBe(true);
    expect(isRoomDiscovered(run, 5)).toBe(false);
  });

  it('clamps a negative room to the entry', () => {
    const run = advanceRoute(createRun({ seed: 'run-a', starter }), -3);
    expect(run.routeInMap).toBe(0);
  });

  it('stores the compass door it is given, and falls back when it is not one', () => {
    const base = createRun({ seed: 'run-a', starter });
    // A fresh run reads the compass fallback: a region node has no floor door.
    expect(base.arrivalEdge).toBe('N');

    for (const edge of MAP_EDGES) {
      const custom = advanceRoute(base, 1, edge);
      expect(custom.routeInMap).toBe(1);
      expect(custom.arrivalEdge).toBe(edge);
    }

    // Anything that is not one of the four names reads the compass fallback.
    const walked = advanceRoute(base, 1, 'E');
    const junk = advanceRoute(walked, 2, 'X' as MapEdge);
    expect(junk.arrivalEdge).toBe('N');
    expect(advanceRoute(walked, 2).arrivalEdge).toBe('N');
  });
});

describe('advanceMap', () => {
  it('opens the next floor on its entry room with a fresh discovery set and cap', () => {
    let run = createRun({ seed: 'run-a', starter });
    run = advanceRoute(run, 3);
    const next = advanceMap(run);
    expect(next.mapIndex).toBe(2);
    expect(next.routeIndex).toBe(run.routeIndex + 1);
    expect(next.routeInMap).toBe(0);
    expect(next.arrivalEdge).toBe('N');
    expect(next.discoveredRooms).toEqual([0]);
    expect(next.bossDefeated).toBe(false);
    expect(next.levelCap).toBe(levelCapForMap(2));
    expect(next.capturedRooms).toEqual([]);
    expect(next.defeatedTrainers).toEqual([]);
    expect(next.pickedItems).toEqual([]);
  });

  it('heals HP and PP but never resurrects a fallen member', () => {
    const hurt = {
      ...starter,
      fighter: {
        ...starter.fighter,
        hp: 1,
        moves: starter.fighter.moves.map((slot) => ({ ...slot, pp: 0 })),
      },
    };
    const faintedBase = createRunPokemon({ id: 'fainted', speciesId: 'sentret', level: 3 });
    const dead = { ...faintedBase, fighter: { ...faintedBase.fighter, hp: 0 } };
    const run = { ...createRun({ seed: 'run-a', starter: hurt }), box: [dead] };
    const next = advanceMap(run);
    expect(next.party[0].fighter.hp).toBe(starterMaxHp);
    expect(next.party[0].fighter.moves.every((slot) => slot.pp === slot.maxPp)).toBe(true);
    expect(next.box[0].fighter.hp).toBe(0);
  });

  it('carries the Pokevial charges over the floor change', () => {
    const spent = { ...createRun({ seed: 'run-a', starter }), pokevialCharges: 1 };
    expect(advanceMap(spent).pokevialCharges).toBe(1);
  });
});

describe('the floor mission', () => {
  it('gives a fresh run map 1 its own mission and a clean floor', () => {
    const run = createRun({ seed: 'run-a', starter });
    expect(run.mission).toEqual(missionForMap('run-a', 1));
    expect(run.missionsCompleted).toBe(0);
    expect(run.hpLost).toBe(0);
    expect(run.floorCasualties).toBe(0);
  });

  it('meets a clean floor and draws the next floor its own mission', () => {
    const run = createRun({ seed: 'run-a', starter });
    const next = advanceMap(run);
    expect(next.missionsCompleted).toBe(1);
    expect(next.mission).toEqual(missionForMap('run-a', 2));
    expect(next.hpLost).toBe(0);
    expect(next.floorCasualties).toBe(next.stats.casualties);
  });

  it('does not meet a floor that spent HP', () => {
    const run = recordHpLost(createRun({ seed: 'run-a', starter }), 4);
    const next = advanceMap(run);
    expect(next.missionsCompleted).toBe(0);
    expect(next.hpLost).toBe(0);
  });

  it('does not meet a floor that lost a member, and carries the new baseline', () => {
    const base = createRun({ seed: 'run-a', starter });
    const run = { ...base, stats: { ...base.stats, casualties: base.floorCasualties + 1 } };
    const next = advanceMap(run);
    expect(next.missionsCompleted).toBe(0);
    expect(next.floorCasualties).toBe(run.stats.casualties);
  });

  it('carries the run-long counter across floors and never clears it', () => {
    let run = createRun({ seed: 'run-a', starter });
    run = advanceMap(run);
    run = advanceMap(run);
    expect(run.missionsCompleted).toBe(2);
    expect(run.mission).toEqual(missionForMap('run-a', 3));
  });

  it('leaves all four fields alone on a room change', () => {
    const run = recordHpLost(advanceMap(createRun({ seed: 'run-a', starter })), 2);
    const next = advanceRoute(run, 2);
    expect(next.mission).toBe(run.mission);
    expect(next.missionsCompleted).toBe(run.missionsCompleted);
    expect(next.hpLost).toBe(2);
    expect(next.floorCasualties).toBe(run.floorCasualties);
  });

  it('starts the mission history empty on a fresh run', () => {
    expect(createRun({ seed: 'run-a', starter }).completedMissions).toEqual([]);
  });

  it('records exactly the floors it met, oldest first, and nothing on a missed one', () => {
    const first = missionForMap('run-a', 1);
    let run = createRun({ seed: 'run-a', starter });
    run = advanceMap(run);
    run = advanceMap(recordHpLost(run, 3));
    const third = run.mission;
    run = advanceMap(run);
    expect(run.completedMissions).toEqual([
      { id: first.id, mapIndex: 1 },
      { id: third?.id ?? '', mapIndex: 3 },
    ]);
  });

  it('keeps the counter and the history the same length', () => {
    let run = createRun({ seed: 'run-b', starter });
    for (let floor = 0; floor < 3; floor++) run = advanceMap(run);
    expect(run.completedMissions).toHaveLength(run.missionsCompleted);
  });
});

describe('the run modifiers', () => {
  it('starts a fresh run with the empty record', () => {
    expect(createRun({ seed: 'run-a', starter }).modifiers).toEqual({
      curse: false,
      forcedField: null,
      nextWildType: null,
    });
  });

  it('carries the record untouched through a room change', () => {
    const run: RunState = {
      ...createRun({ seed: 'run-a', starter }),
      modifiers: { curse: true, forcedField: { id: 'rain', floorsLeft: 2 }, nextWildType: 'bug' },
    };
    const next = advanceRoute(run, 1);
    expect(next.modifiers).toBe(run.modifiers);
  });

  it('spends one floor of the forced sky on a floor change and keeps the rest', () => {
    const run: RunState = {
      ...createRun({ seed: 'run-a', starter }),
      modifiers: { curse: true, forcedField: { id: 'rain', floorsLeft: 2 }, nextWildType: 'bug' },
    };
    const next = advanceMap(run);
    expect(next.modifiers).toEqual({
      curse: true,
      forcedField: { id: 'rain', floorsLeft: 1 },
      nextWildType: 'bug',
    });
    expect(advanceMap(next).modifiers).toEqual({
      curse: true,
      forcedField: null,
      nextWildType: 'bug',
    });
  });
});

describe('the fallen', () => {
  const deadMember = () => {
    const base = createRunPokemon({ id: 'fallen', speciesId: 'sentret', level: 3 });
    return { ...base, fighter: { ...base.fighter, hp: 0 } };
  };

  it('a floor change and an automatic vial never touch the fallen', () => {
    const fallen = deadMember();
    const run = createRun({ seed: 'run-a', starter });
    const withFallen = { ...run, rip: [fallen] };
    const hurt = { ...starter, fighter: { ...starter.fighter, hp: 1 } };
    const wounded = { ...withFallen, party: [hurt, fallen] };

    expect(advanceMap(withFallen).rip).toBe(withFallen.rip);
    expect(healParty(withFallen).rip).toBe(withFallen.rip);
    expect(fillPokevial({ ...withFallen, pokevialCharges: 0 }).rip).toBe(withFallen.rip);
    const drunk = autoPokevial(wounded);
    expect(drunk.rip).toBe(withFallen.rip);
    expect(drunk.party[1].fighter.hp).toBe(0);
    expect(gainExperience(withFallen, 50, 'run-a').run.rip).toBe(withFallen.rip);
  });
});

describe('bossDefeated', () => {
  it('marks the map boss once and survives a room change but not a new map', () => {
    const run = createRun({ seed: 'run-a', starter });
    const marked = markBossDefeated(run);
    expect(marked.bossDefeated).toBe(true);
    expect(markBossDefeated(marked)).toBe(marked);
    expect(advanceRoute(marked, 1).bossDefeated).toBe(true);
    expect(advanceMap(marked).bossDefeated).toBe(false);
  });

  it('fills the Pokevial to the cap when the boss falls', () => {
    const spent = { ...createRun({ seed: 'run-a', starter }), pokevialCharges: 0 };
    expect(markBossDefeated(spent).pokevialCharges).toBe(POKEVIAL_MAX_CHARGES);
  });

  it('drinks the boss fill on the same clear when the party is hurt', () => {
    const hurt = { ...starter, fighter: { ...starter.fighter, hp: 1 } };
    const run = { ...createRun({ seed: 'run-a', starter: hurt }), pokevialCharges: 0 };
    const next = markBossDefeated(run);
    expect(next.pokevialCharges).toBe(0);
    expect(next.party[0].fighter.hp).toBe(starterMaxHp);
  });

  it('leaves an already marked boss as the same object, even with a hurt party', () => {
    const hurt = { ...starter, fighter: { ...starter.fighter, hp: 1 } };
    const run = {
      ...createRun({ seed: 'run-a', starter: hurt }),
      pokevialCharges: 0,
      bossDefeated: true,
    };
    expect(markBossDefeated(run)).toBe(run);
  });
});

describe('pokemon moves', () => {
  it('fills the party up to six, then the box', () => {
    let run = createRun({ seed: 'run-a', starter });
    for (let i = 0; i < MAX_PARTY_SIZE - 1; i++) {
      run = addPokemon(run, createRunPokemon({ id: `extra-${i}`, speciesId: 'sentret', level: 3 }));
    }
    expect(run.party).toHaveLength(MAX_PARTY_SIZE);
    expect(run.box).toHaveLength(0);
    run = addPokemon(run, createRunPokemon({ id: 'boxed', speciesId: 'sentret', level: 3 }));
    expect(run.party).toHaveLength(MAX_PARTY_SIZE);
    expect(run.box.map((member) => member.fighter.id)).toEqual(['boxed']);
  });

  it('updates a member in place and ignores an unknown id', () => {
    const run = createRun({ seed: 'run-a', starter });
    const healed = { ...starter, fighter: { ...starter.fighter, hp: 1 } };
    expect(updatePokemon(run, healed).party[0].fighter.hp).toBe(1);
    const stranger = createRunPokemon({ id: 'nobody', speciesId: 'sentret', level: 2 });
    expect(updatePokemon(run, stranger)).toBe(run);
  });

  it('reports a wiped party', () => {
    const run = createRun({ seed: 'run-a', starter });
    expect(hasLivingParty(run)).toBe(true);
    const fainted = { ...starter, fighter: { ...starter.fighter, hp: 0 } };
    expect(hasLivingParty(setParty(run, [fainted]))).toBe(false);
  });
});

describe('the alive rule and the prologue (Task-287)', () => {
  it('reads an empty party as alive only while the starter has not been taken', () => {
    expect(hasLivingParty(createRun({ seed: 'run-a' }))).toBe(true);
    const handEdited: RunState = { ...createRun({ seed: 'run-a' }), starterTaken: true };
    expect(hasLivingParty(handEdited)).toBe(false);
  });

  it('reads a party by its HP, taken or not', () => {
    const fainted = { ...starter, fighter: { ...starter.fighter, hp: 0 } };
    expect(hasLivingParty(createRun({ seed: 'run-a', starter }))).toBe(true);
    expect(hasLivingParty(createRun({ seed: 'run-a', starter: fainted }))).toBe(false);
  });

  it('flags the starter a run was created with, and only that one', () => {
    expect(createRun({ seed: 'run-a', starter }).starterTaken).toBe(true);
    const prologue = createRun({ seed: 'run-a' });
    expect(prologue.starterTaken).toBe(false);
    expect(prologue.party).toEqual([]);
    expect(prologue.xp).toBe(xpForLevel(1));
  });
});

describe('party/PC moves', () => {
  function withParty(ids: readonly string[]): ReturnType<typeof createRun> {
    const members = ids.map((id, index) =>
      index === 0
        ? { ...starter, fighter: { ...starter.fighter, id } }
        : createRunPokemon({ id, speciesId: 'sentret', level: 3 }),
    );
    return { ...createRun({ seed: 'run-a', starter }), party: members };
  }

  it('reorders the party and the box', () => {
    const run = withParty(['a', 'b', 'c']);
    expect(moveInParty(run, 0, 2).party.map((m) => m.fighter.id)).toEqual(['b', 'c', 'a']);
    expect(moveInParty(run, 2, 0).party.map((m) => m.fighter.id)).toEqual(['c', 'a', 'b']);
    expect(moveInParty(run, 1, 1)).toBe(run);
    expect(moveInParty(run, 0, 5)).toBe(run);
    const boxed = {
      ...run,
      box: [
        createRunPokemon({ id: 'x', speciesId: 'sentret', level: 3 }),
        createRunPokemon({ id: 'y', speciesId: 'sentret', level: 3 }),
      ],
    };
    expect(moveInBox(boxed, 0, 1).box.map((m) => m.fighter.id)).toEqual(['y', 'x']);
  });

  it('deposits a party member in the box', () => {
    const run = withParty(['a', 'b']);
    const next = depositToBox(run, 0);
    expect(next.party.map((m) => m.fighter.id)).toEqual(['b']);
    expect(next.box.map((m) => m.fighter.id)).toEqual(['a']);
  });

  it('refuses to deposit the last party member', () => {
    const run = withParty(['a']);
    expect(depositToBox(run, 0)).toBe(run);
  });

  it('withdraws a boxed member while the party has room', () => {
    const run = {
      ...withParty(['a']),
      box: [createRunPokemon({ id: 'boxed', speciesId: 'sentret', level: 3 })],
    };
    const next = withdrawToParty(run, 0);
    expect(next.party.map((m) => m.fighter.id)).toEqual(['a', 'boxed']);
    expect(next.box).toEqual([]);
  });

  it('refuses to withdraw into a full party', () => {
    const full = withParty(['a', 'b', 'c', 'd', 'e', 'f']);
    const run = { ...full, box: [createRunPokemon({ id: 'boxed', speciesId: 'sentret', level: 3 })] };
    expect(withdrawToParty(run, 0)).toBe(run);
    expect(withdrawToParty(run, 7)).toBe(run);
  });

  it('swaps a party member for a boxed one, keeping both slots', () => {
    const full = withParty(['a', 'b', 'c', 'd', 'e', 'f']);
    const run = {
      ...full,
      box: [
        createRunPokemon({ id: 'x', speciesId: 'sentret', level: 3 }),
        createRunPokemon({ id: 'y', speciesId: 'sentret', level: 3 }),
      ],
    };
    const next = swapPartyBox(run, 2, 0);
    expect(next.party.map((m) => m.fighter.id)).toEqual(['a', 'b', 'x', 'd', 'e', 'f']);
    expect(next.box.map((m) => m.fighter.id)).toEqual(['c', 'y']);
  });

  it('refuses a swap when one of the slots is empty', () => {
    const run = withParty(['a', 'b']);
    expect(swapPartyBox(run, 0, 0)).toBe(run);
    expect(swapPartyBox(run, 9, 0)).toBe(run);
    expect(swapPartyBox(run, 0, 9)).toBe(run);
  });
});

describe('reorderParty', () => {
  function withParty(ids: readonly string[]): ReturnType<typeof createRun> {
    const members = ids.map((id, index) =>
      index === 0
        ? { ...starter, fighter: { ...starter.fighter, id } }
        : createRunPokemon({ id, speciesId: 'sentret', level: 3 }),
    );
    return { ...createRun({ seed: 'run-a', starter }), party: members };
  }

  const ids = (run: ReturnType<typeof createRun>): readonly string[] =>
    run.party.map((m) => m.fighter.id);

  it('makes the dropped-on swap and lets the lead follow it', () => {
    const run = withParty(['a', 'b', 'c']);
    expect(ids(reorderParty(run, 1, 0))).toEqual(['b', 'a', 'c']);
    expect(reorderParty(run, 1, 0).party[0]!.fighter.id).toBe('b');
  });

  it('swaps rather than sliding, unlike moveInParty', () => {
    const run = withParty(['a', 'b', 'c']);
    expect(ids(reorderParty(run, 0, 2))).toEqual(['c', 'b', 'a']);
    expect(ids(moveInParty(run, 0, 2))).toEqual(['b', 'c', 'a']);
  });

  it('returns the same run for a same-index or out-of-range swap', () => {
    const run = withParty(['a', 'b', 'c']);
    expect(reorderParty(run, 1, 1)).toBe(run);
    expect(reorderParty(run, 0, 9)).toBe(run);
    expect(reorderParty(run, -1, 0)).toBe(run);
    expect(reorderParty(run, 9, 0)).toBe(run);
    expect(reorderParty({ ...run, party: [] }, 0, 0)).toEqual({ ...run, party: [] });
  });

  it('never mutates the party it was given and leaves the box alone', () => {
    const run = {
      ...withParty(['a', 'b', 'c']),
      box: [createRunPokemon({ id: 'boxed', speciesId: 'sentret', level: 3 })],
    };
    const next = reorderParty(run, 0, 2);
    expect(ids(run)).toEqual(['a', 'b', 'c']);
    expect(next.box).toBe(run.box);
  });
});

describe('move reorder', () => {
  const moves = (member: ReturnType<typeof createRunPokemon>): readonly string[] =>
    member.fighter.moves.map((slot) => slot.moveId);

  it("reorders a member's moves in place", () => {
    const mon = createRunPokemon({
      id: 'starter',
      speciesId: 'charmander',
      level: 5,
      moves: ['ember', 'scratch', 'growl'],
    });
    const run = createRun({ seed: 'run-a', starter: mon });
    const next = moveMoves(run, 'starter', 0, 2);
    expect(moves(next.party[0])).toEqual(['scratch', 'growl', 'ember']);
    expect(moveMoves(next, 'starter', 1, 0).party[0].fighter.moves.map((slot) => slot.moveId)).toEqual([
      'growl',
      'scratch',
      'ember',
    ]);
  });

  it('reorders a boxed member and ignores a bad move or member', () => {
    const boxed = createRunPokemon({
      id: 'boxed',
      speciesId: 'charmander',
      level: 5,
      moves: ['ember', 'scratch'],
    });
    const run = { ...createRun({ seed: 'run-a', starter }), box: [boxed] };
    expect(moveMoves(run, 'boxed', 0, 1).box[0].fighter.moves.map((slot) => slot.moveId)).toEqual([
      'scratch',
      'ember',
    ]);
    expect(moveMoves(run, 'boxed', 0, 0)).toBe(run);
    expect(moveMoves(run, 'boxed', 0, 9)).toBe(run);
    expect(moveMoves(run, 'nobody', 0, 1)).toBe(run);
  });
});

describe('nextMemberId', () => {
  it('mints catch-1 for a fresh run with only its starter', () => {
    expect(nextMemberId(createRun({ seed: 'run-a', starter }))).toBe('catch-1');
  });

  it('follows the run catch count', () => {
    expect(nextMemberId(withCatches(2))).toBe('catch-3');
  });

  it('steps past an id the box already holds', () => {
    const run = { ...withCatches(0), box: [member('catch-1')] };
    expect(nextMemberId(run)).toBe('catch-2');
  });

  it('never mints wild or an id the party or the box already holds', () => {
    const run = {
      ...withCatches(1),
      party: [starter, member('catch-2')],
      box: [member('catch-3')],
    };
    const id = nextMemberId(run);
    expect(id).toBe('catch-4');
    expect(id).not.toBe('wild');
    expect([...run.party, ...run.box].some((entry) => entry.fighter.id === id)).toBe(false);
  });
});

describe('dedupeMemberIds', () => {
  it('re-keys the duplicate party ids and then the box, never reusing a party id', () => {
    const run = {
      ...createRun({ seed: 'run-a', starter }),
      party: [member('wild'), member('wild'), member('wild')],
      box: [member('wild')],
    };
    const next = dedupeMemberIds(run);
    expect(next.party.map((entry) => entry.fighter.id)).toEqual(['wild', 'catch-1', 'catch-2']);
    expect(next.box.map((entry) => entry.fighter.id)).toEqual(['catch-3']);
  });

  it('re-keys a colliding box member against the party ids', () => {
    const run = {
      ...createRun({ seed: 'run-a', starter }),
      party: [member('starter'), member('catch-2')],
      box: [member('catch-2'), member('catch-2')],
    };
    const next = dedupeMemberIds(run);
    expect(next.party.map((entry) => entry.fighter.id)).toEqual(['starter', 'catch-2']);
    expect(next.box.map((entry) => entry.fighter.id)).toEqual(['catch-1', 'catch-3']);
  });

  it('touches nothing but the id of a re-keyed member', () => {
    const caught = member('wild', 'sentret', 4);
    const original = {
      ...caught,
      fighter: { ...caught.fighter, hp: 7, status: 'brn' as const, statusCounter: 3 },
      caughtAt: { biomeId: 'forest', mapIndex: 1, routeInMap: 2 },
    };
    const run = { ...withCatches(2), party: [member('wild'), original] };
    const next = dedupeMemberIds(run);
    const rekeyed = next.party[1];
    expect(rekeyed.fighter.id).toBe('catch-1');
    expect({ ...rekeyed, fighter: { ...rekeyed.fighter, id: 'wild' } }).toEqual(original);
    expect(next.stats).toEqual({ catches: 2, casualties: 0, faints: 0 });
  });

  it('returns a run whose ids are already unique as the same object', () => {
    const run = {
      ...createRun({ seed: 'run-a', starter }),
      party: [starter, member('catch-1')],
      box: [member('boxed')],
    };
    expect(dedupeMemberIds(run)).toBe(run);
  });
});

describe('capture and trainers', () => {
  it('spends the route node its one catch, and only that node', () => {
    const plan = planRegion('run-a');
    const route: RunState = { ...createRun({ seed: 'run-a', starter }), nodeKey: nodeKey('route', 1) };
    expect(planNodeContent(plan, route.nodeKey, 1).grass).toBe(true);

    expect(canCapture(route)).toBe(true);
    const spent = useCapture(route);
    expect(spent.capturedNodes).toEqual([nodeKey('route', 1)]);
    expect(canCapture(spent)).toBe(false);
    // The same node again is the same object: nothing to spend and nothing to dirty.
    expect(useCapture(spent)).toBe(spent);
    // Another node of the region is still unspent.
    expect(canCapture({ ...spent, nodeKey: nodeKey('route', 2) })).toBe(true);
  });

  it('leaves the town and every city with grass capturable', () => {
    const plan = planRegion('run-a');
    const start = createRun({ seed: 'run-a', starter });
    expect(canCapture({ ...start, nodeKey: plan.townKey })).toBe(true);
    const settings = plan.nodes.filter((node) => node.kind === 'city');
    expect(settings).toHaveLength(REGION_COUNTS.cities);
    for (const city of settings) {
      expect(planNodeContent(plan, city.key, city.tier ?? 1).grass, city.key).toBe(true);
      expect(canCapture({ ...start, nodeKey: city.key }), city.key).toBe(true);
    }
  });

  it('records a beaten trainer once', () => {
    let run = createRun({ seed: 'run-a', starter });
    run = markTrainerDefeated(run, 'trainer-1-0');
    expect(isTrainerDefeated(run, 'trainer-1-0')).toBe(true);
    expect(markTrainerDefeated(run, 'trainer-1-0')).toBe(run);
  });

  it('counts a catch for the run summary', () => {
    const run = createRun({ seed: 'run-a', starter });
    expect(recordCatch(run, 'sentret').stats).toEqual({ catches: 1, casualties: 0, faints: 0 });
  });
});

describe('caught species record', () => {
  it('starts empty and survives a room and a floor change', () => {
    const fresh = createRun({ seed: 'run-a', starter });
    expect(fresh.caughtSpecies).toEqual([]);
    const caught = recordCatch(fresh, 'pikachu');
    expect(advanceRoute(caught, 1).caughtSpecies).toEqual(['pikachu']);
    expect(advanceMap(caught).caughtSpecies).toEqual(['pikachu']);
  });

  it('records a species once while counting every catch', () => {
    const run = createRun({ seed: 'run-a', starter });
    const twice = recordCatch(recordCatch(run, 'Pikachu'), 'pikachu');
    expect(twice.caughtSpecies).toEqual(['pikachu']);
    expect(twice.stats.catches).toBe(2);
  });

  it('keeps catch order across a repeat', () => {
    let run = createRun({ seed: 'run-a', starter });
    run = recordCatch(run, 'sentret');
    run = recordCatch(run, 'pikachu');
    run = recordCatch(run, 'sentret');
    expect(run.caughtSpecies).toEqual(['sentret', 'pikachu']);
    expect(run.stats.catches).toBe(3);
  });
});

describe('ground items', () => {
  it('marks a picked item once and reports it', () => {
    let run = createRun({ seed: 'run-a', starter });
    expect(isItemPicked(run, 'item-1-0')).toBe(false);
    run = markItemPicked(run, 'item-1-0');
    expect(isItemPicked(run, 'item-1-0')).toBe(true);
    expect(markItemPicked(run, 'item-1-0')).toBe(run);
    expect(run.pickedItems).toEqual(['item-1-0']);
  });
});

describe('bag', () => {
  it('stacks, consumes and drops empty stacks', () => {
    let run = createRun({ seed: 'run-a', starter, bag: [{ itemId: 'potion', count: 1 }] });
    expect(itemCount(run, 'potion')).toBe(1);
    run = addItem(run, 'potion', 2);
    run = addItem(run, 'pokeball');
    expect(itemCount(run, 'potion')).toBe(3);
    expect(itemCount(run, 'pokeball')).toBe(1);
    run = consumeItem(run, 'potion', 3);
    expect(itemCount(run, 'potion')).toBe(0);
    expect(run.bag.some((slot) => slot.itemId === 'potion')).toBe(false);
    expect(consumeItem(run, 'greatball')).toBe(run);
    expect(consumeItem(run, 'pokeball', 0)).toBe(run);
  });
});

describe('held items', () => {
  function runWithBag(): ReturnType<typeof createRun> {
    return createRun({ seed: 'run-a', starter, bag: [{ itemId: 'charcoal', count: 2 }] });
  }

  it('takes a stack from the bag and puts it on the member', () => {
    const run = runWithBag();
    const next = equipHeldItem(run, 'starter', 'charcoal');
    expect(next.party[0].fighter.heldItem).toBe('charcoal');
    expect(itemCount(next, 'charcoal')).toBe(1);
  });

  it('refuses a heal, a status cure, a ball, a TM or a valuable', () => {
    const run = createRun({
      seed: 'run-a',
      starter,
      bag: [
        { itemId: 'potion', count: 1 },
        { itemId: 'antidote', count: 1 },
        { itemId: 'pokeball', count: 1 },
        { itemId: 'tm001', count: 1 },
        { itemId: 'nugget', count: 1 },
      ],
    });
    for (const itemId of ['potion', 'antidote', 'pokeball', 'tm001', 'nugget']) {
      expect(equipHeldItem(run, 'starter', itemId), itemId).toBe(run);
    }
    expect(run.party[0].fighter.heldItem).toBeNull();
    expect(itemCount(run, 'potion')).toBe(1);
  });

  it('returns whatever the member already held to the bag', () => {
    const run = equipHeldItem(runWithBag(), 'starter', 'charcoal');
    const swapped = equipHeldItem(addItem(run, 'leftovers'), 'starter', 'leftovers');
    expect(swapped.party[0].fighter.heldItem).toBe('leftovers');
    expect(itemCount(swapped, 'leftovers')).toBe(0);
    expect(itemCount(swapped, 'charcoal')).toBe(2);
  });

  it('equips a boxed member too', () => {
    const boxed = createRunPokemon({ id: 'boxed', speciesId: 'sentret', level: 3 });
    const run = { ...runWithBag(), box: [boxed] };
    const next = equipHeldItem(run, 'boxed', 'charcoal');
    expect(next.box[0].fighter.heldItem).toBe('charcoal');
  });

  it('is a no-op for the same item, an empty stack or an unknown member', () => {
    const run = equipHeldItem(runWithBag(), 'starter', 'charcoal');
    expect(equipHeldItem(run, 'starter', 'charcoal')).toBe(run);
    expect(equipHeldItem(run, 'starter', 'leftovers')).toBe(run);
    expect(equipHeldItem(run, 'nobody', 'charcoal')).toBe(run);
    const bare = createRun({ seed: 'run-a', starter });
    expect(equipHeldItem(bare, 'starter', 'charcoal')).toBe(bare);
  });

  it('unequips a held item back to the bag', () => {
    const run = equipHeldItem(runWithBag(), 'starter', 'charcoal');
    const bare = unequipHeldItem(run, 'starter');
    expect(bare.party[0].fighter.heldItem).toBeNull();
    expect(itemCount(bare, 'charcoal')).toBe(2);
  });

  it('will not unequip a member holding nothing', () => {
    const run = createRun({ seed: 'run-a', starter });
    expect(unequipHeldItem(run, 'starter')).toBe(run);
  });
});

describe('PC editing rights', () => {
  const full = () => {
    let run = createRun({ seed: 'pc-a', starter });
    for (let i = 1; i < MAX_PARTY_SIZE; i++) {
      run = addPokemon(run, createRunPokemon({ id: `p${i}`, speciesId: 'sentret', level: 3 }));
    }
    return run;
  };
  const caught = () => createRunPokemon({ id: 'catch', speciesId: 'pikachu', level: 4 });

  it('is refused everywhere but a Centre, and the flag is the only way in', () => {
    const run = createRun({ seed: 'pc-a', starter });
    expect(pcFullyEditable(run)).toBe(false);
    expect(pcMemberEditable(run)).toBe(false);
    expect(pcFullyEditable(run, false)).toBe(false);
    expect(pcMemberEditable(run, false)).toBe(false);
    expect(pcFullyEditable(run, true)).toBe(true);
    expect(pcMemberEditable(run, true)).toBe(true);
  });

  it('reads the room, not the run: no floor state opens the box', () => {
    const entry = createRun({ seed: 'pc-a', starter });
    expect(entry.routeInMap).toBe(0);
    expect(pcMemberEditable(entry)).toBe(false);

    const away = advanceRoute(entry, 1);
    expect(pcMemberEditable(away)).toBe(false);
    expect(pcMemberEditable(advanceMap(away))).toBe(false);
    // A Centre is a room the run walks into, so the same run opens it there.
    expect(pcMemberEditable(away, true)).toBe(true);
    expect(pcMemberEditable(advanceMap(away), true)).toBe(true);
  });

  it('boxes a catch on a full party and withdraws it only inside a Centre', () => {
    const boxed = addCaughtPokemon(full(), caught());
    expect(boxed.box.map((member) => member.fighter.id)).toEqual(['catch']);
    expect(pcMemberEditable(boxed)).toBe(false);
    expect(pcMemberEditable(boxed, true)).toBe(true);
  });

  it('places a catch in the party first and only boxes it on a full party', () => {
    const run = advanceRoute(createRun({ seed: 'pc-a', starter }), 1);
    const placed = addCaughtPokemon(run, caught());
    expect(placed.party.map((member) => member.fighter.id)).toEqual(['starter', 'catch']);
    expect(placed.box).toEqual([]);
  });
});

describe('evolveMember', () => {
  it('evolves a party member into a branch its level allows', () => {
    const run = createRun({
      seed: 'evo-a',
      starter: createRunPokemon({ id: 'c', speciesId: 'charmander', level: 16 }),
    });
    const next = evolveMember(run, 'c', 'charmeleon');
    expect(next.party[0].fighter.speciesId).toBe('charmeleon');
  });

  it('leaves the run untouched for an unknown member or an unready branch', () => {
    const run = createRun({
      seed: 'evo-b',
      starter: createRunPokemon({ id: 'c', speciesId: 'charmander', level: 10 }),
    });
    expect(evolveMember(run, 'c', 'charmeleon')).toBe(run);
    expect(evolveMember(run, 'nobody', 'charmeleon')).toBe(run);
  });
});

/** The STATS tab's click path over a Rotom's hand-authored appliance branches (`D38`). */
describe('evolveMember rotom appliance', () => {
  const level = evolutionBranches('rotom')[0]!.level;

  function rotomRun(speciesId: string, at: number): ReturnType<typeof createRun> {
    const fighter = createRunPokemon({ id: 'r', speciesId, level: at }).fighter;
    const caught = runPokemonFromSnapshot(fighter, { biomeId: 'meadow', mapIndex: 1, routeInMap: 0 });
    return createRun({ seed: 'rotom-evo', starter: caught });
  }

  it('applies the click at the resolved level and keeps the catch location', () => {
    const run = rotomRun('rotom', level);
    const next = evolveMember(run, 'r', 'rotomheat');
    expect(next).not.toBe(run);
    expect(next.party[0]!.fighter.speciesId).toBe('rotomheat');
    expect(next.party[0]!.caughtAt).toEqual(run.party[0]!.caughtAt);
    expect(run.party[0]!.fighter.speciesId).toBe('rotom');
  });

  it('is a no-op below the level and from an appliance back to rotom', () => {
    const early = rotomRun('rotom', level - 1);
    expect(evolveMember(early, 'r', 'rotomheat')).toBe(early);
    const appliance = rotomRun('rotomheat', 100);
    expect(evolveMember(appliance, 'r', 'rotom')).toBe(appliance);
    expect(evolveMember(appliance, 'r', 'rotomwash')).toBe(appliance);
  });

  it('is deterministic: the same click twice gives deep-equal members', () => {
    const run = rotomRun('rotom', level);
    const once = evolveMember(run, 'r', 'rotomheat');
    const twice = evolveMember(run, 'r', 'rotomheat');
    expect(twice).toEqual(once);
    expect(twice.party).toEqual(once.party);
  });
});

describe('the discovered candy colours (Task-103)', () => {
  it('starts a fresh run with an empty set', () => {
    expect(createRun({ seed: 'run-a', starter }).discoveredCandy).toEqual([]);
  });

  it('adds a colour in order, once, and answers the same run for a repeat', () => {
    const run = createRun({ seed: 'run-a', starter });
    const red = discoverCandy(run, 'red');
    expect(red.discoveredCandy).toEqual(['red']);
    expect(red).not.toBe(run);
    const blue = discoverCandy(red, 'blue');
    expect(blue.discoveredCandy).toEqual(['red', 'blue']);
    expect(discoverCandy(blue, 'red')).toBe(blue);
    expect(discoverCandy(blue, '')).toBe(blue);
  });

  it('survives a room change and a floor change, unlike the floor marks', () => {
    const discovered = discoverCandy(createRun({ seed: 'run-a', starter }), 'pink');
    expect(advanceRoute(discovered, 1).discoveredCandy).toEqual(['pink']);
    const nextFloor = advanceMap(discovered);
    expect(nextFloor.mapIndex).toBe(2);
    expect(nextFloor.discoveredCandy).toEqual(['pink']);
    expect(nextFloor.caughtSpecies).toEqual(discovered.caughtSpecies);
  });
});

describe('the run engine stays pure', () => {
  const SOURCES = ['state.ts', 'history.ts', '../save.ts'];

  // `document` in `save.ts` is the JSON save document, not the DOM: the browser
  // store reaches it only through the injected `StorageLike`.
  it('imports no Phaser, reaches no browser global and draws nothing unseeded', () => {
    for (const path of SOURCES) {
      const source = readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
      expect(source, path).not.toMatch(/from ['"]phaser['"]/);
      expect(source, path).not.toMatch(/\bMath\.random\b/);
      expect(source, path).not.toMatch(/\bDate\.now\b/);
      expect(source, path).not.toMatch(/\blocalStorage\b|\bwindow\.|\bglobalThis\.document\b/);
    }
  });
});
