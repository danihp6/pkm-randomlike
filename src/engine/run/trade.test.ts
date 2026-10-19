import { describe, expect, it } from 'vitest';
import { statAtLevel } from '../../data/dex/natures';
import { getSpecies } from '../../data/dex/species';
import { FINITE_MAPS, levelCapForMap } from '../../data/maps';
import { bandForMap } from './floors';
import { speciesPool } from './pool';
import { createRunPokemon, type RunPokemon } from './progression';
import { addPokemon, createRun, squadLevel, type RunState } from './state';
import { canTrade, removeMember, tradeId, tradePokemon } from './trade';

const SEED = 'pkm-111';
const MAP_INDEX = 5;
const ROOM_ID = 3;

function memberOf(speciesId: string, id: string, level = 5): RunPokemon {
  return createRunPokemon({ id, speciesId, level, moves: ['scratch'] });
}

function runWith(
  species: readonly string[],
  options: Readonly<{ box?: readonly string[]; pickedItems?: readonly string[] }> = {},
): RunState {
  const party = species.map((speciesId, index) => memberOf(speciesId, `member-${index}`));
  const box = (options.box ?? []).map((speciesId, index) => memberOf(speciesId, `boxed-${index}`));
  const created = createRun({ seed: SEED, starter: party[0] });
  return {
    ...created,
    mapIndex: MAP_INDEX,
    levelCap: levelCapForMap(MAP_INDEX),
    party,
    box,
    ...(options.pickedItems ? { pickedItems: options.pickedItems } : {}),
  };
}

function sameBooks(before: RunState, after: RunState): void {
  expect(after.stats).toEqual(before.stats);
  expect(after.rip).toEqual(before.rip);
  expect(after.caughtSpecies).toEqual(before.caughtSpecies);
  expect(after.xp).toBe(before.xp);
  expect(after.bag).toEqual(before.bag);
  expect(after.pickedItems).toEqual(before.pickedItems);
}

describe('removeMember', () => {
  it('drops the named party member and keeps the others in order', () => {
    const run = runWith(['caterpie', 'metapod', 'butterfree']);
    const result = removeMember(run, 'member-1');
    expect(result.run.party.map((member) => member.fighter.id)).toEqual(['member-0', 'member-2']);
    expect(result.removed).toBe(run.party[1]);
    expect(result.run.box).toEqual(run.box);
    sameBooks(run, result.run);
  });

  it('drops a box member and leaves the party untouched', () => {
    const run = runWith(['caterpie'], { box: ['pidgey', 'rattata'] });
    const result = removeMember(run, 'boxed-1');
    expect(result.run.party).toBe(run.party);
    expect(result.run.box.map((member) => member.fighter.id)).toEqual(['boxed-0']);
    expect(result.removed).toBe(run.box[1]);
    sameBooks(run, result.run);
  });

  it('returns the same run reference and no member on a miss', () => {
    const run = runWith(['caterpie', 'metapod'], { box: ['pidgey'] });
    const result = removeMember(run, 'nobody');
    expect(result.run).toBe(run);
    expect(result.removed).toBeNull();
  });

  it('never counts a deliberate removal as a casualty', () => {
    const run = runWith(['caterpie', 'metapod']);
    const result = removeMember(run, 'member-0');
    expect(result.run.stats.casualties).toBe(0);
    expect(result.run.rip).toEqual([]);
  });
});

describe('canTrade', () => {
  it('refuses a one-member party and allows a two-member one', () => {
    expect(canTrade(runWith(['caterpie']))).toBe(false);
    expect(canTrade(runWith(['caterpie', 'metapod']))).toBe(true);
  });

  it('does not count the box: a single party member is still refused', () => {
    expect(canTrade(runWith(['caterpie'], { box: ['pidgey', 'rattata'] }))).toBe(false);
  });
});

