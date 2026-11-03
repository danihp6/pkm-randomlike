import { GATE_KINDS, type GateKind } from '../../data/gates';
import { POI_ZONE_HEIGHT, POI_ZONE_WIDTH, poiRow, type PoiRow } from '../../data/pois';
import { STATIC_SPECIES } from '../../data/staticSpecies';
import type { Tile } from '../grid';
import { planNodeContent, type NodeContent, type PoiKind } from './content';
import { nodeOf, type RegionPlan } from './plan';
import { generateRoute, type RegionRouteMap } from './route/map';
import { regionStream } from './streams';

/**
 * The point of interest a lateral's terminus ends on, as a **zone** on the route
 * (`docs/region-spec.md` §7.8): the one kind the content pass drew (§7.3), the data row
 * that kind reads (`src/data/pois.ts`), the rectangle it owns at the end of the route's
 * spine, the tile its marker stands on and the rules a battle started inside it obeys.
 *
 * Every draw is a named split of the region's stream — `pois:vault`, `pois:statics` and
 * `pois:legendary:<key>` — and every content read is `planNodeContent` off a node's own
 * `content` stream, which replays alone (`D60`), so a fixed seed reproduces the same POI
 * for ever (`D11`) and building one node's POI moves no other draw.
 */

/** A zone on a route, in tiles: its top-left cell and its size. */
export type PoiRect = Readonly<{ x: number; y: number; width: number; height: number }>;

export type NodePoi = Readonly<{
  nodeKey: string;
  kind: PoiKind;
  row: PoiRow;
  /** The zone, always inside the route's walkable body (never the border ring). */
  rect: PoiRect;
  /** The tile the marker stands on: the spine's end, clamped into the rect. */
  marker: Tile;
  /** The vault's seal, drawn once per region; `null` for every other kind. */
  gateKind: GateKind | null;
  /** The species a `static` or a `legendary` holds; `null` for every other kind. */
  speciesId: string | null;
}>;

/** The launch's two names, with the defaults a tile outside every zone answers. */
const NO_RULES: Readonly<{ noHeal: boolean; barredMoves: readonly string[] }> = {
  noHeal: false,
  barredMoves: [],
};

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  return value > max ? max : value;
}

/** The tile a POI's zone centres on: the route's spine ends there, or its entry does. */
function spineEnd(route: RegionRouteMap): Tile {
  return route.spine[route.spine.length - 1] ?? route.entry;
}

/** The zone a terminus' POI owns: the rect at the end of the route's spine. */
export function poiRect(route: RegionRouteMap): PoiRect {
  const anchor = spineEnd(route);
  const x = clamp(
    anchor.x - Math.floor(POI_ZONE_WIDTH / 2),
    1,
    Math.max(1, route.width - 1 - POI_ZONE_WIDTH),
  );
  const y = clamp(
    anchor.y - Math.floor(POI_ZONE_HEIGHT / 2),
    1,
    Math.max(1, route.height - 1 - POI_ZONE_HEIGHT),
  );
  return { x, y, width: POI_ZONE_WIDTH, height: POI_ZONE_HEIGHT };
}

/**
 * The region's one vault seal: `pois:vault`, one draw into `GATE_KINDS`, so every vault
 * of a seed is sealed with the same obstacle and a second call is the same answer.
 */
export function regionVaultGate(plan: RegionPlan): GateKind {
  const rng = regionStream(plan.seed).split('pois:vault');
  return GATE_KINDS[rng.int(0, GATE_KINDS.length - 1)];
}

/**
 * Every `static` of a region, one species each: `pois:statics` is one Fisher–Yates
 * shuffle of the whole `STATIC_SPECIES` pool for the region, and the plan's laterals in
 * `plan.nodes` order take the next species of it. A region with more statics than the
 * pool keeps walking the shuffle by index modulo the pool's length instead of throwing,
 * so the order stays stable and documented.
 */
export function regionStatics(plan: RegionPlan): ReadonlyMap<string, string> {
  const rng = regionStream(plan.seed).split('pois:statics');
  const pool = [...STATIC_SPECIES];
  for (let index = pool.length - 1; index > 0; index--) {
    const at = rng.int(0, index);
    const swap = pool[index];
    pool[index] = pool[at];
    pool[at] = swap;
  }

  const statics = new Map<string, string>();
  if (pool.length === 0) return statics;
  let taken = 0;
  for (const node of plan.nodes) {
    if (node.kind !== 'lateral') continue;
    if (planNodeContent(plan, node.key, node.tier ?? 1).poi !== 'static') continue;
    statics.set(node.key, pool[taken % pool.length]);
    taken += 1;
  }
  return statics;
}

/** The one legendary a terminus holds: `pois:legendary:<key>`, one draw into its pool. */
function legendarySpecies(plan: RegionPlan, key: string, pool: readonly string[]): string | null {
  if (pool.length === 0) return null;
  const rng = regionStream(plan.seed).split(`pois:legendary:${key}`);
  return pool[rng.int(0, pool.length - 1)];
}

function speciesOf(plan: RegionPlan, key: string, row: PoiRow): string | null {
  if (row.kind === 'static') return regionStatics(plan).get(key) ?? null;
  if (row.kind === 'legendary') return legendarySpecies(plan, key, row.species);
  return null;
}

/** The one POI a lateral's terminus ends on, or a throw when the node is not one. */
export function nodePoi(plan: RegionPlan, key: string, content: NodeContent): NodePoi {
  const node = nodeOf(plan, key);
  if (!node) throw new Error(`unknown node: ${key}`);
  const kind = content.poi;
  if (node.lateralOf === null || kind === null) throw new Error(`not a terminus: ${key}`);

  const route = generateRoute(plan, key);
  const rect = poiRect(route);
  const anchor = spineEnd(route);
  const marker: Tile = {
    x: clamp(anchor.x, rect.x, rect.x + rect.width - 1),
    y: clamp(anchor.y, rect.y, rect.y + rect.height - 1),
  };
  const row = poiRow(kind);

  return {
    nodeKey: key,
    kind,
    row,
    rect,
    marker,
    gateKind: row.kind === 'vault' ? regionVaultGate(plan) : null,
    speciesId: speciesOf(plan, key, row),
  };
}

/** Whether `tile` stands inside `rect`; a rect is half-open, so its far edges are out. */
export function inPoiRect(rect: PoiRect, tile: Tile): boolean {
  return (
    tile.x >= rect.x && tile.x < rect.x + rect.width && tile.y >= rect.y && tile.y < rect.y + rect.height
  );
}

/** The POI whose zone holds `tile`, or `null`. First match wins; zones never overlap. */
export function poiAt(pois: readonly NodePoi[], tile: Tile): NodePoi | null {
  for (const poi of pois) {
    if (inPoiRect(poi.rect, tile)) return poi;
  }
  return null;
}

/** What a battle started on `tile` inherits: the launch's own two names. */
export function poiBattleRules(
  pois: readonly NodePoi[],
  tile: Tile,
): Readonly<{ noHeal: boolean; barredMoves: readonly string[] }> {
  const poi = poiAt(pois, tile);
  if (poi === null || poi.row.kind !== 'no-heal') return NO_RULES;
  return { noHeal: true, barredMoves: poi.row.barredMoves };
}
