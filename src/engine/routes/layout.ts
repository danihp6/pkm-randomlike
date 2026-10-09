/**
 * Route geometry and carver styles.
 *
 * A **shape** is the geometry of a route: where the player enters and leaves
 * (its `openings`) and which openings the guaranteed path joins (its `links`).
 * Shapes are pure data, seeded per route; the biome only supplies art and
 * encounters (`docs/route-generator.md` §0).
 *
 * A **layout** is a carver style: `open` fills the interior with trees and carves
 * the shape's lanes through them, `hedges` drops tree bars and `maze` carves a
 * grid. Only `open` (the forest) is live; the `hedges`/`maze` carvers stay parked
 * in `sketch.ts` for later biomes.
 */

export type AccessEdge = 'N' | 'E' | 'S' | 'W';
export type AccessRole = 'entry' | 'exit';

/** One opening on a route border: the edge it sits on and what it is for. */
export type Access = Readonly<{
  edge: AccessEdge;
  role: AccessRole;
}>;

/** A pair of opening indices (`openings` positions) the guaranteed path joins. */
export type Link = readonly [number, number];

export type RouteShape = 'dead-end' | 'corridor' | 'bend' | 'tee' | 'cross' | 'straight';

export type ShapeSpec = Readonly<{
  openings: readonly Access[];
  /** Pairs of `openings` the spine joins (a `+` joins both of its axes). */
  links: readonly Link[];
  /** Width of the guaranteed path, kept clear of bars and hazards. */
  pathWidth: number;
  /** How far a spine waypoint may stray from the straight link line. */
  jitter: number;
  /** Base secondary paths carved off the network; the map-size tier adds more. */
  branchCount: number;
  branchMin: number;
  branchMax: number;
}>;

/** Opposite edges: a link leaves one room by an edge and enters the next by this one. */
const OPPOSITE: Readonly<Record<AccessEdge, AccessEdge>> = {
  N: 'S',
  E: 'W',
  S: 'N',
  W: 'E',
};

export const SHAPES: Readonly<Record<RouteShape, ShapeSpec>> = {
  'dead-end': {
    openings: [{ edge: 'W', role: 'entry' }],
    links: [],
    pathWidth: 2,
    jitter: 2,
    branchCount: 2,
    branchMin: 4,
    branchMax: 12,
  },
  corridor: {
    openings: [
      { edge: 'W', role: 'entry' },
      { edge: 'E', role: 'exit' },
    ],
    links: [[0, 1]],
    pathWidth: 2,
    jitter: 1,
    branchCount: 0,
    branchMin: 4,
    branchMax: 12,
  },
  bend: {
    openings: [
      { edge: 'W', role: 'entry' },
      { edge: 'N', role: 'exit' },
    ],
    links: [[0, 1]],
    pathWidth: 2,
    jitter: 2,
    branchCount: 2,
    branchMin: 4,
    branchMax: 14,
  },
  tee: {
    openings: [
      { edge: 'W', role: 'entry' },
      { edge: 'N', role: 'exit' },
      { edge: 'S', role: 'exit' },
    ],
    links: [
      [0, 1],
      [0, 2],
    ],
    pathWidth: 2,
    jitter: 2,
    branchCount: 2,
    branchMin: 4,
    branchMax: 12,
  },
  cross: {
    openings: [
      { edge: 'W', role: 'entry' },
      { edge: 'E', role: 'exit' },
      { edge: 'N', role: 'exit' },
      { edge: 'S', role: 'exit' },
    ],
    links: [
      [0, 1],
      [2, 3],
    ],
    pathWidth: 2,
    jitter: 2,
    branchCount: 3,
    branchMin: 4,
    branchMax: 12,
  },
  straight: {
    openings: [
      { edge: 'W', role: 'entry' },
      { edge: 'E', role: 'exit' },
    ],
    links: [[0, 1]],
    pathWidth: 2,
    jitter: 2,
    branchCount: 2,
    branchMin: 4,
    branchMax: 14,
  },
};

export const DEFAULT_SHAPE: RouteShape = 'straight';

export const ROUTE_SHAPES: readonly RouteShape[] = [
  'straight',
  'bend',
  'cross',
  'dead-end',
  'corridor',
  'tee',
];

export function isRouteShape(value: unknown): value is RouteShape {
  return typeof value === 'string' && (ROUTE_SHAPES as readonly string[]).includes(value);
}

/** The shape an opening set reads as (`docs/maps-spec.md` §2, D30). */
export function shapeForEdges(edges: readonly AccessEdge[]): RouteShape {
  if (edges.length === 1) return 'dead-end';
  if (edges.length === 2) return OPPOSITE[edges[0]] === edges[1] ? 'corridor' : 'bend';
  if (edges.length === 3) return 'tee';
  if (edges.length === 4) return 'cross';
  throw new Error(`cannot shape a route with ${edges.length} openings`);
}

/** The opening pairs the spine joins for a given opening set. */
export function linksForEdges(edges: readonly AccessEdge[]): readonly Link[] {
  if (edges.length < 2) return [];
  if (edges.length === 2) return [[0, 1]];
  if (edges.length === 3) {
    return [
      [0, 1],
      [0, 2],
    ];
  }
  const links: Link[] = [];
  const used = new Set<number>();
  for (let i = 0; i < edges.length; i++) {
    if (used.has(i)) continue;
    const j = edges.findIndex((edge, k) => k > i && !used.has(k) && OPPOSITE[edges[i]] === edge);
    if (j < 0) continue;
    used.add(i);
    used.add(j);
    links.push([i, j]);
  }
  return links;
}

/**
 * The shape spec for a room's **actual** opening set from the map plan: the
 * template's feel (path width, branch count) with the plan's edges and the links
 * that join them (`docs/routes-spec.md` §2).
 */
export function specForOpenings(openings: readonly Access[]): ShapeSpec {
  const edges = openings.map((opening) => opening.edge);
  return { ...SHAPES[shapeForEdges(edges)], openings, links: linksForEdges(edges) };
}

/** The single opening a shape marks as the player's arrival point. */
export function entryAccess(spec: ShapeSpec): Access {
  const entry = spec.openings.find((opening) => opening.role === 'entry');
  if (!entry) throw new Error('shape declares no entry opening');
  return entry;
}

/** Index of the entry opening, which the guaranteed path must always join. */
export function entryIndex(spec: ShapeSpec): number {
  const index = spec.openings.findIndex((opening) => opening.role === 'entry');
  if (index < 0) throw new Error('shape declares no entry opening');
  return index;
}

export type LayoutStyle = 'forest';

export type LayoutSpec = Readonly<{
  kind: 'open' | 'hedges' | 'maze';
  /** hedges: how many tree bars to drop, and their length range. */
  bars: number;
  barMin: number;
  barMax: number;
  /** maze: corridor width in tiles. */
  corridorWidth: number;
  /** maze: fraction of walls opened back up into loops (0 = perfect maze). */
  braid: number;
}>;

export const LAYOUTS: Readonly<Record<LayoutStyle, LayoutSpec>> = {
  forest: {
    kind: 'open',
    bars: 0,
    barMin: 3,
    barMax: 6,
    corridorWidth: 1,
    braid: 0.2,
  },
};

export const DEFAULT_LAYOUT: LayoutStyle = 'forest';

export function isLayoutStyle(value: unknown): value is LayoutStyle {
  return value === 'forest';
}
