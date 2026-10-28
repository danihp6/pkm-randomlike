import { describe, expect, it, vi } from 'vitest';
import { t } from '../../../../i18n';
import { itemText } from '../../../../i18n/content';
import type { HudBagRow, HudState } from '../../state';
import {
  BAG_CAP,
  BAG_GRID_CELL,
  BAG_GRID_COLS,
  BAG_GRID_GAP,
  BAG_INFO_W,
  BAG_SEARCH_H,
  BAG_TAB_GAP,
  BAG_TAB_H,
  BAG_TAB_W,
  bagPanelBox,
  bagPanelView,
  initialBagPanelUi,
  type BagIconResolver,
  type BagPanelUi,
} from './index';

// No catalogue row wraps to three lines, so the growth rule's 120-character case
// arrives through a stub of the one seam the card reads its body from.
const WRAPPED = vi.hoisted(() => ({
  textOf: {
    wrapsixtychars: 'x'.repeat(60),
    wraponehundredtwenty: 'x'.repeat(120),
  } as Readonly<Record<string, string>>,
}));

vi.mock('../../../../i18n/content', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../i18n/content')>();
  return {
    ...actual,
    itemText: (id: string): string => WRAPPED.textOf[id] ?? actual.itemText(id),
  };
});

const CONSUMABLES: readonly HudBagRow[] = [
  { itemId: 'potion', name: 'Potion', count: 3, category: 'consumable' },
  { itemId: 'superpotion', name: 'Super Potion', count: 1, category: 'consumable' },
];

const STATE: HudState = {
  party: [],
  bag: [{ itemId: 'pokeball', name: 'Poké Ball', count: 5, category: 'ball' }, ...CONSUMABLES],
  money: 2480,
  route: null,
  battle: null,
  notice: null,
};

const CONSUMABLE_UI: BagPanelUi = { pocket: 'consumable', cursor: 0, query: '' };
const ICON = { url: 'atlas.png', size: 24, x: 24, y: 0 };
const stub: BagIconResolver = () => ICON;
const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

function view(ui: BagPanelUi = CONSUMABLE_UI, state: HudState = STATE) {
  return bagPanelView(state, ui, DESKTOP, stub);
}

function bagOf(count: number): HudState {
  return {
    ...STATE,
    bag: Array.from({ length: count }, (_, i) => ({
      itemId: `item${i}`,
      name: `Item ${i}`,
      count: i + 1,
      category: 'consumable' as const,
    })),
  };
}

describe('bagPanelBox', () => {
  it('sits at the shipped rect at both QA viewports', () => {
    expect(bagPanelBox(DESKTOP)).toEqual({ x: 928, y: 422, w: 344, h: 308 });
    expect(bagPanelBox(PHONE)).toEqual({ x: 38, y: 422, w: 344, h: 308 });
  });

  it('clamps the card to a screen narrower than the shipped panel', () => {
    expect(bagPanelBox({ width: 320, height: 800 })).toEqual({ x: 8, y: 422, w: 304, h: 308 });
  });

  it('falls back to the shipped width for an unmeasurable viewport', () => {
    expect(bagPanelBox({ width: Number.NaN, height: Number.NaN })).toEqual({
      x: 8,
      y: 422,
      w: 344,
      h: 308,
    });
  });
});

