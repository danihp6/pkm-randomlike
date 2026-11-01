import { describe, expect, it } from 'vitest';
import fixture from '../../../../../design/fixtures/03g-panels-reward-pokemon.json';
import screenSpec from '../../../../../design/screens/03g-panels-reward-pokemon.json';
import { gapFor, gapIsEmpty, type ScreenSpec, type SpecBox } from '../../specGap';
import { buildView, slug } from '../../specGap.views/rewards-pokemon';
import {
  REWARDS_CLOSE_LABEL,
  REWARDS_ROW_GAP,
  REWARDS_ROW_H,
  REWARDS_ROW_TOP,
  rewardsPanelBox,
  rewardsPanelView,
  type Rect,
  type RewardRowView,
  type RewardsInput,
  type RewardsPanelView,
} from './view';

/**
 * The `03g Panels · reward pokemon` frame measured against the panel's own view model: the
 * adapter that answers for this slug, the premise that the shipped card *is* the board's card,
 * the label-only rule a Pokémon row obeys, and the three text nodes no box claim can reach.
 */

const SPEC = screenSpec as ScreenSpec;
const DESKTOP = { width: 1280, height: 800 };

type FrameText = Readonly<{ name: string; characters: string }>;

const TEXT = screenSpec.text as unknown as readonly FrameText[];

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

/** A panel-relative rect as the page shows it. */
const absolute = (rect: Rect, panel: RewardsPanelView): Rect => ({
  x: panel.box.x + rect.x,
  y: panel.box.y + rect.y,
  w: rect.w,
  h: rect.h,
});

/** A row as the fixture records it: a Pokémon offer prints its label and nothing else. */
function rowOf(row: (typeof fixture.pokemon.rows)[number]): RewardRowView {
  return {
    index: row.index,
    kind: 'pokemon',
    label: row.label,
    description: '',
    icon: null,
    armed: false,
    box: { x: 0, y: 0, w: 0, h: 0 },
  };
}

function input(): RewardsInput {
  return {
    title: fixture.pokemon.title,
    choose: fixture.pokemon.choose,
    rows: fixture.pokemon.rows.map(rowOf),
    armed: fixture.pokemon.armed,
    open: fixture.pokemon.open,
  };
}

const view = (): RewardsPanelView => rewardsPanelView(input(), DESKTOP);

/** The five boxes the card draws at the board's own rects, in draw order. */
const BOXES = [
  { name: 'reward panel', x: 360, y: 196, w: 560, h: 342 },
  { name: 'panel highlight', x: 372, y: 208, w: 536, h: 1 },
  { name: 'row 1', x: 380, y: 274, w: 520, h: 76 },
  { name: 'row 2', x: 380, y: 358, w: 520, h: 76 },
  { name: 'row 3', x: 380, y: 442, w: 520, h: 76 },
];

/** The six lines the card prints, in draw order: the title, the choose line, the ✕, the labels. */
const STRINGS: readonly string[] = [
  'MINI-BOSS REWARD',
  'Choose one.',
  '×',
  'ATTACK · Adamant',
  'SP. ATK · Modest',
  'SPEED · Jolly',
];

