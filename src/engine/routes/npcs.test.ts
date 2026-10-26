import { describe, expect, it } from 'vitest';
import {
  BERRY_IDS,
  BERRY_TREE_CAP,
  BERRY_TREE_MIN,
  CHEF_BERRY_COUNT,
  CHEF_DISH_ITEM_ID,
  MAGICIAN_TYPES,
  NPC_ROWS,
  getNpcRow,
  type NpcRequirement,
  type NpcRow,
} from '../../data/npcs';
import { ROOM_BATTLEFIELDS } from '../../data/battlefields';
import type { Tile } from '../grid';
import { isWalkable, mapFromSketch } from '../map';
import { firstTrainerRoom, planMap } from '../maps';
import type { RouteMap } from './routeMap';
import { sketchRoute } from './sketch';
import {
  chefTrade,
  effectiveNpcChance,
  guaranteedNpc,
  medicHeal,
  npcBerryHarvest,
  npcForcedField,
  npcPrize,
  npcRequirementMet,
  npcSpot,
  npcTrainerId,
  npcTreeWild,
  npcUseId,
  npcWildType,
  roomNpc,
} from './npcs';
import type { EncounterTable } from './encounters';
import { createRunPokemon, type RunPokemon } from '../run/progression';
import { createRun, itemCount, type RunState } from '../run/state';

const SEED = 'pkm-91';

function row(id: string, chance: number, floorStep: number, extra?: Partial<NpcRow>): NpcRow {
  return {
    id,
    nameKey: 'trade.title',
    greetingKey: 'trade.greeting',
    spriteKey: 'merchant',
    chance,
    floorStep,
    ...extra,
  };
}

/** Two rows whose weights (3:1 on map 1, no growth) make the pick order visible. */
const PAIR: readonly NpcRow[] = [row('merchant', 0.3, 0), row('chef', 0.1, 0)];

describe('effectiveNpcChance', () => {
  it('is the row chance on map 1', () => {
    expect(effectiveNpcChance(row('merchant', 0.25, 0.5), 1)).toBe(0.25);
  });

  it('adds the floor step once per floor after the first', () => {
    expect(effectiveNpcChance(row('merchant', 0.25, 0.5), 2)).toBe(0.75);
    expect(effectiveNpcChance(row('merchant', 0.25, 0.1), 3)).toBeCloseTo(0.45, 10);
  });

  it('clamps above 1 and below 0', () => {
    expect(effectiveNpcChance(row('merchant', 0.9, 1), 5)).toBe(1);
    expect(effectiveNpcChance(row('merchant', 0.1, -0.5), 5)).toBe(0);
    expect(effectiveNpcChance(row('merchant', 0.1, -0.5), 10)).toBe(0);
    expect(effectiveNpcChance(row('merchant', 0, 0), 1)).toBe(0);
  });
});

