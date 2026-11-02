import { describe, expect, it } from 'vitest';
import fixture from '../../../../../design/fixtures/03l-panels-notice-level-up.json';
import screenSpec from '../../../../../design/screens/03l-panels-notice-level-up.json';
import { gapFor, gapIsEmpty, GAP_TOLERANCE, type ScreenSpec, type SpecBox } from '../../specGap';
import { buildView, slug } from '../../specGap.views/notice-level-up';
import { noticeBox } from './view';

/**
 * The `03l Panels · notice level up` frame measured against the notice strip's own view model:
 * the adapter that answers for this slug, the empty box claim it can honestly make, the 76 px
 * of frame height that keeps that claim empty, and the one line of copy it really prints.
 */

type Spec = ScreenSpec & Readonly<{ caption: string }>;
type FrameText = Readonly<{ name: string; characters: string }>;

const SPEC = screenSpec as Spec;
const FIXTURE = fixture;
const DESKTOP = { width: 1280, height: 800 };

const TEXT = screenSpec.text as unknown as readonly FrameText[];

const fold = (line: string): string => line.trim().toUpperCase();

const frameBox = (name: string): SpecBox => {
  const box = SPEC.boxes.find((entry) => entry.name === name);
  if (box === undefined) throw new Error(`the frame draws no box named "${name}"`);
  return box;
};

const frameRect = (name: string): Readonly<{ x: number; y: number; w: number; h: number }> => {
  const box = frameBox(name);
  return { x: box.x, y: box.y, w: box.width, h: box.height };
};

const frameText = (name: string): string => {
  const node = TEXT.find((entry) => entry.name === name);
  if (node === undefined) throw new Error(`the frame draws no text named "${name}"`);
  return node.characters;
};

describe('the 03l adapter', () => {
  it('answers for the board frame it is named after', () => {
    expect(slug).toBe('03l-panels-notice-level-up');
    expect(SPEC.slug).toBe(slug);
    expect(SPEC.caption).toBe('03l Panels · notice level up');
    expect(SPEC.boxes).toHaveLength(5);
    expect(SPEC.text).toHaveLength(5);
    expect(SPEC.colours).toHaveLength(6);
  });

  it('claims no box and no colour, only the one line the strip prints', () => {
    expect(buildView(SPEC)).toStrictEqual({
      boxes: [],
      strings: [FIXTURE.notice.text],
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

  it('builds the same view twice: no clock, no rng, no store', () => {
    expect(buildView(SPEC)).toStrictEqual(buildView(SPEC));
  });
});

describe('the geometry the empty box claim rests on', () => {
  it('docks the strip at 280, 24, 720, 56 where the frame draws 280, 24, 720, 132', () => {
    const shipped = noticeBox(DESKTOP);
    expect(shipped).toStrictEqual({ x: 280, y: 24, w: 720, h: 56 });
    expect(frameRect('level up strip')).toStrictEqual({ x: 280, y: 24, w: 720, h: 132 });

    const frame = frameBox('level up strip');
    expect(shipped.x).toBe(frame.x);
    expect(shipped.y).toBe(frame.y);
    expect(shipped.w).toBe(frame.width);
    expect(frame.height - shipped.h).toBe(76);
    expect(Math.abs(shipped.h - frame.height)).toBeGreaterThan(GAP_TOLERANCE);
  });

  it('has no field for the frame’s two move type chips', () => {
    expect(frameRect('move type 1')).toStrictEqual({ x: 304, y: 92, w: 24, h: 24 });
    expect(frameRect('move type 2')).toStrictEqual({ x: 304, y: 118, w: 24, h: 24 });

    const claimed = new Set(buildView(SPEC).boxes.map((box) => box.name));
    for (const name of ['move type 1', 'move type 2']) {
      expect(claimed.has(name)).toBe(false);
    }
  });

  it('claims neither the stylesheet hairline nor the route behind the strip', () => {
    expect(frameRect('level up strip highlight')).toStrictEqual({ x: 292, y: 36, w: 696, h: 1 });
    expect(frameRect('route screenshot')).toStrictEqual({ x: 0, y: 0, w: 1280, h: 800 });

    const claimed = buildView(SPEC).boxes.map((box) => box.name);
    expect(claimed).toStrictEqual([]);
  });
});

describe('the copy it claims', () => {
  it('prints the fixture’s own line, which is the frame’s level line', () => {
    const printed = buildView(SPEC).strings;

    expect(printed).toHaveLength(1);
    expect(printed).toContain(FIXTURE.notice.text);
    expect(fold(printed[0]!)).toBe(fold(frameText('level line')));
    expect(fold(FIXTURE.notice.text)).toBe(fold(frameText('level line')));
  });

  it('leaves the learned-moves block’s four strings unclaimed', () => {
    const printed = buildView(SPEC).strings.map(fold);

    for (const name of ['level meta', 'learned kicker', 'move name 1', 'move name 2']) {
      expect(printed).not.toContain(fold(frameText(name)));
    }
  });
});
