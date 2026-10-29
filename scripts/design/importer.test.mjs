import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildFileFromFrames, projectBoard, slugOf } from './importer.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const readJson = (relative) => JSON.parse(readFileSync(`${ROOT}/${relative}`, 'utf8'));

const FIXTURE_FILE = 'scripts/design/fixtures/file.json';
const FIXTURE_NODES = 'scripts/design/fixtures/nodes.json';
const FIXTURE_MAP = 'scripts/design/fixtures/map.json';
const FIXTURE_DUMPS = 'scripts/design/fixtures/frames';

const fixtureDumps = () => [readJson(`${FIXTURE_DUMPS}/02-options.json`), readJson(`${FIXTURE_DUMPS}/m02-options.json`)];

function fixturePayload() {
  const index = readJson(FIXTURE_FILE);
  const nodes = readJson(FIXTURE_NODES);
  const page = index.document.children[0];
  return {
    name: index.name,
    lastModified: index.lastModified,
    document: {
      id: '0:0',
      name: index.name,
      type: 'DOCUMENT',
      children: [{ ...page, children: page.children.map((frame) => nodes.nodes[frame.id].document) }],
    },
  };
}

const fixtureMap = () => readJson(FIXTURE_MAP);

describe('slugOf', () => {
  it('is the board lower-kebab, middle dots included', () => {
    expect(slugOf('03 Route HUD')).toBe('03-route-hud');
    expect(slugOf('01b Main menu · no save')).toBe('01b-main-menu-no-save');
    expect(slugOf('07b Run over · victory · pokemon')).toBe('07b-run-over-victory-pokemon');
  });
});

describe('shipped map', () => {
  const map = readJson('design/import.json');
  const board = readJson('design/board.json');
  const slugs = map.screens.map((screen) => screen.slug);

  it('maps exactly 33 screens, ordered by slug', () => {
    expect(map.page).toBe(board.page);
    expect(map.fileKey).toBe('nfyJ8Yerc6lL1BouvCAfd3');
    expect(map.screens).toHaveLength(33);
    expect(slugs).toEqual([...slugs].sort());
    expect(new Set(slugs).size).toBe(33);
  });

  it('takes every caption and panel from the committed board', () => {
    for (const screen of map.screens) {
      const row = board.frames[screen.slug];
      expect(row, `board row for ${screen.slug}`).toBeTruthy();
      expect(screen.caption).toBe(row.name);
      expect(screen.panel).toBe(row.panel);
    }
  });

  it('points every mobile twin and state at a frame the board exports', () => {
    const known = new Set(Object.keys(board.frames));
    for (const row of Object.values(board.frames)) {
      for (const key of Object.keys(row.exports)) known.add(key);
    }
    for (const screen of map.screens) {
      expect(screen.mobile).toBe(`m${screen.slug}`);
      expect(known.has(screen.mobile), screen.mobile).toBe(true);
      expect(Array.isArray(screen.states)).toBe(true);
      for (const state of screen.states) expect(known.has(state), `${screen.slug}: ${state}`).toBe(true);
      expect(screen.snapshot).toBe(true);
    }
  });

  it('corrects the rocket row the stale index still points at the casino', () => {
    const rocket = map.screens.find((screen) => screen.slug === '03h-panels-rocket-slots');
    expect(rocket.scene).toBe('src/ui/rocketPanel.ts');
    expect(board.frames['03h-panels-rocket-slots'].scene).toBe('src/scenes/rooms/casino.ts');
  });
});

