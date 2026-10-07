import type { Tile } from '../grid';
import { isWalkable, type TileMap } from '../map';
import {
  FACING_VECTORS,
  sameTile,
  tileKey,
  type Facing,
  type RouteMap,
  type RouteTrainer,
} from './routeMap';

/**
 * Anything the player cannot cross - a wall, water or a ledge - blocks a sight
 * line, and so does another trainer. A trainer never sees across an obstacle it
 * could not chase over. Callers pass the **movement** map, where a walkable tree
 * tip is already floor, so a player walking along the tips stays visible.
 */
export function blocksSight(map: TileMap, tile: Tile, blockers: ReadonlySet<string>): boolean {
  return !isWalkable(map, tile) || blockers.has(tileKey(tile));
}

/**
 * The tiles a trainer watches, nearest first, up to its `sight` range. The line
 * runs straight along `facing` and stops at the first impassable tile (or another
 * trainer). `tiles` defaults to the route's raw map; pass the movement map so a
 * walkable tree tip does not cut the line.
 */
export function sightLine(
  route: RouteMap,
  trainer: RouteTrainer,
  blockers?: ReadonlySet<string>,
  tiles: TileMap = route.tiles,
): readonly Tile[] {
  const blockSet = blockers ?? trainerBlockers(route, trainer);
  const vector = FACING_VECTORS[trainer.facing];
  const seen: Tile[] = [];
  let current: Tile = trainer.position;
  for (let step = 0; step < trainer.sight; step++) {
    current = { x: current.x + vector.x, y: current.y + vector.y };
    if (blocksSight(tiles, current, blockSet)) break;
    seen.push(current);
  }
  return seen;
}

/**
 * True when the player stands in the trainer's line: straight ahead along its
 * facing, within `sight`, with nothing impassable or another trainer between
 * them. Walking into that line is what opens the battle. `tiles` is the movement
 * map (see `sightLine`).
 */
export function seesPlayer(
  route: RouteMap,
  trainer: RouteTrainer,
  player: Tile,
  tiles: TileMap = route.tiles,
): boolean {
  const vector = FACING_VECTORS[trainer.facing];
  const delta = { x: player.x - trainer.position.x, y: player.y - trainer.position.y };
  const cross = delta.x * vector.y - delta.y * vector.x;
  const dot = delta.x * vector.x + delta.y * vector.y;
  if (cross !== 0 || dot <= 0) return false;
  const distance = Math.abs(delta.x) + Math.abs(delta.y);
  if (distance > trainer.sight) return false;
  return sightLine(route, trainer, undefined, tiles).some((tile) => sameTile(tile, player));
}

/** Trainer positions, keyed for blocking and sight checks. */
export function trainerBlockers(route: RouteMap, except?: RouteTrainer): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const trainer of route.trainers) {
    if (except && trainer.id === except.id) continue;
    keys.add(tileKey(trainer.position));
  }
  return keys;
}

export function trainerAt(route: RouteMap, tile: Tile): RouteTrainer | undefined {
  return route.trainers.find((trainer) => sameTile(trainer.position, tile));
}

/** The cardinal a facing names as a `Tile` step. */
export function facingVector(facing: Facing): Tile {
  return FACING_VECTORS[facing];
}
