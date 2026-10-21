import { describe, expect, it, vi } from 'vitest';
import { BIOME_ORDER } from '../../data/biomes';
import { TRAINER_ROOMS_PER_MAP, trainerRoomsForMap } from '../../data/population';
import {
  MAP_MAX_ROOM_SIZE,
  MAP_MIN_ROOM_SIZE,
  MAP_TUNING,
  mapTuning,
  roomSizeForShape,
} from '../../data/maps';
import type { Access } from '../routes/layout';
import { sketchRoute } from '../routes/sketch';
import { validateRoute } from '../routes/validate';
import { Rng } from '../rng';
import {
  MAP_EDGES,
  OPPOSITE_EDGE,
  biomeForMap,
  firstTrainerRoom,
  linkedNeighbour,
  pickBiome,
  planMap,
  roomAt,
  specialRoom,
  type MapEdge,
  type MapPlan,
  type MapRoom,
} from './plan';

const SEEDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel'];

const DELTA: Readonly<Record<MapEdge, { x: number; y: number }>> = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};

function neighbourCell(room: MapRoom, edge: MapEdge): { x: number; y: number } {
  const delta = DELTA[edge];
  return { x: room.col + delta.x, y: room.row + delta.y };
}

function shapeFromEdges(edges: readonly MapEdge[]): string {
  if (edges.length === 1) return 'dead-end';
  if (edges.length === 2) return OPPOSITE_EDGE[edges[0]] === edges[1] ? 'corridor' : 'bend';
  if (edges.length === 3) return 'tee';
  return 'cross';
}

function adjacency(plan: MapPlan): number[][] {
  const graph: number[][] = plan.rooms.map(() => []);
  for (const [a, b] of plan.links) {
    graph[a].push(b);
    graph[b].push(a);
  }
  return graph;
}

function distances(plan: MapPlan): number[] {
  const graph = adjacency(plan);
  const dist = new Array<number>(plan.rooms.length).fill(-1);
  dist[plan.entryRoom] = 0;
  const queue = [plan.entryRoom];
  for (let head = 0; head < queue.length; head++) {
    for (const next of graph[queue[head]]) {
      if (dist[next] >= 0) continue;
      dist[next] = dist[queue[head]] + 1;
      queue.push(next);
    }
  }
  return dist;
}

function expectedBoss(plan: MapPlan): number {
  const dist = distances(plan);
  let boss = plan.entryRoom;
  for (let id = 1; id < plan.rooms.length; id++) {
    if (dist[id] > dist[boss]) boss = id;
  }
  return boss;
}

function assertPlan(plan: MapPlan): void {
  const tuning = mapTuning(plan.mapIndex);
  // The tuning range counts the **regular** rooms (entry, four-room core and the
  // boss leaf); the special leaves hang outside it (`docs/maps-spec.md` §7).
  const regularRooms = plan.rooms.filter((room) => room.special === null);
  expect(regularRooms.length).toBeGreaterThanOrEqual(tuning.routes.min);
  expect(regularRooms.length).toBeLessThanOrEqual(tuning.routes.max);

  const seen = new Set<string>();
  for (const room of plan.rooms) {
    const cell = `${room.col},${room.row}`;
    expect(seen.has(cell)).toBe(false);
    seen.add(cell);

    // The entry, the boss and every special leaf are the quiet leaves, pinned to
    // the minimum size whatever shape or map; every regular room takes the size its
    // shape predicts and stays inside the map's range (`docs/maps-spec.md` §1).
    if (room.id === plan.entryRoom || room.id === plan.bossRoom || room.special !== null) {
      expect(room.width, `${room.shape} room ${room.id}`).toBe(MAP_MIN_ROOM_SIZE);
      expect(room.height, `${room.shape} room ${room.id}`).toBe(MAP_MIN_ROOM_SIZE);
    } else {
      const edges = room.openings.map((opening) => opening.edge);
      const longAxis = room.shape === 'corridor' && edges.includes('N') ? 'ns' : 'ew';
      expect({ width: room.width, height: room.height }, `room ${room.id}`).toEqual(
        roomSizeForShape(room.shape, plan.mapIndex, longAxis),
      );
      expect(room.width).toBeGreaterThanOrEqual(tuning.size.min);
      expect(room.width).toBeLessThanOrEqual(tuning.size.max);
      expect(room.height).toBeGreaterThanOrEqual(tuning.size.min);
      expect(room.height).toBeLessThanOrEqual(tuning.size.max);
    }

    const edges = room.openings.map((opening) => opening.edge);
    expect(new Set(edges).size).toBe(edges.length);
    expect(edges).toEqual([...edges].sort((a, b) => MAP_EDGES.indexOf(a) - MAP_EDGES.indexOf(b)));
    expect(room.shape).toBe(shapeFromEdges(edges));
  }

  // Exactly one entry, on the entry room, on an edge whose outside cell is free.
  const entries = plan.rooms.flatMap((room) =>
    room.openings.filter((opening) => opening.kind === 'entry').map((opening) => ({ room, opening })),
  );
  expect(entries).toHaveLength(1);
  expect(entries[0].room.id).toBe(plan.entryRoom);
  expect(entries[0].opening.edge).toBe(plan.entryEdge);
  const outside = neighbourCell(plan.rooms[plan.entryRoom], plan.entryEdge);
  expect(roomAt(plan, outside.x, outside.y)).toBeUndefined();

  // Every link joins adjacent rooms and shows as an opposite opening on both ends.
  for (const [a, b] of plan.links) {
    expect(a).not.toBe(b);
    const roomA = plan.rooms[a];
    const roomB = plan.rooms[b];
    for (const edge of MAP_EDGES) {
      const target = neighbourCell(roomA, edge);
      if (target.x === roomB.col && target.y === roomB.row) {
        expect(linkedNeighbour(plan, a, edge)).toBe(b);
        expect(linkedNeighbour(plan, b, OPPOSITE_EDGE[edge])).toBe(a);
      }
    }
  }

  // No dangling opening: every link opening resolves to a joined neighbour.
  for (const room of plan.rooms) {
    for (const opening of room.openings) {
      if (opening.kind === 'entry') continue;
      expect(linkedNeighbour(plan, room.id, opening.edge)).toBeDefined();
    }
  }

  // Connected, closed into at least one loop (a tree would hold rooms - 1 links).
  const dist = distances(plan);
  expect(dist.every((value) => value >= 0)).toBe(true);
  expect(plan.links.length).toBeGreaterThanOrEqual(plan.rooms.length);

  // The boss is the farthest room from the entry.
  expect(plan.bossRoom).toBe(expectedBoss(plan));

  // The boss is a dead-end leaf: its only door is the single link, so it has one
  // exit until the portal opens (`docs/maps-spec.md` §6).
  const boss = plan.rooms[plan.bossRoom];
  expect(boss.openings.filter((opening) => opening.kind === 'link')).toHaveLength(1);
  expect(boss.shape).toBe('dead-end');

  // The entry room is a single-door leaf too: its only **link** opening is the one
  // into the floor (its plan shape also counts the outward entry edge, which the
  // route does not carve), so it spawns at its centre and has a single exit.
  const entry = plan.rooms[plan.entryRoom];
  expect(entry.openings.filter((opening) => opening.kind === 'link')).toHaveLength(1);
  expect(entry.openings.filter((opening) => opening.kind === 'entry')).toHaveLength(1);

  // Special rooms (`docs/maps-spec.md` §7): extra dead-end leaves, never the entry
  // or the boss, no shop room at all (the Mart is the merchant NPC) and at most one
  // mini-boss / mega-stone / casino / gated / trade / no-heal / static / secret-shop
  // each.
  const specials = plan.rooms.filter((room) => room.special !== null);
  expect(specials.length).toBe(plan.specials.length);
  expect(specials.map((room) => String(room.special))).not.toContain('shop');
  expect(plan.specials.map((special) => String(special.kind))).not.toContain('shop');
  expect(specials.filter((room) => room.special === 'mini-boss').length).toBeLessThanOrEqual(1);
  expect(specials.filter((room) => room.special === 'mega-stone').length).toBeLessThanOrEqual(1);
  expect(specials.filter((room) => room.special === 'casino').length).toBeLessThanOrEqual(1);
  expect(specials.filter((room) => room.special === 'gated').length).toBeLessThanOrEqual(1);
  expect(specials.filter((room) => room.special === 'trade').length).toBeLessThanOrEqual(1);
  expect(specials.filter((room) => room.special === 'no-heal').length).toBeLessThanOrEqual(1);
  expect(specials.filter((room) => room.special === 'static').length).toBeLessThanOrEqual(1);
  expect(specials.filter((room) => room.special === 'secret-shop').length).toBeLessThanOrEqual(1);
  // The casino hangs from map 2 on and the gated, trade, no-heal, static and
  // secret-shop leaves from map 3 on (`docs/maps-spec.md` §7).
  if (plan.mapIndex < 3) {
    expect(specials.filter((room) => room.special === 'mega-stone')).toHaveLength(0);
    expect(specials.filter((room) => room.special === 'gated')).toHaveLength(0);
    expect(specials.filter((room) => room.special === 'trade')).toHaveLength(0);
    expect(specials.filter((room) => room.special === 'no-heal')).toHaveLength(0);
    expect(specials.filter((room) => room.special === 'static')).toHaveLength(0);
    expect(specials.filter((room) => room.special === 'secret-shop')).toHaveLength(0);
  }
  if (plan.mapIndex < 2) expect(specials.filter((room) => room.special === 'casino')).toHaveLength(0);
  for (const room of specials) {
    expect(room.shape).toBe('dead-end');
    expect(room.openings.filter((opening) => opening.kind === 'link')).toHaveLength(1);
    expect(room.id).not.toBe(plan.entryRoom);
    expect(room.id).not.toBe(plan.bossRoom);
    // A special leaf never outranks the boss as the farthest room.
    expect(dist[room.id]).toBeLessThanOrEqual(dist[plan.bossRoom]);
    expect(room.role).toBe('wild');
    expect(plan.specials.find((special) => special.roomId === room.id)?.kind).toBe(room.special);
  }

  expect(BIOME_ORDER).toContain(plan.biomeId);
  expect(plan.biomeId).toBe(biomeForMap(plan.seed, plan.mapIndex));
}

