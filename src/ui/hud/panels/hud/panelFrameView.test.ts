import { describe, expect, it } from 'vitest';
import { DEFAULT_KEYBINDS } from '../../../../data/keybinds';
import { t } from '../../../../i18n';
import { clampPanelOffset, frameLabel } from './panelFrameView';
import type { Rect } from './view';

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

/** The party card's own 250 × 406 body, docked in the right-hand column. */
const CARD: Rect = { x: 200, y: 100, w: 344, h: 200 };

describe('clampPanelOffset', () => {
  it('keeps a drag that stays inside the window', () => {
    expect(clampPanelOffset({ dx: 120, dy: 80 }, CARD, DESKTOP)).toEqual({ dx: 120, dy: 80 });
  });

  it('pulls a drag on a narrow window back to the nearest edge it fits in', () => {
    const kept = clampPanelOffset({ dx: 120, dy: 80 }, CARD, PHONE);
    expect(CARD.x + kept.dx).toBeGreaterThanOrEqual(0);
    expect(CARD.x + kept.dx + CARD.w).toBeLessThanOrEqual(PHONE.width);
    expect(CARD.y + kept.dy).toBeGreaterThanOrEqual(0);
    expect(CARD.y + kept.dy + CARD.h).toBeLessThanOrEqual(PHONE.height);
    expect(kept.dx).toBe(46 - CARD.x);
    expect(kept.dy).toBe(80);
  });

  it('clamps a drag off the top-left edge too', () => {
    expect(clampPanelOffset({ dx: -500, dy: -500 }, CARD, DESKTOP)).toEqual({
      dx: -CARD.x,
      dy: -CARD.y,
    });
  });

  it('gives no offset on an axis the card cannot fit in', () => {
    const wide: Rect = { x: 8, y: 8, w: 500, h: 200 };
    expect(clampPanelOffset({ dx: 120, dy: 80 }, wide, PHONE).dx).toBe(0);

    const tall: Rect = { x: 8, y: 8, w: 200, h: 900 };
    expect(clampPanelOffset({ dx: 120, dy: 80 }, tall, PHONE).dy).toBe(0);
  });

  it('gives no offset at all for a card that exactly fills the window', () => {
    const full: Rect = { x: 0, y: 0, w: 390, h: 844 };
    expect(clampPanelOffset({ dx: 12, dy: 12 }, full, PHONE)).toEqual({ dx: 0, dy: 0 });
  });

  it('never returns a non-finite number', () => {
    const junk = [
      { dx: Number.NaN, dy: Number.POSITIVE_INFINITY },
      { dx: Number.NEGATIVE_INFINITY, dy: Number.NaN },
    ];
    for (const offset of junk) {
      const kept = clampPanelOffset(offset, CARD, DESKTOP);
      expect(Number.isFinite(kept.dx)).toBe(true);
      expect(Number.isFinite(kept.dy)).toBe(true);
    }
    const brokenBox: Rect = { x: Number.NaN, y: 0, w: 344, h: 200 };
    expect(clampPanelOffset({ dx: 10, dy: 10 }, brokenBox, DESKTOP)).toEqual({ dx: 0, dy: 10 });
  });

  it('is pure: the same input yields a deep-equal offset and nothing is mutated', () => {
    const offset = { dx: 120, dy: 80 };
    expect(clampPanelOffset(offset, CARD, DESKTOP)).toEqual(clampPanelOffset(offset, CARD, DESKTOP));
    expect(offset).toEqual({ dx: 120, dy: 80 });
  });
});

describe('frameLabel', () => {
  it('names the panel and its live quick key, exactly as the strip does', () => {
    expect(frameLabel('party', DEFAULT_KEYBINDS)).toBe(`${t('keybind.party')} (P)`);
    expect(frameLabel('bag', DEFAULT_KEYBINDS)).toBe(`${t('keybind.bag')} (I)`);
    expect(frameLabel('header', DEFAULT_KEYBINDS)).toBe(`${t('keybind.map')} (M)`);
    expect(frameLabel('box', DEFAULT_KEYBINDS)).toBe(`${t('keybind.box')} (O)`);
  });

  it('follows a rebind on the label, never on the id', () => {
    const rebound = { ...DEFAULT_KEYBINDS, party: 'K' };
    expect(frameLabel('party', rebound)).toBe(`${t('keybind.party')} (K)`);
  });

  it('gives the detail window no chip at all', () => {
    expect(frameLabel('detail', DEFAULT_KEYBINDS)).toBeNull();
  });
});
