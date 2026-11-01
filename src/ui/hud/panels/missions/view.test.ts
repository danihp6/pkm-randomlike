import { describe, expect, it } from 'vitest';
import {
  MISSIONS_CONTENT_LEFT,
  MISSIONS_HEAD_H,
  MISSIONS_MAX_ROWS,
  MISSIONS_NARROW,
  MISSIONS_PAD,
  MISSIONS_PHONE_W,
  MISSIONS_ROW_H,
  MISSIONS_W,
  missionsPanelBox,
  missionsPanelView,
  type MissionsInput,
} from './view';

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

function inputOf(overrides: Partial<MissionsInput> = {}): MissionsInput {
  return {
    open: true,
    title: 'MISSIONS',
    current: { id: 'flawless', name: 'Flawless floor', progress: 'HP lost 0' },
    completed: [],
    empty: 'No floor mission completed yet.',
    ...overrides,
  };
}

function completedOf(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `m${index}`,
    name: `MISSION ${index}`,
    map: `Map ${index + 1}`,
  }));
}

describe('the mirrored constants', () => {
  it('are the notices stack s own measured numbers', () => {
    expect(MISSIONS_W).toBe(360);
    expect(MISSIONS_PHONE_W).toBe(374);
    expect(MISSIONS_NARROW).toBe(560);
    expect(MISSIONS_HEAD_H).toBe(32);
    expect(MISSIONS_ROW_H).toBe(22);
    expect(MISSIONS_MAX_ROWS).toBe(6);
    expect(MISSIONS_PAD).toBe(8);
    expect(MISSIONS_CONTENT_LEFT).toBe(30);
  });
});

describe('missionsPanelBox', () => {
  it('docks the desk card under the notice strip, centred', () => {
    expect(missionsPanelBox(DESKTOP, 0)).toStrictEqual({ x: 460, y: 88, w: 360, h: 54 });
  });

  it('docks the phone card at the 8 px gutter', () => {
    expect(missionsPanelBox(PHONE, 0)).toStrictEqual({ x: 8, y: 111, w: 374, h: 54 });
  });

  it('grows one row per met floor and stops at the cap', () => {
    expect(missionsPanelBox(DESKTOP, 3).h).toBe(MISSIONS_HEAD_H + 3 * MISSIONS_ROW_H);
    expect(missionsPanelBox(DESKTOP, 99).h).toBe(
      MISSIONS_HEAD_H + MISSIONS_MAX_ROWS * MISSIONS_ROW_H,
    );
    expect(missionsPanelBox(DESKTOP, Number.NaN).h).toBe(MISSIONS_HEAD_H + MISSIONS_ROW_H);
  });

  it('never leaves the window it is drawn in', () => {
    for (const viewport of [DESKTOP, PHONE, { width: 320, height: 480 }]) {
      const box = missionsPanelBox(viewport, 3);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.w).toBeLessThanOrEqual(viewport.width);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.h).toBeLessThanOrEqual(viewport.height);
    }
  });
});

describe('missionsPanelView', () => {
  it('puts the floor s own mission first, with its progress', () => {
    const view = missionsPanelView(inputOf(), DESKTOP);
    expect(view.current).toStrictEqual({
      id: 'flawless',
      name: 'Flawless floor',
      progress: 'HP lost 0',
      map: '',
      completed: false,
      box: { x: MISSIONS_PAD, y: 0, w: 360 - MISSIONS_PAD * 2, h: MISSIONS_HEAD_H },
    });
    expect(view.rows).toStrictEqual([]);
    expect(view.empty).toBe('No floor mission completed yet.');
  });

  it('lists the met floors newest first, one row each, and drops the empty state', () => {
    const view = missionsPanelView(
      inputOf({ completed: completedOf(3).reverse() }),
      DESKTOP,
    );
    expect(view.rows.map((row) => row.id)).toStrictEqual(['m2', 'm1', 'm0']);
    expect(view.rows[0].box).toStrictEqual({
      x: MISSIONS_PAD,
      y: MISSIONS_HEAD_H,
      w: 360 - MISSIONS_PAD * 2,
      h: MISSIONS_ROW_H,
    });
    expect(view.rows[2].box.y).toBe(MISSIONS_HEAD_H + 2 * MISSIONS_ROW_H);
    expect(view.rows.every((row) => row.progress === null && row.completed)).toBe(true);
    expect(view.empty).toBeNull();
  });

  it('caps the list and keeps the card inside the rows it draws', () => {
    const view = missionsPanelView(inputOf({ completed: completedOf(9) }), DESKTOP);
    expect(view.rows).toHaveLength(MISSIONS_MAX_ROWS);
    const last = view.rows[view.rows.length - 1];
    expect(last.box.y + last.box.h).toBe(view.box.h);
  });

  it('carries a null head row on a run with no mission', () => {
    const view = missionsPanelView(inputOf({ current: null }), DESKTOP);
    expect(view.current).toBeNull();
    expect(view.box.h).toBe(MISSIONS_HEAD_H + MISSIONS_ROW_H);
  });

  it('is pure: the same input twice deep-equals and is never written', () => {
    const input = inputOf({ completed: completedOf(2) });
    const before = JSON.stringify(input);
    expect(missionsPanelView(input, DESKTOP)).toStrictEqual(missionsPanelView(input, DESKTOP));
    expect(JSON.stringify(input)).toBe(before);
  });

  it('paints the closed card as the same box with its own open flag', () => {
    const view = missionsPanelView(inputOf({ open: false }), PHONE);
    expect(view.open).toBe(false);
    expect(view.box).toStrictEqual(missionsPanelBox(PHONE, 0));
  });
});