describe('planMap', () => {
  it('is a pure function of the seed and the map index', () => {
    expect(planMap('seed', 3)).toEqual(planMap('seed', 3));
    expect(planMap('seed', 3)).not.toEqual(planMap('seed', 4));
    expect(planMap('seed', 3)).not.toEqual(planMap('other', 3));
  });

  it('clamps a degenerate map index to map 1', () => {
    expect(planMap('seed', 0)).toEqual(planMap('seed', 1));
    expect(planMap('seed', -3)).toEqual(planMap('seed', 1));
  });

  it('rolls a structurally valid floor for every seed and map', () => {
    for (const seed of SEEDS) {
      for (let mapIndex = 1; mapIndex <= 8; mapIndex++) {
        assertPlan(planMap(seed, mapIndex));
      }
    }
  });

  it('closes every floor into at least one cycle', () => {
    for (const seed of SEEDS) {
      for (let mapIndex = 1; mapIndex <= MAP_TUNING.length; mapIndex++) {
        const plan = planMap(seed, mapIndex);
        expect(plan.links.length, `${seed} map ${mapIndex}`).toBeGreaterThan(plan.rooms.length - 1);
      }
    }
  });

  it('pins the entry and boss rooms to the minimum room size', () => {
    for (const seed of SEEDS) {
      for (let mapIndex = 1; mapIndex <= 8; mapIndex++) {
        const plan = planMap(seed, mapIndex);
        for (const leaf of [plan.entryRoom, plan.bossRoom]) {
          const room = plan.rooms[leaf];
          expect(room.width, `${seed} map ${mapIndex} room ${leaf}`).toBe(MAP_MIN_ROOM_SIZE);
          expect(room.height, `${seed} map ${mapIndex} room ${leaf}`).toBe(MAP_MIN_ROOM_SIZE);
        }
      }
    }
  });

  it('sizes every regular room by its shape, and every quiet leaf at 30x30', () => {
    for (const seed of SEEDS) {
      for (let mapIndex = 1; mapIndex <= 8; mapIndex++) {
        const plan = planMap(seed, mapIndex);
        for (const room of plan.rooms) {
          const label = `${seed} map ${mapIndex} room ${room.id} (${room.shape})`;
          if (room.special !== null || room.id === plan.entryRoom || room.id === plan.bossRoom) {
            expect({ width: room.width, height: room.height }, label).toEqual({
              width: MAP_MIN_ROOM_SIZE,
              height: MAP_MIN_ROOM_SIZE,
            });
            continue;
          }
          const edges = room.openings.map((opening) => opening.edge);
          const longAxis = room.shape === 'corridor' && edges.includes('N') ? 'ns' : 'ew';
          expect({ width: room.width, height: room.height }, label).toEqual(
            roomSizeForShape(room.shape, mapIndex, longAxis),
          );
          const range = mapTuning(mapIndex).size;
          for (const side of [room.width, room.height]) {
            expect(side, label).toBeGreaterThanOrEqual(range.min);
            expect(side, label).toBeLessThanOrEqual(range.max);
            expect(side, label).toBeLessThanOrEqual(MAP_MAX_ROOM_SIZE);
          }
        }
      }
    }
  });

  /**
   * The structure of one floor, pinned verbatim: the room ids, cells, shapes,
   * specials and links `planMap('alpha', 8)` produces with the shop room retired
   * (Task-92) and the static leaf hung last (Task-96). The shop leaf's two size
   * draws are gone and the static leaf's own draws are minted, so the specials and
   * the cells and shapes their links give their parents are re-pinned here; a `map`
   * stream that shifts again fails this test.
   */
  const ALPHA_MAP_8 = {
    entryEdge: 'S',
    bossRoom: 8,
    rooms:
      '0:0,0:corridor:-|1:0,-1:cross:-|2:1,-1:bend:-|3:0,-2:cross:-|4:1,-2:cross:-|5:1,-3:bend:-|6:2,-3:tee:-|7:2,-2:bend:-|8:2,-4:dead-end:-|9:0,-3:dead-end:mega-stone|10:-1,-1:dead-end:trade|11:-1,-2:dead-end:static',
    links: '0-1|1-2|1-3|1-10|2-4|3-4|3-9|3-11|4-5|4-7|5-6|6-7|6-8',
    specials: '9:mega-stone|10:trade|11:static',
  } as const;

  it('keeps the pre-task floor shape and topology for a pinned seed', () => {
    const plan = planMap('alpha', 8);
    expect(plan.entryEdge).toBe(ALPHA_MAP_8.entryEdge);
    expect(plan.bossRoom).toBe(ALPHA_MAP_8.bossRoom);
    expect(
      plan.rooms
        .map((room) => `${room.id}:${room.col},${room.row}:${room.shape}:${room.special ?? '-'}`)
        .join('|'),
    ).toBe(ALPHA_MAP_8.rooms);
    expect(plan.links.map(([a, b]) => `${a}-${b}`).join('|')).toBe(ALPHA_MAP_8.links);
    expect(plan.specials.map((special) => `${special.roomId}:${special.kind}`).join('|')).toBe(
      ALPHA_MAP_8.specials,
    );
    // And it reproduces twice over.
    expect(planMap('alpha', 8)).toEqual(plan);
  });

  it('keeps the entry room at the origin with a free outward edge', () => {
    for (const seed of SEEDS) {
      const plan = planMap(seed, 2);
      const entry = plan.rooms[plan.entryRoom];
      expect(entry.col).toBe(0);
      expect(entry.row).toBe(0);
      const outside = neighbourCell(entry, plan.entryEdge);
      expect(roomAt(plan, outside.x, outside.y)).toBeUndefined();
    }
  });
});

