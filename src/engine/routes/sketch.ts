import type { Tile } from '../grid';
import {
  FLOOR,
  LEDGE,
  TALL_GRASS,
  WALL,
  isWalkable,
  type TileMap,
} from '../map';
import { findPath } from '../pathfinding';
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

export const ROUTE_WIDTH = 20;
export const ROUTE_HEIGHT = 20;

const MAX_ATTEMPTS = 8;

/** Waypoints carved per shape link: the interior points the corridor bends through. */
const SPINE_SEGMENTS = 4;
/** Ceiling of the deterministic per-cell cost that makes the guaranteed path meander. */
const COST_NOISE = 4;

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
  ledges?: number;
}>;

type MutableMap = number[][];

/** A labelled snapshot of the map after one build phase, for the debug stepper. */
export type RouteStep = Readonly<{
  phase: 'walls' | 'access' | 'spine' | 'branches' | 'layout' | 'terrain' | 'final';
  label: string;
  tiles: TileMap;
}>;

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

/** A jittered opening tile on the map border itself, punching a gap in the tree ring. */
function edgeTile(edge: AccessEdge, rng: Rng, width: number, height: number): Tile {
  switch (edge) {
    case 'W':
      return { x: 0, y: rng.int(3, height - 4) };
    case 'E':
      return { x: width - 1, y: rng.int(3, height - 4) };
    case 'N':
      return { x: rng.int(3, width - 4), y: 0 };
    case 'S':
      return { x: rng.int(3, width - 4), y: height - 1 };
  }
}

/**
 * The edges of the shape's **primary** link, used by the parked `hedges` carver
 * (a live shapeless carve). The open flow places every opening instead
 * (`placeAccess` + `carveGuaranteedPath`).
 */
function primaryEdges(shape: ShapeSpec): Readonly<{ entry: AccessEdge; exit: AccessEdge }> {
  const entry = entryIndex(shape);
  const link = shape.links.find((pair) => pair.includes(entry)) ?? shape.links[0];
  const exit = link[0] === entry ? link[1] : link[0];
  return { entry: shape.openings[entry].edge, exit: shape.openings[exit].edge };
}

function keyToTile(key: string): Tile {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

/** Places every opening of `shape` on its edge; returns the tiles by opening index. */
function placeAccess(
  tiles: MutableMap,
  shape: ShapeSpec,
  rng: Rng,
  width: number,
  height: number,
): Tile[] {
  return shape.openings.map((opening) => {
    const tile = edgeTile(opening.edge, rng, width, height);
    tiles[tile.y][tile.x] = FLOOR;
    return tile;
  });
}

/** The opening tiles whose role is `exit`, in opening order. */
function exitTiles(shape: ShapeSpec, openings: readonly Tile[]): Tile[] {
  return shape.openings
    .map((opening, index) => ({ opening, index }))
    .filter(({ opening }) => opening.role === 'exit')
    .map(({ index }) => openings[index]);
}

/** A deterministic per-cell cost in `[1, COST_NOISE]`, drawn once per route. */
function noiseCostField(rng: Rng, width: number, height: number): readonly number[] {
  const field = new Array<number>(width * height);
  for (let i = 0; i < field.length; i++) field[i] = rng.int(1, COST_NOISE);
  return field;
}

/**
 * The guaranteed lane: each `link` is joined by jittered waypoints, and each pair
 * is connected by a cardinal A* corridor that follows a per-cell cost field so it
 * meanders. Every carved tile lands in the returned spine, which the hazard
 * passes must never block; `carveSquare` keeps the lane off the border.
 */
function carveGuaranteedPath(
  tiles: MutableMap,
  rng: Rng,
  shape: ShapeSpec,
  openings: readonly Tile[],
  width: number,
  height: number,
): Set<string> {
  const spine = new Set<string>();
  const costs = noiseCostField(rng, width, height);
  // Carve through the solid interior, but the openings on the border are enterable.
  const openingKeys = new Set(openings.map(tileKey));
  const passable = (tile: Tile): boolean =>
    openingKeys.has(tileKey(tile)) ||
    (tile.x >= 1 && tile.x < width - 1 && tile.y >= 1 && tile.y < height - 1);
  const carveAt = (tile: Tile): void => {
    // The anchor itself counts as lane even on the border (the openings sit there).
    spine.add(tileKey(tile));
    for (const opened of carveSquare(tiles, tile.x, tile.y, shape.pathWidth)) {
      spine.add(tileKey(opened));
    }
  };

  // When a shape has more than one link (the `cross`), every link must pass
  // through the same central hub, so the lanes are guaranteed to meet instead of
  // relying on the jittered corridors happening to cross.
  const hub =
    shape.links.length > 1
      ? { x: Math.max(2, Math.min(width - 3, Math.floor(width / 2))), y: Math.max(2, Math.min(height - 3, Math.floor(height / 2))) }
      : null;
  const hubIndex = Math.floor(SPINE_SEGMENTS / 2);

  for (const [a, b] of shape.links) {
    const from = openings[a];
    const to = openings[b];
    const waypoints: Tile[] = [from];
    for (let i = 1; i < SPINE_SEGMENTS; i++) {
      if (hub && i === hubIndex) {
        waypoints.push(hub);
        continue;
      }
      const t = i / SPINE_SEGMENTS;
      const jitterX = rng.int(-shape.jitter, shape.jitter);
      const jitterY = rng.int(-shape.jitter, shape.jitter);
      waypoints.push({
        x: clamp(Math.round(from.x + (to.x - from.x) * t) + jitterX, 2, width - 3),
        y: clamp(Math.round(from.y + (to.y - from.y) * t) + jitterY, 2, height - 3),
      });
    }
    waypoints.push(to);
    for (let i = 0; i + 1 < waypoints.length; i++) {
      const step = waypoints[i];
      const next = waypoints[i + 1];
      carveAt(step);
      if (tileKey(step) === tileKey(next)) continue;
      const path = findPath(tiles, step, next, undefined, {
        diagonal: false,
        cost: (tile) => costs[tile.y * width + tile.x] ?? 1,
        passable,
      });
      for (const cell of path) carveAt(cell);
    }
  }
  return spine;
}

/** Manhattan distance from `tile` to the nearest spine tile (0 on the spine). */
function distanceToSpine(spine: ReadonlySet<string>, tile: Tile): number {
  let best = Number.POSITIVE_INFINITY;
  for (const key of spine) {
    const [x, y] = key.split(',').map(Number);
    best = Math.min(best, Math.abs(x - tile.x) + Math.abs(y - tile.y));
  }
  return best;
}

/** The spine tile closest to `target` (L1), or the first one as a fallback. */
function nearestSpine(spine: ReadonlySet<string>, target: Tile): Tile | undefined {
  let best: Tile | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const key of spine) {
    const [x, y] = key.split(',').map(Number);
    const manhattan = Math.abs(x - target.x) + Math.abs(y - target.y);
    if (manhattan < bestDistance) {
      bestDistance = manhattan;
      best = { x, y };
    }
  }
  return best;
}

