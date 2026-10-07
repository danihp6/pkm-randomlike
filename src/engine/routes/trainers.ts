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
 * could not chase over.
 */
export function blocksSight(map: TileMap, tile: Tile, blockers: ReadonlySet<string>): boolean {
  return !isWalkable(map, tile) || blockers.has(tileKey(tile));
}

/**
 * The tiles a trainer watches, nearest first, up to its `sight` range. The line
 * runs straight along `facing` and stops at the first wall (or another trainer).
 */
export function sightLine(
  route: RouteMap,
  trainer: RouteTrainer,
  blockers?: ReadonlySet<string>,
): readonly Tile[] {
  const blockSet = blockers ?? trainerBlockers(route, trainer);
  const vector = FACING_VECTORS[trainer.facing];
  const seen: Tile[] = [];
  let current: Tile = trainer.position;
  for (let step = 0; step < trainer.sight; step++) {
    current = { x: current.x + vector.x, y: current.y + vector.y };
    if (blocksSight(route.tiles, current, blockSet)) break;
    seen.push(current);
  }
  return seen;
}

/**
 * True when the player stands in the trainer's cone: straight ahead along its
 * facing, within `sight`, with no wall or other trainer between them. Walking
 * into that cone is what opens the battle.
 */
export function seesPlayer(route: RouteMap, trainer: RouteTrainer, player: Tile): boolean {
  const vector = FACING_VECTORS[trainer.facing];
  const delta = { x: player.x - trainer.position.x, y: player.y - trainer.position.y };
  const cross = delta.x * vector.y - delta.y * vector.x;
  const dot = delta.x * vector.x + delta.y * vector.y;
  if (cross !== 0 || dot <= 0) return false;
  const distance = Math.abs(delta.x) + Math.abs(delta.y);
  if (distance > trainer.sight) return false;
  return sightLine(route, trainer).some((tile) => sameTile(tile, player));
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
