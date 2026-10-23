import { describe, expect, it } from 'vitest';
import { boxPageCount } from '../../../partyScreen';
import {
  PC_CELL,
  PC_CELL_GAP,
  PC_COLUMNS,
  PC_CONTENT_LEFT,
  PC_MAX_PAGES,
  PC_PAD,
  PC_PAD_TOP,
  PC_PAD_X,
  PC_PAGE_SIZE,
  PC_PANEL_H,
  PC_PANEL_W,
  PC_RIP_TAB_W,
  PC_ROWS,
  PC_TAB_GAP,
  PC_TAB_H,
  PC_TAB_W,
  PC_TABS_H,
  initialPcPanelUi,
  pcPanelBox,
  pcPanelView,
  type PcPanelUi,
  type PcRow,
} from './view';

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

function rowsOf(count: number, locked = false): PcRow[] {
  return Array.from({ length: count }, (_, index) => ({
    memberId: `m${index}`,
    name: `MON ${index}`,
    level: 5 + index,
    hp: 10,
    maxHp: 20,
    statusLabel: null,
    locked,
  }));
}

function uiOf(overrides: Partial<PcPanelUi> = {}): PcPanelUi {
  return { ...initialPcPanelUi(), ...overrides };
}

describe('the mirrored constants', () => {
  it('equal the Phaser values they copy', () => {
    expect(PC_CELL).toBe(76);
    expect(PC_CELL_GAP).toBe(4);
    expect(PC_TAB_W).toBe(32);
    expect(PC_TAB_H).toBe(26);
    expect(PC_TAB_GAP).toBe(4);
    expect(PC_MAX_PAGES).toBe(7);
    expect(PC_PAGE_SIZE).toBe(16);
    expect(PC_PANEL_H).toBe(378);
    expect(PC_PANEL_W).toBe(344);
  });

  it('add up to the shipped 344 by 378 window', () => {
    expect(PC_TABS_H + PC_ROWS * PC_CELL + (PC_ROWS - 1) * PC_CELL_GAP + PC_PAD).toBe(PC_PANEL_H);
  });
});

describe('pcPanelBox', () => {
  it('sits one column left of the party stack on a desktop viewport', () => {
    expect(pcPanelBox(DESKTOP)).toEqual({ x: 576, y: 72, w: 344, h: 378 });
  });

  it('clamps onto the screen when there is no room to its left', () => {
    expect(pcPanelBox(PHONE)).toEqual({ x: 8, y: 72, w: 344, h: 378 });
  });
});

