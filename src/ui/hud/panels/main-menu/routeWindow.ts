import type { PreviewRect, PreviewRoom, PreviewWalker } from '../../../../engine/routes/preview';
import { PREVIEW_TILE, previewRoute } from '../../../../engine/routes/preview';
import { resolveGroundFrame, resolveTileFrame } from '../../../../engine/tileFrames';
import type { TileFrame } from '../../../../engine/tileFrames';
import type { TilesetConfig } from '../../../../engine/tileset';

/** One timer step of the walkers, in ms. */
export const ROUTE_PREVIEW_STEP_MS = 600;

const ROOMS = new Map<string, PreviewRoom>();

function roomKey(seed: string, window: PreviewRect): string {
  return `${seed}|${window.x},${window.y},${window.w},${window.h}`;
}

/** The preview room for `(seed, window)`, built once and reused across repaints. */
export function previewRoomFor(seed: string, window: PreviewRect): PreviewRoom {
  const key = roomKey(seed, window);
  const found = ROOMS.get(key);
  if (found !== undefined) return found;
  const room = previewRoute(seed, window);
  ROOMS.set(key, room);
  return room;
}

/** The tile field’s centred origin inside the window, in the window’s own coordinates. */
export function previewOrigin(
  window: PreviewRect,
  room: PreviewRoom,
): Readonly<{ x: number; y: number }> {
  return {
    x: Math.floor((window.w - room.cols * PREVIEW_TILE) / 2),
    y: Math.floor((window.h - room.rows * PREVIEW_TILE) / 2),
  };
}

/** One tile’s box in the window’s own coordinates: 24 × 24. */
export function previewTileBox(
  window: PreviewRect,
  room: PreviewRoom,
  tile: Readonly<{ x: number; y: number }>,
): PreviewRect {
  const origin = previewOrigin(window, room);
  return {
    x: origin.x + tile.x * PREVIEW_TILE,
    y: origin.y + tile.y * PREVIEW_TILE,
    w: PREVIEW_TILE,
    h: PREVIEW_TILE,
  };
}

/** One walker’s box in the window’s own coordinates: 24 × 24. */
export function previewWalkerBox(
  window: PreviewRect,
  room: PreviewRoom,
  walker: PreviewWalker,
): PreviewRect {
  return previewTileBox(window, room, walker.tile);
}

export type PreviewTileset = Readonly<{
  config: TilesetConfig;
  atlasUrl: string;
  commonUrl: string;
}>;

export type TileBackground = Readonly<{
  /** Atlas URLs, object first (when it has a frame), ground last. */
  images: readonly string[];
  /** One `-<col × 24>px -<row × 24>px` per image. */
  positions: readonly string[];
  /** `"<cols × 24>px <rows × 24>px"`. */
  size: string;
}>;

function urlOf(frame: TileFrame, tileset: PreviewTileset): string {
  return frame.source === 'common' ? tileset.commonUrl : tileset.atlasUrl;
}

function cellPosition(frame: number, cols: number): string {
  return `${-(frame % cols) * PREVIEW_TILE}px ${-Math.floor(frame / cols) * PREVIEW_TILE}px`;
}

/** A tile’s two CSS backgrounds, read off `resolveTileFrame` / `resolveGroundFrame`. */
export function tileBackground(
  room: PreviewRoom,
  tile: Readonly<{ x: number; y: number }>,
  tileset: PreviewTileset,
): TileBackground {
  const cols = tileset.config.atlas.cols;
  const rows = tileset.config.atlas.rows;
  const object = resolveTileFrame(room.tiles, tile.x, tile.y, tileset.config);
  const ground = resolveGroundFrame(room.tiles, tile.x, tile.y, tileset.config);
  const images: string[] = [];
  const positions: string[] = [];
  if (object !== null) {
    images.push(urlOf(object, tileset));
    positions.push(cellPosition(object.frame, cols));
  }
  images.push(urlOf(ground, tileset));
  positions.push(cellPosition(ground.frame, cols));
  return {
    images,
    positions,
    size: `${cols * PREVIEW_TILE}px ${rows * PREVIEW_TILE}px`,
  };
}
