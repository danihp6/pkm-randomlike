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
 * Tidies the carved interior so no thin, bitten or half-stacked wall remnant is
 * left behind. The motif draws a whole object only from a run at least `cols` wide
 * and whole-tree tall (`wholeRunHeight`); a lane that grazed the forest leaves a
 * one- or two-tile sliver, and a lane that bit the side of a tree leaves a
 * `cols`-wide band that is no longer solid. Such a bitten tree is removed whole
 * (its `cols`-wide row is cleared) and the rest of the column is then un-stacked,
 * so a tall wall still reads as whole stacked objects instead of a cut one.
 *
 * The tree a cell belongs to is a fixed **global grid** of `cols`-wide bands from
 * the map's left edge. Anchoring per column would let a one-tile lane re-base the
 * next mass onto its own edge, so the lane would never read as a bite and would
 * stay one tile wide; the grid makes a lane that falls inside a band widen to the
 * whole band, so no mass is left with a cut tree and no lane is left one tile wide.
 *
 * Only turns WALL back into FLOOR, so it can widen a lane but never block it: the
 * entry, the exits and the spine keep working and the openings stay reachable.
 * A cell on the one-tile border ring is only dropped to widen an opening (a lane
 * already reaches the ring beside it), so the map stays fenced; the generator also
 * keeps lanes out of the border band, so the tidy rarely needs to touch the ring.
 */
export function cleanWalls(tiles: MutableMap, footprint: WallFootprint = DEFAULT_WALL_FOOTPRINT): void {
  const height = tiles.length;
  const width = height > 0 ? tiles[0].length : 0;
  const onRing = (x: number, y: number): boolean =>
    x === 0 || x === width - 1 || y === 0 || y === height - 1;
  /** True when a ring cell sits beside an open ring cell, so it just widens an opening. */
  const extendsOpening = (x: number, y: number): boolean => {
    const neighbours: readonly (readonly [number, number])[] = [
      [x, y - 1],
      [x, y + 1],
      [x - 1, y],
      [x + 1, y],
    ];
    for (const [nx, ny] of neighbours) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      if (onRing(nx, ny) && !isWall(tiles, nx, ny)) return true;
    }
    return false;
  };
  const { cols, minHeight } = footprint;

  const bandStart = new Array<number>(width);
  for (let x = 0; x < width; x++) bandStart[x] = x - (x % cols);

  for (let pass = 0; pass < width * height + 1; pass++) {
    let changed = false;

    // Remove the row of a bitten tree: a `cols`-wide band that holds both wall
    // and floor cannot draw as a whole object, so the whole band row goes.
    const seenBands = new Set<number>();
    for (let y = 0; y < height; y++) {
      seenBands.clear();
      for (let x = 0; x < width; x++) {
        if (!isWall(tiles, x, y)) continue;
        const start = bandStart[x];
        if (seenBands.has(start)) continue;
        seenBands.add(start);

        const lo = Math.max(0, start);
        const hi = Math.min(width - 1, start + cols - 1);
        let wall = 0;
        let open = 0;
        for (let bx = lo; bx <= hi; bx++) {
          if (isWall(tiles, bx, y)) wall++;
          else open++;
        }
        if (wall === 0 || open === 0) continue;

        for (let bx = lo; bx <= hi; bx++) {
          if (!isWall(tiles, bx, y)) continue;
          // A border-ring cell is only dropped when it merely widens an opening
          // (a lane already reaches the ring beside it), so the map stays fenced.
          if (onRing(bx, y) && !extendsOpening(bx, y)) continue;
          tiles[y][bx] = FLOOR;
          changed = true;
        }
      }
    }

    // Un-stack: trim a column run down to whole objects and drop stubs. A run that
    // reaches a border ring row is trimmed from its **interior** end, so a bite
    // beside an opening is cleaned without opening the fence; a ring cell is only
    // dropped when it merely widens an opening.
    for (let x = 0; x < width; x++) {
      for (const [start, end] of columnRuns(tiles, x)) {
        const runHeight = end - start + 1;
        const target = wholeRunHeight(runHeight, minHeight);
        if (target === runHeight) continue;
        const topRing = onRing(x, start);
        const bottomRing = onRing(x, end);
        if (topRing && bottomRing) continue;
        const [from, to] =
          bottomRing && !topRing ? [start, start + (runHeight - target) - 1] : [start + target, end];
        for (let y = from; y <= to; y++) {
          if (!isWall(tiles, x, y)) continue;
          if (onRing(x, y) && !extendsOpening(x, y)) continue;
          tiles[y][x] = FLOOR;
          changed = true;
        }
      }
    }

    // A run narrower than the motif can never be a whole object on its own.
    for (let y = 0; y < height; y++) {
      for (const [start, end] of rowRuns(tiles, y)) {
        if (onRing(start, y) || onRing(end, y)) continue;
        if (end - start + 1 >= cols) continue;
        if (clearRow(tiles, y, start, end)) changed = true;
      }
    }

    if (!changed) break;
  }
}
