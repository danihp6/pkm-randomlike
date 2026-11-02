import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import pauseFixture from '../../../../../design/fixtures/03n-panels-pause-menu.json';
import screenSpec from '../../../../../design/screens/03n-panels-pause-menu.json';
import { fixturePausePanelView, type PausePanelView, type Rect } from '../../panels/pause/view';
import { gapFor, gapIsEmpty, GAP_TOLERANCE, type ScreenSpec, type SpecBox } from '../../specGap';
import { buildView, slug } from '../../specGap.views/pause';

/**
 * The `03n Panels · pause menu` frame measured against the pause card's own view model: the
 * adapter that answers for this slug, the one box it claims, the five it declares and does
 * not, the naming trap the 56 px pitch sets, and the one string the card shares with the
 * board.
 */

const SPEC = screenSpec as ScreenSpec;
const DESKTOP = { width: 1280, height: 800 };

type FrameText = Readonly<{ name: string; characters: string }>;

const TEXT = screenSpec.text as unknown as readonly FrameText[];
const ADAPTER_SOURCE = readFileSync(
  fileURLToPath(new URL('../../specGap.views/pause.ts', import.meta.url)),
  'utf8',
);

const fold = (line: string): string => line.trim().toUpperCase();

const textOf = (name: string): string => TEXT.find((node) => node.name === name)?.characters ?? '';

const frameBox = (name: string): SpecBox => {
  const box = SPEC.boxes.find((entry) => entry.name === name);
  if (box === undefined) throw new Error(`the frame draws no box named "${name}"`);
  return box;
};

const frameRect = (name: string): Rect => {
  const box = frameBox(name);
  return { x: box.x, y: box.y, w: box.width, h: box.height };
};

/** The card at 1280×800, built exactly as the preview and the running panel build it. */
const card = (): PausePanelView => {
  const built = fixturePausePanelView(pauseFixture, DESKTOP);
  if (built === null) throw new Error('the pinned pause fixture no longer reads as a card');
  return built;
};

/** Where a card-relative rect lands once the card is mounted at its own viewport box. */
const at = (origin: Rect, rect: Rect): Rect => ({
  x: origin.x + rect.x,
  y: origin.y + rect.y,
  w: rect.w,
  h: rect.h,
});

const claimedNames = (): readonly string[] => buildView(SPEC).boxes.map((box) => box.name);

