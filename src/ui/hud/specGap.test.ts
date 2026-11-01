import { describe, expect, it } from 'vitest';
import { GAP_TOLERANCE, gapFor, gapIsEmpty, specColours, type PanelView, type ScreenSpec } from './specGap';

const SPEC: ScreenSpec = {
  slug: '03k-panels-notice-item',
  boxes: [
    { name: 'notice strip', x: 280, y: 24, width: 720, height: 56 },
    { name: 'notice strip highlight', x: 292, y: 36, width: 696, height: 1 },
  ],
  text: [{ characters: 'Obtained Potion!' }],
  colours: ['#10161f@0.72', '#ffffff@0.16'],
};

const VIEW: PanelView = {
  boxes: [
    { name: 'notice strip', x: 280, y: 24, w: 720, h: 56 },
    { name: 'notice strip highlight', x: 292, y: 36, w: 696, h: 1 },
  ],
  strings: ['Obtained Potion!'],
  colours: ['#10161f', '#ffffff'],
};

describe('gapFor', () => {
  it('reports nothing for a view that equals its spec', () => {
    expect(gapFor(VIEW, SPEC)).toStrictEqual({ missing: [], moved: [], strings: [], colours: [] });
    expect(gapIsEmpty(gapFor(VIEW, SPEC))).toBe(true);
  });

  it('tolerates one pixel and reports two', () => {
    const one: PanelView = { ...VIEW, boxes: [{ ...VIEW.boxes[0]!, x: 281 }] };
    const two: PanelView = { ...VIEW, boxes: [{ ...VIEW.boxes[0]!, x: 282 }] };
    expect(gapFor(one, SPEC).moved).toStrictEqual([]);
    expect(gapFor(two, SPEC).moved).toStrictEqual([
      { name: 'notice strip', dx: 2, dy: 0, dw: 0, dh: 0 },
    ]);
    expect(GAP_TOLERANCE).toBe(1);
  });

  it('reports a resized box as moved, with the size delta', () => {
    const view: PanelView = { ...VIEW, boxes: [{ ...VIEW.boxes[0]!, w: 700, h: 60 }] };
    expect(gapFor(view, SPEC).moved).toStrictEqual([
      { name: 'notice strip', dx: 0, dy: 0, dw: -20, dh: 4 },
    ]);
  });

  it('names a box the spec never draws, and never throws on one', () => {
    const view: PanelView = {
      ...VIEW,
      boxes: [...VIEW.boxes, { name: 'ghost card', x: 0, y: 0, w: 10, h: 10 }],
    };
    expect(gapFor(view, SPEC).missing).toStrictEqual(['ghost card']);
  });

  it('names a string the board does not carry, ignoring the empty one', () => {
    const view: PanelView = { ...VIEW, strings: ['Obtained Potion!', 'Level up!', ''] };
    expect(gapFor(view, SPEC).strings).toStrictEqual(['Level up!']);
  });

  it('names a colour outside the spec palette and folds the alpha suffix away', () => {
    expect(specColours(SPEC)).toStrictEqual(['#10161f', '#ffffff']);
    const view: PanelView = { ...VIEW, colours: ['#10161F', '#7dd3fc'] };
    expect(gapFor(view, SPEC).colours).toStrictEqual(['#7dd3fc']);
  });

  it('treats an empty view as no gap and a duplicated spec name as the first box', () => {
    expect(gapFor({ boxes: [], strings: [], colours: [] }, SPEC)).toStrictEqual({
      missing: [],
      moved: [],
      strings: [],
      colours: [],
    });
    const repeated: ScreenSpec = {
      ...SPEC,
      boxes: [...SPEC.boxes, { name: 'notice strip', x: 0, y: 0, width: 1, height: 1 }],
    };
    expect(gapIsEmpty(gapFor(VIEW, repeated))).toBe(true);
  });

  it('is pure and total: the same arguments twice deep-equal', () => {
    expect(gapFor(VIEW, SPEC)).toStrictEqual(gapFor(VIEW, SPEC));
  });
});
