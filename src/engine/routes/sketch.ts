import type { LootEntry } from '../../data/loot';
import {
  branchCountForSize,
  terrainScaleForSize,
  trainerBonusForSize,
} from '../../data/mapSize';
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
import { pickWeighted } from './encounters';
import {
  FACINGS,
  FACING_VECTORS,
  tileKey,
  type Facing,
  type RouteItem,
  type RouteMap,
  type RouteTrainer,
} from './routeMap';
import {
  DEFAULT_LAYOUT,
  DEFAULT_SHAPE,
  LAYOUTS,
  SHAPES,
  entryIndex,
  shapeForEdges,
  specForOpenings,
  type Access,
  type AccessEdge,
  type LayoutSpec,
  type LayoutStyle,
  type RouteShape,
  type ShapeSpec,
} from './layout';
import { routeStreams, type RouteStreams } from './streams';
import { cleanWalls, type WallFootprint } from './walls';
import { reachableAvoiding, reachableTiles, validateRoute } from './validate';

export const ROUTE_WIDTH = 20;
export const ROUTE_HEIGHT = 20;

const MAX_ATTEMPTS = 8;

/**
 * Fallback ring of solid forest a lane leaves along the border when the tileset's
 * motif width is unknown. The real margin is the motif's `cols`: a lane must not
 * carve into the `cols`-wide band the border ring belongs to, or `cleanWalls`
 * would have to cut the fence to remove the bitten tree. Passed in per request
 * (`wallMargin`), so a wider motif widens the margin.
 */
const TREE_MARGIN = 3;

/** Waypoints carved per shape link: the interior points the corridor bends through. */
const SPINE_SEGMENTS = 4;
/** Ceiling of the deterministic per-cell cost that makes the guaranteed path meander. */
const COST_NOISE = 4;

/** How far a trainer watches down its facing, unless the caller overrides it. */
export const DEFAULT_TRAINER_SIGHT = 5;
/** A trainer never stands closer than this (Manhattan) to the entry opening. */
const TRAINER_ENTRY_GAP = 3;
/** How near a guarded pocket a branch trainer looks for its spot. */
const TRAINER_POCKET_RANGE = 3;
/** Share of trainers that cycle their facing instead of holding one direction. */
const SPIN_CHANCE = 0.35;

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
  /**
   * The room's opening set from the map plan (`docs/maps-spec.md` §2). Every
   * opening is placed on its edge and the spine joins them; the shape is derived
   * from the edges, so this overrides `shape`.
   */
  openings?: readonly Access[];
  width?: number;
  height?: number;
  /** Biome base counts; the generator multiplies them by the map-size tier. */
  grassPatches?: number;
  ledges?: number;
  /** The tileset's wall motif footprint, so `cleanWalls` knows a whole object. */
  wall?: WallFootprint;
  /**
   * Weighted ground-item pool. A route places one item at each reachable
   * optional-path end (pocket); with no pool it places none, so the generator
   * stays free of the band's loot table (the caller passes it).
   */
  loot?: readonly LootEntry[];
  /** Chance a placed item is hidden (the faint sparkle). Defaults to `0`. */
  hiddenChance?: number;
  /** Chance an optional-path end actually holds an item. Defaults to `1`. */
  itemChance?: number;
  /**
   * Archetype ids a route may draw its trainers from (`src/data/trainers.ts`).
   * With none the route places no trainers, so the generator stays free of the
   * roster data and a caller opts in (the scene passes the whole list).
   */
  trainerArchetypes?: readonly string[];
  /** How far a trainer sees down its facing. Defaults to `DEFAULT_TRAINER_SIGHT`. */
  trainerSight?: number;
  /**
   * A **quiet** room: no tall grass, no ledges, no ground items and no trainers —
   * the map's entry room and its boss room (`docs/maps-spec.md` §2/§6). The
   * geometry (lanes, pockets) is still carved; only its content is emptied.
   */
  quiet?: boolean;
}>;

type MutableMap = number[][];

