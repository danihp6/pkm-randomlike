import type { Tile } from '../grid';
import type { TileMap } from '../map';
import type { RouteShape } from './layout';

/**
 * A generated route, complete enough that the scene never re-derives it: the
 * tiles, the entry and every exit.
 */
export type RouteMap = Readonly<{
  seed: string;
  routeIndex: number;
  biomeId: string;
  /** The geometry the generator built: straight | bend | cross. */
  shape: RouteShape;
  width: number;
  height: number;
  tiles: TileMap;
  /** Where the player arrives from the previous route. */
  entry: Tile;
  /** Any one of these ends the route (one for now, more with a `cross`). */
  exits: readonly Tile[];
}>;

export function tileKey(tile: Tile): string {
  return `${tile.x},${tile.y}`;
}

export function sameTile(a: Tile, b: Tile): boolean {
  return a.x === b.x && a.y === b.y;
}
