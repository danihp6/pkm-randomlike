import {
  OPPOSITE_EDGE,
  portalEdgeFor,
  type MapEdge,
  type MapPlan,
  type MapRoom,
  type MapRoomShape,
  type MapRoomSpecial,
} from '../engine/maps';

/**
 * The route HUD's **minimap layout** (`docs/maps-spec.md` §8, D32): the pure
 * geometry of the floor as a Binding of Isaac grid of rooms. It places every room
 * of a `MapPlan` on the coarse grid, sizes it from its own width/height, derives
 * each wall opening's midpoint and the link between two known neighbours, and
 * then applies **fog of discovery** — a room is drawn only once it has been
 * entered, and a link only once **both** its ends are known.
 *
 * It is Phaser-free: `RouteScene` scales the returned rects to the panel and
 * draws them, but every position, reveal rule and marker is decided here so it
 * can be unit-tested headless. Positions are laid out over the **whole** plan and
 * only filtered afterwards, so the floor never shifts as rooms are revealed.
 */

/** A special room's marker icon; the plan's own special kinds (`D33`). */
export type MapRoomMarker = MapRoomSpecial;

/** How an opening reads on the minimap: the map entrance, a room link or the portal. */
export type MapOpeningKind = 'entry' | 'link' | 'portal';

export type MapViewOpening = Readonly<{
  edge: MapEdge;
  kind: MapOpeningKind;
  /** The opening's midpoint on the room's wall, in view coordinates. */
  x: number;
  y: number;
}>;

export type MapViewRoom = Readonly<{
  id: number;
  col: number;
  row: number;
  shape: MapRoomShape;
  /** The rect inside the view, in grid units; `x`/`y` are its top-left. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** True for the room the run currently stands in. */
  current: boolean;
  /** True for the map's boss room. */
  boss: boolean;
  /** True only while the boss room's portal is open. */
  portal: boolean;
  /** The room's special marker, if any (Phase 9 step 11). */
  marker: MapRoomMarker | null;
  /** True once the room's single capture has been spent (its first wild battle). */
  captureSpent: boolean;
  openings: readonly MapViewOpening[];
}>;

/** A door between two known rooms, from one wall midpoint to the facing one. */
export type MapViewLink = Readonly<{
  from: number;
  to: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}>;

export type MapView = Readonly<{
  /** Extent of the whole (unfiltered) floor, so the scene can scale to fit. */
  width: number;
  height: number;
  rooms: readonly MapViewRoom[];
  links: readonly MapViewLink[];
  /** True when at least one room has been discovered. */
  visible: boolean;
}>;

export type MapViewInput = Readonly<{
  /** Room ids entered so far (the run's fog of discovery). */
  discovered: readonly number[];
  /** The room the run occupies; that cell is highlighted. */
  currentRoom: number;
  /** Whether the boss room's portal is open (D31); false while the boss stands. */
  portalOpen?: boolean;
  /** Optional room-id → special marker map (Phase 9 step 11). */
  markers?: Readonly<Record<number, MapRoomMarker>>;
  /** Room ids whose single capture has been spent, so the minimap shows a ball. */
  captureSpent?: readonly number[];
}>;

/** The gap (grid units) a room keeps from its neighbours so cells never touch. */
export const MAP_VIEW_GAP = 2;

type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;

/** The midpoint of one wall of a rect; the minimap draws every opening there. */
function wallMidpoint(rect: Rect, edge: MapEdge): { x: number; y: number } {
  switch (edge) {
    case 'N':
      return { x: rect.x + rect.w / 2, y: rect.y };
    case 'S':
      return { x: rect.x + rect.w / 2, y: rect.y + rect.h };
    case 'W':
      return { x: rect.x, y: rect.y + rect.h / 2 };
    case 'E':
      return { x: rect.x + rect.w, y: rect.y + rect.h / 2 };
  }
}

/** The edge of `from` that points at the grid neighbour `to`. */
function edgeToward(from: MapRoom, to: MapRoom): MapEdge {
  if (to.col > from.col) return 'E';
  if (to.col < from.col) return 'W';
  return to.row > from.row ? 'S' : 'N';
}

/**
 * Places every room on the grid: each column is as wide as its widest room and
 * each row as tall as its tallest, rooms are centred inside their band, and a
 * `MAP_VIEW_GAP` separates the bands. Computed for the whole plan, so a room's
 * position does not depend on which rooms are revealed.
 */
