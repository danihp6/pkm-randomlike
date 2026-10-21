import { describe, expect, it } from 'vitest';
import { FRLG_WINDOW_PADDING } from './frlg';
import { FRLG_FONT_SIZE, frlgFontData } from './frlgFont';
import { fitPartyLabel, partyGridFieldRows, partyGridLayout, type PartyGridRect } from './partyGrid';

const FONT = frlgFontData();

function measure(text: string, size: number): number {
  const scale = size / FRLG_FONT_SIZE;
  let width = 0;
  for (const char of text) {
    const glyph = FONT.chars[char.codePointAt(0) ?? 0];
    if (glyph) width += glyph.xAdvance * scale;
  }
  return width;
}

const DESKTOP: PartyGridRect = { x: 36, y: 582, w: 728, h: 192 };
const COMPACT: PartyGridRect = { x: 16, y: 548, w: 608, h: 236 };
const ROW_GAP = 8;

function layout(menu: PartyGridRect) {
  return partyGridLayout(menu, { padding: FRLG_WINDOW_PADDING });
}

describe('partyGridFieldRows', () => {
  it('answers the single active alone when there is no second slot', () => {
    expect(partyGridFieldRows(0, -1)).toEqual([0]);
    expect(partyGridFieldRows(3, -1)).toEqual([3]);
  });

  it('answers both slots in slot order', () => {
    expect(partyGridFieldRows(2, 4)).toEqual([2, 4]);
    expect(partyGridFieldRows(5, 1)).toEqual([5, 1]);
  });

  it('answers nothing for an empty side', () => {
    expect(partyGridFieldRows(-1, -1)).toEqual([]);
  });

  it('lists a repeated index once', () => {
    expect(partyGridFieldRows(1, 1)).toEqual([1]);
  });
});

describe('partyGridLayout', () => {
  it('lays out one fixed-size row per party slot, top to bottom', () => {
    const metrics = layout(DESKTOP);
    expect(metrics.rects).toHaveLength(6);
    for (const rect of metrics.rects) {
      expect(rect.w).toBe(metrics.rowW);
      expect(rect.h).toBe(metrics.rowH);
    }
    for (let i = 1; i < metrics.rects.length; i++) {
      expect(metrics.rects[i].y - metrics.rects[i - 1].y).toBeCloseTo(metrics.rowH + ROW_GAP, 6);
    }
  });

  it('is the same six rows whatever the party holds', () => {
    // The function takes no member count: only the window rect and its options.
    expect(partyGridLayout.length).toBe(2);
    expect(layout(DESKTOP).rects).toHaveLength(6);
    expect(layout(DESKTOP).rowH).toBeCloseTo(18.67, 2);
    expect(layout(DESKTOP).rowW).toBe(616);
    expect(layout(COMPACT).rowH).toBeCloseTo(26, 2);
    expect(layout(COMPACT).rowW).toBe(496);
  });

  it('fills the content box: the last row ends on the content bottom', () => {
    const metrics = layout(DESKTOP);
    const last = metrics.rects[5];
    const contentBottom = DESKTOP.y + DESKTOP.h - FRLG_WINDOW_PADDING.bottom - 8;
    expect(last.y + last.h).toBeCloseTo(contentBottom, 6);
  });

  it('scales the row contents down with the row and caps them', () => {
    const tall = layout({ x: 0, y: 0, w: 400, h: 600 });
    const short = layout({ x: 0, y: 0, w: 400, h: 200 });
    const tiny = layout({ x: 0, y: 0, w: 400, h: 120 });
    expect(tall.avatarScale).toBe(0.9);
    expect(short.avatarScale).toBeLessThan(tall.avatarScale);
    expect(tall.hpBarScale).toBe(0.4);
    expect(tiny.hpBarScale).toBeLessThan(short.hpBarScale);
    expect(short.hpBarScale).toBe(0.4);
  });

  it('clamps the scales to zero and the label to its floor on a squeezed row', () => {
    const none = layout({ x: 0, y: 0, w: 120, h: 60 });
    expect(none.avatarScale).toBe(0);
    expect(none.hpBarScale).toBe(0);
    expect(none.labelMaxWidth).toBe(24);
  });
});

describe('fitPartyLabel', () => {
  it('leaves a short name untouched', () => {
    expect(fitPartyLabel('Pika', 200, 16)).toBe('Pika');
  });

  it('cuts a long name to one line with a trailing ellipsis', () => {
    const name = 'Voltorb  Lv14  PAR';
    const fitted = fitPartyLabel(name, 60, 16);
    expect(fitted).not.toBe(name);
    expect(fitted.endsWith('...')).toBe(true);
    expect(fitted).not.toContain('\n');
    expect(measure(fitted, 16)).toBeLessThanOrEqual(60);
  });

  it('never returns a name wider than maxWidth and only cuts when it must', () => {
    const name = 'Voltorb  Lv14  PAR';
    const ellipsisWidth = measure('...', 16);
    for (let maxWidth = 4; maxWidth <= 240; maxWidth += 4) {
      const fitted = fitPartyLabel(name, maxWidth, 16);
      expect(fitted).not.toContain('\n');
      if (fitted !== name) expect(fitted.endsWith('...')).toBe(true);
      if (ellipsisWidth <= maxWidth) {
        expect(measure(fitted, 16)).toBeLessThanOrEqual(maxWidth + 1e-9);
      }
    }
  });

  it('returns just the ellipsis when even that does not fit', () => {
    expect(fitPartyLabel('Voltorb', 1, 16)).toBe('...');
  });
});
