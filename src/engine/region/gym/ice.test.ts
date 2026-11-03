import { describe, expect, it } from 'vitest';
import type { Tile } from '../../grid';
import { hashSeed, Rng } from '../../rng';
import {
  iceCellAt,
  iceCellKey,
  planIceRoom,
  slideStep,
  type IceCell,
  type IceLanding,
  type IceRoom,
  type IceRoomRequest,
  type SlideDir,
} from './ice';

const LEGEND: Readonly<Record<string, IceCell>> = { '#': 'solid', '.': 'ice', O: 'hole' };

/** The character a cell is drawn as in a sketch, so a room can be read back as one. */
function sketchOf(cell: IceCell): string {
  return cell === 'solid' ? '#' : cell === 'hole' ? 'O' : '.';
}

/** A hand-built floor: `rows` read top-down from `origin`, holes landed where `landings` says. */
function handRoom(
  rows: readonly string[],
  origin: Tile = { x: 0, y: 0 },
  landings: Readonly<Record<string, IceLanding>> = {},
): IceRoom {
  return {
    room: 'puzzle',
    rect: { x: origin.x, y: origin.y, width: rows[0].length, height: rows.length },
    cells: rows.map((row) => [...row].map((char) => LEGEND[char])),
    landings,
  };
}

function cellsOf(room: IceRoom): { x: number; y: number; cell: IceCell }[] {
  const out: { x: number; y: number; cell: IceCell }[] = [];
  for (let y = 0; y < room.cells.length; y++) {
    for (let x = 0; x < room.cells[y].length; x++) {
      out.push({ x: room.rect.x + x, y: room.rect.y + y, cell: room.cells[y][x] });
    }
  }
  return out;
}

/** A gym's third room, as `planInterior` emits it: a 21x21 rect at 19,19 in a 40x40 map. */
const GYM_REQUEST: IceRoomRequest = {
  rect: { x: 19, y: 19, width: 21, height: 21 },
  entry: { x: 29, y: 19 },
  landingRoom: 0,
  landingRect: { x: 0, y: 0, width: 20, height: 20 },
  holes: 3,
};

const LANDING: IceLanding = { room: 2, tile: { x: 7, y: 9 } };

const OPEN: readonly string[] = [
  '#######',
  '#.....#',
  '#.....#',
  '#.....#',
  '#.....#',
  '#.....#',
  '#######',
];

describe('ice floor cells', () => {
  it('reads a cell in map coordinates and answers null outside the rect', () => {
    const room = handRoom(['###', '#O#', '###'], { x: 10, y: 20 }, { '11,21': LANDING });
    expect(iceCellAt(room, { x: 10, y: 20 })).toBe('solid');
    expect(iceCellAt(room, { x: 11, y: 21 })).toBe('hole');
    expect(iceCellAt(room, { x: 9, y: 21 })).toBeNull();
    expect(iceCellAt(room, { x: 13, y: 21 })).toBeNull();
    expect(iceCellAt(room, { x: 11, y: 19 })).toBeNull();
    expect(iceCellAt(room, { x: 11, y: 23 })).toBeNull();
    expect(iceCellAt(room, { x: 11.5, y: 21 })).toBeNull();
    expect(iceCellAt(room, { x: Number.NaN, y: 21 })).toBeNull();
  });

  it('keys a cell as its map coordinates', () => {
    expect(iceCellKey({ x: 29, y: 19 })).toBe('29,19');
    expect(iceCellKey({ x: -1, y: 0 })).toBe('-1,0');
  });
});

