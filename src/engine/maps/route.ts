import type { Access } from '../routes/layout';
import type { BiomeId } from '../../data/biomes';
import type { MapPlan } from './plan';

/**
 * The inputs a **route** of a map room needs: the plan's size (each room rolls its
 * own width and height, `docs/maps-spec.md` §1/§4) and its opening set, so the
 * route builder never falls back to the fixed 20x20 or a rolled shape. The biome
 * is the map's; the level band and roster are wired later (`TODO.md` Phase 9).
 */
export type RoomRoute = Readonly<{
  routeIndex: number;
  roomId: number;
  biomeId: BiomeId;
  width: number;
  height: number;
  openings: readonly Access[];
}>;

/**
 * Derives a room's route inputs from the plan. The room's plan `entry` opening
 * (the entry room's outward door) becomes the route's entry; every other opening
 * is an exit. A regular room has no `entry` opening, so its first opening is the
 * arrival point and the rest are exits — the geometry is the same either way.
 */
export function routeForRoom(plan: MapPlan, roomId: number, routeIndex: number): RoomRoute {
  const room = plan.rooms[roomId];
  if (!room) throw new Error(`map ${plan.mapIndex} has no room ${roomId}`);
  const entry = room.openings.find((opening) => opening.kind === 'entry') ?? room.openings[0];
  return {
    routeIndex,
    roomId,
    biomeId: plan.biomeId,
    width: room.width,
    height: room.height,
    openings: room.openings.map((opening) => ({
      edge: opening.edge,
      role: opening.edge === entry.edge ? 'entry' : 'exit',
    })),
  };
}
