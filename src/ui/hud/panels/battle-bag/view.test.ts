import { describe, expect, it } from 'vitest';
import { itemIconFrame } from '../../../../data/itemIcons';
import { t } from '../../../../i18n';
import { BAG_GRID_COLS, BAG_GRID_GAP, bagGridLayout, type BagCategory } from '../../../bag';
import { battleMovesBox } from '../battle-moves';
import {
  battleBagBox,
  battleBagView,
  cellPressIntent,
  infoLineCount,
  type BattleBagInput,
  type Rect,
  type Viewport,
} from './view';

const DESKTOP: Viewport = { width: 1280, height: 800 };
const PHONE: Viewport = { width: 390, height: 844 };
const CARD: Rect = { x: 276, y: 582, w: 728, h: 192 };
const PHONE_CARD: Rect = { x: 16, y: 592, w: 358, h: 236 };

const STACKS: readonly Readonly<{ itemId: string; name: string; count: number }>[] = [
  { itemId: 'potion', name: 'Potion', count: 3 },
  { itemId: 'superpotion', name: 'Super Potion', count: 2 },
  { itemId: 'hyperpotion', name: 'Hyper Potion', count: 1 },
  { itemId: 'pokeball', name: 'Poke Ball', count: 12 },
  { itemId: 'greatball', name: 'Great Ball', count: 5 },
  { itemId: 'ultraball', name: 'Ultra Ball', count: 4 },
  { itemId: 'antidote', name: 'Antidote', count: 2 },
  { itemId: 'awakening', name: 'Awakening', count: 1 },
];

const TABS: readonly Readonly<{ category: BagCategory; label: string; active: boolean }>[] = [
  { category: 'consumable', label: 'CONSUMIBLES', active: true },
  { category: 'ball', label: 'POKEBALLS', active: false },
];

const POTION_INFO = 'Potion\nA SPRAY-TYPE MEDICINE.\nRESTORES 20 HP TO ONE POKEMON.';

type Overrides = Readonly<{
  open?: boolean;
  card?: Rect;
  tabs?: readonly Readonly<{ category: BagCategory; label: string; active: boolean }>[];
  query?: string;
  focused?: boolean;
  rows?: readonly Readonly<{ itemId: string; name: string; count: number }>[];
  selected?: number;
  detail?: string;
  info?: Readonly<{ text: string }> | null;
  empty?: string | null;
}>;

function inputOf(overrides: Overrides = {}): BattleBagInput {
  return {
    open: overrides.open ?? true,
    card: overrides.card ?? CARD,
    tabs: overrides.tabs ?? TABS,
    query: overrides.query ?? '',
    focused: overrides.focused ?? false,
    rows: overrides.rows ?? STACKS,
    selected: overrides.selected ?? 0,
    detail: overrides.detail ?? 'Potion x3',
    info: overrides.info === undefined ? { text: POTION_INFO } : overrides.info,
    empty: overrides.empty === undefined ? null : overrides.empty,
  };
}

describe('battleBagBox', () => {
  it('is the shipped battle menu box, not a copy of its arithmetic', () => {
    expect(battleBagBox).toBe(battleMovesBox);
    expect(battleBagBox(DESKTOP)).toStrictEqual({ x: 440, y: 582, w: 564, h: 192 });
    expect(battleBagBox(PHONE)).toStrictEqual({ x: 16, y: 592, w: 358, h: 236 });
  });
});