describe('fixtures', () => {
  it('projects one screen, one board entry and a self-contained token palette', () => {
    const { screens, tokens, board, problems } = projectBoard(fixturePayload(), fixtureMap());

    expect(problems).toEqual([]);
    expect(screens).toHaveLength(1);
    expect(Object.keys(board.frames)).toEqual(['02-options']);

    const [screen] = screens;
    expect(screen.slug).toBe('02-options');
    expect(screen.nodeId).toBe('1:1557');
    expect(screen.viewport).toEqual({ width: 1280, height: 800 });
    expect(screen.mobile).toEqual({ slug: 'm02-options', nodeId: '8:3231' });
    expect(screen.boxes[0]).toEqual({
      id: '1:1610',
      name: 'panel',
      type: 'RECTANGLE',
      x: 360,
      y: 216,
      width: 560,
      height: 342,
      radius: 11,
      fill: '#10161f@0.92',
      stroke: '#ffffff@0.16',
    });
    expect(screen.text.map((line) => line.characters)).toEqual(['SETTINGS', 'MUSIC', 'M']);
    expect(screen.colours).toEqual([...screen.colours].sort());

    const palette = new Set(tokens.palette.map((entry) => `${entry.colour}@${entry.alpha}`));
    for (const literal of screen.colours) expect(palette.has(literal), literal).toBe(true);
    expect(tokens.source.frames).toBe(2);
    expect(board.frames['02-options'].exports).toEqual({
      '02-options': { nodeId: '1:1557' },
      'm02-options': { nodeId: '8:3231' },
    });
  });

  it('keeps the whole palette instead of truncating it', () => {
    const file = fixturePayload();
    const desktop = file.document.children[0].children[0];
    const swatches = Array.from({ length: 30 }, (_, index) => index);
    for (const index of swatches) {
      desktop.children.push({
        id: `9:${index}`,
        name: `swatch ${index}`,
        type: 'RECTANGLE',
        properties: {
          x: index,
          y: 700,
          width: 10,
          height: 10,
          cornerRadius: 0,
          fills: [{ type: 'SOLID', visible: true, opacity: 1, color: { r: index / 40, g: 0.5, b: 0.5 } }],
          strokes: [],
        },
      });
    }

    const { tokens } = projectBoard(file, fixtureMap());
    expect(tokens.palette.length).toBeGreaterThanOrEqual(30);
    const colours = new Set(tokens.palette.map((entry) => entry.colour));
    for (const index of swatches) {
      const hex = Math.round((index / 40) * 255)
        .toString(16)
        .padStart(2, '0');
      expect(colours.has(`#${hex}8080`), hex).toBe(true);
    }
  });

  it('returns deeply equal values, in the same key order, for the same arguments', () => {
    const first = JSON.stringify(projectBoard(fixturePayload(), fixtureMap()), null, 2);
    const second = JSON.stringify(projectBoard(fixturePayload(), fixtureMap()), null, 2);
    expect(first).toBe(second);
  });
});

describe('shipped board scale', () => {
  const solid = (r, g, b, opacity = 1) => ({ type: 'SOLID', visible: true, opacity, color: { r, g, b } });

  const frameOf = (index, entry) => [
    {
      id: `1:${index}`,
      name: entry.caption,
      type: 'FRAME',
      properties: { x: (index % 4) * 1790, y: Math.floor(index / 4) * 880, width: 1280, height: 800, fills: [solid(0.02, 0.027, 0.047)], strokes: [] },
      children: [
        {
          id: `2:${index}`,
          name: 'panel',
          type: 'RECTANGLE',
          properties: { x: 360, y: 216, width: 560, height: 342, cornerRadius: 11, fills: [solid(0.06, 0.09, 0.12, 0.92)], strokes: [solid(1, 1, 1, 0.16)] },
        },
        {
          id: `3:${index}`,
          name: 'title',
          type: 'TEXT',
          properties: { characters: entry.caption, x: 384, y: 228, width: 255, height: 23, fontSize: 18, fills: [solid(0.97, 0.98, 0.99)] },
        },
      ],
    },
    {
      id: `8:${index}`,
      name: `M ${entry.caption}`,
      type: 'FRAME',
      properties: { x: (index % 4) * 1790 + 1320, y: Math.floor(index / 4) * 880, width: 390, height: 844, fills: [solid(0.02, 0.027, 0.047)], strokes: [] },
      children: [
        {
          id: `9:${index}`,
          name: 'mobile panel',
          type: 'RECTANGLE',
          properties: { x: 8, y: 271, width: 374, height: 302, cornerRadius: 11, fills: [solid(0.06, 0.09, 0.12, 0.92)], strokes: [solid(1, 1, 1, 0.16)] },
        },
      ],
    },
  ];

  it('resolves all 33 captions and measures the board grid back', () => {
    const map = readJson('design/import.json');
    const children = map.screens.flatMap((entry, index) => frameOf(index, entry));
    const file = {
      name: 'pkm-randomlike',
      document: { id: '0:0', name: 'Document', type: 'DOCUMENT', children: [{ id: '0:1', name: 'Page 1', type: 'CANVAS', children }] },
    };

    const { screens, tokens, board, problems } = projectBoard(file, map);
    expect(problems).toEqual([]);
    expect(screens).toHaveLength(33);
    expect(Object.keys(board.frames)).toHaveLength(33);
    expect(tokens.source).toEqual({ frames: 66, textSizes: 1 });
    expect(tokens.panelWidth).toBe(374);
    expect(tokens.gutter).toBe(8);
    expect(tokens.grid).toEqual({ pitch: 1790, mobileOffset: 1320 });
    expect(tokens.safeArea).toEqual({ top: 47, bottom: 810, source: 'docs/hud-fidelity.md §5, not drawn on the board' });
  });
});