describe('roomNpc', () => {
  it('is a pure function of the seed, the room and the table', () => {
    const first = roomNpc(SEED, 2, 1, PAIR);
    const second = roomNpc(SEED, 2, 1, PAIR);
    expect(second).toEqual(first);
    for (let roomIndex = 0; roomIndex < 40; roomIndex++) {
      expect(roomNpc(SEED, roomIndex, 2, PAIR)).toEqual(roomNpc(SEED, roomIndex, 2, PAIR));
    }
  });

  it('pins a fixed-seed placement', () => {
    const placement = roomNpc(SEED, 3, 1, PAIR);
    expect(placement?.row.id ?? null).toBe('merchant');
    expect(placement?.roomIndex ?? null).toBe(3);
  });

  it('returns null for an empty table without needing a seed', () => {
    expect(roomNpc(SEED, 1, 1, [])).toBeNull();
    expect(roomNpc('', 0, 1, [])).toBeNull();
  });

  it('gives two rooms on the same seed independent rolls', () => {
    const outcomes = Array.from({ length: 30 }, (_, roomIndex) => roomNpc(SEED, roomIndex, 1, PAIR));
    expect(outcomes.some((placement) => placement === null)).toBe(true);
    expect(outcomes.some((placement) => placement !== null)).toBe(true);
    for (let roomIndex = 0; roomIndex < outcomes.length; roomIndex++) {
      const placement = outcomes[roomIndex];
      if (placement) expect(placement.roomIndex).toBe(roomIndex);
    }
  });

  it('never picks a zero-weight row, and leaves it out of the population', () => {
    const never = row('ghost', 0, 0);
    const always = row('merchant', 1, 0);
    for (let roomIndex = 0; roomIndex < 60; roomIndex++) {
      const placement = roomNpc(SEED, roomIndex, 1, [never, always]);
      expect(placement?.row.id, `room ${roomIndex}`).toBe('merchant');
    }
  });

  it('answers null when every weight is zero, after the presence draw', () => {
    for (let roomIndex = 0; roomIndex < 30; roomIndex++) {
      expect(roomNpc(SEED, roomIndex, 4, [row('ghost', 0, 0)])).toBeNull();
    }
  });

  it('picks the higher chance more often, with table order breaking ties', () => {
    const picked = new Map<string, number>();
    for (let roomIndex = 0; roomIndex < 400; roomIndex++) {
      const placement = roomNpc(SEED, roomIndex, 1, PAIR);
      if (placement) picked.set(placement.row.id, (picked.get(placement.row.id) ?? 0) + 1);
    }
    expect(picked.get('merchant') ?? 0).toBeGreaterThan(picked.get('chef') ?? 0);
  });

  it('only ever returns a row of the table it was handed', () => {
    const ids = new Set(PAIR.map((entry) => entry.id));
    for (let roomIndex = 0; roomIndex < 60; roomIndex++) {
      for (let mapIndex = 1; mapIndex <= 4; mapIndex++) {
        const placement = roomNpc(SEED, roomIndex, mapIndex, PAIR);
        if (placement) expect(ids.has(placement.row.id)).toBe(true);
      }
    }
  });

  it('lets the table order decide the row a weight slot names', () => {
    const tie: readonly NpcRow[] = [row('merchant', 1, 0), row('chef', 1, 0)];
    const swapped: readonly NpcRow[] = [tie[1], tie[0]];
    const first = roomNpc(SEED, 5, 1, tie);
    const second = roomNpc(SEED, 5, 1, swapped);
    expect(first?.row.id).toBe('chef');
    expect(second?.row.id).toBe('merchant');
  });

  it('grows a row chance with the floor', () => {
    const rare = [row('merchant', 0.05, 0.4)];
    const hits = (mapIndex: number): number =>
      Array.from({ length: 200 }, (_, roomIndex) => roomNpc(SEED, roomIndex, mapIndex, rare)).filter(
        (placement) => placement !== null,
      ).length;
    expect(hits(3)).toBeGreaterThan(hits(1));
  });

  it('reads a room alone exactly as it reads it in a sweep', () => {
    const alone = roomNpc(SEED, 9, 2, PAIR);
    for (let roomIndex = 0; roomIndex < 9; roomIndex++) roomNpc(SEED, roomIndex, 2, PAIR);
    expect(roomNpc(SEED, 9, 2, PAIR)).toEqual(alone);
  });
});

