import { describe, expect, it } from 'vitest';
import { battleHpBox } from '../battle-hp/view';
import { fitsInside } from '../battle-moves/view';
import {
  battleCommandBox,
  battleCommandView,
  type BattleCommandInput,
  type BattleCommandRow,
  type Rect,
  type Viewport,
} from './view';

const DESKTOP: Viewport = { width: 1280, height: 800 };
const PHONE: Viewport = { width: 390, height: 844 };
const SIDES = ['enemy', 'player'] as const;

/** The lead's four commands, in the canvas grid's own order. */
const LEAD: readonly BattleCommandRow[] = [
  { id: 'fight', label: 'FIGHT', enabled: true },
  { id: 'bag', label: 'BAG', enabled: true },
  { id: 'switch', label: 'SWITCH', enabled: true },
  { id: 'run', label: 'RUN', enabled: true },
];

/** The partner's two: FIGHT and SWITCH only. */
const PARTNER: readonly BattleCommandRow[] = [
  { id: 'fight', label: 'FIGHT', enabled: true },
  { id: 'switch', label: 'SWITCH', enabled: true },
];

function inputOf(overrides: Partial<BattleCommandInput> = {}): BattleCommandInput {
  return {
    open: true,
    card: battleCommandBox(DESKTOP),
    rows: LEAD,
    selected: 0,
    infoSelected: false,
    infoLabel: 'INFO',
    ...overrides,
  };
}

/** True when two page rects share a positive area. */
function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

describe('battleCommandBox', () => {
  it('is the card the move menu uses at 1280x800', () => {
    expect(battleCommandBox(DESKTOP)).toEqual({ x: 680, y: 582, w: 324, h: 192 });
  });

  it('is the shipped phone card at 390x844', () => {
    expect(battleCommandBox(PHONE)).toEqual({ x: 16, y: 592, w: 358, h: 236 });
  });
});

describe('the four command cells', () => {
  it('take the boxes renderCommandMenu lays out at 1280x800', () => {
    const view = battleCommandView(inputOf());
    expect(view.compact).toBe(false);
    expect(view.rows.map((row) => row.box)).toEqual([
      { x: 708, y: 606, w: 99, h: 72 },
      { x: 815, y: 606, w: 99, h: 72 },
      { x: 708, y: 686, w: 99, h: 72 },
      { x: 815, y: 686, w: 99, h: 72 },
    ]);
    expect(view.info?.box).toEqual({ x: 914, y: 606, w: 62, h: 152 });
  });

  it('take the boxes renderCommandMenu lays out at 390x844', () => {
    const view = battleCommandView(inputOf({ card: battleCommandBox(PHONE) }));
    expect(view.compact).toBe(true);
    expect(view.rows.map((row) => row.box)).toEqual([
      { x: 44, y: 616, w: 116, h: 94 },
      { x: 168, y: 616, w: 116, h: 94 },
      { x: 44, y: 718, w: 116, h: 94 },
      { x: 168, y: 718, w: 116, h: 94 },
    ]);
    expect(view.info?.box).toEqual({ x: 284, y: 616, w: 62, h: 196 });
  });

  it('keep every box inside the card at both viewports', () => {
    for (const viewport of [DESKTOP, PHONE]) {
      const view = battleCommandView(inputOf({ card: battleCommandBox(viewport) }));
      const boxes = [...view.rows.map((row) => row.box), ...(view.info ? [view.info.box] : [])];
      expect(boxes).toHaveLength(5);
      for (const box of boxes) expect(fitsInside(box, view.card)).toBe(true);
    }
  });

  it('never meet the INFO column', () => {
    for (const viewport of [DESKTOP, PHONE]) {
      const view = battleCommandView(inputOf({ card: battleCommandBox(viewport) }));
      expect(view.info).not.toBeNull();
      for (const row of view.rows) expect(overlaps(row.box, view.info!.box)).toBe(false);
    }
  });

  it('never meet an HP box at either viewport', () => {
    for (const viewport of [DESKTOP, PHONE]) {
      const view = battleCommandView(inputOf({ card: battleCommandBox(viewport) }));
      const boxes = [...view.rows.map((row) => row.box), ...(view.info ? [view.info.box] : [])];
      for (const side of SIDES) {
        const hp = battleHpBox(viewport, side, 0);
        for (const box of boxes) expect(overlaps(box, hp)).toBe(false);
      }
    }
  });
});

