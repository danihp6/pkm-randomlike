import { describe, expect, it } from 'vitest';
import { t } from '../../../../i18n';
import type { ShopRow } from '../../../shop';
import {
  SHOP_HEADER_H,
  SHOP_LIST_TOP,
  SHOP_PAD_BOTTOM,
  SHOP_PAD_X,
  SHOP_PANEL_H,
  SHOP_PANEL_W,
  SHOP_ROWS,
  SHOP_ROW_H,
  SHOP_TAB_GAP,
  SHOP_TAB_H,
  SHOP_TAB_W,
  shopPanelBox,
  shopPanelView,
  type ShopIcon,
  type ShopInput,
} from './index';
import { shopContentRect } from './view';

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

const ICON: ShopIcon = { url: 'atlas.png', size: 24, x: 24, y: 0 };
const stub = (): ShopIcon => ICON;

function rowsOf(count: number): readonly ShopRow[] {
  return Array.from({ length: count }, (_, i) => ({
    itemId: `item${i}`,
    name: `Item ${i}`,
    price: 100 * (i + 1),
    count: 1,
    owned: i,
    affordable: true,
    draggable: true,
  }));
}

function input(overrides: Partial<ShopInput> = {}): ShopInput {
  return {
    title: 'MART',
    mode: 'buy',
    rows: rowsOf(2),
    scroll: 0,
    selected: 0,
    money: 2480,
    message: 'What can I do for you?',
    empty: 'Nothing in stock.',
    open: true,
    ...overrides,
  };
}

function view(overrides: Partial<ShopInput> = {}, viewport = DESKTOP) {
  return shopPanelView(input(overrides), viewport, stub);
}

describe('shopPanelBox', () => {
  it('sits at the shipped centred rect at both QA viewports', () => {
    expect(shopPanelBox(DESKTOP)).toEqual({ x: 320, y: 130, w: 640, h: 540 });
    expect(shopPanelBox(PHONE)).toEqual({ x: 8, y: 152, w: 374, h: 540 });
  });

  it('gives way inside the margin before it overflows a narrow screen', () => {
    expect(shopPanelBox({ width: 320, height: 800 })).toEqual({ x: 8, y: 130, w: 304, h: 540 });
  });

  it('draws the shipped card for an unmeasurable viewport', () => {
    expect(shopPanelBox({ width: Number.NaN, height: Number.NaN })).toEqual({
      x: 8,
      y: 8,
      w: 640,
      h: 540,
    });
  });
});

describe('shopContentRect', () => {
  it('is the shipped content band at both QA viewports', () => {
    expect(shopContentRect(shopPanelBox(DESKTOP))).toEqual({ x: 20, y: 44, w: 600, h: 488 });
    expect(shopContentRect(shopPanelBox(PHONE))).toEqual({ x: 20, y: 44, w: 334, h: 488 });
  });
});

