import { describe, expect, it } from 'vitest';
import { biomeForRoute } from '../../data/biomes';
import type { Tile } from '../grid';
import { isWalkable, mapFromSketch, type TileMap } from '../map';
import { FACINGS, FACING_VECTORS, tileKey } from './routeMap';
import {
  PREVIEW_BIOME_ID,
  PREVIEW_TILE,
  previewRoute,
  previewWalkers,
  stepPreviewWalkers,
  type PreviewRoom,
  type PreviewWalker,
} from './preview';

/** The two windows the panel asks for: the desk frame and the phone one. */
const DESK = { x: 96, y: 150, w: 560, h: 380 } as const;
const PHONE = { x: 16, y: 126, w: 358, h: 240 } as const;

/** The seeds the walk is measured on: the QA failures first, then a fixed cast. */
const WALK_SEEDS = [
  '107sfke',
  'i67xd',
  '12baz4z',
  '1e034xj',
  'suvjia',
  '1l8gvox',
  'pkm-198',
  'seed-a',
  'seed-b',
  '0198',
  'alpha',
  'bravo',
  'charlie',
  'delta',
  'echo',
  'foxtrot',
  'golf',
  'hotel',
  'india',
  'juliet',
] as const;
const WALK_TICKS = 14;

function walkableOf(tiles: TileMap): Tile[] {
  const out: Tile[] = [];
  for (let y = 0; y < tiles.length; y++) {
    for (let x = 0; x < tiles[y].length; x++) {
      if (isWalkable(tiles, { x, y })) out.push({ x, y });
    }
  }
  return out;
}

/** How many walkable cardinals a tile has inside the room. */
function walkableDegree(room: PreviewRoom, tile: Tile): number {
  let count = 0;
  for (const facing of FACINGS) {
    const vector = FACING_VECTORS[facing];
    const next = { x: tile.x + vector.x, y: tile.y + vector.y };
    if (next.x < 0 || next.x >= room.cols || next.y < 0 || next.y >= room.rows) continue;
    if (isWalkable(room.tiles, next)) count += 1;
  }
  return count;
}

function roomFromSketch(rows: readonly string[], seed = 'synthetic'): PreviewRoom {
  const tiles = mapFromSketch(rows);
  return {
    seed,
    rect: { x: 0, y: 0, w: rows[0]!.length * PREVIEW_TILE, h: rows.length * PREVIEW_TILE },
    cols: rows[0]!.length,
    rows: rows.length,
    tile: PREVIEW_TILE,
    biomeId: PREVIEW_BIOME_ID,
    tiles,
    walkable: walkableOf(tiles),
  };
}

function walkerAt(tile: Tile, previous?: Tile, id = 0): PreviewWalker {
  return {
    id,
    speciesId: 'pikachu',
    tile: { ...tile },
    facing: 'N',
    ...(previous === undefined ? {} : { previous: { ...previous } }),
  };
}

function foldWalk(
  route: PreviewRoom,
  start: readonly PreviewWalker[],
  steps: number,
): readonly (readonly PreviewWalker[])[] {
  const frames: PreviewWalker[][] = [[...start]];
  let walkers: readonly PreviewWalker[] = start;
  for (let step = 0; step < steps; step++) {
    walkers = stepPreviewWalkers(route, walkers, step);
    frames.push([...walkers]);
  }
  return frames;
}

function describeFrame(frame: readonly PreviewWalker[]): string {
  return frame
    .map((walker) => `${walker.speciesId}@${tileKey(walker.tile)}:${walker.facing}`)
    .join(' | ');
}

