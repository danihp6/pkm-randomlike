import { describe, expect, it } from 'vitest';
import { FLOATING_MARGIN, clampPanelOrigin } from './floatingPanel';

const VIEW = { w: 1280, h: 800 };
const W = 640;
const H = 540;

describe('clampPanelOrigin', () => {
  it('leaves an origin that already fits untouched', () => {
    expect(clampPanelOrigin(320, 130, W, H, VIEW)).toEqual({ x: 320, y: 130 });
  });

  it('pins each edge inside the margin', () => {
    expect(clampPanelOrigin(-40, 130, W, H, VIEW)).toEqual({ x: FLOATING_MARGIN, y: 130 });
    expect(clampPanelOrigin(320, -40, W, H, VIEW)).toEqual({ x: 320, y: FLOATING_MARGIN });
    const right = VIEW.w - W - FLOATING_MARGIN;
    const bottom = VIEW.h - H - FLOATING_MARGIN;
    expect(clampPanelOrigin(5000, 130, W, H, VIEW)).toEqual({ x: right, y: 130 });
    expect(clampPanelOrigin(320, 5000, W, H, VIEW)).toEqual({ x: 320, y: bottom });
  });

  it('takes a custom margin', () => {
    expect(clampPanelOrigin(-5, -5, W, H, VIEW, 20)).toEqual({ x: 20, y: 20 });
  });

  it('rests a viewport smaller than the panel at the margin, never past it', () => {
    expect(clampPanelOrigin(100, 100, W, H, { w: 400, h: 300 })).toEqual({
      x: FLOATING_MARGIN,
      y: FLOATING_MARGIN,
    });
  });
});
