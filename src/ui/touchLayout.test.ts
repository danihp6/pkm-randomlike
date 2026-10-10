import { describe, expect, it } from 'vitest';
import { padDirection, touchControlsLayout } from './touchLayout';

describe('touchControlsLayout', () => {
  it('keeps the pad and buttons on screen', () => {
    for (const [width, height] of [
      [390, 844],
      [1280, 800],
      [800, 1280],
    ]) {
      const layout = touchControlsLayout(width, height);
      expect(layout.pad.size).toBeGreaterThanOrEqual(120);
      expect(layout.pad.size).toBeLessThanOrEqual(220);
      for (const point of [layout.pad, layout.a, layout.b]) {
        const radius = 'radius' in point ? point.radius : point.size / 2;
        expect(point.x - radius).toBeGreaterThanOrEqual(0);
        expect(point.x + radius).toBeLessThanOrEqual(width);
        expect(point.y + radius).toBeLessThanOrEqual(height);
      }
    }
  });

  it('scales the pad with the smaller screen edge', () => {
    const phone = touchControlsLayout(390, 844);
    const desktop = touchControlsLayout(1600, 900);
    expect(phone.pad.size).toBeLessThan(desktop.pad.size);
  });

  it('sits the pad bottom-left and the A / B buttons bottom-right', () => {
    const layout = touchControlsLayout(390, 844);
    expect(layout.pad.x).toBeLessThan(390 / 2);
    expect(layout.pad.y).toBeGreaterThan(844 / 2);
    expect(layout.a.x).toBeGreaterThan(390 / 2);
    expect(layout.b.x).toBeLessThan(layout.a.x);
  });
});

describe('padDirection', () => {
  const layout = touchControlsLayout(390, 844);
  const { x, y, size } = layout.pad;
  const reach = size * 0.4;

  it('maps each side of the pad to its direction', () => {
    expect(padDirection(x, y - reach, layout)).toBe('up');
    expect(padDirection(x, y + reach, layout)).toBe('down');
    expect(padDirection(x - reach, y, layout)).toBe('left');
    expect(padDirection(x + reach, y, layout)).toBe('right');
  });

  it('reads the dominant axis at a diagonal press', () => {
    expect(padDirection(x + reach, y + reach * 0.2, layout)).toBe('right');
    expect(padDirection(x + reach * 0.2, y + reach, layout)).toBe('down');
  });

  it('treats the pad centre as no direction', () => {
    expect(padDirection(x, y, layout)).toBeNull();
    expect(padDirection(x + size * 0.05, y, layout)).toBeNull();
  });
});