describe('battleBagView geometry', () => {
  it('lays the pocket chips at the card s top, 120×26 with a 4 px gap', () => {
    const view = battleBagView(inputOf());
    expect(view.tabs.map((tab) => tab.box)).toStrictEqual([
      { x: 20, y: 16, w: 120, h: 26 },
      { x: 144, y: 16, w: 120, h: 26 },
    ]);
    expect(view.tabs.map((tab) => tab.label)).toStrictEqual(['CONSUMIBLES', 'POKEBALLS']);
    expect(view.tabs.map((tab) => tab.active)).toStrictEqual([true, false]);
  });

  it('puts the filter field under the chips and the band under the field', () => {
    const view = battleBagView(inputOf());
    expect(view.search.box).toStrictEqual({ x: 20, y: 50, w: 688, h: 24 });
    expect(view.search.placeholder).toBe(t('hud.searchItems'));
    expect(view.grid.box).toStrictEqual({ x: 20, y: 82, w: 688, h: 76 });
    expect(view.grid.columns).toBe(BAG_GRID_COLS);
    expect(view.grid.rows).toBe(2);
    expect(view.grid.cellW).toBe(35);
    expect(view.grid.gap).toBe(BAG_GRID_GAP);
  });

  it('takes the ten cell rects from bagGridLayout, five columns of 35 at a 41 px pitch', () => {
    const view = battleBagView(inputOf());
    const layout = bagGridLayout({ x: 20, y: 82, w: 688, h: 76 }, STACKS.length, {
      rows: 2,
      gap: BAG_GRID_GAP,
      maxCell: 56,
    });
    expect(view.cells.map((cell) => cell.box)).toStrictEqual(layout.cells);
    expect(view.cells).toHaveLength(10);
    expect(view.cells[0]!.box).toStrictEqual({ x: 264, y: 82, w: 35, h: 35 });
    expect(view.cells[5]!.box).toStrictEqual({ x: 264, y: 123, w: 35, h: 35 });
    for (let i = 1; i < 5; i++) {
      expect(view.cells[i]!.box.x - view.cells[i - 1]!.box.x).toBe(41);
    }
    for (const cell of view.cells) {
      expect(cell.box.w).toBe(35);
      expect(cell.box.h).toBe(35);
    }
  });

  it('puts the selected stack s line 20 px tall above the card s bottom padding', () => {
    const view = battleBagView(inputOf());
    expect(view.detail.box).toStrictEqual({ x: 20, y: 164, w: 688, h: 20 });
    expect(view.detail.text).toBe('Potion x3');
  });

  it('centres the ◀ on the band s left edge, 36 px tall', () => {
    const view = battleBagView(inputOf());
    expect(view.back.label).toBe('\u25c0');
    expect(view.back.box).toStrictEqual({ x: 34, y: 133, w: 36, h: 36 });
    expect(view.back.box.y).toBe((82 + 192 - 8) / 2);
  });

  it('follows the compact card out of battleBagBox, with no hand-tuned viewport', () => {
    const view = battleBagView(inputOf({ card: PHONE_CARD }));
    expect(view.box).toStrictEqual(PHONE_CARD);
    expect(view.search.box).toStrictEqual({ x: 20, y: 50, w: 318, h: 24 });
    expect(view.grid.box).toStrictEqual({ x: 20, y: 82, w: 318, h: 120 });
    expect(view.grid.cellW).toBe(56);
    expect(view.cells).toHaveLength(10);
    expect(view.cells[1]!.box.x - view.cells[0]!.box.x).toBe(62);
    expect(view.detail.box.y).toBe(236 - 8 - 20);
    expect(view.back.box.y).toBe((82 + 236 - 8) / 2);
  });
});

describe('battleBagView cells', () => {
  it('reads one stack per cell, in bag order, and a dim tail past the last one', () => {
    const view = battleBagView(inputOf());
    expect(view.cells.slice(0, STACKS.length).map((cell) => cell.itemId)).toStrictEqual(
      STACKS.map((stack) => stack.itemId),
    );
    expect(view.cells.slice(0, STACKS.length).map((cell) => cell.count)).toStrictEqual([
      3, 2, 1, 12, 5, 4, 2, 1,
    ]);
    expect(view.cells.slice(0, STACKS.length).map((cell) => cell.name)).toStrictEqual(
      STACKS.map((stack) => stack.name),
    );
    expect(view.cells.slice(STACKS.length)).toStrictEqual([
      {
        index: 8,
        itemId: '',
        name: '',
        count: 0,
        frame: null,
        selected: false,
        box: view.cells[8]!.box,
      },
      {
        index: 9,
        itemId: '',
        name: '',
        count: 0,
        frame: null,
        selected: false,
        box: view.cells[9]!.box,
      },
    ]);
  });

  it('carries each stack s Añil atlas frame', () => {
    const view = battleBagView(inputOf());
    expect(view.cells[0]!.frame).toBe(itemIconFrame('potion'));
    expect(view.cells[0]!.frame).not.toBeNull();
    expect(view.cells[3]!.frame).toBe(itemIconFrame('pokeball'));
  });

  it('flags the selected index exactly once', () => {
    for (const selected of [0, 3, 7]) {
      const view = battleBagView(inputOf({ selected }));
      expect(view.cells.filter((cell) => cell.selected).map((cell) => cell.index)).toStrictEqual([
        selected,
      ]);
    }
  });

  it('paints every one of the ten boxes dim when the pocket is empty', () => {
    const view = battleBagView(
      inputOf({ rows: [], detail: t('battle.noItems'), info: null, empty: t('battle.noItems') }),
    );
    expect(view.cells).toHaveLength(10);
    expect(view.cells.every((cell) => cell.itemId === '' && cell.frame === null)).toBe(true);
    expect(view.cells.some((cell) => cell.selected)).toBe(false);
    expect(view.empty).toStrictEqual({
      text: t('battle.noItems'),
      box: { x: 20, y: 82, w: 688, h: 76 },
    });
    expect(view.info).toBeNull();
  });
});

