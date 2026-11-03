import { describe, expect, it } from 'vitest';
import {
  BUSH,
  CARPET,
  CHEST,
  COUNTER,
  DOOR,
  EXIT,
  FLOOR,
  HEAL,
  ITEM,
  LEDGE,
  PATH,
  PC,
  PLAZA,
  ROOF,
  ROCK,
  SIGN,
  TALL_GRASS,
  TRAP,
  WALL,
  WATER,
  cutsCorner,
  isExit,
  isWalkable,
  mapFromSketch,
  mapSize,
  moveToward,
  padMap,
  resolveMove,
  tileAt,
  triggersWildEncounter,
  type TileMap,
} from './map';

const map: TileMap = [
  [WALL, WALL, WALL, WALL],
  [WALL, FLOOR, TALL_GRASS, EXIT],
  [WALL, LEDGE, WATER, WALL],
  [WALL, WALL, WALL, WALL],
];

describe('isWalkable', () => {
  it('lets you stand on floor, grass and exit tiles', () => {
    expect(isWalkable(map, { x: 1, y: 1 })).toBe(true);
    expect(isWalkable(map, { x: 2, y: 1 })).toBe(true);
    expect(isWalkable(map, { x: 3, y: 1 })).toBe(true);
  });

  it('blocks walls, water and ledges', () => {
    expect(isWalkable(map, { x: 0, y: 1 })).toBe(false);
    expect(isWalkable(map, { x: 2, y: 2 })).toBe(false);
    expect(isWalkable(map, { x: 1, y: 2 })).toBe(false);
  });

  it('blocks out of bounds tiles', () => {
    expect(isWalkable(map, { x: -1, y: 1 })).toBe(false);
    expect(isWalkable(map, { x: 1, y: 9 })).toBe(false);
  });
});

describe('the obstacle seals', () => {
  /** Every map value, in declaration order, with the walkability it shipped with. */
  const VALUES: readonly (readonly [number, boolean])[] = [
    [FLOOR, true],
    [WALL, false],
    [EXIT, true],
    [TRAP, true],
    [CHEST, true],
    [ITEM, true],
    [WATER, false],
    [CARPET, true],
    [TALL_GRASS, true],
    [LEDGE, false],
    [BUSH, false],
    [ROCK, false],
    [PATH, true],
    [PLAZA, true],
    [ROOF, false],
    [DOOR, true],
    [SIGN, false],
    [COUNTER, false],
    [HEAL, false],
    [PC, false],
  ];

  it('numbers the two obstacle seals 10 and 11', () => {
    expect(BUSH).toBe(10);
    expect(ROCK).toBe(11);
  });

  it('blocks a bush and a rock, and every other solid', () => {
    for (const value of [WALL, WATER, LEDGE, BUSH, ROCK, ROOF, SIGN, COUNTER, HEAL, PC]) {
      expect(isWalkable([[value]], { x: 0, y: 0 }), `value ${value}`).toBe(false);
    }
  });

  it('keeps every other map value walkable exactly as it was', () => {
    for (const [value, walkable] of VALUES) {
      expect(isWalkable([[value]], { x: 0, y: 0 }), `value ${value}`).toBe(walkable);
    }
  });

  it('round-trips both seals through the sketch legend', () => {
    expect(mapFromSketch(['BR'])).toEqual([[BUSH, ROCK]]);
  });
});

describe('the city and interior vocabulary', () => {
  it('numbers the eight region kinds 12 to 19', () => {
    expect([PATH, PLAZA, ROOF, DOOR, SIGN, COUNTER, HEAL, PC]).toEqual([12, 13, 14, 15, 16, 17, 18, 19]);
  });

  it('lands each region kind on the walkability the generators are written against', () => {
    expect(isWalkable([[PATH]], { x: 0, y: 0 })).toBe(true);
    expect(isWalkable([[PLAZA]], { x: 0, y: 0 })).toBe(true);
    expect(isWalkable([[DOOR]], { x: 0, y: 0 })).toBe(true);
    expect(isWalkable([[ROOF]], { x: 0, y: 0 })).toBe(false);
    expect(isWalkable([[SIGN]], { x: 0, y: 0 })).toBe(false);
    expect(isWalkable([[COUNTER]], { x: 0, y: 0 })).toBe(false);
    expect(isWalkable([[HEAL]], { x: 0, y: 0 })).toBe(false);
    expect(isWalkable([[PC]], { x: 0, y: 0 })).toBe(false);
  });

  it('builds a city street from the sketch legend', () => {
    const city = mapFromSketch(['ZOPS', 'PD..', '"P#~']);
    expect(city).toEqual([
      [PLAZA, ROOF, PATH, SIGN],
      [PATH, DOOR, FLOOR, FLOOR],
      [TALL_GRASS, PATH, WALL, WATER],
    ]);
    expect(isWalkable(city, { x: 2, y: 1 })).toBe(true);
    expect(isWalkable(city, { x: 3, y: 2 })).toBe(false);
  });

  it('builds an interior room from the sketch legend', () => {
    const room = mapFromSketch(['#UHX', '#.D#']);
    expect(room).toEqual([
      [WALL, COUNTER, HEAL, PC],
      [WALL, FLOOR, DOOR, WALL],
    ]);
    for (const x of [1, 2, 3]) expect(isWalkable(room, { x, y: 0 })).toBe(false);
    expect(isWalkable(room, { x: 2, y: 1 })).toBe(true);
  });

  it('keeps the city grass a wild-encounter tile with no new rule', () => {
    const corner = mapFromSketch(['"P']);
    expect(tileAt(corner, { x: 0, y: 0 })).toBe(TALL_GRASS);
    expect(triggersWildEncounter(corner, { x: 0, y: 0 })).toBe(true);
    expect(triggersWildEncounter(corner, { x: 1, y: 0 })).toBe(false);
  });
});

