import { BIOME_ORDER, type BiomeId } from '../../data/biomes';
import { MAP_MIN_ROOM_SIZE, mapTuning } from '../../data/maps';
import type { Tile } from '../grid';
import type { Rng } from '../rng';
import { mapStreams } from './streams';

/**
 * A **map** is a Binding of Isaac-style floor: a graph of routes (rooms) laid out
 * on a coarse grid and closed into at least one cycle (`docs/maps-spec.md`, D30).
 * `planMap` rolls the biome, the room count, each room's size and the floor's
 * topology off one `map` stream, then derives every room's openings and shape and
 * marks the room farthest from the entry as the boss (D28/D29/D31).
 *
 * Everything here is pure geometry and pure data: no Phaser, no per-frame work and
 * no world-space coordinates. The grid only lays out the graph (and later the
 * minimap); each room is still played on its own screen.
 */

export type MapEdge = 'N' | 'E' | 'S' | 'W';

/** Cardinally ordered so every derivation over a room's edges is deterministic. */
export const MAP_EDGES: readonly MapEdge[] = ['N', 'E', 'S', 'W'];

export const OPPOSITE_EDGE: Readonly<Record<MapEdge, MapEdge>> = {
  N: 'S',
  E: 'W',
  S: 'N',
  W: 'E',
};

const EDGE_STEP: Readonly<Record<MapEdge, Tile>> = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};

const PERPENDICULAR: Readonly<Record<MapEdge, readonly [MapEdge, MapEdge]>> = {
  N: ['W', 'E'],
  E: ['N', 'S'],
  S: ['W', 'E'],
  W: ['N', 'S'],
};

/**
 * How a room reads given its opening set (`docs/maps-spec.md` §2, D30). `straight`
 * is the older branchy two-opposite route and is produced by the route builder
 * rather than by the opening count alone, so a plan only emits `corridor` for two
 * opposite openings.
 */
export type MapRoomShape = 'dead-end' | 'corridor' | 'bend' | 'tee' | 'cross' | 'straight';

/** A `link` joins a grid neighbour; the single `entry` opens the map from outside. */
export type MapOpeningKind = 'link' | 'entry';

export type MapOpening = Readonly<{ edge: MapEdge; kind: MapOpeningKind }>;

/**
 * A **special** room (`docs/maps-spec.md` §7, D33): an extra dead-end leaf that
 * carries only its own content, never the regular room's. One **shop** per floor,
 * a **mini-boss** leaf on a roll, a **mega-stone** leaf from map 3 on, a **casino**
 * leaf from map 2 on and a **gated** leaf (a vault sealed behind a type-gated
 * obstacle) from map 3 on; the last four may coincide on one floor. Every one is
 * hung off a regular room that is neither the entry nor the boss, and never farther
 * from the entry than the boss.
 */
export type MapRoomSpecial = 'shop' | 'mini-boss' | 'mega-stone' | 'casino' | 'gated';

export type MapRoom = Readonly<{
  id: number;
  /** Grid cell the room occupies; the entry sits at the origin, so these may be negative. */
  col: number;
  row: number;
  width: number;
  height: number;
  shape: MapRoomShape;
  /** Every opening, cardinally ordered; a link per joined neighbour, plus the entry edge. */
  openings: readonly MapOpening[];
  /** The special this room holds, or null for a regular room (`docs/maps-spec.md` §7). */
  special: MapRoomSpecial | null;
}>;

/** An unordered pair of `MapRoom` ids (smaller first) that share a door. */
export type MapLink = readonly [number, number];

/** A special room and the kind it holds, in room-id order. */
export type MapSpecialRoom = Readonly<{ roomId: number; kind: MapRoomSpecial }>;

export type MapPlan = Readonly<{
  seed: string;
  mapIndex: number;
  biomeId: BiomeId;
  rooms: readonly MapRoom[];
  links: readonly MapLink[];
  entryRoom: number;
  /** The edge the previous map's exit enters through; that cell is never occupied. */
  entryEdge: MapEdge;
  /** The room farthest from the entry (graph distance); it fields the boss. */
  bossRoom: number;
  /** The floor's special rooms (shop/mini-boss/mega-stone), beyond the regular set. */
  specials: readonly MapSpecialRoom[];
}>;