describe('the 03n adapter', () => {
  it('answers for the board frame it is named after', () => {
    expect(slug).toBe('03n-panels-pause-menu');
    expect(SPEC.slug).toBe(slug);
    expect(SPEC.boxes).toHaveLength(9);
    expect(SPEC.text).toHaveLength(5);
    expect(SPEC.colours).toHaveLength(11);
  });

  it('claims the scrim, the title and no colour over the shipped two-row card', () => {
    expect(buildView(SPEC)).toStrictEqual({
      boxes: [{ name: 'pause scrim', x: 0, y: 0, w: 1280, h: 800 }],
      strings: ['MENU'],
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

describe('the one box claimed', () => {
  it('claims pause scrim at the viewport rect both sides draw, with no lift', () => {
    expect(card().scrim).toStrictEqual({ x: 0, y: 0, w: 1280, h: 800 });
    expect(frameRect('pause scrim')).toStrictEqual({ x: 0, y: 0, w: 1280, h: 800 });
    expect(buildView(SPEC).boxes).toStrictEqual([{ name: 'pause scrim', x: 0, y: 0, w: 1280, h: 800 }]);
  });
});

describe('the five candidates declared and not claimed', () => {
  /** The frame’s rects against the card’s, candidate by candidate — the 56 px pitch, made data. */
  const CANDIDATES: readonly Readonly<{
    name: string;
    frame: Rect;
    shipped: (card: PausePanelView) => Rect;
    gap: Readonly<{ dy: number; dh: number }>;
  }>[] = [
    {
      name: 'pause panel',
      frame: { x: 460, y: 244, w: 360, h: 312 },
      shipped: (view) => view.box,
      gap: { dy: 56, dh: -112 },
    },
    {
      name: 'pause panel highlight',
      frame: { x: 472, y: 256, w: 336, h: 1 },
      shipped: (view) => at(view.box, view.highlight),
      gap: { dy: 56, dh: 0 },
    },
    {
      name: 'pause divider',
      frame: { x: 484, y: 304, w: 312, h: 1 },
      shipped: (view) => at(view.box, view.divider),
      gap: { dy: 56, dh: 0 },
    },
    {
      name: 'pause row 0',
      frame: { x: 484, y: 320, w: 312, h: 48 },
      shipped: (view) => at(view.box, view.rows[0]!.box),
      gap: { dy: 56, dh: 0 },
    },
    {
      name: 'pause row 1',
      frame: { x: 484, y: 376, w: 312, h: 48 },
      shipped: (view) => at(view.box, view.rows[1]!.box),
      gap: { dy: 56, dh: 0 },
    },
  ];

  it('ships the board’s 360 px card at two rows: 200 tall against the frame’s 312', () => {
    expect(frameRect('pause panel')).toStrictEqual({ x: 460, y: 244, w: 360, h: 312 });
    expect(card().box).toStrictEqual({ x: 460, y: 300, w: 360, h: 200 });
  });

  it.each(CANDIDATES)('draws $name 56 px low and does not claim it', ({ name, frame, shipped, gap }) => {
    expect(frameRect(name)).toStrictEqual(frame);
    const built = shipped(card());
    expect({ x: built.x, y: built.y, w: built.w, h: built.h }).toStrictEqual({
      x: frame.x,
      y: frame.y + gap.dy,
      w: frame.w,
      h: frame.h + gap.dh,
    });
    expect({ dx: built.x - frame.x, dy: built.y - frame.y }).toStrictEqual({ dx: 0, dy: 56 });
    expect(Math.abs(built.y - frame.y)).toBeGreaterThan(GAP_TOLERANCE);
    expect(claimedNames()).not.toContain(name);
  });
});

describe('the naming trap the 56 px pitch sets', () => {
  it('lands Reset run on the frame’s pause row 2 rect to the pixel', () => {
    expect(at(card().box, card().rows[1]!.box)).toStrictEqual(frameRect('pause row 2'));
  });

  it('never names that candidate after the rect it lands on', () => {
    expect(claimedNames()).not.toContain('pause row 2');
    expect(ADAPTER_SOURCE).not.toContain("'pause row 2'");
    expect(ADAPTER_SOURCE).toContain('`pause row ${row.index}`');
  });

  it('names the rows after PauseRowView.index, which is 0 and 1', () => {
    expect(card().rows.map((row) => row.index)).toStrictEqual([0, 1]);
    expect(card().rows.map((row) => row.id)).toStrictEqual(['settings', 'reset']);
    expect(claimedNames()).not.toContain('pause row 3');
  });
});

describe('the copy it claims and the copy it does not', () => {
  it('claims only MENU, the one line both sides print', () => {
    expect(buildView(SPEC).strings).toStrictEqual(['MENU']);
    expect(textOf('pause title')).toBe('MENU');
    expect(fold(card().title.text)).toBe('MENU');
  });

  it('drops the card’s two labels: neither is the board’s OPTIONS or NEW RUN', () => {
    const printed = card().rows.map((row) => row.label);
    expect(printed).toStrictEqual(['Settings', 'Reset run']);
    expect(buildView(SPEC).strings).not.toContain('Settings');
    expect(buildView(SPEC).strings).not.toContain('Reset run');
    const boardLabels = ['pause label 0', 'pause label 1', 'pause label 2', 'pause label 3'].map(textOf);
    expect(boardLabels).toStrictEqual(['CONTINUE', 'OPTIONS', 'NEW RUN', 'EXIT']);
    for (const line of printed) {
      expect(boardLabels.map(fold)).not.toContain(fold(line));
    }
  });

  it('prints none of the board’s four row labels', () => {
    const printed = [card().title.text, ...card().rows.map((row) => row.label)].map(fold);
    expect(printed).toStrictEqual(['MENU', 'SETTINGS', 'RESET RUN']);
    for (const label of ['CONTINUE', 'OPTIONS', 'NEW RUN', 'EXIT']) {
      expect(printed).not.toContain(label);
    }
  });
});

describe('the adapter stays pure', () => {
  it('imports no phaser, no DOM global, no clock and no rng', () => {
    expect(ADAPTER_SOURCE).not.toMatch(/from ['"]phaser['"]/);
    expect(ADAPTER_SOURCE).not.toContain('document.');
    expect(ADAPTER_SOURCE).not.toContain('window.');
    expect(ADAPTER_SOURCE).not.toContain('localStorage');
    expect(ADAPTER_SOURCE).not.toContain('Math.random');
    expect(ADAPTER_SOURCE).not.toContain('Date.now');
  });

  it('reads the pinned fixture and the panel’s own view module only', () => {
    expect(ADAPTER_SOURCE).toContain('design/fixtures/03n-panels-pause-menu.json');
    expect(ADAPTER_SOURCE).toContain("from '../panels/pause/view'");
  });
});
