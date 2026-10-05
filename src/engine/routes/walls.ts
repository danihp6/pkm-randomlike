import { FLOOR, WALL } from '../map';

type MutableMap = number[][];

/**
 * How much wall still draws as a whole object of the tileset's wall motif
 * (`WallPattern`): `cols` is the pattern width - a thinner run shows a cut-off
 * object - and `minHeight` the shortest run that reads as a whole object. The
 * motif stacks every second row, so its whole heights are `minHeight`, `+2`, ...,
 * which is why every tileset's motif needs its own footprint.
 */
export type WallFootprint = Readonly<{ cols: number; minHeight: number }>;

/** The FireRed/LeafGreen tree: three columns wide, four rows for the first tree. */
export const DEFAULT_WALL_FOOTPRINT: WallFootprint = { cols: 3, minHeight: 4 };

/** The largest whole-object height `<= height`, or 0 when the run is too short. */
export function wholeRunHeight(height: number, minHeight: number): number {
  if (height < minHeight) return 0;
  return height % 2 === 0 ? height : height - 1;
}

const isWall = (tiles: readonly (readonly number[])[], x: number, y: number): boolean =>
  tiles[y][x] === WALL;

/** The maximal WALL runs of column `x`, as inclusive `[start, end]` row pairs. */
function columnRuns(tiles: readonly (readonly number[])[], x: number): [number, number][] {
  const runs: [number, number][] = [];
  let start = -1;
  for (let y = 0; y <= tiles.length; y++) {
    const wall = y < tiles.length && isWall(tiles, x, y);
    if (wall && start < 0) start = y;
    else if (!wall && start >= 0) {
      runs.push([start, y - 1]);
      start = -1;
    }
  }
  return runs;
}

/** The maximal WALL runs of row `y`, as inclusive `[start, end]` column pairs. */
function rowRuns(tiles: readonly (readonly number[])[], y: number): [number, number][] {
  const runs: [number, number][] = [];
  let start = -1;
  for (let x = 0; x <= tiles[0].length; x++) {
    const wall = x < tiles[0].length && isWall(tiles, x, y);
    if (wall && start < 0) start = x;
    else if (!wall && start >= 0) {
      runs.push([start, x - 1]);
      start = -1;
    }
  }
  return runs;
}

function clearColumn(tiles: MutableMap, x: number, from: number, to: number): boolean {
  let changed = false;
  for (let y = from; y <= to; y++) {
    if (tiles[y][x] === WALL) {
      tiles[y][x] = FLOOR;
      changed = true;
    }
  }
  return changed;
}

function clearRow(tiles: MutableMap, y: number, from: number, to: number): boolean {
  let changed = false;
  for (let x = from; x <= to; x++) {
    if (tiles[y][x] === WALL) {
      tiles[y][x] = FLOOR;
      changed = true;
    }
  }
  return changed;
}

/**
 * Tidies the carved interior so no thin wall remnant is left behind. The motif
 * draws a whole object only from a run at least `cols` wide and whole-tree tall
 * (`wholeRunHeight`); a lane that grazed the side of the forest leaves a one- or
 * two-tile sliver that renders as a cut-off tree, so it is removed here.
 *
 * Only turns WALL back into FLOOR, so it can widen a lane but never block it: the
 * entry, the exits and the spine keep working and the openings stay reachable.
 * A run that touches the one-tile border ring is always left alone, so the map
 * stays fenced (the ring is one tile wide by design and is not a sliver).
 */
export function cleanWalls(tiles: MutableMap, footprint: WallFootprint = DEFAULT_WALL_FOOTPRINT): void {
  const height = tiles.length;
  const width = height > 0 ? tiles[0].length : 0;
  const onRing = (x: number, y: number): boolean =>
    x === 0 || x === width - 1 || y === 0 || y === height - 1;

  for (let pass = 0; pass < 8; pass++) {
    let changed = false;

    for (let x = 0; x < width; x++) {
      for (const [start, end] of columnRuns(tiles, x)) {
        if (onRing(x, start) || onRing(x, end)) continue;
        const runHeight = end - start + 1;
        const target = wholeRunHeight(runHeight, footprint.minHeight);
        if (target === runHeight) continue;
        if (clearColumn(tiles, x, start + target, end)) changed = true;
      }
    }

    for (let y = 0; y < height; y++) {
      for (const [start, end] of rowRuns(tiles, y)) {
        if (onRing(start, y) || onRing(end, y)) continue;
        if (end - start + 1 >= footprint.cols) continue;
        if (clearRow(tiles, y, start, end)) changed = true;
      }
    }

    if (!changed) break;
  }
}