/** How many extra cycle-closing doors a floor may add on top of the guaranteed one. */
const MAX_EXTRA_DOORS = 2;

/** Chance a floor hangs a **mini-boss** leaf (`docs/maps-spec.md` §7, O-M4). */
const MINI_BOSS_CHANCE = 0.5;

/** Chance a floor hangs a **mega-stone** leaf, only from `MEGA_STONE_FROM_MAP` on. */
const MEGA_STONE_CHANCE = 0.15;

/** The first map whose floor may hold a mega-stone leaf (`docs/maps-spec.md` §7). */
const MEGA_STONE_FROM_MAP = 3;

/** Chance a floor hangs a **casino** leaf (`docs/maps-spec.md` §7). Module-private. */
const CASINO_CHANCE = 0.3;

/** The first map whose floor may hang a casino leaf (`docs/maps-spec.md` §7). */
const CASINO_FROM_MAP = 2;

/** Chance a floor hangs a **gated** leaf (`docs/maps-spec.md` §7). Module-private. */
const GATED_CHANCE = 0.2;

/** The first map whose floor may hang a gated leaf (`docs/maps-spec.md` §7). */
const GATED_FROM_MAP = 3;

/** The first map whose floor hangs its guaranteed **shop** leaf (`docs/maps-spec.md` §7). */
export const SHOP_FROM_MAP = 2;

/**
 * Whether a floor hangs the guaranteed shop leaf. Map 1 is the run's on-ramp: it
 * has no money for a counter and already starts with its 10-ball pack, so the
 * first floor spends the leaf on nothing (`docs/maps-spec.md` §7, O-M4).
 */
export function hangsShop(mapIndex: number): boolean {
  return Math.max(1, Math.floor(mapIndex)) >= SHOP_FROM_MAP;
}

function cellKey(cell: Tile): string {
  return `${cell.x},${cell.y}`;
}

function step(cell: Tile, edge: MapEdge): Tile {
  const delta = EDGE_STEP[edge];
  return { x: cell.x + delta.x, y: cell.y + delta.y };
}

function linkKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/** The edge of `from` that steps onto the adjacent `to` (they must be neighbours). */
function edgeBetween(from: Tile, to: Tile): MapEdge {
  for (const edge of MAP_EDGES) {
    const next = step(from, edge);
    if (next.x === to.x && next.y === to.y) return edge;
  }
  throw new Error('linked rooms are not grid neighbours');
}

/**
 * Picks a biome from `pool`, never the previous map's when the pool holds an
 * alternative (`docs/maps-spec.md` §1, D28). A single-biome pool (today's) cannot
 * avoid a repeat, so it falls back to the whole pool.
 */
export function pickBiome<T extends string>(rng: Rng, previous: T | undefined, pool: readonly T[]): T {
  if (pool.length === 0) throw new Error('biome pool is empty');
  const options = pool.filter((biome) => biome !== previous);
  const usable = options.length > 0 ? options : pool;
  return usable[rng.int(0, usable.length - 1)];
}

function previousBiomeOf(seed: string, mapIndex: number): BiomeId | undefined {
  return mapIndex <= 1 ? undefined : biomeForMap(seed, mapIndex - 1);
}

/**
 * The biome a map rolls. Walks the `map` stream from map 1, recovering each
 * previous map's biome, so it is a pure function of the seed and the map index
 * without building a whole plan (D11/D29).
 */
export function biomeForMap(seed: string, mapIndex: number): BiomeId {
  const index = Math.max(1, Math.floor(mapIndex));
  let previous: BiomeId | undefined;
  for (let current = 1; current <= index; current++) {
    previous = pickBiome(mapStreams(seed, current).map, previous, BIOME_ORDER);
  }
  return previous ?? BIOME_ORDER[0];
}

type Draft = Readonly<{ cells: Tile[]; links: MapLink[] }>;

