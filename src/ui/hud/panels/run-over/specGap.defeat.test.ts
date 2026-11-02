import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import defeatFixture from '../../../../../design/fixtures/06-run-over-defeat.json';
import screenSpec from '../../../../../design/screens/06-run-over-defeat.json';
import { gapFor, gapIsEmpty, GAP_TOLERANCE, type ScreenSpec, type SpecBox } from '../../specGap';
import { buildView, buildViewFor, slug } from '../../specGap.views/run-over-defeat';
import { fixtureRunOverView, runOverBoard, type RunOverView } from './view';

/**
 * The `06 Run over · defeat` frame measured against the run-over card's own view model: the
 * adapter that answers for this slug, the four boxes it claims at the board's rects, the eight
 * the frame draws that it declares and does not claim, the fourteen strings the card and the
 * board share, and the empty claim a payload with no `runOver` block yields.
 */

const SPEC = screenSpec as ScreenSpec;

type FrameText = Readonly<{ name: string; characters: string }>;

const TEXT = screenSpec.text as unknown as readonly FrameText[];
const ADAPTER_SOURCE = readFileSync(
  fileURLToPath(new URL('../../specGap.views/run-over-defeat.ts', import.meta.url)),
  'utf8',
);

const fold = (line: string): string => line.trim().toUpperCase();

const textOf = (name: string): string => TEXT.find((node) => node.name === name)?.characters ?? '';

const frameBox = (name: string): SpecBox => {
  const box = SPEC.boxes.find((entry) => entry.name === name);
  if (box === undefined) throw new Error(`the frame draws no box named "${name}"`);
  return box;
};

/** The card at 1280×800, built exactly as the preview and the running panel build it. */
const card = (): RunOverView => {
  const built = fixtureRunOverView(defeatFixture);
  if (built === null) throw new Error('the pinned defeat fixture no longer reads as a card');
  return built;
};

const claimedNames = (): readonly string[] => buildView(SPEC).boxes.map((box) => box.name);

/** The fourteen lines the card prints, in view order, as the adapter claims them. */
const PRINTED: readonly string[] = [
  'YOU HAVE NO MORE POKEMON!',
  'THE RUN IS OVER · NOTHING CARRIES OVER.',
  'ROUTES CLEARED',
  '05',
  'POKEMON CAUGHT',
  '09',
  'POKEMON LOST',
  '06',
  'ENEMIES FAINTED',
  '23',
  'SHARE: PKRL-1-f-91C4-8B',
  'MAIN MENU',
  'TOTALS',
  'POKEMON',
];

