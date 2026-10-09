import type { BiomeId } from '../../data/biomes';
import { FINITE_MAPS } from '../../data/maps';
import type { Access } from '../routes/layout';
import {
  MAP_EDGES,
  arrivalEdgeFor,
  freeEdges,
  isArrivalEdge,
  linkedNeighbour,
  type MapEdge,
  type MapPlan,
} from './plan';

/**
 * The boss/portal layer of a map floor (`docs/maps-spec.md` §6, D31): which room
 * fields the boss, which free wall its portal opens onto once the boss falls, and
 * the opening set the route builder should punch for a room. Pure geometry over a
 * `MapPlan` plus the run's two bits of progress (`roomId`, `bossDefeated`); the
 * scene only asks and draws.
 */

/** A finite run's final map: no portal, its boss ends the run. */
export function isFinalMap(mode: 'finite' | 'infinite', mapIndex: number): boolean {
  return mode === 'finite' && mapIndex >= FINITE_MAPS;
}

/** The map boss's stable trainer id, so a run can never mistake it for a regular one. */
export function bossTrainerId(mapIndex: number): string {
  return `boss-${mapIndex}`;
}

/**
 * The edge the boss room's portal opens onto, or null when `roomId` is not the
 * boss room (or has no free wall, which the floor graph never produces). The pick
 * is deterministic, so a fixed seed always opens the same door.
 */
export function portalEdgeFor(plan: MapPlan, roomId: number): MapEdge | null {
  if (plan.bossRoom !== roomId) return null;
  const free = freeEdges(plan, roomId);
  if (free.length === 0) return null;
  return free[roomId % free.length];
}

export type RoomView = Readonly<{
  mapIndex: number;
  roomId: number;
  roomCount: number;
  biomeId: BiomeId;
  width: number;
  height: number;
  /** Route openings: every link, plus the portal when open (the map entry has none). */
  openings: readonly Access[];
  /** The door the player arrives through, or null when the room spawns at its centre. */
  entryEdge: MapEdge | null;
  /** True when this room fields the map's boss. */
  boss: boolean;
  /** The portal's edge once the boss has fallen, else null. */
  portalEdge: MapEdge | null;
}>;

/**
 * A room as the route builder and the scene need it: its plan size, its carved
 * opening set (every **link**, plus the open portal) and whether it is the boss
 * room. `portalOpen` is false while the boss stands, so the portal wall stays
 * sealed.
 *
 * The **map entry room** has no outward door: it spawns the player at the room's
 * **centre** (a fresh run or a portal step), so there is no opening that leads back
 * off the map. Every other arrival is a link the player walked in through
 * (`docs/maps-spec.md` §2: leave East, enter West), which `entryEdge` names; the
 * scene passes `OPPOSITE_EDGE` of the door it used, or `arrivalEdgeFor` is used.
 *
 * The opening set never depends on the arrival, so a room is carved identically on
 * every visit and its trainer/item ids stay stable (a beaten trainer stays beaten).
 */
export function roomView(
  plan: MapPlan,
  roomId: number,
  portalOpen: boolean,
  arrivalEdge?: MapEdge,
): RoomView {
  const room = plan.rooms[roomId];
  if (!room) throw new Error(`map ${plan.mapIndex} has no room ${roomId}`);
  const arrival = isArrivalEdge(plan, roomId, arrivalEdge)
    ? (arrivalEdge as MapEdge)
    : arrivalEdgeFor(plan, roomId);
  // The map entry room always spawns at its centre (no outward door); every other
  // room spawns at the link the player walked in through.
  const entryEdge =
    roomId === plan.entryRoom
      ? null
      : linkedNeighbour(plan, roomId, arrival) !== undefined
        ? arrival
        : arrivalEdgeFor(plan, roomId);
  const portalEdge = portalOpen ? portalEdgeFor(plan, roomId) : null;

  // The carved geometry is the plan's **link** openings (the entry room's outward
  // door is dropped) plus the open portal. It does not depend on the arrival.
  const edges: MapEdge[] = room.openings
    .filter((opening) => opening.kind === 'link')
    .map((opening) => opening.edge);
  if (portalEdge) edges.push(portalEdge);
  const unique = [...new Set(edges)].sort((a, b) => MAP_EDGES.indexOf(a) - MAP_EDGES.indexOf(b));
  const openings: Access[] = unique.map((edge) => ({
    edge,
    role: edge === entryEdge ? 'entry' : 'exit',
  }));

  return {
    mapIndex: plan.mapIndex,
    roomId,
    roomCount: plan.rooms.length,
    biomeId: plan.biomeId,
    width: room.width,
    height: room.height,
    openings,
    entryEdge,
    boss: plan.bossRoom === roomId,
    portalEdge,
  };
}

/** The room reached by leaving `roomId` through `edge`; undefined for the map entry or a wall. */
export function roomAcross(plan: MapPlan, roomId: number, edge: MapEdge): number | undefined {
  return linkedNeighbour(plan, roomId, edge);
}