/**
 * Grows `roomCount` rooms with the entry as a **single-door leaf** and a closed
 * cycle in the rest of the floor (`docs/maps-spec.md` §2/§3, O-M1).
 *
 * The entry room (id 0) joins the floor through exactly one door, so its only
 * exit is the way forward — never a second door. That door leads into a 2x2
 * **core** of four rooms closed into a 4-cycle, so the floor still holds its
 * guaranteed loop without ever giving the entry a second opening. Growth and
 * cycle-closing then only ever link rooms past the entry, so the single-door
 * guarantee survives the rest of the build. A floor therefore needs at least
 * five regular rooms (the entry leaf plus the four-room core); the tuning table
 * keeps the room count at or above that (`src/data/maps.ts`).
 */
function buildFloor(rng: Rng, roomCount: number, entryEdge: MapEdge): Draft {
  const cells: Tile[] = [{ x: 0, y: 0 }];
  const byCell = new Map<string, number>([[cellKey(cells[0]), 0]]);
  const blocked = new Set<string>([cellKey(step(cells[0], entryEdge))]);
  const links: MapLink[] = [];
  const linked = new Set<string>();

  const connect = (a: number, b: number): void => {
    const key = linkKey(a, b);
    if (linked.has(key)) return;
    linked.add(key);
    links.push(a < b ? [a, b] : [b, a]);
  };
  const place = (cell: Tile): number => {
    const id = cells.length;
    cells.push(cell);
    byCell.set(cellKey(cell), id);
    return id;
  };

  // The entry's single door points into the map (opposite the outward edge), and
  // opens onto a 2x2 core closed into a 4-cycle: A-B-D-C-A. The entry links only
  // to A, so its degree stays 1.
  const along = OPPOSITE_EDGE[entryEdge];
  const side = PERPENDICULAR[entryEdge][rng.int(0, 1)];
  const roomA = place(step(cells[0], along));
  const roomB = place(step(cells[roomA], side));
  const roomC = place(step(cells[roomA], along));
  const roomD = place(step(cells[roomC], side));
  connect(0, roomA);
  connect(roomA, roomB);
  connect(roomA, roomC);
  connect(roomB, roomD);
  connect(roomC, roomD);

  while (cells.length < roomCount) {
    const candidates: { room: number; cell: Tile }[] = [];
    // Never link the entry room again: it must keep its single door.
    for (let id = 1; id < cells.length; id++) {
      for (const edge of MAP_EDGES) {
        const cell = step(cells[id], edge);
        const key = cellKey(cell);
        if (byCell.has(key) || blocked.has(key)) continue;
        candidates.push({ room: id, cell });
      }
    }
    if (candidates.length === 0) break;
    const pick = candidates[rng.int(0, candidates.length - 1)];
    connect(pick.room, place(pick.cell));
  }

  const cycleCandidates: [number, number][] = [];
  // No cycle-closing door may touch the entry either, or it loses its single door.
  for (let id = 1; id < cells.length; id++) {
    for (const edge of MAP_EDGES) {
      const other = byCell.get(cellKey(step(cells[id], edge)));
      if (other === undefined || other <= id || linked.has(linkKey(id, other))) continue;
      cycleCandidates.push([id, other]);
    }
  }
  const extra = 1 + rng.int(0, MAX_EXTRA_DOORS);
  const doors = Math.min(extra, cycleCandidates.length);
  for (let i = 0; i < doors; i++) {
    const j = rng.int(i, cycleCandidates.length - 1);
    [cycleCandidates[i], cycleCandidates[j]] = [cycleCandidates[j], cycleCandidates[i]];
    connect(cycleCandidates[i][0], cycleCandidates[i][1]);
  }

  return { cells, links };
}

function shapeFor(edges: readonly MapEdge[]): MapRoomShape {
  switch (edges.length) {
    case 1:
      return 'dead-end';
    case 2:
      return OPPOSITE_EDGE[edges[0]] === edges[1] ? 'corridor' : 'bend';
    case 3:
      return 'tee';
    case 4:
      return 'cross';
    default:
      throw new Error(`a room has ${edges.length} openings`);
  }
}

/** BFS graph distance from the entry (id 0) to every room; disconnected reads -1. */
function distancesFrom(roomCount: number, links: readonly MapLink[]): number[] {
  const adjacency: number[][] = Array.from({ length: roomCount }, () => []);
  for (const [a, b] of links) {
    adjacency[a].push(b);
    adjacency[b].push(a);
  }

  const distance = new Array<number>(roomCount).fill(-1);
  distance[0] = 0;
  const queue: number[] = [0];
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    for (const next of adjacency[current]) {
      if (distance[next] >= 0) continue;
      distance[next] = distance[current] + 1;
      queue.push(next);
    }
  }
  return distance;
}

