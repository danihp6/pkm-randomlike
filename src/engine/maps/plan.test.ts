import { describe, expect, it } from 'vitest';
import { BIOME_ORDER } from '../../data/biomes';
import { MAP_MIN_ROOM_SIZE, MAP_TUNING, mapTuning } from '../../data/maps';
import type { Access } from '../routes/layout';
import { sketchRoute } from '../routes/sketch';
import { validateRoute } from '../routes/validate';
import { Rng } from '../rng';
import {
  MAP_EDGES,
  OPPOSITE_EDGE,
  biomeForMap,
  linkedNeighbour,
  pickBiome,
  planMap,
  roomAt,
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
  expect(plan.rooms.length).toBeGreaterThanOrEqual(tuning.routes.min);
  expect(plan.rooms.length).toBeLessThanOrEqual(tuning.routes.max);

  const seen = new Set<string>();
  for (const room of plan.rooms) {
    const cell = `${room.col},${room.row}`;
    expect(seen.has(cell)).toBe(false);
    seen.add(cell);

    // The entry and boss rooms are the quiet leaves, pinned to the minimum size
    // whatever range the map rolls; every other room stays inside that range.
    if (room.id === plan.entryRoom || room.id === plan.bossRoom) {
      expect(room.width).toBe(MAP_MIN_ROOM_SIZE);
      expect(room.height).toBe(MAP_MIN_ROOM_SIZE);
    } else {
      expect(room.width).toBeGreaterThanOrEqual(tuning.size.min);
      expect(room.width).toBeLessThanOrEqual(tuning.size.max);
      expect(room.height).toBeGreaterThanOrEqual(tuning.size.min);
      expect(room.height).toBeLessThanOrEqual(tuning.size.max);
    }

    const edges = room.openings.map((opening) => opening.edge);
    expect(new Set(edges).size).toBe(edges.length);
    expect(edges).toEqual(
      [...edges].sort((a, b) => MAP_EDGES.indexOf(a) - MAP_EDGES.indexOf(b)),
    );
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
