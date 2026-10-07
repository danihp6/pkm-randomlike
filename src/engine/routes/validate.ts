import type { Tile } from '../grid';
import { isWalkable, type TileMap } from '../map';
import { tileKey, type RouteMap } from './routeMap';
import { trainerBlockers } from './trainers';

const CARDINALS: readonly Tile[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/** Cardinal flood-fill over walkable tiles, from `from` (inclusive). */
export function reachableTiles(map: TileMap, from: Tile): Set<string> {
  return reachableAvoiding(map, from, EMPTY);
}

const EMPTY: ReadonlySet<string> = new Set();

/**
 * Cardinal flood-fill over walkable tiles, skipping `blocked` cells. Used to
 * prove a route still reaches its exits with the trainers treated as blockers,
 * so no placement can soft-lock the route behind an unwinnable fight.
 */
export function reachableAvoiding(
  map: TileMap,
  from: Tile,
  blocked: ReadonlySet<string>,
): Set<string> {
  const reached = new Set<string>();
  if (blocked.has(tileKey(from)) || !isWalkable(map, from)) return reached;
  const queue: Tile[] = [from];
  reached.add(tileKey(from));
  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const step of CARDINALS) {
      const next = { x: current.x + step.x, y: current.y + step.y };
      const key = tileKey(next);
      if (reached.has(key) || blocked.has(key) || !isWalkable(map, next)) continue;
      reached.add(key);
      queue.push(next);
    }
  }
  return reached;
}

export type RouteValidation = Readonly<{
  ok: boolean;
  /** Tile keys the player cannot reach from the entry (the exits only). */
  unreachable: readonly string[];
  /** Exits the player cannot reach without walking through a trainer's tile. */
  blockedByTrainers: readonly string[];
}>;

/**
 * The entry must reach every exit, with and without the trainers in the way, or
 * the map is rerolled. The trainer-free flood fill is the guarantee that a route
 * is always solvable without a forced battle (`docs/route-generator.md` §4).
 */
export function validateRoute(route: RouteMap): RouteValidation {
  const reached = reachableTiles(route.tiles, route.entry);
  const unreachable = route.exits
    .map((exit) => tileKey(exit))
    .filter((key) => !reached.has(key));
  const avoiding = reachableAvoiding(route.tiles, route.entry, trainerBlockers(route));
  const blockedByTrainers = route.exits
    .map((exit) => tileKey(exit))
    .filter((key) => !avoiding.has(key) && reached.has(key));
  return {
    ok: unreachable.length === 0 && blockedByTrainers.length === 0,
    unreachable,
    blockedByTrainers,
  };
}
