import { describe, expect, it } from 'vitest';
import fixture from '../../../../../design/fixtures/05c-battle-bag.json';
import screenSpec from '../../../../../design/screens/05c-battle-bag.json';
import { GAP_TOLERANCE, gapFor, gapIsEmpty, type ScreenSpec, type SpecBox } from '../../specGap';
import { buildView, slug } from '../../specGap.views/battle-bag';
import { battleBagBox, battleBagView, type BattleBagInput, type Rect } from './view';

/**
 * The `05c Battle · bag` frame measured against the battle bag's own view model: the adapter
 * that answers for this slug, the copy-only claim it can honestly make, the rect-by-rect
 * geometry that keeps that claim empty, and the copy `gapFor`'s fold cannot reach.
 */

type Spec = ScreenSpec & Readonly<{ caption: string }>;

const SPEC = screenSpec as Spec;
const DESKTOP = { width: 1280, height: 800 };

type FrameText = Readonly<{ name: string; characters: string }>;

const TEXT = screenSpec.text as unknown as readonly FrameText[];
const FIXTURE = fixture as unknown as Readonly<{ bag: BattleBagInput }>;

const fold = (line: string): string => line.trim().toUpperCase();

const textOf = (name: string): string => TEXT.find((node) => node.name === name)?.characters ?? '';

const frameBox = (name: string): SpecBox => {
  const box = SPEC.boxes.find((entry) => entry.name === name);
  if (box === undefined) throw new Error(`the frame draws no box named "${name}"`);
  return box;
};

const frameRects = (pattern: RegExp): readonly SpecBox[] =>
  SPEC.boxes.filter((entry) => entry.name !== null && pattern.test(entry.name));

const rectOf = (box: SpecBox): Rect => ({ x: box.x, y: box.y, w: box.width, h: box.height });

const card = (): Rect => battleBagBox(DESKTOP);

/** The scene's own view, at the card the scene lays out rather than the fixture's. */
const view = (): ReturnType<typeof battleBagView> => battleBagView({ ...FIXTURE.bag, card: card() });

/** A view rect translated by the card's origin: the model measures inside the card. */
const at = (rect: Rect): Rect => ({ x: card().x + rect.x, y: card().y + rect.y, w: rect.w, h: rect.h });

const delta = (shipped: Rect, frame: SpecBox): Readonly<Record<'dx' | 'dy' | 'dw' | 'dh', number>> => ({
  dx: shipped.x - frame.x,
  dy: shipped.y - frame.y,
  dw: shipped.w - frame.width,
  dh: shipped.h - frame.height,
});

const strings = (): readonly string[] => buildView(SPEC).strings;

