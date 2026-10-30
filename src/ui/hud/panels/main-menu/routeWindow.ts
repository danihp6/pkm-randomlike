import { overworldCellHeight } from '../../../../data/overworldSize';
import type { PokemonOverworldSheet } from '../../../../data/pokemonOverworld';
import type { PreviewRect, PreviewRoom, PreviewWalker } from '../../../../engine/routes/preview';
import { PREVIEW_TICK_MS, PREVIEW_TILE, previewRoute } from '../../../../engine/routes/preview';
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

/** The window’s model tick: the engine’s own, so the two can never drift. */
export const ROUTE_PREVIEW_STEP_MS = PREVIEW_TICK_MS;

/** One tile’s move in the preview: the route scene’s own `WALK_STEP_MS`. */
export const WALK_STEP_MS = 200;
/** The walker’s frame clock: the route follower’s `FOLLOWER_FRAME_RATE`, as a period. */
export const WALK_FRAME_MS = 1000 / FOLLOWER_FRAME_RATE;
/** How long the tile a walker left keeps its half-alpha plate, in ms. */
export const TRAIL_MS = 400;

/** The walker’s own tile: the route’s ground lifted toward the accent. */
export const PLATE_COLOUR = 'rgba(125, 211, 252, 0.22)';
/** The same plate at half the alpha, for the tile it left. */
export const TRAIL_COLOUR = 'rgba(125, 211, 252, 0.11)';
/** No pair art: the board’s `menu tab` plate (its panel fill, `#10161f`) instead. */
export const PLATE_TAB_COLOUR = 'rgba(16, 22, 31, 0.72)';
export const TRAIL_TAB_COLOUR = 'rgba(16, 22, 31, 0.36)';

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

export type WalkerPlate = Readonly<{
  /** 24 × 24, the window’s own coordinates: `previewTileBox` of the tile. */
  box: PreviewRect;
  /** A complete CSS colour, alpha included, so a computed style and a fixture read the same string’s alpha. */
  colour: string;
}>;

export type WalkerPaintState = Readonly<{
  moving: boolean;
  /** True while the walker stands between a stride and the next (`walker.rest > 0`). */
  resting: boolean;
  frameStep: number;
  instant: boolean;
  /** ms since this walker’s last stride landed; `Number.POSITIVE_INFINITY` before the first. */
  sinceStrideMs: number;
}>;

export type WalkerPaint = Readonly<{
  box: Rect;
  backgroundImage: string;
  backgroundPosition: string;
  backgroundSize: string;
  transform: string;
  /** `path.length * WALK_STEP_MS` (0 on a first paint / room change). */
  transitionMs: number;
  frame: number | null;
  /** The tile the walker stands on, always present. */
  plate: WalkerPlate;
  /** The tile the last stride left, at half `plate`’s alpha; null once `TRAIL_MS` has passed. */
  trail: WalkerPlate | null;
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

/** The walking frame a state names: the strip's own step, its last frame while it rests. */
function walkingFrame(
  sheet: PokemonOverworldSheet,
  facing: FollowerFacing,
  state: WalkerPaintState,
): number | null {
  if (state.moving) return followerFrame(sheet, facing, 'walk', state.frameStep);
  if (state.resting) return followerFrame(sheet, facing, 'walk', sheet.anims.walk.count - 1);
  return followerFrame(sheet, facing, 'idle', 0);
}

/**
 * One walker's paint: the pair's own `walk` / `idle` strip, cut from its sheet and
 * drawn at the species' own cell inside the 24 px box, or — with no sheet, or one
 * whose image failed to load — the species' portrait crop, so a clone without the
 * pair art still draws a Pokémon. The box is always the model tile it is walking to:
 * the slide is the stylesheet's, over one `WALK_STEP_MS` per tile of the stride, and a
 * first paint or a room change asks for no slide at all. The tile it stands on carries
 * a plate, and the tile its last stride left keeps the same plate at half the alpha
 * until `TRAIL_MS` has passed; both are the paint's, so a fixture measures them.
 */
export function walkerPaint(
  window: PreviewRect,
  room: PreviewRoom,
  walker: PreviewWalker,
  state: WalkerPaintState,
  sheet: PokemonOverworldSheet | null,
): WalkerPaint {
  const box = previewWalkerBox(window, room, walker);
  const pose = FACING_POSE[walker.facing];
  const frame = sheet === null ? null : walkingFrame(sheet, pose.facing, state);
  const transitionMs = state.instant ? 0 : Math.max(1, walker.path.length) * WALK_STEP_MS;
  const transform = pose.flip ? 'scaleX(-1)' : NO_FLIP;
  const portrait = sheet === null || frame === null;
  const plate: WalkerPlate = {
    box: previewTileBox(window, room, walker.tile),
    colour: portrait ? PLATE_TAB_COLOUR : PLATE_COLOUR,
  };
  const trail: WalkerPlate | null =
    walker.previous === undefined || state.sinceStrideMs >= TRAIL_MS
      ? null
      : {
          box: previewTileBox(window, room, walker.previous),
          colour: portrait ? TRAIL_TAB_COLOUR : TRAIL_COLOUR,
        };
  if (sheet !== null && frame !== null) {
    const cell = overworldCellHeight(sheet.speciesId, PREVIEW_TILE);
    const col = frame % sheet.cols;
    const row = followerDirRow(sheet, pose.facing);
    const dx = Math.floor((PREVIEW_TILE - cell) / 2);
    const dy = PREVIEW_TILE - cell;
    return {
      box,
      backgroundImage: `url("${sheet.url}")`,
      backgroundPosition: `${-col * cell + dx}px ${-row * cell + dy}px`,
      backgroundSize: `${sheet.cols * cell}px ${sheet.rows * cell}px`,
      transform,
      transitionMs,
      frame,
      plate,
      trail,
    };
  }
  return {
    box,
    ...portraitPaint(walker.speciesId, box),
    transform,
    transitionMs,
    frame: null,
    plate,
    trail,
  };
}
