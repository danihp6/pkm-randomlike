import { GYM_SIZE, INTERIOR_SIZE } from '../../../data/region';
import type { Tile } from '../../grid';
import { COUNTER, DOOR, FLOOR, HEAL, PC, WALL, mapSize, type TileMap } from '../../map';
import type { Rng } from '../../rng';
import type { RegionPlan } from '../plan';
import { nodeStreams } from '../streams';

/**
 * A building's **inside** is one small room a settlement's door opens onto
 * (`docs/region-spec.md` §7.2): `INTERIOR_SIZE` tiles for a house, a laboratory, a
 * casino or a Pokémon Centre, `GYM_SIZE` for a gym's four rooms. The plan carries the
 * map in the engine's own values (`src/engine/map.ts`), the one `DOOR` the player
 * arrives on and walks back out of, and the slots — a position and a role, nothing
 * more — a scene fills with its own host or prop.
 *
 * Pure and seeded: the geometry comes off `nodeStreams(seed, cityKey/interiorKey)
 * .layout`, the city node's sub-key, so no two interiors of a region share a stream,
 * none of them moves when another is built, and the city's own draws never touch one
 * (`D11`, `D60`).
 */

export type InteriorRoomKind = 'centre' | 'gym' | 'lab' | 'house' | 'casino';

/** What stands in a room, as a role the scene fills in. */
export type InteriorSlotRole =
  'heal' | 'pc' | 'counter' | 'professor' | 'npc' | 'cabinet' | 'trainer' | 'leader';

export type InteriorSlot = Readonly<{ role: InteriorSlotRole; tile: Tile }>;

/** One of a gym's four rooms, in the fixed order below. */
export type InteriorRoom = Readonly<{
  index: number;
  name: 'entrance' | 'trainer' | 'puzzle' | 'leader';
  /** The room's floor + wall rectangle, top-left and size, inclusive. */
  rect: Readonly<{ x: number; y: number; width: number; height: number }>;
  /** The DOOR cell that joins it to the room before it; absent on `entrance`. */
  doorIn?: Tile;
}>;

export type InteriorPlan = Readonly<{
  seed: string;
  interiorKey: string;
  cityKey: string;
  kind: InteriorRoomKind;
  width: number;
  height: number;
  tiles: TileMap;
  /** The one DOOR cell: the player arrives on it and it walks them back out. */
  entry: Tile;
  /** What `entry` returns to. Always `cityKey`. */
  returnTo: string;
  /** The room's furniture/host slots; their roles are fixed per kind. */
  slots: readonly InteriorSlot[];
  /** The gym's four rooms, in order. Absent (not `[]`) on every other kind. */
  rooms?: readonly InteriorRoom[];
}>;

type Rect = Readonly<{ x: number; y: number; width: number; height: number }>;

type InteriorDraft = Readonly<{
  tiles: number[][];
  entry: Tile;
  slots: readonly InteriorSlot[];
  rooms?: readonly InteriorRoom[];
}>;

/** Every room is a floor rectangle inside a wall ring this many cells deep. */
const RING = 1;

/**
 * The Centre's counter, healing station included: an odd run, so the station sits in
 * its middle and the counter reads as one object either side of it.
 */
const COUNTER_RUN = 9;

/** A gym's four rooms in travel order: a 2×2 walk, one door between consecutive ones. */
const GYM_ROOM_NAMES: readonly InteriorRoom['name'][] = ['entrance', 'trainer', 'puzzle', 'leader'];

/** The host a room other than a Centre or a gym puts on its free tile. */
const HOST_ROLE: Readonly<Record<'lab' | 'house' | 'casino', InteriorSlotRole>> = {
  lab: 'professor',
  house: 'npc',
  casino: 'cabinet',
};

/** The kinds spelled with no index; `house` is the only key that carries one. */
const PLAIN_ROOM_KINDS: readonly InteriorRoomKind[] = ['centre', 'gym', 'lab', 'house', 'casino'];

const HOUSE_INTERIOR_KEY = /^house:[1-9]\d*$/;

/** The kind an `interiorKey` names, or `null` when the string is not one. */
export function interiorRoomKind(interiorKey: string): InteriorRoomKind | null {
  if (HOUSE_INTERIOR_KEY.test(interiorKey)) return 'house';
  return PLAIN_ROOM_KINDS.find((kind) => kind === interiorKey) ?? null;
}

function blank(width: number, height: number): number[][] {
  return Array.from({ length: height }, () => new Array<number>(width).fill(WALL));
}

function paint(tiles: number[][], rect: Rect, value: number): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) tiles[y][x] = value;
  }
}

/** A room's floor: its rect with the ring taken off. */
function floorOf(rect: Rect): Rect {
  return {
    x: rect.x + RING,
    y: rect.y + RING,
    width: rect.width - RING * 2,
    height: rect.height - RING * 2,
  };
}

/** The middle floor cell of a band `size` cells long that starts at `start`, ring excluded. */
function middleOf(start: number, size: number): number {
  return start + RING + Math.floor((size - RING * 2) / 2);
}