/** The room farthest from the entry by graph distance; ties go to the lower id. */
function farthestRoom(roomCount: number, links: readonly MapLink[]): number {
  const distance = distancesFrom(roomCount, links);
  let boss = 0;
  for (let id = 1; id < roomCount; id++) {
    if (distance[id] > distance[boss]) boss = id;
  }
  return boss;
}

/** The first free grid cell beside `parent` (in `MAP_EDGES` order), or null. */
function firstFreeCell(
  cells: readonly Tile[],
  byCell: ReadonlyMap<string, number>,
  blocked: ReadonlySet<string>,
  parent: number,
): Tile | null {
  for (const edge of MAP_EDGES) {
    const cell = step(cells[parent], edge);
    const key = cellKey(cell);
    if (!byCell.has(key) && !blocked.has(key)) return cell;
  }
  return null;
}

/**
 * Hangs a dead-end leaf off `parent` on its first free neighbouring cell, joining
 * the two. Returns the new room id, or `-1` when the parent is boxed in.
 */
function appendLeafAt(
  cells: Tile[],
  links: MapLink[],
  byCell: Map<string, number>,
  blocked: ReadonlySet<string>,
  parent: number,
): number {
  const cell = firstFreeCell(cells, byCell, blocked, parent);
  if (!cell) return -1;
  const id = cells.length;
  cells.push(cell);
  byCell.set(cellKey(cell), id);
  links.push(parent < id ? [parent, id] : [id, parent]);
  return id;
}

/**
 * Hangs the **boss room** off the regular graph as a dead-end **leaf**
 * (`docs/maps-spec.md` §2/§6): its only door is the link to its parent, so it has a
 * single exit before the portal opens, while the floor keeps its cycles. The parent
 * is the farthest regular room that still has a free neighbouring cell, so the leaf
 * becomes the farthest room. Returns the parent id, or `-1` when the grid leaves no
 * cell to hang a leaf (then the caller keeps the farthest regular room as the boss).
 */
function appendBoss(
  cells: Tile[],
  links: MapLink[],
  byCell: Map<string, number>,
  blocked: ReadonlySet<string>,
  regularCount: number,
): number {
  const distance = distancesFrom(regularCount, links);
  const order = Array.from({ length: regularCount }, (_, id) => id).sort(
    (a, b) => distance[b] - distance[a] || a - b,
  );
  for (const parent of order) {
    if (appendLeafAt(cells, links, byCell, blocked, parent) >= 0) return parent;
  }
  return -1;
}

/**
 * Rolls a floor's full plan: biome, room count, each room's width/height, the grid
 * topology (connected, closed into at least one cycle, no dangling opening), every
 * room's openings and shape, and the boss room. The boss is an extra dead-end leaf
 * so it always has a single exit. A pure function of `(seed, mapIndex)`
 * (`docs/maps-spec.md` §3, D29).
 */
