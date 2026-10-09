import type { BiomeId } from '../../data/biomes';
import { FINITE_MAPS } from '../../data/maps';
import type { Access } from '../routes/layout';
import {
  MAP_EDGES,
  arrivalEdgeFor,
  freeEdges,
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
  /** Route openings: one entry (the arrival edge) plus every link, plus the portal when open. */
  openings: readonly Access[];
  entryEdge: MapEdge;
  /** True when this room fields the map's boss. */
  boss: boolean;
  /** The portal's edge once the boss has fallen, else null. */
  portalEdge: MapEdge | null;
}>;

/**
 * A room as the route builder and the scene need it: its plan size, its opening
 * set (arrival marked `entry`, links and the open portal as `exit`) and whether it
 * is the boss room. `portalOpen` is false while the boss stands, so the portal
 * wall stays sealed.
 */
export function roomView(plan: MapPlan, roomId: number, portalOpen: boolean): RoomView {
  const room = plan.rooms[roomId];
  if (!room) throw new Error(`map ${plan.mapIndex} has no room ${roomId}`);
  const entryEdge = arrivalEdgeFor(plan, roomId);
  const portalEdge = portalOpen ? portalEdgeFor(plan, roomId) : null;

  const edges: MapEdge[] = [entryEdge];
  for (const edge of MAP_EDGES) {
    if (linkedNeighbour(plan, roomId, edge) !== undefined) edges.push(edge);
  }
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
