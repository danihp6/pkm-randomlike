import type { PokemonOverworldSheet } from '../../../../data/pokemonOverworld';
import type { PreviewRect, PreviewRoom, PreviewWalker } from '../../../../engine/routes/preview';
import { PREVIEW_TILE, previewRoute } from '../../../../engine/routes/preview';
import type { Facing } from '../../../../engine/routes/routeMap';
import { resolveGroundFrame, resolveTileFrame } from '../../../../engine/tileFrames';
import type { TileFrame } from '../../../../engine/tileFrames';
import type { TilesetConfig } from '../../../../engine/tileset';
import {
  FOLLOWER_FRAME_RATE,
  followerDirRow,
  followerFrame,
  type FollowerFacing,
} from '../../../../render/pokemonFollower';
import { portraitBackground, portraitCrop } from '../../portrait';
import type { Rect } from './view';

/** One timer step of the walkers, in ms. */
export const ROUTE_PREVIEW_STEP_MS = 600;

/** One tile’s move in the preview: the route scene’s own `WALK_STEP_MS`. */
export const WALK_STEP_MS = 200;
/** The walker’s frame clock: the route follower’s `FOLLOWER_FRAME_RATE`, as a period. */
export const WALK_FRAME_MS = 1000 / FOLLOWER_FRAME_RATE;

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

export type WalkerPaint = Readonly<{
  /** The 24 px box, already at the model tile it is walking to. */
  box: Rect;
  /** Inline style pieces: the pair's background (image, position, size) or the portrait's. */
  backgroundImage: string;
  backgroundPosition: string;
  backgroundSize: string;
  /** `scaleX(-1)` for `W`, otherwise none — the side row is one drawing. */
  transform: string;
  /** `WALK_STEP_MS` while the walker is in flight, `0` on a first paint / room change. */
  transitionMs: number;
  /** The frame the paint names, for the test and the live probe. */
  frame: number | null;
}>;

/** The pair's three drawn facings, one per route facing: the side row carries E and W. */
const FACING_POSE: Readonly<Record<Facing, Readonly<{ facing: FollowerFacing; flip: boolean }>>> = {
  N: { facing: 'up', flip: false },
  E: { facing: 'side', flip: false },
  S: { facing: 'down', flip: false },
  W: { facing: 'side', flip: true },
};

/** No flip: the paint hands the stylesheet a plain box, not a transform chain. */
const NO_FLIP = 'none';

/** The pair's sheet drawn at the route's own `24 / size` scale, so one cell is `PREVIEW_TILE`. */
function pairCellScale(sheet: PokemonOverworldSheet): number {
  return PREVIEW_TILE / sheet.size;
}

/** The inline background pieces either paint shares. */
type BackgroundPaint = Readonly<{
  backgroundImage: string;
  backgroundPosition: string;
  backgroundSize: string;
}>;

/** The portrait cell's inline background, or none for a species the atlas does not name. */
function portraitPaint(speciesId: string, box: Rect): BackgroundPaint {
  const crop = portraitCrop(speciesId);
  if (crop === null) return { backgroundImage: '', backgroundPosition: '', backgroundSize: '' };
  const background = portraitBackground(crop, box.w);
  return {
    backgroundImage: background.backgroundImage,
    backgroundPosition: background.backgroundPosition,
    backgroundSize: background.backgroundSize,
  };
}

/**
 * One walker's paint: the pair's own `walk` / `idle` strip, cut from its sheet and
 * scaled to the 24 px box, or — with no sheet, or one whose image failed to load —
 * the species' portrait crop, so a clone without the pair art still draws a Pokémon.
 * The box is always the model tile it is walking to: the slide is the stylesheet's,
 * over `WALK_STEP_MS`, and a first paint or a room change asks for no slide at all.
 */
export function walkerPaint(
  window: PreviewRect,
  room: PreviewRoom,
  walker: PreviewWalker,
  state: Readonly<{ moving: boolean; frameStep: number; instant: boolean }>,
  sheet: PokemonOverworldSheet | null,
): WalkerPaint {
  const box = previewWalkerBox(window, room, walker);
  const pose = FACING_POSE[walker.facing];
  const frame =
    sheet === null
      ? null
      : followerFrame(
          sheet,
          pose.facing,
          state.moving ? 'walk' : 'idle',
          state.moving ? state.frameStep : 0,
        );
  const transitionMs = state.instant ? 0 : WALK_STEP_MS;
  const transform = pose.flip ? 'scaleX(-1)' : NO_FLIP;
  if (sheet !== null && frame !== null) {
    const scale = pairCellScale(sheet);
    const col = frame % sheet.cols;
    const row = followerDirRow(sheet, pose.facing);
    return {
      box,
      backgroundImage: `url("${sheet.url}")`,
      backgroundPosition: `${-col * PREVIEW_TILE}px ${-row * PREVIEW_TILE}px`,
      backgroundSize: `${sheet.cols * sheet.size * scale}px ${sheet.rows * sheet.size * scale}px`,
      transform,
      transitionMs,
      frame,
    };
  }
  return { box, ...portraitPaint(walker.speciesId, box), transform, transitionMs, frame: null };
}
