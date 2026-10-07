/**
 * How much of a battle sheet is actually drawn, and where its feet are.
 *
 * An Anil frame is padded to the animation's movement envelope, not the
 * creature, so the sheet's frame size says nothing about how big the mon looks
 * (a 96px Flabebe frame holds a 52px flower). `BattleScene` sizes a sprite from
 * the species' canonical height (`src/data/spriteSize.ts`) and uses the drawn
 * box measured here to convert that target into a zoom, and to anchor the sprite
 * by its feet so every size stands on the same platform.
 */
export type SpriteBounds = Readonly<{
  /** Widest drawn box of any frame, in pixels. */
  width: number;
  /** Tallest drawn box of any frame, in pixels. */
  height: number;
  /** Feet: content bottom-centre, in frame pixels, for the sprite origin. */
  anchorX: number;
  anchorY: number;
}>;

/** The drawn box of the frames in `rgba`: `frameCount` squares of `frameSize`. */
export function contentBounds(
  rgba: Uint8ClampedArray,
  stripWidth: number,
  frameSize: number,
  frameCount: number,
): SpriteBounds | null {
  return toBounds(scanFrames(rgba, stripWidth, frameSize, frameCount));
}

type Stats = Readonly<{
  bestWidth: number;
  bestHeight: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}>;

/** One pass over a batch of frames: the tallest/widest box and the union box. */
function scanFrames(
  rgba: Uint8ClampedArray,
  stripWidth: number,
  frameSize: number,
  frameCount: number,
): Stats {
  let bestWidth = 0;
  let bestHeight = 0;
  let minX = frameSize;
  let minY = frameSize;
  let maxX = -1;
  let maxY = -1;
  for (let frame = 0; frame < frameCount; frame++) {
    const x0 = frame * frameSize;
    let frameMinX = frameSize;
    let frameMinY = frameSize;
    let frameMaxX = -1;
    let frameMaxY = -1;
    for (let y = 0; y < frameSize; y++) {
      const rowBase = y * stripWidth;
      for (let x = 0; x < frameSize; x++) {
        if (rgba[(rowBase + x0 + x) * 4 + 3] === 0) continue;
        if (x < frameMinX) frameMinX = x;
        if (x > frameMaxX) frameMaxX = x;
        if (y < frameMinY) frameMinY = y;
        if (y > frameMaxY) frameMaxY = y;
      }
    }
    if (frameMaxX < 0) continue;
    if (frameMaxX - frameMinX + 1 > bestWidth) bestWidth = frameMaxX - frameMinX + 1;
    if (frameMaxY - frameMinY + 1 > bestHeight) bestHeight = frameMaxY - frameMinY + 1;
    if (frameMinX < minX) minX = frameMinX;
    if (frameMaxX > maxX) maxX = frameMaxX;
    if (frameMinY < minY) minY = frameMinY;
    if (frameMaxY > maxY) maxY = frameMaxY;
  }
  return { bestWidth, bestHeight, minX, minY, maxX, maxY };
}

function merge(into: Stats, from: Stats): Stats {
  return {
    bestWidth: Math.max(into.bestWidth, from.bestWidth),
    bestHeight: Math.max(into.bestHeight, from.bestHeight),
    minX: Math.min(into.minX, from.minX),
    minY: Math.min(into.minY, from.minY),
    maxX: Math.max(into.maxX, from.maxX),
    maxY: Math.max(into.maxY, from.maxY),
  };
}

function toBounds(stats: Stats): SpriteBounds | null {
  if (stats.bestWidth === 0) return null;
  return {
    width: stats.bestWidth,
    height: stats.bestHeight,
    anchorX: (stats.minX + stats.maxX + 1) / 2,
    anchorY: stats.maxY + 1,
  };
}

const EMPTY: Stats = { bestWidth: 0, bestHeight: 0, minX: Infinity, minY: Infinity, maxX: -1, maxY: -1 };

/** A strip wider than this is measured in batches, keeping the canvas small. */
const MAX_CANVAS_W = 2048;

const contentCache = new Map<string, SpriteBounds | null>();

/**
 * The drawn box of a loaded sheet, measured once per texture key. `null` when
 * the pixels cannot be read (a tainted canvas, no 2d context, a RenderTexture
 * source), so the caller can fall back to the sheet's frame size.
 */
export function spriteContentBounds(
  textureKey: string,
  source: CanvasImageSource,
  size: number,
  frames: number,
): SpriteBounds | null {
  const cached = contentCache.get(textureKey);
  if (cached !== undefined) return cached;
  let bounds: SpriteBounds | null = null;
  try {
    bounds = measure(source, size, frames);
  } catch {
    bounds = null;
  }
  contentCache.set(textureKey, bounds);
  return bounds;
}

function measure(source: CanvasImageSource, size: number, frames: number): SpriteBounds | null {
  if (size < 1 || frames < 1) return null;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  const perBatch = Math.max(1, Math.floor(MAX_CANVAS_W / size));
  let stats = EMPTY;
  for (let start = 0; start < frames; start += perBatch) {
    const count = Math.min(perBatch, frames - start);
    canvas.width = size * count;
    canvas.height = size;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, start * size, 0, size * count, size, 0, 0, size * count, size);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    stats = merge(stats, scanFrames(image.data, canvas.width, size, count));
  }
  return toBounds(stats);
}