describe('the 03g adapter', () => {
  it('answers for the board frame it is named after', () => {
    expect(slug).toBe('03g-panels-reward-pokemon');
    expect(SPEC.slug).toBe(slug);
    expect(SPEC.boxes).toHaveLength(7);
    expect(TEXT).toHaveLength(6);
    expect(SPEC.colours).toHaveLength(10);
  });

  it('claims the five boxes and the six lines the card prints, and no colour', () => {
    expect(buildView(SPEC)).toStrictEqual({ boxes: BOXES, strings: STRINGS, colours: [] });
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

describe('the premise: the shipped card is the board’s card', () => {
  it('draws the panel at 360, 196, 560, 342, every delta 0', () => {
    expect(rewardsPanelBox(DESKTOP)).toStrictEqual({ x: 360, y: 196, w: 560, h: 342 });
    const shipped = rewardsPanelBox(DESKTOP);
    const frame = frameBox('reward panel');
    expect(rectOf(frame)).toStrictEqual({ x: 360, y: 196, width: 560, height: 342 });
    expect({
      dx: shipped.x - frame.x,
      dy: shipped.y - frame.y,
      dw: shipped.w - frame.width,
      dh: shipped.h - frame.height,
    }).toStrictEqual({ dx: 0, dy: 0, dw: 0, dh: 0 });
  });

  it('hangs the highlight 12 px inside the card’s top edge, on the board’s 372, 208, 536, 1', () => {
    expect(rectOf(frameBox('panel highlight'))).toStrictEqual({
      x: 372,
      y: 208,
      width: 536,
      height: 1,
    });
    expect(absolute(view().highlight, view())).toStrictEqual({ x: 372, y: 208, w: 536, h: 1 });
  });

  it('lays the three rows on the board’s slots, 84 px apart', () => {
    expect([1, 2, 3].map((n) => rectOf(frameBox(`row ${n}`)))).toStrictEqual([
      { x: 380, y: 274, width: 520, height: 76 },
      { x: 380, y: 358, width: 520, height: 76 },
      { x: 380, y: 442, width: 520, height: 76 },
    ]);
    expect(view().rows.map((row) => row.box)).toStrictEqual([
      { x: 20, y: 78, w: 520, h: 76 },
      { x: 20, y: 162, w: 520, h: 76 },
      { x: 20, y: 246, w: 520, h: 76 },
    ]);
    expect(view().rows.map((row) => absolute(row.box, view()))).toStrictEqual([
      { x: 380, y: 274, w: 520, h: 76 },
      { x: 380, y: 358, w: 520, h: 76 },
      { x: 380, y: 442, w: 520, h: 76 },
    ]);
    const shipped = view().rows;
    expect(shipped[0]!.box.y).toBe(REWARDS_ROW_TOP);
    for (let i = 1; i < shipped.length; i += 1) {
      expect(shipped[i]!.box.y - shipped[i - 1]!.box.y).toBe(REWARDS_ROW_H + REWARDS_ROW_GAP);
    }
  });
});

describe('the label-only rule and the three text nodes', () => {
  it('forces every Pokémon row to its label alone, so the view prints six lines and no blank', () => {
    for (const row of view().rows) {
      expect(row.kind).toBe('pokemon');
      expect(row.description).toBe('');
      expect(row.icon).toBeNull();
    }
    const strings = buildView(SPEC).strings;
    expect(strings).toHaveLength(6);
    expect(strings.some((line) => line === '')).toBe(false);
  });

  it('lands the ✕ on the board’s close text node without claiming it as a box', () => {
    expect(textOf('close')).toBe('×');
    expect(SPEC.boxes.some((box) => box.name === 'close')).toBe(false);
    expect(view().close.box).toStrictEqual({ x: 516, y: 10, w: 24, h: 24 });
    expect(absolute(view().close.box, view())).toStrictEqual({ x: 876, y: 206, w: 24, h: 24 });
    expect(buildView(SPEC).boxes.some((box) => box.name === 'close')).toBe(false);
  });

  it('lands the title and the choose line on their text nodes, never on a box', () => {
    expect(TEXT.find((node) => node.name === 'panel title')).toBeDefined();
    expect(TEXT.find((node) => node.name === 'choose line')).toBeDefined();
    expect(SPEC.boxes.some((box) => box.name === 'panel title')).toBe(false);
    expect(SPEC.boxes.some((box) => box.name === 'choose line')).toBe(false);
    expect(absolute(view().title.box, view())).toStrictEqual({ x: 380, y: 212, w: 460, h: 30 });
    expect(absolute(view().choose.box, view())).toStrictEqual({ x: 380, y: 240, w: 400, h: 20 });
    expect(buildView(SPEC).boxes.map((box) => box.name)).not.toContain('panel title');
    expect(buildView(SPEC).boxes.map((box) => box.name)).not.toContain('choose line');
  });

  it('draws no item icon box and invents none', () => {
    expect(SPEC.boxes.some((box) => (box.name ?? '').startsWith('item icon'))).toBe(false);
    expect(buildView(SPEC).boxes.some((box) => box.name.startsWith('item icon'))).toBe(false);
    expect(buildView(SPEC).boxes).toHaveLength(5);
  });
});

describe('the copy the card prints', () => {
  it('prints the frame’s three STAT · Nature labels, in order', () => {
    const labels = ['option label 1', 'option label 2', 'option label 3'].map(textOf);
    expect(labels).toStrictEqual(['ATTACK · Adamant', 'SP. ATK · Modest', 'SPEED · Jolly']);
    expect(fixture.pokemon.rows.map((row) => row.label)).toStrictEqual(labels);
    expect(view().rows.map((row) => row.label)).toStrictEqual(labels);
    expect(buildView(SPEC).strings.slice(3)).toStrictEqual(labels);
  });

  it('prints the ✕, the title and the choose line the board draws', () => {
    expect(view().close.label).toBe('×');
    expect(view().close.label).toBe(REWARDS_CLOSE_LABEL);
    expect(textOf('close')).toBe(view().close.label);
    expect(view().title.text).toBe('MINI-BOSS REWARD');
    expect(textOf('panel title')).toBe(view().title.text);
    expect(view().choose.text).toBe('Choose one.');
    expect(textOf('choose line')).toBe(view().choose.text);
  });

  it('prints nothing the board does not carry', () => {
    const carried = new Set(SPEC.text.map((node) => fold(node.characters)));
    for (const line of buildView(SPEC).strings) expect(carried.has(fold(line)), line).toBe(true);
  });
});
