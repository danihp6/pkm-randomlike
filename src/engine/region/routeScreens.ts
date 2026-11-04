import { ROUTE_LOOT } from '../../data/loot';
import { TRAINER_ARCHETYPE_IDS } from '../../data/trainers';
import type { Tile } from '../grid';
import { isWalkable } from '../map';
import { pickWeighted } from '../routes/encounters';
import type { RouteItem, RouteMap, RouteTrainer } from '../routes/routeMap';
import { DEFAULT_TRAINER_SIGHT } from '../routes/sketch';
import { bandForNode } from '../run/levelCurve';
import { planNodeContent } from './content';
import { nodeOf, type RegionPlan } from './plan';
import { inPoiRect, nodePoi, type NodePoi, type PoiRect } from './pois';
import { generateRoute, type RegionRouteMap, type RouteOpeningBand } from './route/map';
import { nodeStreams } from './streams';

/**
 * A route node as the screen that walks it (`docs/region-spec.md` §7.12): its one
 * carve cut into the two-to-four vertical **screens** its own region plan already
 * generated, each with the tile a walker enters it on, the border bands that belong
 * to it and its own share of the node's content — the carver's tall grass, the
 * trainers `planNodeContent` counts, the ground items of the node's loot band and, on
 * a lateral, the point of interest and its zone.
 *
 * **The lane is never a content tile**, so a trainer or an item can never block the
 * walkable end-to-end lane the carver guarantees. Candidates are also kept off the
 * border ring (where the bands are) and off a lateral's POI zone, so no content lands
 * where a rule already put something.
 *
 * Pure and total over every `route`/`lateral` key the plan holds: one carve, the
 * node's own `content` and `loot` streams, and no clock. A `screens` argument forces
 * the screen count exactly as `generateRoute`'s third argument does, and it moves no
 * other draw; it is a test-only hook, and a forced geometry is never combined with a
 * POI — `nodePoi` re-generates the rolled count internally and takes no count of its
 * own, so a lateral is always planned at its rolled height.
 */

/** One screen of a route, top to bottom in stitched rows. */
export type RouteScreenPlan = Readonly<{
  /** 0-based, top to bottom. */
  index: number;
  /** The screen's first row, inclusive (= `RouteScreen.top` of the layout). */
  top: number;
  /** The screen's last row, inclusive. The last screen absorbs the remainder. */
  bottom: number;
  /**
   * The tile a walker stands on when it enters this screen: the lane tile on the
   * screen's first row. Screen 0's spawn **is** the carver's `entry`
   * (`generateRoute(...).entry`), so `travel` and the scene agree on the tile.
   */
  spawn: Tile;
  /** The band a walk enters this screen by (the `N` band on screen 0), or `null`. */
  entry: RouteOpeningBand | null;
  /** The bands that leave the route from this screen, in `bands` order. */
  exits: readonly RouteOpeningBand[];
}>;

/** A route node resolved to everything the route screen draws and walks. */
export type RouteNodePlan = Readonly<{
  /** The node's key, e.g. `route:3` or `lateral:5`. */
  key: string;
  /** `node.id`, kept for the dev panel's numeric field only. */
  routeIndex: number;
  /**
   * The node's one carve and the content placed on it, in the shipped `RouteMap`
   * shape the scene's draw code and the shared panels already read, **and** in the
   * `RegionRouteMap` shape `src/scenes/pois.ts` takes (`drawPoi`, `poiRect`), so one
   * object serves both seams. The fields the region route has no concept of are
   * reported empty: `shape: 'straight'`, `branches: []`, `pockets: []`.
   */
  route: RouteMap & RegionRouteMap;
  /** One descriptor per screen, top to bottom. */
  screens: readonly RouteScreenPlan[];
  /** The lateral's point of interest, or `null` on a main-chain route. */
  poi: NodePoi | null;
}>;

/** One screen's free content tiles, consumed deepest-first as the passes place. */
type ScreenPool = Tile[];

/** A row band: the screens' own rows, for `screenIndexOf`'s one scan. */
type ScreenRows = readonly Readonly<{ bottom: number }>[];

/** The screen holding `y`: 0 above the stack, the last one below it. */
function indexAt(rows: ScreenRows, y: number): number {
  for (let index = 0; index < rows.length; index++) {
    if (y <= rows[index].bottom) return index;
  }
  return rows.length === 0 ? 0 : rows.length - 1;
}

/**
 * The tile a walker stands on entering the screen whose first row is `top`: the
 * smallest column that is walkable on both `top` and the row above it (the previous
 * screen's last row, so the seam can actually be crossed there), preferring a lane
 * tile. Never throws: the first spine tile at or below `top`, then `{ 1, top }`, stand
 * in for a map with no crossable column.
 */
function seamSpawn(map: RegionRouteMap, top: number): Tile {
  const spineKeys = new Set(map.spine.map((tile) => tileKey(tile)));
  const crossable = (x: number): boolean =>
    isWalkable(map.tiles, { x, y: top }) && isWalkable(map.tiles, { x, y: top - 1 });
  for (let x = 0; x < map.width; x++) {
    if (crossable(x) && spineKeys.has(`${x},${top}`)) return { x, y: top };
  }
  for (let x = 0; x < map.width; x++) {
    if (crossable(x)) return { x, y: top };
  }
  const first = map.spine.find((tile) => tile.y >= top);
  return first === undefined ? { x: 1, y: top } : { ...first };
}

/** Every band's cell as a `x,y` key, so the content passes can keep off them. */
function bandKeysOf(bands: readonly RouteOpeningBand[]): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const band of bands) {
    for (const cell of band.tiles) keys.add(tileKey(cell));
  }
  return keys;
}

