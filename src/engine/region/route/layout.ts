import { biomeForRoute } from '../../../data/biomes';
import { ROUTE_HEIGHTS, ROUTE_WIDTH } from '../../../data/region';
import type { Tile } from '../../grid';
import type { AccessEdge } from '../../routes/layout';
import { nodeOf, type RegionNodeKind, type RegionPlan } from '../plan';
import { nodeStreams } from '../streams';

/**
 * The long route's geometry: a route is two, three or four **screens** of one
 * biome stitched into a single tall map (`docs/routes-spec.md` §1). The plan owns
 * the node and its neighbours, so this module only turns them into a height and a
 * set of border openings; nothing here carves a tile.
 */

/** One 60x40 screen of a route, in stitched rows. */
export type RouteScreen = Readonly<{
  index: number;
  top: number;
  bottom: number;
}>;

export type RouteOpeningRole = 'entry' | 'exit';

/** One border opening: which edge it sits on and which neighbour it serves. */
export type RouteOpening = Readonly<{
  edge: AccessEdge;
  role: RouteOpeningRole;
  neighbourKey: string;
}>;

export type RouteLayout = Readonly<{
  /** `plan.seed`, the run seed. */
  seed: string;
  /** The node key, e.g. `route:3` or `lateral:5`. */
  key: string;
  /** `biomeForRoute(node.id).id` — the route's one biome. */
  biomeId: string;
  width: number;
  height: number;
  screens: readonly RouteScreen[];
  openings: readonly RouteOpening[];
}>;

export const SCREEN_HEIGHT = 40;

const SCREEN_COUNTS: readonly (2 | 3 | 4)[] = [2, 3, 4];

/** Every edge but the entry's: a tall map's other three sides, entry first. */
const EXIT_EDGES: readonly AccessEdge[] = ['S', 'E', 'W'];

/** The Victory Road leaves east into the League, so its one exit is `E`, then `S` and `W`. */
const VICTORY_ROAD_EXIT_EDGES: readonly AccessEdge[] = ['E', 'S', 'W'];

/** The Victory Road is always four screens: the gauntlet before the League is fixed. */
const VICTORY_ROAD_SCREENS = 4;

/**
 * The kinds the route screen, the carver, the preload and the content pass treat as a
 * route. The Victory Road is one: it is walked as screens off the same carver.
 */
export function isRouteKind(kind: string): boolean {
  return kind === 'route' || kind === 'lateral' || kind === 'victory-road';
}

/** The edge order a kind opens its extra neighbours in. */
function exitEdgesFor(kind: RegionNodeKind): readonly AccessEdge[] {
  return kind === 'victory-road' ? VICTORY_ROAD_EXIT_EDGES : EXIT_EDGES;
}

/**
 * The route's screens, top to bottom. A screen starts every `SCREEN_HEIGHT` rows
 * and the **last one absorbs the remainder**: `ROUTE_HEIGHTS` are 3, 4 and 5
 * rows-of-40 tall for the 2, 3 and 4 screen classes, so a stitched map is one
 * screen-and-a-bit longer than its class. Tiling the whole height is what lets
 * `spineSegments` partition the spine and a later batch anchor a screen's content,
 * and the screens stay contiguous (`bottom + 1 === next top`).
 */
export function routeScreens(screens: 2 | 3 | 4): readonly RouteScreen[] {
  const height = ROUTE_HEIGHTS[screens - 2];
  const rows: RouteScreen[] = [];
  for (let index = 0; index < screens; index++) {
    const top = index * SCREEN_HEIGHT;
    rows.push({ index, top, bottom: index === screens - 1 ? height - 1 : top + SCREEN_HEIGHT - 1 });
  }
  return rows;
}

/**
 * The neighbour a route is walked in from: the node before it on the chain, the
 * parent of a lateral, and — for a node with neither — the first of its edges in
 * sorted order, so the choice never depends on the array the plan happened to
 * build.
 */
function entryNeighbour(plan: RegionPlan, key: string, edges: readonly string[]): string | undefined {
  const at = plan.chain.indexOf(key);
  if (at > 0) return plan.chain[at - 1];
  const parent = nodeOf(plan, key)?.lateralOf;
  if (parent !== null && parent !== undefined) return parent;
  return [...edges].sort()[0];
}

/**
 * One opening per neighbour: the entry takes `N` because the chain order — not the
 * coarse map position — decides which long end is which, and every other neighbour
 * takes the next unused edge of that kind's exit order (`S`, `E`, `W` on a route and
 * a lateral, `E`, `S`, `W` on the Victory Road). A lateral has a single neighbour, so
 * it gets one `N` band and no exit at all: it is walked into and back out of
 * (`docs/region-spec.md` §1).
 */
function routeOpenings(
  plan: RegionPlan,
  key: string,
  kind: RegionNodeKind,
  edges: readonly string[],
): readonly RouteOpening[] {
  const entry = entryNeighbour(plan, key, edges);
  if (entry === undefined) return [];
  const openings: RouteOpening[] = [{ edge: 'N', role: 'entry', neighbourKey: entry }];
  const exitEdges = exitEdgesFor(kind);
  const others = edges.filter((neighbour) => neighbour !== entry);
  others.forEach((neighbourKey, index) => {
    const edge = exitEdges[index];
    if (edge !== undefined) openings.push({ edge, role: 'exit', neighbourKey });
  });
  return openings;
}

/**
 * The route's height and borders off the node alone, plus the two draws the node's
 * `layout` stream always yields: the screen count and the carve seed. The second is
 * not kept here — `map.ts` replays the same two draws to feed the carver — but it is
 * still taken, so forcing a height never moves it or any later draw on the stream
 * (`D11`). The Victory Road always uses four screens, but the draws are still taken
 * in the same order, so its carve is a four-screen route's.
 */
export function planRouteLayout(plan: RegionPlan, key: string, screens?: 2 | 3 | 4): RouteLayout {
  const node = nodeOf(plan, key);
  if (node === undefined || !isRouteKind(node.kind)) {
    throw new Error(`not a route node: ${key}`);
  }
  if (screens !== undefined && !SCREEN_COUNTS.includes(screens)) {
    throw new Error(`bad screen count: ${screens}`);
  }

  const rng = nodeStreams(plan.seed, key).layout;
  const drawn = rng.int(2, 4) as 2 | 3 | 4;
  rng.int(0, 0x7fffffff);
  const count: 2 | 3 | 4 = screens ?? (node.kind === 'victory-road' ? VICTORY_ROAD_SCREENS : drawn);

  return {
    seed: plan.seed,
    key,
    biomeId: biomeForRoute(node.id).id,
    width: ROUTE_WIDTH,
    height: ROUTE_HEIGHTS[count - 2],
    screens: routeScreens(count),
    openings: routeOpenings(plan, key, node.kind, node.edges),
  };
}

/**
 * The carver's spine split into one segment per screen. A filter, not a path walk,
 * so the spine's own order survives; the segments partition the spine for a
 * generated route, because the carver's lane crosses every screen it was given.
 */
export function spineSegments(
  layout: RouteLayout,
  spine: readonly Tile[],
): readonly (readonly Tile[])[] {
  return layout.screens.map((screen) =>
    spine.filter((tile) => tile.y >= screen.top && tile.y <= screen.bottom),
  );
}
