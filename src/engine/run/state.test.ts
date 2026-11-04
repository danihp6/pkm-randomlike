import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { restoreFighter } from '../battle/fighter';
import { REGION_COUNTS } from '../../data/region';
import { evolutionBranches } from '../../data/dex/evolutions';
import { planNodeContent } from '../region/content';
import { nodeKey, nodeOf, planRegion } from '../region/plan';
import { POKEVIAL_MAX_CHARGES, autoPokevial, fillPokevial, healParty } from './heal';
import { createRunPokemon, runPokemonFromSnapshot, xpForLevel } from './progression';
import { missionForMap } from './missions';
import {
  MAX_PARTY_SIZE,
  addCaughtPokemon,
  addFaints,
  addItem,
  addMoney,
  addPokemon,
  canCapture,
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
  isTrainerDefeated,
  itemCount,
  markBossDefeated,
  markItemPicked,
  markTrainerDefeated,
  moveInBox,
  moveInParty,
  moveMoves,
  nextMemberId,
  nodeEntry,
  pcFullyEditable,
  pcMemberEditable,
  recordCatch,
  reorderParty,
  runFaints,
  runNode,
  setParty,
  spendMoney,
  swapPartyBox,
  unequipHeldItem,
  updatePokemon,
  useCapture,
  withdrawToParty,
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
  it('starts on the town node with the starter and an empty box', () => {
    const run = createRun({ seed: 'run-a', starter });
    expect(run.discoveredRooms).toEqual([0]);
    expect(run.bossDefeated).toBe(false);
    expect(run.levelCap).toBe(nodeEntry('run-a', run.nodeKey).levelCap);
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

  it('creates the run on the town’s node entry', () => {
    const run = createRun({ seed: 'run-a', starter });
    const entry = nodeEntry('run-a', run.nodeKey);
    expect(run.arrivalEdge).toBe(entry.arrivalEdge);
    expect(run.discoveredRooms).toEqual(entry.discoveredRooms);
    expect(run.bossDefeated).toBe(entry.bossDefeated);
    expect(run.levelCap).toBe(entry.levelCap);
  });

  it('reads a node entry as its own rung of the ladder', () => {
    const plan = planRegion('run-a');
    const town = nodeEntry('run-a', plan.townKey);
    expect(town.arrivalEdge).toBe('N');
    expect(town.discoveredRooms).toEqual([0]);
    expect(town.bossDefeated).toBe(false);
    expect(town.levelCap).toBe(nodeOf(plan, plan.townKey)!.cap);

    const firstRoute = nodeEntry('run-a', nodeKey('route', 1));
    expect(firstRoute.levelCap).toBe(nodeOf(plan, nodeKey('route', 1))!.cap);
    expect(firstRoute.levelCap).toBe(town.levelCap);
  });

  it('reads a lateral’s and the tower’s own cap', () => {
    const plan = planRegion('run-a');
    const lateral = plan.nodes.find((node) => node.kind === 'lateral');
    expect(lateral).toBeDefined();
    expect(nodeEntry('run-a', lateral!.key).levelCap).toBe(lateral!.cap);

    const tower = nodeEntry('run-a', nodeKey('tower', 1));
    expect(tower.levelCap).toBe(nodeOf(plan, nodeKey('tower', 1))!.cap);
  });

  it('reads an unknown key as the town, never an error', () => {
    const plan = planRegion('run-a');
    for (const key of ['', 'no-such-node', 'city:99', 'town:0']) {
      expect(nodeEntry('run-a', key)).toEqual(nodeEntry('run-a', plan.townKey));
    }
  });

  it('draws nothing from any stream: a node entry reads the plan alone', () => {
    expect(nodeEntry('run-a', 'route:3')).toEqual(nodeEntry('run-a', 'route:3'));
    // A node's cap comes from the plan's own ladder, never from a draw.
    expect(nodeEntry('run-a', 'route:3')).toEqual(nodeEntry('run-b', 'route:3'));
  });

  it('answers the plan node the run stands on, and the town for a stale key', () => {
    const plan = planRegion('run-a');
    const run = createRun({ seed: 'run-a', starter });
    expect(runNode(run)).toEqual(nodeOf(plan, plan.townKey));

    const onRoute: RunState = { ...run, nodeKey: nodeKey('route', 2) };
    expect(runNode(onRoute).badge).toBe(2);
    expect(runNode(onRoute).cap).toBe(nodeOf(plan, nodeKey('route', 2))!.cap);

    const stale: RunState = { ...run, nodeKey: 'city:99' };
    expect(runNode(stale)).toEqual(nodeOf(plan, plan.townKey));
  });

  it('reads a node’s biome index and name off the node the run stands on', () => {
    const plan = planRegion('run-a');
    const run: RunState = { ...createRun({ seed: 'run-a', starter }), nodeKey: nodeKey('city', 3) };
    const node = runNode(run);
    expect(node.badge).toBe(3);
    expect(node.id).toBe(3);
    expect(node.key).toBe(nodeKey('city', 3));
    expect(node.name).toBe(nodeOf(plan, node.key)!.name);
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

describe('the floor mission', () => {
  it('gives a fresh run map 1 its own mission and a clean floor', () => {
    const run = createRun({ seed: 'run-a', starter });
    expect(run.mission).toEqual(missionForMap('run-a', 1));
    expect(run.missionsCompleted).toBe(0);
    expect(run.hpLost).toBe(0);
    expect(run.floorCasualties).toBe(0);
    expect(run.completedMissions).toEqual([]);
  });
});

describe('the fallen', () => {
  const deadMember = () => {
    const base = createRunPokemon({ id: 'fallen', speciesId: 'sentret', level: 3 });
    return { ...base, fighter: { ...base.fighter, hp: 0 } };
  };

  it('a heal and an automatic vial never touch the fallen', () => {
    const fallen = deadMember();
    const run = createRun({ seed: 'run-a', starter });
    const withFallen = { ...run, rip: [fallen] };
    const hurt = { ...starter, fighter: { ...starter.fighter, hp: 1 } };
    const wounded = { ...withFallen, party: [hurt, fallen] };

    expect(healParty(withFallen).rip).toBe(withFallen.rip);
    expect(fillPokevial({ ...withFallen, pokevialCharges: 0 }).rip).toBe(withFallen.rip);
    const drunk = autoPokevial(wounded);
    expect(drunk.rip).toBe(withFallen.rip);
    expect(drunk.party[1].fighter.hp).toBe(0);
    expect(gainExperience(withFallen, 50, 'run-a').run.rip).toBe(withFallen.rip);
  });
});

describe('bossDefeated', () => {
  it('marks the node’s boss once, and a node entry starts with it standing', () => {
    const run = createRun({ seed: 'run-a', starter });
    const marked = markBossDefeated(run);
    expect(marked.bossDefeated).toBe(true);
    expect(markBossDefeated(marked)).toBe(marked);
    expect(nodeEntry('run-a', nodeKey('route', 2)).bossDefeated).toBe(false);
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
  it('starts empty and is carried onto another node', () => {
    const fresh = createRun({ seed: 'run-a', starter });
    expect(fresh.caughtSpecies).toEqual([]);
    const caught = recordCatch(fresh, 'pikachu');
    const moved = { ...caught, nodeKey: nodeKey('route', 1) };
    expect(moved.caughtSpecies).toEqual(['pikachu']);
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

  it('reads the room, not the run: no node state opens the box', () => {
    const entry = createRun({ seed: 'pc-a', starter });
    expect(pcMemberEditable(entry)).toBe(false);

    const away: RunState = { ...entry, nodeKey: nodeKey('route', 1) };
    expect(pcMemberEditable(away)).toBe(false);
    // A Centre is a room the run walks into, so the same run opens it there.
    expect(pcMemberEditable(away, true)).toBe(true);
  });

  it('boxes a catch on a full party and withdraws it only inside a Centre', () => {
    const boxed = addCaughtPokemon(full(), caught());
    expect(boxed.box.map((member) => member.fighter.id)).toEqual(['catch']);
    expect(pcMemberEditable(boxed)).toBe(false);
    expect(pcMemberEditable(boxed, true)).toBe(true);
  });

  it('places a catch in the party first and only boxes it on a full party', () => {
    const run: RunState = { ...createRun({ seed: 'pc-a', starter }), nodeKey: nodeKey('route', 1) };
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

  it('is carried onto another node, unlike the node’s own marks', () => {
    const discovered = discoverCandy(createRun({ seed: 'run-a', starter }), 'pink');
    const moved: RunState = {
      ...discovered,
      nodeKey: nodeKey('route', 2),
      ...nodeEntry('run-a', nodeKey('route', 2)),
    };
    expect(moved.discoveredCandy).toEqual(['pink']);
    expect(moved.caughtSpecies).toEqual(discovered.caughtSpecies);
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
