import { describe, expect, it } from 'vitest';
import { FINITE_MAPS } from './maps';
import * as population from './population';
import {
  TRAINER_ROOMS_MAX,
  TRAINER_ROOMS_PER_MAP,
  TRAINERS_PER_ROOM,
  trainerRoomsForMap,
} from './population';

describe('trainer rooms per map', () => {
  it('pins the human-chosen table, one row per finite map', () => {
    expect(TRAINER_ROOMS_PER_MAP).toEqual([2, 2, 3, 3, 3, 4, 4, 4]);
    expect(TRAINER_ROOMS_PER_MAP).toHaveLength(FINITE_MAPS);
    expect(TRAINER_ROOMS_MAX).toBe(6);
  });

  it('keeps one floor within the ceiling and one room within its per-room range', () => {
    for (const rooms of TRAINER_ROOMS_PER_MAP) {
      expect(rooms).toBeLessThanOrEqual(TRAINER_ROOMS_MAX);
      expect(rooms).toBeGreaterThanOrEqual(TRAINER_ROOMS_PER_MAP[0]);
    }
    expect(TRAINERS_PER_ROOM).toEqual({ min: 1, max: 2 });
  });

  it('reads the table on maps 1-8, grows past them and never drops below the first row', () => {
    const cases: ReadonlyArray<readonly [number, number]> = [
      [1, 2],
      [2, 2],
      [3, 3],
      [4, 3],
      [5, 3],
      [6, 4],
      [7, 4],
      [8, 4],
      [9, 4],
      [10, 5],
      [11, 5],
      [12, 6],
      [13, 6],
      [10_000, 6],
      [0, 2],
      [0.5, 2],
    ];
    for (const [mapIndex, expected] of cases) {
      expect(trainerRoomsForMap(mapIndex), `map ${mapIndex}`).toBe(expected);
    }
  });

  it('is monotonic and clamped for every deep map of an infinite run', () => {
    let previous = trainerRoomsForMap(1);
    for (let mapIndex = 2; mapIndex <= 200; mapIndex++) {
      const rooms = trainerRoomsForMap(mapIndex);
      expect(rooms, `map ${mapIndex}`).toBeGreaterThanOrEqual(previous);
      expect(rooms, `map ${mapIndex}`).toBeLessThanOrEqual(TRAINER_ROOMS_MAX);
      previous = rooms;
    }
  });

  it('exports only the trainer-room composition table', () => {
    expect(Object.keys(population).sort()).toEqual([
      'TRAINERS_PER_ROOM',
      'TRAINER_ROOMS_MAX',
      'TRAINER_ROOMS_PER_MAP',
      'trainerRoomsForMap',
    ]);
  });
});
