import { playableSpecies } from '../../data/dex/species';
import type { Tile } from '../grid';
import { FLOOR, WALL, isWalkable, type TileMap } from '../map';
import { rngFromSeed } from '../rng';
import { FACINGS, FACING_VECTORS, type Facing } from './routeMap';
import { ROUTE_HEIGHT, ROUTE_WIDTH, sketchRoute } from './sketch';

/** The world tile a preview cell draws at, in px (the route’s own 24). */
export const PREVIEW_TILE = 24;
/** The biome the window always previews (the first map’s, `biomeForRoute(1)`). */
export const PREVIEW_BIOME_ID = 'forest';

/** The panel’s tick: one model step, in ms. The window’s only timer. */
export const PREVIEW_TICK_MS = 600;
/** The tiles one stride books: at least, and at most. */
export const STRIDE_MIN_TILES = 2;
export const STRIDE_MAX_TILES = 4;
/** The beat a walker stands after a stride, in ms, drawn from its own stream. */
export const STRIDE_REST_MIN_MS = 900;
export const STRIDE_REST_MAX_MS = 1600;

export type PreviewRect = Readonly<{ x: number; y: number; w: number; h: number }>;

export type PreviewRoom = Readonly<{
  /** The seed the caller asked for; no other entropy is read. */
  seed: string;
  /** The window it was asked for, echoed unchanged. */
  rect: PreviewRect;
  cols: number;
  rows: number;
  /** Always `PREVIEW_TILE` (24). */
  tile: number;
  biomeId: string;
  /** Exactly `rows` rows of `cols` map values, row-major (`FLOOR`, `WALL`, …). */
  tiles: TileMap;
  /** Every walkable tile of `tiles`, row-major; empty never happens. */
  walkable: readonly Tile[];
}>;

export type PreviewWalker = Readonly<{
  /** 0-based and stable for the room. */
  id: number;
  /** A species `playableSpecies()` names, so the panel can draw its portrait cell. */
  speciesId: string;
  /** The tile it now stands on: the last tile of `path`, or the one it never left. */
  tile: Tile;
  /** The heading of the last stride; unchanged on a resting tick. */
  facing: Facing;
  /** The tile the last stride started from. Absent until the first stride. */
  previous?: Tile;
  /** The tiles this tick’s stride booked, in walk order; `[]` on a resting tick. */
  path: readonly Tile[];
  /** Ticks still to stand before the next stride; `0` = the next tick strides. */
  rest: number;
  /** The beat drawn for the rest that follows the last stride, in ms; absent before it. */
  restMs?: number;
}>;

function countFor(span: number): number {
  return Number.isFinite(span) ? Math.max(1, Math.floor(span / PREVIEW_TILE)) : 1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * The generator's answer cut to `cols × rows` around its centre. A window wider
 * or taller than the shipped route samples its border cells instead of failing,
 * and an empty answer fills with wall so the caller always gets the grid it asked
 * for.
 */
function centreCrop(source: TileMap, cols: number, rows: number): number[][] {
  const sourceRows = source.length;
  const sourceCols = sourceRows > 0 ? source[0].length : 0;
  const offsetX = Math.floor((sourceCols - cols) / 2);
  const offsetY = Math.floor((sourceRows - rows) / 2);
  const out: number[][] = [];
  for (let y = 0; y < rows; y++) {
    const row: number[] = [];
    for (let x = 0; x < cols; x++) {
      if (sourceCols === 0 || sourceRows === 0) {
        row.push(WALL);
        continue;
      }
      const sourceX = clamp(offsetX + x, 0, sourceCols - 1);
      const sourceY = clamp(offsetY + y, 0, sourceRows - 1);
      row.push(source[sourceY][sourceX] ?? WALL);
    }
    out.push(row);
  }
  return out;
}

/**
 * The preview floor. It asks the shipped generator for the window's own size on a
 * seed no run can share (`:preview`, off the caller's seed), and falls back to the
 * shipped `ROUTE_WIDTH × ROUTE_HEIGHT` cut to the centre when a size the generator
 * refuses is asked for.
 */
function previewTiles(seed: string, cols: number, rows: number): number[][] {
  const request = {
    seed: `${seed}:preview`,
    routeIndex: 0,
    biomeId: PREVIEW_BIOME_ID,
    quiet: true,
    role: 'wild',
    shape: 'corridor',
  } as const;
  try {
    return centreCrop(sketchRoute({ ...request, width: cols, height: rows }).tiles, cols, rows);
  } catch {
    const roomy = sketchRoute({ ...request, width: ROUTE_WIDTH, height: ROUTE_HEIGHT });
    return centreCrop(roomy.tiles, cols, rows);
  }
}

/**
 * The decorative room behind the main menu's window: a quiet `corridor` of the
 * first map's biome, sized by the window and drawn from `seed` alone. No run
 * state, no save and no clock, so the same `(seed, window)` is a deep-equal room.
 */
export function previewRoute(seed: string, window: PreviewRect): PreviewRoom {
  const cols = countFor(window.w);
  const rows = countFor(window.h);
  const tiles = previewTiles(seed, cols, rows);
  const walkable: Tile[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const tile = { x, y };
      if (isWalkable(tiles, tile)) walkable.push(tile);
    }
  }
  // The walker pass draws from `walkable`, and the model promises it is never
  // empty: a crop whose centre is all wall keeps its middle cell as floor.
  if (walkable.length === 0) {
    const centre = { x: Math.floor(cols / 2), y: Math.floor(rows / 2) };
    tiles[centre.y][centre.x] = FLOOR;
    walkable.push(centre);
  }
  return {
    seed,
    rect: { x: window.x, y: window.y, w: window.w, h: window.h },
    cols,
    rows,
    tile: PREVIEW_TILE,
    biomeId: PREVIEW_BIOME_ID,
    tiles,
    walkable,
  };
}