/**
 * Secondary paths: for each `branchCount`, pick a solid tile far enough from the
 * spine and carve a cardinal lane through the forest to the nearest spine tile
 * (never running along the spine). The lane is at least two tiles wide and, on a
 * roomy map, opens into a small chamber at its far end. The far end is recorded as
 * a **pocket** (a loot spot). Branches are optional; the spine alone always solves
 * the route.
 */
function carveBranches(
  tiles: MutableMap,
  rng: Rng,
  shape: ShapeSpec,
  spine: ReadonlySet<string>,
  ends: readonly Tile[],
  width: number,
  height: number,
): Readonly<{ branches: Set<string>; pockets: Tile[] }> {
  const branches = new Set<string>();
  const pockets: Tile[] = [];
  if (shape.branchCount <= 0) return { branches, pockets };

  const endKeys = new Set(ends.map(tileKey));
  // Branches stay strictly inside the one-tile border: the ring is never carved.
  const passable = (tile: Tile): boolean =>
    tile.x >= 1 && tile.x < width - 1 && tile.y >= 1 && tile.y < height - 1;

  // Scale the lane to the free space: how far the interior reaches from the spine.
  let maxAway = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const away = distanceToSpine(spine, { x, y });
      if (away > maxAway) maxAway = away;
    }
  }
  const branchMin = Math.max(shape.branchMin, Math.round(maxAway * 0.25));
  const branchMax = Math.max(shape.branchMax, branchMin + 1, Math.round(maxAway * 0.7));
  const branchWidth = Math.max(2, Math.min(4, Math.floor(maxAway / 12) + 1));
  const chamber = branchWidth >= 3 ? branchWidth + 1 : 0;

  for (let branch = 0; branch < shape.branchCount; branch++) {
    const candidates: Tile[] = [];
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const key = tileKey({ x, y });
        if (spine.has(key) || branches.has(key) || endKeys.has(key)) continue;
        const away = distanceToSpine(spine, { x, y });
        if (away < branchMin || away > branchMax) continue;
        candidates.push({ x, y });
      }
    }
    if (candidates.length === 0) break;

    const target = candidates[rng.int(0, candidates.length - 1)];
    const origin = nearestSpine(spine, target);
    if (!origin) break;

    const path = findPath(tiles, origin, target, (tile) => spine.has(tileKey(tile)), {
      diagonal: false,
      passable,
    });
    if (path.length === 0) continue;
    for (const cell of path) {
      for (const opened of carveSquare(tiles, cell.x, cell.y, branchWidth)) {
        branches.add(tileKey(opened));
      }
    }
    // A roomy map opens the far end into a chamber instead of a bare cul-de-sac.
    if (chamber > 0) {
      const roomX = clamp(target.x - (chamber >> 1), 1, width - 1 - chamber);
      const roomY = clamp(target.y - (chamber >> 1), 1, height - 1 - chamber);
      for (const opened of carveSquare(tiles, roomX, roomY, chamber)) {
        branches.add(tileKey(opened));
      }
    }
    pockets.push(target);
  }
  return { branches, pockets };
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