describe('the 05c adapter', () => {
  it('answers for the board frame it is named after', () => {
    expect(slug).toBe('05c-battle-bag');
    expect(SPEC.slug).toBe(slug);
    expect(SPEC.caption).toBe('05c Battle · bag');
    expect(SPEC.boxes).toHaveLength(98);
    expect(SPEC.text).toHaveLength(26);
    expect(SPEC.colours).toHaveLength(29);
  });

  it('claims no box and no colour, and only the copy the frame carries', () => {
    const claimed = buildView(SPEC);
    expect(claimed.boxes).toStrictEqual([]);
    expect(claimed.colours).toStrictEqual([]);
    const board = new Set(TEXT.map((node) => fold(node.characters)));
    for (const line of claimed.strings) expect(board.has(fold(line)), line).toBe(true);
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
  it('docks the card at 676, 582, 564, 192 where the frame draws 664, 544, 576, 216', () => {
    expect(card()).toStrictEqual({ x: 676, y: 582, w: 564, h: 192 });
    expect(delta(card(), frameBox('battle menu'))).toStrictEqual({
      dx: 12,
      dy: 38,
      dw: -12,
      dh: -24,
    });
    expect(rectOf(frameBox('battle menu'))).toStrictEqual(rectOf(frameBox('battle menu group')));
    for (const step of Object.values(delta(card(), frameBox('battle menu')))) {
      expect(Math.abs(step)).toBeGreaterThan(GAP_TOLERANCE);
    }
  });

  it('draws two 120 × 26 chips at a 124 px pitch where the frame draws four 128 × 30 tabs at 136', () => {
    const tabs = frameRects(/^menu tab \d$/);
    expect(tabs.map((tab) => rectOf(tab))).toStrictEqual([
      { x: 684, y: 564, w: 128, h: 30 },
      { x: 820, y: 564, w: 128, h: 30 },
      { x: 956, y: 564, w: 128, h: 30 },
      { x: 1092, y: 564, w: 128, h: 30 },
    ]);
    expect(view().tabs.map((tab) => at(tab.box))).toStrictEqual([
      { x: 696, y: 598, w: 120, h: 26 },
      { x: 820, y: 598, w: 120, h: 26 },
    ]);
    expect(frameRects(/^menu tab \d$/).map((tab) => tab.x)).toStrictEqual([684, 820, 956, 1092]);
    expect(view().tabs[1]!.box.x - view().tabs[0]!.box.x).toBe(124);
    expect(delta(at(view().tabs[0]!.box), frameBox('menu tab 0'))).toStrictEqual({
      dx: 12,
      dy: 34,
      dw: -8,
      dh: -4,
    });
    for (const step of Object.values(delta(at(view().tabs[0]!.box), frameBox('menu tab 0')))) {
      expect(Math.abs(step)).toBeGreaterThan(GAP_TOLERANCE);
    }
  });

  it('moves the field and the grid with the card: 12 px right and 30 / 28 px down', () => {
    expect(view().search.box).toStrictEqual({ x: 20, y: 50, w: 524, h: 24 });
    expect(delta(at(view().search.box), frameBox('bag search'))).toStrictEqual({
      dx: 12,
      dy: 30,
      dw: 308,
      dh: 0,
    });
    expect(view().grid.box).toStrictEqual({ x: 20, y: 82, w: 524, h: 76 });
    expect(delta(at(view().cells[0]!.box), frameBox('item tile 1'))).toStrictEqual({
      dx: 174,
      dy: 28,
      dw: -93,
      dh: -17,
    });
  });

  it('lays ten 35 px cells at a 41 px pitch where the frame draws eight 128 × 52 tiles', () => {
    const panel = view();
    expect(panel.grid).toStrictEqual({
      box: { x: 20, y: 82, w: 524, h: 76 },
      columns: 5,
      rows: 2,
      cellW: 35,
      gap: 6,
    });
    expect(panel.cells.map((cell) => cell.box)).toStrictEqual([
      { x: 182, y: 82, w: 35, h: 35 },
      { x: 223, y: 82, w: 35, h: 35 },
      { x: 264, y: 82, w: 35, h: 35 },
      { x: 305, y: 82, w: 35, h: 35 },
      { x: 346, y: 82, w: 35, h: 35 },
      { x: 182, y: 123, w: 35, h: 35 },
      { x: 223, y: 123, w: 35, h: 35 },
      { x: 264, y: 123, w: 35, h: 35 },
      { x: 305, y: 123, w: 35, h: 35 },
      { x: 346, y: 123, w: 35, h: 35 },
    ]);
    const tiles = frameRects(/^item tile \d$/);
    expect(tiles).toHaveLength(8);
    expect(tiles.map((tile) => tile.width)).toStrictEqual(Array.from({ length: 8 }, () => 128));
    expect(tiles.map((tile) => tile.height)).toStrictEqual(Array.from({ length: 8 }, () => 52));
    expect(tiles.map((tile) => tile.x)).toStrictEqual([684, 820, 956, 1092, 684, 820, 956, 1092]);
    expect(tiles.map((tile) => tile.y)).toStrictEqual([636, 636, 636, 636, 696, 696, 696, 696]);
  });

  it('floats the 320 px item card above the grid, over the card’s own top edge', () => {
    const info = view().info;
    expect(info).not.toBeNull();
    expect(info!.box).toStrictEqual({ x: 20, y: -13, w: 320, h: 87 });
    expect(at(info!.box)).toStrictEqual({ x: 696, y: 569, w: 320, h: 87 });
    expect(delta(at(info!.box), frameBox('attack detail'))).toStrictEqual({
      dx: 32,
      dy: 197,
      dw: -256,
      dh: -73,
    });
    expect(delta(at(info!.box), frameBox('item icon'))).toStrictEqual({
      dx: 12,
      dy: 141,
      dw: 296,
      dh: 63,
    });
  });

  it('draws the selected line and the back control where the frame draws neither', () => {
    expect(view().detail.box).toStrictEqual({ x: 20, y: 164, w: 524, h: 20 });
    expect(at(view().detail.box)).toStrictEqual({ x: 696, y: 746, w: 524, h: 20 });
    expect(at(view().back.box)).toStrictEqual({ x: 710, y: 715, w: 36, h: 36 });
    expect(view().empty).toBeNull();
    expect(SPEC.boxes.some((entry) => entry.name === 'bag detail')).toBe(false);
    expect(SPEC.boxes.some((entry) => entry.name === 'bag back')).toBe(false);
  });
});

describe('the copy it claims', () => {
  it('claims the two pocket labels the fixture and the frame spell alike', () => {
    const labels = FIXTURE.bag.tabs.map((tab) => tab.label);
    expect(labels).toStrictEqual([textOf('filter label consumables'), textOf('filter label pokeballs')]);
    expect(view().tabs.map((tab) => tab.label)).toStrictEqual(labels);
    for (const label of labels) expect(strings()).toContain(label);
  });

  it('claims the field placeholder the frame draws as SEARCH ITEMS', () => {
    const frameLine = textOf('bag search placeholder');
    expect(frameLine).toBe('SEARCH ITEMS');
    const printed = view().search.placeholder;
    expect(fold(printed).startsWith(frameLine)).toBe(true);
    expect(strings()).toContain(frameLine);
  });

  it('claims the eight quantity badges the frame draws as item qty 1…8', () => {
    const frameLines = [1, 2, 3, 4, 5, 6, 7, 8].map((slot) => textOf(`item qty ${slot}`));
    const printed = view()
      .cells.filter((cell) => cell.itemId !== '')
      .map((cell) => `\u00d7${cell.count}`);
    expect(printed).toStrictEqual(frameLines);
    for (const line of frameLines) expect(strings()).toContain(line);
  });
});

describe('the copy it cannot claim', () => {
  it('prints Potion x3 where the frame keeps the name and the count apart', () => {
    expect(view().detail.text).toBe('Potion x3');
    expect(fold(view().detail.text)).not.toBe(fold(textOf('attack name')));
    expect(fold(view().detail.text)).not.toBe(fold(textOf('attack pp')));
    expect(strings()).not.toContain(view().detail.text);
  });

  it('leaves the stack names out, even the one the frame spells POTION as its card title', () => {
    const first = view().cells[0]!;
    expect(first.name).toBe('Potion');
    expect(fold(first.name)).toBe(fold(textOf('attack name')));
    expect(strings()).not.toContain(first.name);
  });

  it('leaves the three-line item card out: the frame draws its title and a two-line body', () => {
    const info = view().info!;
    expect(info.text.split('\n')).toHaveLength(3);
    expect(textOf('attack description').split('\n')).toHaveLength(2);
    expect(fold(info.text)).not.toBe(fold(textOf('attack description')));
    expect(strings()).not.toContain(info.text);
  });

  it('leaves the back glyph out: the frame draws no ◀', () => {
    expect(view().back.label).toBe('\u25c0');
    expect(strings()).not.toContain(view().back.label);
  });

  it('claims the pocket labels and the placeholder in the card’s draw order', () => {
    expect(strings().slice(0, 3)).toStrictEqual([
      textOf('filter label consumables'),
      textOf('filter label pokeballs'),
      textOf('bag search placeholder'),
    ]);
  });
});