/** The row a room's furniture and its hosts stand on, a quarter of the way down. */
function furnitureRow(height: number): number {
  return Math.floor(height / 4);
}

/**
 * A one-room building: a `FLOOR` rectangle in a `WALL` ring, a `DOOR` in its bottom
 * wall, and the furniture its kind carries. The Centre stamps the counter the healing
 * station is set into; the rest put their host on a free floor tile.
 */
function planSmallRoom(kind: Exclude<InteriorRoomKind, 'gym'>, layout: Rng): InteriorDraft {
  const { width, height } = INTERIOR_SIZE;
  const tiles = blank(width, height);
  paint(tiles, floorOf({ x: 0, y: 0, width, height }), FLOOR);

  const entry: Tile = { x: layout.int(RING + 1, width - RING - 2), y: height - 1 };
  tiles[entry.y][entry.x] = DOOR;

  const row = furnitureRow(height);
  const centre = middleOf(0, width);
  const slots: InteriorSlot[] = [];
  if (kind === 'centre') {
    const reach = (COUNTER_RUN - 1) / 2;
    for (let x = centre - reach; x <= centre + reach; x++) tiles[row][x] = COUNTER;
    tiles[row][centre] = HEAL;
    const pc: Tile = { x: centre + reach + 2, y: row };
    tiles[pc.y][pc.x] = PC;
    slots.push({ role: 'heal', tile: { x: centre, y: row } }, { role: 'pc', tile: pc });
  } else {
    slots.push({ role: HOST_ROLE[kind], tile: { x: centre, y: row } });
  }

  return { tiles, entry, slots };
}

/**
 * A gym: four rooms walked as a 2×2 — entrance top-left, trainer top-right, puzzle
 * bottom-right, leader bottom-left — each a `FLOOR` rectangle in its own `WALL` ring.
 * Consecutive rooms share one wall and that wall carries exactly one `DOOR`, so the
 * four rooms are one walkable floor; the shared wall between the entrance and the
 * leader is never opened, which is what keeps them four rooms in a line, not a ring.
 */
function planGym(layout: Rng): InteriorDraft {
  const { width, height } = GYM_SIZE;
  const tiles = blank(width, height);

  const halfWidth = Math.floor(width / 2);
  const halfHeight = Math.floor(height / 2);
  const right = { x: halfWidth - RING, width: width - (halfWidth - RING) };
  const lower = { y: halfHeight - RING, height: height - (halfHeight - RING) };
  const rects: readonly Rect[] = [
    { x: 0, y: 0, width: halfWidth, height: halfHeight },
    { x: right.x, y: 0, width: right.width, height: halfHeight },
    { x: right.x, y: lower.y, width: right.width, height: lower.height },
    { x: 0, y: lower.y, width: halfWidth, height: lower.height },
  ];
  for (const rect of rects) paint(tiles, floorOf(rect), FLOOR);

  const doors: readonly Tile[] = [
    { x: halfWidth - RING, y: middleOf(0, halfHeight) },
    { x: middleOf(right.x, right.width), y: lower.y },
    { x: halfWidth - RING, y: middleOf(lower.y, lower.height) },
  ];
  for (const door of doors) tiles[door.y][door.x] = DOOR;

  const entry: Tile = { x: layout.int(RING + 1, halfWidth - RING - 1), y: height - 1 };
  tiles[entry.y][entry.x] = DOOR;

  const rooms: InteriorRoom[] = rects.map((rect, index) => {
    const doorIn = index === 0 ? undefined : doors[index - 1];
    return doorIn === undefined
      ? { index, name: GYM_ROOM_NAMES[index], rect }
      : { index, name: GYM_ROOM_NAMES[index], rect, doorIn };
  });

  const slots: readonly InteriorSlot[] = [
    {
      role: 'trainer',
      tile: {
        x: middleOf(rects[1].x, rects[1].width),
        y: middleOf(rects[1].y, rects[1].height),
      },
    },
    {
      role: 'leader',
      tile: {
        x: middleOf(rects[3].x, rects[3].width),
        y: middleOf(rects[3].y, rects[3].height),
      },
    },
  ];

  return { tiles, entry, slots, rooms };
}

export function planInterior(plan: RegionPlan, interiorKey: string, cityKey: string): InteriorPlan {
  const kind = interiorRoomKind(interiorKey);
  if (kind === null) throw new Error(`not an interior key: ${interiorKey}`);

  const layout = nodeStreams(plan.seed, `${cityKey}/${interiorKey}`).layout;
  const draft: InteriorDraft = kind === 'gym' ? planGym(layout) : planSmallRoom(kind, layout);
  const size = mapSize(draft.tiles);

  return {
    seed: plan.seed,
    interiorKey,
    cityKey,
    kind,
    width: size.width,
    height: size.height,
    tiles: draft.tiles,
    entry: draft.entry,
    returnTo: cityKey,
    slots: draft.slots,
    ...(draft.rooms === undefined ? {} : { rooms: draft.rooms }),
  };
}
