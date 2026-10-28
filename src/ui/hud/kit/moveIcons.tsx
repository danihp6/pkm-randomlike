import type { CSSProperties, JSX } from 'preact';
import categoryManifest from '../../../data/frlg/move-categories.json';
import typeManifest from '../../../data/frlg/type-icons.json';
import {
  MOVE_CATEGORY_ATLAS_URL,
  MOVE_CATEGORY_ICON_H,
  MOVE_CATEGORY_ICON_W,
  categoryIconFrame,
} from '../../../data/moveCategoryIcons';
import { TYPE_ICON_ATLAS_URL, TYPE_ICON_H, TYPE_ICON_W, typeIconFrame } from '../../../data/typeIcons';
import { TypeBadge } from './typeBadge';

/** The px square a move icon is laid out in: the board's `move chip` / `move category` box. */
export const MOVE_ICON_BOX = 24;

/** One packed atlas frame, plus the grid it lives in. */
export type MoveIconSprite = Readonly<{
  /** The packed atlas URL (the placeholder on a tree without the rip). */
  url: string;
  /** The frame's index in the atlas, row-major. */
  frame: number;
  /** One frame's pixel size inside the atlas. */
  w: number;
  h: number;
  /** The atlas grid's column count, for the frame's offset. */
  cols: number;
  /** The atlas grid's row count: the whole grid is what the background scales. */
  rows: number;
}>;

const TYPE_COLS = typeManifest.cols;
const TYPE_ROWS = typeManifest.rows;
const CATEGORY_COLS = categoryManifest.frames.length;
const CATEGORY_ROWS = 1;

/** The type badge's sprite, or null when the atlas has no frame for `type`. */
export function moveTypeSprite(type: string): MoveIconSprite | null {
  const frame = typeIconFrame(type);
  if (frame === null) return null;
  return {
    url: TYPE_ICON_ATLAS_URL,
    frame,
    w: TYPE_ICON_W,
    h: TYPE_ICON_H,
    cols: TYPE_COLS,
    rows: TYPE_ROWS,
  };
}

/** The category glyph's sprite, or null for a category the atlas does not name. */
export function moveCategorySprite(category: string): MoveIconSprite | null {
  const frame = categoryIconFrame(category);
  if (frame === null) return null;
  return {
    url: MOVE_CATEGORY_ATLAS_URL,
    frame,
    w: MOVE_CATEGORY_ICON_W,
    h: MOVE_CATEGORY_ICON_H,
    cols: CATEGORY_COLS,
    rows: CATEGORY_ROWS,
  };
}

/**
 * The inline background that draws `sprite` inside a `box`-sided square: the frame
 * **contained** (FIT) and centred, one cell of the atlas, so 32×14 becomes 24×10.5 in a
 * 24 px box. Pure arithmetic; no DOM.
 */
export function spriteBox(
  sprite: MoveIconSprite,
  box: number = MOVE_ICON_BOX,
): Readonly<{
  backgroundImage: string;
  backgroundSize: string;
  backgroundPosition: string;
  backgroundRepeat: 'no-repeat';
  imageRendering: 'pixelated';
  clipPath: string;
}> {
  const scale = Math.min(box / sprite.w, box / sprite.h);
  const col = sprite.frame % sprite.cols;
  const row = Math.floor(sprite.frame / sprite.cols);
  const gap = (box - sprite.h * scale) / 2;
  return {
    backgroundImage: `url("${sprite.url}")`,
    backgroundSize: `${sprite.w * scale * sprite.cols}px ${sprite.h * scale * sprite.rows}px`,
    backgroundPosition: `${-col * sprite.w * scale}px ${gap - row * sprite.h * scale}px`,
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
    clipPath: `inset(${gap}px 0px)`,
  };
}

/** The drawn box of one icon: the sprite's background over the square it is laid out in. */
function iconStyle(sprite: MoveIconSprite): CSSProperties {
  return {
    ...spriteBox(sprite),
    width: `${MOVE_ICON_BOX}px`,
    height: `${MOVE_ICON_BOX}px`,
  };
}

export type MoveTypeBadgeProps = Readonly<{ type: string }>;
export type MoveCategoryIconProps = Readonly<{ category: string }>;

/** The canon type badge. Falls back to the `TypeBadge` word chip for a type with no frame. */
export function MoveTypeBadge(props: MoveTypeBadgeProps): JSX.Element {
  const sprite = moveTypeSprite(props.type);
  if (sprite === null) return TypeBadge({ type: props.type });
  return <span class="kit-move-type" role="img" aria-label={props.type} style={iconStyle(sprite)} />;
}

/** The official category glyph. Falls back to the raw category word for no frame. */
export function MoveCategoryIcon(props: MoveCategoryIconProps): JSX.Element {
  const sprite = moveCategorySprite(props.category);
  if (sprite === null) return <span class="kit-move-category-text">{props.category}</span>;
  return (
    <span class="kit-move-category" role="img" aria-label={props.category} style={iconStyle(sprite)} />
  );
}
