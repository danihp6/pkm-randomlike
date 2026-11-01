import { describe, expect, it } from 'vitest';
import fixture from '../../../../../design/fixtures/03e-route-shop-sell.json';
import screenSpec from '../../../../../design/screens/03e-route-shop-sell.json';
import { t } from '../../../../i18n';
import { GAP_TOLERANCE, gapFor, gapIsEmpty, type ScreenSpec, type SpecBox } from '../../specGap';
import { buildView, slug } from '../../specGap.views/shop-sell';
import { shopPanelBox, shopPanelView, type Rect, type ShopInput, type ShopPanelView } from './view';

/**
 * The `03e Route · shop · sell` frame measured against the Mart's own view model: the adapter
 * that answers for this slug, the two strings it claims on the SELL tab, the copy and the
 * boxes it cannot claim, and the geometry that keeps the empty box claim honest.
 */

const SPEC = screenSpec as ScreenSpec;
const DESKTOP = { width: 1280, height: 800 };

type FrameText = Readonly<{ name: string; characters: string }>;

const TEXT = screenSpec.text as unknown as readonly FrameText[];

type SellRow = Readonly<{
  index: number;
  itemId: string;
  name: string;
  price: number;
  count: number;
  owned: number;
  affordable: boolean;
}>;

type SellBlock = Readonly<{
  title: string;
  money: number;
  message: string;
  hint: string;
  empty: string;
  rows: readonly SellRow[];
  selected: number;
  scroll: number;
}>;

const SELL = (fixture as unknown as Readonly<{ sell: SellBlock }>).sell;

const fold = (line: string): string => line.trim().toUpperCase();

const textOf = (name: string): string => TEXT.find((node) => node.name === name)?.characters ?? '';

const frameBox = (name: string): SpecBox => {
  const box = SPEC.boxes.find((entry) => entry.name === name);
  if (box === undefined) throw new Error(`the frame draws no box named "${name}"`);
  return box;
};

const rectOf = (box: SpecBox): Readonly<{ x: number; y: number; width: number; height: number }> => ({
  x: box.x,
  y: box.y,
  width: box.width,
  height: box.height,
});

/** Where a panel-relative rect lands once the card is mounted at its own viewport box. */
const at = (origin: Rect, rect: Rect): Rect => ({
  x: origin.x + rect.x,
  y: origin.y + rect.y,
  w: rect.w,
  h: rect.h,
});

const deltaOf = (shipped: Rect, frame: SpecBox): Readonly<Record<string, number>> => ({
  dx: shipped.x - frame.x,
  dy: shipped.y - frame.y,
  dw: shipped.w - frame.width,
  dh: shipped.h - frame.height,
});

/** The card on its SELL tab, rebuilt here exactly as the adapter's own `inputFrom` maps it. */
const view = (): ShopPanelView => {
  const input: ShopInput = {
    title: SELL.title,
    mode: 'sell',
    rows: SELL.rows.map((row) => ({
      itemId: row.itemId,
      name: row.name,
      price: row.price,
      count: row.count,
      owned: row.owned,
      affordable: row.affordable,
      draggable: false,
    })),
    scroll: SELL.scroll,
    selected: SELL.selected,
    money: SELL.money,
    message: SELL.message,
    empty: SELL.empty,
    open: true,
  };
  return shopPanelView(input, DESKTOP, () => null);
};

/** Every line the card prints on the SELL tab, before the board filters any of them out. */
const printed = (): readonly string[] => {
  const card = view();
  return [
    ...card.tabs.map((tab) => tab.label),
    card.title,
    card.money.text,
    ...card.rows.flatMap((row) => [row.name, row.price, row.owned]),
    card.message.text,
    card.hint.text,
    card.close.label,
    card.empty?.text ?? '',
  ].filter((line) => line !== '');
};

