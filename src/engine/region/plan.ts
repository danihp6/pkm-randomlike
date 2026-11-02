import { BADGE_CAPS, badgeCap, cityTierForBadge } from '../../data/region';
import { routeName, settlementNames } from './names';
import { regionStream } from './streams';

/**
 * A **region** is the whole world of one run (`docs/region-spec.md` §1): a starting
 * town, eight gym cities in badge order, one long main route per stretch plus one or
 * two optional laterals, the Victory Road, the League and the endless tower. Every
 * node has a stable `nodeKey`, a seeded position on a coarse grid, the badge stretch
 * it belongs to, that stretch's level cap and its distance to the gym governing it
 * (D29: the cap is the only level anchor, so no node stores a level range).
 *
 * The plan is pure and total: one `planRegion(seed)` derives the whole world off two
 * streams split from the run seed (`plan` for the topology, `names` for the
 * settlements), so a fixed seed always reproduces the same region (D11).
 */

export type RegionNodeKind = 'town' | 'city' | 'route' | 'lateral' | 'victory-road' | 'league' | 'tower';

export type RegionNode = Readonly<{
  /** `nodeKey(kind, id)`, the node's only name. */
  key: string;
  kind: RegionNodeKind;
  /** 1-based within its kind. */
  id: number;
  /** The settlement's generated name, `Route <n>`, `Victory Road`, `League`, `Tower`. */
  name: string;
  /** The badge stretch the node belongs to: 1-8; 9 for the Victory Road, League, tower. */
  badge: number;
  /** `badgeCap(badge)` — the stretch's level cap. */
  cap: number;
  /** Main-chain steps to the gym that closes the stretch: 0 exactly at a gym. */
  gymDistance: number;
  /** 1-3 for a city, `1 | 2 | 3`; null for every other kind. */
  tier: 1 | 2 | 3 | null;
  /** True for the eight gym cities, false elsewhere (a later city may be gym-less). */
  gym: boolean;
  /** The main route key this lateral hangs off; null on the chain. */
  lateralOf: string | null;
  position: Readonly<{ x: number; y: number }>;
  /** Every neighbour's key, no duplicates, both directions present. */
  edges: readonly string[];
}>;

export type RegionPlan = Readonly<{
  seed: string;
  nodes: readonly RegionNode[];
  townKey: string;
  /** The spine, town first, in travel order: it excludes laterals. */
  chain: readonly string[];
  /** The eight gym cities' keys in badge order. */
  gymKeys: readonly string[];
}>;

const NODE_KINDS: readonly RegionNodeKind[] = [
  'town',
  'city',
  'route',
  'lateral',
  'victory-road',
  'league',
  'tower',
];

const CITY_COUNT = 8;

/** The town plus the eight cities: the settlements a region names. */
const SETTLEMENT_COUNT = CITY_COUNT + 1;

/** `town, route 1, city 1, …, route 8, city 8, victory road, league, tower`. */
const CHAIN_LENGTH = CITY_COUNT * 2 + 4;

/** Every stretch carries one main route plus one or two laterals (`docs/region-spec.md` §1). */
const LATERALS_MIN = 1;
const LATERALS_MAX = 2;

/** The badge of the Victory Road, the League and the tower: one past the last gym's. */
const LEAGUE_BADGE = BADGE_CAPS.length + 1;

/** The spine takes one grid column every this many cells, so a lateral has its own column. */
const CHAIN_X_STEP = 6;

/** How far off its column a chain node may sit, in cells. */
const CHAIN_Y_JITTER = 2;

/** A lateral steps this far off its parent's column, into a column of its own. */
const LATERAL_X_STEP = 3;

/** A lateral steps this far off its parent's row, and the second one to the other side. */
const LATERAL_Y_STEP = 3;

/** How far off that row a lateral may sit, in cells; the two sides never overlap. */
const LATERAL_Y_JITTER = 1;

type NodeDraft = {
  key: string;
  kind: RegionNodeKind;
  id: number;
  name: string;
  badge: number;
  cap: number;
  gymDistance: number;
  tier: 1 | 2 | 3 | null;
  gym: boolean;
  lateralOf: string | null;
  position: { x: number; y: number };
  edges: string[];
};

function isNodeKind(value: string): value is RegionNodeKind {
  return (NODE_KINDS as readonly string[]).includes(value);
}

/** A node's only name: `${kind}:${id}` (`city:3`). */
export function nodeKey(kind: RegionNodeKind, id: number): string {
  return `${kind}:${id}`;
}

/** A key back into its kind and id, or null when it is not a well-formed positive-id node key. */
export function parseNodeKey(key: string): Readonly<{ kind: RegionNodeKind; id: number }> | null {
  const match = /^([a-z-]+):([1-9]\d*)$/.exec(key);
  if (!match) return null;
  const kind = match[1];
  if (!isNodeKind(kind)) return null;
  const id = Number(match[2]);
  if (!Number.isSafeInteger(id)) return null;
  return { kind, id };
}

/** The node a key names, or undefined when the plan holds none. */
export function nodeOf(plan: RegionPlan, key: string): RegionNode | undefined {
  return plan.nodes.find((node) => node.key === key);
}