describe('pcPanelView', () => {
  it('lays the first page out cell by cell at the shipped pitch', () => {
    const rows = rowsOf(18);
    const view = pcPanelView(rows, uiOf(), boxPageCount(rows.length), DESKTOP);
    expect(view.cells).toHaveLength(PC_PAGE_SIZE);
    expect(view.cells.every((cell) => cell.memberId !== null)).toBe(true);
    expect(view.cells.map((cell) => cell.index)).toEqual(
      Array.from({ length: PC_PAGE_SIZE }, (_, slot) => slot),
    );
    expect(view.cells[0]!.box).toEqual({ x: 14, y: 50, w: 76, h: 76 });
    expect(view.cells[1]!.box).toEqual({ x: 94, y: 50, w: 76, h: 76 });
    expect(view.cells[PC_COLUMNS]!.box).toEqual({ x: 14, y: 130, w: 76, h: 76 });
    expect(view.cells[PC_PAGE_SIZE - 1]!.box).toEqual({ x: 254, y: 290, w: 76, h: 76 });
    expect(view.grid).toEqual({
      band: { x: 14, y: 50, w: 316, h: 316 },
      columns: PC_COLUMNS,
      rows: PC_ROWS,
      gap: PC_CELL_GAP,
      cell: PC_CELL,
    });
  });

  it('draws all sixteen cells of the last page, empty ones included', () => {
    const rows = rowsOf(18);
    const view = pcPanelView(rows, uiOf({ page: 1 }), boxPageCount(rows.length), DESKTOP);
    expect(boxPageCount(rows.length)).toBe(2);
    expect(view.cells).toHaveLength(PC_PAGE_SIZE);
    expect(view.cells.filter((cell) => cell.memberId !== null)).toHaveLength(2);
    expect(view.cells.filter((cell) => cell.memberId === null)).toHaveLength(14);
    expect(view.cells[0]!.index).toBe(16);
    expect(view.cells[0]!.name).toBe('MON 16');
    expect(view.cells[1]!.hpText).toBe('10/20');
    expect(view.cells[1]!.hpFraction).toBe(0.5);
    expect(view.cells[2]!.name).toBe('');
    expect(view.cells[2]!.level).toBe(0);
  });

  it('prints one tab per page, in page order, at the shipped strip', () => {
    const rows = rowsOf(18);
    const view = pcPanelView(rows, uiOf(), boxPageCount(rows.length), DESKTOP);
    expect(view.tabs.map((tab) => tab.label)).toEqual(['1', '2']);
    expect(view.tabs.map((tab) => tab.active)).toEqual([true, false]);
    expect(view.tabs[0]!.box).toEqual({ x: 30, y: 16, w: 32, h: 26 });
    expect(view.tabs[1]!.box).toEqual({ x: 66, y: 16, w: 32, h: 26 });
    expect(view.tabs[0]!.box.x).toBe(PC_CONTENT_LEFT);
    expect(view.tabs[1]!.box.x).toBe(PC_CONTENT_LEFT + PC_TAB_W + PC_TAB_GAP);
    expect(view.tabs[0]!.box.y).toBe(PC_PAD_TOP);
  });

  it('never prints more than the seven pages the strip holds', () => {
    const rows = rowsOf(PC_PAGE_SIZE * 12);
    const view = pcPanelView(rows, uiOf(), boxPageCount(rows.length), DESKTOP);
    expect(boxPageCount(rows.length)).toBe(12);
    expect(view.tabs).toHaveLength(PC_MAX_PAGES);
    expect(view.tabs[PC_MAX_PAGES - 1]!.box.x).toBe(30 + (PC_MAX_PAGES - 1) * 36);
  });

  it('draws the RIP tab, the highlight and the key chip where the module does', () => {
    const view = pcPanelView(rowsOf(1), uiOf(), 1, DESKTOP);
    expect(view.rip.box).toEqual({ x: 292, y: 16, w: 32, h: 26 });
    expect(view.rip.box.x).toBe(PC_PANEL_W - PC_PAD_X - PC_RIP_TAB_W);
    expect(view.rip.active).toBe(false);
    expect(view.rip.locked).toBe(true);
    expect(view.highlight).toEqual({ x: 12, y: 12, w: 320, h: 1 });
    expect(view.chip).toEqual({ letter: 'O', box: { x: 0, y: 0, w: 24, h: 24 } });
  });

  it('marks the cursor cell selected and no empty cell ever', () => {
    const rows = rowsOf(18);
    const view = pcPanelView(rows, uiOf({ page: 1, cursor: 17 }), 2, DESKTOP);
    expect(view.cells.filter((cell) => cell.selected).map((cell) => cell.index)).toEqual([17]);
    const empty = pcPanelView(rows, uiOf({ page: 1, cursor: 30 }), 2, DESKTOP);
    expect(empty.cells.some((cell) => cell.selected)).toBe(false);
  });

  it('carries the shipped lock flag on box cells and never on RIP cells', () => {
    const rows = rowsOf(4, true);
    const box = pcPanelView(rows, uiOf(), 1, DESKTOP);
    expect(box.cells.slice(0, 4).every((cell) => cell.locked)).toBe(true);
    const rip = pcPanelView(rows, uiOf({ pane: 'rip' }), 1, DESKTOP);
    expect(rip.cells.some((cell) => cell.locked)).toBe(false);
    expect(rip.rip.active).toBe(true);
    expect(rip.cells.slice(0, 4).every((cell) => cell.memberId !== null)).toBe(true);
  });

  it('keeps a page the strip cannot draw on the last one it can', () => {
    const view = pcPanelView(rowsOf(18), uiOf({ page: 5 }), 2, DESKTOP);
    expect(view.tabs.map((tab) => tab.active)).toEqual([false, true]);
    expect(view.cells[0]!.index).toBe(16);
  });

  it('is pure: the same input deep-equals', () => {
    const rows = rowsOf(18);
    const first = pcPanelView(rows, uiOf(), 2, PHONE);
    const second = pcPanelView(rows, uiOf(), 2, PHONE);
    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
  });
});
