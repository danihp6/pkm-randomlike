import { describe, expect, it } from 'vitest';
import { contentBounds } from './spriteBounds';

/** A `frames`-wide strip of `size`x`size` frames, transparent unless painted. */
function strip(size: number, frames: number) {
  return new Uint8ClampedArray(size * frames * size * 4);
}

/** Fills a rectangle (in frame-local pixels) with an opaque pixel. */
function paint(
  rgba: Uint8ClampedArray,
  stripWidth: number,
  frame: number,
  size: number,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      rgba[(py * stripWidth + frame * size + px) * 4 + 3] = 255;
    }
  }
}

describe('contentBounds', () => {
  it('returns null for a fully transparent strip', () => {
    expect(contentBounds(strip(8, 3), 24, 8, 3)).toBeNull();
  });

  it('measures the box and the feet of a single frame', () => {
    const size = 8;
    const rgba = strip(size, 1);
    paint(rgba, size, 0, size, 2, 1, 4, 5);
    expect(contentBounds(rgba, size, size, 1)).toEqual({
      width: 4,
      height: 5,
      anchorX: 4,
      anchorY: 6,
    });
  });

  it('takes the largest box across frames, ignoring padding', () => {
    const size = 16;
    const rgba = strip(size, 3);
    paint(rgba, size * 3, 0, size, 4, 4, 6, 6);
    paint(rgba, size * 3, 1, size, 1, 2, 3, 9);
    paint(rgba, size * 3, 2, size, 5, 5, 10, 4);
    const bounds = contentBounds(rgba, size * 3, size, 3);
    expect(bounds).toMatchObject({ width: 10, height: 9 });
    // Feet sit at the union's lowest pixel; the anchor is the union's centre.
    expect(bounds?.anchorY).toBe(11);
    expect(bounds?.anchorX).toBe(8);
  });

  it('skips transparent frames when the strip is padded', () => {
    const size = 8;
    const rgba = strip(size, 4);
    paint(rgba, size * 4, 3, size, 1, 1, 2, 2);
    expect(contentBounds(rgba, size * 4, size, 4)).toMatchObject({ width: 2, height: 2 });
  });
});