/**
 * Rolls the whole region off the run seed. The `plan` stream lays out the stretches,
 * the lateral counts and every position; the `names` stream names the settlements.
 * Laterals are inserted in `nodes` right after the main route they hang off, so the
 * array reads in travel order with their optional detours in place.
 */
export function planRegion(seed: string): RegionPlan {
  const planRng = regionStream(seed).split('plan');
  const settlements = settlementNames(regionStream(seed).split('names'), SETTLEMENT_COUNT);

  const lateralsPerStretch: number[] = [];
  for (let stretch = 0; stretch < CITY_COUNT; stretch++) {
    lateralsPerStretch.push(planRng.int(LATERALS_MIN, LATERALS_MAX));
  }

  const chainY: number[] = [];
  for (let index = 0; index < CHAIN_LENGTH; index++) {
    chainY.push(planRng.int(-CHAIN_Y_JITTER, CHAIN_Y_JITTER));
  }

  const lateralY: number[] = [];
  for (const count of lateralsPerStretch) {
    for (let lateral = 0; lateral < count; lateral++) {
      lateralY.push(planRng.int(-LATERAL_Y_JITTER, LATERAL_Y_JITTER));
    }
  }

  const chainDraft = (
    kind: RegionNodeKind,
    id: number,
    name: string,
    badge: number,
    tier: 1 | 2 | 3 | null,
    gym: boolean,
  ): Omit<NodeDraft, 'position'> => ({
    key: nodeKey(kind, id),
    kind,
    id,
    name,
    badge,
    cap: badgeCap(badge),
    gymDistance: 0,
    tier,
    gym,
    lateralOf: null,
    edges: [],
  });

  const chain: NodeDraft[] = [];
  const addChain = (index: number, draft: Omit<NodeDraft, 'position'>): void => {
    chain.push({ ...draft, position: { x: index * CHAIN_X_STEP, y: chainY[index] } });
  };

  addChain(0, chainDraft('town', 1, settlements[0], 1, null, false));
  let chainIndex = 0;
  for (let stretch = 1; stretch <= CITY_COUNT; stretch++) {
    addChain(++chainIndex, chainDraft('route', stretch, '', stretch, null, false));
    addChain(
      ++chainIndex,
      chainDraft('city', stretch, settlements[stretch], stretch, cityTierForBadge(stretch).tier, true),
    );
  }
  addChain(++chainIndex, chainDraft('victory-road', 1, 'Victory Road', LEAGUE_BADGE, null, false));
  addChain(++chainIndex, chainDraft('league', 1, 'League', LEAGUE_BADGE, null, false));
  addChain(++chainIndex, chainDraft('tower', 1, 'Tower', LEAGUE_BADGE, null, false));

  for (let at = 0; at < chain.length; at++) {
    if (at > 0) chain[at].edges.push(chain[at - 1].key);
    if (at < chain.length - 1) chain[at].edges.push(chain[at + 1].key);
  }

  // A node's distance is the main-chain steps to the next gym at or after it; past the
  // eighth gym there is none left, so the count keeps rising from that gym instead.
  const gymIndices: number[] = [];
  for (let at = 0; at < chain.length; at++) {
    if (chain[at].gym) gymIndices.push(at);
  }
  const closingGym = gymIndices[gymIndices.length - 1];
  for (let at = 0; at < chain.length; at++) {
    const nextGym = gymIndices.find((gym) => gym >= at);
    chain[at].gymDistance = nextGym === undefined ? at - closingGym : nextGym - at;
  }

  const nodes: NodeDraft[] = [];
  let lateralId = 0;
  let lateralJitter = 0;
  for (const node of chain) {
    nodes.push(node);
    if (node.kind !== 'route') continue;
    const count = lateralsPerStretch[node.id - 1];
    for (let lateral = 1; lateral <= count; lateral++) {
      lateralId += 1;
      const key = nodeKey('lateral', lateralId);
      const side = lateral === 1 ? LATERAL_Y_STEP : -LATERAL_Y_STEP;
      node.edges.push(key);
      nodes.push({
        key,
        kind: 'lateral',
        id: lateralId,
        name: '',
        badge: node.badge,
        cap: node.cap,
        gymDistance: node.gymDistance + 1,
        tier: null,
        gym: false,
        lateralOf: node.key,
        position: {
          x: node.position.x + LATERAL_X_STEP,
          y: node.position.y + side + lateralY[lateralJitter],
        },
        edges: [node.key],
      });
      lateralJitter += 1;
    }
  }

  let routeNumber = 0;
  for (const node of nodes) {
    if (node.kind !== 'route' && node.kind !== 'lateral') continue;
    routeNumber += 1;
    node.name = routeName(routeNumber);
  }

  return {
    seed,
    nodes: nodes.map((node) => ({
      key: node.key,
      kind: node.kind,
      id: node.id,
      name: node.name,
      badge: node.badge,
      cap: node.cap,
      gymDistance: node.gymDistance,
      tier: node.tier,
      gym: node.gym,
      lateralOf: node.lateralOf,
      position: { x: node.position.x, y: node.position.y },
      edges: [...node.edges],
    })),
    townKey: nodeKey('town', 1),
    chain: chain.map((node) => node.key),
    gymKeys: chain.filter((node) => node.gym).map((node) => node.key),
  };
}