/** The id drawn for a species index, skipping the ids the room already shows. */
function distinctSpecies(ids: readonly string[], taken: ReadonlySet<string>, index: number): string {
  for (let step = 0; step < ids.length; step++) {
    const candidate = ids[(index + step) % ids.length];
    if (!taken.has(candidate)) return candidate;
  }
  return ids[index % ids.length];
}

type Step = Readonly<{ tile: Tile; facing: Facing }>;

/** The walkable cardinal neighbours of `tile`, in `FACINGS` order. */
function stepsFrom(route: PreviewRoom, tile: Tile): Step[] {
  const steps: Step[] = [];
  for (const facing of FACINGS) {
    const vector = FACING_VECTORS[facing];
    const next = { x: tile.x + vector.x, y: tile.y + vector.y };
    if (next.x < 0 || next.x >= route.cols || next.y < 0 || next.y >= route.rows) continue;
    if (!isWalkable(route.tiles, next)) continue;
    steps.push({ tile: next, facing });
  }
  return steps;
}

function sameTile(a: Tile, b: Tile): boolean {
  return a.x === b.x && a.y === b.y;
}

/**
 * Whether stepping from `from` onto `step`'s tile leaves the walker an exit other
 * than the tile it came from: a step that cannot force the walk straight back.
 */
function keepsGoing(route: PreviewRoom, step: Step, from: Tile): boolean {
  return stepsFrom(route, step.tile).some((next) => !sameTile(next.tile, from));
}

/** Whether `tile` itself offers such a step. */
function hasForwardStep(route: PreviewRoom, tile: Tile): boolean {
  return stepsFrom(route, tile).some((step) => keepsGoing(route, step, tile));
}

/**
 * The tile a walker starts on: the first walkable one, from the drawn index
 * onward, that opens two ways out and can keep walking, then one that at least
 * opens two ways out, then one that can keep walking, then the drawn tile.
 */
function startTile(route: PreviewRoom, drawn: number): Tile {
  const count = route.walkable.length;
  const order: Tile[] = [];
  for (let offset = 0; offset < count; offset++) order.push(route.walkable[(drawn + offset) % count]);
  const ranked: readonly ((tile: Tile) => boolean)[] = [
    (tile) => stepsFrom(route, tile).length >= 2 && hasForwardStep(route, tile),
    (tile) => stepsFrom(route, tile).length >= 2,
    (tile) => hasForwardStep(route, tile),
  ];
  for (const accepts of ranked) {
    const found = order.find(accepts);
    if (found !== undefined) return found;
  }
  return order[0];
}

/**
 * Two or three Pokémon on the room's walkable floor, from the room's own
 * `walkers` stream: distinct species, a starting tile and a facing each.
 */
