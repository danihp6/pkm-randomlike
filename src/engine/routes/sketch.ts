import type { LootEntry } from '../../data/loot';
import type { Tile } from '../grid';
import { EXIT, FLOOR, LEDGE, TALL_GRASS, WALL, WATER, tileAt, type TileMap } from '../map';
import { Rng, hashSeed } from '../rng';
import {
  FACINGS,
  tileKey,
  type Facing,
  type RouteItem,
  type RouteMap,
  type RouteTrainer,
} from './routeMap';
import { pickWeighted } from './encounters';
import { reachableTiles, validateRoute } from './validate';

export const ROUTE_WIDTH = 24;
export const ROUTE_HEIGHT = 16;
export const ROUTE_SIGHT_RANGE = 3;

const MAX_ATTEMPTS = 8;
const DEFAULT_FLOOR_ITEMS: readonly string[] = ['potion', 'pokeball'];

export type RouteRequest = Readonly<{
  seed: string;
  routeIndex: number;
  biomeId: string;
  trainerArchetypeIds: readonly string[];
  trainerCount: number;
  itemCount: number;
  width?: number;
  height?: number;
  grassPatches?: number;
  waterBodies?: number;
  ledges?: number;
  sightRange?: number;
  itemIds?: readonly string[];
  /**
   * Weighted ground-item pool. When set it replaces `itemIds`, so the band's
   * loot table (with better items in later bands) drives what a route holds.
   */
  loot?: readonly LootEntry[];
}>;

type MutableMap = number[][];

function carve(tiles: MutableMap, tile: Tile): void {
  tiles[tile.y][tile.x] = FLOOR;
}

function inBounds(tiles: TileMap, tile: Tile): boolean {
  return tile.y >= 0 && tile.y < tiles.length && tile.x >= 0 && tile.x < tiles[0].length;
}

function collectFloorTiles(tiles: TileMap): Tile[] {
  const floors: Tile[] = [];
  for (let y = 0; y < tiles.length; y++) {
    for (let x = 0; x < tiles[y].length; x++) {
      if (tiles[y][x] === FLOOR) floors.push({ x, y });
    }
  }
  return floors;
}

