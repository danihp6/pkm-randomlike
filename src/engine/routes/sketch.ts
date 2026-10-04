import type { Tile } from '../grid';
import {
  EXIT,
  FLOOR,
  LEDGE,
  TALL_GRASS,
  WALL,
  WATER,
  isWalkable,
  type TileMap,
} from '../map';
import { Rng } from '../rng';
import { tileKey, type RouteMap } from './routeMap';
import {
  DEFAULT_LAYOUT,
  DEFAULT_SHAPE,
  LAYOUTS,
  SHAPES,
  entryIndex,
  type AccessEdge,
  type LayoutSpec,
  type LayoutStyle,
  type RouteShape,
  type ShapeSpec,
} from './layout';
import { routeStreams, type RouteStreams } from './streams';
import { validateRoute } from './validate';

export const ROUTE_WIDTH = 56;
export const ROUTE_HEIGHT = 32;

const MAX_ATTEMPTS = 8;

const CARDINALS: readonly Tile[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export type RouteRequest = Readonly<{
  seed: string;
  routeIndex: number;
  biomeId: string;
  /** Carver style (open | hedges | maze); defaults to the open forest. */
  layout?: LayoutStyle;
  /** Route geometry; defaults to a `straight` route until the shape carve lands. */
  shape?: RouteShape;
  width?: number;
  height?: number;
  grassPatches?: number;
  waterBodies?: number;
  ledges?: number;
}>;

type MutableMap = number[][];

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** A jittered opening tile inside the one-tile border, on `edge`. */
function edgeTile(edge: AccessEdge, rng: Rng, width: number, height: number): Tile {
  switch (edge) {
    case 'W':
      return { x: 1, y: rng.int(3, height - 4) };
    case 'E':
      return { x: width - 2, y: rng.int(3, height - 4) };
    case 'N':
      return { x: rng.int(3, width - 4), y: 1 };
    case 'S':
      return { x: rng.int(3, width - 4), y: height - 2 };
  }
}

/**
 * The edges of the shape's **primary** link: the entry opening and the opening
 * the guaranteed path joins it to first. A `cross` declares more openings, but
 * only this pair is placed until the shape carve lands (Phase 2 step 3).
 */
function primaryEdges(shape: ShapeSpec): Readonly<{ entry: AccessEdge; exit: AccessEdge }> {
  const entry = entryIndex(shape);
  const link = shape.links.find((pair) => pair.includes(entry)) ?? shape.links[0];
  const exit = link[0] === entry ? link[1] : link[0];
  return { entry: shape.openings[entry].edge, exit: shape.openings[exit].edge };
}

function setFloor(tiles: MutableMap, x: number, y: number): void {
  const width = tiles[0].length;
  const height = tiles.length;
  if (x < 1 || x >= width - 1 || y < 1 || y >= height - 1) return;
  tiles[y][x] = FLOOR;
}

/**
 * Carves a `size`-wide square of floor anchored at `(x, y)`, never touching the
 * one-tile border so the route stays fenced. Returns the tiles it opened.
 */
function carveSquare(tiles: MutableMap, x: number, y: number, size: number): Tile[] {
  const opened: Tile[] = [];
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      const tx = x + dx;
      const ty = y + dy;
      if (tx < 1 || tx >= tiles[0].length - 1 || ty < 1 || ty >= tiles.length - 1) continue;
      tiles[ty][tx] = FLOOR;
      opened.push({ x: tx, y: ty });
    }
  }
  return opened;
}