describe('guaranteedNpc', () => {
  const MAP_SEEDS = ['npc-a', 'npc-b', 'npc-c', 'npc-d', 'npc-e', 'npc-f'];
  const MERCHANT = getNpcRow('merchant');

  it('places the merchant in the floor’s first trainer room from map 1 on', () => {
    expect(MERCHANT).toBeDefined();
    for (const seed of MAP_SEEDS) {
      for (let mapIndex = 1; mapIndex <= 8; mapIndex++) {
        const plan = planMap(seed, mapIndex);
        const room = firstTrainerRoom(plan);
        expect(room, `${seed} map ${mapIndex}`).toBeGreaterThanOrEqual(0);
        expect(guaranteedNpc(plan, room, mapIndex), `${seed} map ${mapIndex}`).toBe(MERCHANT);
        expect(plan.rooms[room].role, `${seed} map ${mapIndex} role`).toBe('trainers');
      }
    }
  });

  it('places the merchant on map 1 as well, the run’s first floor included', () => {
    for (const seed of MAP_SEEDS) {
      const plan = planMap(seed, 1);
      const room = firstTrainerRoom(plan);
      expect(plan.rooms[room].role, seed).toBe('trainers');
      expect(guaranteedNpc(plan, room, 1), seed).toBe(MERCHANT);
    }
  });

  it('answers null on every room but the first trainer room', () => {
    const plan = planMap(MAP_SEEDS[0], 3);
    const first = firstTrainerRoom(plan);
    for (const room of plan.rooms) {
      if (room.id === first) continue;
      expect(guaranteedNpc(plan, room.id, 3), `room ${room.id}`).toBeNull();
    }
    expect(guaranteedNpc(plan, -1, 3)).toBeNull();
    expect(guaranteedNpc(plan, plan.rooms.length, 3)).toBeNull();
  });

  it('reads no RNG and no run state: two calls answer the same row', () => {
    const plan = planMap(MAP_SEEDS[1], 5);
    const first = firstTrainerRoom(plan);
    expect(guaranteedNpc(plan, first, 5)).toBe(guaranteedNpc(plan, first, 5));
    expect(guaranteedNpc(planMap(MAP_SEEDS[1], 5), first, 5)).toBe(MERCHANT);
  });

  it('takes the first guaranteed row of the table, in table order', () => {
    const later = row('medic', 0, 0, { guaranteedFromMap: 3 });
    const sooner = row('merchant', 0, 0, { guaranteedFromMap: 1 });
    const plan = planMap(MAP_SEEDS[2], 4);
    const first = firstTrainerRoom(plan);
    // Table order decides, not the smallest threshold: from map 3 on `medic` is the
    // first eligible row of this table, though `merchant`'s gate opened two floors sooner.
    expect(guaranteedNpc(plan, first, 4, [later, sooner])?.id).toBe('medic');
    expect(guaranteedNpc(plan, first, 3, [later, sooner])?.id).toBe('medic');
    expect(guaranteedNpc(plan, first, 2, [later, sooner])?.id).toBe('merchant');
    expect(guaranteedNpc(plan, first, 1, [later, sooner])?.id).toBe('merchant');
    expect(guaranteedNpc(plan, first, 1, [sooner, later])?.id).toBe('merchant');
    expect(guaranteedNpc(plan, first, 3, [sooner, later])?.id).toBe('merchant');
    expect(guaranteedNpc(plan, first, 4, [sooner, later])?.id).toBe('merchant');
    // A table whose earliest gate opens on map 2 still answers null on map 1, which is
    // the only way to reach the null path now that the shipped row opens on map 1.
    const fromTwo = row('medic', 0, 0, { guaranteedFromMap: 2 });
    expect(guaranteedNpc(plan, first, 1, [fromTwo])).toBeNull();
    expect(guaranteedNpc(plan, first, 2, [fromTwo])?.id).toBe('medic');
    expect(guaranteedNpc(plan, first, 4, [])).toBeNull();
  });
});

describe('roomNpc and the guaranteed rows', () => {
  it('never returns a zero-weight row, the merchant and the grunt included', () => {
    // A row's weight is its **effective** chance, so a zero base chance is not the
    // test: the merchant never rolls on any floor and the Team Rocket grunt never
    // rolls on map 1, where its step has not lifted it off zero yet.
    for (let mapIndex = 1; mapIndex <= 8; mapIndex++) {
      const ids = new Set(
        NPC_ROWS.filter((row) => effectiveNpcChance(row, mapIndex) > 0).map((row) => row.id),
      );
      for (let roomIndex = 0; roomIndex < 40; roomIndex++) {
        const placement = roomNpc(SEED, roomIndex, mapIndex);
        if (!placement) continue;
        expect(placement.row.id, `map ${mapIndex} room ${roomIndex}`).not.toBe('merchant');
        expect(ids.has(placement.row.id), `map ${mapIndex} room ${roomIndex}`).toBe(true);
        if (mapIndex === 1) {
          expect(placement.row.id, `map ${mapIndex} room ${roomIndex}`).not.toBe('rocket');
        }
      }
    }
  });

  it('never picks a zero-chance guaranteed row beside a rolled one', () => {
    const guaranteed = row('merchant', 0, 0, { guaranteedFromMap: 2 });
    const rolled = row('chef', 1, 0);
    const table = [guaranteed, rolled];
    for (let roomIndex = 0; roomIndex < 60; roomIndex++) {
      const placement = roomNpc(SEED, roomIndex, 3, table);
      expect(placement?.row.id, `room ${roomIndex}`).toBe('chef');
    }
    expect(roomNpc(SEED, 7, 3, table)).toEqual(roomNpc(SEED, 7, 3, table));
  });
});

describe('npcUseId', () => {
  it('names the per-floor use record', () => {
    expect(npcUseId(2, 7, 'merchant')).toBe('npc-2-7-merchant');
  });
});

function member(speciesId: string, moves: readonly string[], ability: string): RunPokemon {
  return createRunPokemon({ id: speciesId, speciesId, level: 5, moves, ability });
}