describe('problems', () => {  it('reports a caption the file does not draw and omits its screen', () => {
    const map = fixtureMap();
    map.screens.push({
      slug: '99-missing',
      caption: '99 Missing',
      panel: 'options',
      scene: 'src/scenes/SettingsScene.ts',
      mobile: 'm99-missing',
      states: [],
      snapshot: true,
    });

    const { screens, board, problems } = projectBoard(fixturePayload(), map);
    expect(problems).toEqual([{ code: 'frame_missing', slug: '99-missing', detail: '99 Missing' }]);
    expect(screens.map((screen) => screen.slug)).toEqual(['02-options']);
    expect(board.frames['99-missing']).toBeUndefined();
  });

  it('reports a missing mobile twin and leaves the screen without one', () => {
    const file = fixturePayload();
    file.document.children[0].children[1].name = 'M 02 Options (retired)';

    const { screens, board, problems } = projectBoard(file, fixtureMap());
    expect(problems).toEqual([{ code: 'mobile_missing', slug: '02-options', detail: 'M 02 Options' }]);
    expect(screens[0].mobile).toBeNull();
    expect(board.frames['02-options'].mobile).toBeNull();
    expect(Object.keys(board.frames['02-options'].exports)).toEqual(['02-options']);
  });

  it('reports a declared state no frame carries, without dropping the screen', () => {
    const map = fixtureMap();
    map.screens[0].states = ['02-options-armed'];

    const { screens, problems } = projectBoard(fixturePayload(), map);
    expect(problems).toEqual([{ code: 'variant_missing', slug: '02-options', detail: '02-options-armed' }]);
    expect(screens[0].states).toEqual(['02-options-armed']);
  });
});

