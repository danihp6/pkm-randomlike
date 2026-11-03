import { biomeForRoute } from '../../../data/biomes';
import type { Tile } from '../../grid';
import type { TileMap } from '../../map';
import { openingBandCells } from '../../routes/doors';
import { SHAPES, type AccessEdge } from '../../routes/layout';
import type { RouteMap } from '../../routes/routeMap';
import { sketchRoute, type RouteRequest } from '../../routes/sketch';
import { DEFAULT_WALL_FOOTPRINT } from '../../routes/walls';
import { nodeOf, type RegionPlan } from '../plan';
import { nodeStreams } from '../streams';
import { planRouteLayout, type RouteOpening, type RouteOpeningRole, type RouteScreen } from './layout';

/**
 * The carver's road through the whole region: a route node becomes one continuous
 * tall map — `ROUTE_WIDTH` wide, `ROUTE_HEIGHTS` tall — with one opening band per
 * neighbour the plan names. Nothing here draws and nothing here populates: the
 * scene walks `tiles`, and the population pass reuses this same map.
 */

/** One opening's whole band of border cells. */
export type RouteOpeningBand = Readonly<{
  edge: AccessEdge;
  role: RouteOpeningRole;
  neighbourKey: string;
  /** The band cells on the map border, in `openingBandCells` order. */
  tiles: readonly Tile[];
}>;

/** A generated region route: one continuous map, no rooms, no doors. */
export type RegionRouteMap = Readonly<{
  seed: string;
  key: string;
  biomeId: string;
  width: number;
  height: number;
  tiles: TileMap;
  /** The entry band's anchor tile (the carver's `entry`). */
  entry: Tile;
  /** One tile per exit band, in `bands` order (`[]` for a lateral). */
  exits: readonly Tile[];
  /** The guaranteed lane from the entry band to every exit band. */
  spine: readonly Tile[];
  screens: readonly RouteScreen[];
  /** One band per opening, in `layout.openings` order. */
  bands: readonly RouteOpeningBand[];
}>;

/**
 * The carve seed `planRouteLayout` draws second off the node's `layout` stream. It
 * replays the same two draws in the same order rather than widening `RouteLayout`,
 * so a forced height hands the carver the seed the rolled height would have.
 */
function carveSeedOf(plan: RegionPlan, key: string): string {
  const rng = nodeStreams(plan.seed, key).layout;
  rng.int(2, 4);
  return String(rng.int(0, 0x7fffffff));
}

/**
 * The entries are the layout's openings; the entry band is anchored on the
 * carver's `entry` and the exit bands on its `exits` in order. Every band is cut at
 * the carver's own lane width, so a band that reads as a bar in the scene is the
 * same stretch of border the lane opened. Reads no RNG.
 */ function openingBands(
  route: RouteMap,
  openings: readonly RouteOpening[],
): readonly RouteOpeningBand[] {
  const laneWidth = SHAPES[route.shape].pathWidth;
  let exitIndex = 0;
  return openings.map((opening) => {
    const anchor = opening.role === 'entry' ? route.entry : route.exits[exitIndex++];
    return {
      edge: opening.edge,
      role: opening.role,
      neighbourKey: opening.neighbourKey,
      tiles: openingBandCells(opening.edge, anchor, route.width, route.height, laneWidth),
    };
  });
}

/**
 * One carve for the whole route, never one per screen: the carver picks each
 * opening's border column off its own stream and `RouteRequest` cannot force it, so
 * two slices joined at a seam would open it at two different columns and leave a
 * horizontal tunnel across the map. Handed the route's whole height, its openings
 * and its biome, it returns a map that already crosses every screen.
 */
export function generateRoute(plan: RegionPlan, key: string, screens?: 2 | 3 | 4): RegionRouteMap {
  const node = nodeOf(plan, key);
  if (node === undefined) {
    throw new Error(`not a route node: ${key}`);
  }
  const layout = planRouteLayout(plan, key, screens);
  const biome = biomeForRoute(node.id);
  const request: RouteRequest = {
    seed: carveSeedOf(plan, key),
    routeIndex: 0,
    biomeId: layout.biomeId,
    layout: biome.layout,
    width: layout.width,
    height: layout.height,
    openings: layout.openings.map(({ edge, role }) => ({ edge, role })),
    grassPatches: biome.terrain.grassPatches,
    ledges: biome.terrain.ledges,
    wall: DEFAULT_WALL_FOOTPRINT,
  };
  const route = sketchRoute(request);
  return {
    seed: plan.seed,
    key,
    biomeId: layout.biomeId,
    width: layout.width,
    height: layout.height,
    tiles: route.tiles,
    entry: route.entry,
    exits: route.exits,
    spine: route.spine,
    screens: layout.screens,
    bands: openingBands(route, layout.openings),
  };
}