export function planMap(seed: string, mapIndex: number): MapPlan {
  const index = Math.max(1, Math.floor(mapIndex));
  const tuning = mapTuning(index);
  const rng = mapStreams(seed, index).map;

  const biomeId = pickBiome(rng, previousBiomeOf(seed, index), BIOME_ORDER);
  const roomCount = rng.int(tuning.routes.min, tuning.routes.max);
  // The regular graph needs at least five rooms: the single-door entry leaf plus
  // the four-room core that closes the floor's cycle. The boss is an extra leaf on
  // top of it, so the floor holds `roomCount` rooms in total.
  const regularCount = Math.max(5, roomCount - 1);
  const sizes = Array.from({ length: regularCount + 1 }, () => ({
    width: rng.int(tuning.size.min, tuning.size.max),
    height: rng.int(tuning.size.min, tuning.size.max),
  }));
  const entryEdge = MAP_EDGES[rng.int(0, MAP_EDGES.length - 1)];

  const { cells, links } = buildFloor(rng, regularCount, entryEdge);
  const byCell = new Map<string, number>(cells.map((cell, id) => [cellKey(cell), id]));
  const blocked = new Set<string>([cellKey(step(cells[0], entryEdge))]);
  const hung = appendBoss(cells, links, byCell, blocked, regularCount);
  const bossRoom = hung >= 0 ? cells.length - 1 : farthestRoom(regularCount, links);

  // Special leaves, hung off the regular graph beyond the boss (`docs/maps-spec.md`
  // §7, D33). They are added last, so the regular rooms and the boss never move;
  // each is a `dead-end` leaf whose parent is a regular room that is **not** the
  // entry or the boss, so those two keep their single door.
  const specialKinds = new Map<number, MapRoomSpecial>();
  const fromEntry = distancesFrom(cells.length, links);
  const freeParents = (): number[] => {
    const ids: number[] = [];
    for (let id = 1; id < regularCount; id++) {
      // Never the boss, and never a room as far as (or farther than) the boss, so a
      // special leaf can never outrank the boss as the farthest room.
      if (id === bossRoom || fromEntry[id] >= fromEntry[bossRoom]) continue;
      if (firstFreeCell(cells, byCell, blocked, id)) ids.push(id);
    }
    return ids;
  };
  const addSpecial = (kind: MapRoomSpecial, parent: number): void => {
    const id = appendLeafAt(cells, links, byCell, blocked, parent);
    if (id < 0) return;
    specialKinds.set(id, kind);
    sizes[id] = {
      width: rng.int(tuning.size.min, tuning.size.max),
      height: rng.int(tuning.size.min, tuning.size.max),
    };
  };

  // The shop is guaranteed from map 2 on and sits near the entry: the nearest
  // regular room that still has a free cell is its parent. Map 1 hangs none
  // (the run's on-ramp has nothing to spend there).
  if (hangsShop(index)) {
    const shopParents = freeParents();
    if (shopParents.length > 0) {
      const nearest = shopParents.reduce((best, id) =>
        fromEntry[id] < fromEntry[best] || (fromEntry[id] === fromEntry[best] && id < best) ? id : best,
      );
      addSpecial('shop', nearest);
    }
  }

  // The mini-boss and the mega-stone roll their chance on the same stream; the
  // mega-stone only from map 3 on, and both may land on one floor (`O-M4`).
  if (rng.next() < MINI_BOSS_CHANCE) {
    const parents = freeParents();
    if (parents.length > 0) addSpecial('mini-boss', parents[rng.int(0, parents.length - 1)]);
  }
  if (index >= MEGA_STONE_FROM_MAP && rng.next() < MEGA_STONE_CHANCE) {
    const parents = freeParents();
    if (parents.length > 0) addSpecial('mega-stone', parents[rng.int(0, parents.length - 1)]);
  }
  // The casino rolls last on the same stream, so no floor's shop, mini-boss,
  // mega-stone or room size moves because of it (`docs/maps-spec.md` §7).
  if (index >= CASINO_FROM_MAP && rng.next() < CASINO_CHANCE) {
    const parents = freeParents();
    if (parents.length > 0) addSpecial('casino', parents[rng.int(0, parents.length - 1)]);
  }
  // The gated leaf rolls last, after every shipped draw, so no floor's shop,
  // mini-boss, mega-stone, casino, room id or size moves because of it. Map 3 is the
  // first floor whose party can plausibly hold the asked type, and it is where the
  // mega-stone leaf already starts; 20 % keeps every floor's trainer budget green.
  if (index >= GATED_FROM_MAP && rng.next() < GATED_CHANCE) {
    const parents = freeParents();
    if (parents.length > 0) addSpecial('gated', parents[rng.int(0, parents.length - 1)]);
  }

  // The entry and boss rooms are the floor's quiet leaves; both are pinned to the
  // minimum size so they read the same whatever range the map rolls
  // (`docs/maps-spec.md` §1/§6).
  for (const leaf of [0, bossRoom]) {
    sizes[leaf] = { width: MAP_MIN_ROOM_SIZE, height: MAP_MIN_ROOM_SIZE };
  }

  const rooms: MapRoom[] = cells.map((cell, id) => {
    const edges: MapEdge[] = [];
    for (const [a, b] of links) {
      if (a === id) edges.push(edgeBetween(cells[a], cells[b]));
      else if (b === id) edges.push(edgeBetween(cells[b], cells[a]));
    }
    if (id === 0) edges.push(entryEdge);
    edges.sort((a, b) => MAP_EDGES.indexOf(a) - MAP_EDGES.indexOf(b));
    const openings: MapOpening[] = edges.map((edge) => ({
      edge,
      kind: id === 0 && edge === entryEdge ? 'entry' : 'link',
    }));
    return {
      id,
      col: cell.x,
      row: cell.y,
      width: sizes[id].width,
      height: sizes[id].height,
      shape: shapeFor(edges),
      openings,
      special: specialKinds.get(id) ?? null,
    };
  });

  const orderedLinks = [...links].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const specials: MapSpecialRoom[] = [...specialKinds.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([roomId, kind]) => ({ roomId, kind }));

  return {
    seed,
    mapIndex: index,
    biomeId,
    rooms,
    links: orderedLinks,
    entryRoom: 0,
    entryEdge,
    bossRoom,
    specials,
  };
}