const BUG = member('caterpie', ['scratch'], 'shield-dust');
const GRASS = member('chikorita', ['tackle'], 'overgrow');
const WATER = member('squirtle', ['tackle'], 'torrent');

function runWith(party: readonly RunPokemon[], box: readonly RunPokemon[] = []): RunState {
  return { ...createRun({ seed: SEED, starter: party[0] ?? BUG }), party, box };
}

describe('npcRequirementMet', () => {
  it('is true for an absent requirement', () => {
    expect(npcRequirementMet(runWith([BUG]), undefined)).toBe(true);
    expect(npcRequirementMet(runWith([]), undefined)).toBe(true);
  });

  it('asks the party for a type', () => {
    const requirement: NpcRequirement = { kind: 'type', types: ['Grass'] };
    expect(npcRequirementMet(runWith([BUG, GRASS]), requirement)).toBe(true);
    expect(npcRequirementMet(runWith([BUG]), requirement)).toBe(false);
    expect(npcRequirementMet(runWith([BUG], [GRASS]), requirement)).toBe(false);
  });

  it('asks the party for a move', () => {
    const requirement: NpcRequirement = { kind: 'move', moves: ['tackle'] };
    expect(npcRequirementMet(runWith([BUG, WATER]), requirement)).toBe(true);
    expect(npcRequirementMet(runWith([BUG]), requirement)).toBe(false);
    expect(npcRequirementMet(runWith([BUG], [GRASS]), requirement)).toBe(false);
  });

  it('asks the party for an ability', () => {
    const requirement: NpcRequirement = { kind: 'ability', abilities: ['overgrow'] };
    expect(npcRequirementMet(runWith([BUG, GRASS]), requirement)).toBe(true);
    expect(npcRequirementMet(runWith([BUG]), requirement)).toBe(false);
    expect(npcRequirementMet(runWith([BUG], [GRASS]), requirement)).toBe(false);
  });

  it('is case-insensitive and answers false for an empty list', () => {
    expect(npcRequirementMet(runWith([GRASS]), { kind: 'type', types: ['gRaSs'] })).toBe(true);
    expect(npcRequirementMet(runWith([BUG]), { kind: 'move', moves: ['SCRATCH'] })).toBe(true);
    expect(npcRequirementMet(runWith([BUG]), { kind: 'ability', abilities: ['Shield-Dust'] })).toBe(
      true,
    );
    expect(npcRequirementMet(runWith([BUG, GRASS]), { kind: 'type', types: [] })).toBe(false);
    expect(npcRequirementMet(runWith([BUG, GRASS]), { kind: 'move', moves: [] })).toBe(false);
    expect(npcRequirementMet(runWith([BUG, GRASS]), { kind: 'ability', abilities: [] })).toBe(false);
  });

  it('counts a fainted member', () => {
    const fainted: RunPokemon = { ...GRASS, fighter: { ...GRASS.fighter, hp: 0 } };
    expect(npcRequirementMet(runWith([fainted]), { kind: 'type', types: ['Grass'] })).toBe(true);
    expect(npcRequirementMet(runWith([fainted]), { kind: 'move', moves: ['tackle'] })).toBe(true);
    expect(npcRequirementMet(runWith([fainted]), { kind: 'ability', abilities: ['overgrow'] })).toBe(
      true,
    );
  });

  it('asks the run for its completed floors, not the party', () => {
    const base = runWith([BUG, GRASS]);
    expect(npcRequirementMet(base, { kind: 'missionsCompleted', min: 1 })).toBe(false);
    expect(
      npcRequirementMet({ ...base, missionsCompleted: 0 }, { kind: 'missionsCompleted', min: 1 }),
    ).toBe(false);
    expect(
      npcRequirementMet({ ...base, missionsCompleted: 1 }, { kind: 'missionsCompleted', min: 1 }),
    ).toBe(true);
    expect(
      npcRequirementMet({ ...base, missionsCompleted: 1 }, { kind: 'missionsCompleted', min: 2 }),
    ).toBe(false);
    expect(
      npcRequirementMet({ ...base, missionsCompleted: 3 }, { kind: 'missionsCompleted', min: 2 }),
    ).toBe(true);
    // The box and the party carry no vote here: an empty party is still a run.
    expect(
      npcRequirementMet({ ...runWith([]), missionsCompleted: 1 }, { kind: 'missionsCompleted', min: 1 }),
    ).toBe(true);
  });
});