describe('previewRoute', () => {
  it('derives the tile count from the window and echoes the rect unchanged', () => {
    const desk = previewRoute('seed-a', DESK);
    const phone = previewRoute('seed-b', PHONE);

    expect(desk.cols).toBe(23);
    expect(desk.rows).toBe(15);
    expect(desk.tile).toBe(PREVIEW_TILE);
    expect(desk.rect).toEqual(DESK);
    expect(phone.cols).toBe(14);
    expect(phone.rows).toBe(10);
    expect(phone.rect).toEqual(PHONE);
    expect(desk.tiles).toHaveLength(15);
    for (const row of desk.tiles) expect(row).toHaveLength(23);
    expect(phone.tiles).toHaveLength(10);
    for (const row of phone.tiles) expect(row).toHaveLength(14);
  });

  it('previews the first map’s biome, from the seed alone', () => {
    expect(PREVIEW_BIOME_ID).toBe(biomeForRoute(1).id);
    expect(previewRoute('seed-a', DESK).biomeId).toBe(PREVIEW_BIOME_ID);
  });

  it('is deterministic and never reads the run’s own room', () => {
    expect(previewRoute('seed-a', DESK)).toEqual(previewRoute('seed-a', DESK));
    expect(previewRoute('seed-b', DESK)).not.toEqual(previewRoute('seed-a', DESK));
  });

  it('lists every walkable tile once, row-major', () => {
    for (const window of [DESK, PHONE]) {
      const room = previewRoute('seed-a', window);
      const expected = walkableOf(room.tiles).map(tileKey);

      expect(room.walkable.length).toBeGreaterThan(0);
      expect(room.walkable.map(tileKey)).toEqual(expected);
      expect(new Set(room.walkable.map(tileKey)).size).toBe(room.walkable.length);
      for (const tile of room.walkable) expect(isWalkable(room.tiles, tile)).toBe(true);
    }
  });

  it('keeps the exact grid for a size the generator refuses', () => {
    const room = previewRoute('seed-a', { x: 0, y: 0, w: 48, h: 48 });

    expect(room.cols).toBe(2);
    expect(room.rows).toBe(2);
    expect(room.tiles).toHaveLength(2);
    for (const row of room.tiles) expect(row).toHaveLength(2);
    expect(room.walkable.length).toBeGreaterThan(0);
  });

  it('never asks for less than one cell', () => {
    const room = previewRoute('seed-a', { x: 0, y: 0, w: 0, h: 0 });

    expect([room.cols, room.rows]).toEqual([1, 1]);
    expect(room.tiles).toHaveLength(1);
    expect(room.walkable).toHaveLength(1);
  });
});

describe('previewWalkers', () => {
  it('draws two or three distinct species onto the walkable floor', () => {
    for (const seed of ['seed-a', 'seed-b', 'pkm-198']) {
      const room = previewRoute(seed, DESK);
      const walkers = previewWalkers(room);
      const walkable = new Set(room.walkable.map(tileKey));

      expect(walkers.length).toBeGreaterThanOrEqual(2);
      expect(walkers.length).toBeLessThanOrEqual(3);
      expect(new Set(walkers.map((walker) => walker.speciesId)).size).toBe(walkers.length);
      expect(walkers.map((walker) => walker.id)).toEqual(walkers.map((_, index) => index));
      for (const walker of walkers) {
        expect(walkable.has(tileKey(walker.tile))).toBe(true);
        expect(['N', 'E', 'S', 'W']).toContain(walker.facing);
      }
    }
  });

  it('replays the same walkers for the same room', () => {
    const room = previewRoute('seed-a', DESK);

    expect(previewWalkers(room)).toEqual(previewWalkers(room));
    expect(previewWalkers(previewRoute('seed-b', DESK))).not.toEqual(previewWalkers(room));
  });
});

describe('stepPreviewWalkers', () => {
  it('moves onto a walkable neighbour and stays inside the room', () => {
    const room = previewRoute('seed-a', DESK);
    let walkers = previewWalkers(room);

    for (let step = 0; step < 20; step++) {
      const next = stepPreviewWalkers(room, walkers, step);
      expect(next).toHaveLength(walkers.length);
      next.forEach((walker, index) => {
        const before = walkers[index]!;
        expect(walker.id).toBe(before.id);
        expect(walker.speciesId).toBe(before.speciesId);
        expect(walker.tile.x).toBeGreaterThanOrEqual(0);
        expect(walker.tile.x).toBeLessThan(room.cols);
        expect(walker.tile.y).toBeGreaterThanOrEqual(0);
        expect(walker.tile.y).toBeLessThan(room.rows);
        expect(isWalkable(room.tiles, walker.tile)).toBe(true);
        const distance =
          Math.abs(walker.tile.x - before.tile.x) + Math.abs(walker.tile.y - before.tile.y);
        expect(distance).toBeLessThanOrEqual(1);
      });
      walkers = next;
    }
  });

  it('folds steps 0 … 19 twice into the same legal walk', () => {
    const room = previewRoute('pkm-198', DESK);
    const start = previewWalkers(room);
    const first = foldWalk(room, start, 20);
    const second = foldWalk(room, start, 20);

    expect(second).toEqual(first);
    const walkable = new Set(room.walkable.map(tileKey));
    for (const frame of first) {
      for (const walker of frame) expect(walkable.has(tileKey(walker.tile))).toBe(true);
    }
  });

  it('keeps the folded walk replayable off the printed regression', () => {
    const room = previewRoute('pkm-198', DESK);

    expect(foldWalk(room, previewWalkers(room), 3).map(describeFrame)).toEqual([
      'buneary@4,8:N | barraskewda@17,7:W',
      'buneary@3,8:W | barraskewda@18,7:E',
      'buneary@3,7:N | barraskewda@18,6:N',
      'buneary@3,6:N | barraskewda@17,6:W',
    ]);
  });

  it('truncates a negative or non-finite step to zero', () => {
    const room = previewRoute('seed-a', DESK);
    const walkers = previewWalkers(room);
    const zero = stepPreviewWalkers(room, walkers, 0);

    expect(stepPreviewWalkers(room, walkers, -3)).toEqual(zero);
    expect(stepPreviewWalkers(room, walkers, Number.NaN)).toEqual(zero);
    expect(stepPreviewWalkers(room, walkers, Number.POSITIVE_INFINITY)).toEqual(zero);
    expect(stepPreviewWalkers(room, walkers, 1.9)).toEqual(stepPreviewWalkers(room, walkers, 1));
  });
});