/**
 * Tall grass patches, stamped over plain floor. `pool` is the off-spine floor
 * (the spine stays a clean, encounter-free lane), and `forbid` also keeps a patch
 * from spilling back onto the spine or an opening.
 */
function carveGrass(
  tiles: MutableMap,
  rng: Rng,
  pool: readonly Tile[],
  patches: number,
  forbid: ReadonlySet<string>,
): void {
  for (let patch = 0; patch < patches; patch++) {
    const floors = pool.filter((tile) => tiles[tile.y][tile.x] === FLOOR && !forbid.has(tileKey(tile)));
    if (floors.length === 0) break;
    const seed = floors[rng.int(0, floors.length - 1)];
    const patchWidth = rng.int(2, 4);
    const patchHeight = rng.int(2, 3);
    for (let y = seed.y; y < seed.y + patchHeight; y++) {
      for (let x = seed.x; x < seed.x + patchWidth; x++) {
        const tile = { x, y };
        if (inBounds(tiles, tile) && tiles[y][x] === FLOOR && !forbid.has(tileKey(tile))) {
          tiles[y][x] = TALL_GRASS;
        }
      }
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
  record?: RouteStep[],
): RouteMap {
  const spec = LAYOUTS[request.layout ?? DEFAULT_LAYOUT];
  const shapeKey = request.shape ?? DEFAULT_SHAPE;
  const shape = SHAPES[shapeKey];
  const tiles: MutableMap = Array.from({ length: height }, () => new Array<number>(width).fill(WALL));
  const snapshot = (phase: RouteStep['phase'], label: string): void => {
    if (record) record.push({ phase, label, tiles: tiles.map((row) => row.slice()) });
  };
  snapshot('walls', 'fill walls');

  let entry: Tile;
  let exits: Tile[];
  let spine: Set<string>;
  let branches = new Set<string>();
  let pockets: Tile[] = [];

  if (spec.kind === 'hedges') {
    const edges = primaryEdges(shape);
    entry = edgeTile(edges.entry, streams.layout, width, height);
    const exit = edgeTile(edges.exit, streams.layout, width, height);
    exits = [exit];
    spine = carveHedges(tiles, streams.layout, spec, shape, entry, exit);
    snapshot('layout', 'hedged field');
  } else if (spec.kind === 'maze') {
    const ends = carveMaze(tiles, streams.layout, spec);
    entry = ends.start;
    exits = [ends.exit];
    spine = shortestPath(tiles, entry, ends.exit);
    snapshot('layout', 'maze');
  } else {
    const openings = placeAccess(tiles, shape, streams.layout, width, height);
    snapshot('access', 'place openings');
    entry = openings[entryIndex(shape)];
    exits = exitTiles(shape, openings);
    spine = carveGuaranteedPath(tiles, streams.layout, shape, openings, width, height);
    snapshot('spine', 'carve spine');
    const branched = carveBranches(tiles, streams.layout, shape, spine, [entry, ...exits], width, height);
    branches = branched.branches;
    pockets = branched.pockets;
    snapshot('branches', 'carve branches');
  }

  tiles[entry.y][entry.x] = FLOOR;

  // Ledges are solid, so they stay off the guaranteed spine - the carved lane on
  // open/hedged routes, the shortest path on a maze.
  const ends = [entry, ...exits];
  const pocketTiles = collectFloorTiles(tiles).filter((tile) => !spine.has(tileKey(tile)));
  const forbidKeys = new Set([...spine, ...ends.map(tileKey)]);
  carveGrass(tiles, streams.terrain, pocketTiles, request.grassPatches ?? 0, forbidKeys);
  carveLedges(tiles, streams.terrain, pocketTiles, request.ledges ?? 0);

  tiles[entry.y][entry.x] = FLOOR;
  snapshot('terrain', 'terrain pass');

  const route: RouteMap = {
    seed: request.seed,
    routeIndex: request.routeIndex,
    biomeId: request.biomeId,
    shape: shapeKey,
    width,
    height,
    tiles,
    entry,
    exits,
    spine: [...spine].map(keyToTile),
    branches: [...branches].map(keyToTile),
    pockets,
  };
  snapshot('final', 'final map');
  return route;
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

/**
 * Dev only: one snapshot per build phase (`walls` → `access` → `spine` →
 * `branches` → `terrain` → `final`), so the debug panel can render the generator
 * one step at a time. It replays attempt 0, which is the attempt `sketchRoute`
 * returns whenever it validates, so the steps match the route on screen.
 */
export function sketchRouteSteps(request: RouteRequest): readonly RouteStep[] {
  const steps: RouteStep[] = [];
  attemptRoute(
    request,
    routeStreams(request.seed, request.routeIndex, 0),
    request.width ?? ROUTE_WIDTH,
    request.height ?? ROUTE_HEIGHT,
    steps,
  );
  return steps;
}