describe('the 03e adapter', () => {
  it('answers for the board frame it is named after', () => {
    expect(slug).toBe('03e-route-shop-sell');
    expect(SPEC.slug).toBe(slug);
    expect(SPEC.boxes).toHaveLength(51);
    expect(TEXT).toHaveLength(25);
    expect(SPEC.colours).toHaveLength(19);
  });

  it('claims the two tabs and no box and no colour', () => {
    expect(buildView(SPEC)).toStrictEqual({ boxes: [], strings: ['BUY', 'SELL'], colours: [] });
  });

  it('claims the two labels the frame draws on its chips', () => {
    expect([textOf('tab label buy'), textOf('tab label sell')]).toStrictEqual(['BUY', 'SELL']);
    expect(buildView(SPEC).strings).toStrictEqual([textOf('tab label buy'), textOf('tab label sell')]);
  });

  it('prints nothing the board does not carry', () => {
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
  it('draws the shipped card 32 right and 102 up from the board shell, and 204 px taller', () => {
    expect(rectOf(frameBox('shop shell'))).toStrictEqual({
      x: 288,
      y: 232,
      width: 704,
      height: 336,
    });
    const shipped = shopPanelBox(DESKTOP);
    expect(shipped).toStrictEqual({ x: 320, y: 130, w: 640, h: 540 });
    expect(deltaOf(shipped, frameBox('shop shell'))).toStrictEqual({
      dx: 32,
      dy: -102,
      dw: -64,
      dh: 204,
    });
    for (const [axis, value] of Object.entries(deltaOf(shipped, frameBox('shop shell')))) {
      expect(Math.abs(value), axis).toBeGreaterThan(GAP_TOLERANCE);
    }
  });

  it('draws the board list window as one rect under three names, and the card no such rect', () => {
    const rect = { x: 312, y: 364, width: 656, height: 164 };
    for (const name of ['bag panel', 'bag panel group', 'bag grid viewport']) {
      expect(rectOf(frameBox(name)), name).toStrictEqual(rect);
    }
    expect(SPEC.boxes.some((box) => box.name === 'shop panel')).toBe(false);
    expect(SPEC.boxes.some((box) => box.name === 'shop panel highlight')).toBe(false);

    const card = view();
    expect(card.list.box).toStrictEqual({ x: 20, y: 112, w: 600, h: 320 });
    expect(deltaOf(at(card.box, card.list.box), frameBox('bag panel'))).toStrictEqual({
      dx: 28,
      dy: -122,
      dw: -56,
      dh: 156,
    });
  });

  it('draws sixteen 64 × 60 tiles at an 81 px / 72 px pitch, local to the grid viewport', () => {
    expect(rectOf(frameBox('bag tile 1'))).toStrictEqual({ x: 12, y: 16, width: 64, height: 60 });
    expect(rectOf(frameBox('bag tile 9'))).toStrictEqual({ x: 12, y: 88, width: 64, height: 60 });
    const firstRow = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => frameBox(`bag tile ${n}`));
    expect(firstRow.map((tile) => tile.y)).toStrictEqual([16, 16, 16, 16, 16, 16, 16, 16]);
    expect(firstRow.slice(1).map((tile, index) => tile.x - firstRow[index]!.x)).toStrictEqual([
      81, 81, 81, 81, 81, 81, 81,
    ]);
    expect(frameBox('bag tile 9').y - firstRow[0]!.y).toBe(72);
    expect(Array.from({ length: 16 }, (_, i) => frameBox(`bag tile ${i + 1}`))).toHaveLength(16);
  });

  it('draws seven 588 × 40 rows of the fixture’s eight, where the board draws tiles', () => {
    expect(SELL.rows).toHaveLength(8);
    const card = view();
    expect(card.rows.map((row) => row.index)).toStrictEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(card.rows[0]!.box).toStrictEqual({ x: 26, y: 118, w: 588, h: 40 });
    expect(at(card.box, card.rows[0]!.box)).toStrictEqual({ x: 346, y: 248, w: 588, h: 40 });
    expect(at(card.box, card.rows[1]!.box)).toStrictEqual({ x: 346, y: 292, w: 588, h: 40 });
    expect(card.rows[0]!.name).toBe('Potion');
    expect(card.rows[0]!.price).toBe('¥150');
    expect(card.rows[0]!.owned).toBe('x3');
    expect(card.scroll).toBe(0);
  });

  it('hangs its highlight 12 px inside its own top edge, under the board’s bag name', () => {
    const card = view();
    expect(card.highlight).toStrictEqual({ x: 12, y: 12, w: 616, h: 1 });
    expect(at(card.box, card.highlight)).toStrictEqual({ x: 332, y: 142, w: 616, h: 1 });
    expect(rectOf(frameBox('bag panel highlight'))).toStrictEqual({
      x: 324,
      y: 372,
      width: 632,
      height: 1,
    });
  });

  it('draws two 108 × 30 tabs at a 114 px pitch where the board draws 66 × 24 chips', () => {
    const card = view();
    expect(card.tabs.map((tab) => tab.box)).toStrictEqual([
      { x: 20, y: 70, w: 108, h: 30 },
      { x: 134, y: 70, w: 108, h: 30 },
    ]);
    expect(deltaOf(at(card.box, card.tabs[0]!.box), frameBox('tab buy'))).toStrictEqual({
      dx: 28,
      dy: -94,
      dw: 42,
      dh: 6,
    });
    expect(deltaOf(at(card.box, card.tabs[1]!.box), frameBox('tab sell'))).toStrictEqual({
      dx: 76,
      dy: -94,
      dw: 42,
      dh: 6,
    });
    expect(card.tabs[1]!.active).toBe(true);
    expect(card.tabs[0]!.active).toBe(false);
  });

  it('claims no box even by name, so a card moved onto the board would claim one', () => {
    const card = view();
    const candidates: readonly Readonly<{ name: string; rect: Rect }>[] = [
      { name: 'shop shell', rect: card.box },
      { name: 'bag panel', rect: at(card.box, card.list.box) },
      { name: 'bag panel highlight', rect: at(card.box, card.highlight) },
      { name: 'tab buy', rect: at(card.box, card.tabs[0]!.box) },
      { name: 'tab sell', rect: at(card.box, card.tabs[1]!.box) },
    ];
    for (const candidate of candidates) {
      const delta = deltaOf(candidate.rect, frameBox(candidate.name));
      const off = Object.values(delta).some((value) => Math.abs(value) > GAP_TOLERANCE);
      expect(off, `${candidate.name}: ${JSON.stringify(delta)}`).toBe(true);
    }
    expect(buildView(SPEC).boxes).toStrictEqual([]);
  });
});

describe('what the view cannot claim', () => {
  it('prints MART where the board draws SHOP, and the board’s title is not the card’s', () => {
    expect(textOf('shop title')).toBe('SHOP');
    expect(view().title).toBe('MART');
    expect(fold(view().title)).not.toBe(fold(textOf('shop title')));
    expect(buildView(SPEC).strings).not.toContain('MART');
  });

  it('prints MONEY with two spaces and a ¥ where the board draws one $ line', () => {
    expect(SELL.money).toBe(2480);
    expect(view().money.text).toBe(t('mart.money', { amount: 2480 }));
    expect(view().money.text).toBe('MONEY  ¥2480');
    expect(textOf('money')).toBe('$ 2,480');
    expect(fold(view().money.text)).not.toBe(fold(textOf('money')));
    expect(printed()).toContain('MONEY  ¥2480');
    expect(buildView(SPEC).strings).not.toContain('MONEY  ¥2480');
  });

  it('prints a row’s price and its owned count as two fields, where the board joins them', () => {
    expect(textOf('bag qty 1')).toBe('×3 · $150');
    expect(view().rows[0]!.price).toBe('¥150');
    expect(view().rows[0]!.owned).toBe('x3');
    expect(fold('¥150')).not.toBe(fold(textOf('bag qty 1')));
    expect(fold('x3')).not.toBe(fold('×'));
    expect(buildView(SPEC).strings).not.toContain('¥150');
    expect(buildView(SPEC).strings).not.toContain('x3');
  });

  it('draws no slot counter, no search field and no category chip', () => {
    expect(textOf('bag slots')).toBe('16/20');
    expect(Object.keys(view())).not.toContain('slots');
    expect(printed().map(fold)).not.toContain(fold('16/20'));
    expect(printed().map(fold)).not.toContain(fold(textOf('bag search placeholder')));
    for (const name of ['filter label consumables', 'filter label pokeballs', 'filter label held']) {
      expect(printed().map(fold), name).not.toContain(fold(textOf(name)));
    }
  });

  it('prints the message, the hint and the ✕ the board never draws', () => {
    const card = view();
    expect(card.message.text).toBe('What would you like to sell?');
    expect(card.hint.text).toBe('Drag a row onto the bag or a Pokémon.');
    expect(card.close.label).toBe('✕');
    const carried = new Set(SPEC.text.map((node) => fold(node.characters)));
    for (const line of [card.message.text, card.hint.text, card.close.label]) {
      expect(carried.has(fold(line)), line).toBe(false);
    }
    const strings = buildView(SPEC).strings;
    for (const line of [card.message.text, card.hint.text, card.close.label]) {
      expect(strings).not.toContain(line);
    }
  });
});
