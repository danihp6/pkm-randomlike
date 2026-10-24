import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  REWARDS_CHOOSE,
  REWARDS_CLOSE_LABEL,
  REWARDS_CLOSE_SIZE,
  REWARDS_MARGIN,
  REWARDS_NARROW,
  REWARDS_PAD_X,
  REWARDS_PANEL_H,
  REWARDS_PANEL_W,
  REWARDS_ROW_GAP,
  REWARDS_ROW_H,
  REWARDS_ROW_TOP,
  REWARDS_ROWS,
  REWARDS_SHEET_CHOOSE,
  REWARDS_SHEET_CLOSE_SIZE,
  REWARDS_SHEET_H,
  REWARDS_SHEET_HANDLE,
  REWARDS_SHEET_PAD_X,
  REWARDS_SHEET_ROW_H,
  REWARDS_SHEET_ROW_TOP,
  REWARDS_SHEET_TITLE,
  REWARDS_SHEET_W,
  REWARDS_TITLE,
  rewardsNarrow,
  rewardsPanelBox,
  rewardsPanelView,
  rewardsPress,
  rewardsRowBand,
  type Rect,
  type RewardRowView,
  type RewardsIcon,
  type RewardsInput,
} from './index';

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

const ICON: RewardsIcon = { url: 'atlas.png', size: 24, x: 24, y: 0 };

/** A row in `rewardRows` order: the first three are items, the rest anonymous Pokémon. */
function rowOf(index: number): RewardRowView {
  const item = index < 3;
  return {
    index,
    kind: item ? 'item' : 'pokemon',
    label: item ? `Item ${index}` : `STAT · Nature ${index}`,
    description: item ? `What item ${index} does.` : '',
    icon: item ? ICON : null,
    armed: false,
    box: { x: 0, y: 0, w: 0, h: 0 },
  };
}

function rowsOf(count: number): readonly RewardRowView[] {
  return Array.from({ length: count }, (_, i) => rowOf(i));
}

function input(overrides: Partial<RewardsInput> = {}): RewardsInput {
  return {
    title: 'MINI-BOSS REWARD',
    choose: 'Choose one.',
    rows: rowsOf(6),
    armed: -1,
    open: true,
    ...overrides,
  };
}

function view(overrides: Partial<RewardsInput> = {}, viewport = DESKTOP) {
  return rewardsPanelView(input(overrides), viewport);
}

/** A panel-relative rect as the page shows it. */
function absolute(rect: Rect, panel: { box: Rect }): Rect {
  return { x: panel.box.x + rect.x, y: panel.box.y + rect.y, w: rect.w, h: rect.h };
}

describe('rewardsPanelBox', () => {
  it('sits on the board’s own card and sheet at the two QA viewports', () => {
    expect(rewardsPanelBox(DESKTOP)).toEqual({ x: 360, y: 196, w: 560, h: 342 });
    expect(rewardsPanelBox(PHONE)).toEqual({ x: 8, y: 226, w: 374, h: 392 });
  });

  it('keeps the card inside an 8 px margin on every edge', () => {
    for (const viewport of [
      DESKTOP,
      PHONE,
      { width: 320, height: 800 },
      { width: 390, height: 640 },
      { width: 1280, height: 300 },
      { width: 601, height: 801 },
    ]) {
      const box = rewardsPanelBox(viewport);
      expect(box.x, JSON.stringify(viewport)).toBeGreaterThanOrEqual(REWARDS_MARGIN);
      expect(box.y, JSON.stringify(viewport)).toBeGreaterThanOrEqual(REWARDS_MARGIN);
      expect(box.x + box.w, JSON.stringify(viewport)).toBeLessThanOrEqual(
        viewport.width - REWARDS_MARGIN,
      );
      expect(box.y + box.h, JSON.stringify(viewport)).toBeLessThanOrEqual(
        viewport.height - REWARDS_MARGIN,
      );
    }
  });

  it('gives way inside the margin before it overflows a narrow screen', () => {
    expect(rewardsPanelBox({ width: 320, height: 800 })).toEqual({ x: 8, y: 204, w: 304, h: 392 });
  });

  it('turns into the phone sheet below the 600 px breakpoint only', () => {
    expect(rewardsNarrow(rewardsPanelBox({ width: REWARDS_NARROW, height: 800 }))).toBe(false);
    expect(rewardsNarrow(rewardsPanelBox({ width: REWARDS_NARROW - 1, height: 800 }))).toBe(true);
    expect(rewardsPanelBox({ width: REWARDS_NARROW, height: 800 }).w).toBe(REWARDS_PANEL_W);
    expect(rewardsPanelBox({ width: REWARDS_NARROW - 1, height: 800 }).w).toBe(REWARDS_SHEET_W);
  });

  it('draws the board’s desktop card for an unmeasurable viewport', () => {
    expect(rewardsPanelBox({ width: Number.NaN, height: Number.NaN })).toEqual({
      x: 360,
      y: 196,
      w: 560,
      h: 342,
    });
  });
});