describe('tradePokemon refusals', () => {
  const ID = tradeId(MAP_INDEX, ROOM_ID);

  it('refuses a room whose trade is already done, changing nothing', () => {
    const run = runWith(['caterpie', 'metapod'], { pickedItems: [ID] });
    const result = tradePokemon(run, { memberId: 'member-0', mapIndex: MAP_INDEX, roomId: ROOM_ID });
    expect(result).toEqual({ ok: false, reason: 'used' });
    expect(run.pickedItems).toEqual([ID]);
  });

  it('reads the used mark before the party size check', () => {
    const run = runWith(['caterpie'], { pickedItems: [ID] });
    const result = tradePokemon(run, { memberId: 'member-0', mapIndex: MAP_INDEX, roomId: ROOM_ID });
    expect(result).toEqual({ ok: false, reason: 'used' });
  });

  it('refuses a single-member party', () => {
    const run = runWith(['caterpie']);
    const result = tradePokemon(run, { memberId: 'member-0', mapIndex: MAP_INDEX, roomId: ROOM_ID });
    expect(result).toEqual({ ok: false, reason: 'single-member' });
  });

  it('refuses an id that is not a party member, boxed or unknown', () => {
    const run = runWith(['caterpie', 'metapod'], { box: ['pidgey'] });
    for (const memberId of ['boxed-0', 'nobody']) {
      const result = tradePokemon(run, { memberId, mapIndex: MAP_INDEX, roomId: ROOM_ID });
      expect(result, memberId).toEqual({ ok: false, reason: 'missing-member' });
    }
    // The refusal left the run alone: no mark was booked.
    expect(run.pickedItems).toEqual([]);
  });
});

describe('tradePokemon success', () => {
  const ID = tradeId(MAP_INDEX, ROOM_ID);

  function trade(run: RunState = runWith(['caterpie', 'metapod']), memberId = 'member-0') {
    const result = tradePokemon(run, { memberId, mapIndex: MAP_INDEX, roomId: ROOM_ID });
    if (!result.ok) throw new Error(`trade refused: ${result.reason}`);
    return { run, result };
  }

  it('gives the picked member away and places the received one in the party', () => {
    const { run, result } = trade();
    expect(result.given).toBe(run.party[0]);
    expect(result.run.party).toHaveLength(run.party.length);
    expect(result.run.party.map((member) => member.fighter.id)).toEqual([
      'member-1',
      result.received.fighter.id,
    ]);
    expect(result.run.party[1]).toBe(result.received);
    expect(result.run.pickedItems).toEqual([ID]);
  });

  it('books no catch: stats, rip, caughtSpecies, pcCatch and xp stay put', () => {
    const { run, result } = trade();
    expect(result.run.stats).toEqual(run.stats);
    expect(result.run.rip).toEqual(run.rip);
    expect(result.run.caughtSpecies).toEqual(run.caughtSpecies);
    expect(result.run.pcCatch).toBeNull();
    expect(result.run.xp).toBe(run.xp);
  });

  it('brings the received member in at the squad level, at full HP and PP', () => {
    const run = runWith(['caterpie', 'metapod']);
    const result = tradePokemon(run, { memberId: 'member-0', mapIndex: MAP_INDEX, roomId: ROOM_ID });
    if (!result.ok) throw new Error('expected a trade');
    const level = squadLevel(run);
    expect(result.received.fighter.level).toBe(level);
    const species = getSpecies(result.received.fighter.speciesId);
    expect(species).toBeDefined();
    const full = statAtLevel(
      species!,
      level,
      result.received.fighter.nature,
      result.received.fighter.ivs,
      result.received.fighter.evs,
    ).hp;
    expect(result.received.fighter.hp).toBe(full);
    for (const slot of result.received.fighter.moves) expect(slot.pp).toBe(slot.maxPp);
  });

  it('mints the received member a fresh id nobody holds', () => {
    const { run, result } = trade();
    const ids = [...run.party, ...run.box].map((member) => member.fighter.id);
    expect(ids).not.toContain(result.received.fighter.id);
    expect(result.received.fighter.id).toBe('catch-1');
  });

  it('lets a full party trade without ever touching the box', () => {
    const run = runWith(['caterpie', 'metapod', 'butterfree', 'pidgey', 'rattata', 'spearow'], {
      box: ['ekans'],
    });
    const { result } = trade(run);
    expect(result.run.box).toEqual(run.box);
    expect(result.run.party).toHaveLength(6);
  });

  it('adds only to the party, never to the box, for a party one short of six', () => {
    const run = runWith(['caterpie', 'metapod', 'butterfree', 'pidgey', 'rattata']);
    const { result } = trade(run);
    expect(result.run.box).toEqual([]);
    expect(result.run.party).toHaveLength(5);
  });

  it('leaves the given member out of rip even when it was the lead', () => {
    const { result } = trade();
    expect(result.run.rip.some((member) => member.fighter.id === 'member-0')).toBe(false);
  });

  it('reports the given member untouched apart from its place in the party', () => {
    const { run, result } = trade();
    expect(result.given).toEqual(run.party[0]);
  });
});