describe('bagPanelView', () => {
  it('paints the shipped card, highlight, chip and search rects', () => {
    const panel = view();
    expect(panel.open).toBe(true);
    expect(panel.box).toEqual({ x: 928, y: 422, w: 344, h: 308 });
    expect(panel.highlight).toEqual({ x: 12, y: 12, w: 320, h: 1 });
    expect(panel.chip).toEqual({ letter: 'I', box: { x: 0, y: 0, w: 24, h: 24 } });
    expect(panel.search.box).toEqual({ x: 20, y: 50, w: 304, h: 24 });
    expect(panel.search.placeholder).toBe(t('hud.searchItems'));
    expect(panel.search.value).toBe('');
  });

  it('lays the five pocket tabs out from the content left, at a 59 px pitch', () => {
    const panel = view();
    expect(panel.tabs.map((tab) => tab.category)).toEqual([
      'equipment',
      'consumable',
      'machine',
      'ball',
      'valuable',
    ]);
    panel.tabs.forEach((tab, i) => {
      expect(tab.box).toEqual({ x: 30 + i * 59, y: 16, w: 55, h: 26 });
      expect(tab.label).toBe(t(`bag.${tab.category}`));
      expect(tab.active).toBe(tab.category === 'consumable');
    });
  });

  it('gives the grid the shipped band and the first cells of its 5 × 3 layout', () => {
    const panel = view();
    expect(panel.grid.band).toEqual({ x: 20, y: 82, w: 304, h: 180 });
    expect(panel.grid.columns).toBe(5);
    expect(panel.grid.gap).toBe(6);
    expect(panel.grid.cell).toBe(56);
    expect(panel.tiles.map((tile) => tile.box)).toEqual([
      { x: 20, y: 82, w: 56, h: 56 },
      { x: 82, y: 82, w: 56, h: 56 },
    ]);
  });

  it('prints the stack name, its x-count and the resolver icon', () => {
    const panel = view();
    expect(panel.tiles.map((tile) => [tile.index, tile.itemId, tile.name, tile.count])).toEqual([
      [0, 'potion', 'Potion', 'x3'],
      [1, 'superpotion', 'Super Potion', 'x1'],
    ]);
    expect(panel.tiles.map((tile) => tile.selected)).toEqual([true, false]);
    expect(panel.tiles[0]!.icon).toEqual(ICON);
    expect(bagPanelView(STATE, CONSUMABLE_UI, DESKTOP, () => null).tiles[0]!.icon).toBeNull();
  });

  it('marks the cursor stack selected, clamped to the drawn list', () => {
    expect(view({ ...CONSUMABLE_UI, cursor: 1 }).tiles.map((tile) => tile.selected)).toEqual([
      false,
      true,
    ]);
    expect(view({ ...CONSUMABLE_UI, cursor: 99 }).tiles.map((tile) => tile.selected)).toEqual([
      false,
      true,
    ]);
    expect(view({ ...CONSUMABLE_UI, cursor: -4 }).tiles[0]!.selected).toBe(true);
    expect(view({ ...CONSUMABLE_UI, cursor: Number.NaN }).tiles[0]!.selected).toBe(true);
  });

  it('draws the money footer under the grid', () => {
    const panel = view();
    expect(panel.footer.rule).toEqual({ x: 20, y: 274, w: 304, h: 1 });
    expect(panel.footer.box.y).toBe(274);
    expect(panel.footer.label).toBe(t('hud.money'));
    expect(panel.footer.value).toBe('2480');
    expect(view(CONSUMABLE_UI, { ...STATE, money: null }).footer.value).toBe('');
  });

  it('floats the description card left of the panel at the shipped width', () => {
    const panel = view();
    expect(panel.info).not.toBeNull();
    expect(panel.info!.title).toBe('Potion');
    expect(panel.info!.box).toEqual({ x: 640, y: 504, w: BAG_INFO_W, h: 56 });
    expect(view({ ...CONSUMABLE_UI, pocket: 'valuable' }).info).toBeNull();
  });

  it('filters by pocket before anything else', () => {
    expect(view({ ...CONSUMABLE_UI, pocket: 'ball' }).tiles.map((tile) => tile.itemId)).toEqual([
      'pokeball',
    ]);
    expect(view({ ...CONSUMABLE_UI, pocket: 'equipment' }).tiles).toEqual([]);
  });

  it('filters by the query, trimmed and case-insensitively, against the name', () => {
    expect(view({ ...CONSUMABLE_UI, query: '  SUPER ' }).tiles.map((tile) => tile.itemId)).toEqual([
      'superpotion',
    ]);
    expect(view({ ...CONSUMABLE_UI, query: 'POTION' }).tiles).toHaveLength(2);
    expect(view({ ...CONSUMABLE_UI, query: 'nothing' }).tiles).toEqual([]);
  });

  it('stops the drawn list at BAG_CAP and keeps the extra stacks out of the grid', () => {
    const panel = bagPanelView(bagOf(16), CONSUMABLE_UI, DESKTOP, stub);
    expect(BAG_CAP).toBe(15);
    expect(panel.tiles).toHaveLength(15);
    expect(panel.tiles[14]!.index).toBe(14);
    expect(panel.tiles[14]!.count).toBe('x15');
  });

  it('is pure: the same input deep-equals, and the state is never mutated', () => {
    const before = JSON.stringify(STATE);
    expect(JSON.stringify(view())).toBe(JSON.stringify(view()));
    view();
    expect(JSON.stringify(STATE)).toBe(before);
  });

  it('starts on the equipment pocket with the cursor and the query empty', () => {
    expect(initialBagPanelUi()).toEqual({ pocket: 'equipment', cursor: 0, query: '' });
  });
});

