import { describe, expect, it } from 'vitest';
import { getBiome } from '../../data/biomes';
import { PUZZLES, puzzleRowsForMap } from '../../data/puzzles';
import { TILESETS } from '../../data/tilesets';
import type { Tile } from '../grid';
import { planMap, roomView } from '../maps';
import { FLOOR, isWalkable, mapFromSketch, type TileMap } from '../map';
import { createRun, createRunPokemon, markItemPicked } from '../run';
import { routeIndexForRoom } from '../run/floors';
import {
  puzzleId,
  puzzleIsSolved,
  puzzleLayout,
  puzzleMarked,
  puzzlePress,
  puzzleRewardId,
  type PuzzleLayout,
} from './puzzle';
import { sketchRoute, type RouteRequest } from './sketch';
import { reachableTiles } from './validate';

const SEED = 'pkm-102';

/** An open 11x11 room: plenty of tiles for any row's switches and its reward. */
const ROOM = mapFromSketch([
  '###########',
  '#.........#',
  '#.........#',
  '#.........#',
  '#.........#',
  '#.........#',
  '#.........#',
  '#.........#',
  '#.........#',
  '#.........#',
  '###########',
]);

/** The room's centre, so no switch may ever stand on the spawn. */
const ENTRY: Tile = { x: 5, y: 5 };

/** A one-tile-high corridor: exactly three tiles two or more steps off the entry. */
const CORRIDOR = mapFromSketch(['#######', '#.....#', '#######']);

function routeOf(tiles: TileMap, entry: Tile = ENTRY): Readonly<{ tiles: TileMap; entry: Tile }> {
  return { tiles, entry };
}

function layoutOf(
  mapIndex: number,
  roomId: number,
  route = routeOf(ROOM),
  seed = SEED,
): PuzzleLayout | null {
  return puzzleLayout(route, { seed, mapIndex, roomId });
}

const SEEDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel'];
const MAPS = [2, 3, 4, 5, 6, 7, 8];

/** The request `RouteScene.buildRoute` makes for a plan room (quiet: a leaf). */
function roomRequest(seed: string, mapIndex: number, roomId: number): RouteRequest {
  const plan = planMap(seed, mapIndex);
  const view = roomView(plan, roomId, false);
  const biome = getBiome(view.biomeId);
  const pattern = TILESETS[biome.tilesetId].config.wallPattern;
  const wall = pattern
    ? { cols: pattern.cols, minHeight: Math.max(2, pattern.rows.length - 2) }
    : undefined;
  return {
    seed,
    routeIndex: routeIndexForRoom(plan, view.roomId),
    biomeId: view.biomeId,
    layout: biome.layout,
    openings: view.openings,
    width: view.width,
    height: view.height,
    quiet: true,
    ...(wall ? { wall } : {}),
  };
}

