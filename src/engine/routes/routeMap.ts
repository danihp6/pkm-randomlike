import type { Tile } from '../grid';
import type { TileMap } from '../map';

export type Facing = 'N' | 'E' | 'S' | 'W';

export const FACING_VECTORS: Readonly<Record<Facing, Tile>> = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};

export const FACINGS: readonly Facing[] = ['N', 'E', 'S', 'W'];

export type RouteTrainer = Readonly<{
  id: string;
  position: Tile;
  facing: Facing;
  sight: number;
  archetypeId: string;
}>;

export type RouteItem = Readonly<{
  id: string;
  position: Tile;
  itemId: string;
}>;

/**
 * A generated route, complete enough that the scene never re-derives it: the
 * tiles, the start/exit, the trainers and the floor items.
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
  trainers: readonly RouteTrainer[];
  items: readonly RouteItem[];
}>;

export function tileKey(tile: Tile): string {
  return `${tile.x},${tile.y}`;
}

export function sameTile(a: Tile, b: Tile): boolean {
  return a.x === b.x && a.y === b.y;
}