/** The room occupying a grid cell, if any. */
export function roomAt(plan: MapPlan, col: number, row: number): MapRoom | undefined {
  return plan.rooms.find((room) => room.col === col && room.row === row);
}

/** The id of the room holding a `kind` special, or undefined when the floor has none. */
export function specialRoom(plan: MapPlan, kind: MapRoomSpecial): number | undefined {
  return plan.rooms.find((room) => room.special === kind)?.id;
}

/**
 * The room a `link` opening on `edge` of `roomId` joins, or `undefined` when that
 * edge is the entry (or a plain wall). Backs the "no dangling opening" check.
 */
export function linkedNeighbour(plan: MapPlan, roomId: number, edge: MapEdge): number | undefined {
  const room = plan.rooms[roomId];
  if (!room) return undefined;
  const target = step({ x: room.col, y: room.row }, edge);
  const other = roomAt(plan, target.x, target.y);
  if (!other) return undefined;
  const joined = plan.links.some(
    ([a, b]) => (a === roomId && b === other.id) || (b === roomId && a === other.id),
  );
  return joined ? other.id : undefined;
}

/**
 * The edge a room's player arrives through (`docs/maps-spec.md` §2): the entry
 * room opens on `entryEdge`, any other room is entered from the neighbour on the
 * shortest path back to the entry, through that neighbour's **opposite** link
 * (leave East → enter West). Pure and deterministic.
 */
export function arrivalEdgeFor(plan: MapPlan, roomId: number): MapEdge {
  if (roomId === plan.entryRoom) return plan.entryEdge;
  const seen = new Set<number>([plan.entryRoom]);
  const queue: number[] = [plan.entryRoom];
  for (let head = 0; head < queue.length; head++) {
    const id = queue[head];
    for (const edge of MAP_EDGES) {
      const next = linkedNeighbour(plan, id, edge);
      if (next === undefined || seen.has(next)) continue;
      if (next === roomId) return OPPOSITE_EDGE[edge];
      seen.add(next);
      queue.push(next);
    }
  }
  return plan.entryEdge;
}

/**
 * True when `edge` is a door a player can actually arrive through: the entry
 * room's outward edge or any linked neighbour edge of any room. Guards the
 * arrival edge a scene or a save hands to `roomView`, so a stale or hand-edited
 * value falls back to `arrivalEdgeFor` instead of opening a wall onto nothing.
 */
export function isArrivalEdge(plan: MapPlan, roomId: number, edge: MapEdge | undefined): boolean {
  if (edge === undefined) return false;
  if (roomId === plan.entryRoom && edge === plan.entryEdge) return true;
  return linkedNeighbour(plan, roomId, edge) !== undefined;
}

/**
 * The edges of a room with **no link** and that are not the arrival edge: the
 * walls a portal may open onto. A boss room always has at least one (the floor
 * graph leaves a leaf's walls free), so the map can always gate its exit.
 */
export function freeEdges(plan: MapPlan, roomId: number): MapEdge[] {
  const arrival = arrivalEdgeFor(plan, roomId);
  return MAP_EDGES.filter(
    (edge) => edge !== arrival && linkedNeighbour(plan, roomId, edge) === undefined,
  );
}