describe('the trade roll', () => {
  const PIN = { speciesId: 'sneasler', nature: 'brave', id: 'catch-1' };

  function rolled(seed: string, roomId: number): { speciesId: string; nature: string; id: string } {
    const created = createRun({ seed, starter: memberOf('caterpie', 'member-0') });
    const base: RunState = {
      ...created,
      mapIndex: MAP_INDEX,
      levelCap: levelCapForMap(MAP_INDEX),
      party: [memberOf('caterpie', 'member-0'), memberOf('metapod', 'member-1')],
    };
    const result = tradePokemon(base, { memberId: 'member-0', mapIndex: MAP_INDEX, roomId });
    if (!result.ok) throw new Error(`trade refused: ${result.reason}`);
    return {
      speciesId: result.received.fighter.speciesId,
      nature: result.received.fighter.nature,
      id: result.received.fighter.id,
    };
  }

  it('is deterministic for the same seed and room', () => {
    expect(rolled(SEED, ROOM_ID)).toEqual(rolled(SEED, ROOM_ID));
  });

  it('is a pure function of (seed, mapIndex, roomId): pinned for pkm-111, map 5', () => {
    expect(rolled(SEED, ROOM_ID)).toEqual(PIN);
  });

  it('draws differently for another room and for another seed', () => {
    const room = rolled(SEED, ROOM_ID);
    expect(rolled(SEED, ROOM_ID + 1).speciesId).not.toBe(room.speciesId);
    expect(rolled(`other-${SEED}`, ROOM_ID).speciesId).not.toBe(room.speciesId);
  });

  it('draws every species from the floor band’s wild pool, never a banned one', () => {
    const pool = speciesPool(bandForMap(MAP_INDEX), 'wild');
    for (const seed of ['pkm-111', 'pkm-112', 'pkm-113', 'trade-a', 'trade-b']) {
      for (let roomId = 0; roomId < 8; roomId++) {
        expect(pool, `${seed} room ${roomId}`).toContain(rolled(seed, roomId).speciesId);
      }
    }
  });

  it('keeps every finite map’s wild pool non-empty', () => {
    for (let mapIndex = 1; mapIndex <= FINITE_MAPS; mapIndex++) {
      expect(speciesPool(bandForMap(mapIndex), 'wild').length, `map ${mapIndex}`).toBeGreaterThan(0);
    }
  });

  it('uses a nature the dex knows', () => {
    const result = rolled(SEED, ROOM_ID);
    expect(result.nature).not.toBe('');
  });
});

describe('the trade and the run’s other books', () => {
  it('does not spend the room capture', () => {
    const run = runWith(['caterpie', 'metapod']);
    const result = tradePokemon(run, { memberId: 'member-0', mapIndex: MAP_INDEX, roomId: ROOM_ID });
    if (!result.ok) throw new Error('expected a trade');
    expect(result.run.capturedRooms).toEqual(run.capturedRooms);
  });

  it('does not touch a `pcCatch` naming the member that left', () => {
    const run: RunState = {
      ...runWith(['caterpie', 'metapod']),
      pcCatch: { roomInMap: 4, memberId: 'member-0' },
    };
    const result = tradePokemon(run, { memberId: 'member-0', mapIndex: MAP_INDEX, roomId: ROOM_ID });
    if (!result.ok) throw new Error('expected a trade');
    expect(result.run.pcCatch).toEqual({ roomInMap: 4, memberId: 'member-0' });
  });

  it('keeps the rest of the party in order when the lead leaves', () => {
    const run = runWith(['caterpie', 'metapod', 'butterfree']);
    const result = tradePokemon(run, { memberId: 'member-0', mapIndex: MAP_INDEX, roomId: ROOM_ID });
    if (!result.ok) throw new Error('expected a trade');
    expect(result.run.party.slice(0, 2).map((member) => member.fighter.id)).toEqual([
      'member-1',
      'member-2',
    ]);
  });

  it('adds the received member through the shipped party-first rule', () => {
    const run = runWith(['caterpie', 'metapod']);
    const planted = addPokemon(removeMember(run, 'member-0').run, memberOf('pidgey', 'planted'));
    const result = tradePokemon(run, { memberId: 'member-0', mapIndex: MAP_INDEX, roomId: ROOM_ID });
    if (!result.ok) throw new Error('expected a trade');
    expect(result.run.party.length).toBe(planted.party.length);
    expect(result.run.party.slice(0, 1)).toEqual(planted.party.slice(0, 1));
  });
});