describe('buildFileFromFrames', () => {
  const findNode = (node, id) => {
    if (node.id === id) return node;
    for (const child of node.children ?? []) {
      const found = findNode(child, id);
      if (found) return found;
    }
    return null;
  };

  const walkAll = (node, visit) => {
    visit(node);
    for (const child of node.children ?? []) walkAll(child, visit);
  };

  it('rebuilds the REST payload the exporter dumps describe', () => {
    const { file, problems } = buildFileFromFrames(fixtureDumps());

    expect(problems).toEqual([]);
    expect(file.name).toBe('pkm-randomlike');
    expect(file.lastModified).toBe('2026-10-21T18:23:44Z');
    expect(file.document).toMatchObject({ id: '0:0', type: 'DOCUMENT' });
    expect(file.document.children).toHaveLength(1);
    expect(file.document.children[0]).toMatchObject({ id: '0:1', name: 'Page 1', type: 'CANVAS' });
    expect(file.document.children[0].children.map((node) => node.name)).toEqual(['02 Options', 'M 02 Options']);
  });

  it('projects the same screens and tokens as the REST fixture', () => {
    const offline = projectBoard(buildFileFromFrames(fixtureDumps()).file, fixtureMap());
    const rest = projectBoard(fixturePayload(), fixtureMap());

    expect(offline.problems).toEqual([]);
    expect(JSON.stringify(offline.screens)).toBe(JSON.stringify(rest.screens));
    expect(JSON.stringify(rest.screens)).toBe(JSON.stringify(offline.screens));
    expect(JSON.stringify(offline.tokens)).toBe(JSON.stringify(rest.tokens));
    expect(JSON.stringify(rest.tokens)).toBe(JSON.stringify(offline.tokens));
  });

  it('does not depend on the order the dumps arrive in', () => {
    const [desktop, mobile] = fixtureDumps();
    const first = buildFileFromFrames([desktop, mobile]);
    const second = buildFileFromFrames([mobile, desktop]);

    expect(JSON.stringify(first.file)).toBe(JSON.stringify(second.file));
    expect(second.problems).toEqual([]);

    const duplicate = { ...desktop, slug: '00-duplicate' };
    const duplicated = buildFileFromFrames([duplicate, desktop, mobile]);
    const reversed = buildFileFromFrames([mobile, desktop, duplicate]);
    expect(duplicated.problems).toEqual(reversed.problems);
    expect(JSON.stringify(duplicated.file)).toBe(JSON.stringify(reversed.file));
  });

  it('merges the text tree back by node id, appending only the three text keys', () => {
    const [desktop] = fixtureDumps();
    const { file } = buildFileFromFrames([desktop]);
    const root = file.document.children[0].children[0];
    const geometryRoot = desktop.geometry[0];

    expect(Object.keys(root)).toEqual(Object.keys(geometryRoot));
    const holdsText = (node) => node.type === 'TEXT' || (node.children ?? []).some(holdsText);
    walkAll(geometryRoot, (node) => {
      const merged = findNode(root, node.id);
      expect(Object.keys(merged), node.id).toEqual(Object.keys(node));
      if (!holdsText(node)) expect(merged, node.id).toEqual(node);
    });

    const title = findNode(root, '1:1612');
    expect(Object.keys(title.properties)).toEqual([
      ...Object.keys(findNode(geometryRoot, '1:1612').properties),
      'characters',
      'fontName',
      'fontSize',
    ]);
    expect(title.properties.characters).toBe('SETTINGS');
    expect(title.properties.fontName).toEqual({ family: 'Silkscreen', style: 'Bold' });
    expect(title.properties.fontSize).toBe(40);
  });

  it('is fatal and names a duplicated caption, keeping the first frame in sorted order', () => {
    const [desktop, mobile] = fixtureDumps();
    const duplicate = { ...desktop, slug: '02b-options-duplicate' };

    const { file, problems } = buildFileFromFrames([desktop, mobile, duplicate]);
    expect(problems).toEqual([{ code: 'frame_duplicated', slug: '02b-options-duplicate', detail: '02 Options' }]);
    expect(file.document.children[0].children.map((node) => node.name)).toEqual(['02 Options', 'M 02 Options']);
  });

  it('takes lastModified from the dumps, never from a clock', () => {
    const [desktop, mobile] = fixtureDumps();
    const stale = { ...desktop, slug: '00-stale', exportedAt: '2026-01-01T00:00:00.000Z' };
    const fresh = { ...mobile, exportedAt: '2026-02-02T00:00:00.000Z' };

    expect(buildFileFromFrames([stale, fresh]).file.lastModified).toBe('2026-02-02T00:00:00.000Z');
    expect(buildFileFromFrames([stale]).file.lastModified).toBe('2026-01-01T00:00:00.000Z');
    expect(buildFileFromFrames([]).file.lastModified).toBeNull();
    expect(buildFileFromFrames([{ slug: 'empty' }]).file.lastModified).toBeNull();
  });

  it('leaves a dump with no root node out, so the map reports it missing', () => {
    const [desktop, mobile] = fixtureDumps();
    const { file, problems } = buildFileFromFrames([{ slug: '02-options' }, mobile]);

    expect(problems).toEqual([]);
    expect(file.document.children[0].children.map((node) => node.name)).toEqual(['M 02 Options']);
    expect(projectBoard(file, fixtureMap()).problems).toEqual([
      { code: 'frame_missing', slug: '02-options', detail: '02 Options' },
    ]);
  });
});