describe('room roles', () => {
  /** The rooms the role pass may tag: the regular rooms that are neither entry nor boss. */
  function candidatesOf(plan: MapPlan): MapRoom[] {
    return plan.rooms.filter(
      (room) => room.id !== plan.entryRoom && room.id !== plan.bossRoom && room.special === null,
    );
  }

  it("tags exactly the floor's trainer budget as trainer rooms", () => {
    for (const seed of SEEDS) {
      for (let mapIndex = 1; mapIndex <= 8; mapIndex++) {
        const plan = planMap(seed, mapIndex);
        const label = `${seed} map ${mapIndex}`;
        const candidates = candidatesOf(plan);
        const trainerRooms = plan.rooms.filter((room) => room.role === 'trainers');
        expect(trainerRooms.length, `${label} trainer rooms`).toBe(trainerRoomsForMap(mapIndex));
        expect(candidates.length, `${label} candidates`).toBeGreaterThanOrEqual(
          trainerRoomsForMap(mapIndex),
        );
        for (const room of trainerRooms) {
          expect(candidates.includes(room), `${label} room ${room.id} is a candidate`).toBe(true);
        }
        for (const room of plan.rooms) {
          expect(['trainers', 'wild'], `${label} room ${room.id} role`).toContain(room.role);
        }
        // Still a pure function of `(seed, mapIndex)`: the role pass replays too.
        expect(planMap(seed, mapIndex), `${label} deterministic`).toEqual(plan);
      }
    }
  });

  it('keeps the entry, the boss and every special leaf wild', () => {
    for (const seed of SEEDS) {
      for (let mapIndex = 1; mapIndex <= 8; mapIndex++) {
        const plan = planMap(seed, mapIndex);
        const label = `${seed} map ${mapIndex}`;
        expect(plan.rooms[plan.entryRoom].role, `${label} entry`).toBe('wild');
        expect(plan.rooms[plan.bossRoom].role, `${label} boss`).toBe('wild');
        for (const room of plan.rooms) {
          if (room.special === null) continue;
          expect(room.role, `${label} ${room.special} leaf`).toBe('wild');
        }
      }
    }
  });

  it('spends one shuffle draw per candidate beyond the first, after every shipped draw', () => {
    for (const seed of SEEDS) {
      for (let mapIndex = 1; mapIndex <= 8; mapIndex++) {
        const plan = planMap(seed, mapIndex);
        const candidates = candidatesOf(plan);
        const expected = Math.max(0, candidates.length - 1);

        const log: { rng: Rng; method: 'int' | 'next'; min?: number; max?: number }[] = [];
        const originalInt = Rng.prototype.int;
        const originalNext = Rng.prototype.next;
        let insideInt = 0;
        const intSpy = vi.spyOn(Rng.prototype, 'int').mockImplementation(function (
          this: Rng,
          min: number,
          max: number,
        ): number {
          log.push({ rng: this, method: 'int', min, max });
          insideInt += 1;
          try {
            return originalInt.call(this, min, max);
          } finally {
            insideInt -= 1;
          }
        });
        const nextSpy = vi.spyOn(Rng.prototype, 'next').mockImplementation(function (this: Rng): number {
          if (insideInt === 0) log.push({ rng: this, method: 'next' });
          return originalNext.call(this);
        });
        try {
          planMap(seed, mapIndex);
        } finally {
          intSpy.mockRestore();
          nextSpy.mockRestore();
        }

        // The floor's own `map` stream is the busiest one; the earlier maps'
        // streams only roll their biome.
        const perStream = new Map<Rng, typeof log>();
        for (const entry of log) {
          const bucket = perStream.get(entry.rng) ?? [];
          bucket.push(entry);
          perStream.set(entry.rng, bucket);
        }
        const busiest = [...perStream.entries()].sort((a, b) => b[1].length - a[1].length)[0];
        const floorCalls = busiest[1];
        const tail = floorCalls.slice(floorCalls.length - expected);
        const expectedTail = Array.from({ length: expected }, (_, k) => ({
          method: 'int' as const,
          min: 0,
          max: candidates.length - 1 - k,
        }));
        expect(
          tail.map((call) => ({ method: call.method, min: call.min, max: call.max })),
          `${seed} map ${mapIndex} role draws`,
        ).toEqual(expectedTail);
      }
    }
  }, 30_000);

  /**
   * The shipped floor of three fixed seeds, pinned verbatim. **Re-pinned by
   * Task-92**: retiring the guaranteed shop leaf removed its two `rng.int` size
   * draws, so every floor from map 2 on draws its specials two positions earlier and
   * the leaves' cells (and the shapes their links give their parents) move. Map 1
   * never hung a shop leaf, so `alpha:1` is unchanged.
   */
  const SHIPPED_FLOORS: Readonly<Record<string, string>> = {
    'alpha:1':
      '0:0,0:30x30:corridor:-|1:-1,0:30x30:cross:-|2:-1,-1:30x30:bend:-|3:-2,0:30x30:bend:-|4:-2,-1:30x30:tee:-|5:-2,-2:30x30:dead-end:-|6:-1,1:30x30:dead-end:mini-boss',
    'alpha:8':
      '0:0,0:30x30:corridor:-|1:0,-1:40x40:cross:-|2:1,-1:44x44:bend:-|3:0,-2:40x40:cross:-|4:1,-2:40x40:cross:-|5:1,-3:44x44:bend:-|6:2,-3:40x48:tee:-|7:2,-2:44x44:bend:-|8:2,-4:30x30:dead-end:-|9:0,-3:30x30:dead-end:mega-stone|10:-1,-1:30x30:dead-end:trade|11:-1,-2:30x30:dead-end:static',
    'role-seed:5':
      '0:0,0:30x30:corridor:-|1:0,1:30x31:tee:-|2:-1,1:30x30:bend:-|3:0,2:30x30:bend:-|4:-1,2:30x31:tee:-|5:-1,3:30x30:dead-end:-',
  };

  it('the role pass does not move a shipped floor', () => {
    const digest = (seed: string, mapIndex: number): string =>
      planMap(seed, mapIndex)
        .rooms.map(
          (room) =>
            `${room.id}:${room.col},${room.row}:${room.width}x${room.height}:${room.shape}:${
              room.special ?? '-'
            }`,
        )
        .join('|');
    for (const key of ['alpha:1', 'alpha:8', 'role-seed:5']) {
      const [seed, mapIndex] = key.split(':');
      expect(digest(seed, Number(mapIndex)), key).toBe(SHIPPED_FLOORS[key]);
    }
  });
});

