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
  missionsPanelRows,
  missionsPanelView,
  type MissionsInput,
  type StackMissionInput,
} from './view';

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

function missionOf(overrides: Partial<StackMissionInput> = {}): StackMissionInput {
  return {
    id: 'stretch',
    scopeKey: 'stretch',
    name: 'No losses before the leader',
    tag: 'Badge 1',
    progress: null,
    status: 'active',
    ...overrides,
  };
}

/** The three-row stack of a city node, in the engine's own order. */
function stackOf(): readonly StackMissionInput[] {
  return [
    missionOf(),
    missionOf({ id: 'city-1', scopeKey: 'city:city:1', name: 'Talk to everyone here' }),
    missionOf({ id: 'errand', scopeKey: 'random:city:1', name: 'Run an errand' }),
  ];
}

function inputOf(overrides: Partial<MissionsInput> = {}): MissionsInput {
  return {
    open: true,
    title: 'MISSIONS',
    missions: stackOf(),
    empty: 'No floor mission completed yet.',
    ...overrides,
  };
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

  it('grows one row per mission of the stack and stops at the cap', () => {
    expect(missionsPanelBox(DESKTOP, 3).h).toBe(MISSIONS_HEAD_H + 3 * MISSIONS_ROW_H);
    expect(missionsPanelBox(DESKTOP, 99).h).toBe(MISSIONS_HEAD_H + MISSIONS_MAX_ROWS * MISSIONS_ROW_H);
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
  it('keeps the stack s order and prints one row per mission', () => {
    const view = missionsPanelView(inputOf(), DESKTOP);
    const rows = missionsPanelRows(view);
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.scopeKey)).toStrictEqual(['stretch', 'city:city:1', 'random:city:1']);
    expect(rows.map((row) => row.id)).toStrictEqual(['stretch', 'city-1', 'errand']);
    expect(rows.map((row) => row.name)).toStrictEqual([
      'No losses before the leader',
      'Talk to everyone here',
      'Run an errand',
    ]);
    expect(view.current?.scopeKey).toBe('stretch');
    expect(view.rows.map((row) => row.scopeKey)).toStrictEqual(['city:city:1', 'random:city:1']);
  });

  it('carries every row s status, tag and progress line', () => {
    const view = missionsPanelView(
      inputOf({
        missions: [
          missionOf({ status: 'failed', progress: 'failed' }),
          missionOf({ id: 'city-1', scopeKey: 'city:city:1', status: 'met', progress: 'met' }),
          missionOf({ id: 'errand', scopeKey: 'random:city:1', tag: 'Badge 2' }),
        ],
      }),
      DESKTOP,
    );
    const rows = missionsPanelRows(view);
    expect(rows.map((row) => row.status)).toStrictEqual(['failed', 'met', 'active']);
    expect(rows.map((row) => row.progress)).toStrictEqual(['failed', 'met', null]);
    expect(rows.map((row) => row.tag)).toStrictEqual(['Badge 1', 'Badge 1', 'Badge 2']);
    expect(view.empty).toBeNull();
  });

  it('draws the head row at its own height and the rest below it', () => {
    const view = missionsPanelView(inputOf(), DESKTOP);
    const rows = missionsPanelRows(view);
    expect(rows[0].box).toStrictEqual({
      x: MISSIONS_PAD,
      y: 0,
      w: MISSIONS_W - MISSIONS_PAD * 2,
      h: MISSIONS_HEAD_H,
    });
    expect(rows[1].box).toStrictEqual({
      x: MISSIONS_PAD,
      y: MISSIONS_HEAD_H,
      w: MISSIONS_W - MISSIONS_PAD * 2,
      h: MISSIONS_ROW_H,
    });
    expect(rows[2].box.y).toBe(MISSIONS_HEAD_H + MISSIONS_ROW_H);
    const last = rows[rows.length - 1];
    expect(last.box.y + last.box.h).toBe(view.box.h);
    expect(view.box.h).toBe(MISSIONS_HEAD_H + 2 * MISSIONS_ROW_H);
  });

  it('caps the stack and keeps the card inside the rows it draws', () => {
    const many = Array.from({ length: 9 }, (_, index) =>
      missionOf({ id: `m${index}`, scopeKey: `random:city:${index}` }),
    );
    const view = missionsPanelView(inputOf({ missions: many }), DESKTOP);
    const rows = missionsPanelRows(view);
    expect(rows).toHaveLength(MISSIONS_MAX_ROWS);
    expect(rows.map((row) => row.id)).toStrictEqual(['m0', 'm1', 'm2', 'm3', 'm4', 'm5']);
    const last = rows[rows.length - 1];
    expect(last.box.y + last.box.h).toBe(view.box.h);
  });

  it('paints the empty state only when the stack holds no row at all', () => {
    const view = missionsPanelView(inputOf({ missions: [] }), DESKTOP);
    expect(view.current).toBeNull();
    expect(view.rows).toStrictEqual([]);
    expect(missionsPanelRows(view)).toStrictEqual([]);
    expect(view.empty).toBe('No floor mission completed yet.');
    expect(view.box.h).toBe(MISSIONS_HEAD_H + MISSIONS_ROW_H);
  });

  it('is pure: the same input twice deep-equals and is never written', () => {
    const input = inputOf();
    const before = JSON.stringify(input);
    expect(missionsPanelView(input, DESKTOP)).toStrictEqual(missionsPanelView(input, DESKTOP));
    expect(JSON.stringify(input)).toBe(before);
  });

  it('paints the closed card as the same box with its own open flag', () => {
    const view = missionsPanelView(inputOf({ open: false }), PHONE);
    expect(view.open).toBe(false);
    expect(view.box).toStrictEqual(missionsPanelBox(PHONE, 2));
    expect(view.title).toBe('MISSIONS');
  });
});
