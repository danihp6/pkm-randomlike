import type { Tile } from '../../grid';
import type { Rng } from '../../rng';

/**
 * The **ice** puzzle (`docs/region-spec.md` §7.4): a gym's third room floored in ice,
 * where a step carries the player across the room until a solid cell stops them, and a
 * hole drops them into another room. This module is the room's whole geometry and rule —
 * the floor it lays, the cells it is made of, where each hole lands and what one step
 * does — and it is pure: no Phaser, no DOM, no clock, and no draw outside `layout`
 * (`D11`). A second puzzle is a second module and a second `PUZZLE_STACK` row, never a
 * branch in this one.
 */

/** The three cells an ice floor's rect can hold. */
export type IceCell = 'ice' | 'solid' | 'hole';

/** The four ways a step can go. */
export type SlideDir = 'up' | 'down' | 'left' | 'right';

/** Where a hole puts the player. */
export type IceLanding = Readonly<{
  /** The gym room's index in `InteriorPlan.rooms`: `0` is `entrance`. */
  room: number;
  /** The cell inside that room, in the interior's own map coordinates. */
  tile: Tile;
}>;

/** A gym's third room, floored in ice. */
export type IceRoom = Readonly<{
  /** The room it fills; every gym room list has exactly one `puzzle`. */
  room: 'puzzle';
  /** The room's rect in the interior's map coordinates, wall ring included. */
  rect: Readonly<{ x: number; y: number; width: number; height: number }>;
  /**
   * One row per `rect.height`, one entry per `rect.width`, in map coordinates:
   * `cells[y - rect.y][x - rect.x]`.
   */
  cells: readonly (readonly IceCell[])[];
  /** Where a hole drops the player, keyed by `iceCellKey(tile)` of the hole's own cell. */
  landings: Readonly<Record<string, IceLanding>>;
}>;

/** What one step does. */
export type SlideResult = Readonly<{
  /** Where the player ends standing: the last `ice` cell, or `from` when nothing moved. */
  stop: Tile;
  /** The cells crossed, in order, `stop` included; `[]` when nothing moved. A hole is never in it. */
  path: readonly Tile[];
  /** Non-null when the step fell through a hole. */
  landing: IceLanding | null;
}>;

/** The request the gym plan hands the floor: its own geometry and its own stream. */
export type IceRoomRequest = Readonly<{
  /** The `puzzle` room's rect (`InteriorRoom.rect`). */
  rect: Readonly<{ x: number; y: number; width: number; height: number }>;
  /** The cell the player enters the room on (`InteriorRoom.doorIn`); holes never stand next to it. */
  entry: Tile;
  /** The room a hole drops into (`PuzzleStackEntry.dropsInto`). */
  landingRoom: number;
  /** That room's rect, whose centre is where the player lands. */
  landingRect: Readonly<{ x: number; y: number; width: number; height: number }>;
  /** How many holes the floor holds (`PuzzleStackEntry.holes`). */
  holes: number;
  /**
   * Cells a hole must never stand on: the far door of the rooms this floor is the only
   * way into, and the cells in front of them. An ice floor can carry the player past a
   * cell but never lets them stop on one, so a hole there would shut the only way on
   * and ship an unwinnable gym.
   */
  keepClear?: readonly Tile[];
}>;

/** The ring of `solid` cells a room's rect wears: the one its walls are drawn on. */
const ICE_RING = 1;

/** The floor cell the slide rule starts each direction from. */
const SLIDE_STEP: Readonly<Record<SlideDir, Tile>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function manhattan(a: Tile, b: Tile): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Fisher-Yates in place, descending `i`, one `rng.int(0, i)` per step. */
function shuffle<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/** A cell's key in `IceRoom.landings`: `${tile.x},${tile.y}`. */
export function iceCellKey(tile: Tile): string {
  return `${tile.x},${tile.y}`;
}

/** The cell at `tile`, or `null` outside the rect. Total over any coordinate. */
export function iceCellAt(room: IceRoom, tile: Tile): IceCell | null {
  const x = tile.x - room.rect.x;
  const y = tile.y - room.rect.y;
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  if (y < 0 || y >= room.cells.length) return null;
  const row = room.cells[y];
  if (x < 0 || x >= row.length) return null;
  return row[x];
}

/**
 * The floor: an `ice` rectangle in a one-cell `solid` ring, with `holes` holes. A hole
 * stands at Manhattan distance 2 or more from `entry`, so entering the room never falls,
 * and never on one of `keepClear`'s cells.
 *
 * The shuffle stays over the whole eligible floor and `keepClear` is skipped while the
 * holes are picked, so a seed whose holes never landed on one of those cells replays the
 * floor it always had. A floor too small for the holes stays all ice with no landings: a
 * gym is never left unsolvable, and that refusal takes no draw off `layout` while the
 * floor is too small to hold them.
 */
export function planIceRoom(request: IceRoomRequest, layout: Rng): IceRoom {
  const rect = {
    x: request.rect.x,
    y: request.rect.y,
    width: request.rect.width,
    height: request.rect.height,
  };
  const cells: IceCell[][] = [];
  const open: Tile[] = [];

  for (let y = rect.y; y < rect.y + rect.height; y++) {
    const row: IceCell[] = [];
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      const onRing =
        x < rect.x + ICE_RING ||
        x >= rect.x + rect.width - ICE_RING ||
        y < rect.y + ICE_RING ||
        y >= rect.y + rect.height - ICE_RING;
      if (onRing) {
        row.push('solid');
        continue;
      }
      row.push('ice');
      if (manhattan({ x, y }, request.entry) >= 2) open.push({ x, y });
    }
    cells.push(row);
  }

  const landings: Record<string, IceLanding> = {};
  if (request.holes < 1 || open.length < request.holes) return { room: 'puzzle', rect, cells, landings };

  shuffle(open, layout);
  const clear = new Set((request.keepClear ?? []).map(iceCellKey));
  const sites = open.filter((cell) => !clear.has(iceCellKey(cell)));
  if (sites.length < request.holes) return { room: 'puzzle', rect, cells, landings };

  const centre: Tile = {
    x: request.landingRect.x + Math.floor(request.landingRect.width / 2),
    y: request.landingRect.y + Math.floor(request.landingRect.height / 2),
  };
  for (let index = 0; index < request.holes; index++) {
    const hole = sites[index];
    cells[hole.y - rect.y][hole.x - rect.x] = 'hole';
    landings[iceCellKey(hole)] = { room: request.landingRoom, tile: { x: centre.x, y: centre.y } };
  }

  return { room: 'puzzle', rect, cells, landings };
}

/**
 * One step from `from` in `dir`: the player crosses ice until a `solid` cell or the
 * rect's edge stops them, and a hole ends the step where they stood, dropping them into
 * its landing. Pure and total: never throws, never reads RNG.
 */
export function slideStep(room: IceRoom, from: Tile, dir: SlideDir): SlideResult {
  const step = SLIDE_STEP[dir];
  const path: Tile[] = [];
  let stop: Tile = { x: from.x, y: from.y };

  for (let x = from.x + step.x, y = from.y + step.y; ; x += step.x, y += step.y) {
    const cell = iceCellAt(room, { x, y });
    if (cell === 'ice') {
      stop = { x, y };
      path.push(stop);
      continue;
    }
    if (cell === 'hole') return { stop, path, landing: room.landings[iceCellKey({ x, y })] ?? null };
    return { stop, path, landing: null };
  }
}