describe('firstTrainerRoom', () => {
  it('names the lowest trainer room of every fixed-seed floor', () => {
    for (const seed of SEEDS) {
      for (let mapIndex = 1; mapIndex <= 8; mapIndex++) {
        const plan = planMap(seed, mapIndex);
        const label = `${seed} map ${mapIndex}`;
        const trainers = plan.rooms.filter((room) => room.role === 'trainers');
        expect(trainers.length, `${label} trainer rooms`).toBe(TRAINER_ROOMS_PER_MAP[mapIndex - 1]);
        const lowest = trainers.reduce((low, room) => Math.min(low, room.id), Number.MAX_SAFE_INTEGER);
        expect(firstTrainerRoom(plan), label).toBe(lowest);
        expect(plan.rooms[firstTrainerRoom(plan)].role, `${label} room`).toBe('trainers');
      }
    }
  });

  it('answers -1 for a plan whose rooms are all wild', () => {
    const tiny: MapPlan = {
      seed: 'tiny',
      mapIndex: 1,
      biomeId: BIOME_ORDER[0],
      rooms: [0, 1, 2].map((id) => ({
        id,
        col: id,
        row: 0,
        width: MAP_MIN_ROOM_SIZE,
        height: MAP_MIN_ROOM_SIZE,
        shape: 'dead-end' as const,
        openings: [],
        special: null,
        role: 'wild' as const,
      })),
      links: [],
      entryRoom: 0,
      entryEdge: 'S',
      bossRoom: 2,
      specials: [],
    };
    expect(firstTrainerRoom(tiny)).toBe(-1);
    const oneTrainer: MapPlan = {
      ...tiny,
      rooms: tiny.rooms.map((room) => (room.id === 2 ? { ...room, role: 'trainers' } : room)),
    };
    expect(firstTrainerRoom(oneTrainer)).toBe(2);
  });
});

