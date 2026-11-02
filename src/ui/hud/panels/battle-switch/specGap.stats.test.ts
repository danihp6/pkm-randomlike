import { describe, expect, it } from 'vitest';
import fixture from '../../../../../design/fixtures/05e-battle-stats.json';
import screenSpec from '../../../../../design/screens/05e-battle-stats.json';
import { t } from '../../../../i18n';
import { buildView, buildViewFor, slug } from '../../specGap.views/battle-stats';
import { GAP_TOLERANCE, gapFor, gapIsEmpty, type ScreenSpec, type SpecBox } from '../../specGap';
import {
  battleSwitchBox,
  battleSwitchView,
  fixtureSwitchInput,
  SWITCH_ROWS,
  type Viewport,
} from './view';

/**
 * The `05e Battle · stats` frame measured against the SWITCH window's own view model: the
 * adapter that answers for this slug, the empty box claim it can honestly make, the copy the
 * frame and the panel really share, and the stat block the frame draws and the window does
 * not — recorded as the frame's own, never claimed as panel output.
 */

const SPEC = screenSpec as ScreenSpec;
const DESKTOP: Viewport = { width: 1280, height: 800 };

type FrameText = Readonly<{
  name: string;
  characters: string;
  x: number;
  y: number;
  width: number;
  height: number;
}>;

const TEXT = screenSpec.text as unknown as readonly FrameText[];

const fold = (line: string): string => line.trim().toUpperCase();

const textOf = (name: string): string => TEXT.find((node) => node.name === name)?.characters ?? '';

const textRect = (name: string): Readonly<{ x: number; y: number; w: number; h: number }> => {
  const node = TEXT.find((entry) => entry.name === name);
  if (node === undefined) throw new Error(`the frame writes no text named "${name}"`);
  return { x: node.x, y: node.y, w: node.width, h: node.height };
};

const board = (): ReadonlySet<string> => new Set(TEXT.map((node) => fold(node.characters)));

const frameBox = (name: string): SpecBox => {
  const box = SPEC.boxes.find((entry) => entry.name === name);
  if (box === undefined) throw new Error(`the frame draws no box named "${name}"`);
  return box;
};

const frameRect = (name: string): Readonly<{ x: number; y: number; w: number; h: number }> => {
  const box = frameBox(name);
  return { x: box.x, y: box.y, w: box.width, h: box.height };
};

const rowLabel = (name: string, level: number): string =>
  t('party.rowLabel', { name, level, status: '' });

const panel = () => battleSwitchView(fixtureSwitchInput(fixture, DESKTOP)!);

const delta = (
  shipped: Readonly<{ x: number; y: number; w: number; h: number }>,
  frame: Readonly<{ x: number; y: number; w: number; h: number }>,
): Readonly<{ dx: number; dy: number; dw: number; dh: number }> => ({
  dx: Math.round(shipped.x - frame.x),
  dy: Math.round(shipped.y - frame.y),
  dw: Math.round(shipped.w - frame.w),
  dh: Math.round(shipped.h - frame.h),
});

const beyondTolerance = (step: Readonly<{ dx: number; dy: number; dw: number; dh: number }>): void => {
  for (const value of [step.dx, step.dy, step.dw, step.dh]) {
    expect(Math.abs(value)).toBeGreaterThan(GAP_TOLERANCE);
  }
};

const STAT_ROWS = ['0', '1', '2', '3', '4'] as const;

/** Every box the frame's stats state adds: the five rules, the two tabs and the item detail. */
const STAT_BOXES: readonly string[] = [
  ...STAT_ROWS.map((row) => `stat row rule ${row}`),
  'tab stats',
  'tab moves',
  'detail item slot',
  'detail item icon',
];

/** Every line that block prints, folded: `ATTACK 84` reads as two text nodes, not one line. */
const STAT_LINES: readonly string[] = [
  'ATTACK',
  '84',
  'DEFENSE',
  '78',
  'SP. ATK',
  '109',
  'SP. DEF',
  '85',
  'SPEED',
  '100',
  'STATS',
  'MOVES',
  'NATURE · ADAMANT',
  'ABILITY · BLAZE',
  'CHARCOAL',
];