function tileKey(tile: Tile): string {
  return `${tile.x},${tile.y}`;
}

/**
 * A screen's free content tiles, deepest first (`y` descending, then `x` ascending):
 * walkable, inside the body (never the border ring), off the lane and off every band,
 * and — on a lateral — off the POI zone.
 */
function contentPool(
  map: RegionRouteMap,
  top: number,
  bottom: number,
  spine: ReadonlySet<string>,
  bandKeys: ReadonlySet<string>,
  poiRect: PoiRect | null,
): ScreenPool {
  const pool: ScreenPool = [];
  const lastRow = Math.min(map.height - 2, bottom);
  const lastColumn = map.width - 2;
  for (let y = lastRow; y >= Math.max(1, top); y--) {
    for (let x = 1; x <= lastColumn; x++) {
      const tile = { x, y };
      const key = `${x},${y}`;
      if (spine.has(key) || bandKeys.has(key)) continue;
      if (poiRect !== null && inPoiRect(poiRect, tile)) continue;
      if (!isWalkable(map.tiles, tile)) continue;
      pool.push(tile);
    }
  }
  return pool;
}

/**
 * The node's screens, its populated route and its terminus.
 * Throws `not a route node: <key>` for a key that is not a `route`/`lateral`
 * (the message `planRouteLayout` throws) and `bad screen count: <n>` for a bad
 * `screens` argument. `screens` forces the count, exactly as `generateRoute`'s third
 * argument does, and moves no other draw.
 */
export function planRouteScreens(plan: RegionPlan, key: string, screens?: 2 | 3 | 4): RouteNodePlan {
  const node = nodeOf(plan, key);
  const map = generateRoute(plan, key, screens);
  if (node === undefined) throw new Error(`not a route node: ${key}`);

  const drafts = map.screens.map((screen) => ({
    index: screen.index,
    top: screen.top,
    bottom: screen.bottom,
    spawn: { ...map.entry },
    entry: null as RouteOpeningBand | null,
    exits: [] as RouteOpeningBand[],
  }));
  for (let index = 0; index < drafts.length; index++) {
    if (index > 0) drafts[index].spawn = seamSpawn(map, drafts[index].top);
  }
  for (const band of map.bands) {
    const screen = drafts[indexAt(map.screens, band.tiles[0].y)];
    if (band.role === 'entry') screen.entry = band;
    else screen.exits.push(band);
  }
  const screenPlans: readonly RouteScreenPlan[] = drafts;

  const content = planNodeContent(plan, key, node.tier ?? 1);
  const poi = node.lateralOf === null ? null : nodePoi(plan, key, content);
  const spine = new Set(map.spine.map(tileKey));
  const bandKeys = bandKeysOf(map.bands);
  const poiRect = poi === null ? null : poi.rect;
  const pools = screenPlans.map((screen) =>
    contentPool(map, screen.top, screen.bottom, spine, bandKeys, poiRect),
  );

  const archetypes = nodeStreams(plan.seed, key).content.split('route-trainers');
  const trainers: RouteTrainer[] = [];
  for (let index = 0; index < content.trainers; index++) {
    const pool = pools[index % screenPlans.length];
    const tile = pool.shift();
    if (tile === undefined) continue;
    const drawn = archetypes.int(0, TRAINER_ARCHETYPE_IDS.length - 1);
    trainers.push({
      id: `trainer-${key}-${index}`,
      position: tile,
      facing: 'N',
      sight: DEFAULT_TRAINER_SIGHT,
      archetypeId: TRAINER_ARCHETYPE_IDS[drawn],
    });
  }

  const loot = ROUTE_LOOT[bandForNode(node).id];
  const lootRng = nodeStreams(plan.seed, key).loot;
  const items: RouteItem[] = [];
  for (let index = 1; index < screenPlans.length; index++) {
    if (lootRng.next() >= loot.itemChance) continue;
    const tile = pools[index].shift();
    if (tile === undefined) continue;
    items.push({
      id: `item-${key}-${index}`,
      position: tile,
      itemId: pickWeighted(loot.pool, lootRng).itemId,
      hidden: lootRng.next() < loot.hiddenChance,
    });
  }

  return {
    key,
    routeIndex: node.id,
    route: {
      seed: plan.seed,
      key: map.key,
      routeIndex: node.id,
      biomeId: map.biomeId,
      shape: 'straight',
      width: map.width,
      height: map.height,
      tiles: map.tiles,
      entry: map.entry,
      exits: map.exits,
      spine: map.spine,
      branches: [],
      pockets: [],
      screens: map.screens,
      bands: map.bands,
      items,
      trainers,
    },
    screens: screenPlans,
    poi,
  };
}

/** The screen a row belongs to: 0 above the stack, the last one below it. Never throws. */
export function screenIndexOf(screens: readonly RouteScreenPlan[], y: number): number {
  return indexAt(screens, y);
}

/** Whether a band holds `tile` on its own border cells. */
function holds(band: RouteOpeningBand, tile: Tile): boolean {
  for (const cell of band.tiles) {
    if (cell.x === tile.x && cell.y === tile.y) return true;
  }
  return false;
}

/**
 * The band whose tiles hold `tile`, searched on **every** screen's bands (entry and
 * exits), or `null`. First match wins; bands never overlap.
 */
export function bandAt(screens: readonly RouteScreenPlan[], tile: Tile): RouteOpeningBand | null {
  for (const screen of screens) {
    const entry = screen.entry;
    if (entry !== null && holds(entry, tile)) return entry;
    for (const band of screen.exits) {
      if (holds(band, tile)) return band;
    }
  }
  return null;
}