describe('special rooms', () => {
  it('hangs no shop leaf on any floor: the Mart lives behind the merchant NPC', () => {
    for (const seed of SEEDS) {
      for (let mapIndex = 1; mapIndex <= 8; mapIndex++) {
        const plan = planMap(seed, mapIndex);
        expect(
          plan.rooms.some((room) => String(room.special) === 'shop'),
          `${seed} map ${mapIndex} room`,
        ).toBe(false);
        expect(
          plan.specials.some((special) => String(special.kind) === 'shop'),
          `${seed} map ${mapIndex} special`,
        ).toBe(false);
      }
    }
  });

  it("reads map 1's floor as six rooms, or seven with its mini-boss", () => {
    for (const seed of SEEDS) {
      const plan = planMap(seed, 1);
      const mini = specialRoom(plan, 'mini-boss') !== undefined ? 1 : 0;
      expect(plan.rooms.length, `${seed} map 1 rooms`).toBe(6 + mini);
    }
  });

  it('rolls at most one mini-boss and one mega-stone, the latter from map 3 on', () => {
    for (const seed of SEEDS) {
      for (let mapIndex = 1; mapIndex <= 6; mapIndex++) {
        const plan = planMap(seed, mapIndex);
        const mini = plan.rooms.filter((room) => room.special === 'mini-boss');
        const mega = plan.rooms.filter((room) => room.special === 'mega-stone');
        expect(mini.length, `${seed} map ${mapIndex}`).toBeLessThanOrEqual(1);
        expect(mega.length, `${seed} map ${mapIndex}`).toBeLessThanOrEqual(1);
        if (mapIndex < 3) expect(mega).toHaveLength(0);
      }
    }
  });

  it('hangs a mini-boss about half the time and a mega-stone rarely', () => {
    let mini = 0;
    let mega = 0;
    const total = 400;
    for (let i = 0; i < total; i++) {
      const plan = planMap(`special-odds-${i}`, 5);
      if (specialRoom(plan, 'mini-boss') !== undefined) mini++;
      if (specialRoom(plan, 'mega-stone') !== undefined) mega++;
    }
    expect(mini).toBeGreaterThan(total * 0.35);
    expect(mini).toBeLessThan(total * 0.65);
    expect(mega).toBeGreaterThan(0);
    expect(mega).toBeLessThan(total * 0.3);
  });

  it('can hold both a mini-boss and a mega-stone on one floor (O-M4)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const plan = planMap(`special-combo-${i}`, 4);
      const key = `${specialRoom(plan, 'mini-boss') !== undefined}|${specialRoom(plan, 'mega-stone') !== undefined}`;
      seen.add(key);
    }
    expect(seen.has('true|true')).toBe(true);
  });

  it('hangs at most one trade leaf, only from map 3 on, always below the boss', () => {
    for (const seed of SEEDS) {
      for (let mapIndex = 1; mapIndex <= 8; mapIndex++) {
        const plan = planMap(seed, mapIndex);
        const trade = plan.rooms.filter((room) => room.special === 'trade');
        expect(trade.length, `${seed} map ${mapIndex}`).toBeLessThanOrEqual(1);
        if (mapIndex < 3) expect(trade, `${seed} map ${mapIndex}`).toHaveLength(0);
        for (const room of trade) {
          expect(room.shape, `${seed} map ${mapIndex}`).toBe('dead-end');
          expect(room.id).not.toBe(plan.entryRoom);
          expect(room.id).not.toBe(plan.bossRoom);
          const dist = distances(plan);
          expect(dist[room.id], `${seed} map ${mapIndex}`).toBeLessThanOrEqual(dist[plan.bossRoom]);
          // Its parent is a regular room that is neither the entry nor the boss.
          const neighbours = plan.links
            .filter(([a, b]) => a === room.id || b === room.id)
            .map(([a, b]) => (a === room.id ? b : a));
          expect(neighbours).toHaveLength(1);
          expect(neighbours[0]).not.toBe(plan.entryRoom);
          expect(neighbours[0]).not.toBe(plan.bossRoom);
          // The plan's own list agrees with the room's field.
          expect(plan.specials.find((special) => special.roomId === room.id)?.kind).toBe('trade');
        }
      }
    }
  });

  it('hangs a trade leaf between 3 % and 30 % of the time from map 3 on', () => {
    let trade = 0;
    const total = 400;
    for (let i = 0; i < total; i++) {
      if (specialRoom(planMap(`trade-odds-${i}`, 5), 'trade') !== undefined) trade++;
    }
    expect(trade).toBeGreaterThan(total * 0.03);
    expect(trade).toBeLessThan(total * 0.3);
    // Maps 1-2 never hang one, whatever the seed.
    for (let i = 0; i < 100; i++) {
      expect(specialRoom(planMap(`trade-odds-${i}`, 1), 'trade')).toBeUndefined();
      expect(specialRoom(planMap(`trade-odds-${i}`, 2), 'trade')).toBeUndefined();
    }
  });

  it('is deterministic: the same seed and map give the same specials', () => {
    expect(planMap('special-seed', 5).specials).toEqual(planMap('special-seed', 5).specials);
  });

  it('hangs at most one casino, only from map 2 on, always a leaf below the boss', () => {
    for (const seed of SEEDS) {
      for (let mapIndex = 1; mapIndex <= 8; mapIndex++) {
        const plan = planMap(seed, mapIndex);
        const casino = plan.rooms.filter((room) => room.special === 'casino');
        expect(casino.length, `${seed} map ${mapIndex}`).toBeLessThanOrEqual(1);
        if (mapIndex < 2) expect(casino, `${seed} map ${mapIndex}`).toHaveLength(0);
        for (const room of casino) {
          expect(room.shape, `${seed} map ${mapIndex}`).toBe('dead-end');
          expect(room.id).not.toBe(plan.entryRoom);
          expect(room.id).not.toBe(plan.bossRoom);
          const dist = distances(plan);
          expect(dist[room.id], `${seed} map ${mapIndex}`).toBeLessThanOrEqual(dist[plan.bossRoom]);
          // Its parent is a regular room that is neither the entry nor the boss.
          const neighbours = plan.links
            .filter(([a, b]) => a === room.id || b === room.id)
            .map(([a, b]) => (a === room.id ? b : a));
          expect(neighbours).toHaveLength(1);
          expect(neighbours[0]).not.toBe(plan.entryRoom);
          expect(neighbours[0]).not.toBe(plan.bossRoom);
        }
      }
    }
  });

  it('hangs at most one gated leaf, only from map 3 on, always below the boss', () => {
    for (const seed of SEEDS) {
      for (let mapIndex = 1; mapIndex <= 8; mapIndex++) {
        const plan = planMap(seed, mapIndex);
        const gated = plan.rooms.filter((room) => room.special === 'gated');
        expect(gated.length, `${seed} map ${mapIndex}`).toBeLessThanOrEqual(1);
        if (mapIndex < 3) expect(gated, `${seed} map ${mapIndex}`).toHaveLength(0);
        for (const room of gated) {
          expect(room.shape, `${seed} map ${mapIndex}`).toBe('dead-end');
          expect(room.id).not.toBe(plan.entryRoom);
          expect(room.id).not.toBe(plan.bossRoom);
          const dist = distances(plan);
          expect(dist[room.id], `${seed} map ${mapIndex}`).toBeLessThanOrEqual(dist[plan.bossRoom]);
          // Its parent is a regular room that is neither the entry nor the boss.
          const neighbours = plan.links
            .filter(([a, b]) => a === room.id || b === room.id)
            .map(([a, b]) => (a === room.id ? b : a));
          expect(neighbours).toHaveLength(1);
          expect(neighbours[0]).not.toBe(plan.entryRoom);
          expect(neighbours[0]).not.toBe(plan.bossRoom);
        }
      }
    }
  });

  it('hangs a gated leaf about a fifth of the time from map 3 on', () => {
    let gated = 0;
    const total = 400;
    for (let i = 0; i < total; i++) {
      if (specialRoom(planMap(`gated-odds-${i}`, 5), 'gated') !== undefined) gated++;
    }
    expect(gated).toBeGreaterThan(total * 0.1);
    expect(gated).toBeLessThan(total * 0.3);
    // Maps 1-2 never hang one, whatever the seed.
    for (let i = 0; i < 100; i++) {
      expect(specialRoom(planMap(`gated-odds-${i}`, 1), 'gated')).toBeUndefined();
      expect(specialRoom(planMap(`gated-odds-${i}`, 2), 'gated')).toBeUndefined();
    }
  });

  it('hangs a casino about a third of the time from map 2 on', () => {
    let casino = 0;
    const total = 400;
    for (let i = 0; i < total; i++) {
      const plan = planMap(`casino-odds-${i}`, 5);
      if (specialRoom(plan, 'casino') !== undefined) casino++;
    }
    expect(casino).toBeGreaterThan(total * 0.15);
    expect(casino).toBeLessThan(total * 0.45);
    // Map 1 never hangs one, whatever the seed.
    for (let i = 0; i < 100; i++) {
      expect(specialRoom(planMap(`casino-odds-${i}`, 1), 'casino')).toBeUndefined();
    }
  });

  /**
   * The shipped specials, **re-pinned by Task-92** with the shop room's retirement:
   * the guaranteed shop leaf's two size draws are gone, so the mini-boss and
   * mega-stone rolls read the `map` stream two positions earlier from map 2 on. The
   * casino draw is the special pass's **last** statement on the `map` stream, the
   * gated one rolls after it, the trade one after that, the no-heal one after that,
   * the static leaf after that on its own stream and the secret-shop leaf last of all
   * on its own stream, so this array must not move again.
   */
  const SHIPPED_SPECIALS: Readonly<Record<string, string>> = {
    'alpha:1': '6:mini-boss',
    'alpha:2': '6:mini-boss',
    'alpha:3': '',
    'alpha:4': '6:mega-stone',
    'alpha:5': '6:mini-boss',
    'alpha:6': '7:mini-boss',
    'alpha:7': '8:mini-boss',
    'alpha:8': '9:mega-stone',
    'bravo:1': '6:mini-boss',
    'bravo:2': '6:mini-boss',
    'bravo:3': '6:mini-boss,7:mega-stone',
    'bravo:4': '6:mini-boss',
    'bravo:5': '7:mini-boss',
    'bravo:6': '',
    'bravo:7': '',
    'bravo:8': '',
    'charlie:1': '',
    'charlie:2': '',
    'charlie:3': '',
    'charlie:4': '6:mini-boss',
    'charlie:5': '7:mini-boss',
    'charlie:6': '8:mini-boss',
    'charlie:7': '',
    'charlie:8': '9:mini-boss',
    'delta:1': '',
    'delta:2': '6:mini-boss',
    'delta:3': '',
    'delta:4': '6:mega-stone',
    'delta:5': '6:mini-boss',
    'delta:6': '6:mini-boss',
    'delta:7': '6:mini-boss',
    'delta:8': '9:mini-boss',
    'echo:1': '',
    'echo:2': '',
    'echo:3': '',
    'echo:4': '',
    'echo:5': '6:mega-stone',
    'echo:6': '7:mini-boss',
    'echo:7': '8:mini-boss',
    'echo:8': '7:mini-boss',
    'foxtrot:1': '6:mini-boss',
    'foxtrot:2': '6:mini-boss',
    'foxtrot:3': '6:mini-boss,7:mega-stone',
    'foxtrot:4': '6:mini-boss',
    'foxtrot:5': '',
    'foxtrot:6': '8:mini-boss',
    'foxtrot:7': '6:mini-boss',
    'foxtrot:8': '',
    'golf:1': '6:mini-boss',
    'golf:2': '6:mini-boss',
    'golf:3': '',
    'golf:4': '7:mini-boss',
    'golf:5': '7:mini-boss',
    'golf:6': '',
    'golf:7': '8:mini-boss',
    'golf:8': '8:mini-boss',
    'hotel:1': '',
    'hotel:2': '6:mini-boss',
    'hotel:3': '',
    'hotel:4': '',
    'hotel:5': '',
    'hotel:6': '8:mini-boss',
    'hotel:7': '6:mini-boss',
    'hotel:8': '9:mini-boss',
  };

  it('never moves a shipped special leaf (the casino draw rolls last)', () => {
    for (const seed of SEEDS) {
      for (let mapIndex = 1; mapIndex <= 8; mapIndex++) {
        const plan = planMap(seed, mapIndex);
        const shipped = plan.specials
          .filter(
            (special) =>
              special.kind !== 'casino' &&
              special.kind !== 'gated' &&
              special.kind !== 'trade' &&
              special.kind !== 'no-heal' &&
              special.kind !== 'static' &&
              special.kind !== 'secret-shop' &&
              special.kind !== 'banned' &&
              special.kind !== 'puzzle',
          )
          .map((special) => `${special.roomId}:${special.kind}`)
          .join(',');
        expect(shipped, `${seed} map ${mapIndex}`).toBe(SHIPPED_SPECIALS[`${seed}:${mapIndex}`]);
      }
    }
  });

  /**
   * The floor anchors (`biomeId|entryRoom|entryEdge|bossRoom`), dumped **before** the
   * trade draw was added and pinned verbatim. The trade leaf rolls after the entry,
   * the boss and every shipped special, so it can never move one.
   */
  const PLAN_PINS: Readonly<Record<string, string>> = {
    'alpha:1': 'forest|0|E|5',
    'alpha:2': 'forest|0|W|5',
    'alpha:3': 'forest|0|E|5',
    'alpha:4': 'forest|0|W|5',
    'alpha:5': 'forest|0|W|5',
    'alpha:6': 'forest|0|W|6',
    'alpha:7': 'forest|0|N|7',
    'alpha:8': 'forest|0|S|8',
    'bravo:1': 'forest|0|W|5',
    'bravo:2': 'forest|0|S|5',
    'bravo:3': 'forest|0|S|5',
    'bravo:4': 'forest|0|S|5',
    'bravo:5': 'forest|0|S|6',
    'bravo:6': 'forest|0|N|5',
    'bravo:7': 'forest|0|N|7',
    'bravo:8': 'forest|0|S|5',
    'charlie:1': 'forest|0|S|5',
    'charlie:2': 'forest|0|E|5',
    'charlie:3': 'forest|0|W|5',
    'charlie:4': 'forest|0|E|5',
    'charlie:5': 'forest|0|W|6',
    'charlie:6': 'forest|0|E|7',
    'charlie:7': 'forest|0|W|6',
    'charlie:8': 'forest|0|E|8',
    'delta:1': 'forest|0|N|5',
    'delta:2': 'forest|0|E|5',
    'delta:3': 'forest|0|W|5',
    'delta:4': 'forest|0|W|5',
    'delta:5': 'forest|0|E|5',
    'delta:6': 'forest|0|N|5',
    'delta:7': 'forest|0|W|5',
    'delta:8': 'forest|0|S|8',
    'echo:1': 'forest|0|E|5',
    'echo:2': 'forest|0|E|5',
    'echo:3': 'forest|0|E|5',
    'echo:4': 'forest|0|E|5',
    'echo:5': 'forest|0|W|5',
    'echo:6': 'forest|0|N|6',
    'echo:7': 'forest|0|W|7',
    'echo:8': 'forest|0|W|6',
    'foxtrot:1': 'forest|0|W|5',
    'foxtrot:2': 'forest|0|W|5',
    'foxtrot:3': 'forest|0|E|5',
    'foxtrot:4': 'forest|0|S|5',
    'foxtrot:5': 'forest|0|E|5',
    'foxtrot:6': 'forest|0|S|7',
    'foxtrot:7': 'forest|0|N|5',
    'foxtrot:8': 'forest|0|S|8',
    'golf:1': 'forest|0|E|5',
    'golf:2': 'forest|0|S|5',
    'golf:3': 'forest|0|S|5',
    'golf:4': 'forest|0|S|6',
    'golf:5': 'forest|0|E|6',
    'golf:6': 'forest|0|E|6',
    'golf:7': 'forest|0|S|7',
    'golf:8': 'forest|0|E|7',
    'hotel:1': 'forest|0|S|5',
    'hotel:2': 'forest|0|N|5',
    'hotel:3': 'forest|0|W|5',
    'hotel:4': 'forest|0|N|6',
    'hotel:5': 'forest|0|S|5',
    'hotel:6': 'forest|0|W|7',
    'hotel:7': 'forest|0|W|5',
    'hotel:8': 'forest|0|E|8',
  };

  /**
   * The floor anchors the trade draw must leave where they were: one entry per seed
   * and map, read off the pre-change build and pinned verbatim.
   */
  it('never moves a floor anchor (the trade leaf rolls last)', () => {
    for (const seed of SEEDS) {
      for (let mapIndex = 1; mapIndex <= 8; mapIndex++) {
        const plan = planMap(seed, mapIndex);
        const anchor = `${plan.biomeId}|${plan.entryRoom}|${plan.entryEdge}|${plan.bossRoom}`;
        expect(anchor, `${seed} map ${mapIndex}`).toBe(PLAN_PINS[`${seed}:${mapIndex}`]);
      }
    }
  });

  /**
   * The trade leaf's own per-map slot (`'-'` or the room id), **re-pinned by
   * Task-92** with the shop room's retirement, so a moved `map` stream fails this
   * test while every shipped draw stays where the other pins put it.
   */
  const TRADE_LEAVES: Readonly<Record<string, string>> = {
    'alpha:1': '-',
    'alpha:2': '-',
    'alpha:3': '-',
    'alpha:4': '-',
    'alpha:5': '-',
    'alpha:6': '-',
    'alpha:7': '-',
    'alpha:8': '10',
    'bravo:1': '-',
    'bravo:2': '-',
    'bravo:3': '-',
    'bravo:4': '-',
    'bravo:5': '-',
    'bravo:6': '-',
    'bravo:7': '-',
    'bravo:8': '-',
    'charlie:1': '-',
    'charlie:2': '-',
    'charlie:3': '-',
    'charlie:4': '-',
    'charlie:5': '9',
    'charlie:6': '9',
    'charlie:7': '-',
    'charlie:8': '11',
    'delta:1': '-',
    'delta:2': '-',
    'delta:3': '-',
    'delta:4': '-',
    'delta:5': '-',
    'delta:6': '-',
    'delta:7': '-',
    'delta:8': '-',
    'echo:1': '-',
    'echo:2': '-',
    'echo:3': '-',
    'echo:4': '-',
    'echo:5': '-',
    'echo:6': '-',
    'echo:7': '-',
    'echo:8': '-',
    'foxtrot:1': '-',
    'foxtrot:2': '-',
    'foxtrot:3': '-',
    'foxtrot:4': '7',
    'foxtrot:5': '-',
    'foxtrot:6': '-',
    'foxtrot:7': '-',
    'foxtrot:8': '-',
    'golf:1': '-',
    'golf:2': '-',
    'golf:3': '-',
    'golf:4': '-',
    'golf:5': '-',
    'golf:6': '7',
    'golf:7': '-',
    'golf:8': '-',
    'hotel:1': '-',
    'hotel:2': '-',
    'hotel:3': '-',
    'hotel:4': '-',
    'hotel:5': '-',
    'hotel:6': '-',
    'hotel:7': '8',
    'hotel:8': '11',
  };

  it('hangs a no-heal leaf at most once, only from map 3 on, always below the boss', () => {
    for (const seed of SEEDS) {
      for (let mapIndex = 1; mapIndex <= 8; mapIndex++) {
        const plan = planMap(seed, mapIndex);
        const noHeal = plan.rooms.filter((room) => room.special === 'no-heal');
        expect(noHeal.length, `${seed} map ${mapIndex}`).toBeLessThanOrEqual(1);
        if (mapIndex < 3) expect(noHeal, `${seed} map ${mapIndex}`).toHaveLength(0);
        for (const room of noHeal) {
          expect(room.shape, `${seed} map ${mapIndex}`).toBe('dead-end');
          expect(room.id).not.toBe(plan.entryRoom);
          expect(room.id).not.toBe(plan.bossRoom);
          const dist = distances(plan);
          expect(dist[room.id], `${seed} map ${mapIndex}`).toBeLessThanOrEqual(dist[plan.bossRoom]);
          // Its parent is a regular room that is neither the entry nor the boss.
          const neighbours = plan.links
            .filter(([a, b]) => a === room.id || b === room.id)
            .map(([a, b]) => (a === room.id ? b : a));
          expect(neighbours).toHaveLength(1);
          expect(neighbours[0]).not.toBe(plan.entryRoom);
          expect(neighbours[0]).not.toBe(plan.bossRoom);
          // The plan's own list agrees with the room's field.
          expect(plan.specials.find((special) => special.roomId === room.id)?.kind).toBe('no-heal');
        }
      }
    }
  });

  it('hangs a no-heal leaf about a fifth of the time from map 3 on', () => {
    let noHeal = 0;
    const total = 400;
    for (let i = 0; i < total; i++) {
      if (specialRoom(planMap(`noheal-odds-${i}`, 5), 'no-heal') !== undefined) noHeal++;
    }
    expect(noHeal).toBeGreaterThan(total * 0.1);
    expect(noHeal).toBeLessThan(total * 0.3);
    // Maps 1-2 never hang one, whatever the seed.
    for (let i = 0; i < 100; i++) {
      expect(specialRoom(planMap(`noheal-odds-${i}`, 1), 'no-heal')).toBeUndefined();
      expect(specialRoom(planMap(`noheal-odds-${i}`, 2), 'no-heal')).toBeUndefined();
    }
  });

  /**
   * The no-heal leaf's own per-floor slot (`'-'` or the room id), one line per seed
   * and map 1-8, **re-pinned by Task-92** with the shop room's retirement. The leaf
   * rolls **after** the trade leaf, so a moved `map` stream fails this test while
   * every shipped draw stays where the other pins put it.
   */
  const NO_HEAL_LEAVES = [
    '-,-,6,-,7,-,-,-',
    '-,-,-,-,8,6,-,-',
    '-,-,7,-,-,-,-,-',
    '-,-,-,-,-,-,-,10',
    '-,-,-,-,7,-,-,-',
    '-,-,-,-,-,-,-,-',
    '-,-,-,-,-,-,-,-',
    '-,-,-,-,-,-,-,12',
  ];

  it('pins where the no-heal leaf hangs, seed by seed', () => {
    for (const [index, seed] of SEEDS.entries()) {
      const leaves: string[] = [];
      for (let mapIndex = 1; mapIndex <= 8; mapIndex++) {
        const room = specialRoom(planMap(seed, mapIndex), 'no-heal');
        leaves.push(room === undefined ? '-' : String(room));
      }
      expect(leaves.join(','), seed).toBe(NO_HEAL_LEAVES[index]);
    }
  });

  it('hangs a static leaf at most once, only from map 3 on, always below the boss', () => {
    for (const seed of SEEDS) {
      for (let mapIndex = 1; mapIndex <= 8; mapIndex++) {
        const plan = planMap(seed, mapIndex);
        const staticLeaves = plan.rooms.filter((room) => room.special === 'static');
        expect(staticLeaves.length, `${seed} map ${mapIndex}`).toBeLessThanOrEqual(1);
        if (mapIndex < 3) expect(staticLeaves, `${seed} map ${mapIndex}`).toHaveLength(0);
        for (const room of staticLeaves) {
          expect(room.shape, `${seed} map ${mapIndex}`).toBe('dead-end');
          expect(room.role, `${seed} map ${mapIndex}`).toBe('wild');
          expect(room.id).not.toBe(plan.entryRoom);
          expect(room.id).not.toBe(plan.bossRoom);
          const dist = distances(plan);
          expect(dist[room.id], `${seed} map ${mapIndex}`).toBeLessThanOrEqual(dist[plan.bossRoom]);
          // Its parent is a regular room that is neither the entry nor the boss.
          const neighbours = plan.links
            .filter(([a, b]) => a === room.id || b === room.id)
            .map(([a, b]) => (a === room.id ? b : a));
          expect(neighbours).toHaveLength(1);
          expect(neighbours[0]).not.toBe(plan.entryRoom);
          expect(neighbours[0]).not.toBe(plan.bossRoom);
          // The plan's own list agrees with the room's field.
          expect(plan.specials.find((special) => special.roomId === room.id)?.kind).toBe('static');
        }
      }
    }
  });

  it('hangs a static leaf about a quarter of the time from map 3 on', () => {
    let staticLeaves = 0;
    const total = 400;
    for (let i = 0; i < total; i++) {
      if (specialRoom(planMap(`static-odds-${i}`, 5), 'static') !== undefined) staticLeaves++;
    }
    expect(staticLeaves).toBeGreaterThan(total * 0.15);
    expect(staticLeaves).toBeLessThan(total * 0.35);
    // Maps 1-2 never hang one, whatever the seed.
    for (let i = 0; i < 100; i++) {
      expect(specialRoom(planMap(`static-odds-${i}`, 1), 'static')).toBeUndefined();
      expect(specialRoom(planMap(`static-odds-${i}`, 2), 'static')).toBeUndefined();
    }
  });

  /**
   * The static leaf's own per-floor slot (`'-'` or the room id), one line per seed
   * and map 1-8. It rolls **last of all**, on its own `${seed}:map:<floor>:static-room`
   * stream, so it can move neither the `map` stream nor any leaf already pinned above.
   */
  const STATIC_LEAVES = [
    '-,-,-,8,-,-,9,11',
    '-,-,-,-,-,-,-,-',
    '-,-,-,8,-,-,-,-',
    '-,-,7,7,-,-,-,-',
    '-,-,-,-,8,10,-,-',
    '-,-,-,8,-,10,-,-',
    '-,-,-,-,-,8,-,9',
    '-,-,6,-,-,-,-,-',
  ];

  it('pins where the static leaf hangs, seed by seed', () => {
    for (const [index, seed] of SEEDS.entries()) {
      const leaves: string[] = [];
      for (let mapIndex = 1; mapIndex <= 8; mapIndex++) {
        const room = specialRoom(planMap(seed, mapIndex), 'static');
        leaves.push(room === undefined ? '-' : String(room));
      }
      expect(leaves.join(','), seed).toBe(STATIC_LEAVES[index]);
    }
    // Reproducible twice over: its own stream replays with the plan.
    expect(planMap('delta', 4)).toEqual(planMap('delta', 4));
  });

  it('hangs a secret-shop leaf at most once, only from map 3 on, always below the boss', () => {
    for (const seed of SEEDS) {
      for (let mapIndex = 1; mapIndex <= 8; mapIndex++) {
        const plan = planMap(seed, mapIndex);
        const secret = plan.rooms.filter((room) => room.special === 'secret-shop');
        expect(secret.length, `${seed} map ${mapIndex}`).toBeLessThanOrEqual(1);
        if (mapIndex < 3) expect(secret, `${seed} map ${mapIndex}`).toHaveLength(0);
        for (const room of secret) {
          expect(room.shape, `${seed} map ${mapIndex}`).toBe('dead-end');
          expect(room.role, `${seed} map ${mapIndex}`).toBe('wild');
          expect(room.id).not.toBe(plan.entryRoom);
          expect(room.id).not.toBe(plan.bossRoom);
          const dist = distances(plan);
          expect(dist[room.id], `${seed} map ${mapIndex}`).toBeLessThanOrEqual(dist[plan.bossRoom]);
          // Its only link is the parent, a regular room that is neither the entry nor
          // the boss.
          const neighbours = plan.links
            .filter(([a, b]) => a === room.id || b === room.id)
            .map(([a, b]) => (a === room.id ? b : a));
          expect(neighbours).toHaveLength(1);
          expect(neighbours[0]).not.toBe(plan.entryRoom);
          expect(neighbours[0]).not.toBe(plan.bossRoom);
          // The plan's own list agrees with the room's field.
          expect(plan.specials.find((special) => special.roomId === room.id)?.kind).toBe('secret-shop');
        }
      }
    }
  });

  it('hangs a secret-shop leaf about a fifth of the time from map 3 on', () => {
    let shops = 0;
    const total = 100;
    for (let i = 0; i < total; i++) {
      if (specialRoom(planMap(`secret-shop-odds-${i}`, 5), 'secret-shop') !== undefined) shops++;
    }
    expect(shops).toBeGreaterThanOrEqual(total * 0.1);
    expect(shops).toBeLessThanOrEqual(total * 0.35);
    // Maps 1-2 never hang one, whatever the seed.
    for (let i = 0; i < 100; i++) {
      expect(specialRoom(planMap(`secret-shop-odds-${i}`, 1), 'secret-shop')).toBeUndefined();
      expect(specialRoom(planMap(`secret-shop-odds-${i}`, 2), 'secret-shop')).toBeUndefined();
    }
  });

  /**
   * The secret-shop leaf's own per-floor slot (`'-'` or the room id), one line per
   * seed and map 1-8. It rolls **last of all**, on its own
   * `${seed}:map:<floor>:secret-shop-room` stream, so it moves neither the `map`
   * stream nor any leaf already pinned above; the static leaf it follows is pinned
   * unchanged by `STATIC_LEAVES`.
   */
  const SECRET_SHOP_LEAVES = [
    '-,-,-,-,-,8,-,-',
    '-,-,-,-,-,-,8,-',
    '-,-,-,-,-,-,-,-',
    '-,-,-,-,-,-,-,-',
    '-,-,-,-,-,-,-,-',
    '-,-,-,-,6,-,-,10',
    '-,-,-,8,8,9,-,-',
    '-,-,-,-,-,-,-,-',
  ];

  it('pins where the secret-shop leaf hangs, seed by seed', () => {
    for (const [index, seed] of SEEDS.entries()) {
      const leaves: string[] = [];
      for (let mapIndex = 1; mapIndex <= 8; mapIndex++) {
        const room = specialRoom(planMap(seed, mapIndex), 'secret-shop');
        leaves.push(room === undefined ? '-' : String(room));
      }
      expect(leaves.join(','), seed).toBe(SECRET_SHOP_LEAVES[index]);
    }
    // Reproducible twice over: its own stream replays with the plan.
    expect(planMap('alpha', 6)).toEqual(planMap('alpha', 6));
  });

  /**
   * The banned-species leaf's own per-floor slot (`'-'` or the room id), one line
   * per seed and map 1-8. It rolls **last of all**, on its own
   * `${seed}:map:<floor>:banned-room` stream, so it moves neither the `map` stream
   * nor any leaf already pinned above; the secret-shop leaf it follows is pinned
   * unchanged by `SECRET_SHOP_LEAVES`.
   */
  const BAN_LEAVES = [
    '-,-,-,-,-,-,-,-',
    '-,-,8,-,-,-,9,-',
    '-,-,8,-,-,-,-,12',
    '-,-,-,-,-,-,8,-',
    '-,-,-,-,9,-,-,-',
    '-,-,-,-,-,-,-,-',
    '-,-,-,-,-,10,-,-',
    '-,-,-,9,-,9,-,-',
  ];

  it('pins where the banned leaf hangs, seed by seed', () => {
    for (const [index, seed] of SEEDS.entries()) {
      const leaves: string[] = [];
      for (let mapIndex = 1; mapIndex <= 8; mapIndex++) {
        const room = specialRoom(planMap(seed, mapIndex), 'banned');
        leaves.push(room === undefined ? '-' : String(room));
      }
      expect(leaves.join(','), seed).toBe(BAN_LEAVES[index]);
    }
    // Reproducible twice over: its own stream replays with the plan.
    expect(planMap('hotel', 7)).toEqual(planMap('hotel', 7));
  });

  /**
   * The puzzle leaf's own per-floor slot (`'-'` or the room id), one line per seed
   * and map 1-8. It rolls **last of all**, on its own
   * `${seed}:map:<floor>:puzzle-room` stream, so it moves neither the `map` stream
   * nor any leaf already pinned above; the banned leaf it follows is pinned
   * unchanged by `BAN_LEAVES`.
   */
  const PUZZLE_LEAVES = [
    '-,-,-,-,-,-,-,-',
    '-,-,-,-,-,-,10,-',
    '-,-,-,-,-,-,-,-',
    '-,7,8,-,8,-,-,-',
    '-,6,-,-,10,-,-,-',
    '-,-,-,-,7,-,7,11',
    '-,-,-,-,-,-,-,-',
    '-,7,7,-,-,-,-,13',
  ];

  it('pins where the puzzle leaf hangs, seed by seed', () => {
    for (const [index, seed] of SEEDS.entries()) {
      const leaves: string[] = [];
      for (let mapIndex = 1; mapIndex <= 8; mapIndex++) {
        const room = specialRoom(planMap(seed, mapIndex), 'puzzle');
        leaves.push(room === undefined ? '-' : String(room));
      }
      expect(leaves.join(','), seed).toBe(PUZZLE_LEAVES[index]);
    }
    // Reproducible twice over: its own stream replays with the plan.
    expect(planMap('foxtrot', 8)).toEqual(planMap('foxtrot', 8));
  });

  it('hangs a banned leaf once at most, only from map 3 on, always below the boss', () => {
    for (const seed of SEEDS) {
      for (let mapIndex = 1; mapIndex <= 8; mapIndex++) {
        const plan = planMap(seed, mapIndex);
        const banned = plan.rooms.filter((room) => room.special === 'banned');
        expect(banned.length, `${seed} map ${mapIndex}`).toBeLessThanOrEqual(1);
        if (mapIndex < 3) expect(banned, `${seed} map ${mapIndex}`).toHaveLength(0);
        if (banned.length === 0) continue;
        const room = banned[0];
        expect(room.role, `${seed} map ${mapIndex}`).toBe('wild');
        expect(room.id).not.toBe(plan.entryRoom);
        expect(room.id).not.toBe(plan.bossRoom);
        const links = plan.links.filter(([a, b]) => a === room.id || b === room.id);
        expect(links, `${seed} map ${mapIndex}`).toHaveLength(1);
        expect(
          plan.specials.some((special) => special.roomId === room.id && special.kind === 'banned'),
          `${seed} map ${mapIndex}`,
        ).toBe(true);
      }
    }
  });

  it('pins where the trade leaf hangs, seed by seed', () => {
    for (const seed of SEEDS) {
      for (let mapIndex = 1; mapIndex <= 8; mapIndex++) {
        const room = specialRoom(planMap(seed, mapIndex), 'trade');
        expect(room === undefined ? '-' : String(room), `${seed} map ${mapIndex}`).toBe(
          TRADE_LEAVES[`${seed}:${mapIndex}`],
        );
      }
    }
    // Reproducible twice over: the same call is the same plan.
    expect(planMap('alpha', 7)).toEqual(planMap('alpha', 7));
  });
});

