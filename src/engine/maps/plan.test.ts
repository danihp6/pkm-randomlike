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
  SHOP_FROM_MAP,
  biomeForMap,
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
  // or the boss, exactly one shop from map 2 on (map 1 hangs none) and at most one
  // mini-boss / mega-stone each.
  const specials = plan.rooms.filter((room) => room.special !== null);
  expect(specials.length).toBe(plan.specials.length);
  expect(specials.filter((room) => room.special === 'shop')).toHaveLength(
    plan.mapIndex >= SHOP_FROM_MAP ? 1 : 0,
  );
  expect(specials.filter((room) => room.special === 'mini-boss').length).toBeLessThanOrEqual(1);
  expect(specials.filter((room) => room.special === 'mega-stone').length).toBeLessThanOrEqual(1);
  expect(specials.filter((room) => room.special === 'casino').length).toBeLessThanOrEqual(1);
  expect(specials.filter((room) => room.special === 'gated').length).toBeLessThanOrEqual(1);
  expect(specials.filter((room) => room.special === 'trade').length).toBeLessThanOrEqual(1);
  // The casino hangs from map 2 on and the gated and trade leaves from map 3 on
  // (`docs/maps-spec.md` §7).
  if (plan.mapIndex < 3) {
    expect(specials.filter((room) => room.special === 'mega-stone')).toHaveLength(0);
    expect(specials.filter((room) => room.special === 'gated')).toHaveLength(0);
    expect(specials.filter((room) => room.special === 'trade')).toHaveLength(0);
  }
  if (plan.mapIndex < 2) expect(specials.filter((room) => room.special === 'casino')).toHaveLength(0);
  for (const room of specials) {
    expect(room.shape).toBe('dead-end');
    expect(room.openings.filter((opening) => opening.kind === 'link')).toHaveLength(1);
    expect(room.id).not.toBe(plan.entryRoom);
    expect(room.id).not.toBe(plan.bossRoom);
    // A special leaf never outranks the boss as the farthest room.
    expect(dist[room.id]).toBeLessThanOrEqual(dist[plan.bossRoom]);
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

describe('special rooms', () => {
  it('hangs no shop on map 1, whose floor reads six rooms or seven with its mini-boss', () => {
    for (const seed of SEEDS) {
      const plan = planMap(seed, 1);
      expect(
        plan.rooms.some((room) => room.special === 'shop'),
        `${seed} map 1 room`,
      ).toBe(false);
      expect(
        plan.specials.some((special) => special.kind === 'shop'),
        `${seed} map 1 special`,
      ).toBe(false);
      const mini = specialRoom(plan, 'mini-boss') !== undefined ? 1 : 0;
      expect(plan.rooms.length, `${seed} map 1 rooms`).toBe(6 + mini);
    }
  });

  it('gives every floor from map 2 on exactly one shop, hung near the entry', () => {
    for (const seed of SEEDS) {
      for (let mapIndex = SHOP_FROM_MAP; mapIndex <= 8; mapIndex++) {
        const plan = planMap(seed, mapIndex);
        const shop = specialRoom(plan, 'shop');
        expect(shop, `${seed} map ${mapIndex}`).toBeDefined();
        expect(plan.rooms[shop!].shape).toBe('dead-end');
        // A single door, to a regular room that is neither the entry nor the boss.
        const neighbours = plan.links
          .filter(([a, b]) => a === shop || b === shop)
          .map(([a, b]) => (a === shop ? b : a));
        expect(neighbours).toHaveLength(1);
        expect(neighbours[0]).not.toBe(plan.entryRoom);
        expect(neighbours[0]).not.toBe(plan.bossRoom);
        // The shop sits nearer the entry than the boss does.
        const dist = distances(plan);
        expect(dist[shop!]).toBeLessThan(dist[plan.bossRoom]);
      }
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
   * The shipped specials, read off the **pre-change** build for the sweep above
   * (one dump per seed and map, `roomId:kind` joined by `,`). The casino draw is
   * the special pass's **last** shipped statement, the gated one rolls after it and
   * the trade one after that, so this array must never move.
   */
  const SHIPPED_SPECIALS: Readonly<Record<string, string>> = {
    'alpha:1': '6:mini-boss',
    'alpha:2': '6:shop,7:mini-boss',
    'alpha:3': '6:shop',
    'alpha:4': '6:shop,7:mini-boss,8:mega-stone',
    'alpha:5': '6:shop,7:mega-stone',
    'alpha:6': '7:shop,8:mega-stone',
    'alpha:7': '8:shop',
    'alpha:8': '9:shop,10:mini-boss',
    'bravo:1': '6:mini-boss',
    'bravo:2': '6:shop,7:mini-boss',
    'bravo:3': '6:shop,7:mini-boss,8:mega-stone',
    'bravo:4': '6:shop,7:mini-boss',
    'bravo:5': '7:shop',
    'bravo:6': '6:shop',
    'bravo:7': '8:shop,9:mini-boss',
    'bravo:8': '6:shop',
    'charlie:1': '',
    'charlie:2': '6:shop',
    'charlie:3': '6:shop',
    'charlie:4': '6:shop,7:mini-boss,8:mega-stone',
    'charlie:5': '7:shop,8:mini-boss',
    'charlie:6': '8:shop,9:mini-boss',
    'charlie:7': '7:shop',
    'charlie:8': '9:shop,10:mini-boss,11:mega-stone',
    'delta:1': '',
    'delta:2': '6:shop,7:mini-boss',
    'delta:3': '6:shop',
    'delta:4': '6:shop,7:mini-boss',
    'delta:5': '6:shop,7:mega-stone',
    'delta:6': '6:shop',
    'delta:7': '6:shop',
    'delta:8': '9:shop',
    'echo:1': '',
    'echo:2': '6:shop',
    'echo:3': '6:shop',
    'echo:4': '6:shop,7:mini-boss',
    'echo:5': '6:shop,7:mini-boss',
    'echo:6': '7:shop',
    'echo:7': '8:shop,9:mini-boss',
    'echo:8': '7:shop,8:mini-boss',
    'foxtrot:1': '6:mini-boss',
    'foxtrot:2': '6:shop,7:mini-boss',
    'foxtrot:3': '6:shop,7:mini-boss,8:mega-stone',
    'foxtrot:4': '6:shop,7:mini-boss',
    'foxtrot:5': '6:shop',
    'foxtrot:6': '8:shop,9:mini-boss',
    'foxtrot:7': '6:shop,7:mini-boss',
    'foxtrot:8': '9:shop,10:mini-boss',
    'golf:1': '6:mini-boss',
    'golf:2': '6:shop,7:mini-boss',
    'golf:3': '6:shop',
    'golf:4': '7:shop',
    'golf:5': '7:shop',
    'golf:6': '7:shop',
    'golf:7': '8:shop,9:mini-boss',
    'golf:8': '8:shop',
    'hotel:1': '',
    'hotel:2': '6:shop,7:mini-boss',
    'hotel:3': '6:shop',
    'hotel:4': '7:shop,8:mini-boss,9:mega-stone',
    'hotel:5': '6:shop',
    'hotel:6': '8:shop,9:mini-boss',
    'hotel:7': '6:shop,7:mini-boss',
    'hotel:8': '9:shop,10:mini-boss',
  };

  it('never moves a shipped special leaf (the casino draw rolls last)', () => {
    for (const seed of SEEDS) {
      for (let mapIndex = 1; mapIndex <= 8; mapIndex++) {
        const plan = planMap(seed, mapIndex);
        const shipped = plan.specials
          .filter(
            (special) =>
              special.kind !== 'casino' && special.kind !== 'gated' && special.kind !== 'trade',
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
   * The trade leaf's own per-map slot (`'-'` or the room id), computed once from the
   * delivered build and pinned verbatim, so a moved `map` stream fails this test.
   */
  const TRADE_LEAVES: Readonly<Record<string, string>> = {
    'alpha:1': '-',
    'alpha:2': '-',
    'alpha:3': '-',
    'alpha:4': '-',
    'alpha:5': '-',
    'alpha:6': '-',
    'alpha:7': '10',
    'alpha:8': '-',
    'bravo:1': '-',
    'bravo:2': '-',
    'bravo:3': '-',
    'bravo:4': '8',
    'bravo:5': '-',
    'bravo:6': '8',
    'bravo:7': '-',
    'bravo:8': '7',
    'charlie:1': '-',
    'charlie:2': '-',
    'charlie:3': '-',
    'charlie:4': '-',
    'charlie:5': '-',
    'charlie:6': '-',
    'charlie:7': '-',
    'charlie:8': '-',
    'delta:1': '-',
    'delta:2': '-',
    'delta:3': '-',
    'delta:4': '8',
    'delta:5': '-',
    'delta:6': '-',
    'delta:7': '-',
    'delta:8': '-',
    'echo:1': '-',
    'echo:2': '-',
    'echo:3': '-',
    'echo:4': '-',
    'echo:5': '-',
    'echo:6': '9',
    'echo:7': '-',
    'echo:8': '-',
    'foxtrot:1': '-',
    'foxtrot:2': '-',
    'foxtrot:3': '-',
    'foxtrot:4': '-',
    'foxtrot:5': '-',
    'foxtrot:6': '-',
    'foxtrot:7': '-',
    'foxtrot:8': '-',
    'golf:1': '-',
    'golf:2': '-',
    'golf:3': '-',
    'golf:4': '-',
    'golf:5': '-',
    'golf:6': '-',
    'golf:7': '-',
    'golf:8': '-',
    'hotel:1': '-',
    'hotel:2': '-',
    'hotel:3': '-',
    'hotel:4': '-',
    'hotel:5': '-',
    'hotel:6': '-',
    'hotel:7': '-',
    'hotel:8': '-',
  };

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
