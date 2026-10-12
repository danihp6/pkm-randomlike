import type { Tile } from '../grid';
import { FLOOR, LEDGE, TALL_GRASS, WALL, isWalkable, tileAt, type TileMap } from '../map';
import {
  sameTile,
  tileKey,
  type Facing,
  type RouteMap,
  type RouteTrainer,
} from './routeMap';
import { sightLine, trainerBlockers } from './trainers';

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

/** Why a trainer fails the pose rules (`docs/route-generator.md` §3.4/§4). */
export type TrainerIssueReason =
  | 'off-floor'
  | 'no-backing-wall'
  | 'on-entry'
  | 'on-exit'
  | 'on-pocket'
  | 'crowded'
  | 'sees-entry';

export type TrainerIssue = Readonly<{
  /** The trainer's own `id` (`trainer-<routeIndex>-<i>`). */
  trainerId: string;
  /** Every reason that trainer fails, in the order listed above. */
  reasons: readonly TrainerIssueReason[];
}>;

export type RouteValidation = Readonly<{
  ok: boolean;
  /** Exits the entry cannot reach at all (tile keys). Unchanged. */
  unreachable: readonly string[];
  /** Exits reachable only through a trainer's tile (tile keys). Unchanged. */
  blockedByTrainers: readonly string[];
  /** Placed items whose tile is not reachable from the entry (item ids). */
  strandedItems: readonly string[];
  /** Placed items whose tile is `TALL_GRASS` or `LEDGE` (item ids). */
  itemsOnTerrain: readonly string[];
  /** Spine tiles that are not `FLOOR` (tile keys). */
  spineBlocked: readonly string[];
  /** Open border tiles not connected to an opening along the ring (tile keys). */
  borderBreaches: readonly string[];
  /** Pockets the entry cannot reach (tile keys). Reported, never gated. */
  unreachablePockets: readonly string[];
  /** Trainers that fail a pose rule, one entry each, in `route.trainers` order. */
  trainerIssues: readonly TrainerIssue[];
}>;

/** True when one of the four cardinal neighbours of `tile` is a raw `WALL`. */
function hasWallNeighbour(map: TileMap, tile: Tile): boolean {
  return CARDINALS.some(
    (step) => tileAt(map, { x: tile.x + step.x, y: tile.y + step.y }) === WALL,
  );
}

/** Two trainers in one of the eight tiles around each other (`crowded`). */
function chebyshevOne(a: Tile, b: Tile): boolean {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) === 1;
}

/** True when `trainer` watches the entry, on its own facing or on any turn. */
function seesEntry(route: RouteMap, trainer: RouteTrainer, blockers: ReadonlySet<string>): boolean {
  const onFacing = (facing: Facing): boolean => {
    const probe = facing === trainer.facing ? trainer : { ...trainer, facing };
    return sightLine(route, probe, blockers).some((tile) => sameTile(tile, route.entry));
  };
  return onFacing(trainer.facing) || (trainer.turns ?? []).some(onFacing);
}

/** Every trainer that breaks a pose rule, with the reasons it breaks. */
function trainerIssuesOf(route: RouteMap): TrainerIssue[] {
  const issues: TrainerIssue[] = [];
  route.trainers.forEach((trainer, index) => {
    const tile = trainer.position;
    const reasons: TrainerIssueReason[] = [];
    if (tileAt(route.tiles, tile) !== FLOOR) reasons.push('off-floor');
    if (!hasWallNeighbour(route.tiles, tile)) reasons.push('no-backing-wall');
    if (sameTile(tile, route.entry)) reasons.push('on-entry');
    if (route.exits.some((exit) => sameTile(tile, exit))) reasons.push('on-exit');
    if (route.pockets.some((pocket) => sameTile(tile, pocket))) reasons.push('on-pocket');
    const crowded = route.trainers.some(
      (other, otherIndex) => otherIndex !== index && chebyshevOne(tile, other.position),
    );
    if (crowded) reasons.push('crowded');
    if (seesEntry(route, trainer, trainerBlockers(route, trainer))) reasons.push('sees-entry');
    if (reasons.length > 0) issues.push({ trainerId: trainer.id, reasons });
  });
  return issues;
}

/**
 * The ring cells that open the fence without an opening to justify them: a flood
 * runs along the ring from the entry and the exits, so every open ring cell
 * connected to an opening is legal - including the cells `cleanWalls` widens
 * beside one - and a lane that punched through the fence elsewhere is a breach.
 * Reported in row-major order.
 */
function borderBreaches(route: RouteMap): string[] {
  const { width, height, tiles } = route;
  const onRing = (x: number, y: number): boolean =>
    x === 0 || x === width - 1 || y === 0 || y === height - 1;
  const reached = new Set<string>();
  const stack: Tile[] = [route.entry, ...route.exits];
  for (const tile of stack) reached.add(tileKey(tile));
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const step of CARDINALS) {
      const next = { x: current.x + step.x, y: current.y + step.y };
      if (next.x < 0 || next.x >= width || next.y < 0 || next.y >= height) continue;
      if (!onRing(next.x, next.y) || tiles[next.y][next.x] === WALL) continue;
      const key = tileKey(next);
      if (reached.has(key)) continue;
      reached.add(key);
      stack.push(next);
    }
  }
  const breaches: string[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!onRing(x, y) || tiles[y][x] === WALL) continue;
      const key = `${x},${y}`;
      if (!reached.has(key)) breaches.push(key);
    }
  }
  return breaches;
}

/**
 * The generator's own checklist (`docs/route-generator.md` §4), as a report: the
 * entry must reach every exit with and without the trainers in the way, no placed
 * item may be stranded or sit on terrain, the guaranteed lane stays `FLOOR`, the
 * border ring stays solid but for its openings, and every trainer is posed the
 * way `placeTrainers` promises. A route is rerolled (`sketchRoute`) unless `ok`.
 *
 * A pocket the entry cannot reach is **reported only**: `placeItems` may skip a
 * pocket a hazard sealed, so it is a finding, never a reason to reroll.
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
  const strandedItems = route.items
    .filter((item) => !reached.has(tileKey(item.position)))
    .map((item) => item.id);
  const itemsOnTerrain = route.items
    .filter((item) => {
      const tile = tileAt(route.tiles, item.position);
      return tile === TALL_GRASS || tile === LEDGE;
    })
    .map((item) => item.id);
  const spineBlocked = route.spine
    .filter((tile) => tileAt(route.tiles, tile) !== FLOOR)
    .map((tile) => tileKey(tile));
  const breaches = borderBreaches(route);
  const unreachablePockets = route.pockets
    .map((pocket) => tileKey(pocket))
    .filter((key) => !reached.has(key));
  const trainerIssues = trainerIssuesOf(route);
  return {
    ok:
      unreachable.length === 0 &&
      blockedByTrainers.length === 0 &&
      strandedItems.length === 0 &&
      itemsOnTerrain.length === 0 &&
      spineBlocked.length === 0 &&
      breaches.length === 0 &&
      trainerIssues.length === 0,
    unreachable,
    blockedByTrainers,
    strandedItems,
    itemsOnTerrain,
    spineBlocked,
    borderBreaches: breaches,
    unreachablePockets,
    trainerIssues,
  };
}
