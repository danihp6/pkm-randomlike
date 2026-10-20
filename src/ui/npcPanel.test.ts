import { describe, expect, it } from 'vitest';
import {
  NPC_CHOICE_GAP,
  NPC_CHOICE_H,
  NPC_MAX_CHOICES,
  NPC_PANEL_H,
  NPC_PANEL_PAD,
  NPC_PANEL_W,
  npcPanelLayout,
  type NpcPanelLayout,
} from './npcPanel';
import type { PanelRect, PanelViewport } from './floatingPanel';

const DESKTOP: PanelViewport = { w: 1280, h: 800 };
const PHONE: PanelViewport = { w: 390, h: 844 };
const COUNTS = Array.from({ length: NPC_MAX_CHOICES + 1 }, (_, i) => i);

function overlaps(a: PanelRect, b: PanelRect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function rows(layout: NpcPanelLayout): readonly PanelRect[] {
  return [...layout.choices, layout.leave];
}

function inside(inner: PanelRect, outer: PanelRect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

describe('npcPanelLayout', () => {
  it('keeps the card inside a desktop viewport', () => {
    for (const count of COUNTS) {
      const layout = npcPanelLayout(DESKTOP, count);
      expect(layout.w, `count ${count}`).toBe(NPC_PANEL_W);
      expect(layout.h, `count ${count}`).toBeGreaterThanOrEqual(NPC_PANEL_H);
      expect(layout.x).toBeGreaterThanOrEqual(0);
      expect(layout.y).toBeGreaterThanOrEqual(0);
      expect(layout.x + layout.w).toBeLessThanOrEqual(DESKTOP.w);
      expect(layout.y + layout.h).toBeLessThanOrEqual(DESKTOP.h);
    }
  });

  it('keeps the card inside a phone viewport, narrowing it to the screen', () => {
    for (const count of COUNTS) {
      const layout = npcPanelLayout(PHONE, count);
      expect(layout.w, `count ${count}`).toBeLessThanOrEqual(PHONE.w);
      expect(layout.h, `count ${count}`).toBeLessThanOrEqual(PHONE.h);
      expect(layout.x).toBeGreaterThanOrEqual(0);
      expect(layout.y).toBeGreaterThanOrEqual(0);
      expect(layout.x + layout.w).toBeLessThanOrEqual(PHONE.w);
      expect(layout.y + layout.h).toBeLessThanOrEqual(PHONE.h);
    }
  });

  it('centres the card in the viewport', () => {
    const layout = npcPanelLayout(DESKTOP, 2);
    expect(layout.x).toBe((DESKTOP.w - layout.w) / 2);
    expect(layout.y).toBe((DESKTOP.h - layout.h) / 2);
  });

  it('lays one row per choice above the free LEAVE row', () => {
    for (const count of COUNTS) {
      const layout = npcPanelLayout(DESKTOP, count);
      expect(layout.choices, `count ${count}`).toHaveLength(count);
      expect(layout.choices.length + 1).toBe(rows(layout).length);
    }
  });

  it('clamps the column at six choices and never drops the LEAVE row', () => {
    for (const count of [NPC_MAX_CHOICES, NPC_MAX_CHOICES + 1, 20]) {
      expect(npcPanelLayout(DESKTOP, count).choices).toHaveLength(NPC_MAX_CHOICES);
    }
    expect(npcPanelLayout(DESKTOP, 0).leave).toBeDefined();
  });

  it('reads a negative, fractional or non-finite count as the nearest row count', () => {
    expect(npcPanelLayout(DESKTOP, -3).choices).toHaveLength(0);
    expect(npcPanelLayout(DESKTOP, 2.7).choices).toHaveLength(2);
    expect(npcPanelLayout(DESKTOP, Number.NaN).choices).toHaveLength(0);
  });

  it('puts LEAVE last and never overlaps it with a choice', () => {
    for (const count of COUNTS) {
      const layout = npcPanelLayout(DESKTOP, count);
      for (const choice of layout.choices) {
        expect(overlaps(choice, layout.leave), `count ${count}`).toBe(false);
        expect(choice.y, `count ${count} order`).toBeLessThan(layout.leave.y);
      }
    }
  });

  it('lays the rows without overlapping each other, in reading order', () => {
    for (const count of COUNTS) {
      const layout = npcPanelLayout(DESKTOP, count);
      const all = rows(layout);
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          expect(overlaps(all[i], all[j]), `count ${count} ${i}/${j}`).toBe(false);
        }
        if (i > 0) expect(all[i].y).toBeGreaterThan(all[i - 1].y);
      }
    }
  });

  it('keeps every row inside the card, with LEAVE the bottom one', () => {
    for (const count of COUNTS) {
      for (const viewport of [DESKTOP, PHONE]) {
        const layout = npcPanelLayout(viewport, count);
        const card: PanelRect = { x: layout.x, y: layout.y, w: layout.w, h: layout.h };
        for (const row of rows(layout)) expect(inside(row, card), `count ${count}`).toBe(true);
        expect(layout.leave.y + layout.leave.h).toBe(layout.y + layout.h - NPC_PANEL_PAD);
      }
    }
  });

  it('keeps the row height and the gap it declares', () => {
    const layout = npcPanelLayout(DESKTOP, 3);
    for (const row of rows(layout)) expect(row.h).toBe(NPC_CHOICE_H);
    expect(layout.choices[1].y - (layout.choices[0].y + layout.choices[0].h)).toBe(NPC_CHOICE_GAP);
    const last = layout.choices[layout.choices.length - 1];
    expect(layout.leave.y - (last.y + last.h)).toBe(NPC_CHOICE_GAP);
  });

  it('shares one left edge and width with every row', () => {
    const layout = npcPanelLayout(DESKTOP, 4);
    for (const row of rows(layout)) {
      expect(row.x).toBe(layout.x + NPC_PANEL_PAD);
      expect(row.w).toBe(layout.w - NPC_PANEL_PAD * 2);
    }
  });
});