describe('the sacrifice gate', () => {
  const MEMBER_EDIT_ROWS = ['tutor', 'nature', 'ability', 'iv-judge', 'species'];
  const SACRIFICE = getNpcRow('sacrifice');

  /** The filter `RouteScene.rollRoomNpc` applies before the roll. */
  function eligible(run: RunState): readonly NpcRow[] {
    return NPC_ROWS.filter((row) => npcRequirementMet(run, row.requires));
  }

  function rolledIds(run: RunState, mapIndex = 5): ReadonlySet<string> {
    const rows = eligible(run);
    const ids = new Set<string>();
    for (let roomIndex = 0; roomIndex < 600; roomIndex++) {
      const placement = roomNpc(SEED, roomIndex, mapIndex, rows);
      if (placement) ids.add(placement.row.id);
    }
    return ids;
  }

  it('keeps the sacrifice out of the roll until a floor has been completed', () => {
    expect(SACRIFICE?.requires).toEqual({ kind: 'missionsCompleted', min: 1 });
    const ids = rolledIds(runWith([BUG]));
    expect(ids.has('sacrifice')).toBe(false);
    for (const id of MEMBER_EDIT_ROWS) expect(ids.has(id), id).toBe(true);
  });

  it('rolls the sacrifice once the run has completed a floor', () => {
    const ids = rolledIds({ ...runWith([BUG]), missionsCompleted: 1 });
    expect(ids.has('sacrifice')).toBe(true);
    for (const id of MEMBER_EDIT_ROWS) expect(ids.has(id), id).toBe(true);
  });
});

const ARCHETYPES = ['youngster', 'lass', 'bugcatcher', 'hiker'];

function routeFor(seed: string, routeIndex: number): RouteMap {
  return sketchRoute({
    seed,
    routeIndex,
    biomeId: 'forest',
    trainerArchetypes: ARCHETYPES,
    role: 'trainers',
    width: 30,
    height: 30,
  });
}

function key(tile: Tile): string {
  return `${tile.x},${tile.y}`;
}

describe('npcSpot', () => {
  it('is deterministic for a fixed seed', () => {
    const route = routeFor(SEED, 2);
    expect(npcSpot(route, 2, SEED, 'merchant')).toEqual(npcSpot(route, 2, SEED, 'merchant'));
  });

  it('never stands on the entry, its neighbours, an exit, a wall, a trainer or a visible item', () => {
    for (const seed of ['pkm-91', 'spot-a', 'spot-b']) {
      for (const routeIndex of [1, 4]) {
        const route = routeFor(seed, routeIndex);
        const spot = npcSpot(route, routeIndex, seed, 'merchant');
        expect(spot, `${seed}/${routeIndex}`).not.toBeNull();
        if (!spot) continue;
        const blocked = new Set<string>([
          key(route.entry),
          key({ x: route.entry.x + 1, y: route.entry.y }),
          key({ x: route.entry.x - 1, y: route.entry.y }),
          key({ x: route.entry.x, y: route.entry.y + 1 }),
          key({ x: route.entry.x, y: route.entry.y - 1 }),
          ...route.exits.map(key),
          ...route.trainers.map((trainer) => key(trainer.position)),
          ...route.items.filter((item) => !item.hidden).map((item) => key(item.position)),
        ]);
        expect(blocked.has(key(spot)), `${seed}/${routeIndex} ${key(spot)}`).toBe(false);
        expect(isWalkable(route.tiles, spot), `${seed}/${routeIndex} walkable`).toBe(true);
        expect(spot.x).toBeGreaterThanOrEqual(0);
        expect(spot.y).toBeGreaterThanOrEqual(0);
        expect(spot.x).toBeLessThan(route.width);
        expect(spot.y).toBeLessThan(route.height);
      }
    }
  }, 30_000);

  it('answers null when every free tile is taken', () => {
    const tiles = mapFromSketch(['#####', '#...#', '#####']);
    const route: RouteMap = {
      seed: 'tiny',
      routeIndex: 1,
      biomeId: 'forest',
      shape: 'straight',
      width: 5,
      height: 3,
      tiles,
      entry: { x: 2, y: 1 },
      exits: [
        { x: 1, y: 1 },
        { x: 3, y: 1 },
      ],
      spine: [],
      branches: [],
      pockets: [],
      items: [],
      trainers: [],
    };
    expect(npcSpot(route, 1, 'tiny', 'merchant')).toBeNull();
  });
});

