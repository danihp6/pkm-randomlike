import { describe, expect, it } from 'vitest';
import fixture from '../../../../../design/fixtures/03f-panels-reward-item.json';
import screenSpec from '../../../../../design/screens/03f-panels-reward-item.json';
import { gapFor, gapIsEmpty, GAP_TOLERANCE, type ScreenSpec, type SpecBox } from '../../specGap';
import { buildView, slug } from '../../specGap.views/rewards-item';
import { rewardsPanelBox, rewardsPanelView, type RewardsInput } from './view';

/**
 * The `03f Panels · reward item` frame measured against the reward card's own view model: the
 * adapter that answers for this slug, the five boxes it claims to the pixel, the nine lines of
 * the board's copy it prints, and the one box (`item icon 1…3`) it cannot name because the view
 * carries an atlas cell instead of a rect.
 */

const SPEC = screenSpec as ScreenSpec;
const DESKTOP = { width: 1280, height: 800 };

type FrameText = Readonly<{
  name: string;
  characters: string;
  x: number;
  y: number;
  width: number;
  height: number;
}>;

type ItemRow = Readonly<{
  index: number;
  itemId: string;
  iconFrame: number;
  label: string;
  description: string;
}>;

type ItemBlock = Readonly<{
  title: string;
  choose: string;
  armed: number;
  open: boolean;
  rows: readonly ItemRow[];
}>;

const TEXT = screenSpec.text as unknown as readonly FrameText[];
const BLOCK = fixture.item as unknown as ItemBlock;

const BOXES: readonly Readonly<{ name: string; x: number; y: number; w: number; h: number }>[] = [
  { name: 'reward panel', x: 360, y: 196, w: 560, h: 342 },
  { name: 'panel highlight', x: 372, y: 208, w: 536, h: 1 },
  { name: 'row 1', x: 380, y: 274, w: 520, h: 76 },
  { name: 'row 2', x: 380, y: 358, w: 520, h: 76 },
  { name: 'row 3', x: 380, y: 442, w: 520, h: 76 },
];

const STRINGS: readonly string[] = [
  'MINI-BOSS REWARD',
  'Choose one.',
  '×',
  'Charcoal',
  'Powers up Fire-type moves.',
  'Hard Stone',
  'Powers up Rock-type moves.',
  'Miracle Seed',
  'Powers up Grass-type moves.',
];

const fold = (line: string): string => line.trim().toUpperCase();

const textOf = (name: string): string => TEXT.find((node) => node.name === name)?.characters ?? '';

const nodeOf = (name: string): FrameText => {
  const node = TEXT.find((entry) => entry.name === name);
  if (node === undefined) throw new Error(`the frame draws no text node named "${name}"`);
  return node;
};

const frameBox = (name: string): SpecBox => {
  const box = SPEC.boxes.find((entry) => entry.name === name);
  if (box === undefined) throw new Error(`the frame draws no box named "${name}"`);
  return box;
};

const rectOf = (box: SpecBox): Readonly<{ x: number; y: number; w: number; h: number }> => ({
  x: box.x,
  y: box.y,
  w: box.width,
  h: box.height,
});

/** The fixture's item block as the scene module's input: the model writes the boxes itself. */
const INPUT: RewardsInput = {
  title: BLOCK.title,
  choose: BLOCK.choose,
  rows: BLOCK.rows.map((row) => ({
    index: row.index,
    kind: 'item' as const,
    label: row.label,
    description: row.description,
    icon: null,
    armed: false,
    box: { x: 0, y: 0, w: 0, h: 0 },
  })),
  armed: BLOCK.armed,
  open: BLOCK.open,
};

const view = (): ReturnType<typeof rewardsPanelView> => rewardsPanelView(INPUT, DESKTOP);

/** A panel-relative rect as the page shows it. */
const absolute = (
  origin: Readonly<{ x: number; y: number }>,
  rect: Readonly<{ x: number; y: number; w: number; h: number }>,
): Readonly<{ x: number; y: number; w: number; h: number }> => ({
  x: origin.x + rect.x,
  y: origin.y + rect.y,
  w: rect.w,
  h: rect.h,
});

