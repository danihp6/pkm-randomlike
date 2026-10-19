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
  type MapRoomSpecial,
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

/** The mini-boss's stable trainer id (`docs/maps-spec.md` §7), distinct from a regular one. */
export function miniBossTrainerId(mapIndex: number): string {
  return `miniboss-${mapIndex}`;
}

/** The no-heal room's stable trainer id, distinct from a regular one. */
export function noHealTrainerId(mapIndex: number): string {
  return `noheal-${mapIndex}`;
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
  /**
   * Route openings: every link, plus the boss room's portal. The portal is always
   * part of the geometry (so the room never re-rolls when it opens); the scene seals
   * it until `portalOpen`.
   */
  openings: readonly Access[];
  /** The door the player arrives through, or null when the room spawns at its centre. */
  entryEdge: MapEdge | null;
  /** True when this room is the map's **entry** room (it spawns at its centre). */
  entry: boolean;
  /** True when this room fields the map's boss. */
  boss: boolean;
  /** The special this room holds (a shop/mini-boss/mega-stone leaf), or null. */
  special: MapRoomSpecial | null;
  /** The boss room's portal edge (on a free wall), or null for any other room. */
  portalEdge: MapEdge | null;
  /** True once the boss has fallen, so the portal is open and can be walked through. */
  portalOpen: boolean;
}>;

/**
 * A room as the route builder and the scene need it: its plan size, its carved
 * opening set (every **link**, plus the boss room's portal) and whether it is the
 * boss room. The portal is carved from the start but **sealed** while the boss
 * stands, so the room looks identical before and after it opens.
 *
 * The **map entry room** has no outward door. A fresh run or a portal step (an
 * arrival on the map's entry edge) spawns the player at the room's **centre**, so
 * there is no opening that leads back off the map; walking **back** into it through
 * a link spawns at that link like any other room. Every other arrival is a link the
 * player walked in through (`docs/maps-spec.md` §2: leave East, enter West), which
 * `entryEdge` names; the scene passes `OPPOSITE_EDGE` of the door it used, or
 * `arrivalEdgeFor` is used.
 *
 * A room's opening **edges** never depend on the arrival, so a room is carved
 * identically on every visit and its trainer/item ids stay stable (a beaten trainer
 * stays beaten). Only the **spawn** differs for the map entry room: its centre on a
 * fresh arrival, its single link when the player walks back in.
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
  // A room spawns at the link the player walked in through. The map entry room is
  // the one exception: it has no outward door, so a fresh run or a portal step
  // (arrival on the map's entry edge) spawns at its **centre**, while walking back
  // into it through a link spawns at that link like any other room.
  const entryEdge =
    linkedNeighbour(plan, roomId, arrival) !== undefined
      ? arrival
      : roomId === plan.entryRoom
        ? null
        : arrivalEdgeFor(plan, roomId);
  // The portal is carved from the start and only opened when the boss falls.
  const portalEdge = portalEdgeFor(plan, roomId);

  // The carved geometry is the plan's **link** openings (the entry room's outward
  // door is dropped) plus the portal. It does not depend on the arrival.
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
    entry: roomId === plan.entryRoom,
    boss: plan.bossRoom === roomId,
    special: room.special,
    portalEdge,
    portalOpen: portalOpen && portalEdge !== null,
  };
}

/** The room reached by leaving `roomId` through `edge`; undefined for the map entry or a wall. */
export function roomAcross(plan: MapPlan, roomId: number, edge: MapEdge): number | undefined {
  return linkedNeighbour(plan, roomId, edge);
}