describe('pickBiome', () => {
  it('never repeats the previous biome while an alternative exists', () => {
    const pool = ['a', 'b', 'c'] as const;
    const rng = new Rng(12345);
    let previous: 'a' | 'b' | 'c' | undefined;
    for (let i = 0; i < 50; i++) {
      const picked = pickBiome(rng, previous, pool);
      expect(picked).not.toBe(previous);
      previous = picked;
    }
  });

  it('falls back to the full pool when it is the only option', () => {
    const pool = ['forest'] as const;
    expect(pickBiome(new Rng(1), 'forest', pool)).toBe('forest');
  });

  it('throws on an empty pool', () => {
    expect(() => pickBiome(new Rng(1), undefined, [] as string[])).toThrow();
  });
});

describe('biomeForMap', () => {
  it('agrees with the plan it belongs to', () => {
    for (const seed of SEEDS) {
      for (let mapIndex = 1; mapIndex <= 6; mapIndex++) {
        expect(biomeForMap(seed, mapIndex)).toBe(planMap(seed, mapIndex).biomeId);
      }
    }
  });
});

/** The edge of `from` that faces the grid neighbour `to`. */
function edgeToward(from: MapRoom, to: MapRoom): MapEdge {
  if (to.col > from.col) return 'E';
  if (to.col < from.col) return 'W';
  return to.row > from.row ? 'S' : 'N';
}