describe('the 05e adapter', () => {
  it('answers for the SWITCH window’s stats frame it is named after', () => {
    expect(slug).toBe('05e-battle-stats');
    expect(SPEC.slug).toBe(slug);
    expect(screenSpec.caption).toBe('05e Battle · stats');
    expect(SPEC.boxes).toHaveLength(111);
    expect(SPEC.text).toHaveLength(33);
    expect(SPEC.colours).toHaveLength(28);
  });

  it('claims no box, four names and one HP line, and no colour', () => {
    expect(buildView(SPEC)).toStrictEqual({
      boxes: [],
      strings: ['CHARIZARD', '98/112', 'PIKACHU', 'BULBASAUR', 'GASTLY'],
      colours: [],
    });
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

  it('builds the same view twice, and an empty claim when the payload has no switch block', () => {
    expect(buildView(SPEC)).toStrictEqual(buildView(SPEC));
    expect(buildViewFor(null, SPEC)).toStrictEqual({ boxes: [], strings: [], colours: [] });
    expect(buildViewFor({}, SPEC)).toStrictEqual({ boxes: [], strings: [], colours: [] });
    expect(buildViewFor({ switch: { open: true } }, SPEC)).toStrictEqual({
      boxes: [],
      strings: [],
      colours: [],
    });
    expect(buildViewFor(fixture, SPEC)).toStrictEqual(buildView(SPEC));
  });
});

describe('the stat block the window cannot reach', () => {
  it('draws the frame’s stats boxes, and claims none of them as geometry', () => {
    for (const name of STAT_BOXES) expect(frameBox(name).name, name).toBe(name);
    const claimed = new Set(buildView(SPEC).boxes.map((box) => box.name));
    for (const name of STAT_BOXES) expect(claimed.has(name), name).toBe(false);
    expect(buildView(SPEC).boxes).toStrictEqual([]);
  });

  it('does not claim the five stat row rules, nor any stat row rect', () => {
    const claimed = new Set(buildView(SPEC).boxes.map((box) => box.name));
    STAT_ROWS.forEach((row, index) => {
      const rule = `stat row rule ${row}`;
      expect(frameRect(rule), rule).toStrictEqual({ x: 694, y: 466 + index * 18, w: 506, h: 1 });
      expect(claimed.has(rule), rule).toBe(false);
      expect(textRect(`stat row label ${row}`), rule).toStrictEqual({
        x: 694,
        y: 450 + index * 18,
        w: 200,
        h: 15,
      });
      expect(textRect(`stat row value ${row}`), rule).toStrictEqual({
        x: 1000,
        y: 448 + index * 18,
        w: 200,
        h: 18,
      });
    });
    expect(panel().rows.map((row) => row.label.text)).not.toContain('ATTACK');
  });

  it('prints none of the stat lines, which the frame carries', () => {
    const claimed = buildView(SPEC).strings.map(fold);
    for (const line of STAT_LINES) {
      expect(claimed, line).not.toContain(line);
      expect(board().has(fold(line)), line).toBe(true);
    }
    expect(textOf('stat row label 0')).toBe('ATTACK');
    expect(textOf('stat row value 4')).toBe('100');
    expect(textOf('tab stats label')).toBe('STATS');
    expect(textOf('detail nature')).toBe('NATURE · ADAMANT');
  });
});

describe('the copy it claims and the geometry the empty box claim rests on', () => {
  it('claims only lines the frame carries, folded, and four of them are member names', () => {
    const claimed = buildView(SPEC).strings;
    const drawn = board();
    expect(claimed.length).toBeGreaterThan(0);
    for (const line of claimed) expect(drawn.has(fold(line))).toBe(true);
    const names = panel().rows.map((row) => row.name);
    expect(claimed.filter((line) => names.includes(line))).toStrictEqual([
      'CHARIZARD',
      'PIKACHU',
      'BULBASAUR',
      'GASTLY',
    ]);
    expect(textOf('mon name CH')).toBe('Charizard');
    expect(fold(textOf('player hp text'))).toBe(fold('98/112'));
    expect(buildView(SPEC).colours).toStrictEqual([]);
  });

  it('docks the shipped card at 676, 582, 564, 192 where the grid group is 684, 600, 536, 148', () => {
    expect(battleSwitchBox(DESKTOP)).toStrictEqual({ x: 676, y: 582, w: 564, h: 192 });
    expect(frameRect('party grid group')).toStrictEqual({ x: 684, y: 600, w: 536, h: 148 });
    const step = delta(panel().card, frameRect('party grid group'));
    expect(step).toStrictEqual({ dx: -8, dy: -18, dw: 28, dh: 44 });
    beyondTolerance(step);
  });

  it('is not the frame’s 576 × 216 battle menu either', () => {
    expect(frameRect('battle menu')).toStrictEqual({ x: 664, y: 544, w: 576, h: 216 });
    expect(frameRect('battle menu group')).toStrictEqual(frameRect('battle menu'));
    const step = delta(panel().card, frameRect('battle menu'));
    expect(step).toStrictEqual({ dx: 12, dy: 38, dw: -12, dh: -24 });
    beyondTolerance(step);
    beyondTolerance(delta(panel().card, frameRect('battle menu group')));
  });

  it('draws six full-width rows where the frame draws 264 × 70 tiles in two columns', () => {
    expect(frameRect('party sel')).toStrictEqual({ x: 684, y: 600, w: 264, h: 70 });
    expect(frameRect('slot tile 2')).toStrictEqual({ x: 956, y: 600, w: 264, h: 70 });
    expect(frameRect('slot tile 3')).toStrictEqual({ x: 684, y: 678, w: 264, h: 70 });
    expect(frameRect('slot tile 4')).toStrictEqual({ x: 956, y: 678, w: 264, h: 70 });

    const view = panel();
    expect(view.rows).toHaveLength(4);
    expect(view.slots).toHaveLength(SWITCH_ROWS);
    expect(view.slots).toHaveLength(6);

    const first = view.slots[0]!;
    expect(first).toStrictEqual({ x: 760, y: 606, w: 452, h: 112 / 6 });
    expect(view.slots.map((slot) => slot.x)).toStrictEqual(Array.from({ length: 6 }, () => 760));
    expect(view.slots.map((slot) => slot.w)).toStrictEqual(Array.from({ length: 6 }, () => 452));

    const steps: readonly Readonly<{ dx: number; dy: number; dw: number; dh: number }>[] = [
      delta(first, frameRect('party sel')),
      delta(view.slots[1]!, frameRect('slot tile 2')),
      delta(view.slots[2]!, frameRect('slot tile 3')),
      delta(view.slots[3]!, frameRect('slot tile 4')),
    ];
    expect(steps).toStrictEqual([
      { dx: 76, dy: 6, dw: 188, dh: -51 },
      { dx: -196, dy: 33, dw: 188, dh: -51 },
      { dx: 76, dy: -19, dw: 188, dh: -51 },
      { dx: -196, dy: 8, dw: 188, dh: -51 },
    ]);
    for (const step of steps) beyondTolerance(step);
  });

  it('stacks the six rows in one column on a 26.67 pitch, not two rows 78 px apart', () => {
    const slots = panel().slots;
    const tops = [606, 632.6667, 659.3333, 686, 712.6667, 739.3333];
    slots.forEach((slot, index) => expect(slot.y).toBeCloseTo(tops[index]!, 3));
    expect(frameRect('slot tile 3').y - frameRect('party sel').y).toBe(78);
    expect(Math.round((slots[1]!.y - slots[0]!.y) * 100) / 100).toBe(26.67);
  });
});

describe('the copy it cannot claim', () => {
  it('cannot claim the row line, which the board splits into a name and LV 36', () => {
    const first = panel().rows[0]!;
    expect(first.label.text).toBe(rowLabel('CHARIZARD', 36));
    expect(fold(first.label.text)).not.toBe(fold(textOf('mon name CH')));
    expect(board().has(fold(first.label.text))).toBe(false);
    expect(first.hpText).toBe('98/112');
    expect(textOf('player lv')).toBe('LV 36');
    expect(fold(first.label.text)).toContain(fold('LV36'));
  });

  it('cannot claim the PAR and PSN marks, the other HP readouts or the ◀ glyph', () => {
    const view = panel();
    expect(view.rows[2]!.statusLabel).toBe('PAR');
    expect(view.rows[3]!.statusLabel).toBe('PSN');
    expect(board().has('PAR')).toBe(false);
    expect(board().has('PSN')).toBe(false);
    expect(view.rows.map((row) => row.hpText)).toStrictEqual(['98/112', '84/112', '51/102', '21/84']);
    for (const line of ['84/112', '51/102', '21/84']) expect(board().has(line), line).toBe(false);
    expect(view.back.label).toBe('\u25c0');
    expect(board().has(view.back.label)).toBe(false);
  });
});
