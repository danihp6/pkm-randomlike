import { FLOOR, WALL } from '../map';

type MutableMap = number[][];

/**
 * The shortest wall run that draws one whole tree: `tileFrames.patternFrame`
 * stacks a column as top/body/base only when its run is even and this tall,
 * so anything shorter is a stub that renders as a floating crown.
 */
export const MIN_WHOLE_RUN = 4;

/** The largest whole-tree height `<= height`, or 0 when the run is too short. */
export function wholeRunHeight(height: number): number {
  if (height < MIN_WHOLE_RUN) return 0;
  return height % 2 === 0 ? height : height - 1;
}

/** The maximal vertical WALL runs of column `x`, as inclusive `[start, end]` rows. */
function wallRuns(tiles: readonly (readonly number[])[], x: number): [number, number][] {
  const runs: [number, number][] = [];
  let start = -1;
  for (let y = 0; y <= tiles.length; y++) {
    const wall = y < tiles.length && tiles[y][x] === WALL;
    if (wall && start < 0) start = y;
    else if (!wall && start >= 0) {
      runs.push([start, y - 1]);
      start = -1;
    }
  }
  return runs;
}

function clear(tiles: MutableMap, x: number, from: number, to: number): void {
  for (let y = from; y <= to; y++) tiles[y][x] = FLOOR;
}

/**
 * Tidies the carved forest so every column reads as a whole number of trees.
 *
 * A lane that bites a column leaves a run that is odd or shorter than one tree,
 * which the renderer draws as a floating crown or a bare trunk. Cleaning only
 * ever turns WALL back into FLOOR, so it can widen a lane but never block it -
 * the entry, the exits and the spine keep working, and the openings stay
 * reachable. Border columns are cleaned too: the rows it drops there sit against
 * an opening, so a side opening simply grows a tile instead of leaving a bitten
 * tree; the four corners and every full ring column are never touched, so the
 * map stays fenced.
 */
export function cleanTrees(tiles: MutableMap): void {
  const height = tiles.length;
  const width = height > 0 ? tiles[0].length : 0;
  for (let x = 0; x < width; x++) {
    for (const [start, end] of wallRuns(tiles, x)) {
      const runHeight = end - start + 1;
      const target = wholeRunHeight(runHeight);
      if (target === runHeight) continue;
      if (start === 0 && end === height - 1) continue; // a full column; its ends are the ring

      if (target === 0) {
        // Too short for a tree: keep a border cell as the screen-edge line, else clear it.
        const from = start === 0 ? start + 1 : start;
        const to = end === height - 1 ? end - 1 : end;
        clear(tiles, x, from, to);
        continue;
      }

      // Drop the extra row off the end that is not on the ring, re-stacking what is left.
      const extra = runHeight - target;
      if (end !== height - 1) clear(tiles, x, end - extra + 1, end);
      else clear(tiles, x, start, start + extra - 1);
    }
  }
}
