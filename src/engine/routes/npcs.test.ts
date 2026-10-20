import { describe, expect, it } from 'vitest';
import { NPC_ROWS, getNpcRow, type NpcRequirement, type NpcRow } from '../../data/npcs';
import type { Tile } from '../grid';
import { isWalkable, mapFromSketch } from '../map';
import { firstTrainerRoom, planMap } from '../maps';
import type { RouteMap } from './routeMap';
import { sketchRoute } from './sketch';
import {
  effectiveNpcChance,
  guaranteedNpc,
  npcRequirementMet,
  npcSpot,
  npcUseId,
  roomNpc,
} from './npcs';
import { createRunPokemon, type RunPokemon } from '../run/progression';
import { createRun, type RunState } from '../run/state';

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

  it('places the merchant in the floor’s first trainer room from map 2 on', () => {
    expect(MERCHANT).toBeDefined();
    for (const seed of MAP_SEEDS) {
      for (let mapIndex = 2; mapIndex <= 8; mapIndex++) {
        const plan = planMap(seed, mapIndex);
        const room = firstTrainerRoom(plan);
        expect(room, `${seed} map ${mapIndex}`).toBeGreaterThanOrEqual(0);
        expect(guaranteedNpc(plan, room, mapIndex), `${seed} map ${mapIndex}`).toBe(MERCHANT);
        expect(plan.rooms[room].role, `${seed} map ${mapIndex} role`).toBe('trainers');
      }
    }
  });

  it('leaves map 1 merchant-free', () => {
    for (const seed of MAP_SEEDS) {
      const plan = planMap(seed, 1);
      expect(guaranteedNpc(plan, firstTrainerRoom(plan), 1), seed).toBeNull();
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
    const sooner = row('merchant', 0, 0, { guaranteedFromMap: 2 });
    const plan = planMap(MAP_SEEDS[2], 4);
    const first = firstTrainerRoom(plan);
    // Table order decides, not the smallest threshold: from map 3 on `medic` is the
    // first eligible row of this table.
    expect(guaranteedNpc(plan, first, 4, [later, sooner])?.id).toBe('medic');
    expect(guaranteedNpc(plan, first, 2, [later, sooner])?.id).toBe('merchant');
    expect(guaranteedNpc(plan, first, 3, [sooner, later])?.id).toBe('merchant');
    expect(guaranteedNpc(plan, first, 1, [later, sooner])).toBeNull();
    expect(guaranteedNpc(plan, first, 4, [])).toBeNull();
  });
});

describe('roomNpc and the guaranteed rows', () => {
  it('never returns the merchant, whose chance is 0', () => {
    for (let mapIndex = 1; mapIndex <= 8; mapIndex++) {
      for (let roomIndex = 0; roomIndex < 40; roomIndex++) {
        expect(roomNpc(SEED, roomIndex, mapIndex), `map ${mapIndex} room ${roomIndex}`).toBeNull();
      }
    }
  });

  it('never picks a zero-chance guaranteed row beside a rolled one', () => {
    const rolled = row('chef', 1, 0);
    const table = [...NPC_ROWS, rolled];
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