describe('npcForcedField', () => {
  it('is a pure function of the seed, the room and the npc', () => {
    const first = npcForcedField(SEED, 3, 'weather-man');
    expect(npcForcedField(SEED, 3, 'weather-man')).toEqual(first);
    expect(npcForcedField(SEED, 3, 'weather-man')).not.toEqual(npcForcedField(SEED, 4, 'weather-man'));
    expect(npcForcedField(SEED, 3, 'weather-man')).not.toEqual(
      npcForcedField('other', 3, 'weather-man'),
    );
  });

  it('resolves into the room battlefield table', () => {
    for (let roomIndex = 0; roomIndex < 30; roomIndex++) {
      const field = npcForcedField(SEED, roomIndex, 'weather-man');
      expect(ROOM_BATTLEFIELDS).toContain(field);
    }
  });

  it('reaches more than one row over the rooms', () => {
    const ids = new Set(
      Array.from({ length: 60 }, (_, roomIndex) => npcForcedField(SEED, roomIndex, 'weather-man').id),
    );
    expect(ids.size).toBeGreaterThan(1);
  });

  it('draws on its own stream, so the room roll is untouched', () => {
    const before = roomNpc(SEED, 3, 1);
    npcForcedField(SEED, 3, 'weather-man');
    expect(roomNpc(SEED, 3, 1)).toEqual(before);
  });
});

describe('npcWildType', () => {
  it('is a pure function of the seed, the room and the npc', () => {
    const first = npcWildType(SEED, 5, 'magician');
    expect(npcWildType(SEED, 5, 'magician')).toBe(first);
    expect(npcWildType(SEED, 5, 'magician')).not.toBe(npcWildType(SEED, 6, 'magician'));
    expect(npcWildType(SEED, 5, 'magician')).not.toBe(npcWildType('other', 5, 'magician'));
  });

  it('gives two npc ids of the same room their own streams', () => {
    const magician = Array.from({ length: 20 }, (_, roomIndex) =>
      npcWildType(SEED, roomIndex, 'magician'),
    );
    const exorcist = Array.from({ length: 20 }, (_, roomIndex) =>
      npcWildType(SEED, roomIndex, 'exorcist'),
    );
    expect(magician).not.toEqual(exorcist);
  });

  it('resolves into the magician type table', () => {
    for (let roomIndex = 0; roomIndex < 30; roomIndex++) {
      expect(MAGICIAN_TYPES).toContain(npcWildType(SEED, roomIndex, 'magician'));
    }
  });

  it('reaches more than one type over the rooms', () => {
    const types = new Set(
      Array.from({ length: 60 }, (_, roomIndex) => npcWildType(SEED, roomIndex, 'magician')),
    );
    expect(types.size).toBeGreaterThan(1);
  });

  it('pins a fixed seed (regression, D11)', () => {
    const fields = [0, 1, 2, 3, 4, 5].map(
      (roomIndex) => npcForcedField('pkm-91', roomIndex, 'weather-man').id,
    );
    const types = [0, 1, 2, 3, 4, 5].map((roomIndex) => npcWildType('pkm-91', roomIndex, 'magician'));
    expect(fields).toEqual(['gravity', 'grassy', 'fairyaura', 'darkaura', 'crit', 'alltypes']);
    expect(types).toEqual(['normal', 'water', 'fighting', 'poison', 'rock', 'ice']);
  });
});

function hurt(member: RunPokemon, hp: number, pp = 0): RunPokemon {
  return {
    ...member,
    fighter: {
      ...member.fighter,
      hp,
      moves: member.fighter.moves.map((slot) => ({ ...slot, pp })),
    },
  };
}

function runMember(id: string, heldItem?: string): RunPokemon {
  return createRunPokemon({
    id,
    speciesId: 'caterpie',
    level: 10,
    moves: ['tackle'],
    ...(heldItem ? { heldItem } : {}),
  });
}

