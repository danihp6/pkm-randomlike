import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import optionsFixture from '../../../../../design/fixtures/02-options.json';
import screenSpec from '../../../../../design/screens/02-options.json';
import { gapFor, gapIsEmpty, type PanelView, type ScreenSpec, type SpecBox } from '../../specGap';
import { buildView, printedCopy, slug } from '../../specGap.views/options';
import { fixtureOptionsView, type OptionsView } from './view';

/**
 * The `02 Options` frame measured against the options screen's own view model: the adapter that
 * answers for this slug, the copy it claims, and the premise that makes `boxes: []` the honest
 * answer — 33 drawn boxes against a model that carries no rect, and two cards pinned at the
 * rects `options.css` has to paint.
 */

const SPEC: ScreenSpec = screenSpec;

const ADAPTER_SOURCE = readFileSync(
  fileURLToPath(new URL('../../specGap.views/options.ts', import.meta.url)),
  'utf8',
);

/** The two cards the stylesheet paints, as the frame draws them. */
const CARDS: Readonly<
  Record<string, Readonly<{ x: number; y: number; width: number; height: number }>>
> = {
  'card gameplay': { x: 96, y: 200, width: 640, height: 470 },
  'card keybinds': { x: 760, y: 200, width: 424, height: 470 },
};

/** The 35 text nodes of the frame, minus its four `<` / `>` step glyphs. */
const COPY: readonly string[] = [
  'SETTINGS',
  'Changes apply immediately and save to this browser.',
  'Keybinds are shared with the route and battle screens.',
  'BACK',
  'RESET DEFAULTS',
  'GAMEPLAY',
  'TEXT SPEED',
  'NORMAL',
  'VOLUME',
  '70%',
  'ALWAYS RUN',
  'OFF',
  'MENU OPACITY',
  '80%',
  'LANGUAGE',
  'ENGLISH',
  'KEYBINDS',
  'CONFIRM',
  'A',
  'CANCEL',
  'B',
  'RUN',
  'SHIFT',
  'PARTY',
  'P',
  'BAG',
  'I',
  'MAP',
  'M',
  'OPTIONS',
  'ESC',
];

const RECT_KEYS: readonly string[] = ['x', 'y', 'w', 'h', 'width', 'height', 'rect', 'box'];

const frameBox = (name: string): SpecBox => {
  const box = SPEC.boxes.find((entry) => entry.name === name);
  if (box === undefined) throw new Error(`the frame draws no box named "${name}"`);
  return box;
};

/** The desktop view of the pinned fixture, built exactly as the preview and the adapter build it. */
const desktopView = (): OptionsView => {
  const view = fixtureOptionsView(optionsFixture, false);
  if (view === null) throw new Error('the pinned options fixture no longer reads as a view');
  return view;
};

describe('the 02 adapter', () => {
  it('answers for the board frame it is named after', () => {
    expect(slug).toBe('02-options');
    expect(SPEC.slug).toBe(slug);
    expect(SPEC.boxes).toHaveLength(33);
    expect(SPEC.text).toHaveLength(35);
    expect(SPEC.colours).toHaveLength(16);
  });

  it('claims the model’s copy and no box and no colour', () => {
    const VIEW: PanelView = { boxes: [], strings: [...COPY], colours: [] };
    expect(buildView(SPEC)).toStrictEqual(VIEW);
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

describe('the premise: 33 boxes the model has no field for', () => {
  it('draws the two cards at 96, 200, 640, 470 and 760, 200, 424, 470', () => {
    for (const [name, rect] of Object.entries(CARDS)) {
      const box = frameBox(name);
      expect({ x: box.x, y: box.y, width: box.width, height: box.height }).toStrictEqual(rect);
    }
  });

  it('counts 33 frame boxes against 31 lines of copy and no rect at all', () => {
    expect(SPEC.boxes).toHaveLength(33);
    expect(buildView(SPEC).boxes).toStrictEqual([]);
    expect(COPY).toHaveLength(31);
    expect(SPEC.text).toHaveLength(COPY.length + 4);
  });

  it('carries no rect key on the view, on a group or on a row', () => {
    const view = desktopView();
    expect(Object.keys(view).sort()).toStrictEqual([
      'back',
      'footer',
      'groups',
      'reset',
      'selected',
      'subtitle',
      'title',
    ]);
    for (const group of view.groups) {
      const entries: readonly object[] = [group, ...group.rows];
      for (const entry of entries) {
        for (const key of RECT_KEYS) expect(Object.keys(entry)).not.toContain(key);
      }
    }
  });
});

describe('the copy claim', () => {
  it('prints the five head lines, then each group title and each row label and value', () => {
    const view = desktopView();
    expect(buildView(SPEC).strings).toStrictEqual([...COPY]);
    expect([view.title, view.subtitle, view.footer, view.back, view.reset]).toStrictEqual(
      COPY.slice(0, 5),
    );
    expect(view.groups.map((group) => group.title)).toStrictEqual(['GAMEPLAY', 'KEYBINDS']);
    expect(view.groups.flatMap((group) => group.rows.map((row) => row.id))).toStrictEqual([
      'textSpeed',
      'volume',
      'alwaysRun',
      'menuOpacity',
      'language',
      'confirm',
      'cancel',
      'run',
      'party',
      'bag',
      'map',
      'options',
    ]);
  });

  it('drops empty and null copy, so a view without a title or a reset prints neither', () => {
    const bare: OptionsView = {
      title: 'SETTINGS',
      subtitle: '',
      footer: '',
      back: 'BACK',
      reset: null,
      selected: null,
      groups: [
        {
          id: 'gameplay',
          title: '',
          rows: [{ id: 'volume', kind: 'slider', label: 'VOLUME', value: '', fraction: 0.7, on: null }],
        },
      ],
    };
    expect(printedCopy(bare)).toStrictEqual(['SETTINGS', 'BACK', 'VOLUME']);
    expect(printedCopy(null)).toStrictEqual([]);
  });

  it('claims no colour: every fill and hairline is options.css’s token', () => {
    expect(buildView(SPEC).colours).toStrictEqual([]);
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
    expect(ADAPTER_SOURCE).not.toContain("from '../../../i18n'");
  });

  it('reads the pinned fixture and the panel’s own view module only', () => {
    expect(ADAPTER_SOURCE).toContain('design/fixtures/02-options.json');
    expect(ADAPTER_SOURCE).toContain("from '../panels/options/view'");
    expect(ADAPTER_SOURCE).toContain('fixtureOptionsView');
  });
});
