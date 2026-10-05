import { describe, expect, it } from 'vitest';
import {
  EXIT,
  FLOOR,
  LEDGE,
  TALL_GRASS,
  WALL,
  WATER,
  cutsCorner,
  extendMap,
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

describe('extendMap', () => {
  it('continues the edge rows vertically and leaves the sides open', () => {
    const extended = extendMap(map, 1, WALL);
    expect(mapSize(extended)).toEqual({ width: 6, height: 6 });
    // The top ring row is copied above, so a border wall keeps going past the edge.
    expect(tileAt(extended, { x: 1, y: 0 })).toBe(WALL);
    // The side rings stay open, so the motif is not shifted one step aside.
    expect(tileAt(extended, { x: 0, y: 2 })).toBe(FLOOR);
    expect(tileAt(extended, { x: 5, y: 4 })).toBe(FLOOR);
    // The playable cells sit one ring in.
    expect(tileAt(extended, { x: 2, y: 2 })).toBe(FLOOR);
    expect(tileAt(extended, { x: 2, y: 1 })).toBe(WALL);
  });

  it('returns the map untouched without a margin', () => {
    expect(extendMap(map, 0, WALL)).toBe(map);
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