describe('the 03f adapter', () => {
  it('answers for the board frame it is named after', () => {
    expect(slug).toBe('03f-panels-reward-item');
    expect(SPEC.slug).toBe(slug);
    expect(SPEC.boxes).toHaveLength(10);
    expect(SPEC.text).toHaveLength(9);
    expect(SPEC.colours).toHaveLength(10);
  });

  it('claims the card, its highlight and its three rows at the board’s own rects', () => {
    expect(buildView(SPEC)).toStrictEqual({ boxes: BOXES, strings: STRINGS, colours: [] });
  });

  it('claims exactly the nine lines the card prints', () => {
    expect(STRINGS).toHaveLength(9);
    expect(buildView(SPEC).strings).toStrictEqual(STRINGS);
    const board = new Set(SPEC.text.map((node) => fold(node.characters)));
    for (const line of STRINGS) expect(board.has(fold(line)), line).toBe(true);
  });

  it('reports no gap against its own spec', () => {
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

  it('reads the spec only as a structural selector, never as the answer', () => {
    const empty: ScreenSpec = { ...SPEC, boxes: [], text: [], colours: [] };
    const built = buildView(empty);
    expect(built.boxes).toStrictEqual([]);
    expect(built.strings).toStrictEqual([]);
    expect(built.colours).toStrictEqual([]);
  });
});

describe('the geometry the claim rests on', () => {
  it('docks the shipped card on the board’s own card, so every delta is zero', () => {
    expect(rewardsPanelBox(DESKTOP)).toStrictEqual({ x: 360, y: 196, w: 560, h: 342 });
    const frame = frameBox('reward panel');
    expect(rectOf(frame)).toStrictEqual({ x: 360, y: 196, w: 560, h: 342 });
    const shipped = rewardsPanelBox(DESKTOP);
    const delta = {
      dx: shipped.x - frame.x,
      dy: shipped.y - frame.y,
      dw: shipped.w - frame.width,
      dh: shipped.h - frame.height,
    };
    expect(delta).toStrictEqual({ dx: 0, dy: 0, dw: 0, dh: 0 });
    for (const step of Object.values(delta)) {
      expect(Math.abs(step)).toBeLessThanOrEqual(GAP_TOLERANCE);
    }
  });

  it('hangs the highlight 12 px inside the card’s top edge, on the board’s line', () => {
    expect(rectOf(frameBox('panel highlight'))).toStrictEqual({ x: 372, y: 208, w: 536, h: 1 });
    const panel = view();
    expect(panel.highlight).toStrictEqual({ x: 12, y: 12, w: 536, h: 1 });
    expect(absolute(panel.box, panel.highlight)).toStrictEqual({ x: 372, y: 208, w: 536, h: 1 });
  });

  it('lays three 520 × 76 rows at an 84 px pitch, on the board’s own slots', () => {
    const panel = view();
    expect(panel.rows.map((row) => row.box)).toStrictEqual([
      { x: 20, y: 78, w: 520, h: 76 },
      { x: 20, y: 162, w: 520, h: 76 },
      { x: 20, y: 246, w: 520, h: 76 },
    ]);
    expect(panel.rows.map((row) => absolute(panel.box, row.box))).toStrictEqual([
      rectOf(frameBox('row 1')),
      rectOf(frameBox('row 2')),
      rectOf(frameBox('row 3')),
    ]);
    expect(panel.rows.slice(1).map((row, index) => row.box.y - panel.rows[index]!.box.y)).toStrictEqual([
      84, 84,
    ]);
  });
});

describe('what the card cannot claim', () => {
  it('draws the close as a text node, so it is claimed as the string only', () => {
    const close = nodeOf('close');
    expect({ x: close.x, y: close.y, width: close.width, height: close.height }).toStrictEqual({
      x: 876,
      y: 206,
      width: 24,
      height: 24,
    });
    const panel = view();
    expect(absolute(panel.box, panel.close.box)).toStrictEqual({ x: 876, y: 206, w: 24, h: 24 });
    expect(SPEC.boxes.some((box) => box.name === 'close')).toBe(false);
    expect(buildView(SPEC).boxes.some((box) => box.name === 'close')).toBe(false);
    expect(buildView(SPEC).strings).toContain('×');
  });

  it('draws the title and the choose line as text nodes too', () => {
    const title = nodeOf('panel title');
    const choose = nodeOf('choose line');
    expect({ x: title.x, y: title.y, width: title.width, height: title.height }).toStrictEqual({
      x: 380,
      y: 212,
      width: 460,
      height: 30,
    });
    expect({ x: choose.x, y: choose.y, width: choose.width, height: choose.height }).toStrictEqual({
      x: 380,
      y: 240,
      width: 400,
      height: 20,
    });
    const panel = view();
    expect(absolute(panel.box, panel.title.box)).toStrictEqual({ x: 380, y: 212, w: 460, h: 30 });
    expect(absolute(panel.box, panel.choose.box)).toStrictEqual({ x: 380, y: 240, w: 400, h: 20 });
    for (const name of ['panel title', 'choose line']) {
      expect(
        SPEC.boxes.some((box) => box.name === name),
        name,
      ).toBe(false);
      expect(
        buildView(SPEC).boxes.some((box) => box.name === name),
        name,
      ).toBe(false);
    }
    expect(buildView(SPEC).strings).toContain('MINI-BOSS REWARD');
    expect(buildView(SPEC).strings).toContain('Choose one.');
  });

  it('draws the item icon as a box the view has no rect to name', () => {
    expect(rectOf(frameBox('item icon 1'))).toStrictEqual({ x: 394, y: 288, w: 24, h: 24 });
    expect(view().rows[0]!.icon).toBeNull();
    expect(buildView(SPEC).boxes.some((box) => box.name.startsWith('item icon'))).toBe(false);
  });
});

describe('the copy it prints', () => {
  it('prints the frame’s three items and their descriptions, in order', () => {
    expect(BLOCK.rows.map((row) => row.label)).toStrictEqual([
      textOf('item name 1'),
      textOf('item name 2'),
      textOf('item name 3'),
    ]);
    expect(BLOCK.rows.map((row) => row.description)).toStrictEqual([
      textOf('item desc 1'),
      textOf('item desc 2'),
      textOf('item desc 3'),
    ]);
  });

  it('prints the board’s title, choose line and drawn ✕', () => {
    const panel = view();
    expect(panel.title.text).toBe('MINI-BOSS REWARD');
    expect(panel.title.text).toBe(textOf('panel title'));
    expect(panel.choose.text).toBe('Choose one.');
    expect(panel.choose.text).toBe(textOf('choose line'));
    expect(panel.close.label).toBe('×');
    expect(textOf('close')).toBe('×');
  });
});
