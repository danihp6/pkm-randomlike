import { describe, expect, it } from 'vitest';
import fixture from '../../../../../design/fixtures/03d-route-shop-buy.json';
import screenSpec from '../../../../../design/screens/03d-route-shop-buy.json';
import { t } from '../../../../i18n';
import { GAP_TOLERANCE, gapFor, gapIsEmpty, type ScreenSpec, type SpecBox } from '../../specGap';
import { buildView, slug } from '../../specGap.views/shop-buy';
import {
  shopPanelBox,
  shopPanelView,
  type Rect,
  type ShopIcon,
  type ShopInput,
  type ShopMode,
  type ShopPanelView,
} from './view';

/**
 * The `03d Route · shop · buy` frame measured against the Mart's own view model: the adapter
 * that answers for this slug, the two tab labels it claims, the geometry that keeps the empty
 * box claim honest, and the copy `gapFor`'s fold cannot reach.
 */

const SPEC = screenSpec as ScreenSpec;
const DESKTOP = { width: 1280, height: 800 };

const BUY = fixture.buy;
const NO_ICON: (itemId: string) => ShopIcon | null = () => null;

type FrameText = Readonly<{ name: string; characters: string }>;

const TEXT = screenSpec.text as unknown as readonly FrameText[];

const fold = (line: string): string => line.trim().toUpperCase();

const textOf = (name: string): string => TEXT.find((node) => node.name === name)?.characters ?? '';

const frameBox = (name: string): SpecBox => {
  const box = SPEC.boxes.find((entry) => entry.name === name);
  if (box === undefined) throw new Error(`the frame draws no box named "${name}"`);
  return box;
};

const rectOf = (box: SpecBox): Rect => ({
  x: box.x,
  y: box.y,
  w: box.width,
  h: box.height,
});

/** The fixture's block, as the `ShopInput` the scene module hands the view. */
function inputFrom(block: typeof BUY, mode: ShopMode): ShopInput {
  return {
    title: block.title,
    mode,
    rows: block.rows.map((row) => ({
      itemId: row.itemId,
      name: row.name,
      price: row.price,
      count: row.count,
      owned: row.owned,
      affordable: row.affordable,
      draggable: mode === 'buy' && row.affordable,
    })),
    scroll: block.scroll,
    selected: block.selected,
    money: block.money,
    message: block.message,
    empty: block.empty,
    open: true,
  };
}

const view = (): ShopPanelView => shopPanelView(inputFrom(BUY, 'buy'), DESKTOP, NO_ICON);

const at = (origin: Rect, rect: Rect): Rect => ({
  x: origin.x + rect.x,
  y: origin.y + rect.y,
  w: rect.w,
  h: rect.h,
});

const deltaOf = (shipped: Rect, frame: Rect): Rect => ({
  x: shipped.x - frame.x,
  y: shipped.y - frame.y,
  w: shipped.w - frame.w,
  h: shipped.h - frame.h,
});

describe('the 03d buy adapter', () => {
  it('answers for the board frame it is named after', () => {
    expect(slug).toBe('03d-route-shop-buy');
    expect(SPEC.slug).toBe(slug);
    expect(SPEC.boxes).toHaveLength(51);
    expect(SPEC.text).toHaveLength(25);
    expect(SPEC.colours).toHaveLength(19);
  });

  it('claims the two tab labels, and no box and no colour', () => {
    expect(buildView(SPEC)).toStrictEqual({ boxes: [], strings: ['BUY', 'SELL'], colours: [] });
  });

  it('claims only lines the board carries', () => {
    const carried = new Set(SPEC.text.map((node) => fold(node.characters)));
    for (const line of buildView(SPEC).strings) expect(carried.has(fold(line)), line).toBe(true);
  });

  it('reports an empty gap against its own spec', () => {
    expect(gapFor(buildView(SPEC), SPEC)).toStrictEqual({
      missing: [],
      moved: [],
      strings: [],
      colours: [],
    });
    expect(gapIsEmpty(gapFor(buildView(SPEC), SPEC))).toBe(true);
  });

  it('builds the same view twice: no clock, no rng, no store', () => {
    expect(buildView(SPEC)).toStrictEqual(buildView(SPEC));
  });
});