export function previewWalkers(route: PreviewRoom): readonly PreviewWalker[] {
  const rng = rngFromSeed(`${route.seed}:preview:walkers`);
  const ids = playableSpecies().map((species) => species.id);
  const count = rng.int(2, 3);
  const taken = new Set<string>();
  const walkers: PreviewWalker[] = [];
  for (let id = 0; id < count; id++) {
    const speciesId = distinctSpecies(ids, taken, rng.int(0, ids.length - 1));
    taken.add(speciesId);
    const tile = startTile(route, rng.int(0, route.walkable.length - 1));
    walkers.push({
      id,
      speciesId,
      tile: { x: tile.x, y: tile.y },
      facing: FACINGS[rng.int(0, FACINGS.length - 1)],
      path: [],
      rest: 0,
    });
  }
  return walkers;
}

/**
 * The tiles a straight stride walks from `from` along `facing`, in walk order and
 * starting with `from` itself, refused exactly as the stride refuses them: out of the
 * room, not walkable, the tile the last stride started from, or one already walked.
 */
function straightRun(
  route: PreviewRoom,
  from: Tile,
  facing: Facing,
  cap: number,
  previous: Tile | undefined,
): Tile[] {
  const vector = FACING_VECTORS[facing];
  const run: Tile[] = [from];
  while (run.length < cap) {
    const last = run[run.length - 1]!;
    const next = { x: last.x + vector.x, y: last.y + vector.y };
    if (next.x < 0 || next.x >= route.cols || next.y < 0 || next.y >= route.rows) break;
    if (!isWalkable(route.tiles, next)) break;
    if (previous !== undefined && sameTile(next, previous)) break;
    if (run.some((tile) => sameTile(tile, next))) break;
    run.push(next);
  }
  return run;
}

/** How many tiles the stride would book if it went `step`'s way: never fewer than one. */
function runLength(route: PreviewRoom, step: Step, previous: Tile | undefined): number {
  return straightRun(route, step.tile, step.facing, Math.max(route.cols, route.rows), previous).length;
}

/**
 * One timer tick of the walkers. A walker that is resting books no move at all and
 * only spends a tick of its beat; otherwise the tick books a **stride**: two to four
 * tiles along one heading, walkable, in bounds, never doubling back onto the tile the
 * last stride started from, and drawn from the walker’s own `walker:<id>:<step>`
 * stream in exactly three draws (the stride’s length, the heading, the beat that
 * follows). The heading is drawn among the candidates whose straight line can book at
 * least two tiles, falling back to every candidate only when none can, so an open room
 * moves several tiles at once and a boxed-in walker still answers the longest legal
 * stride (or stays put). A tick never depends on the order the list is drawn in, and a
 * fold replays exactly.
 */
export function stepPreviewWalkers(
  route: PreviewRoom,
  walkers: readonly PreviewWalker[],
  step: number,
): readonly PreviewWalker[] {
  const at = Number.isFinite(step) ? Math.max(0, Math.trunc(step)) : 0;
  return walkers.map((walker) => {
    if (walker.rest > 0) {
      return { ...walker, path: [], rest: walker.rest - 1 };
    }
    const rng = rngFromSeed(`${route.seed}:preview:walker:${walker.id}:${at}`);
    const length = rng.int(STRIDE_MIN_TILES, STRIDE_MAX_TILES);
    const previous = walker.previous;
    const all = stepsFrom(route, walker.tile);
    const fresh =
      previous === undefined ? all : all.filter((candidate) => !sameTile(candidate.tile, previous));
    const forward = fresh.filter((candidate) => keepsGoing(route, candidate, walker.tile));
    const candidates = forward.length > 0 ? forward : fresh.length > 0 ? fresh : all;
    if (candidates.length === 0) {
      return { ...walker, tile: walker.tile, previous: walker.tile, path: [], rest: 0 };
    }
    const usable = candidates.filter(
      (candidate) => runLength(route, candidate, previous) >= STRIDE_MIN_TILES,
    );
    const pool = usable.length > 0 ? usable : candidates;
    const chosen = pool[rng.int(0, pool.length - 1)];
    const facing = chosen.facing;
    const path = straightRun(route, chosen.tile, facing, length, previous);
    const restMs = STRIDE_REST_MIN_MS + 100 * rng.int(0, 7);
    return {
      id: walker.id,
      speciesId: walker.speciesId,
      tile: path[path.length - 1]!,
      facing,
      previous: walker.tile,
      path,
      rest: Math.max(1, Math.round(restMs / PREVIEW_TICK_MS)),
      restMs,
    };
  });
}