describe('rewardsRowBand', () => {
  it('is the board’s three row slots on both layouts', () => {
    expect(rewardsRowBand(view({}, DESKTOP))).toEqual({ x: 20, y: 78, w: 520, h: 244 });
    expect(rewardsRowBand(view({}, PHONE))).toEqual({ x: 12, y: 94, w: 350, h: 208 });
  });
});

describe('rewardsPanelView', () => {
  it('paints the board’s desktop card, title, choose line and close', () => {
    const panel = view();
    expect(panel.box).toEqual({ x: 360, y: 196, w: 560, h: 342 });
    expect(panel.highlight).toEqual({ x: 12, y: 12, w: 536, h: 1 });
    expect(panel.title).toEqual({ text: 'MINI-BOSS REWARD', box: REWARDS_TITLE });
    expect(panel.choose).toEqual({ text: 'Choose one.', box: REWARDS_CHOOSE });
    expect(panel.close).toEqual({
      label: REWARDS_CLOSE_LABEL,
      box: { x: 516, y: 10, w: REWARDS_CLOSE_SIZE, h: REWARDS_CLOSE_SIZE },
    });
    expect(panel.open).toBe(true);
  });

  it('lays the rows out at the board’s pitch, panel-relative', () => {
    const panel = view();
    expect(panel.rows.map((row) => row.box)).toEqual([
      { x: 20, y: 78, w: 520, h: 76 },
      { x: 20, y: 162, w: 520, h: 76 },
      { x: 20, y: 246, w: 520, h: 76 },
      { x: 20, y: 330, w: 520, h: 76 },
      { x: 20, y: 414, w: 520, h: 76 },
      { x: 20, y: 498, w: 520, h: 76 },
    ]);
    expect(panel.rows.map((row) => absolute(row.box, panel).y).slice(0, 3)).toEqual([274, 358, 442]);
    expect(absolute(panel.close.box, panel)).toEqual({ x: 876, y: 206, w: 24, h: 24 });
  });

  it('paints the phone sheet from the mobile frame', () => {
    const panel = view({}, PHONE);
    expect(panel.box).toEqual({ x: 8, y: 226, w: 374, h: 392 });
    expect(panel.title).toEqual({ text: 'MINI-BOSS REWARD', box: REWARDS_SHEET_TITLE });
    expect(panel.choose).toEqual({ text: 'Choose one.', box: REWARDS_SHEET_CHOOSE });
    expect(panel.close).toEqual({
      label: REWARDS_CLOSE_LABEL,
      box: { x: 348, y: 32, w: REWARDS_SHEET_CLOSE_SIZE, h: REWARDS_SHEET_CLOSE_SIZE },
    });
    expect(panel.rows.slice(0, 3).map((row) => absolute(row.box, panel))).toEqual([
      { x: 20, y: 320, w: 350, h: 64 },
      { x: 20, y: 392, w: 350, h: 64 },
      { x: 20, y: 464, w: 350, h: 64 },
    ]);
  });

  it('keeps the rows in the order they arrive, with their own indices', () => {
    const panel = view({ rows: rowsOf(6) });
    expect(panel.rows).toHaveLength(6);
    expect(panel.rows.map((row) => [row.index, row.kind])).toEqual([
      [0, 'item'],
      [1, 'item'],
      [2, 'item'],
      [3, 'pokemon'],
      [4, 'pokemon'],
      [5, 'pokemon'],
    ]);
    expect(view({ rows: rowsOf(0) }).rows).toEqual([]);
    expect(view({ rows: rowsOf(1) }).rows).toHaveLength(1);
  });

  it('paints only a Pokémon row’s label, and nothing else', () => {
    const leaks: RewardRowView = {
      index: 0,
      kind: 'pokemon',
      label: 'ATTACK · Adamant',
      description: 'leaks the dex',
      icon: ICON,
      armed: false,
      box: { x: 0, y: 0, w: 0, h: 0 },
    };
    const [row] = view({ rows: [leaks] }).rows;
    expect(row!.label).toBe('ATTACK · Adamant');
    expect(row!.description).toBe('');
    expect(row!.icon).toBeNull();
  });

  it('keeps an item row’s description and its atlas cell', () => {
    const [row] = view({ rows: [rowOf(0)] }).rows;
    expect(row!.description).toBe('What item 0 does.');
    expect(row!.icon).toEqual(ICON);
    const noIcon: RewardRowView = { ...rowOf(0), icon: null };
    expect(view({ rows: [noIcon] }).rows[0]!.icon).toBeNull();
  });

  it('arms exactly the row the last press left, and clamps the arm into the rows', () => {
    expect(view({ armed: 1 }).rows.map((row) => row.armed)).toEqual([
      false,
      true,
      false,
      false,
      false,
      false,
    ]);
    expect(view({ armed: -1 }).rows.some((row) => row.armed)).toBe(false);
    expect(view({ armed: 99 }).rows[5]!.armed).toBe(true);
    expect(view({ armed: -7 }).rows.some((row) => row.armed)).toBe(false);
    expect(view({ armed: Number.NaN }).rows.some((row) => row.armed)).toBe(false);
    expect(view({ rows: rowsOf(0), armed: 2 }).rows).toEqual([]);
  });

  it('carries `open` through, so a paused route hides the card', () => {
    expect(view({ open: false }).open).toBe(false);
  });

  it('is pure: the same input deep-equals, and the input is never written', () => {
    const before = JSON.stringify(input({ armed: 2 }));
    const first = JSON.stringify(view({ armed: 2 }));
    expect(JSON.stringify(view({ armed: 2 }))).toBe(first);
    view({ armed: 2 });
    expect(JSON.stringify(input({ armed: 2 }))).toBe(before);
  });
});