describe('the geometry the empty box claim rests on', () => {
  it('draws the board shell 704 × 336 at 288, 232 and the shipped card 640 × 540 at 320, 130', () => {
    expect(rectOf(frameBox('shop shell'))).toStrictEqual({ x: 288, y: 232, w: 704, h: 336 });
    expect(shopPanelBox(DESKTOP)).toStrictEqual({ x: 320, y: 130, w: 640, h: 540 });
    const delta = deltaOf(shopPanelBox(DESKTOP), rectOf(frameBox('shop shell')));
    expect(delta).toStrictEqual({ x: 32, y: -102, w: -64, h: 204 });
    for (const [axis, step] of Object.entries(delta)) {
      expect(Math.abs(step), axis).toBeGreaterThan(GAP_TOLERANCE);
    }
  });

  it('publishes the list window under three names: shop panel, its group and its grid viewport', () => {
    const expected = { x: 312, y: 364, w: 656, h: 164 };
    for (const name of ['shop panel', 'shop panel group', 'shop grid viewport']) {
      expect(rectOf(frameBox(name)), name).toStrictEqual(expected);
    }
  });

  it('draws sixteen 64 × 60 bag tiles at an 81 px / 72 px pitch inside that viewport', () => {
    expect(rectOf(frameBox('bag tile 1'))).toStrictEqual({ x: 12, y: 16, w: 64, h: 60 });
    expect(rectOf(frameBox('bag tile 9'))).toStrictEqual({ x: 12, y: 88, w: 64, h: 60 });
    expect(frameBox('bag tile 2').x - frameBox('bag tile 1').x).toBe(81);
    expect(frameBox('bag tile 9').y - frameBox('bag tile 1').y).toBe(72);
    expect(SPEC.boxes.filter((box) => /^bag tile \d+$/.test(box.name ?? ''))).toHaveLength(16);
  });

  it('draws a 600 × 320 list band, its first 588 × 40 row and the two 108 × 30 tabs', () => {
    const shipped = view();
    expect(shipped.list.box).toStrictEqual({ x: 20, y: 112, w: 600, h: 320 });
    expect(shipped.rows[0]!.box).toStrictEqual({ x: 26, y: 118, w: 588, h: 40 });
    expect(shipped.rows).toHaveLength(2);
    expect(shipped.highlight).toStrictEqual({ x: 12, y: 12, w: 616, h: 1 });
    expect(shipped.tabs.map((tab) => tab.box)).toStrictEqual([
      { x: 20, y: 70, w: 108, h: 30 },
      { x: 134, y: 70, w: 108, h: 30 },
    ]);
  });

  it('renders the fixture’s two BUY rows at ¥300 and ¥700', () => {
    const rows = view().rows;
    expect(rows.map((row) => row.name)).toStrictEqual(['10x Poké Ball', 'Potion']);
    expect(rows.map((row) => row.price)).toStrictEqual(['¥300', '¥700']);
  });

  it('keeps every candidate it measures outside the tolerance of the board’s box', () => {
    const shipped = view();
    const candidates: readonly Readonly<{ name: string; rect: Rect; frame: Rect; delta: Rect }>[] = [
      {
        name: 'shop shell',
        rect: shipped.box,
        frame: rectOf(frameBox('shop shell')),
        delta: { x: 32, y: -102, w: -64, h: 204 },
      },
      {
        name: 'shop panel',
        rect: at(shipped.box, shipped.list.box),
        frame: rectOf(frameBox('shop panel')),
        delta: { x: 28, y: -122, w: -56, h: 156 },
      },
      {
        name: 'shop panel highlight',
        rect: at(shipped.box, shipped.highlight),
        frame: rectOf(frameBox('shop panel highlight')),
        delta: { x: 8, y: -230, w: -16, h: 0 },
      },
      {
        name: 'tab buy',
        rect: at(shipped.box, shipped.tabs[0]!.box),
        frame: rectOf(frameBox('tab buy')),
        delta: { x: 28, y: -94, w: 42, h: 6 },
      },
      {
        name: 'tab sell',
        rect: at(shipped.box, shipped.tabs[1]!.box),
        frame: rectOf(frameBox('tab sell')),
        delta: { x: 76, y: -94, w: 42, h: 6 },
      },
    ];
    for (const candidate of candidates) {
      expect(deltaOf(candidate.rect, candidate.frame), candidate.name).toStrictEqual(
        candidate.delta,
      );
      expect(
        Math.max(
          Math.abs(candidate.delta.x),
          Math.abs(candidate.delta.y),
          Math.abs(candidate.delta.w),
          Math.abs(candidate.delta.h),
        ),
        candidate.name,
      ).toBeGreaterThan(GAP_TOLERANCE);
    }
    expect(buildView(SPEC).boxes).toStrictEqual([]);
  });
});

describe('the copy it cannot claim', () => {
  it('prints MART where the board’s title is SHOP', () => {
    expect(textOf('shop title')).toBe('SHOP');
    expect(view().title).toBe('MART');
    expect(fold(view().title)).not.toBe(fold(textOf('shop title')));
  });

  it('prints MONEY  ¥2480 where the board draws one line, $ 2,480', () => {
    expect(textOf('money')).toBe('$ 2,480');
    expect(view().money.text).toBe(t('mart.money', { amount: 2480 }));
    expect(view().money.text).toBe('MONEY  ¥2480');
    expect(fold(view().money.text)).not.toBe(fold(textOf('money')));
  });

  it('prints ¥300 where the board’s first quantity is $300', () => {
    expect(textOf('bag qty 1')).toBe('$300');
    expect(view().rows[0]!.price).toBe('¥300');
    expect(fold(view().rows[0]!.price)).not.toBe(fold(textOf('bag qty 1')));
  });

  it('prints x2 for an owned row where the board draws no count at all', () => {
    expect(view().rows.map((row) => row.owned)).toStrictEqual(['', 'x2']);
    expect(TEXT.some((node) => /^[X×]\d/.test(fold(node.characters)))).toBe(false);
  });

  it('prints a message, a hint and a ✕ the board never draws', () => {
    const carried = new Set(SPEC.text.map((node) => fold(node.characters)));
    for (const line of [view().message.text, view().hint.text, view().close.label, view().title]) {
      expect(line).not.toBe('');
      expect(carried.has(fold(line)), line).toBe(false);
    }
    expect(view().empty).toBeNull();
  });
});