describe('cutsCorner', () => {
  it('never penalises a cardinal step', () => {
    expect(cutsCorner(map, { x: 1, y: 1 }, { x: 1, y: 0 })).toBe(false);
  });

  it('blocks a diagonal squeezed between two solids', () => {
    expect(cutsCorner(map, { x: 1, y: 1 }, { x: 1, y: 1 })).toBe(true);
  });
});

describe('moveToward', () => {
  it('moves onto a walkable tile and reports success', () => {
    const player = { x: 1, y: 1 };
    expect(moveToward(player, { x: 1, y: 0 }, map)).toBe(true);
    expect(player).toEqual({ x: 2, y: 1 });
  });

  it('stays put against a wall', () => {
    const player = { x: 1, y: 1 };
    expect(moveToward(player, { x: -1, y: 0 }, map)).toBe(false);
    expect(player).toEqual({ x: 1, y: 1 });
  });
});

describe('resolveMove', () => {
  const ledgeMap: TileMap = [
    [WALL, WALL, WALL, WALL],
    [WALL, FLOOR, FLOOR, WALL],
    [WALL, LEDGE, FLOOR, WALL],
    [WALL, FLOOR, FLOOR, WALL],
    [WALL, WALL, WALL, WALL],
  ];

  it('takes a normal step onto a walkable tile', () => {
    expect(resolveMove(map, { x: 1, y: 1 }, { x: 1, y: 0 })).toEqual({
      to: { x: 2, y: 1 },
      jumped: false,
    });
  });

  it('jumps south over a ledge to the tile beyond', () => {
    expect(resolveMove(ledgeMap, { x: 1, y: 1 }, { x: 0, y: 1 })).toEqual({
      to: { x: 1, y: 3 },
      jumped: true,
    });
  });

  it('blocks entering a ledge from any other side', () => {
    expect(resolveMove(ledgeMap, { x: 1, y: 3 }, { x: 0, y: -1 })).toBeUndefined();
    expect(resolveMove(ledgeMap, { x: 1, y: 1 }, { x: 0, y: -1 })).toBeUndefined();
  });

  it('refuses the jump when the landing tile is not walkable', () => {
    const trapped: TileMap = [
      [WALL, WALL, WALL],
      [WALL, FLOOR, WALL],
      [WALL, LEDGE, WALL],
      [WALL, WALL, WALL],
    ];
    expect(resolveMove(trapped, { x: 1, y: 1 }, { x: 0, y: 1 })).toBeUndefined();
  });
});

describe('tile helpers', () => {
  it('reads tiles and reports size', () => {
    expect(tileAt(map, { x: 3, y: 1 })).toBe(EXIT);
    expect(tileAt(map, { x: 99, y: 1 })).toBeUndefined();
    expect(mapSize(map)).toEqual({ width: 4, height: 4 });
  });

  it('flags tall grass as the encounter tile and the exit as the route goal', () => {
    expect(triggersWildEncounter(map, { x: 2, y: 1 })).toBe(true);
    expect(triggersWildEncounter(map, { x: 1, y: 1 })).toBe(false);
    expect(isExit(map, { x: 3, y: 1 })).toBe(true);
  });
});

describe('padMap', () => {
  it('frames the map with the requested rings of fill', () => {
    const padded = padMap(map, 2, WALL);
    expect(mapSize(padded)).toEqual({ width: 8, height: 8 });
    expect(tileAt(padded, { x: 0, y: 0 })).toBe(WALL);
    expect(tileAt(padded, { x: 7, y: 7 })).toBe(WALL);
    expect(tileAt(padded, { x: 2 + 1, y: 2 + 1 })).toBe(FLOOR);
  });

  it('returns the map untouched without a margin', () => {
    expect(padMap(map, 0, WALL)).toBe(map);
  });

  it('frames each axis on its own when given an { x, y } margin', () => {
    const padded = padMap(map, { x: 1, y: 2 }, WALL);
    expect(mapSize(padded)).toEqual({ width: 6, height: 8 });
    expect(tileAt(padded, { x: 0, y: 0 })).toBe(WALL);
    expect(tileAt(padded, { x: 5, y: 7 })).toBe(WALL);
    expect(tileAt(padded, { x: 1, y: 2 })).toBe(WALL);
    expect(tileAt(padded, { x: 2, y: 3 })).toBe(FLOOR);
  });
});

describe('mapFromSketch', () => {
  it('turns one character per tile into map values', () => {
    expect(mapFromSketch(['#E', '."'])).toEqual([
      [WALL, EXIT],
      [FLOOR, TALL_GRASS],
    ]);
  });

  it('throws on an unknown character instead of silently drawing floor', () => {
    expect(() => mapFromSketch(['?'])).toThrow(/Unknown sketch character/);
  });
});