function parseKey(key: string): Tile {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

function distance(a: Tile, b: Tile): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** A biased random walk from start to exit; every carved tile stays walkable. */
function carveMainPath(
  tiles: MutableMap,
  corridor: Set<string>,
  rng: Rng,
  start: Tile,
  exit: Tile,
): void {
  const width = tiles[0].length;
  const height = tiles.length;
  const detours: readonly Tile[] = [
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
  ];
  let current = start;
  let guard = 0;
  while ((current.x !== exit.x || current.y !== exit.y) && guard++ < 10000) {
    const options: Tile[] = [];
    if (current.x < exit.x) options.push({ x: 1, y: 0 });
    if (current.x > exit.x) options.push({ x: -1, y: 0 });
    if (current.y < exit.y) options.push({ x: 0, y: 1 });
    if (current.y > exit.y) options.push({ x: 0, y: -1 });
    if (rng.next() < 0.25) options.push(detours[rng.int(0, detours.length - 1)]);
    const dir = options[rng.int(0, options.length - 1)];
    current = {
      x: Math.min(width - 2, Math.max(1, current.x + dir.x)),
      y: Math.min(height - 2, Math.max(1, current.y + dir.y)),
    };
    carve(tiles, current);
    corridor.add(tileKey(current));
  }
}

function carveCorridor(
  tiles: MutableMap,
  corridor: Set<string>,
  from: Tile,
  to: Tile,
  horizontalFirst: boolean,
): void {
  const current = { ...from };
  const stepX = Math.sign(to.x - from.x);
  const stepY = Math.sign(to.y - from.y);
  const moveX = (): void => {
    while (current.x !== to.x) {
      current.x += stepX;
      carve(tiles, current);
      corridor.add(tileKey(current));
    }
  };
  const moveY = (): void => {
    while (current.y !== to.y) {
      current.y += stepY;
      carve(tiles, current);
      corridor.add(tileKey(current));
    }
  };
  if (horizontalFirst) {
    moveX();
    moveY();
  } else {
    moveY();
    moveX();
  }
}

function carveRooms(tiles: MutableMap, corridor: Set<string>, rng: Rng): void {
  const width = tiles[0].length;
  const height = tiles.length;
  const rooms = rng.int(4, 6);
  for (let room = 0; room < rooms; room++) {
    const existing = collectFloorTiles(tiles);
    const roomWidth = rng.int(4, Math.max(4, Math.min(7, width - 4)));
    const roomHeight = rng.int(3, Math.max(3, Math.min(5, height - 4)));
    const originX = rng.int(2, Math.max(2, width - 2 - roomWidth));
    const originY = rng.int(2, Math.max(2, height - 2 - roomHeight));
    for (let y = originY; y < originY + roomHeight; y++) {
      for (let x = originX; x < originX + roomWidth; x++) carve(tiles, { x, y });
    }
    const centre = { x: originX + (roomWidth >> 1), y: originY + (roomHeight >> 1) };
    // Connect to the network that existed before this room, so a room can never
    // "connect" only to itself and float away.
    const target = existing[rng.int(0, existing.length - 1)];
    carveCorridor(tiles, corridor, centre, target, (centre.x + centre.y) % 2 === 0);
  }
}

function carveGrass(tiles: MutableMap, rng: Rng, patches: number, avoid: readonly Tile[]): void {
  const avoidKeys = new Set(avoid.map(tileKey));
  for (let patch = 0; patch < patches; patch++) {
    const floors = collectFloorTiles(tiles).filter((tile) => !avoidKeys.has(tileKey(tile)));
    if (floors.length === 0) break;
    const seed = floors[rng.int(0, floors.length - 1)];
    const patchWidth = rng.int(2, 4);
    const patchHeight = rng.int(2, 3);
    for (let y = seed.y; y < seed.y + patchHeight; y++) {
      for (let x = seed.x; x < seed.x + patchWidth; x++) {
        if (inBounds(tiles, { x, y }) && tiles[y][x] === FLOOR) tiles[y][x] = TALL_GRASS;
      }
    }
  }
}

function carveWater(
  tiles: MutableMap,
  rng: Rng,
  pool: readonly Tile[],
  bodies: number,
  avoid: readonly Tile[],
): void {
  const avoidKeys = new Set(avoid.map(tileKey));
  for (let body = 0; body < bodies; body++) {
    const candidates = pool.filter(
      (tile) => tiles[tile.y][tile.x] === FLOOR && !avoidKeys.has(tileKey(tile)),
    );
    if (candidates.length < 4) break;
    let current = candidates[rng.int(0, candidates.length - 1)];
    const size = rng.int(3, 5);
    for (let step = 0; step < size; step++) {
      if (tiles[current.y][current.x] === FLOOR) tiles[current.y][current.x] = WATER;
      const next: Tile[] = [
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1 },
        { x: current.x, y: current.y - 1 },
      ].filter((tile) => inBounds(tiles, tile) && tiles[tile.y][tile.x] === FLOOR);
      if (next.length === 0) break;
      current = next[rng.int(0, next.length - 1)];
    }
  }
}

function carveLedges(
  tiles: MutableMap,
  rng: Rng,
  pool: readonly Tile[],
  count: number,
): void {
  const isFloor = (tile: Tile): boolean =>
    inBounds(tiles, tile) && tiles[tile.y][tile.x] === FLOOR;
  for (let line = 0; line < count; line++) {
    const candidates = pool.filter(
      (tile) =>
        isFloor(tile) &&
        isFloor({ x: tile.x, y: tile.y - 1 }) &&
        isFloor({ x: tile.x, y: tile.y + 1 }),
    );
    if (candidates.length === 0) break;
    const origin = candidates[rng.int(0, candidates.length - 1)];
    const length = rng.int(2, 3);
    for (let dx = 0; dx < length; dx++) {
      const tile = { x: origin.x + dx, y: origin.y };
      if (
        isFloor(tile) &&
        isFloor({ x: tile.x, y: tile.y - 1 }) &&
        isFloor({ x: tile.x, y: tile.y + 1 })
      ) {
        tiles[tile.y][tile.x] = LEDGE;
      }
    }
  }
}

