import { describe, expect, it } from 'vitest';
import battleMessageFixture from '../../../../../design/fixtures/05b-battle-message.json';
import screenSpec from '../../../../../design/screens/05b-battle-message.json';
import { gapFor, gapIsEmpty, GAP_TOLERANCE, type ScreenSpec, type SpecBox } from '../../specGap';
import { buildView, slug, visibleLines } from '../../specGap.views/battle-log';
import { battleLogBoard, battleLogLayout, fixtureBattleLogView, type BattleLogView } from './view';

/**
 * The `05b Battle · message` frame measured against the battle log's own view model: the
 * adapter that answers for this slug, the one box it claims at a zero delta on the frame's
 * `message box`, the two lines it claims as copy, and the highlight and line rects that stay
 * the card's own arithmetic rather than the view's.
 */

type FrameText = Readonly<{
  name: string;
  characters: string;
  x: number;
  y: number;
  width: number;
  height: number;
}>;

const SPEC: ScreenSpec = screenSpec;
const CAPTION = (screenSpec as unknown as { caption: string }).caption;
const TEXT = screenSpec.text as unknown as readonly FrameText[];

/** The fixture's copy, in draw order: the frame's `message line 1` and `message line 2`. */
const FIXTURE_LINES: readonly string[] = [
  'VENUSAUR used SLUDGE BOMB!',
  'CHARIZARD lost 38 HP and is poisoned.',
];

const fold = (line: string): string => line.trim().toUpperCase();

const frameText = (name: string): FrameText => {
  const node = TEXT.find((entry) => entry.name === name);
  if (node === undefined) throw new Error(`the frame prints no text named "${name}"`);
  return node;
};

const frameBox = (name: string): SpecBox => {
  const box = SPEC.boxes.find((entry) => entry.name === name);
  if (box === undefined) throw new Error(`the frame draws no box named "${name}"`);
  return box;
};

describe('the 05b adapter', () => {
  it('answers for the board frame it is named after', () => {
    expect(slug).toBe('05b-battle-message');
    expect(SPEC.slug).toBe(slug);
    expect(CAPTION).toBe('05b Battle · message');
    expect(SPEC.boxes).toHaveLength(71);
    expect(SPEC.text).toHaveLength(9);
    expect(SPEC.colours).toHaveLength(22);
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

describe('the box claim, a zero delta on the frame', () => {
  it('claims one box, named message box, at the frame’s 664, 544, 576, 216', () => {
    const boxes = buildView(SPEC).boxes;
    expect(boxes).toHaveLength(1);
    const claim = boxes[0]!;
    expect(claim.name).toBe('message box');
    const frame = frameBox('message box');
    expect({ x: frame.x, y: frame.y, width: frame.width, height: frame.height }).toStrictEqual({
      x: 664,
      y: 544,
      width: 576,
      height: 216,
    });
    expect(claim).toStrictEqual({
      name: 'message box',
      x: frame.x,
      y: frame.y,
      w: frame.width,
      h: frame.height,
    });
  });

  it('pins the shipped desktop board to the frame’s rect, to the pixel', () => {
    expect(battleLogBoard('desktop').box).toStrictEqual({ x: 664, y: 544, w: 576, h: 216 });
    const frame = frameBox('message box');
    const shipped = battleLogBoard('desktop').box;
    const delta = {
      dx: shipped.x - frame.x,
      dy: shipped.y - frame.y,
      dw: shipped.w - frame.width,
      dh: shipped.h - frame.height,
    };
    expect(delta).toStrictEqual({ dx: 0, dy: 0, dw: 0, dh: 0 });
    for (const step of [delta.dx, delta.dy, delta.dw, delta.dh]) {
      expect(Math.abs(step)).toBeLessThanOrEqual(GAP_TOLERANCE);
    }
  });

  it('stops claiming the box when the frame stops drawing it there', () => {
    const moved: ScreenSpec = {
      ...SPEC,
      boxes: SPEC.boxes.map((box) => (box.name === 'message box' ? { ...box, y: box.y + 12 } : box)),
    };
    expect(buildView(moved).boxes).toStrictEqual([]);
    const absent: ScreenSpec = {
      ...SPEC,
      boxes: SPEC.boxes.filter((box) => box.name !== 'message box'),
    };
    expect(buildView(absent).boxes).toStrictEqual([]);
  });
});

describe('the copy claim', () => {
  it('claims the fixture’s two lines, which the frame draws as its two message lines', () => {
    expect(buildView(SPEC).strings).toStrictEqual([...FIXTURE_LINES]);
    expect(frameText('message line 1').characters).toBe(FIXTURE_LINES[0]);
    expect(frameText('message line 2').characters).toBe(FIXTURE_LINES[1]);
    expect(fold(FIXTURE_LINES[0]!)).toBe(fold(frameText('message line 1').characters));
    expect(fold(FIXTURE_LINES[1]!)).toBe(fold(frameText('message line 2').characters));
  });

  it('prints nothing for a payload the parser rejects, or for a hidden box', () => {
    expect(fixtureBattleLogView(null)).toBeNull();
    expect(visibleLines(fixtureBattleLogView(null))).toStrictEqual([]);
    expect(
      visibleLines(fixtureBattleLogView({ state: battleMessageFixture.state, battleLog: null })),
    ).toStrictEqual([]);
    expect(visibleLines(fixtureBattleLogView({ state: battleMessageFixture.state }))).toStrictEqual([]);
    const hidden: BattleLogView = {
      visible: false,
      lines: [{ text: FIXTURE_LINES[0]!, tone: 'primary' }],
    };
    expect(visibleLines(hidden)).toStrictEqual([]);
    expect(visibleLines(fixtureBattleLogView(battleMessageFixture))).toStrictEqual([...FIXTURE_LINES]);
  });

  it('claims no colour: the glass, the hairline and the effect red are the stylesheet’s', () => {
    expect(buildView(SPEC).colours).toStrictEqual([]);
  });
});

describe('the rects that stay the card’s own arithmetic', () => {
  it('draws the highlight 12 px down, on the frame’s 676, 556, 552, 1', () => {
    const box = battleLogBoard('desktop').box;
    const highlight = { x: box.x + 12, y: box.y + 12, w: box.w - 24, h: 1 };
    expect(highlight).toStrictEqual({ x: 676, y: 556, w: 552, h: 1 });
    const frame = frameBox('message box highlight');
    expect({ x: frame.x, y: frame.y, width: frame.width, height: frame.height }).toStrictEqual({
      x: 676,
      y: 556,
      width: 552,
      height: 1,
    });
  });

  it('keeps the two lines on the frame’s insets, taking the card’s content column', () => {
    const board = battleLogLayout(battleLogBoard('desktop').box, false);
    expect(board.line1).toStrictEqual({ x: 696, y: 580, w: 512, h: 20 });
    expect(board.line2).toStrictEqual({ x: 696, y: 612, w: 512, h: 15 });
    const line1 = frameText('message line 1');
    const line2 = frameText('message line 2');
    expect({ x: line1.x, y: line1.y, height: line1.height }).toStrictEqual({
      x: board.line1.x,
      y: board.line1.y,
      height: board.line1.h,
    });
    expect({ x: line2.x, y: line2.y, height: line2.height }).toStrictEqual({
      x: board.line2.x,
      y: board.line2.y,
      height: board.line2.h,
    });
    expect([line1.width, line2.width]).toStrictEqual([292, 294]);
  });
});
