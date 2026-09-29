import type { Tile } from '../grid';
import { isWalkable, type TileMap } from '../map';
import { tileKey, type RouteMap } from './routeMap';

const CARDINALS: readonly Tile[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/** Cardinal flood-fill over walkable tiles, from `from` (inclusive). */
export function reachableTiles(map: TileMap, from: Tile): Set<string> {
  const reached = new Set<string>();
  if (!isWalkable(map, from)) return reached;
  const queue: Tile[] = [from];
  reached.add(tileKey(from));
  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const step of CARDINALS) {
      const next = { x: current.x + step.x, y: current.y + step.y };
      const key = tileKey(next);
      if (reached.has(key) || !isWalkable(map, next)) continue;
      reached.add(key);
      queue.push(next);
    }
  }
  return reached;
}

export type RouteValidation = Readonly<{
  ok: boolean;
  /** Tile keys the player cannot reach from the start (exit and trainers only). */
  unreachable: readonly string[];
}>;

/** Start must reach the exit and every trainer, or the map is rerolled. */
export function validateRoute(route: RouteMap): RouteValidation {
  const reached = reachableTiles(route.tiles, route.start);
  const unreachable: string[] = [];
  if (!reached.has(tileKey(route.exit))) unreachable.push(tileKey(route.exit));
  for (const trainer of route.trainers) {
    if (!reached.has(tileKey(trainer.position))) unreachable.push(tileKey(trainer.position));
  }
  return { ok: unreachable.length === 0, unreachable };
}