describe('the partner window', () => {
  it('is one full-height row of two cells at 1280x800', () => {
    const view = battleCommandView(inputOf({ card: battleCommandBox(DESKTOP), rows: PARTNER }));
    expect(view.rows.map((row) => row.box)).toEqual([
      { x: 708, y: 606, w: 99, h: 152 },
      { x: 815, y: 606, w: 99, h: 152 },
    ]);
    expect(overlaps(view.rows[0].box, view.info!.box)).toBe(false);
    expect(overlaps(view.rows[1].box, view.info!.box)).toBe(false);
  });

  it('is one full-height row of two cells at 390x844', () => {
    const view = battleCommandView(inputOf({ card: battleCommandBox(PHONE), rows: PARTNER }));
    expect(view.rows.map((row) => row.box)).toEqual([
      { x: 44, y: 616, w: 116, h: 196 },
      { x: 168, y: 616, w: 116, h: 196 },
    ]);
    expect(overlaps(view.rows[0].box, view.info!.box)).toBe(false);
    expect(overlaps(view.rows[1].box, view.info!.box)).toBe(false);
  });

  it('keeps both cells and the INFO column inside its card', () => {
    for (const viewport of [DESKTOP, PHONE]) {
      const view = battleCommandView(inputOf({ card: battleCommandBox(viewport), rows: PARTNER }));
      for (const row of view.rows) expect(fitsInside(row.box, view.card)).toBe(true);
      expect(fitsInside(view.info!.box, view.card)).toBe(true);
    }
  });
});

describe('the selection', () => {
  it('is the one row at the cursor and no other', () => {
    const view = battleCommandView(inputOf({ selected: 3 }));
    expect(view.rows.map((row) => row.selected)).toEqual([false, false, false, true]);
    expect(view.info?.selected).toBe(false);
  });

  it('leaves the rows when the cursor sits on the INFO control', () => {
    const view = battleCommandView(inputOf({ selected: 1, infoSelected: true }));
    expect(view.rows.some((row) => row.selected)).toBe(false);
    expect(view.info?.selected).toBe(true);
  });

  it('clamps an out-of-range index to the last row and NaN to the first', () => {
    const high = battleCommandView(inputOf({ selected: 9 }));
    expect(high.rows.map((row) => row.selected)).toEqual([false, false, false, true]);
    const broken = battleCommandView(inputOf({ selected: Number.NaN }));
    expect(broken.rows.map((row) => row.selected)).toEqual([true, false, false, false]);
  });

  it('answers no INFO control and keeps the card for an empty list', () => {
    const view = battleCommandView(inputOf({ rows: [], selected: 2 }));
    expect(view.rows).toEqual([]);
    expect(view.info).toBeNull();
    expect(view.card).toEqual(battleCommandBox(DESKTOP));
    expect(view.compact).toBe(false);
  });
});

describe('the flags the scene owns', () => {
  it('passes a dimmed row through untouched', () => {
    const rows: readonly BattleCommandRow[] = [
      { id: 'fight', label: 'FIGHT', enabled: true },
      { id: 'bag', label: 'BAG', enabled: false },
      { id: 'switch', label: 'SWITCH', enabled: false },
      { id: 'run', label: 'RUN', enabled: false },
    ];
    const view = battleCommandView(inputOf({ rows }));
    expect(view.rows.map((row) => row.enabled)).toEqual([true, false, false, false]);
    expect(view.rows.map((row) => row.id)).toEqual(['fight', 'bag', 'switch', 'run']);
    expect(view.rows.map((row) => row.label)).toEqual(['FIGHT', 'BAG', 'SWITCH', 'RUN']);
  });

  it('is pure: the same input returns the same view', () => {
    const input = inputOf({ selected: 2, infoSelected: false });
    expect(battleCommandView(input)).toEqual(battleCommandView(input));
    expect(input.selected).toBe(2);
  });
});
