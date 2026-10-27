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
  /** The walker’s tile inside the room (`0 … cols-1`, `0 … rows-1`). */
  tile: Tile;
  facing: Facing;
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

/**
 * Two or three Pokémon on the room's walkable floor, from the room's own
 * `walkers` stream: distinct species, a starting tile and a facing each.
 */
export function previewWalkers(route: PreviewRoom): readonly PreviewWalker[] {
  const rng = rngFromSeed(`${route.seed}:preview:walkers`);
  const ids = playableSpecies().map((species) => species.id);
  const start = { x: route.walkable[0].x, y: route.walkable[0].y };
  const count = rng.int(2, 3);
  const taken = new Set<string>();
  const walkers: PreviewWalker[] = [];
  for (let id = 0; id < count; id++) {
    const speciesId = distinctSpecies(ids, taken, rng.int(0, ids.length - 1));
    taken.add(speciesId);
    const tile = route.walkable[rng.int(0, route.walkable.length - 1)] ?? start;
    walkers.push({
      id,
      speciesId,
      tile: { x: tile.x, y: tile.y },
      facing: FACINGS[rng.int(0, FACINGS.length - 1)],
    });
  }
  return walkers;
}

/**
 * One timer tick of the walkers: each one takes a walkable cardinal neighbour of
 * its current tile (or stays put when it is boxed in) and faces that way. Every
 * walker reads its own `walker:<id>:<step>` stream, so a tick never depends on the
 * order the list is drawn in and a fold replays exactly.
 */
export function stepPreviewWalkers(
  route: PreviewRoom,
  walkers: readonly PreviewWalker[],
  step: number,
): readonly PreviewWalker[] {
  const at = Number.isFinite(step) ? Math.max(0, Math.trunc(step)) : 0;
  return walkers.map((walker) => {
    const rng = rngFromSeed(`${route.seed}:preview:walker:${walker.id}:${at}`);
    const candidates: Readonly<{ tile: Tile; facing: Facing }>[] = [];
    for (const facing of FACINGS) {
      const vector = FACING_VECTORS[facing];
      const tile = { x: walker.tile.x + vector.x, y: walker.tile.y + vector.y };
      if (tile.x < 0 || tile.x >= route.cols || tile.y < 0 || tile.y >= route.rows) continue;
      if (!isWalkable(route.tiles, tile)) continue;
      candidates.push({ tile, facing });
    }
    if (candidates.length === 0) {
      return { ...walker, tile: { x: walker.tile.x, y: walker.tile.y } };
    }
    const chosen = candidates[rng.int(0, candidates.length - 1)]!;
    return { id: walker.id, speciesId: walker.speciesId, tile: chosen.tile, facing: chosen.facing };
  });
}