/** A labelled snapshot of the map after one build phase, for the debug stepper. */
export type RouteStep = Readonly<{
  phase:
    | 'walls'
    | 'access'
    | 'spine'
    | 'branches'
    | 'layout'
    | 'clean'
    | 'terrain'
    | 'trainers'
    | 'items'
    | 'final';
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
function edgeTile(
  edge: AccessEdge,
  rng: Rng,
  width: number,
  height: number,
  corner: number,
  band: number,
  lane: number,
): Tile {
  const jitter = (span: number): number => {
    const c = Math.min(corner, Math.floor((span - 1) / 2));
    const v = rng.int(c, span - 1 - c);
    const rem = v % band;
    // Keep the opening's `lane`-wide approach inside one band of the motif grid, so
    // it never bites the whole tree in the band beside it into a stump.
    return rem > band - lane ? v - (rem - (band - lane)) : v;
  };
  switch (edge) {
    case 'W':
      return { x: 0, y: jitter(height) };
    case 'E':
      return { x: width - 1, y: jitter(height) };
    case 'N':
      return { x: jitter(width), y: 0 };
    case 'S':
      return { x: jitter(width), y: height - 1 };
  }
}

/**
 * The clearance an opening keeps from each corner: the motif's full footprint (a
 * border band plus a band of separation), so a corridor never bites the tree in a
 * corner into a partial/1-tile piece.
 */
export function cornerClearance(wall: WallFootprint | undefined): number {
  return (wall?.cols ?? TREE_MARGIN) * 2;
}

/**
 * The band a lane keeps from the map border: the motif's width (so it never bites
 * the `cols`-wide border band) and at least the **whole-object height**, so the
 * strip it leaves at the border is a whole tree with its trunk, not a stump.
 */
export function wallMargin(wall: WallFootprint | undefined): number {
  return wall ? Math.max(wall.cols, wall.minHeight) : TREE_MARGIN;
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
  corner: number,
  band: number,
): Tile[] {
  return shape.openings.map((opening) => {
    const tile = edgeTile(opening.edge, rng, width, height, corner, band, shape.pathWidth);
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
 * The tiles a lane carves **straight in** from an opening before it may turn. The
 * border ring belongs to the `cols`-wide band nearest the edge, so a corridor that
 * turned any earlier would bite that band and force `cleanWalls` to cut the fence;
 * the straight run clears the band first.
 */
function openingApproach(edge: AccessEdge, opening: Tile, margin: number): Tile[] {
  const cells: Tile[] = [];
  for (let step = 1; step <= margin; step++) {
    switch (edge) {
      case 'W':
        cells.push({ x: opening.x + step, y: opening.y });
        break;
      case 'E':
        cells.push({ x: opening.x - step, y: opening.y });
        break;
      case 'N':
        cells.push({ x: opening.x, y: opening.y + step });
        break;
      case 'S':
        cells.push({ x: opening.x, y: opening.y - step });
        break;
    }
  }
  return cells;
}

/**
 * The guaranteed lane: each `link` is joined by jittered waypoints, and each pair
 * is connected by a cardinal A* corridor that follows a per-cell cost field so it
 * meanders. Every carved tile lands in the returned spine, which the hazard
 * passes must never block. A straight `openingApproach` clears the border band at
 * each end, and the per-cell cost penalises the outer band, so the corridor never
 * bites the fence except where it is open.
 */
function carveGuaranteedPath(
  tiles: MutableMap,
  rng: Rng,
  shape: ShapeSpec,
  openings: readonly Tile[],
  width: number,
  height: number,
  margin: number,
): Set<string> {
  const spine = new Set<string>();
  const costs = noiseCostField(rng, width, height);
  const costOf = (tile: Tile): number => {
    const base = costs[tile.y * width + tile.x] ?? 1;
    const off = Math.min(tile.x, tile.y, width - 1 - tile.x, height - 1 - tile.y);
    return off < margin ? base + COST_NOISE * (margin - off) * 4 : base;
  };
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

  const low = margin;
  // The lane is carved `pathWidth` wide from its anchor down/right, so its far
  // edge - not its anchor - is what has to keep the border margin. Clamp the
  // interior waypoints (and the hub) a lane width inside it, so the strip left at
  // the border is a whole tree instead of a one-row stump `cleanWalls` would drop
  // into a bitten fence.
  const laneReach = shape.pathWidth - 1;
  const highX = width - 1 - margin - laneReach;
  const highY = height - 1 - margin - laneReach;

  // When a shape has more than one link (the `cross`), every link must pass
  // through the same central hub, so the lanes are guaranteed to meet instead of
  // relying on the jittered corridors happening to cross.
  const hub =
    shape.links.length > 1
      ? { x: Math.max(low, Math.min(highX, Math.floor(width / 2))), y: Math.max(low, Math.min(highY, Math.floor(height / 2))) }
      : null;
  const hubIndex = Math.floor(SPINE_SEGMENTS / 2);

  const carveChain = (waypoints: readonly Tile[]): void => {
    for (let i = 0; i + 1 < waypoints.length; i++) {
      const step = waypoints[i];
      const next = waypoints[i + 1];
      carveAt(step);
      if (tileKey(step) === tileKey(next)) continue;
      const path = findPath(tiles, step, next, undefined, {
        diagonal: false,
        cost: costOf,
        passable,
      });
      for (const cell of path) carveAt(cell);
    }
  };

  for (const [a, b] of shape.links) {
    const from = openings[a];
    const to = openings[b];
    const startApproach = openingApproach(shape.openings[a].edge, from, margin);
    const endApproach = openingApproach(shape.openings[b].edge, to, margin);
    const waypoints: Tile[] = [from, ...startApproach];
    for (let i = 1; i < SPINE_SEGMENTS; i++) {
      if (hub && i === hubIndex) {
        waypoints.push(hub);
        continue;
      }
      const t = i / SPINE_SEGMENTS;
      const jitterX = rng.int(-shape.jitter, shape.jitter);
      const jitterY = rng.int(-shape.jitter, shape.jitter);
      waypoints.push({
        x: clamp(Math.round(from.x + (to.x - from.x) * t) + jitterX, low, highX),
        y: clamp(Math.round(from.y + (to.y - from.y) * t) + jitterY, low, highY),
      });
    }
    waypoints.push(...[...endApproach].reverse(), to);
    carveChain(waypoints);
  }

  // A dead-end room has no second opening to link to: carve one lane in from its
  // single opening toward the centre, so the leaf has a network for its branches.
  if (shape.links.length === 0 && shape.openings.length === 1) {
    const from = openings[0];
    const approach = openingApproach(shape.openings[0].edge, from, margin);
    carveChain([
      from,
      ...approach,
      {
        x: clamp(Math.floor(width / 2), low, highX),
        y: clamp(Math.floor(height / 2), low, highY),
      },
    ]);
  }
  return spine;
}

/**
 * Grid distance from every cell to the nearest `network` tile, via a cardinal
 * flood. On an unobstructed grid this equals the Manhattan distance, but it is
 * computed once per branch so the candidate scan never walks the set per cell.
 * Cells are indexed `y * width + x`.
 */
function distanceField(width: number, height: number, network: ReadonlySet<string>): Int32Array {
  const distance = new Int32Array(width * height).fill(-1);
  const queue: number[] = [];
  for (const key of network) {
    const [x, y] = key.split(',').map(Number);
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    const index = y * width + x;
    if (distance[index] === 0) continue;
    distance[index] = 0;
    queue.push(index);
  }
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head];
    const x = index % width;
    const y = (index - x) / width;
    const step = distance[index] + 1;
    if (x > 0 && distance[index - 1] < 0) {
      distance[index - 1] = step;
      queue.push(index - 1);
    }
    if (x < width - 1 && distance[index + 1] < 0) {
      distance[index + 1] = step;
      queue.push(index + 1);
    }
    if (y > 0 && distance[index - width] < 0) {
      distance[index - width] = step;
      queue.push(index - width);
    }
    if (y < height - 1 && distance[index + width] < 0) {
      distance[index + width] = step;
      queue.push(index + width);
    }
  }
  return distance;
}

/** The network tile closest to `target` (L1), which a new lane roots on. */
function nearestNetwork(network: ReadonlySet<string>, target: Tile): Tile | undefined {
  let best: Tile | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const key of network) {
    const [x, y] = key.split(',').map(Number);
    const manhattan = Math.abs(x - target.x) + Math.abs(y - target.y);
    if (manhattan < bestDistance) {
      bestDistance = manhattan;
      best = { x, y };
    }
  }
  return best;
}

/** One carved branch: its intended far end and every tile the lane opened. */
type BranchCarve = Readonly<{ target: Tile; tiles: readonly string[] }>;

/**
 * Secondary paths. A **network** is the spine plus every lane carved so far, and
 * the count depends on the map size (`branchCountForSize`). For each path, pick a
 * solid tile far enough from the network and carve a cardinal lane to the nearest
 * network tile (never running along it). Because the network grows, a later path
 * can root on **an earlier lane** as well as on the spine, so branches can grow
 * off branches. The lane is at least two tiles wide and, on a roomy map, opens
 * into a small chamber at its far end; that far end is a **pocket** (a loot spot).
 * Branches are optional; the spine alone always solves the route.
 */
function carveBranches(
  tiles: MutableMap,
  rng: Rng,
  shape: ShapeSpec,
  spine: ReadonlySet<string>,
  ends: readonly Tile[],
  width: number,
  height: number,
  margin: number,
): Readonly<{ branches: Set<string>; carves: ReadonlyArray<BranchCarve> }> {
  const branches = new Set<string>();
  const carves: BranchCarve[] = [];
  const branchCount = branchCountForSize(shape.branchCount, width, height);
  if (branchCount <= 0) return { branches, carves };

  const endKeys = new Set(ends.map(tileKey));
  const network = new Set<string>(spine);

  for (let branch = 0; branch < branchCount; branch++) {
    // Scale the lane to the free space: how far the interior reaches from the
    // network. Recomputed as the network grows.
    const distance = distanceField(width, height, network);
    let maxAway = 0;
    for (let y = margin; y < height - margin; y++) {
      for (let x = margin; x < width - margin; x++) {
        const away = distance[y * width + x];
        if (away > maxAway) maxAway = away;
      }
    }
    if (maxAway <= 0) break;

    const branchWidth = Math.max(2, Math.min(4, Math.floor(maxAway / 12) + 1));
    // Branches stay strictly inside the border margin, and the last lane cell is
    // pulled in by `branchWidth - 1` so `carveSquare` never clamps the lane into a
    // one-tile stub at the bound.
    const branchBounds: SquareBounds = {
      minX: margin,
      minY: margin,
      maxX: width - margin - branchWidth,
      maxY: height - margin - branchWidth,
    };
    const passable = (tile: Tile): boolean =>
      tile.x >= margin && tile.x <= branchBounds.maxX && tile.y >= margin && tile.y <= branchBounds.maxY;

    const branchMin = Math.max(shape.branchMin, Math.round(maxAway * 0.25));
    const branchMax = Math.max(shape.branchMax, branchMin + 1, Math.round(maxAway * 0.7));
    const chamber = branchWidth >= 3 ? branchWidth + 1 : 0;

    const candidates: Tile[] = [];
    for (let y = margin; y < height - margin; y++) {
      for (let x = margin; x < width - margin; x++) {
        const key = tileKey({ x, y });
        if (network.has(key) || endKeys.has(key)) continue;
        const away = distance[y * width + x];
        if (away < branchMin || away > branchMax) continue;
        candidates.push({ x, y });
      }
    }
    if (candidates.length === 0) break;

    const target = candidates[rng.int(0, candidates.length - 1)];
    const origin = nearestNetwork(network, target);
    if (!origin) break;

    const path = findPath(tiles, origin, target, (tile) => network.has(tileKey(tile)), {
      diagonal: false,
      passable,
    });
    if (path.length === 0) continue;
    const carved: string[] = [];
    for (const cell of path) {
      for (const opened of carveSquare(tiles, cell.x, cell.y, branchWidth, branchBounds)) {
        const key = tileKey(opened);
        branches.add(key);
        network.add(key);
        carved.push(key);
      }
    }
    // A roomy map opens the far end into a chamber instead of a bare cul-de-sac.
    if (chamber > 0) {
      const roomX = clamp(target.x - (chamber >> 1), margin, width - margin - chamber);
      const roomY = clamp(target.y - (chamber >> 1), margin, height - margin - chamber);
      for (const opened of carveSquare(tiles, roomX, roomY, chamber, branchBounds)) {
        const key = tileKey(opened);
        branches.add(key);
        network.add(key);
        carved.push(key);
      }
    }
    carves.push({ target, tiles: carved });
  }
  return { branches, carves };
}

function setFloor(tiles: MutableMap, x: number, y: number): void {
  const width = tiles[0].length;
  const height = tiles.length;
  if (x < 1 || x >= width - 1 || y < 1 || y >= height - 1) return;
  tiles[y][x] = FLOOR;
}

type SquareBounds = Readonly<{ minX: number; minY: number; maxX: number; maxY: number }>;

/**
 * Carves a `size`-wide square of floor anchored at `(x, y)`, never touching the
 * one-tile border so the route stays fenced. `bounds` tightens that further, which
 * is how a branch keeps its distance from the border. Returns the tiles it opened.
 */
function carveSquare(
  tiles: MutableMap,
  x: number,
  y: number,
  size: number,
  bounds?: SquareBounds,
): Tile[] {
  const minX = bounds?.minX ?? 1;
  const minY = bounds?.minY ?? 1;
  const maxX = bounds?.maxX ?? tiles[0].length - 2;
  const maxY = bounds?.maxY ?? tiles.length - 2;
  const opened: Tile[] = [];
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      const tx = x + dx;
      const ty = y + dy;
      if (tx < minX || tx > maxX || ty < minY || ty > maxY) continue;
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
 * A grass patch is a ground tile on plain floor. It is packed **against the
 * walls**: a patch first tries to stretch across a wall-to-wall corridor, so it
 * touches a wall at both ends (the vertical or horizontal gap it spans), but only
 * when that gap is no wider than `GRASS_SPAN_MAX`; a tight fit reads as grass in a
 * lane, a wide one would just paint the room. When no such corridor fits, the
 * patch falls back to a small block anchored on a wall, so grass never floats in
 * open floor. `pool` is the off-spine floor (the spine stays a clean,
 * encounter-free lane) and `forbid` also keeps a patch off the spine or an opening.
 */
const GRASS_SPAN_MAX = 5;

function carveGrass(
  tiles: MutableMap,
  rng: Rng,
  pool: readonly Tile[],
  patches: number,
  forbid: ReadonlySet<string>,
): void {
  const grassable = (tile: Tile): boolean =>
    inBounds(tiles, tile) && tiles[tile.y][tile.x] === FLOOR && !forbid.has(tileKey(tile));
  const isWall = (x: number, y: number): boolean =>
    x >= 0 && x < tiles[0].length && y >= 0 && y < tiles.length && tiles[y][x] === WALL;
  // How many grassable tiles lie in `dir` before the run ends, and whether the
  // tile that stops it is a wall (a patch may stretch to that wall).
  const reach = (origin: Tile, dir: Tile): Readonly<{ count: number; wall: boolean }> => {
    let count = 0;
    let tile: Tile = { x: origin.x + dir.x, y: origin.y + dir.y };
    while (grassable(tile)) {
      count += 1;
      tile = { x: tile.x + dir.x, y: tile.y + dir.y };
    }
    return { count, wall: inBounds(tiles, tile) && tiles[tile.y][tile.x] === WALL };
  };
  const paint = (tile: Tile): void => {
    if (grassable(tile)) tiles[tile.y][tile.x] = TALL_GRASS;
  };

  for (let patch = 0; patch < patches; patch++) {
    const floors = pool.filter(grassable);
    if (floors.length === 0) break;
    // Deterministic shuffle: a seed whose corridor does not fit tries the next.
    for (let i = floors.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [floors[i], floors[j]] = [floors[j], floors[i]];
    }

    let placed = false;
    for (const seed of floors) {
      const west = reach(seed, { x: -1, y: 0 });
      const east = reach(seed, { x: 1, y: 0 });
      const north = reach(seed, { x: 0, y: -1 });
      const south = reach(seed, { x: 0, y: 1 });
      const spanX = west.count + east.count + 1;
      const spanY = north.count + south.count + 1;
      const wallX = west.wall && east.wall && spanX <= GRASS_SPAN_MAX;
      const wallY = north.wall && south.wall && spanY <= GRASS_SPAN_MAX;
      if (!wallX && !wallY) continue;
      // The tighter wall-to-wall gap wins, so the patch fills a lane, not a room.
      const thickness = rng.int(2, 3);
      if (wallX && (!wallY || spanX <= spanY)) {
        const fromX = seed.x - west.count;
        const toX = seed.x + east.count;
        const fromY = seed.y - Math.floor((thickness - 1) / 2);
        for (let y = fromY; y < fromY + thickness; y++) {
          for (let x = fromX; x <= toX; x++) paint({ x, y });
        }
      } else {
        const fromY = seed.y - north.count;
        const toY = seed.y + south.count;
        const fromX = seed.x - Math.floor((thickness - 1) / 2);
        for (let x = fromX; x < fromX + thickness; x++) {
          for (let y = fromY; y <= toY; y++) paint({ x, y });
        }
      }
      placed = true;
      break;
    }

    // No corridor fits: a small block anchored on a wall, never floating free.
    // The block is grown from the seed through grassable cells only, so a
    // forbidden cell (the spine) inside it never splits off a wall-free piece.
    if (!placed) {
      for (const seed of floors) {
        if (!isWall(seed.x, seed.y - 1) && !isWall(seed.x + 1, seed.y) && !isWall(seed.x, seed.y + 1) && !isWall(seed.x - 1, seed.y)) {
          continue;
        }
        const width = rng.int(2, 4);
        const height = rng.int(2, 3);
        const right = seed.x + width - 1;
        const bottom = seed.y + height - 1;
        const queue: Tile[] = [seed];
        const visited = new Set<string>([tileKey(seed)]);
        while (queue.length > 0) {
          const tile = queue.shift()!;
          paint(tile);
          for (const dir of CARDINALS) {
            const next: Tile = { x: tile.x + dir.x, y: tile.y + dir.y };
            const key = tileKey(next);
            if (next.x < seed.x || next.x > right || next.y < seed.y || next.y > bottom) continue;
            if (visited.has(key) || !grassable(next)) continue;
            visited.add(key);
            queue.push(next);
          }
        }
        placed = true;
        break;
      }
    }
    if (!placed) break;
  }
}

/**
 * A ledge is a horizontal run of rock you may only jump down; it is solid from
 * every other side, so it is kept off the guaranteed path, the openings and the
 * pockets (loot spots). A run is a whole object now, so it draws a left cap, a
 * repeated centre and a right cap (`LedgeFrames`), which is why it needs at least
 * three tiles: a run that would fall short, or that would cut the walkable map in
 * two, is dropped whole rather than left as a two-tile stub. A run also has to
 * hang off a wall at one of its lateral ends, so it reads as a lip on the terrain
 * instead of a rock floating in open floor.
 */
function carveLedges(
  tiles: MutableMap,
  rng: Rng,
  pool: readonly Tile[],
  forbid: ReadonlySet<string>,
  entry: Tile,
  count: number,
): void {
  const isFloor = (tile: Tile): boolean =>
    inBounds(tiles, tile) && tiles[tile.y][tile.x] === FLOOR;
  // Grass is walkable, so a ledge may still be jumped over with grass around it.
  const isGround = (tile: Tile): boolean =>
    inBounds(tiles, tile) && (tiles[tile.y][tile.x] === FLOOR || tiles[tile.y][tile.x] === TALL_GRASS);
  const canStand = (tile: Tile): boolean =>
    isFloor(tile) &&
    isGround({ x: tile.x, y: tile.y - 1 }) &&
    isGround({ x: tile.x, y: tile.y + 1 });
  const isWall = (x: number, y: number): boolean =>
    x >= 0 && x < tiles[0].length && y >= 0 && y < tiles.length && tiles[y][x] === WALL;

  for (let line = 0; line < count; line++) {
    const candidates = pool.filter((tile) => canStand(tile) && !forbid.has(tileKey(tile)));
    if (candidates.length === 0) break;
    // Deterministic shuffle: if an origin would strand a branch, the line tries
    // the next one instead of giving up.
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const before = reachableTiles(tiles, entry);
    let placed = false;
    for (const origin of candidates) {
      const requested = rng.int(3, 4);
      const run: Tile[] = [];
      for (let dx = 0; dx < requested; dx++) {
        const tile = { x: origin.x + dx, y: origin.y };
        if (!canStand(tile) || forbid.has(tileKey(tile))) break;
        run.push(tile);
      }
      // A run shorter than three has no room for both caps, so it is not placed.
      if (run.length < 3) continue;
      // The tile just outside the left or the right cap must be wall, so the lip
      // is attached to the terrain at a lateral end.
      const last = run[run.length - 1];
      if (!isWall(run[0].x - 1, run[0].y) && !isWall(last.x + 1, last.y)) continue;
      const runKeys = new Set(run.map(tileKey));
      for (const tile of run) tiles[tile.y][tile.x] = LEDGE;
      const after = reachableTiles(tiles, entry);
      if ([...before].some((key) => !runKeys.has(key) && !after.has(key))) {
        for (const tile of run) tiles[tile.y][tile.x] = FLOOR;
        continue;
      }
      placed = true;
      break;
    }
    if (!placed) break;
  }
}

/** How many of the four cardinal neighbours of `(x, y)` are solid walls. */
function wallNeighbours(tiles: TileMap, x: number, y: number): number {
  let walls = 0;
  if (tiles[y - 1]?.[x] === WALL) walls += 1;
  if (tiles[y + 1]?.[x] === WALL) walls += 1;
  if (tiles[y]?.[x - 1] === WALL) walls += 1;
  if (tiles[y]?.[x + 1] === WALL) walls += 1;
  return walls;
}

/**
 * A wall cell that draws as a tree's **walkable tip**: the top of its contiguous
 * run (no wall above it) and not on the map's top/bottom fence. `treeTipKeys`
 * turns these into floor for movement, so a trainer leaning on one is not leaning
 * on a solid wall - only a solid one reads as glued.
 */
function isTreeTip(tiles: TileMap, x: number, y: number): boolean {
  if (y <= 0 || y >= tiles.length - 1) return false;
  return tiles[y]?.[x] === WALL && tiles[y - 1]?.[x] !== WALL;
}

/** True when the wall at `(x, y)` is solid, i.e. not a walkable tree tip. */
function solidWall(tiles: TileMap, x: number, y: number, walkableTips: boolean): boolean {
  return tiles[y]?.[x] === WALL && !(walkableTips && isTreeTip(tiles, x, y));
}

/** How many of the four cardinal neighbours of `(x, y)` are solid (non-tip) walls. */
function solidWallNeighbours(tiles: TileMap, x: number, y: number, walkableTips: boolean): number {
  let walls = 0;
  if (solidWall(tiles, x, y - 1, walkableTips)) walls += 1;
  if (solidWall(tiles, x, y + 1, walkableTips)) walls += 1;
  if (solidWall(tiles, x - 1, y, walkableTips)) walls += 1;
  if (solidWall(tiles, x + 1, y, walkableTips)) walls += 1;
  return walls;
}

/**
 * The loot spot for each branch: the **deepest** walkable tile - the one nearest
 * the branch's far end - preferring the most wall-hugging one on a tie, and never
 * sharing a tile with an earlier pocket. So an item sits as far down the path as
 * it can. When a branch's own lane holds no tile (it was walled off), the search
 * falls back to the wider branch network.
 */
function choosePockets(
  tiles: TileMap,
  carves: ReadonlyArray<BranchCarve>,
  branches: ReadonlySet<string>,
): Tile[] {
  const pockets: Tile[] = [];
  const used = new Set<string>();
  const branchKeys = [...branches];
  for (const carve of carves) {
    const local = bestSpot(tiles, carve.tiles, carve.target, used);
    const chosen = local ?? bestSpot(tiles, branchKeys, carve.target, used);
    if (!chosen) continue;
    used.add(tileKey(chosen.tile));
    pockets.push(chosen.tile);
  }
  return pockets;
}

/**
 * The deepest unused, walkable tile of `keys`: nearest to the branch's far end
 * `target`, with the most wall-hugging tile as the tie-break.
 */
function bestSpot(
  tiles: TileMap,
  keys: Iterable<string>,
  target: Tile,
  used: ReadonlySet<string>,
): Readonly<{ tile: Tile; walls: number }> | null {
  let best: Tile | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestWalls = -1;
  for (const key of keys) {
    if (used.has(key)) continue;
    const [x, y] = key.split(',').map(Number);
    const tile = { x, y };
    if (!isWalkable(tiles, tile)) continue;
    const walls = wallNeighbours(tiles, x, y);
    const distance = Math.abs(x - target.x) + Math.abs(y - target.y);
    if (distance < bestDistance || (distance === bestDistance && walls > bestWalls)) {
      best = tile;
      bestDistance = distance;
      bestWalls = walls;
    }
  }
  return best ? { tile: best, walls: bestWalls } : null;
}

/**
 * Places the ground items. An optional path (a `pocket`) holds an item only with
 * `itemChance` probability, and a pocket a hazard sealed (or that is no longer
 * walkable) is skipped, so loot is never stranded. The draw order is the
 * deterministic `pockets` order: the item id is `item-<routeIndex>-<n>` and the
 * contents plus the hidden flag come from the `populate` stream, so
 * `(seed, routeIndex)` fixes what lies at each pocket (D11).
 */
function placeItems(
  tiles: TileMap,
  pockets: readonly Tile[],
  reached: ReadonlySet<string>,
  routeIndex: number,
  loot: readonly LootEntry[] | undefined,
  hiddenChance: number,
  itemChance: number,
  rng: Rng,
): RouteItem[] {
  if (!loot || loot.length === 0) return [];
  const items: RouteItem[] = [];
  for (const position of pockets) {
    if (!reached.has(tileKey(position)) || !isWalkable(tiles, position)) continue;
    if (rng.next() >= itemChance) continue;
    const itemId = pickWeighted(loot, rng).itemId;
    const hidden = rng.next() < hiddenChance;
    items.push({ id: `item-${routeIndex}-${items.length}`, position: { ...position }, itemId, hidden });
  }
  return items;
}

/**
 * The cardinals from `pos` that look onto a **passable** tile (at least one
 * ahead). A ledge, water or the wall itself is not a lane a trainer can face
 * down, so a trainer is never posed staring at a tile the player cannot cross.
 */
function openFacings(tiles: TileMap, pos: Tile): Facing[] {
  return FACINGS.filter((facing) => {
    const vector = FACING_VECTORS[facing];
    const ahead = { x: pos.x + vector.x, y: pos.y + vector.y };
    return isWalkable(tiles, ahead);
  });
}

/** How many non-wall tiles a facing sees, capped at the trainer's `sight`. */
function openRun(tiles: TileMap, pos: Tile, facing: Facing, sight: number): number {
  const vector = FACING_VECTORS[facing];
  let run = 0;
  for (let step = 1; step <= sight; step++) {
    const ahead = { x: pos.x + vector.x * step, y: pos.y + vector.y * step };
    if (!inBounds(tiles, ahead) || tiles[ahead.y][ahead.x] === WALL) break;
    run += 1;
  }
  return run;
}

/**
 * The cardinal a trainer looks along, the way the originals pose them: back to a
 * wall (so it reads as leaning on it) and down the most open lane, preferring the
 * way the player arrives from the entry so its front greets the player. No RNG,
 * so the pose is a pure function of the map.
 */
function chooseFacing(
  tiles: TileMap,
  pos: Tile,
  entry: Tile,
  dirs: readonly Facing[],
  sight: number,
  walkableTips: boolean,
): Facing {
  const backWall = (facing: Facing): number => {
    const vector = FACING_VECTORS[facing];
    const behind = { x: pos.x - vector.x, y: pos.y - vector.y };
    return solidWall(tiles, behind.x, behind.y, walkableTips) ? 1 : 0;
  };
  const towardEntry = (facing: Facing): number => {
    const vector = FACING_VECTORS[facing];
    return Math.sign(entry.x - pos.x) * vector.x + Math.sign(entry.y - pos.y) * vector.y;
  };
  let best = dirs[0];
  let bestScore = [-1, -1, -Infinity];
  for (const facing of dirs) {
    const score = [backWall(facing), openRun(tiles, pos, facing, sight), towardEntry(facing)];
    if (score[0] > bestScore[0] || (score[0] === bestScore[0] && (score[1] > bestScore[1] || (score[1] === bestScore[1] && score[2] > bestScore[2])))) {
      best = facing;
      bestScore = score;
    }
  }
  return best;
}

/**
 * The cardinal a **pocket guard** looks along: across its optional path, from wall
 * to wall, so the sight closes the branch instead of running down it. A vertical
 * path is watched horizontally and a horizontal one vertically. Null when neither
 * crossing tile is passable, so the caller falls back to the along-lane pose.
 */
function chooseCrossFacing(
  tiles: TileMap,
  pos: Tile,
  pocket: Tile,
  dirs: readonly Facing[],
  walkableTips: boolean,
): Facing | null {
  const dx = pocket.x - pos.x;
  const dy = pocket.y - pos.y;
  const vertical = Math.abs(dy) >= Math.abs(dx);
  const cross: readonly Facing[] = vertical ? ['E', 'W'] : ['N', 'S'];
  const open = cross.filter((facing) => dirs.includes(facing));
  if (open.length === 0) return null;
  const backed = open.find((facing) => {
    const vector = FACING_VECTORS[facing];
    return solidWall(tiles, pos.x - vector.x, pos.y - vector.y, walkableTips);
  });
  return backed ?? open[0];
}

/**
 * Places the route's trainers. A route always guards its main lane with at least
 * one trainer and puts one more by every optional pocket it fills, plus the
 * map-size tier's bonus, so the count follows the route's size. A trainer stands
 * on floor hugging a wall and looks down the open lane, and some cycle their
 * facing on a timer (a "spinning" trainer). Placement never plugs a passage: a
 * candidate is kept only while every tile the player could reach before is still
 * reachable with the chosen trainers treated as blockers (ledges and water count
 * as impassable), and no two trainers stand in neighbouring tiles, so a trainer
 * is never forced on the player and never crowds another
 * (`docs/route-generator.md` §3.4). The `populate` stream drives the picks, so
 * `(seed, routeIndex)` fixes the trainers (D11).
 */
function placeTrainers(
  tiles: TileMap,
  entry: Tile,
  exits: readonly Tile[],
  spine: ReadonlySet<string>,
  branches: ReadonlySet<string>,
  pockets: readonly Tile[],
  routeIndex: number,
  archetypes: readonly string[],
  sight: number,
  walkableTips: boolean,
  rng: Rng,
): RouteTrainer[] {
  if (archetypes.length === 0) return [];

  const trainers: RouteTrainer[] = [];
  const blocked = new Set<string>();
  const endKeys = new Set([entry, ...exits, ...pockets].map(tileKey));
  const entryDistance = (tile: Tile): number => Math.abs(tile.x - entry.x) + Math.abs(tile.y - entry.y);
  const fullReach = reachableTiles(tiles, entry);

  const isFloor = (tile: Tile): boolean =>
    inBounds(tiles, tile) && tiles[tile.y][tile.x] === FLOOR;

  /** No other trainer may stand in the eight tiles around `tile`. */
  const crowded = (tile: Tile): boolean => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (blocked.has(tileKey({ x: tile.x + dx, y: tile.y + dy }))) return true;
      }
    }
    return false;
  };

  /**
   * Adding `tile` as a blocker must not cut off any tile the entry could reach
   * before, so a trainer never plugs a lane, a branch or a pocket.
   */
  const keepsRouteOpen = (tile: Tile): boolean => {
    const test = new Set(blocked);
    test.add(tileKey(tile));
    const reached = reachableAvoiding(tiles, entry, test);
    for (const key of fullReach) {
      if (!test.has(key) && !reached.has(key)) return false;
    }
    return true;
  };

  /**
   * Whether `tile` cuts a sight line. Anything impassable does, except a walkable
   * tree tip (which the movement map turns into floor).
   */
  const sightBlocked = (tile: Tile): boolean => {
    if (blocked.has(tileKey(tile))) return true;
    if (isWalkable(tiles, tile)) return false;
    return !(walkableTips && isTreeTip(tiles, tile.x, tile.y));
  };

  /** True when `facing` would put the entry (the player's spawn) in sight. */
  const seesEntry = (tile: Tile, facing: Facing): boolean => {
    const vector = FACING_VECTORS[facing];
    let current = tile;
    for (let step = 0; step < sight; step++) {
      current = { x: current.x + vector.x, y: current.y + vector.y };
      if (sightBlocked(current)) break;
      if (current.x === entry.x && current.y === entry.y) return true;
    }
    return false;
  };

  const candidateOk = (tile: Tile): boolean => {
    const key = tileKey(tile);
    if (blocked.has(key) || endKeys.has(key) || crowded(tile)) return false;
    if (!isFloor(tile) || solidWallNeighbours(tiles, tile.x, tile.y, walkableTips) === 0) return false;
    if (entryDistance(tile) < TRAINER_ENTRY_GAP) return false;
    if (openFacings(tiles, tile).length === 0) return false;
    return keepsRouteOpen(tile);
  };

  /** The pocket a branch trainer stands by, for the cross-path facing. */
  const nearestPocket = (tile: Tile): Tile | undefined => {
    let best: Tile | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const pocket of pockets) {
      const distance = Math.abs(pocket.x - tile.x) + Math.abs(pocket.y - tile.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = pocket;
      }
    }
    return best;
  };

  const commit = (tile: Tile): boolean => {
    const dirs = openFacings(tiles, tile);
    if (dirs.length === 0) return false;
    // A trainer on an optional path looks **across** it (wall to wall), so the
    // sight closes the branch instead of running down it; a trainer on the main
    // lane looks down the lane, back to a wall. A branch candidate with no
    // crossing is skipped, so a branch is never watched from down its own axis.
    const key = tileKey(tile);
    const branchPocket = !spine.has(key) && branches.has(key) ? nearestPocket(tile) : undefined;
    const cross = branchPocket ? chooseCrossFacing(tiles, tile, branchPocket, dirs, walkableTips) : null;
    if (branchPocket && cross === null) return false;
    const facing = cross ?? chooseFacing(tiles, tile, entry, dirs, sight, walkableTips);
    const spins = dirs.length >= 2 && rng.next() < SPIN_CHANCE;
    const turns = spins ? FACINGS.filter((candidate) => dirs.includes(candidate)) : null;
    // A trainer never spawns already watching - or able to spin and watch - the
    // tile the player arrives on.
    if (seesEntry(tile, facing) || (turns?.some((turn) => seesEntry(tile, turn)) ?? false)) {
      return false;
    }
    const archetypeId = archetypes[rng.int(0, archetypes.length - 1)];
    trainers.push({
      id: `trainer-${routeIndex}-${trainers.length}`,
      position: { ...tile },
      facing,
      sight,
      archetypeId,
      ...(turns ? { turns } : {}),
    });
    blocked.add(tileKey(tile));
    return true;
  };

  /** Deterministic shuffle, then the first candidate that still keeps the route open. */
  const tryFrom = (pool: readonly Tile[]): boolean => {
    const order = [...pool];
    for (let i = order.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (const tile of order) {
      if (candidateOk(tile) && commit(tile)) return true;
    }
    return false;
  };

  const spineTiles = [...spine].map(keyToTile);
  const branchTiles = [...branches].map(keyToTile);

  // A minimum on the main lane: one trainer on the spine (the fallback pool lets
  // it land on a branch when the spine has no room, so a route still gets one).
  if (!tryFrom(spineTiles)) tryFrom([...spineTiles, ...branchTiles]);

  // One more guarding each optional path, standing as close to the loot pocket as
  // its branch allows and looking across the path (wall to wall).
  for (const pocket of pockets) {
    const near = branchTiles
      .filter((tile) => !(tile.x === pocket.x && tile.y === pocket.y))
      .filter((tile) => Math.abs(tile.x - pocket.x) + Math.abs(tile.y - pocket.y) <= TRAINER_POCKET_RANGE)
      .sort((a, b) => {
        const da = Math.abs(a.x - pocket.x) + Math.abs(a.y - pocket.y);
        const db = Math.abs(b.x - pocket.x) + Math.abs(b.y - pocket.y);
        return da - db || a.y - b.y || a.x - b.x;
      });
    tryFrom(near);
  }

  // Then the map-size tier's bonus, anywhere the network still has room.
  const bonus = trainerBonusForSize(tiles[0].length, tiles.length);
  for (let i = 0; i < bonus; i++) {
    if (!tryFrom([...spineTiles, ...branchTiles])) break;
  }

  return trainers;
}