describe('puzzleLayout', () => {
  it('is a pure function of the seed, the map and the room', () => {
    for (const mapIndex of MAPS) {
      for (const roomId of [1, 3, 5]) {
        expect(layoutOf(mapIndex, roomId), `${mapIndex}:${roomId}`).toEqual(layoutOf(mapIndex, roomId));
      }
    }
  });

  it('carries a row the floor may hold, and reads it off its own stream', () => {
    for (const mapIndex of MAPS) {
      const layout = layoutOf(mapIndex, 2);
      const row = PUZZLES.find((candidate) => candidate.id === layout?.rowId);
      expect(row, `map ${mapIndex}`).toBeDefined();
      expect(row!.fromMap).toBeLessThanOrEqual(mapIndex);
      expect(puzzleRowsForMap(mapIndex)).toContainEqual(row);
    }
    // Map 2 may only carry the on-ramp row, whatever the seed.
    for (const seed of SEEDS) {
      expect(layoutOf(2, 4, routeOf(ROOM), seed)?.rowId).toBe('three');
    }
  });

  it('changes the press order with the room id', () => {
    const orders = Array.from({ length: 8 }, (_, roomId) =>
      (layoutOf(3, roomId)?.order ?? []).join(','),
    );
    expect(new Set(orders).size).toBeGreaterThan(1);
  });

  it('holds the row’s switch count in slot order, and a permutation as its order', () => {
    for (const mapIndex of MAPS) {
      const layout = layoutOf(mapIndex, 6)!;
      const row = PUZZLES.find((candidate) => candidate.id === layout.rowId)!;
      expect(layout.switches).toHaveLength(row.switches);
      expect(row.switches).toBeGreaterThanOrEqual(2);
      expect(row.switches).toBeLessThanOrEqual(5);
      expect([...layout.order].sort((a, b) => a - b)).toEqual(
        Array.from({ length: row.switches }, (_, slot) => slot),
      );
      expect(new Set(layout.order).size).toBe(row.switches);
      expect(layout.wrongResets).toBe(row.wrongResets);
    }
  });

  it('stands every switch on reachable floor at least two steps off the entry', () => {
    const reached = reachableTiles(ROOM, ENTRY);
    for (const mapIndex of MAPS) {
      const layout = layoutOf(mapIndex, 7)!;
      for (const tile of layout.switches) {
        expect(isWalkable(ROOM, tile), `${mapIndex} ${tile.x},${tile.y}`).toBe(true);
        expect(reached.has(`${tile.x},${tile.y}`), `${mapIndex} ${tile.x},${tile.y}`).toBe(true);
        expect(
          Math.abs(tile.x - ENTRY.x) + Math.abs(tile.y - ENTRY.y),
          `${mapIndex} ${tile.x},${tile.y}`,
        ).toBeGreaterThanOrEqual(2);
        expect(tile).not.toEqual(ENTRY);
      }
    }
  });

  it('keeps the reward off every switch, and every tile its own', () => {
    for (const mapIndex of MAPS) {
      const layout = layoutOf(mapIndex, 8)!;
      const keys = layout.switches.map((tile) => `${tile.x},${tile.y}`);
      expect(new Set(keys).size).toBe(layout.switches.length);
      expect(keys).not.toContain(`${layout.reward.x},${layout.reward.y}`);
      expect(isWalkable(ROOM, layout.reward)).toBe(true);
    }
  });

  it('answers null when the room offers fewer than switches + 1 tiles', () => {
    expect(layoutOf(2, 3, routeOf(CORRIDOR, { x: 1, y: 1 }))).toBeNull();
    // A floor with no eligible row at all carries no puzzle.
    expect(layoutOf(1, 3)).toBeNull();
  });

  it('drops no switch onto a wall: every tile it takes is floor', () => {
    const layout = layoutOf(4, 9)!;
    for (const tile of [...layout.switches, layout.reward]) {
      expect(ROOM[tile.y][tile.x]).toBe(FLOOR);
    }
  });

  it('lays a shipped puzzle leaf’s room out inside its own route', () => {
    let checked = 0;
    for (const seed of SEEDS) {
      for (const mapIndex of MAPS) {
        const plan = planMap(seed, mapIndex);
        for (const room of plan.rooms) {
          if (room.special !== 'puzzle') continue;
          const route = sketchRoute(roomRequest(seed, mapIndex, room.id));
          const layout = puzzleLayout(route, { seed, mapIndex, roomId: room.id });
          const where = `${seed} map ${mapIndex} room ${room.id}`;
          expect(layout, where).not.toBeNull();
          const reached = reachableTiles(route.tiles, route.entry);
          for (const tile of layout!.switches) {
            expect(reached.has(`${tile.x},${tile.y}`), where).toBe(true);
            expect(tile).not.toEqual(route.entry);
          }
          expect(layout!.switches).not.toContainEqual(layout!.reward);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  }, 60_000);
});

describe('puzzlePress', () => {
  it('advances one slot on a correct press', () => {
    const order = [2, 0, 1];
    expect(puzzlePress(0, order[0], order, true)).toBe(1);
    expect(puzzlePress(1, order[1], order, true)).toBe(2);
  });

  it('resets a broken sequence when the row says so, and keeps it otherwise', () => {
    const order = [2, 0, 1];
    expect(puzzlePress(2, order[0], order, true)).toBe(0);
    expect(puzzlePress(2, order[0], order, false)).toBe(2);
    expect(puzzlePress(1, order[2], order, true)).toBe(0);
  });

  it('never runs past the end of the order', () => {
    const order = [1, 2, 0];
    let progress = 0;
    for (const slot of order) {
      progress = puzzlePress(progress, slot, order, true);
      expect(progress).toBeLessThanOrEqual(order.length);
    }
    expect(progress).toBe(order.length);
    expect(puzzlePress(progress, order[0], order, true)).toBeLessThanOrEqual(order.length);
  });

  it('reads a sequence as solved only when every slot is in', () => {
    expect(puzzleIsSolved(3, [2, 0, 1])).toBe(true);
    expect(puzzleIsSolved(2, [2, 0, 1])).toBe(false);
    expect(puzzleIsSolved(0, [2, 0, 1])).toBe(false);
  });
});

describe('the puzzle ids', () => {
  it('names the floor mark and the reward, per map and room', () => {
    expect(puzzleId(3, 7)).toBe('puzzle-3-7');
    expect(puzzleRewardId(3, 7)).toBe('puzzle-loot-3-7');
    expect(puzzleId(11, 0)).toBe('puzzle-11-0');
    expect(puzzleRewardId(11, 0)).toBe('puzzle-loot-11-0');
  });

  it('reads the run’s own solve mark, and nothing else', () => {
    const starter = createRunPokemon({
      id: 'member-0',
      speciesId: 'caterpie',
      level: 5,
      moves: ['tackle'],
    });
    const run = createRun({ seed: SEED, starter });
    expect(puzzleMarked(run, 3, 7)).toBe(false);
    const solved = markItemPicked(run, puzzleId(3, 7));
    expect(puzzleMarked(solved, 3, 7)).toBe(true);
    expect(puzzleMarked(solved, 3, 8)).toBe(false);
    expect(puzzleMarked(solved, 4, 7)).toBe(false);
    // The reward's own id is not the solve mark: taking the loot is not a solve.
    expect(puzzleMarked(markItemPicked(run, puzzleRewardId(3, 7)), 3, 7)).toBe(false);
  });
});

describe('puzzleRowsForMap', () => {
  it('opens at map 2 and adds the deep row at map 5', () => {
    expect(puzzleRowsForMap(1)).toHaveLength(0);
    expect(puzzleRowsForMap(2).map((row) => row.id)).toEqual(['three']);
    expect(puzzleRowsForMap(4).map((row) => row.id)).toEqual(['three']);
    expect(puzzleRowsForMap(5).map((row) => row.id)).toEqual(['three', 'four']);
    expect(puzzleRowsForMap(8).map((row) => row.id)).toEqual(['three', 'four']);
  });
});