/** Manhattan corridor between two tiles, one elbow, carved `size` wide. */
function carveLine(
  tiles: MutableMap,
  spine: Set<string>,
  from: Tile,
  to: Tile,
  size: number,
  horizontalFirst: boolean,
): void {
  let current = { ...from };
  const carveAt = (tile: Tile): void => {
    for (const opened of carveSquare(tiles, tile.x, tile.y, size)) spine.add(tileKey(opened));
  };
  carveAt(current);
  const moveX = (): void => {
    while (current.x !== to.x) {
      current = { ...current, x: current.x + Math.sign(to.x - current.x) };
      carveAt(current);
    }
  };
  const moveY = (): void => {
    while (current.y !== to.y) {
      current = { ...current, y: current.y + Math.sign(to.y - current.y) };
      carveAt(current);
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

/**
 * The guaranteed start-to-exit path: jittered waypoints along the start-exit
 * axis joined by elbow corridors. Its tiles land in `spine`, so the bars and the
 * solid terrain passes never block them.
 */
function carveSpine(
  tiles: MutableMap,
  spine: Set<string>,
  rng: Rng,
  shape: ShapeSpec,
  start: Tile,
  exit: Tile,
): void {
  const height = tiles.length;
  const horizontal = Math.abs(exit.x - start.x) >= Math.abs(exit.y - start.y);
  const segments = 4;
  const waypoints: Tile[] = [start];
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const baseX = Math.round(start.x + (exit.x - start.x) * t);
    const baseY = Math.round(start.y + (exit.y - start.y) * t);
    const jitter = rng.int(-shape.jitter, shape.jitter);
    waypoints.push(
      horizontal
        ? { x: baseX, y: clamp(baseY + jitter, 2, height - 3) }
        : { x: clamp(baseX + jitter, 2, tiles[0].length - 3), y: baseY },
    );
  }
  waypoints.push(exit);
  for (let i = 0; i + 1 < waypoints.length; i++) {
    carveLine(tiles, spine, waypoints[i], waypoints[i + 1], shape.pathWidth, rng.next() < 0.5);
  }
}

/**
 * The open field: the interior is plain ground with the one-tile border left as
 * the only wall, so a route is a clear room to cross.
 */
function carveOpen(tiles: MutableMap): void {
  const width = tiles[0].length;
  const height = tiles.length;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) tiles[y][x] = FLOOR;
  }
}

/**
 * The open-field route (Route 1): the interior starts as floor, a winding path
 * is kept clear and tree bars are dropped from the borders inwards, so the map
 * stays mostly walkable and the hedges partition it without sealing it.
 */
function carveHedges(
  tiles: MutableMap,
  rng: Rng,
  spec: LayoutSpec,
  shape: ShapeSpec,
  start: Tile,
  exit: Tile,
): Set<string> {
  const width = tiles[0].length;
  const height = tiles.length;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) tiles[y][x] = FLOOR;
  }

  const path = new Set<string>();
  carveSpine(tiles, path, rng, shape, start, exit);
  const protect = new Set(path);
  protect.add(tileKey(start));
  protect.add(tileKey(exit));
  const clear = (x: number, y: number): boolean =>
    x >= 1 && x < width - 1 && y >= 1 && y < height - 1 && !protect.has(tileKey({ x, y }));

  for (let bar = 0; bar < spec.bars; bar++) {
    const length = rng.int(spec.barMin, spec.barMax);
    if (rng.next() < 0.65) {
      const y = rng.int(2, height - 3);
      const x0 = rng.next() < 0.5 ? 1 : Math.max(1, width - 1 - length);
      for (let x = x0; x < x0 + length; x++) if (clear(x, y)) tiles[y][x] = WALL;
    } else {
      const x = rng.int(2, width - 3);
      const y0 = rng.next() < 0.5 ? 1 : Math.max(1, height - 1 - length);
      for (let y = y0; y < y0 + length; y++) if (clear(x, y)) tiles[y][x] = WALL;
    }
  }
  return path;
}

/**
 * The labyrinth (Viridian Forest, Mt. Moon): a rectangular grid of corridor
 * cells joined by a depth-first maze, `corridorWidth` wide. A braid step knocks
 * some walls back out so the result is a forest with loops, not a perfect maze.
 */