function pickFacing(tiles: TileMap, position: Tile, rng: Rng): Facing | undefined {
  const order = [...FACINGS];
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const swap = order[i];
    order[i] = order[j];
    order[j] = swap;
  }
  const vectors: Record<Facing, Tile> = {
    N: { x: 0, y: -1 },
    E: { x: 1, y: 0 },
    S: { x: 0, y: 1 },
    W: { x: -1, y: 0 },
  };
  for (const facing of order) {
    const ahead = { x: position.x + vectors[facing].x, y: position.y + vectors[facing].y };
    const value = tileAt(tiles, ahead);
    if (value === FLOOR || value === TALL_GRASS) return facing;
  }
  return undefined;
}

function attemptRoute(
  request: RouteRequest,
  rng: Rng,
  width: number,
  height: number,
): RouteMap {
  const tiles: MutableMap = Array.from({ length: height }, () => new Array<number>(width).fill(WALL));
  const corridor = new Set<string>();
  const start: Tile = { x: 1, y: rng.int(2, height - 3) };
  const exit: Tile = { x: width - 2, y: rng.int(2, height - 3) };
  carve(tiles, start);
  corridor.add(tileKey(start));

  carveMainPath(tiles, corridor, rng, start, exit);
  carveRooms(tiles, corridor, rng);

  const roomTiles = collectFloorTiles(tiles).filter((tile) => !corridor.has(tileKey(tile)));
  carveGrass(tiles, rng, request.grassPatches ?? 3, [start, exit]);
  carveWater(tiles, rng, roomTiles, request.waterBodies ?? 1, [start, exit]);
  carveLedges(tiles, rng, roomTiles, request.ledges ?? 2);

  tiles[start.y][start.x] = FLOOR;
  tiles[exit.y][exit.x] = EXIT;

  const reached = reachableTiles(tiles, start);
  const occupied = new Set<string>([tileKey(start), tileKey(exit)]);
  const slotTiles = [...reached]
    .map(parseKey)
    .filter(
      (tile) =>
        (tileAt(tiles, tile) === FLOOR || tileAt(tiles, tile) === TALL_GRASS) &&
        distance(tile, start) >= 3 &&
        !occupied.has(tileKey(tile)),
    );

  const sightRange = request.sightRange ?? ROUTE_SIGHT_RANGE;
  const archetypes = request.trainerArchetypeIds;
  const trainers: RouteTrainer[] = [];
  for (let i = 0; i < request.trainerCount && slotTiles.length > 0; i++) {
    const index = rng.int(0, slotTiles.length - 1);
    const [position] = slotTiles.splice(index, 1);
    const facing = pickFacing(tiles, position, rng);
    if (!facing) continue;
    trainers.push({
      id: `trainer-${request.routeIndex}-${i}`,
      position,
      facing,
      sight: sightRange,
      archetypeId: archetypes[rng.int(0, archetypes.length - 1)],
    });
  }

  const itemIds = request.itemIds ?? DEFAULT_FLOOR_ITEMS;
  const items: RouteItem[] = [];
  for (let i = 0; i < request.itemCount && slotTiles.length > 0; i++) {
    const index = rng.int(0, slotTiles.length - 1);
    const [position] = slotTiles.splice(index, 1);
    const itemId =
      request.loot && request.loot.length > 0
        ? pickWeighted(request.loot, rng).itemId
        : itemIds[rng.int(0, itemIds.length - 1)];
    items.push({
      id: `item-${request.routeIndex}-${i}`,
      position,
      itemId,
    });
  }

  return {
    seed: request.seed,
    routeIndex: request.routeIndex,
    biomeId: request.biomeId,
    width,
    height,
    tiles,
    start,
    exit,
    trainers,
    items,
  };
}

/**
 * Generates one route from `(seed, routeIndex)`. The whole pipeline - frame,
 * terrain, population, validation - runs off a single `Rng`; a map that fails
 * validation is rerolled on the same stream, so the result is still a pure
 * function of the seed and index (D11).
 */
export function sketchRoute(request: RouteRequest): RouteMap {
  const width = request.width ?? ROUTE_WIDTH;
  const height = request.height ?? ROUTE_HEIGHT;
  const rng = new Rng(hashSeed(`${request.seed}:route:${request.routeIndex}`));
  let last: RouteMap | undefined;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    last = attemptRoute(request, rng, width, height);
    if (validateRoute(last).ok) return last;
  }
  throw new Error(
    `Could not generate a valid route for "${request.seed}" #${request.routeIndex}`,
  );
}
