import { describe, expect, it } from 'vitest';
import {
  EXIT,
  FLOOR,
  LEDGE,
  TALL_GRASS,
  WALL,
  WATER,
  cutsCorner,
  isExit,
  isWalkable,
  mapFromSketch,
  mapSize,
  moveToward,
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
