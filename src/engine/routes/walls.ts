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
 * How many WALL cells sit immediately left of `(x, y)` on the same row.
 */
function runLeft(tiles: readonly (readonly number[])[], x: number, y: number): number {
  let left = 0;
  while (x - left - 1 >= 0 && isWall(tiles, x - left - 1, y)) left++;
  return left;
}

/** How many WALL cells sit immediately right of `(x, y)` on the same row. */
function runRight(tiles: readonly (readonly number[])[], x: number, y: number): number {
  const width = tiles[0].length;
  let right = 0;
  while (x + right + 1 < width && isWall(tiles, x + right + 1, y)) right++;
  return right;
}

/**
 * The motif column `x` draws on, matching `patternFrame` on the scene's
 * connected-padded map (`extendMap`): anchored to the column's own first wall
 * cell plus the centring offset for a run narrower than the motif. `cleanWalls`
 * uses it to know which `cols`-wide tree a wall cell belongs to, so a bitten tree
 * can be removed whole.
 */
function patternColumn(tiles: readonly (readonly number[])[], x: number, cols: number): number {
  const height = tiles.length;
  let top = 0;
  while (top < height && !isWall(tiles, x, top)) top++;
  if (top >= height) return 0;
  const left = runLeft(tiles, x, top);
  const span = left + 1 + runRight(tiles, x, top);
  const offset = span >= cols ? 0 : Math.floor((cols - span) / 2);
  return (left + offset) % cols;
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
 * The tree a cell belongs to is fixed by the map as carved: the scene binds the
 * motif with `extendMap`, which only carries a tree that reaches the border past
 * the edge and otherwise anchors a mass to the first wall cell it meets, so
 * `cleanWalls` anchors the bands the same way and holds them fixed. Deleting a
 * bitten tree then never shifts where its neighbours tile.
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
  const { cols, minHeight } = footprint;

  const bandStart = new Array<number>(width);
  for (let x = 0; x < width; x++) bandStart[x] = x - patternColumn(tiles, x, cols);

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

        let wall = 0;
        let open = 0;
        for (let bx = start; bx < start + cols; bx++) {
          // The scene extends the map only vertically for the motif, so a band that
          // runs off the playable edge is cut off there, not continued sideways.
          if (bx < 0 || bx >= width || !isWall(tiles, bx, y)) open++;
          else wall++;
        }
        if (wall === 0 || open === 0) continue;

        for (let bx = start; bx < start + cols; bx++) {
          if (bx < 0 || bx >= width || onRing(bx, y)) continue;
          if (isWall(tiles, bx, y)) {
            tiles[y][bx] = FLOOR;
            changed = true;
          }
        }
      }
    }

    // Un-stack: trim a column run down to whole objects and drop stubs.
    for (let x = 0; x < width; x++) {
      for (const [start, end] of columnRuns(tiles, x)) {
        if (onRing(x, start) || onRing(x, end)) continue;
        const runHeight = end - start + 1;
        const target = wholeRunHeight(runHeight, minHeight);
        if (target === runHeight) continue;
        if (clearColumn(tiles, x, start + target, end)) changed = true;
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
