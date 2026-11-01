import { describe, expect, it } from 'vitest';
import screenSpec from '../../../../../design/screens/01-main-menu.json';
import { gapFor, gapIsEmpty, type ScreenSpec } from '../../specGap';
import { buildView, slug } from '../../specGap.views/main-menu';

/**
 * The title screen's view against frame `01 Main menu`: the facts the panel claims, and the
 * proof that claiming them closes the gap. Everything the frame draws and this view does not
 * (`menu card`, `card highlight`, the four portrait slots, `window base`, the selected row's
 * bar and cursor, the version line, which the frame draws as text and not as a box) is
 * recorded in the adapter's own comment with its measured delta.
 */

const SPEC: ScreenSpec = screenSpec;

const BOXES: readonly (readonly [string, number, number, number, number])[] = [
  ['glow', -180, -140, 1000, 720],
  ['accent rule', 724, 204, 88, 3],
  ['route window', 96, 150, 560, 380],
  ['stats rule', 96, 592, 520, 1],
  ['row sel CONTINUE', 744, 300, 420, 54],
  ['row NEW RUN', 744, 362, 420, 54],
  ['row OPTIONS', 744, 424, 420, 54],
  ['row STATS', 744, 486, 420, 54],
];

const STRINGS: readonly string[] = [
  'POKERANDOMLIKE',
  'v0.7.0 · PHASE 7',
  'CONTINUE',
  'NEW RUN',
  'OPTIONS',
  'STATS',
  'MAP 3 · FOREST',
  'NEW SEED',
  'WINS',
  'MAX ELITE STRIKE',
  'MONTHLY MAX STRIKE',
  '23',
  '2',
  '7',
  'NOVA',
];

describe('the main menu’s spec adapter', () => {
  it('answers for one screen', () => {
    expect(slug).toBe('01-main-menu');
    expect(SPEC.slug).toBe(slug);
  });

  it('claims exactly the boxes the frame draws, with the panel’s own rects', () => {
    const boxes = buildView(SPEC).boxes.map((box) => [box.name, box.x, box.y, box.w, box.h]);
    expect(boxes).toStrictEqual(BOXES);
  });

  it('records the version line where the frame draws it: a text node, never a box', () => {
    const version = screenSpec.text.find((node) => node.name === 'version');
    expect(version).toMatchObject({ x: 1065, y: 750, width: 122, height: 15 });
    expect(screenSpec.boxes.some((box) => box.name === 'version')).toBe(false);
    expect(STRINGS).toContain(version?.characters);
  });

  it('names every claimed box as the frame names it', () => {
    const named = new Set(SPEC.boxes.flatMap((box) => (box.name === null ? [] : [box.name])));
    for (const box of buildView(SPEC).boxes) expect(named, box.name).toContain(box.name);
  });

  it('prints the view’s copy in board order, with no fifth row and no colour', () => {
    const view = buildView(SPEC);
    expect(view.strings).toStrictEqual(STRINGS);
    expect(view.strings).not.toContain('RANKING');
    expect(view.colours).toStrictEqual([]);
  });

  it('reports no gap against its own frame', () => {
    const gap = gapFor(buildView(SPEC), SPEC);
    expect(gap).toStrictEqual({ missing: [], moved: [], strings: [], colours: [] });
    expect(gapIsEmpty(gap)).toBe(true);
  });

  it('reads the spec only as a structural selector, never as the answer', () => {
    const empty: ScreenSpec = { ...SPEC, boxes: [], text: [], colours: [] };
    const view = buildView(empty);
    expect(view.boxes).toStrictEqual([]);
    expect(view.strings).toStrictEqual(STRINGS);
  });

  it('is pure: the same spec twice deep-equals', () => {
    expect(buildView(SPEC)).toStrictEqual(buildView(SPEC));
  });
});