describe('the ice slide rule', () => {
  it('crosses open ice and stops on the cell before the first solid', () => {
    const room = handRoom(['######', '#....#', '######'], { x: 10, y: 20 });
    const result = slideStep(room, { x: 11, y: 21 }, 'right');
    expect(result).toEqual({
      stop: { x: 14, y: 21 },
      path: [
        { x: 12, y: 21 },
        { x: 13, y: 21 },
        { x: 14, y: 21 },
      ],
      landing: null,
    });
    expect(iceCellAt(room, { x: result.stop.x + 1, y: result.stop.y })).toBe('solid');
  });

  it('answers no movement when the first cell in the way is blocked', () => {
    const room = handRoom(['######', '#....#', '######'], { x: 10, y: 20 });
    const from: Tile = { x: 11, y: 21 };
    expect(slideStep(room, from, 'left')).toEqual({ stop: from, path: [], landing: null });
    expect(slideStep(room, { x: 10, y: 20 }, 'up')).toEqual({
      stop: { x: 10, y: 20 },
      path: [],
      landing: null,
    });
    expect(slideStep(room, { x: 99, y: 99 }, 'down')).toEqual({
      stop: { x: 99, y: 99 },
      path: [],
      landing: null,
    });
    expect(slideStep(room, { x: 11, y: 21 }, 'up').path).toEqual([]);
  });

  it('falls through a hole midway, landing where the hole does and never crossing it', () => {
    const room = handRoom(['#######', '#..O..#', '#######'], { x: 0, y: 0 }, { '3,1': LANDING });
    const result = slideStep(room, { x: 1, y: 1 }, 'right');
    expect(result.stop).toEqual({ x: 2, y: 1 });
    expect(result.path).toEqual([{ x: 2, y: 1 }]);
    expect(result.path).not.toContainEqual({ x: 3, y: 1 });
    expect(result.landing).toEqual(LANDING);
    expect(result.landing).toBe(room.landings['3,1']);
  });

  it('falls through a hole on the very first cell, standing still', () => {
    const room = handRoom(['#####', '#O..#', '#####'], { x: 0, y: 0 }, { '1,1': LANDING });
    const from: Tile = { x: 0, y: 1 };
    const result = slideStep(room, from, 'right');
    expect(result.stop).toEqual(from);
    expect(result.path).toEqual([]);
    expect(result.landing).toEqual(LANDING);
    expect(result.landing).not.toBeNull();
  });

  it('slides the four ways from open ice', () => {
    const room = handRoom(OPEN);
    const from: Tile = { x: 3, y: 3 };
    const expected: Readonly<Record<SlideDir, Tile>> = {
      up: { x: 3, y: 1 },
      down: { x: 3, y: 5 },
      left: { x: 1, y: 3 },
      right: { x: 5, y: 3 },
    };
    for (const dir of ['up', 'down', 'left', 'right'] as const) {
      const result = slideStep(room, from, dir);
      expect(result.stop, dir).toEqual(expected[dir]);
      expect(result.landing, dir).toBeNull();
      expect(result.path[result.path.length - 1], dir).toEqual(expected[dir]);
    }
    expect(slideStep(room, from, 'up').path).toEqual([
      { x: 3, y: 2 },
      { x: 3, y: 1 },
    ]);
  });
});

