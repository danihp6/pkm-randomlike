import type { Tile } from '../grid';
import type { TileMap } from '../map';

/**
 * A generated route, complete enough that the scene never re-derives it: the
 * tiles and the start/exit.
 */
export type RouteMap = Readonly<{
  seed: string;
  routeIndex: number;
  biomeId: string;
  width: number;
  height: number;
  tiles: TileMap;
  start: Tile;
  exit: Tile;
}>;

export function tileKey(tile: Tile): string {
  return `${tile.x},${tile.y}`;
}

export function sameTile(a: Tile, b: Tile): boolean {
  return a.x === b.x && a.y === b.y;
}
