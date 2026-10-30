import { describe, expect, it } from 'vitest';
import { biomeForRoute } from '../../data/biomes';
import type { Tile } from '../grid';
import { isWalkable, mapFromSketch, type TileMap } from '../map';
import { FACINGS, FACING_VECTORS, tileKey } from './routeMap';
import type { Facing } from './routeMap';
import {
  PREVIEW_BIOME_ID,
  PREVIEW_TICK_MS,
  PREVIEW_TILE,
  STRIDE_MAX_TILES,
  STRIDE_MIN_TILES,
  STRIDE_REST_MAX_MS,
  STRIDE_REST_MIN_MS,
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
    path: [],
    rest: 0,
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

type Stride = Readonly<{ tick: number; before: PreviewWalker; after: PreviewWalker }>;

/** Every booked stride of a fold, in tick and walker order; a resting tick carries none. */
function stridesOf(route: PreviewRoom, start: readonly PreviewWalker[], ticks: number): Stride[] {
  const strides: Stride[] = [];
  let walkers: readonly PreviewWalker[] = start;
  for (let tick = 0; tick < ticks; tick++) {
    const next = stepPreviewWalkers(route, walkers, tick);
    next.forEach((after, index) => {
      const before = walkers[index]!;
      if (after.path.length > 0) strides.push({ tick, before, after });
    });
    walkers = next;
  }
  return strides;
}

function describeFrame(frame: readonly PreviewWalker[]): string {
  return frame
    .map(
      (walker) =>
        `${walker.speciesId}@${tileKey(walker.tile)}:${walker.facing}:${walker.path
          .map(tileKey)
          .join('>')}:${walker.rest}`,
    )
    .join(' | ');
}

type TestStep = Readonly<{ tile: Tile; facing: Facing }>;

function sameTile(a: Tile, b: Tile): boolean {
  return a.x === b.x && a.y === b.y;
}

/** The walkable cardinals of `tile`, in `FACINGS` order. */
function stepsFrom(room: PreviewRoom, tile: Tile): TestStep[] {
  const steps: TestStep[] = [];
  for (const facing of FACINGS) {
    const vector = FACING_VECTORS[facing];
    const next = { x: tile.x + vector.x, y: tile.y + vector.y };
    if (next.x < 0 || next.x >= room.cols || next.y < 0 || next.y >= room.rows) continue;
    if (!isWalkable(room.tiles, next)) continue;
    steps.push({ tile: next, facing });
  }
  return steps;
}

/** The stride's own refusal rule, mirrored so the sweep can name the run of a heading. */
function straightRun(
  room: PreviewRoom,
  from: Tile,
  facing: Facing,
  cap: number,
  previous?: Tile,
): Tile[] {
  const vector = FACING_VECTORS[facing];
  const run: Tile[] = [from];
  while (run.length < cap) {
    const last = run[run.length - 1]!;
    const next = { x: last.x + vector.x, y: last.y + vector.y };
    if (next.x < 0 || next.x >= room.cols || next.y < 0 || next.y >= room.rows) break;
    if (!isWalkable(room.tiles, next)) break;
    if (previous !== undefined && sameTile(next, previous)) break;
    if (run.some((tile) => sameTile(tile, next))) break;
    run.push(next);
  }
  return run;
}

/** The tiles a stride would book along `step`'s heading, never fewer than one. */
function runOf(room: PreviewRoom, step: TestStep, previous?: Tile): number {
  return straightRun(room, step.tile, step.facing, Math.max(room.cols, room.rows), previous).length;
}

/** The candidates of a walker's tick: the forward pool, then the fresh one, then all. */
function candidatesOf(room: PreviewRoom, walker: PreviewWalker): TestStep[] {
  const all = stepsFrom(room, walker.tile);
  const fresh =
    walker.previous === undefined
      ? all
      : all.filter((candidate) => !sameTile(candidate.tile, walker.previous!));
  const forward = fresh.filter((candidate) =>
    stepsFrom(room, candidate.tile).some((next) => !sameTile(next.tile, walker.tile)),
  );
  return forward.length > 0 ? forward : fresh.length > 0 ? fresh : all;
}

/**
 * The pool a tick draws its heading from: the candidates whose run reaches
 * `STRIDE_MIN_TILES`, or every candidate when none can (the boxed-in guard).
 */
function stridePool(room: PreviewRoom, walker: PreviewWalker): TestStep[] {
  const usable = candidatesOf(room, walker).filter(
    (candidate) => runOf(room, candidate, walker.previous) >= STRIDE_MIN_TILES,
  );
  return usable.length > 0 ? usable : candidatesOf(room, walker);
}

describe('the stride constants', () => {
  it('pins the tick, the stride band and the rest band', () => {
    expect(PREVIEW_TICK_MS).toBe(600);
    expect(STRIDE_MIN_TILES).toBe(2);
    expect(STRIDE_MAX_TILES).toBe(4);
    expect(STRIDE_REST_MIN_MS).toBe(900);
    expect(STRIDE_REST_MAX_MS).toBe(1600);
    expect(STRIDE_REST_MAX_MS - STRIDE_REST_MIN_MS).toBe(700);
  });
});

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

  it('starts every walker rested and on no stride', () => {
    for (const seed of ['seed-a', 'seed-b', 'pkm-198']) {
      const walkers = previewWalkers(previewRoute(seed, DESK));

      for (const walker of walkers) {
        expect(walker.path).toEqual([]);
        expect(walker.rest).toBe(0);
        expect(walker.previous).toBeUndefined();
        expect(walker.restMs).toBeUndefined();
      }
    }
  });
});