describe('planning an ice floor', () => {
  const build = (request: IceRoomRequest = GYM_REQUEST, seed = 'alpha'): IceRoom =>
    planIceRoom(request, new Rng(hashSeed(seed)));

  it('covers the whole rect, one row per height and one entry per width', () => {
    const room = build();
    expect(room.room).toBe('puzzle');
    expect(room.rect).toEqual(GYM_REQUEST.rect);
    expect(room.cells).toHaveLength(GYM_REQUEST.rect.height);
    for (const row of room.cells) expect(row).toHaveLength(GYM_REQUEST.rect.width);
  });

  it('wears a solid ring on all four sides', () => {
    const room = build();
    const { x, y, width, height } = room.rect;
    for (let column = x; column < x + width; column++) {
      expect(iceCellAt(room, { x: column, y }), `top ${column}`).toBe('solid');
      expect(iceCellAt(room, { x: column, y: y + height - 1 }), `bottom ${column}`).toBe('solid');
    }
    for (let row = y; row < y + height; row++) {
      expect(iceCellAt(room, { x, y: row }), `left ${row}`).toBe('solid');
      expect(iceCellAt(room, { x: x + width - 1, y: row }), `right ${row}`).toBe('solid');
    }
    const inside = cellsOf(room).filter(
      (cell) => cell.x > x && cell.x < x + width - 1 && cell.y > y && cell.y < y + height - 1,
    );
    expect(inside.every((cell) => cell.cell === 'ice' || cell.cell === 'hole')).toBe(true);
  });

  it('cuts exactly the stack row holes, each landing on the landing room centre', () => {
    const room = build();
    const holes = cellsOf(room).filter((cell) => cell.cell === 'hole');
    expect(holes).toHaveLength(GYM_REQUEST.holes);

    const centre: Tile = { x: 10, y: 10 };
    expect(Object.keys(room.landings).sort()).toEqual(holes.map((hole) => iceCellKey(hole)).sort());
    for (const hole of holes) {
      const landing = room.landings[iceCellKey(hole)];
      expect(landing, iceCellKey(hole)).toEqual({ room: GYM_REQUEST.landingRoom, tile: centre });
    }
    expect(new Set(holes.map((hole) => iceCellKey(hole))).size).toBe(GYM_REQUEST.holes);
  });

  it('never cuts a hole within one step of the room entry', () => {
    for (const seed of ['alpha', 'bravo', 'charlie', 'delta']) {
      const room = build(GYM_REQUEST, seed);
      for (const hole of cellsOf(room).filter((cell) => cell.cell === 'hole')) {
        const distance = Math.abs(hole.x - GYM_REQUEST.entry.x) + Math.abs(hole.y - GYM_REQUEST.entry.y);
        expect(distance, seed).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('replays a seed and answers another one a different floor', () => {
    expect(build()).toEqual(build());
    expect(build(GYM_REQUEST, 'bravo')).not.toEqual(build(GYM_REQUEST, 'alpha'));
    expect(build(GYM_REQUEST, 'bravo')).toEqual(build(GYM_REQUEST, 'bravo'));
  });

  it('leaves a floor too small for its holes all ice, with no landings', () => {
    const small = build({ ...GYM_REQUEST, rect: { x: 0, y: 0, width: 3, height: 3 } });
    expect(small.cells.flat().filter((cell) => cell === 'hole')).toEqual([]);
    expect(small.landings).toEqual({});
    expect(small.cells.map((row) => row.map((cell) => sketchOf(cell)).join(''))).toEqual([
      '###',
      '#.#',
      '###',
    ]);
  });

  it('never cuts a hole on a cell the request keeps clear', () => {
    const keepClear: readonly Tile[] = [
      { x: 21, y: 21 },
      { x: 28, y: 29 },
      { x: 37, y: 37 },
    ];
    for (const seed of ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot']) {
      const room = build({ ...GYM_REQUEST, keepClear }, seed);
      for (const cell of keepClear) {
        expect(iceCellAt(room, cell), `${seed} ${iceCellKey(cell)}`).toBe('ice');
      }
      expect(cellsOf(room).filter((cell) => cell.cell === 'hole')).toHaveLength(GYM_REQUEST.holes);
    }
  });

  it('replays the floor it always had when no hole landed on a kept cell', () => {
    const plain = build();
    const kept = cellsOf(plain).find((cell) => cell.cell === 'ice');
    if (kept === undefined) throw new Error('the floor has no ice cell');
    expect(build({ ...GYM_REQUEST, keepClear: [{ x: kept.x, y: kept.y }] })).toEqual(plain);
  });

  it('moves aside the hole it would have cut on a kept cell', () => {
    const plain = build();
    const holes = cellsOf(plain).filter((cell) => cell.cell === 'hole');
    expect(holes).toHaveLength(GYM_REQUEST.holes);
    const kept = holes[0];
    const moved = build({ ...GYM_REQUEST, keepClear: [{ x: kept.x, y: kept.y }] });
    expect(moved).not.toEqual(plain);
    expect(iceCellAt(moved, kept)).toBe('ice');
    expect(cellsOf(moved).filter((cell) => cell.cell === 'hole')).toHaveLength(GYM_REQUEST.holes);
    expect(moved.landings[iceCellKey(kept)]).toBeUndefined();
  });

  it('stays all ice when the kept cells leave fewer sites than holes', () => {
    const room = build({
      rect: { x: 0, y: 0, width: 5, height: 5 },
      entry: { x: 2, y: 2 },
      landingRoom: 0,
      landingRect: { x: 0, y: 0, width: 3, height: 3 },
      holes: 3,
      keepClear: [
        { x: 1, y: 1 },
        { x: 1, y: 3 },
        { x: 3, y: 1 },
      ],
    });
    expect(room.cells.flat().filter((cell) => cell === 'hole')).toEqual([]);
    expect(room.landings).toEqual({});
  });

  it('stays pure: the request is never mutated', () => {
    const request: IceRoomRequest = {
      rect: { ...GYM_REQUEST.rect },
      entry: { ...GYM_REQUEST.entry },
      landingRoom: GYM_REQUEST.landingRoom,
      landingRect: { ...GYM_REQUEST.landingRect },
      holes: GYM_REQUEST.holes,
    };
    const frozen = JSON.stringify(request);
    const room = build(request);
    expect(JSON.stringify(request)).toBe(frozen);
    expect(room.rect).not.toBe(request.rect);
  });
});
