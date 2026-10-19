import type { Tile } from './grid';

export type TileMap = readonly (readonly number[])[];

export const FLOOR = 0;
export const WALL = 1;
export const EXIT = 2;
export const TRAP = 3;
export const CHEST = 4;
export const ITEM = 5;
export const WATER = 6;
export const CARPET = 7;
export const TALL_GRASS = 8;
export const LEDGE = 9;
export const BUSH = 10;
export const ROCK = 11;

const SOLID: ReadonlySet<number> = new Set([WALL, WATER, LEDGE, BUSH, ROCK]);

/**
 * A ledge blocks entry from every direction; walking off one downward is a
 * movement rule (`movement.ts`), not a walkability one, so it stays solid here.
 */
export function isWalkable(map: TileMap, tile: Tile): boolean {
  if (tile.y < 0 || tile.y >= map.length) return false;
  const row = map[tile.y];
  if (tile.x < 0 || tile.x >= row.length) return false;
  return !SOLID.has(row[tile.x]);
}

/**
 * Whether stepping diagonally by `dir` from `from` would cut through a wall
 * corner - true when either of the two orthogonal tiles flanking the diagonal
 * is unwalkable. Cardinal `dir`s never cut a corner.
 */
export function cutsCorner(map: TileMap, from: Tile, dir: Tile): boolean {
  if (dir.x === 0 || dir.y === 0) return false;
  return (
    !isWalkable(map, { x: from.x + dir.x, y: from.y }) ||
    !isWalkable(map, { x: from.x, y: from.y + dir.y })
  );
}

export function moveToward(player: Tile, dir: Tile, map: TileMap): boolean {
  const target: Tile = { x: player.x + dir.x, y: player.y + dir.y };
  if (!isWalkable(map, target)) return false;
  player.x = target.x;
  player.y = target.y;
  return true;
}

export type MoveResult = Readonly<{ to: Tile; jumped: boolean }>;

/**
 * Resolves one cardinal step. A `LEDGE` blocks entry from every side, but
 * stepping south onto a ledge jumps over it to the tile beyond, one way - the
 * classic down-only ledge.
 */
export function resolveMove(map: TileMap, from: Tile, dir: Tile): MoveResult | undefined {
  const direct: Tile = { x: from.x + dir.x, y: from.y + dir.y };
  if (tileAt(map, direct) === LEDGE) {
    if (dir.x !== 0 || dir.y !== 1) return undefined;
    const landing: Tile = { x: from.x, y: from.y + 2 };
    if (!isWalkable(map, landing)) return undefined;
    return { to: landing, jumped: true };
  }
  if (!isWalkable(map, direct)) return undefined;
  return { to: direct, jumped: false };
}

export function tileAt(map: TileMap, tile: Tile): number | undefined {
  if (tile.y < 0 || tile.y >= map.length) return undefined;
  return map[tile.y][tile.x];
}

/** Tall grass is walkable and the only tile that rolls a wild encounter. */
export function triggersWildEncounter(map: TileMap, tile: Tile): boolean {
  return tileAt(map, tile) === TALL_GRASS;
}

export function isExit(map: TileMap, tile: Tile): boolean {
  return tileAt(map, tile) === EXIT;
}

export function mapSize(map: TileMap): { width: number; height: number } {
  const height = map.length;
  const width = height > 0 ? map[0].length : 0;
  return { width, height };
}

/** The pixel size a rendered map needs at `tileSize` px, for the camera bounds. */
export function mapPixelSize(map: TileMap, tileSize: number): { width: number; height: number } {
  const size = mapSize(map);
  return { width: size.width * tileSize, height: size.height * tileSize };
}

/**
 * A copy of `map` framed by `margin` rings of `fill` (the same count on every side
 * when it is a plain number, or `{ x, y }` when the frame is deeper top/bottom than
 * left/right, as the FRLG tree border needs). The scene renders a route through
 * this padded map so a camera that follows the player past the playable edge shows
 * more terrain (forest, rock) instead of the empty background, while movement and
 * validation keep using the original map.
 */
export type MapMargin = number | Readonly<{ x: number; y: number }>;

export function padMap(map: TileMap, margin: MapMargin, fill: number): TileMap {
  const mx = typeof margin === 'number' ? margin : margin.x;
  const my = typeof margin === 'number' ? margin : margin.y;
  if (mx <= 0 && my <= 0) return map;
  const height = map.length;
  const innerWidth = height > 0 ? map[0].length : 0;
  const width = innerWidth + mx * 2;
  const side = new Array<number>(mx).fill(fill);
  const out: number[][] = [];
  for (let i = 0; i < my; i++) out.push(new Array<number>(width).fill(fill));
  for (const row of map) out.push([...side, ...row, ...side]);
  for (let i = 0; i < my; i++) out.push(new Array<number>(width).fill(fill));
  return out;
}

/**
 * One character per tile, for hand-authored maps in tests, fixtures and the
 * scaffold scene. Unknown characters throw: a typo in a sketch should fail
 * loudly at build/test time, not silently render as floor.
 */
export const SKETCH_LEGEND: Readonly<Record<string, number>> = {
  '.': FLOOR,
  '#': WALL,
  E: EXIT,
  T: TRAP,
  C: CHEST,
  I: ITEM,
  '~': WATER,
  ',': CARPET,
  '"': TALL_GRASS,
  '^': LEDGE,
  B: BUSH,
  R: ROCK,
};

export function mapFromSketch(rows: readonly string[]): TileMap {
  return rows.map((row, y) =>
    [...row].map((char, x) => {
      const value = SKETCH_LEGEND[char];
      if (value === undefined) {
        throw new Error(`Unknown sketch character "${char}" at ${x},${y}`);
      }
      return value;
    }),
  );
}