describe('stepPreviewWalkers', () => {
  it('keeps every walker, in order, on a walkable tile of the room', () => {
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

    expect(foldWalk(room, previewWalkers(room), 6).map(describeFrame)).toEqual([
      'buneary@4,8:N::0 | barraskewda@17,7:W::0',
      'buneary@0,8:W:3,8>2,8>1,8>0,8:3 | barraskewda@14,7:W:16,7>15,7>14,7:2',
      'buneary@0,8:W::2 | barraskewda@14,7:W::1',
      'buneary@0,8:W::1 | barraskewda@14,7:W::0',
      'buneary@0,8:W::0 | barraskewda@10,7:W:13,7>12,7>11,7>10,7:2',
      'buneary@0,6:N:0,7>0,6:3 | barraskewda@10,7:W::1',
      'buneary@0,6:N::2 | barraskewda@10,7:W::0',
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

/** The seeds a stride is measured on: the twelve fixed ones the plan names. */
const STRIDE_SEEDS = WALK_SEEDS.slice(0, 12);
const STRIDE_TICKS = 40;

describe('the stride', () => {
  it('books straight, walkable tiles that never double back, over 12 seeds × 8 strides', () => {
    let measured = 0;
    let boxedIn = 0;
    for (const seed of STRIDE_SEEDS) {
      const room = previewRoute(seed, PHONE);
      const strides = stridesOf(room, previewWalkers(room), STRIDE_TICKS);
      expect(strides.length, seed).toBeGreaterThanOrEqual(8);
      measured += strides.length;

      for (const { tick, before, after } of strides) {
        const where = `${seed} w${before.id} t${tick}`;
        const vector = FACING_VECTORS[after.facing];
        expect(after.path.length, where).toBeGreaterThanOrEqual(1);
        expect(after.path.length, where).toBeLessThanOrEqual(STRIDE_MAX_TILES);

        let last = before.tile;
        for (const tile of after.path) {
          expect(tile, where).toEqual({ x: last.x + vector.x, y: last.y + vector.y });
          expect(tile.x, where).toBeGreaterThanOrEqual(0);
          expect(tile.x, where).toBeLessThan(room.cols);
          expect(tile.y, where).toBeGreaterThanOrEqual(0);
          expect(tile.y, where).toBeLessThan(room.rows);
          expect(isWalkable(room.tiles, tile), where).toBe(true);
          last = tile;
        }

        expect(new Set(after.path.map(tileKey)).size, where).toBe(after.path.length);
        if (before.previous !== undefined) {
          expect(after.path.map(tileKey), where).not.toContain(tileKey(before.previous));
        }
        expect(after.tile, where).toEqual(after.path[after.path.length - 1]!);
        expect(after.previous, where).toEqual(before.tile);

        const pool = stridePool(room, before);
        expect(pool.length, where).toBeGreaterThan(0);
        expect(
          pool.map((candidate) => candidate.facing),
          where,
        ).toContain(after.facing);
        if (after.path.length < STRIDE_MIN_TILES) {
          boxedIn += 1;
          expect(
            pool.every((candidate) => runOf(room, candidate, before.previous) < STRIDE_MIN_TILES),
            `${where} short stride with a stridable heading in the pool`,
          ).toBe(true);
        }
      }
    }
    expect(measured).toBeGreaterThanOrEqual(STRIDE_SEEDS.length * 8);
    expect(boxedIn).toBeLessThanOrEqual(measured * 0.1);
  });

  it('prefers a heading that can stride', () => {
    // Standing one tile under a nook: N, S and W all run into a wall on their second
    // tile, so only E — whose run reaches two — may be drawn, and it books both tiles.
    const room = roomFromSketch(['######', '#...##', '#....#', '#....#', '######']);
    const walker = walkerAt({ x: 2, y: 2 });
    const candidates = candidatesOf(room, walker);

    expect(candidates.map((candidate) => candidate.facing)).toEqual(['N', 'E', 'S', 'W']);
    for (const facing of ['N', 'S', 'W'] as const) {
      const step = candidates.find((candidate) => candidate.facing === facing)!;
      expect(runOf(room, step, undefined), facing).toBe(1);
    }
    expect(stridePool(room, walker).map((candidate) => candidate.facing)).toEqual(['E']);

    const run = runOf(room, stridePool(room, walker)[0]!, undefined);
    expect(run).toBe(2);
    for (let tick = 0; tick < 4; tick++) {
      const [strode] = stepPreviewWalkers(room, [walker], tick);

      expect(strode!.facing).toBe('E');
      expect(strode!.path.length).toBe(Math.min(STRIDE_MAX_TILES, run));
      expect(strode!.path.length).toBeGreaterThanOrEqual(Math.min(STRIDE_MIN_TILES, run));
      expect(strode!.path).toEqual([
        { x: 3, y: 2 },
        { x: 4, y: 2 },
      ]);
    }
  });

  it('still answers a one-tile stride in a corridor that offers nothing longer', () => {
    const room = roomFromSketch(['####', '#..#', '####']);
    const walker = walkerAt({ x: 1, y: 1 });

    expect(
      stridePool(room, walker).every(
        (candidate) => runOf(room, candidate, undefined) < STRIDE_MIN_TILES,
      ),
    ).toBe(true);

    const [strode] = stepPreviewWalkers(room, [walker], 0);

    expect(strode!.facing).toBe('E');
    expect(strode!.path).toEqual([{ x: 2, y: 1 }]);
    expect(strode!.tile).toEqual({ x: 2, y: 1 });
  });

  it('ends a stride early only where the room refuses the next tile', () => {
    // The frozen walk stops at the first refusal, `previous` included, so a stride is
    // one tile wherever every heading runs into a wall, the room’s edge or the tile
    // the last stride started from: a two-row band answers a one-tile stride across
    // it. What may never happen is a short stride the room would have allowed.
    let unexplained = 0;
    for (const seed of STRIDE_SEEDS) {
      const room = previewRoute(seed, PHONE);
      for (const { before, after } of stridesOf(room, previewWalkers(room), STRIDE_TICKS)) {
        if (after.path.length >= STRIDE_MIN_TILES) continue;
        const last = after.path[after.path.length - 1]!;
        const vector = FACING_VECTORS[after.facing];
        const beyond = { x: last.x + vector.x, y: last.y + vector.y };
        const refused =
          beyond.x < 0 ||
          beyond.x >= room.cols ||
          beyond.y < 0 ||
          beyond.y >= room.rows ||
          !isWalkable(room.tiles, beyond) ||
          (before.previous !== undefined && tileKey(beyond) === tileKey(before.previous)) ||
          after.path.some((tile) => tileKey(tile) === tileKey(beyond));
        if (!refused) unexplained += 1;
      }
    }
    expect(unexplained).toBe(0);
  });

  it('draws the stride’s length from the 2–4 band when nothing refuses it', () => {
    const rows = Array.from({ length: 12 }, (_, y) =>
      y === 0 || y === 11 ? '############' : '#..........#',
    );
    const lengths = new Set<number>();

    for (let index = 0; index < 24; index++) {
      const room = roomFromSketch(rows, `band-${index}`);
      const [first] = stepPreviewWalkers(room, [walkerAt({ x: 5, y: 5 })], 0);

      expect(first!.path.length).toBeGreaterThanOrEqual(STRIDE_MIN_TILES);
      expect(first!.path.length).toBeLessThanOrEqual(STRIDE_MAX_TILES);
      lengths.add(first!.path.length);
    }
    expect([...lengths].sort()).toEqual([STRIDE_MIN_TILES, 3, STRIDE_MAX_TILES]);
  });

  it('books no move while it rests, and strides again when the beat ends', () => {
    const room = previewRoute('seed-a', PHONE);
    const start = previewWalkers(room);
    const first = stepPreviewWalkers(room, start, 0);

    first.forEach((walker, index) => {
      expect(walker.path.length).toBeGreaterThan(0);
      expect(walker.rest).toBeGreaterThan(0);
      let current = walker;
      for (let tick = 1; tick <= walker.rest; tick++) {
        const next = stepPreviewWalkers(room, [current], tick)[0]!;
        expect(next.path, `t${tick}`).toEqual([]);
        expect(next.tile, `t${tick}`).toEqual(current.tile);
        expect(next.rest, `t${tick}`).toBe(current.rest - 1);
        expect(next.facing, `t${tick}`).toBe(walker.facing);
        expect(next.previous, `t${tick}`).toEqual(walker.previous);
        expect(next.restMs, `t${tick}`).toBe(walker.restMs);
        current = next;
      }
      expect(current.rest).toBe(0);
      const nextStride = stepPreviewWalkers(room, [current], walker.rest + 1)[0]!;
      expect(nextStride.path.length).toBeGreaterThanOrEqual(1);
      expect(nextStride.tile).not.toEqual(current.tile);
      expect(start[index]!.id).toBe(walker.id);
    });
  });

  it('draws the rest in the 900–1600 ms band as two or three ticks', () => {
    const drawn = new Set<number>();
    for (const seed of STRIDE_SEEDS) {
      const room = previewRoute(seed, PHONE);
      for (const { after } of stridesOf(room, previewWalkers(room), STRIDE_TICKS)) {
        const restMs = after.restMs!;
        expect(restMs % 100).toBe(0);
        expect(restMs).toBeGreaterThanOrEqual(STRIDE_REST_MIN_MS);
        expect(restMs).toBeLessThanOrEqual(STRIDE_REST_MAX_MS);
        expect(after.rest).toBe(Math.max(1, Math.round(restMs / PREVIEW_TICK_MS)));
        expect([2, 3]).toContain(after.rest);
        drawn.add(restMs);
      }
    }
    expect(drawn.size).toBeGreaterThan(1);
  });

  it('gives two seeds different stride lengths', () => {
    const lengths = (seed: string): number[] => {
      const room = previewRoute(seed, DESK);
      return stridesOf(room, previewWalkers(room), STRIDE_TICKS)
        .filter(({ before }) => before.id === 0)
        .slice(0, 6)
        .map(({ after }) => after.path.length);
    };

    expect(lengths('pkm-232-a')).toEqual([4, 3, 2, 2, 4, 2]);
    expect(lengths('pkm-232-b')).toEqual([3, 3, 2, 2, 4, 2]);
    expect(lengths('pkm-232-a')).not.toEqual(lengths('pkm-232-b'));
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

  it('never books a tile back onto the one it came from, over 20 seeds × 14 ticks', () => {
    for (const seed of WALK_SEEDS) {
      const room = previewRoute(seed, PHONE);
      const strides = stridesOf(room, previewWalkers(room), WALK_TICKS);

      for (const { tick, before, after } of strides) {
        const where = `${seed} w${before.id} t${tick}`;
        expect(isWalkable(room.tiles, after.tile), where).toBe(true);
        expect(new Set(room.walkable.map(tileKey)).has(tileKey(after.tile)), where).toBe(true);
        expect(tileKey(after.tile), `${where} u-turn`).not.toBe(tileKey(before.tile));
        if (before.previous !== undefined) {
          expect(after.path.map(tileKey), `${where} re-walk`).not.toContain(tileKey(before.previous));
        }
      }
      expect(stridesOf(room, previewWalkers(room), WALK_TICKS), seed).toEqual(strides);
    }
  });

  it('turns away from its own previous tile in an open room, for 20 ticks', () => {
    const room = roomFromSketch(['#####', '#...#', '#...#', '#...#', '#####']);
    const strides = stridesOf(room, [walkerAt({ x: 2, y: 2 }, { x: 2, y: 1 })], 20);

    expect(strides.length).toBeGreaterThan(4);
    for (const { tick, before, after } of strides) {
      expect(walkableDegree(room, after.tile), `t${tick}`).toBeGreaterThan(1);
      expect(tileKey(after.tile), `u-turn at t${tick}`).not.toBe(tileKey(before.tile));
      expect(after.previous, `t${tick}`).toEqual(before.tile);
      if (before.previous !== undefined) {
        expect(after.path.map(tileKey), `re-walk at t${tick}`).not.toContain(tileKey(before.previous));
      }
    }
  });

  it('may still reverse in a corridor that offers nothing else', () => {
    const room = roomFromSketch(['####', '#..#', '####']);
    const walkers = [walkerAt({ x: 1, y: 1 }, { x: 2, y: 1 })];

    const next = stepPreviewWalkers(room, walkers, 0);

    expect(next[0]!.tile).toEqual({ x: 2, y: 1 });
    expect(next[0]!.path).toEqual([{ x: 2, y: 1 }]);
    expect(next[0]!.facing).toBe('E');
    expect(next[0]!.previous).toEqual({ x: 1, y: 1 });
  });

  it('stays put on a room with nowhere to go', () => {
    const room = roomFromSketch(['###', '#.#', '###']);
    const walkers = [walkerAt({ x: 1, y: 1 })];

    const next = stepPreviewWalkers(room, walkers, 3);

    expect(next[0]!.tile).toEqual({ x: 1, y: 1 });
    expect(next[0]!.previous).toEqual({ x: 1, y: 1 });
    expect(next[0]!.path).toEqual([]);
    expect(next[0]!.rest).toBe(0);
  });
});