/**
 * The shape a build uses: the plan's opening set when one is given (the edges
 * pick the shape and the links join them), else the rolled `shape` (or the
 * default). Keeps `sketchRoute` source-compatible while the plan takes over.
 */
function resolveShape(request: RouteRequest): Readonly<{ shapeKey: RouteShape; shape: ShapeSpec }> {
  if (request.openings && request.openings.length > 0) {
    const edges = request.openings.map((opening) => opening.edge);
    return { shapeKey: shapeForEdges(edges), shape: specForOpenings(request.openings) };
  }
  const shapeKey = request.shape ?? DEFAULT_SHAPE;
  return { shapeKey, shape: SHAPES[shapeKey] };
}

function attemptRoute(
  request: RouteRequest,
  streams: RouteStreams,
  width: number,
  height: number,
  record?: RouteStep[],
): RouteMap {
  const spec = LAYOUTS[request.layout ?? DEFAULT_LAYOUT];
  const { shapeKey, shape } = resolveShape(request);
  const tiles: MutableMap = Array.from({ length: height }, () => new Array<number>(width).fill(WALL));
  const snapshot = (phase: RouteStep['phase'], label: string): void => {
    if (record) record.push({ phase, label, tiles: tiles.map((row) => row.slice()) });
  };
  snapshot('walls', 'fill walls');

  let entry: Tile;
  let exits: Tile[];
  let spine: Set<string>;
  let branches = new Set<string>();
  let carves: ReadonlyArray<BranchCarve> = [];
  const corner = cornerClearance(request.wall);
  const band = request.wall?.cols ?? TREE_MARGIN;

  if (spec.kind === 'hedges') {
    const edges = primaryEdges(shape);
    entry = edgeTile(edges.entry, streams.layout, width, height, corner, band, shape.pathWidth);
    const exit = edgeTile(edges.exit, streams.layout, width, height, corner, band, shape.pathWidth);
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
    const openings = placeAccess(tiles, shape, streams.layout, width, height, corner, band);
    snapshot('access', 'place openings');
    // A plan room always names a door to spawn at; the map entry room has none and
    // spawns at its centre (`docs/maps-spec.md` §2), a lane carved to the network.
    const entryIdx = shape.openings.findIndex((opening) => opening.role === 'entry');
    entry = entryIdx >= 0 ? openings[entryIdx] : { x: Math.floor(width / 2), y: Math.floor(height / 2) };
    exits = exitTiles(shape, openings);
    // A lane must not carve the `cols`-wide band the border ring belongs to, and
    // must leave a strip at least a whole object tall, or `cleanWalls` would cut
    // the fence to remove the bitten tree / leave a stump with no trunk.
    const margin = wallMargin(request.wall);
    spine = carveGuaranteedPath(tiles, streams.layout, shape, openings, width, height, margin);
    if (entryIdx < 0) {
      // The centre spawn is not an opening: join it to the carved network so it is
      // floor, connected and off-limits to the hazard passes.
      const nearest = nearestNetwork(spine, entry);
      if (nearest) carveLine(tiles, spine, entry, nearest, shape.pathWidth, true);
    }
    snapshot('spine', 'carve spine');
    const branched = carveBranches(tiles, streams.layout, shape, spine, [entry, ...exits], width, height, margin);
    branches = branched.branches;
    carves = branched.carves;
    snapshot('branches', 'carve branches');
  }

  tiles[entry.y][entry.x] = FLOOR;

  // Tidy the carved interior before the terrain and the population go down, so
  // the grass and the ledges only see whole walls. Only the open forest has the
  // wall motif; the parked hedge/maze carvers keep their own walls.
  if (spec.kind === 'open') cleanWalls(tiles, request.wall);
  snapshot('clean', 'clean walls');

  // A pocket is the loot spot at a branch's far end: the deepest walkable tile of
  // the branch (nearest its carved target), most wall-hugging on a tie, so an item
  // sits as far down the path as it can.
  const pockets = choosePockets(tiles, carves, branches);

  // Ledges are solid, so they stay off the guaranteed spine - the carved lane on
  // open/hedged routes, the shortest path on a maze.
  const ends = [entry, ...exits];
  const pocketTiles = collectFloorTiles(tiles).filter((tile) => !spine.has(tileKey(tile)));
  const pocketKeys = pockets.map(tileKey);
  const openKeys = new Set([...spine, ...ends.map(tileKey)]);
  // A pocket is a loot spot: tall grass may not cover it (an item never spawns on
  // grass) and a ledge may not seal it. Grass is otherwise free to fill the lanes.
  const grassForbid = new Set([...openKeys, ...pocketKeys]);
  const ledgeForbid = new Set([...openKeys, ...pocketKeys]);
  // A bigger map stamps more terrain: the biome base scales by the map-size tier
  // (`src/data/mapSize.ts`), so the density holds across route sizes. A **quiet**
  // room (the entry and the boss, `docs/maps-spec.md` §2/§6) stamps no terrain.
  const terrainScale = terrainScaleForSize(width, height);
  const quiet = request.quiet === true;
  carveGrass(tiles, streams.terrain, pocketTiles, (quiet ? 0 : request.grassPatches ?? 0) * terrainScale, grassForbid);
  carveLedges(tiles, streams.terrain, pocketTiles, ledgeForbid, entry, (quiet ? 0 : request.ledges ?? 0) * terrainScale);

  tiles[entry.y][entry.x] = FLOOR;
  snapshot('terrain', 'terrain pass');

  // The population pass (docs/route-generator.md §3.4-3.5): first the trainers
  // (one guarding the main lane, one per optional pocket and the map-size bonus),
  // then one ground item at each reachable optional-path end. Both draw from the
  // `populate` stream, so `(seed, routeIndex)` fixes the whole population (D11).
  const reached = reachableTiles(tiles, entry);
  const trainers = placeTrainers(
    tiles,
    entry,
    exits,
    spine,
    branches,
    pockets,
    request.routeIndex,
    quiet ? [] : request.trainerArchetypes ?? [],
    request.trainerSight ?? DEFAULT_TRAINER_SIGHT,
    request.wall !== undefined,
    streams.populate,
  );
  snapshot('trainers', 'place trainers');
  const items = placeItems(
    tiles,
    pockets,
    reached,
    request.routeIndex,
    request.loot,
    quiet ? 0 : request.hiddenChance ?? 0,
    quiet ? 0 : request.itemChance ?? 1,
    streams.populate,
  );
  snapshot('items', 'populate items');

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
    items,
    trainers,
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
