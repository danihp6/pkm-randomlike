import type { Tile } from '../grid';
import type { TileMap } from '../map';
import type { RouteShape } from './layout';

/** A ground item placed at the far end of an optional path (a `pocket`). */
export type RouteItem = Readonly<{
  /** Stable across a route rebuild: `item-<routeIndex>-<i>` (D11). */
  id: string;
  position: Tile;
  itemId: string;
  /** Hidden items draw as a faint sparkle instead of a Poke Ball. */
  hidden: boolean;
}>;

/**
 * A generated route, complete enough that the scene never re-derives it: the
 * tiles, the entry, every exit and the ground items.
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
  /** Any one of these ends the route (one per shape opening of that role). */
  exits: readonly Tile[];
  /** The guaranteed lane the terrain never blocks (entry → every exit). */
  spine: readonly Tile[];
  /** Secondary lanes carved off the spine (optional exploration paths). */
  branches: readonly Tile[];
  /** Terminal tiles of the branch lanes - the loot spots. */
  pockets: readonly Tile[];
  /** One ground item per optional path, at its pocket. */
  items: readonly RouteItem[];
}>;

export function tileKey(tile: Tile): string {
  return `${tile.x},${tile.y}`;
}

export function sameTile(a: Tile, b: Tile): boolean {
  return a.x === b.x && a.y === b.y;
}
