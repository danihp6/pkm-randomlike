import type Phaser from 'phaser';
import { PUZZLES, type PuzzleRow } from '../../data/puzzles';
import { isItemPicked, markItemPicked } from '../../engine/run/state';
import {
  puzzleId,
  puzzleIsSolved,
  puzzleLayout,
  puzzleMarked,
  puzzlePress,
  puzzleRewardId,
  type PuzzleLayout,
} from '../../engine/routes';
import { TILE_SIZE } from '../../engine/tileset';
import { puzzleResetNotice, puzzleRoomNotice, puzzleSolvedNotice } from '../../ui/notice';
import type { RoomDescriptor, RoomHost } from './types';

/**
 * The **puzzle** room (`docs/maps-spec.md` §7, D47): a dead-end leaf whose floor
 * holds a row of switches the player presses with the interact key **in the row's
 * own rolled order**. A correct press advances the sequence, a wrong one resets it,
 * and the completed sequence writes `puzzle-<map>-<room>` to the run's
 * `pickedItems` and pays one ordinary ground item on the room's reward tile. The
 * solve rides `pickedItems`, so a revisit and a reload agree and no `RunState`
 * field moves; the progress inside one visit is module state on purpose (leaving
 * the room forgets it), and a `rebuildRoom()` mid-solve must not lose it.
 */

const SWITCH_RADIUS = TILE_SIZE * 0.22;
const FIXTURE_DEPTH = 5;

const PRESSED = 0xf2c94c;
const RESTING = 0x94a3b8;
const RING = 0x10161f;

const centerX = (tileX: number): number => tileX * TILE_SIZE + TILE_SIZE / 2;
const centerY = (tileY: number): number => tileY * TILE_SIZE + TILE_SIZE / 2;

/** One room's live switch disc(s) and how far its sequence has come. */
type RoomState = { progress: number; discs: Phaser.GameObjects.Arc[] };

const rooms = new Map<string, RoomState>();

function roomKey(host: RoomHost): string {
  return `${host.view.mapIndex}:${host.view.roomId}`;
}

/** The room's layout, off its own three minted streams and the route on screen. */
function layoutFor(host: RoomHost): PuzzleLayout | null {
  return puzzleLayout(host.route(), {
    seed: host.run.seed,
    mapIndex: host.view.mapIndex,
    roomId: host.view.roomId,
  });
}

/** The `PUZZLES` row a layout names; the layout carries only its id. */
function rowOf(layout: PuzzleLayout): PuzzleRow {
  const row = PUZZLES.find((candidate) => candidate.id === layout.rowId);
  if (!row) throw new Error(`the puzzle room carries an unknown row: ${layout.rowId}`);
  return row;
}

/** True when `slot` is among the first `progress` entries of the press order. */
function isPressed(slot: number, order: readonly number[], progress: number): boolean {
  return order.slice(0, progress).includes(slot);
}

function discColor(slot: number, order: readonly number[], progress: number): number {
  return isPressed(slot, order, progress) ? PRESSED : RESTING;
}

export const descriptor: RoomDescriptor = {
  kind: 'puzzle',
  marker: 'puzzle',
  fixture: (host) => {
    const layout = layoutFor(host);
    if (!layout) return null;
    const { mapIndex, roomId } = host.view;
    // Not solved yet: the room explains its rule, like the no-heal leaf's line.
    if (!puzzleMarked(host.run, mapIndex, roomId)) return { notice: puzzleRoomNotice() };
    const id = puzzleRewardId(mapIndex, roomId);
    if (isItemPicked(host.run, id)) return {};
    return {
      items: [{ id, position: layout.reward, itemId: rowOf(layout).reward, hidden: false }],
    };
  },
  interact: (host, tile) => {
    const { mapIndex, roomId } = host.view;
    // A solved room is solved for the rest of the floor: the key falls through to
    // the ground item the fixture placed.
    if (puzzleMarked(host.run, mapIndex, roomId)) return false;
    const layout = layoutFor(host);
    if (!layout) return false;
    const slot = layout.switches.findIndex((entry) => entry.x === tile.x && entry.y === tile.y);
    if (slot < 0) return false;

    const key = roomKey(host);
    const progress = rooms.get(key)?.progress ?? 0;
    const next = puzzlePress(progress, slot, layout.order, layout.wrongResets);

    if (puzzleIsSolved(next, layout.order)) {
      // The solve is the only fact that survives the room, so the progress goes and
      // the run's mark decides what a revisit finds (`rebuildRoom` re-reads it).
      rooms.delete(key);
      host.commitRun(markItemPicked(host.run, puzzleId(mapIndex, roomId)));
      host.rebuildRoom();
      host.showNotice(puzzleSolvedNotice());
      return true;
    }

    // Repaint only the discs whose state changed, never the whole room.
    const state = rooms.get(key);
    state?.discs.forEach((disc, discSlot) => {
      if (isPressed(discSlot, layout.order, next) !== isPressed(discSlot, layout.order, progress)) {
        disc.setFillStyle(discColor(discSlot, layout.order, next), 1);
      }
    });
    rooms.set(key, { progress: next, discs: state?.discs ?? [] });
    if (next === 0 && progress !== 0) host.showNotice(puzzleResetNotice());
    return true;
  },
  drawFixture: (host) => {
    if (host.generatorStepActive()) return;
    const layout = layoutFor(host);
    if (!layout) return;
    if (puzzleMarked(host.run, host.view.mapIndex, host.view.roomId)) return;
    const key = roomKey(host);
    const progress = rooms.get(key)?.progress ?? 0;
    const discs = layout.switches.map((tile, slot) =>
      host.scene.add
        .circle(centerX(tile.x), centerY(tile.y), SWITCH_RADIUS, discColor(slot, layout.order, progress))
        .setDepth(FIXTURE_DEPTH)
        .setStrokeStyle(2, RING),
    );
    rooms.set(key, { progress, discs });
  },
  drawMarker: (graphics, cx, cy, radius) => {
    graphics.fillStyle(0x38bdf8, 1);
    graphics.fillCircle(cx, cy, radius * 0.8);
    graphics.fillStyle(0x10161f, 1);
    graphics.fillRect(cx - radius * 0.55, cy - radius * 0.45, radius * 1.1, radius * 0.22);
    graphics.fillRect(cx - radius * 0.55, cy - radius * 0.11, radius * 1.1, radius * 0.22);
    graphics.fillRect(cx - radius * 0.55, cy + radius * 0.23, radius * 1.1, radius * 0.22);
  },
};