function carveMaze(
  tiles: MutableMap,
  rng: Rng,
  spec: LayoutSpec,
): Readonly<{ start: Tile; exit: Tile }> {
  const width = tiles[0].length;
  const height = tiles.length;
  const cw = spec.corridorWidth;
  const pitch = cw + 1;
  const cols = Math.floor((width - 2 - cw) / pitch) + 1;
  const rows = Math.floor((height - 2 - cw) / pitch) + 1;
  const cellX = (i: number): number => 1 + i * pitch;
  const cellY = (j: number): number => 1 + j * pitch;

  const carveCell = (i: number, j: number): void => {
    carveSquare(tiles, cellX(i), cellY(j), cw);
  };
  const connect = (i: number, j: number, ni: number, nj: number): void => {
    if (ni < 0 || ni >= cols || nj < 0 || nj >= rows) return;
    if (nj === j) {
      const x = Math.min(cellX(i), cellX(ni)) + cw;
      for (let y = cellY(j); y < cellY(j) + cw; y++) setFloor(tiles, x, y);
    } else {
      const y = Math.min(cellY(j), cellY(nj)) + cw;
      for (let x = cellX(i); x < cellX(i) + cw; x++) setFloor(tiles, x, y);
    }
    carveCell(ni, nj);
  };

  const visited = Array.from({ length: rows }, () => new Array<boolean>(cols).fill(false));
  const seedI = rng.int(0, cols - 1);
  const seedJ = rng.int(0, rows - 1);
  visited[seedJ][seedI] = true;
  carveCell(seedI, seedJ);
  const stack: [number, number][] = [[seedI, seedJ]];
  while (stack.length > 0) {
    const [i, j] = stack[stack.length - 1];
    const neighbours: [number, number][] = [];
    if (i + 1 < cols && !visited[j][i + 1]) neighbours.push([i + 1, j]);
    if (i - 1 >= 0 && !visited[j][i - 1]) neighbours.push([i - 1, j]);
    if (j + 1 < rows && !visited[j + 1][i]) neighbours.push([i, j + 1]);
    if (j - 1 >= 0 && !visited[j - 1][i]) neighbours.push([i, j - 1]);
    if (neighbours.length === 0) {
      stack.pop();
      continue;
    }
    const [ni, nj] = neighbours[rng.int(0, neighbours.length - 1)];
    connect(i, j, ni, nj);
    visited[nj][ni] = true;
    stack.push([ni, nj]);
  }

  const loops = Math.round(cols * rows * spec.braid);
  for (let loop = 0; loop < loops; loop++) {
    const i = rng.int(0, cols - 1);
    const j = rng.int(0, rows - 1);
    const dir = CARDINALS[rng.int(0, CARDINALS.length - 1)];
    connect(i, j, i + dir.x, j + dir.y);
  }

  // Enter from the bottom row of cells, leave from the top row, each with a
  // short channel to the border so the player arrives where the last route left.
  const startI = rng.int(0, cols - 1);
  const exitI = rng.int(0, cols - 1);
  const startX = cellX(startI);
  for (let y = cellY(rows - 1); y <= height - 2; y++) carveSquare(tiles, startX, y, cw);
  const exitX = cellX(exitI);
  for (let y = 1; y <= cellY(0); y++) carveSquare(tiles, exitX, y, cw);
  return { start: { x: startX, y: height - 2 }, exit: { x: exitX, y: 1 } };
}