describe('medicHeal', () => {
  it('rests the party and the box and writes its one-floor mark', () => {
    const fresh = runMember('a');
    const run = runWith([hurt(fresh, 1, 0)], [hurt(runMember('b'), 2, 0)]);
    const healed = medicHeal(run, 4, 6);

    expect(healed.party[0].fighter.hp).toBe(fresh.fighter.hp);
    expect(healed.box[0].fighter.hp).toBe(runMember('b').fighter.hp);
    for (const slot of healed.party[0].fighter.moves) expect(slot.pp).toBe(slot.maxPp);
    for (const slot of healed.box[0].fighter.moves) expect(slot.pp).toBe(slot.maxPp);
    expect(healed.pickedItems).toContain(npcUseId(4, 6, 'medic'));
  });

  it('leaves a 0-HP member at 0, never resurrecting', () => {
    const healed = medicHeal(runWith([hurt(runMember('a'), 0)]), 1, 2);
    expect(healed.party[0].fighter.hp).toBe(0);
  });

  it('is spent once per floor: a second talk returns the same run', () => {
    const healed = medicHeal(runWith([hurt(runMember('a'), 1)]), 2, 3);
    const later = { ...healed, party: [hurt(healed.party[0], 1, 0)] };
    const again = medicHeal(later, 2, 3);
    expect(again).toBe(later);
    expect(again.party[0].fighter.hp).toBe(1);
    expect(again.party[0].fighter.moves[0].pp).toBe(0);
    expect(again.pickedItems).toEqual(healed.pickedItems);
  });
});

describe('chefTrade', () => {
  const BERRIES: RunState['bag'] = [
    { itemId: 'cheriberry', count: 1 },
    { itemId: 'chestoberry', count: 2 },
    { itemId: 'pechaberry', count: 5 },
  ];

  function chefRun(heldItem = 'leftovers'): RunState {
    return { ...runWith([runMember('a', heldItem)]), bag: BERRIES };
  }

  it('takes the berries in table order and equips the dish', () => {
    const run = chefRun();
    const trade = chefTrade(run, 'a');
    expect(trade.ok).toBe(true);
    if (!trade.ok) return;
    expect(trade.memberId).toBe('a');
    expect(trade.dishId).toBe(CHEF_DISH_ITEM_ID);
    expect(trade.berries).toEqual(['cheriberry', 'chestoberry', 'chestoberry']);
    expect(trade.berries).toHaveLength(CHEF_BERRY_COUNT);
    for (const id of trade.berries) expect(BERRY_IDS).toContain(id);
    expect(trade.run.party[0].fighter.heldItem).toBe(CHEF_DISH_ITEM_ID);
    expect(itemCount(trade.run, CHEF_DISH_ITEM_ID)).toBe(0);
    expect(itemCount(trade.run, 'cheriberry')).toBe(0);
    expect(itemCount(trade.run, 'chestoberry')).toBe(0);
    expect(itemCount(trade.run, 'pechaberry')).toBe(5);
    expect(itemCount(trade.run, 'leftovers')).toBe(1);
  });

  it('refuses without enough berries, an unknown member or a member already holding the dish', () => {
    const short = { ...runWith([runMember('a')]), bag: [{ itemId: 'cheriberry', count: 2 }] };
    expect(chefTrade(short, 'a')).toEqual({ ok: false, reason: 'no-berries' });
    expect(chefTrade(chefRun(), 'nobody')).toEqual({ ok: false, reason: 'no-member' });
    expect(chefTrade(chefRun(CHEF_DISH_ITEM_ID), 'a')).toEqual({
      ok: false,
      reason: 'already-held',
    });
  });

  it('reads no RNG: two equal runs trade to the same result', () => {
    const run = chefRun();
    expect(chefTrade(structuredClone(run), 'a')).toEqual(chefTrade(run, 'a'));
  });
});

describe('npcBerryHarvest', () => {
  it('gives between the table minimum and cap berries, all in the table', () => {
    for (let roomIndex = 0; roomIndex < 40; roomIndex++) {
      const berries = npcBerryHarvest(SEED, roomIndex, 'berry-tree');
      expect(berries.length, `room ${roomIndex}`).toBeGreaterThanOrEqual(BERRY_TREE_MIN);
      expect(berries.length, `room ${roomIndex}`).toBeLessThanOrEqual(BERRY_TREE_CAP);
      for (const id of berries) expect(BERRY_IDS, `room ${roomIndex}`).toContain(id);
    }
  });

  it('is a pure function of the seed, the room and the npc', () => {
    expect(npcBerryHarvest(SEED, 2, 'berry-tree')).toEqual(npcBerryHarvest(SEED, 2, 'berry-tree'));
    expect(npcBerryHarvest(SEED, 2, 'berry-tree')).not.toEqual(npcBerryHarvest(SEED, 3, 'berry-tree'));
    expect(npcBerryHarvest(SEED, 2, 'berry-tree')).not.toEqual(npcBerryHarvest(SEED, 2, 'chef'));
  });

  it('pins a fixed seed (regression, D11)', () => {
    const rooms = [0, 1, 2, 3].map((roomIndex) => npcBerryHarvest('pkm-95', roomIndex, 'berry-tree'));
    expect(rooms).toEqual([
      ['rawstberry', 'figyberry'],
      ['lumberry'],
      ['lumberry', 'lumberry', 'aguavberry'],
      ['magoberry', 'aguavberry', 'magoberry', 'aspearberry'],
    ]);
  });
});

