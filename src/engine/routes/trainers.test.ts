import { describe, expect, it } from 'vitest';
import { mapFromSketch, type TileMap } from '../map';
import { sightLine, seesPlayer, trainerAt, trainerBlockers } from './trainers';
import type { RouteMap, RouteTrainer } from './routeMap';

function route(tiles: TileMap, trainers: RouteTrainer[]): RouteMap {
  return {
    seed: 'test',
    routeIndex: 1,
    biomeId: 'wood',
    width: tiles[0].length,
    height: tiles.length,
    tiles,
    start: { x: 1, y: 1 },
    exit: { x: 5, y: 3 },
    trainers,
    items: [],
  };
}

const watcher = (x: number, y: number, facing: RouteTrainer['facing'] = 'E', sight = 5): RouteTrainer => ({
  id: `w-${x}-${y}`,
  position: { x, y },
  facing,
  sight,
  archetypeId: 'youngster',
});

const openMap = mapFromSketch(['#######', '#.....#', '#.....#', '#.....#', '#######']);

describe('sightLine', () => {
  it('runs along the facing up to the sight range and stops at walls', () => {
    const map = route(openMap, [watcher(1, 1)]);
    expect(sightLine(map, map.trainers[0])).toEqual([
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
      { x: 5, y: 1 },
    ]);
  });

  it('stops at a wall before its range', () => {
    const tiles = mapFromSketch(['#######', '#..#..#', '#.....#', '#.....#', '#######']);
    const map = route(tiles, [watcher(1, 1)]);
    expect(sightLine(map, map.trainers[0])).toEqual([{ x: 2, y: 1 }]);
  });

  it('stops at another trainer', () => {
    const map = route(openMap, [watcher(1, 1), watcher(3, 1, 'S')]);
    expect(sightLine(map, map.trainers[0])).toEqual([{ x: 2, y: 1 }]);
    expect(trainerBlockers(map, map.trainers[0]).has('3,1')).toBe(true);
  });
});

describe('seesPlayer', () => {
  const map = route(openMap, [watcher(1, 1)]);

  it('sees a player straight ahead within range', () => {
    expect(seesPlayer(map, map.trainers[0], { x: 3, y: 1 })).toBe(true);
    expect(seesPlayer(map, map.trainers[0], { x: 5, y: 1 })).toBe(true);
  });

  it('does not see off-axis, behind, or beyond a wall', () => {
    expect(seesPlayer(map, map.trainers[0], { x: 3, y: 2 })).toBe(false);
    expect(seesPlayer(map, map.trainers[0], { x: 1, y: 2 })).toBe(false);
    const walled = route(
      mapFromSketch(['#######', '#..#..#', '#.....#', '#.....#', '#######']),
      [watcher(1, 1)],
    );
    expect(seesPlayer(walled, walled.trainers[0], { x: 4, y: 1 })).toBe(false);
  });

  it('does not see past its sight range', () => {
    const short = route(openMap, [watcher(1, 1, 'E', 2)]);
    expect(seesPlayer(short, short.trainers[0], { x: 3, y: 1 })).toBe(true);
    expect(seesPlayer(short, short.trainers[0], { x: 4, y: 1 })).toBe(false);
  });

  it('finds the trainer standing on a tile', () => {
    expect(trainerAt(map, { x: 1, y: 1 })?.id).toBe('w-1-1');
    expect(trainerAt(map, { x: 2, y: 1 })).toBeUndefined();
  });
});
