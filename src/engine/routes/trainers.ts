import {
  SPECIAL_TRAINER_ROWS,
  getTrainerArchetype,
  type SpecialTrainerRow,
  type TrainerArchetype,
} from '../../data/trainers';
import type { Tile } from '../grid';
import type { MapRoomRole } from '../maps/plan';
import { isWalkable, type TileMap } from '../map';
import { Rng, hashSeed } from '../rng';
import type { TrainerRosterEntry } from '../run/battleLink';
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

/** The Manhattan distance within which an `invisible` archetype's sprite shows: 1. */
export const INVISIBLE_REVEAL_DISTANCE = 1;

/**
 * True when `archetype`'s route sprite must stay hidden with the player on `player`.
 * Only an `invisible` sight mode hides anything, and only while the Manhattan distance
 * (`|dx| + |dy|`) is greater than `INVISIBLE_REVEAL_DISTANCE`; a `visible` archetype
 * (and an unknown one) is never hidden.
 */
export function trainerHidden(
  archetype: TrainerArchetype | undefined,
  trainer: Tile,
  player: Tile,
): boolean {
  if (archetype?.sightMode !== 'invisible') return false;
  const distance = Math.abs(trainer.x - player.x) + Math.abs(trainer.y - player.y);
  return distance > INVISIBLE_REVEAL_DISTANCE;
}

export type SpecialTrainerOptions = Readonly<{
  /** The route the room already generated (`sketchRoute(...)`), trainers included. */
  route: RouteMap;
  /** The run's seed. */
  seed: string;
  /** The room's stable per-run index (`routeIndexForRoom(plan, roomId)`). */
  roomIndex: number;
  /** The plan room's population role. Only `trainers` may field one. */
  role: MapRoomRole;
  /** True for the map's entry, its boss room and every special room. */
  quiet: boolean;
  /** `RunState.missionsCompleted`, the mission record's run-scoped counter. */
  missionsCompleted: number;
  /** Rows to read; defaults to `SPECIAL_TRAINER_ROWS`. */
  rows?: readonly SpecialTrainerRow[];
}>;

/** The chance scale the table's 0..1 numbers are rounded to, so two builds agree. */
const SPECIAL_CHANCE_SCALE = 10_000;

/**
 * The room's special trainer, or null: the route's **first** trainer with its
 * `archetypeId` swapped for the drawn row. Same `id`, `position`, `facing`, `sight` and
 * `turns`, so the population pass's pose and reachability guarantees still hold and the
 * body is never added twice.
 */
export function specialTrainerFor(options: SpecialTrainerOptions): RouteTrainer | null {
  if (options.quiet || options.role !== 'trainers' || options.route.trainers.length === 0) return null;
  const first = options.route.trainers[0];

  const rows = options.rows ?? SPECIAL_TRAINER_ROWS;
  const usable: { row: SpecialTrainerRow; weight: number }[] = [];
  for (const row of rows) {
    if (getTrainerArchetype(row.archetypeId) === undefined) continue;
    if (row.minMissionsCompleted !== undefined && row.minMissionsCompleted > options.missionsCompleted) {
      continue;
    }
    const weight = Math.round(row.chance * SPECIAL_CHANCE_SCALE);
    if (weight > 0) usable.push({ row, weight });
  }
  let total = 0;
  for (const entry of usable) total += entry.weight;

  const rng = new Rng(hashSeed(`${options.seed}:special-trainer:${options.roomIndex}`));
  if (total === 0 || rng.next() * SPECIAL_CHANCE_SCALE >= total) return null;

  const ticket = rng.int(0, total - 1);
  let cumulative = 0;
  for (const entry of usable) {
    cumulative += entry.weight;
    if (cumulative > ticket) return { ...first, archetypeId: entry.row.archetypeId };
  }
  return null;
}

/** The roster with `archetype.forcedAbility` stamped on every entry, or `roster` itself. */
export function withForcedAbility(
  roster: readonly TrainerRosterEntry[],
  archetype: TrainerArchetype | undefined,
): readonly TrainerRosterEntry[] {
  const trimmed = archetype?.forcedAbility?.trim();
  if (trimmed === undefined || trimmed === '') return roster;
  const ability: string = trimmed;
  return roster.map((entry) => ({ ...entry, ability }));
}