function layoutRects(plan: MapPlan): Map<number, Rect> {
  const columnWidth = new Map<number, number>();
  const rowHeight = new Map<number, number>();
  for (const room of plan.rooms) {
    columnWidth.set(room.col, Math.max(columnWidth.get(room.col) ?? 0, room.width));
    rowHeight.set(room.row, Math.max(rowHeight.get(room.row) ?? 0, room.height));
  }

  const colLeft = new Map<number, number>();
  let x = 0;
  for (const col of [...columnWidth.keys()].sort((a, b) => a - b)) {
    colLeft.set(col, x);
    x += columnWidth.get(col)! + MAP_VIEW_GAP;
  }
  const rowTop = new Map<number, number>();
  let y = 0;
  for (const row of [...rowHeight.keys()].sort((a, b) => a - b)) {
    rowTop.set(row, y);
    y += rowHeight.get(row)! + MAP_VIEW_GAP;
  }

  const rects = new Map<number, Rect>();
  for (const room of plan.rooms) {
    rects.set(room.id, {
      x: colLeft.get(room.col)! + (columnWidth.get(room.col)! - room.width) / 2,
      y: rowTop.get(room.row)! + (rowHeight.get(room.row)! - room.height) / 2,
      w: room.width,
      h: room.height,
    });
  }
  return rects;
}

/**
 * Every wall opening of a room: its plan openings plus the portal when it is open.
 * The plan's `portal` opening is dropped until the boss falls, so the sealed boss
 * room draws one door and the open one re-adds the portal on `portalEdgeFor`'s edge
 * exactly once.
 */
function roomOpenings(plan: MapPlan, rect: Rect, room: MapRoom, portalOpen: boolean): MapViewOpening[] {
  const openings: MapViewOpening[] = room.openings
    .filter((opening) => opening.kind !== 'portal')
    .map((opening) => ({
      edge: opening.edge,
      kind: opening.kind === 'entry' ? 'entry' : 'link',
      ...wallMidpoint(rect, opening.edge),
    }));
  if (portalOpen && room.id === plan.bossRoom) {
    const edge = portalEdgeFor(plan, room.id);
    if (edge) openings.push({ edge, kind: 'portal', ...wallMidpoint(rect, edge) });
  }
  return openings;
}

/**
 * Builds the minimap layout for a floor and the run's progress on it: the
 * discovered rooms with their openings and markers, and the links between two
 * known neighbours. Deterministic and side-effect free.
 */
export function buildMapView(plan: MapPlan, input: MapViewInput): MapView {
  const rects = layoutRects(plan);
  const discovered = new Set(input.discovered);
  const markers = input.markers ?? {};
  const captureSpent = new Set(input.captureSpent ?? []);
  const portalOpen = input.portalOpen === true;

  const rooms: MapViewRoom[] = [];
  for (const room of plan.rooms) {
    if (!discovered.has(room.id)) continue;
    const rect = rects.get(room.id)!;
    const isBoss = room.id === plan.bossRoom;
    const portal = portalOpen && isBoss && portalEdgeFor(plan, room.id) !== null;
    rooms.push({
      id: room.id,
      col: room.col,
      row: room.row,
      shape: room.shape,
      ...rect,
      current: room.id === input.currentRoom,
      boss: isBoss,
      portal,
      marker: markers[room.id] ?? null,
      captureSpent: captureSpent.has(room.id),
      openings: roomOpenings(plan, rect, room, portalOpen),
    });
  }

  const links: MapViewLink[] = [];
  for (const [a, b] of plan.links) {
    if (!discovered.has(a) || !discovered.has(b)) continue;
    const from = plan.rooms[a];
    const to = plan.rooms[b];
    const edge = edgeToward(from, to);
    const start = wallMidpoint(rects.get(a)!, edge);
    const end = wallMidpoint(rects.get(b)!, OPPOSITE_EDGE[edge]);
    links.push({ from: a, to: b, x1: start.x, y1: start.y, x2: end.x, y2: end.y });
  }

  let width = 0;
  let height = 0;
  for (const rect of rects.values()) {
    width = Math.max(width, rect.x + rect.w);
    height = Math.max(height, rect.y + rect.h);
  }

  return { width, height, rooms, links, visible: rooms.length > 0 };
}
