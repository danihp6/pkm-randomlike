import type { GateKind } from '../../data/gates';
import type { Tile } from '../grid';
import type { TileMap } from '../map';
import type { RouteShape } from './layout';

/** The four cardinals a trainer can look along. */
export type Facing = 'N' | 'E' | 'S' | 'W';

export const FACING_VECTORS: Readonly<Record<Facing, Tile>> = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};

export const FACINGS: readonly Facing[] = ['N', 'E', 'S', 'W'];

/** A ground item placed at the far end of an optional path (a `pocket`). */
export type RouteItem = Readonly<{
  /** Stable across a route rebuild: `item-<routeIndex>-<i>` (D11). */
  id: string;
  position: Tile;
  itemId: string;
  /** Hidden items draw the biome's floor patch instead of a Poke Ball. */
  hidden: boolean;
}>;

/**
 * A trainer standing on the route. Like the originals it blocks its tile, looks
 * down a cardinal lane (`facing`) and sees up to `sight` tiles along it. Its
 * `turns` cycle is what makes a "spinning" trainer: the scene walks the list on a
 * timer, so some trainers keep looking in different directions.
 */
export type RouteTrainer = Readonly<{
  /** Stable across a route rebuild: `trainer-<routeIndex>-<i>` (D11). */
  id: string;
  position: Tile;
  facing: Facing;
  /** How many tiles down its facing the trainer watches. */
  sight: number;
  /** Archetype id from `src/data/trainers.ts`, for the sprite and the roster. */
  archetypeId: string;
  /** Facings a spinner cycles through (2+); absent on a fixed trainer. */
  turns?: readonly Facing[];
}>;

/**
 * The room's gated vault: a one-tile chamber (`pocket`) sealed by one obstacle tile
 * (`tile`). `tile`'s map value is `GATES[kind].tile`, and when the floor's gate is
 * already open the corridor is floor and only `tile`'s position is remembered.
 */
export type RouteGate = Readonly<{
  kind: GateKind;
  /** The single seal tile: the corridor's mouth. */
  tile: Tile;
  /** The vault's own tile: the reward sits here. */
  pocket: Tile;
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
  /** The trainers on the route, off the entry so they never ambush the spawn. */
  trainers: readonly RouteTrainer[];
  /** The room's gated vault, present only when the build was asked for one. */
  gate?: RouteGate;
}>;

export function tileKey(tile: Tile): string {
  return `${tile.x},${tile.y}`;
}

export function sameTile(a: Tile, b: Tile): boolean {
  return a.x === b.x && a.y === b.y;
}
