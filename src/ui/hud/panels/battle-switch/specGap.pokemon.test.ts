import { describe, expect, it } from 'vitest';
import fixture from '../../../../../design/fixtures/05d-battle-pokemon.json';
import screenSpec from '../../../../../design/screens/05d-battle-pokemon.json';
import { t } from '../../../../i18n';
import { buildView, buildViewFor, slug } from '../../specGap.views/battle-pokemon';
import { GAP_TOLERANCE, gapFor, gapIsEmpty, type ScreenSpec, type SpecBox } from '../../specGap';
import {
  battleSwitchBox,
  battleSwitchView,
  fixtureSwitchInput,
  SWITCH_ROWS,
  type Viewport,
} from './view';

/**
 * The `05d Battle · pokemon` frame measured against the SWITCH window's own view model: the
 * adapter that answers for this slug, the empty box claim it can honestly make, the geometry
 * that keeps that claim empty, and the copy the frame and the panel really share.
 */

const SPEC = screenSpec as ScreenSpec;
const DESKTOP: Viewport = { width: 1280, height: 800 };

type FrameText = Readonly<{ name: string; characters: string }>;

const TEXT = screenSpec.text as unknown as readonly FrameText[];

const fold = (line: string): string => line.trim().toUpperCase();

const textOf = (name: string): string => TEXT.find((node) => node.name === name)?.characters ?? '';

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

describe('the 05d adapter', () => {
  it('answers for the battle SWITCH frame it is named after', () => {
    expect(slug).toBe('05d-battle-pokemon');
    expect(SPEC.slug).toBe(slug);
    expect(screenSpec.caption).toBe('05d Battle · pokemon');
    expect(SPEC.boxes).toHaveLength(116);
    expect(SPEC.text).toHaveLength(36);
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

  it('builds the same view twice, and an empty claim from a null payload', () => {
    expect(buildView(SPEC)).toStrictEqual(buildView(SPEC));
    expect(buildViewFor(null, SPEC)).toStrictEqual({ boxes: [], strings: [], colours: [] });
    expect(buildViewFor(fixture, SPEC)).toStrictEqual(buildView(SPEC));
  });
});

describe('the geometry the empty box claim rests on', () => {
  it('docks the shipped card at 676, 582, 564, 192 where the grid group is 684, 600, 536, 148', () => {
    expect(battleSwitchBox(DESKTOP)).toStrictEqual({ x: 676, y: 582, w: 564, h: 192 });
    expect(frameRect('party grid group')).toStrictEqual({ x: 684, y: 600, w: 536, h: 148 });
    const step = delta(panel().card, frameRect('party grid group'));
    expect(step).toStrictEqual({ dx: -8, dy: -18, dw: 28, dh: 44 });
    beyondTolerance(step);
  });

  it('is not the frame’s 576 × 216 battle menu either', () => {
    expect(frameRect('battle menu')).toStrictEqual({ x: 664, y: 544, w: 576, h: 216 });
    const step = delta(panel().card, frameRect('battle menu'));
    expect(step).toStrictEqual({ dx: 12, dy: 38, dw: -12, dh: -24 });
    beyondTolerance(step);
  });

  it('draws six full-width rows where the frame draws 264 × 70 tiles in two columns', () => {
    expect(frameRect('slot tile 2')).toStrictEqual({ x: 956, y: 600, w: 264, h: 70 });
    expect(frameRect('party sel')).toStrictEqual({ x: 684, y: 600, w: 264, h: 70 });
    expect(frameRect('party sel bar')).toStrictEqual({ x: 688, y: 608, w: 3, h: 54 });
    expect(frameRect('slot tile 3')).toStrictEqual({ x: 684, y: 678, w: 264, h: 70 });
    expect(frameRect('slot tile 4')).toStrictEqual({ x: 956, y: 678, w: 264, h: 70 });

    const view = panel();
    expect(view.rows).toHaveLength(SWITCH_ROWS);
    expect(view.rows).toHaveLength(6);
    expect(view.slots).toHaveLength(SWITCH_ROWS);

    const first = view.slots[0]!;
    expect(first.x).toBe(760);
    expect(first.w).toBe(452);
    expect(first.y).toBeCloseTo(606, 3);
    expect(first.h).toBeCloseTo(112 / 6, 3);
    const step = delta(first, frameRect('slot tile 2'));
    expect(step).toStrictEqual({ dx: -196, dy: 6, dw: 188, dh: -51 });
    beyondTolerance(step);
    beyondTolerance(delta(first, frameRect('party sel')));
  });

  it('stacks the six rows in one column on a 26.67 pitch, not two rows 78 px apart', () => {
    const slots = panel().slots;
    expect(slots.map((slot) => slot.x)).toStrictEqual(Array.from({ length: 6 }, () => 760));
    expect(slots.map((slot) => slot.w)).toStrictEqual(Array.from({ length: 6 }, () => 452));
    const tops = [606, 632.6667, 659.3333, 686, 712.6667, 739.3333];
    slots.forEach((slot, index) => expect(slot.y).toBeCloseTo(tops[index]!, 3));
    expect(frameRect('slot tile 3').y - frameRect('party sel').y).toBe(78);
    expect(Math.round((slots[1]!.y - slots[0]!.y) * 100) / 100).toBe(26.67);
  });
});

describe('the copy it claims and the copy it cannot', () => {
  it('claims only lines the frame carries, folded, and one of them is a member’s name', () => {
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

  it('cannot claim the row line, which the board splits into a name and LV 36', () => {
    const first = panel().rows[0]!;
    expect(first.label.text).toBe(rowLabel('CHARIZARD', 36));
    expect(fold(first.label.text)).not.toBe(fold(textOf('mon name CH')));
    expect(board().has(fold(first.label.text))).toBe(false);
    expect(first.hpText).toBe('98/112');
    expect(textOf('player lv')).toBe('LV 36');
    expect(fold(first.label.text)).toContain(fold('LV36'));
  });

  it('cannot claim the PAR and PSN marks, the fainted line or the ◀ glyph', () => {
    const view = panel();
    expect(view.rows[2]!.statusLabel).toBe('PAR');
    expect(view.rows[3]!.statusLabel).toBe('PSN');
    expect(board().has('PAR')).toBe(false);
    expect(board().has('PSN')).toBe(false);
    expect(view.rows[5]!.hp).toBeNull();
    expect(view.rows[5]!.hpText).toBe('0/78');
    expect(board().has('0/78')).toBe(false);
    expect(view.back.label).toBe('\u25c0');
    expect(board().has(view.back.label)).toBe(false);
  });
});