describe('rewardsPress', () => {
  it('arms a row and commits nothing on the first press', () => {
    expect(rewardsPress(-1, 2, 6)).toEqual({ armed: 2, commit: null });
    expect(rewardsPress(0, 3, 6)).toEqual({ armed: 3, commit: null });
  });

  it('commits exactly the armed row on its second press', () => {
    expect(rewardsPress(2, 2, 6)).toEqual({ armed: 2, commit: 2 });
    expect(rewardsPress(5, 5, 6)).toEqual({ armed: 5, commit: 5 });
  });

  it('never arms or commits an out-of-range press', () => {
    expect(rewardsPress(1, -3, 6)).toEqual({ armed: 1, commit: null });
    expect(rewardsPress(1, 6, 6)).toEqual({ armed: 1, commit: null });
    expect(rewardsPress(1, Number.NaN, 6)).toEqual({ armed: 1, commit: null });
    expect(rewardsPress(1, 2, 0)).toEqual({ armed: -1, commit: null });
    expect(rewardsPress(-1, 0, 0)).toEqual({ armed: -1, commit: null });
  });

  it('falls back to nothing armed when the arm itself is not a row', () => {
    expect(rewardsPress(Number.NaN, 0, 6)).toEqual({ armed: 0, commit: null });
    expect(rewardsPress(99, 0, 6)).toEqual({ armed: 0, commit: null });
    expect(rewardsPress(99, 5, 6)).toEqual({ armed: 5, commit: 5 });
  });

  it('drives the two-step pick: one press arms, the second commits once', () => {
    const commit = vi.fn((index: number): number => index);
    let armed = -1;
    const press = (index: number): void => {
      const action = rewardsPress(armed, index, 6);
      armed = action.armed;
      if (action.commit !== null) commit(action.commit);
    };

    press(1);
    expect(armed).toBe(1);
    expect(commit).not.toHaveBeenCalled();

    press(3);
    expect(armed).toBe(3);
    expect(commit).not.toHaveBeenCalled();

    press(3);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(3);
    expect(armed).toBe(3);
  });
});

describe('the mirrored board constants', () => {
  it('equal the literals the frames measure', () => {
    expect(REWARDS_PANEL_W).toBe(560);
    expect(REWARDS_PANEL_H).toBe(342);
    expect(REWARDS_SHEET_W).toBe(374);
    expect(REWARDS_SHEET_H).toBe(392);
    expect(REWARDS_NARROW).toBe(600);
    expect(REWARDS_MARGIN).toBe(8);
    expect(REWARDS_PAD_X).toBe(20);
    expect(REWARDS_SHEET_PAD_X).toBe(12);
    expect(REWARDS_ROWS).toBe(3);
    expect(REWARDS_ROW_H).toBe(76);
    expect(REWARDS_SHEET_ROW_H).toBe(64);
    expect(REWARDS_ROW_GAP).toBe(8);
    expect(REWARDS_ROW_TOP).toBe(78);
    expect(REWARDS_SHEET_ROW_TOP).toBe(94);
    expect(REWARDS_CLOSE_SIZE).toBe(24);
    expect(REWARDS_SHEET_CLOSE_SIZE).toBe(14);
    expect(REWARDS_CLOSE_LABEL).toBe('×');
    expect(REWARDS_SHEET_HANDLE).toEqual({ w: 36, h: 4, y: 12 });
  });
});

describe('the live flag contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('reports the canvas count with the flag off and 0 under ?hud=dom', async () => {
    vi.resetModules();
    const flagOff = await import('../../../../scenes/panels/rewards');
    flagOff.noteRewardsDrawnObjects(12);
    expect(flagOff.rewardsDrawnObjectCount()).toBe(12);

    vi.stubGlobal('window', { location: { search: '?hud=dom' } });
    vi.resetModules();
    const flagOn = await import('../../../../scenes/panels/rewards');
    flagOn.noteRewardsDrawnObjects(12);
    expect(flagOn.rewardsDrawnObjectCount()).toBe(0);
  });

  it('never reports a negative canvas count', async () => {
    vi.resetModules();
    const scene = await import('../../../../scenes/panels/rewards');
    scene.noteRewardsDrawnObjects(-4);
    expect(scene.rewardsDrawnObjectCount()).toBe(0);
  });
});