describe('the floating item card', () => {
  it('is 320 wide with its bottom 8 px above the grid band', () => {
    const view = battleBagView(inputOf());
    expect(view.info).not.toBeNull();
    expect(view.info!.text).toBe(POTION_INFO);
    expect(view.info!.box).toStrictEqual({ x: 20, y: -13, w: 320, h: 87 });
    expect(view.info!.box.y + view.info!.box.h).toBe(view.grid.box.y - 8);
  });

  it('is 48 + 13 a wrapped line tall, 44 characters a line', () => {
    expect(infoLineCount('')).toBe(0);
    expect(infoLineCount('HELLO')).toBe(1);
    expect(infoLineCount('x'.repeat(44))).toBe(1);
    expect(infoLineCount('x'.repeat(45))).toBe(2);
    expect(infoLineCount(`${'x'.repeat(44)}\n${'x'.repeat(45)}`)).toBe(3);
    const one = battleBagView(inputOf({ info: { text: 'Potion' } }));
    expect(one.info!.box.h).toBe(48 + 13);
    const four = battleBagView(inputOf({ info: { text: `${'x'.repeat(45)}\n${'y'.repeat(45)}` } }));
    expect(four.info!.box.h).toBe(48 + 13 * 4);
  });
});

describe('cellPressIntent', () => {
  it('spends its stack on one press, whether the cell is selected or not', () => {
    const deselected = battleBagView(inputOf({ selected: 3 })).cells[0]!;
    expect(deselected.selected).toBe(false);
    expect(cellPressIntent(deselected)).toStrictEqual({ type: 'use', itemId: 'potion' });
    const selected = battleBagView(inputOf({ selected: 0 })).cells[0]!;
    expect(selected.selected).toBe(true);
    expect(cellPressIntent(selected)).toStrictEqual({ type: 'use', itemId: 'potion' });
  });

  it('only picks the cell itself when the cell is empty', () => {
    const view = battleBagView(inputOf());
    expect(view.cells[9]!.itemId).toBe('');
    expect(cellPressIntent(view.cells[9]!)).toStrictEqual({ type: 'select', index: 9 });
    const empty = battleBagView(inputOf({ rows: [] }));
    for (const cell of empty.cells) {
      expect(cellPressIntent(cell)).toStrictEqual({ type: 'select', index: cell.index });
    }
  });
});

describe('battleBagView purity', () => {
  it('clamps the selected index into the stacks on screen', () => {
    expect(battleBagView(inputOf({ selected: 9 })).cells.filter((cell) => cell.selected)).toHaveLength(
      1,
    );
    expect(battleBagView(inputOf({ selected: 9 })).cells[7]!.selected).toBe(true);
    expect(battleBagView(inputOf({ selected: -4 })).cells[0]!.selected).toBe(true);
    expect(battleBagView(inputOf({ selected: Number.NaN })).cells[0]!.selected).toBe(true);
    const empty = battleBagView(inputOf({ rows: [], selected: 5 }));
    expect(empty.cells.some((cell) => cell.selected)).toBe(false);
  });

  it('caps the stacks at the grid s capacity', () => {
    const many = Array.from({ length: 13 }, (_unused, index) => ({
      itemId: 'potion',
      name: 'Potion',
      count: index + 1,
    }));
    const view = battleBagView(inputOf({ rows: many }));
    expect(view.cells.slice(0, 10).map((cell) => cell.count)).toStrictEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it('returns deep-equal output for the same input, and mutates nothing', () => {
    const input = inputOf({ selected: 2, query: 'po', focused: true });
    const snapshot = JSON.stringify(input);
    const first = battleBagView(input);
    const second = battleBagView(input);
    expect(second).toStrictEqual(first);
    expect(second).not.toBe(first);
    expect(second.cells[0]).not.toBe(first.cells[0]);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('passes the card, the open flag, the query and the focus through untouched', () => {
    const closed = battleBagView(inputOf({ open: false, query: 'po', focused: true }));
    expect(closed.open).toBe(false);
    expect(closed.box).toStrictEqual(CARD);
    expect(closed.search.text).toBe('po');
    expect(closed.search.focused).toBe(true);
  });
});