describe('npcTreeWild', () => {
  const TABLE: EncounterTable = [
    { speciesId: 'pidgey', weight: 1 },
    { speciesId: 'rattata', weight: 1 },
    { speciesId: 'caterpie', weight: 1 },
  ];

  it('always wakes a species of the table it was handed', () => {
    const single: EncounterTable = [{ speciesId: 'pidgey', weight: 1 }];
    for (let roomIndex = 0; roomIndex < 20; roomIndex++) {
      const wild = npcTreeWild(SEED, roomIndex, 'berry-tree', single, () => 12);
      expect(wild?.speciesId, `room ${roomIndex}`).toBe('pidgey');
    }
    const ids = new Set(TABLE.map((entry) => entry.speciesId));
    for (let roomIndex = 0; roomIndex < 40; roomIndex++) {
      const wild = npcTreeWild(SEED, roomIndex, 'berry-tree', TABLE, () => 12);
      expect(wild, `room ${roomIndex}`).toBeDefined();
      expect(ids.has(wild!.speciesId), `room ${roomIndex}`).toBe(true);
    }
  });

  it('applies the caller level roll and is deterministic', () => {
    const flat = npcTreeWild(SEED, 1, 'berry-tree', TABLE, () => 42);
    expect(flat?.level).toBe(42);
    expect(npcTreeWild(SEED, 4, 'berry-tree', TABLE, () => 42)).toEqual(
      npcTreeWild(SEED, 4, 'berry-tree', TABLE, () => 42),
    );
  });

  it('answers undefined only for an empty table', () => {
    expect(npcTreeWild(SEED, 1, 'berry-tree', [], () => 12)).toBeUndefined();
  });

  it('pins a fixed seed (regression, D11)', () => {
    const wild = npcTreeWild('pkm-95', 0, 'berry-tree', TABLE, (rng) => rng.int(5, 10));
    expect(wild).toEqual({ speciesId: 'rattata', level: 6, shiny: false });
  });
});

describe('npcPrize', () => {
  const PRIZES = ['venusaurite', 'charizarditex', 'charizarditey', 'blastoisinite'];

  it('draws one id of the list and null for an empty one', () => {
    for (let roomIndex = 0; roomIndex < 40; roomIndex++) {
      expect(PRIZES, `room ${roomIndex}`).toContain(npcPrize(SEED, roomIndex, 'mega-stone', PRIZES));
    }
    expect(npcPrize(SEED, 1, 'mega-stone', [])).toBeNull();
  });

  it('is deterministic and reads its own stream beside roomNpc', () => {
    const before = roomNpc(SEED, 4, 3);
    expect(npcPrize(SEED, 4, 'mega-stone', PRIZES)).toBe(npcPrize(SEED, 4, 'mega-stone', PRIZES));
    expect(roomNpc(SEED, 4, 3)).toEqual(before);
  });

  it('pins a fixed seed (regression, D11)', () => {
    expect(npcPrize('pkm-95', 2, 'mega-stone', PRIZES)).toBe('blastoisinite');
    expect(npcPrize('pkm-95', 5, 'mega-stone', PRIZES)).toBe('venusaurite');
    expect(npcPrize('pkm-95', 2, 'mega-stone', PRIZES)).not.toBe(
      npcPrize('pkm-95', 3, 'mega-stone', PRIZES),
    );
  });
});

describe('npcTrainerId', () => {
  it('names the keeper battle apart from its use mark', () => {
    expect(npcTrainerId(2, 5, 'mega-stone')).toBe('npc-trainer-2-5-mega-stone');
    expect(npcTrainerId(2, 5, 'mega-stone')).not.toBe(npcUseId(2, 5, 'mega-stone'));
  });
});