describe('the walk never metronomes', () => {
  it('starts every walker where a second step exists', () => {
    for (const seed of WALK_SEEDS) {
      const room = previewRoute(seed, PHONE);
      for (const walker of previewWalkers(room)) {
        expect(walkableDegree(room, walker.tile), `${seed} w${walker.id}`).toBeGreaterThan(1);
      }
    }
  });

  it('never walks straight back into the tile it just left, over 20 seeds × 14 ticks', () => {
    for (const seed of WALK_SEEDS) {
      const room = previewRoute(seed, PHONE);
      const frames = foldWalk(room, previewWalkers(room), WALK_TICKS);

      for (let t = 0; t < WALK_TICKS; t++) {
        for (const walker of frames[t]!) {
          const next = frames[t + 1]!.find((entry) => entry.id === walker.id)!;
          expect(isWalkable(room.tiles, next.tile), `${seed} w${walker.id} t${t}`).toBe(true);
          expect(new Set(room.walkable.map(tileKey)).has(tileKey(next.tile))).toBe(true);
          if (walkableDegree(room, walker.tile) > 1) {
            expect(tileKey(next.tile), `${seed} w${walker.id} u-turn at t${t}`).not.toBe(
              tileKey(walker.tile),
            );
          }
        }
      }
      expect(foldWalk(room, previewWalkers(room), WALK_TICKS), seed).toEqual(frames);
    }
  });

  it('never comes back to the same tile two ticks later, wherever a second way was open', () => {
    for (const seed of WALK_SEEDS) {
      const room = previewRoute(seed, PHONE);
      const frames = foldWalk(room, previewWalkers(room), WALK_TICKS);
      const startsFree = previewWalkers(room).every((walker) => walkableDegree(room, walker.tile) > 1);

      for (let t = 0; t + 2 < frames.length; t++) {
        for (const walker of frames[t]!) {
          const next = frames[t + 1]!.find((entry) => entry.id === walker.id)!;
          const later = frames[t + 2]!.find((entry) => entry.id === walker.id)!;
          if (startsFree || walkableDegree(room, next.tile) > 1) {
            expect(tileKey(later.tile), `${seed} w${walker.id} period-2 at t${t}`).not.toBe(
              tileKey(walker.tile),
            );
          }
        }
      }
    }
  });

  it('turns away from its own previous tile in an open room, for 20 ticks', () => {
    const room = roomFromSketch(['#####', '#...#', '#...#', '#...#', '#####']);
    const frames = foldWalk(room, [walkerAt({ x: 2, y: 2 }, { x: 2, y: 1 })], 20);

    for (let t = 0; t + 2 < frames.length; t++) {
      const here = frames[t]![0]!;
      const next = frames[t + 1]![0]!;
      const later = frames[t + 2]![0]!;
      expect(walkableDegree(room, next.tile)).toBeGreaterThan(1);
      expect(tileKey(next.tile), `u-turn at t${t}`).not.toBe(tileKey(here.tile));
      expect(tileKey(later.tile), `period-2 at t${t}`).not.toBe(tileKey(here.tile));
      expect(next.previous).toEqual(here.tile);
    }
  });

  it('may still reverse in a corridor that offers nothing else', () => {
    const room = roomFromSketch(['####', '#..#', '####']);
    const walkers = [walkerAt({ x: 1, y: 1 }, { x: 2, y: 1 })];

    const next = stepPreviewWalkers(room, walkers, 0);

    expect(next[0]!.tile).toEqual({ x: 2, y: 1 });
    expect(next[0]!.facing).toBe('E');
    expect(next[0]!.previous).toEqual({ x: 1, y: 1 });
  });

  it('stays put on a room with nowhere to go', () => {
    const room = roomFromSketch(['###', '#.#', '###']);
    const walkers = [walkerAt({ x: 1, y: 1 })];

    const next = stepPreviewWalkers(room, walkers, 3);

    expect(next[0]!.tile).toEqual({ x: 1, y: 1 });
    expect(next[0]!.previous).toEqual({ x: 1, y: 1 });
  });
});