describe('the description card body', () => {
  function infoOf(itemId: string | null) {
    const state: HudState = {
      ...STATE,
      bag: [{ itemId: itemId as unknown as string, name: 'Stack', count: 1, category: 'consumable' }],
    };
    const panel = bagPanelView(state, CONSUMABLE_UI, DESKTOP, stub);
    expect(panel.info).not.toBeNull();
    return panel.info!;
  }

  it("prints the selected stack's own text and keeps the one-line floor and rect", () => {
    const info = view().info!;
    expect(info.title).toBe('Potion');
    expect(info.text).toBe(itemText('potion'));
    expect(info.text.length).toBeLessThanOrEqual(44);
    expect(info.box).toEqual({ x: 640, y: 504, w: BAG_INFO_W, h: 56 });
  });

  it('keeps the 56 px floor for the second one-line potion', () => {
    const info = view({ ...CONSUMABLE_UI, cursor: 1 }).info!;
    expect(info.text).toBe(itemText('superpotion'));
    expect(info.box.h).toBe(56);
    expect(info.box.x).toBe(640);
    expect(info.box.w).toBe(BAG_INFO_W);
  });

  it('grows 13 px per wrapped line over the 56 px floor', () => {
    const two = infoOf('wrapsixtychars');
    expect(two.text).toHaveLength(60);
    expect(two.box).toEqual({ x: 640, y: 499, w: BAG_INFO_W, h: 61 });
    const three = infoOf('wraponehundredtwenty');
    expect(three.text).toHaveLength(120);
    expect(three.box).toEqual({ x: 640, y: 486, w: BAG_INFO_W, h: 74 });
  });

  it('wraps a real two-line catalogue row', () => {
    const info = infoOf('sitrusberry');
    expect(info.text).toBe(itemText('sitrusberry'));
    expect(info.text).toHaveLength(60);
    expect(info.box.h).toBe(61);
  });

  it('draws the title only for a stack with no text', () => {
    const none = infoOf(null);
    expect(none.text).toBe('');
    expect(none.box.h).toBe(56);
    const unknown = infoOf('nonsense');
    expect(unknown.text).toBe('');
    expect(unknown.box).toEqual({ x: 640, y: 504, w: BAG_INFO_W, h: 56 });
  });
});

describe('the mirrored Phaser constants', () => {
  it('equal the literals the scene module lays the bag out from', () => {
    expect(BAG_TAB_W).toBe(55);
    expect(BAG_TAB_H).toBe(26);
    expect(BAG_TAB_GAP).toBe(4);
    expect(BAG_GRID_COLS).toBe(5);
    expect(BAG_GRID_GAP).toBe(6);
    expect(BAG_GRID_CELL).toBe(56);
    expect(BAG_SEARCH_H).toBe(24);
    expect(BAG_INFO_W).toBe(280);
    expect(BAG_CAP).toBe(15);
  });
});