/** Shortest cardinal path start→exit as tile keys, so hazards never seal it. */
function shortestPath(tiles: TileMap, from: Tile, to: Tile): Set<string> {
  const prev = new Map<string, string | null>();
  prev.set(tileKey(from), null);
  const queue: Tile[] = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.x === to.x && current.y === to.y) break;
    for (const dir of CARDINALS) {
      const next = { x: current.x + dir.x, y: current.y + dir.y };
      const key = tileKey(next);
      if (prev.has(key) || !isWalkable(tiles, next)) continue;
      prev.set(key, tileKey(current));
      queue.push(next);
    }
  }
  const path = new Set<string>();
  if (!prev.has(tileKey(to))) return path;
  let key: string | null | undefined = tileKey(to);
  while (key) {
    path.add(key);
    key = prev.get(key);
  }
  return path;
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
      const next: Tile[] = CARDINALS.map((dir) => ({ x: current.x + dir.x, y: current.y + dir.y })).filter(
        (tile) => inBounds(tiles, tile) && tiles[tile.y][tile.x] === FLOOR,
      );
      if (next.length === 0) break;
      current = next[rng.int(0, next.length - 1)];
    }
  }
}

/**
 * A ledge is a horizontal run of rock you may only jump down; it is solid from
 * every other side, so it is kept off the guaranteed path and re-validated.
 */
function carveLedges(tiles: MutableMap, rng: Rng, pool: readonly Tile[], count: number): void {
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

function attemptRoute(
  request: RouteRequest,
  streams: RouteStreams,
  width: number,
  height: number,
): RouteMap {
  const spec = LAYOUTS[request.layout ?? DEFAULT_LAYOUT];
  const shapeKey = request.shape ?? DEFAULT_SHAPE;
  const shape = SHAPES[shapeKey];
  const tiles: MutableMap = Array.from({ length: height }, () => new Array<number>(width).fill(WALL));
  const edges = primaryEdges(shape);
  let entry: Tile = edgeTile(edges.entry, streams.layout, width, height);
  let exit: Tile = edgeTile(edges.exit, streams.layout, width, height);

  let carved = new Set<string>();
  if (spec.kind === 'open') {
    carveOpen(tiles);
  } else if (spec.kind === 'hedges') {
    carved = carveHedges(tiles, streams.layout, spec, shape, entry, exit);
  } else {
    const ends = carveMaze(tiles, streams.layout, spec);
    entry = ends.start;
    exit = ends.exit;
  }

  tiles[entry.y][entry.x] = FLOOR;
  tiles[exit.y][exit.x] = EXIT;

  // Hazards (water, ledges) are solid, so they stay off the guaranteed path -
  // the carved spine on a hedged route, the shortest path on an open one.
  const spine = spec.kind === 'hedges' ? carved : shortestPath(tiles, entry, exit);
  const pocketTiles = collectFloorTiles(tiles).filter((tile) => !spine.has(tileKey(tile)));
  carveGrass(tiles, streams.terrain, request.grassPatches ?? 0, [entry, exit]);
  carveWater(tiles, streams.terrain, pocketTiles, request.waterBodies ?? 0, [entry, exit]);
  carveLedges(tiles, streams.terrain, pocketTiles, request.ledges ?? 0);

  tiles[entry.y][entry.x] = FLOOR;
  tiles[exit.y][exit.x] = EXIT;

  return {
    seed: request.seed,
    routeIndex: request.routeIndex,
    biomeId: request.biomeId,
    shape: shapeKey,
    width,
    height,
    tiles,
    entry,
    exits: [exit],
  };
}

/**
 * Generates one route from `(seed, routeIndex)`. Each build pass draws from its
 * own RNG stream, derived from `(seed, routeIndex, attempt)`; a map that fails
 * validation is rerolled on fresh streams, so the result is still a pure function
 * of the seed and index and a reroll never shifts an earlier attempt (D11).
 */
export function sketchRoute(request: RouteRequest): RouteMap {
  const width = request.width ?? ROUTE_WIDTH;
  const height = request.height ?? ROUTE_HEIGHT;
  let last: RouteMap | undefined;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const streams = routeStreams(request.seed, request.routeIndex, attempt);
    last = attemptRoute(request, streams, width, height);
    if (validateRoute(last).ok) return last;
  }
  throw new Error(`Could not generate a valid route for "${request.seed}" #${request.routeIndex}`);
}
