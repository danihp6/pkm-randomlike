import { NPC_ROWS } from '../../data/npcs';
import type { Rng } from '../rng';
import { nodeOf, type RegionNodeKind, type RegionPlan } from './plan';
import { isRouteKind } from './route/layout';
import { nodeStreams } from './streams';

/**
 * What a node holds is one pure pass off that node's `content` stream
 * (`docs/region-spec.md` §7.3): the generic NPCs it stands, the special NPCs it offers,
 * whether it rolls wild encounters, the shops it keeps, how many trainers are posted on
 * its map and — for a lateral's terminus — which point of interest it ends on.
 *
 * Everything is keyed by the node's own `nodeKey`, so walking back into it replays the
 * same content for ever (`D11`), and the draws are taken in one fixed order — the generic
 * count, its ids, the special count, its ids, the trainer count, the POI kind — off a
 * single `Rng` instance, so a later pass may append a draw at the end without moving an
 * earlier one (`D60`).
 */

/** The nine points of interest a lateral's terminus can end on. */
export type PoiKind =
  | 'vault'
  | 'miniboss'
  | 'trade'
  | 'no-heal'
  | 'static'
  | 'secret-shop'
  | 'banned'
  | 'puzzle'
  | 'legendary';

/** The kinds of shop a node holds. The secret shop is a `PoiKind`, not a shop. */
export type ShopKind = 'mart';

/**
 * Every POI a terminus can end on, in draw order: the nine the retired `MapRoomSpecial`
 * named, spelled for a zone on a route.
 */
export const POI_KINDS: readonly PoiKind[] = [
  'vault',
  'miniboss',
  'trade',
  'no-heal',
  'static',
  'secret-shop',
  'banned',
  'puzzle',
  'legendary',
];

export type NodeContent = Readonly<{
  /** The generic NPCs the node stands, in placement order. */
  npcs: readonly { npcId: string }[];
  /** The special NPCs (a tutor, a reroll, a merchant…), 1-2 in a city. */
  specials: readonly { npcId: string }[];
  /** The point of interest a lateral's terminus ends on; null on the main chain. */
  poi: PoiKind | null;
  /** Whether the node rolls wild encounters (its grass corner or its tall grass). */
  grass: boolean;
  /** The shops it holds; a city has the mart, nothing else does. */
  shops: readonly ShopKind[];
  /** How many trainers are posted on its map. */
  trainers: number;
}>;

type Range = readonly [min: number, max: number];

/**
 * How many generic NPCs a city stands, by its own tier: the on-ramp is a handful, the
 * late band enough to fill a 90x90 square.
 */
const TIER_NPC_COUNTS: Readonly<Record<1 | 2 | 3, Range>> = {
  1: [2, 3],
  2: [4, 6],
  3: [7, 10],
};

/** The starting town stands exactly one generic NPC, the first row, with no draw. */
const TOWN_NPC_ID = NPC_ROWS[0].id;

/** A city offers one or two special NPCs. */
const CITY_SPECIALS: Range = [1, 2];

/** How many trainers a city posts, by its tier. */
const TIER_TRAINER_COUNTS: Readonly<Record<1 | 2 | 3, Range>> = {
  1: [1, 2],
  2: [2, 3],
  3: [3, 4],
};

/** A route — main, lateral or the Victory Road — posts this many trainers. */
const ROUTE_TRAINER_COUNT: Range = [2, 4];

/** The settlement kinds that roll wild encounters through their grass corner. */
const GRASS_KINDS: ReadonlySet<RegionNodeKind> = new Set<RegionNodeKind>(['town', 'city']);

function drawFromPool(rng: Rng, count: number): { npcId: string }[] {
  const pool = NPC_ROWS.map((row) => row.id);
  const drawn: { npcId: string }[] = [];
  for (let index = 0; index < count && pool.length > 0; index++) {
    const at = rng.int(0, pool.length - 1);
    drawn.push({ npcId: pool[at] });
    pool.splice(at, 1);
  }
  return drawn;
}

function drawNpcs(rng: Rng, kind: RegionNodeKind, tier: 1 | 2 | 3): readonly { npcId: string }[] {
  if (kind === 'town') return [{ npcId: TOWN_NPC_ID }];
  const [min, max] = TIER_NPC_COUNTS[tier];
  return drawFromPool(rng, rng.int(min, max));
}

function drawSpecials(rng: Rng, kind: RegionNodeKind): readonly { npcId: string }[] {
  if (kind !== 'city') return [];
  const [min, max] = CITY_SPECIALS;
  return drawFromPool(rng, rng.int(min, max));
}

function drawTrainers(rng: Rng, kind: RegionNodeKind, tier: 1 | 2 | 3): number {
  if (kind === 'city') {
    const [min, max] = TIER_TRAINER_COUNTS[tier];
    return rng.int(min, max);
  }
  if (isRouteKind(kind)) {
    const [min, max] = ROUTE_TRAINER_COUNT;
    return rng.int(min, max);
  }
  return 0;
}

/**
 * The content a node holds. Pure and total over the plan: it draws only off
 * `nodeStreams(plan.seed, key).content`, in one fixed order, and never throws for a
 * key the plan carries.
 */
export function planNodeContent(plan: RegionPlan, key: string, tier: 1 | 2 | 3): NodeContent {
  const node = nodeOf(plan, key);
  if (!node) throw new Error(`unknown node: ${key}`);
  const rng = nodeStreams(plan.seed, key).content;

  const npcs = drawNpcs(rng, node.kind, tier);
  const specials = drawSpecials(rng, node.kind);
  const trainers = drawTrainers(rng, node.kind, tier);
  const poi = node.lateralOf === null ? null : POI_KINDS[rng.int(0, POI_KINDS.length - 1)];

  return {
    npcs,
    specials,
    poi,
    grass: GRASS_KINDS.has(node.kind) || isRouteKind(node.kind),
    shops: node.kind === 'city' ? ['mart'] : [],
    trainers,
  };
}