describe('the 06 defeat adapter', () => {
  it('answers for the board frame it is named after', () => {
    expect(slug).toBe('06-run-over-defeat');
    expect(SPEC.slug).toBe(slug);
    expect(SPEC.boxes).toHaveLength(12);
    expect(SPEC.text).toHaveLength(14);
    expect(SPEC.colours).toHaveLength(14);
  });

  it('claims the panel, the button, the two tabs and the copy, and no colour', () => {
    expect(buildView(SPEC)).toStrictEqual({
      boxes: [
        { name: 'run over panel', x: 280, y: 170, w: 720, h: 480 },
        { name: 'main menu button', x: 540, y: 590, w: 200, h: 40 },
        { name: 'tab totals', x: 336, y: 312, w: 90, h: 24 },
        { name: 'tab pokemon', x: 432, y: 312, w: 100, h: 24 },
      ],
      strings: PRINTED,
      colours: [],
    });
  });

  it('reports an empty gap in all four lists against its own spec', () => {
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

  it('yields the empty view for a payload with no runOver block', () => {
    const empty = { boxes: [], strings: [], colours: [] };
    expect(buildViewFor({ slug, state: {} }, SPEC)).toStrictEqual(empty);
    expect(buildViewFor({ runOver: null }, SPEC)).toStrictEqual(empty);
    expect(buildViewFor({ runOver: { won: false } }, SPEC)).toStrictEqual(empty);
    expect(buildViewFor(null, SPEC)).toStrictEqual(empty);
  });
});

describe('the four boxes claimed', () => {
  it('lands the card’s panel and button on the desktop board’s own rects', () => {
    const board = runOverBoard('desktop');
    const claimed = buildView(SPEC).boxes;
    expect(claimed[0]).toStrictEqual({
      name: 'run over panel',
      x: board.panel.x,
      y: board.panel.y,
      w: board.panel.w,
      h: board.panel.h,
    });
    expect(claimed[1]).toStrictEqual({
      name: 'main menu button',
      x: board.button.x,
      y: board.button.y,
      w: board.button.w,
      h: board.button.h,
    });
    expect(board.panel).toStrictEqual({ x: 280, y: 170, w: 720, h: 480, radius: 11 });
    expect(board.button).toStrictEqual({ x: 540, y: 590, w: 200, h: 40 });
  });

  it('lands both tabs on the board’s own rects', () => {
    const board = runOverBoard('desktop');
    const claimed = buildView(SPEC).boxes;
    expect(claimed[2]).toStrictEqual({
      name: 'tab totals',
      x: board.tabs[0]!.x,
      y: board.tabs[0]!.y,
      w: board.tabs[0]!.w,
      h: board.tabs[0]!.h,
    });
    expect(claimed[3]).toStrictEqual({
      name: 'tab pokemon',
      x: board.tabs[1]!.x,
      y: board.tabs[1]!.y,
      w: board.tabs[1]!.w,
      h: board.tabs[1]!.h,
    });
  });

  it('claims no box the frame does not draw, and none off its frame rect', () => {
    for (const box of buildView(SPEC).boxes) {
      const frame = frameBox(box.name);
      expect({ x: box.x, y: box.y, w: box.w, h: box.h }).toStrictEqual({
        x: frame.x,
        y: frame.y,
        w: frame.width,
        h: frame.height,
      });
      expect(Math.abs(box.x - frame.x)).toBeLessThanOrEqual(GAP_TOLERANCE);
      expect(Math.abs(box.y - frame.y)).toBeLessThanOrEqual(GAP_TOLERANCE);
      expect(Math.abs(box.w - frame.width)).toBeLessThanOrEqual(GAP_TOLERANCE);
      expect(Math.abs(box.h - frame.height)).toBeLessThanOrEqual(GAP_TOLERANCE);
    }
  });
});

describe('the eight boxes declared and not claimed', () => {
  const DECLARED: readonly string[] = [
    'run over panel highlight',
    'run over accent',
    'run over rule 0',
    'run over rule 1',
    'run over rule 2',
    'run over rule 3',
    'route screenshot',
    'scrim',
  ];

  it.each(DECLARED)('draws %s and does not claim it', (name) => {
    expect(frameBox(name)).toBeDefined();
    expect(claimedNames()).not.toContain(name);
  });

  it('never claims a text node as a box: the frame’s four stat rows have none', () => {
    expect(textOf('run stat label 0')).toBe('ROUTES CLEARED');
    for (const name of ['run over title', 'run over blurb', 'run share']) {
      expect(SPEC.boxes.map((box) => box.name)).not.toContain(name);
    }
    expect(claimedNames()).toStrictEqual([
      'run over panel',
      'main menu button',
      'tab totals',
      'tab pokemon',
    ]);
  });
});

describe('the copy it claims and the copy it does not', () => {
  it('claims the title and the blurb, folded on both sides', () => {
    expect(textOf('run over title')).toBe('YOU HAVE NO MORE POKEMON!');
    expect(textOf('run over blurb')).toBe('THE RUN IS OVER · NOTHING CARRIES OVER.');
    expect(fold(card().title)).toBe(fold(textOf('run over title')));
    expect(fold(card().blurb)).toBe(fold(textOf('run over blurb')));
    expect(buildView(SPEC).strings.slice(0, 2)).toStrictEqual([card().title, card().blurb]);
  });

  it('claims each of the four stat rows’ label and value, both halves', () => {
    const stats = card().stats;
    expect(stats.map((stat) => stat.id)).toStrictEqual(['routes', 'catches', 'lost', 'fainted']);
    for (const [index, stat] of stats.entries()) {
      expect(textOf(`run stat label ${index}`)).toBe(stat.label);
      expect(textOf(`run stat value ${index}`)).toBe(stat.value);
      expect(buildView(SPEC).strings).toContain(stat.label);
      expect(buildView(SPEC).strings).toContain(stat.value);
    }
  });

  it('claims the share line, the button and both tab labels', () => {
    expect(textOf('run share')).toBe(card().share);
    expect(textOf('button label main menu')).toBe(card().button.label);
    expect(textOf('tab totals label')).toBe(card().tabLabels.totals);
    expect(textOf('tab pokemon label')).toBe(card().tabLabels.pokemon);
    for (const line of [
      card().share,
      card().button.label,
      card().tabLabels.totals,
      card().tabLabels.pokemon,
    ]) {
      expect(buildView(SPEC).strings).toContain(line);
    }
  });

  it('drops a line the board does not carry instead of padding the list', () => {
    const relabelled = {
      ...defeatFixture,
      runOver: { ...defeatFixture.runOver, title: 'GOOD GAME' },
    };
    expect(fixtureRunOverView(relabelled)).not.toBeNull();
    const claimed = buildViewFor(relabelled, SPEC).strings;
    expect(claimed).not.toContain('GOOD GAME');
    expect(claimed).toHaveLength(PRINTED.length - 1);
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
    expect(ADAPTER_SOURCE).toContain('design/fixtures/06-run-over-defeat.json');
    expect(ADAPTER_SOURCE).toContain("from '../panels/run-over/view'");
  });
});