describe('shopPanelView', () => {
  it('paints the money line, the tabs, the list and the rows at the shipped rects', () => {
    const panel = view({ rows: rowsOf(7) });
    expect(panel.box).toEqual({ x: 320, y: 130, w: 640, h: 540 });
    expect(panel.money.box).toEqual({ x: 620, y: 44, w: 0, h: 20 });
    expect(panel.list.box).toEqual({ x: 20, y: 112, w: 600, h: 320 });
    expect(panel.rows[0]!.box).toEqual({ x: 26, y: 118, w: 588, h: 40 });
    expect(panel.rows[6]!.box).toEqual({ x: 26, y: 118 + 6 * 44, w: 588, h: 40 });
    expect(panel.message.box).toEqual({ x: 20, y: 444, w: 600, h: 20 });
    expect(panel.hint.box).toEqual({ x: 620, y: 468, w: 0, h: 20 });
    expect(panel.close.box).toEqual({ x: 596, y: 10, w: 24, h: 24 });
  });

  it('narrows the same card on the phone viewport', () => {
    const panel = view({ rows: rowsOf(7) }, PHONE);
    expect(panel.money.box).toEqual({ x: 354, y: 44, w: 0, h: 20 });
    expect(panel.list.box).toEqual({ x: 20, y: 112, w: 334, h: 320 });
    expect(panel.rows[0]!.box).toEqual({ x: 26, y: 118, w: 322, h: 40 });
    expect(panel.message.box).toEqual({ x: 20, y: 444, w: 334, h: 20 });
    expect(panel.hint.box).toEqual({ x: 354, y: 468, w: 0, h: 20 });
    expect(panel.close.box).toEqual({ x: 330, y: 10, w: 24, h: 24 });
  });

  it('lays the two tabs out at a 114 px pitch and marks the mode', () => {
    const panel = view();
    expect(panel.tabs).toEqual([
      { mode: 'buy', label: t('mart.buy'), active: true, box: { x: 20, y: 70, w: 108, h: 30 } },
      { mode: 'sell', label: t('mart.sell'), active: false, box: { x: 134, y: 70, w: 108, h: 30 } },
    ]);
    expect(panel.tabs.map((tab) => tab.active)).toEqual([true, false]);
    expect(view({ mode: 'sell' }).tabs.map((tab) => tab.active)).toEqual([false, true]);
  });

  it('prints the money with the shipped key', () => {
    expect(view().money.text).toBe(t('mart.money', { amount: 2480 }));
    expect(view({ money: 0 }).money.text).toBe(t('mart.money', { amount: 0 }));
  });

  it('prints each row name, its ¥ price and its owned count', () => {
    const panel = view({
      rows: [
        {
          itemId: 'pokeball',
          name: '10x Poké Ball',
          price: 300,
          count: 10,
          owned: 0,
          affordable: true,
          draggable: true,
        },
        {
          itemId: 'potion',
          name: 'Potion',
          price: 700,
          count: 1,
          owned: 2,
          affordable: true,
          draggable: true,
        },
      ],
    });
    expect(panel.rows.map((row) => [row.index, row.itemId, row.name, row.price, row.owned])).toEqual([
      [0, 'pokeball', '10x Poké Ball', '¥300', ''],
      [1, 'potion', 'Potion', '¥700', 'x2'],
    ]);
    expect(panel.rows[0]!.icon).toEqual(ICON);
    expect(shopPanelView(input(), DESKTOP, () => null).rows[0]!.icon).toBeNull();
  });

  it('marks the selected row and the title, and carries the message and the hint', () => {
    const panel = view({ selected: 1 });
    expect(panel.title).toBe('MART');
    expect(panel.rows.map((row) => row.selected)).toEqual([false, true]);
    expect(panel.message.text).toBe('What can I do for you?');
    expect(panel.hint.text).toBe(t('mart.controls'));
    expect(panel.close.label).toBe('✕');
    expect(panel.open).toBe(true);
    expect(view({ open: false }).open).toBe(false);
  });

  it('draws exactly SHOP_ROWS rows and numbers them from the scroll', () => {
    const panel = view({ rows: rowsOf(10), scroll: 3 });
    expect(SHOP_ROWS).toBe(7);
    expect(panel.rows).toHaveLength(7);
    expect(panel.rows.map((row) => row.index)).toEqual([3, 4, 5, 6, 7, 8, 9]);
    expect(view({ rows: rowsOf(4) }).rows.map((row) => row.index)).toEqual([0, 1, 2, 3]);
  });

  it('clamps the scroll to the last full window', () => {
    expect(view({ rows: rowsOf(16), scroll: 99 }).scroll).toBe(9);
    expect(view({ rows: rowsOf(16), scroll: -4 }).scroll).toBe(0);
    expect(view({ rows: rowsOf(16), scroll: Number.NaN }).scroll).toBe(0);
    expect(view({ rows: rowsOf(4), scroll: 6 }).scroll).toBe(0);
  });

  it('clamps the selection to -1…rows.length - 1', () => {
    const panel = view({ rows: rowsOf(16), scroll: 9, selected: 99 });
    expect(panel.rows.filter((row) => row.selected).map((row) => row.index)).toEqual([15]);
    expect(view({ selected: -4 }).rows.some((row) => row.selected)).toBe(false);
    expect(view({ selected: Number.NaN }).rows[0]!.selected).toBe(true);
  });

  it('shows the empty label only while the tab has no rows', () => {
    const empty = view({ rows: [], selected: 0 });
    expect(empty.rows).toEqual([]);
    expect(empty.empty).toEqual({ text: 'Nothing in stock.', box: { x: 320, y: 132, w: 0, h: 20 } });
    expect(empty.scroll).toBe(0);
    expect(view({ rows: rowsOf(1) }).empty).toBeNull();
    expect(view({ mode: 'sell', rows: [] }).empty?.text).toBe('Nothing in stock.');
  });

  it('keeps an unaffordable BUY row unbuyable, and every SELL row affordable', () => {
    const unaffordable: ShopRow = {
      itemId: 'nugget',
      name: 'Nugget',
      price: 5000,
      count: 1,
      owned: 0,
      affordable: false,
      draggable: false,
    };
    expect(view({ rows: [unaffordable] }).rows[0]!.affordable).toBe(false);
    expect(view({ mode: 'sell', rows: [unaffordable] }).rows[0]!.affordable).toBe(true);
  });

  it('is pure: the same input deep-equals, and the input is never mutated', () => {
    const before = JSON.stringify(input({ rows: rowsOf(9), selected: 2 }));
    expect(JSON.stringify(view({ rows: rowsOf(9), selected: 2 }))).toBe(
      JSON.stringify(view({ rows: rowsOf(9), selected: 2 })),
    );
    view({ rows: rowsOf(9), selected: 2 });
    expect(JSON.stringify(input({ rows: rowsOf(9), selected: 2 }))).toBe(before);
  });
});

describe('the mirrored shipped constants', () => {
  it('equal the literals the room lays the Mart out from', () => {
    expect(SHOP_PANEL_W).toBe(640);
    expect(SHOP_PANEL_H).toBe(540);
    expect(SHOP_HEADER_H).toBe(44);
    expect(SHOP_PAD_X).toBe(20);
    expect(SHOP_PAD_BOTTOM).toBe(8);
    expect(SHOP_ROW_H).toBe(44);
    expect(SHOP_ROWS).toBe(7);
    expect(SHOP_TAB_W).toBe(108);
    expect(SHOP_TAB_H).toBe(30);
    expect(SHOP_TAB_GAP).toBe(6);
    expect(SHOP_LIST_TOP).toBe(68);
  });
});
