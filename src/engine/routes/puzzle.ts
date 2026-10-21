import { puzzleRowsForMap } from '../../data/puzzles';
import type { Tile } from '../grid';
import { isWalkable, type TileMap } from '../map';
import { hashSeed, Rng } from '../rng';
import { isItemPicked, type RunState } from '../run/state';
import { tileKey } from './routeMap';
import { reachableTiles } from './validate';

/**
 * The **puzzle** room's layout and rule (`docs/maps-spec.md` §7, D47): a dead-end
 * leaf whose floor holds a row of switches the player presses with the interact key
 * in a rolled order. This module is the room's whole geometry and rule — which
 * `PUZZLES` row the room carries, where its switches and its reward stand, the
 * order they must be pressed in and what a press does — and it is pure: no Phaser,
 * no DOM and no run mutation. Three minted streams, all keyed by the room and never
 * by the run's moving `routeIndex`, keep a fixed seed's room identical on every
 * visit and every reload (`D11`).
 */

export type PuzzleLayout = Readonly<{
  /** The `PUZZLES` row the room carries. */
  rowId: string;
  /** The switch tiles, in **slot order** (`switches[slot]`). */
  switches: readonly Tile[];
  /** The slot indices in **press order**: a permutation of `0..switches-1`. */
  order: readonly number[];
  /** The tile the reward item is placed on once the room is solved. */
  reward: Tile;
  /** Copied from the row, so the rule reads the data, never a constant. */
  wrongResets: boolean;
}>;

export type PuzzleOptions = Readonly<{ seed: string; mapIndex: number; roomId: number }>;

/** The tile's Manhattan distance from another; the site rule's own metric. */
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

function streamFor(options: PuzzleOptions, name: string): Rng {
  return new Rng(hashSeed(`${options.seed}:puzzle:${options.mapIndex}:${options.roomId}:${name}`));
}

/**
 * The room's whole puzzle: which row it carries, where its switches and its
 * reward stand, and the order they must be pressed in. Pure and deterministic:
 * three minted streams (see *Determinism*). Null when the floor carries no
 * eligible row or the room has too few free tiles — the caller then places
 * nothing and shows no notice.
 */
export function puzzleLayout(
  route: Readonly<{ tiles: TileMap; entry: Tile }>,
  options: PuzzleOptions,
): PuzzleLayout | null {
  const rows = puzzleRowsForMap(options.mapIndex);
  if (rows.length === 0) return null;
  const row = rows[streamFor(options, 'row').int(0, rows.length - 1)];

  // A switch stands on walkable floor the player can reach, never beside the spawn
  // (so the player never presses one by arriving on it).
  const reached = reachableTiles(route.tiles, route.entry);
  const sites: Tile[] = [];
  for (let y = 0; y < route.tiles.length; y++) {
    for (let x = 0; x < route.tiles[y].length; x++) {
      const tile = { x, y };
      if (!isWalkable(route.tiles, tile)) continue;
      if (!reached.has(tileKey(tile))) continue;
      if (manhattan(tile, route.entry) < 2) continue;
      sites.push(tile);
    }
  }
  if (sites.length < row.switches + 1) return null;
  shuffle(sites, streamFor(options, 'sites'));
  const switches = sites.slice(0, row.switches);
  const reward = sites[row.switches];

  const order = shuffle(
    Array.from({ length: row.switches }, (_, slot) => slot),
    streamFor(options, 'order'),
  );

  return { rowId: row.id, switches, order, reward, wrongResets: row.wrongResets };
}

/** The progress after pressing `slot`: `progress + 1` on a correct press, else
 * `wrongResets ? 0 : progress`. Never above `order.length`. */
export function puzzlePress(
  progress: number,
  slot: number,
  order: readonly number[],
  wrongResets: boolean,
): number {
  if (order[progress] === slot) return Math.min(progress + 1, order.length);
  return wrongResets ? 0 : progress;
}

/** True when every slot has been pressed in order. */
export function puzzleIsSolved(progress: number, order: readonly number[]): boolean {
  return progress >= order.length;
}

/** The solve's per-floor mark in `pickedItems`: `puzzle-<mapIndex>-<roomId>`. */
export function puzzleId(mapIndex: number, roomId: number): string {
  return `puzzle-${mapIndex}-${roomId}`;
}

/** The reward's ground-item id: `puzzle-loot-<mapIndex>-<roomId>`. */
export function puzzleRewardId(mapIndex: number, roomId: number): string {
  return `puzzle-loot-${mapIndex}-${roomId}`;
}

/** True when this floor's room already carries its solve mark (`puzzleId` is in
 * `pickedItems`). */
export function puzzleMarked(run: RunState, mapIndex: number, roomId: number): boolean {
  return isItemPicked(run, puzzleId(mapIndex, roomId));
}