describe('plan -> route connections', () => {
  it('builds each room from its plan openings and joins neighbours by opposite edges', () => {
    for (let mapIndex = 1; mapIndex <= 3; mapIndex++) {
      const plan = planMap('conn-seed', mapIndex);
      for (const [a, b] of plan.links) {
        const roomA = plan.rooms[a];
        const roomB = plan.rooms[b];
        const edgeToB = edgeToward(roomA, roomB);
        // The plan already stores the neighbour's opposite edge on the other room.
        expect(roomB.openings.some((opening) => opening.edge === OPPOSITE_EDGE[edgeToB])).toBe(true);

        const openings: Access[] = roomA.openings.map((opening) => ({
          edge: opening.edge,
          role: opening.edge === edgeToB ? 'entry' : 'exit',
        }));
        const route = sketchRoute({
          seed: 'conn-seed',
          routeIndex: a,
          biomeId: plan.biomeId,
          openings,
          width: roomA.width,
          height: roomA.height,
        });
        const onEntryEdge =
          (edgeToB === 'W' && route.entry.x === 0) ||
          (edgeToB === 'E' && route.entry.x === route.width - 1) ||
          (edgeToB === 'N' && route.entry.y === 0) ||
          (edgeToB === 'S' && route.entry.y === route.height - 1);
        expect(onEntryEdge, `${roomA.shape} room ${a} entry`).toBe(true);
        expect(validateRoute(route).ok, `${roomA.shape} room ${a}`).toBe(true);
      }
    }
  }, 30_000);
});
