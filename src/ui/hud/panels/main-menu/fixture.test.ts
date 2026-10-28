import { describe, expect, it } from 'vitest';
import frame from '../../../../../design/frames/01-main-menu.json';
import noSaveFrame from '../../../../../design/frames/01b-main-menu-no-save.json';
import phoneFrame from '../../../../../design/frames/m01-main-menu.json';
import phoneNoSaveFrame from '../../../../../design/frames/m01b-main-menu-no-save.json';
import noSaveFixture from '../../../../../design/fixtures/01b-main-menu-no-save.json';
import fixture from '../../../../../design/fixtures/01-main-menu.json';
import { isHudState } from '../../fixtures';
import { PORTRAIT_SHINY_ATLAS_URL } from '../../../../data/portraits';
import { t } from '../../../../i18n';
import { portraitCrop } from '../../portrait';
import {
  MAIN_MENU_BOARD,
  MAIN_MENU_BOARD_NARROW,
  MAIN_MENU_SLUG,
  fixtureMainMenuView,
  type MainMenuRowId,
  type MainMenuView,
} from './index';

type Node = Readonly<{
  name?: string;
  type?: string;
  properties?: Readonly<{
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    characters?: string;
  }>;
  children?: readonly Node[];
}>;

type Frame = Readonly<{ slug: string; geometry: readonly Node[]; text: readonly Node[] }>;

type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;

/** The frame's own row nodes, in board order; RANKING has none (the board predates it). */
const ROW_NODES: Readonly<Partial<Record<MainMenuRowId, string>>> = {
  continue: 'row sel CONTINUE',
  new: 'row NEW RUN',
  options: 'row OPTIONS',
  stats: 'row STATS',
};

function nodesOf(tree: readonly Node[]): readonly Node[] {
  const out: Node[] = [];
  const walk = (node: Node): void => {
    out.push(node);
    for (const child of node.children ?? []) walk(child);
  };
  for (const node of tree) walk(node);
  return out;
}

function named(frame: Frame, tree: 'geometry' | 'text', name: string): readonly Node[] {
  return nodesOf(frame[tree]).filter((node) => node.name === name);
}

/** The frame's own rect for a uniquely named node; a missing node fails loudly with -1s. */
function rectOf(frame: Frame, name: string): Rect {
  const properties = named(frame, 'geometry', name)[0]?.properties ?? {};
  return {
    x: properties.x ?? -1,
    y: properties.y ?? -1,
    w: properties.width ?? -1,
    h: properties.height ?? -1,
  };
}

function textOf(frame: Frame, name: string): string {
  return named(frame, 'text', name)[0]?.properties?.characters ?? '';
}

/** The box a printed string sits in: the text node that carries it, then its rect. */
function printedRect(frame: Frame, characters: string): Rect {
  const node = nodesOf(frame.text).find((entry) => entry.properties?.characters === characters);
  expect(node, `no text node prints ${JSON.stringify(characters)}`).toBeDefined();
  const properties = node!.properties ?? {};
  const rect = named(frame, 'geometry', node!.name ?? '').find(
    (entry) => entry.properties?.x === properties.x && entry.properties?.y === properties.y,
  );
  expect(rect, `no geometry node under ${JSON.stringify(characters)}`).toBeDefined();
  const box = rect!.properties ?? {};
  return { x: box.x ?? -1, y: box.y ?? -1, w: box.width ?? -1, h: box.height ?? -1 };
}

/** The row a view draws at the frame's first row y (the frame's own selected row). */
function selectedAtTop(view: MainMenuView, frame: Frame): MainMenuRowId | null {
  let top = Number.POSITIVE_INFINITY;
  let id: MainMenuRowId | null = null;
  for (const row of view.rows) {
    const name = ROW_NODES[row.id];
    if (name === undefined) continue;
    const rect = rectOf(frame, name);
    if (rect.y < top) {
      top = rect.y;
      id = row.id;
    }
  }
  return id;
}

/** A payload cloned from the menu fixture with one mutation applied. */
function payloadWith(edit: (menu: Record<string, unknown>) => void): unknown {
  const clone = JSON.parse(JSON.stringify(fixture)) as { menu: Record<string, unknown> };
  edit(clone.menu);
  return clone;
}

describe('design/fixtures/01-main-menu.json', () => {
  const view = fixtureMainMenuView(fixture);

  it('carries a snapshot state that passes isHudState unchanged', () => {
    expect(isHudState(fixture.state)).toBe(true);
    expect(Object.keys(fixture.state)).toEqual(['party', 'bag', 'money', 'route', 'battle', 'notice']);
  });

  it('draws the frame’s four rows and the fifth, RANKING, with its own labels and values', () => {
    expect(view).not.toBeNull();
    const desktop = frame as Frame;
    expect(view!.rows.map((row) => row.id)).toEqual(['continue', 'new', 'options', 'stats', 'ranking']);
    expect(view!.rows.map((row) => row.label)).toEqual([
      textOf(desktop, 'row label CONTINUE'),
      textOf(desktop, 'row label NEW RUN'),
      textOf(desktop, 'row label OPTIONS'),
      textOf(desktop, 'row label STATS'),
      t('stats.actionRanking'),
    ]);
    expect(view!.rows[0]!.value).toBe(textOf(desktop, 'row value CONTINUE'));
    expect(view!.rows[1]!.value).toBe(textOf(desktop, 'row value NEW RUN'));
    expect(view!.rows.map((row) => row.value).slice(2)).toEqual(['', '', '']);
    expect(view!.rows.every((row) => row.enabled)).toBe(true);
  });

  it('selects the row the frame draws at its first row y', () => {
    const desktop = frame as Frame;
    expect(selectedAtTop(view!, desktop)).toBe('continue');
    expect(view!.selected).toBe('continue');
    expect(rectOf(desktop, ROW_NODES.continue!).y).toBe(MAIN_MENU_BOARD.row.top);
  });

  it('draws one portrait per party member, in party order', () => {
    const phone = phoneFrame as Frame;
    expect(view!.portraits.length).toBe(fixture.state.party.length);
    expect(view!.portraits.map((portrait) => portrait.memberId)).toEqual(
      fixture.state.party.map((row) => row.id),
    );
    expect(view!.portraits.map((portrait) => portrait.name)).toEqual([
      'Charmander',
      'Pikachu',
      'Bulbasaur',
      'Gastly',
    ]);
    // The mobile frame names one cell per member, four in all (`portrait CH` …).
    expect(named(phone, 'geometry', 'portrait CH').length).toBe(1);
    expect(named(phone, 'geometry', 'portrait GA').length).toBe(1);
  });

  it('reads each portrait cell from the state row’s own species', () => {
    expect(view!.portraits.map((portrait) => portrait.portrait)).toEqual(
      fixture.state.party.map((row) => portraitCrop(row.speciesId, row.shiny)),
    );
    for (const portrait of view!.portraits) expect(portrait.portrait).not.toBeNull();
    expect(view!.portraits[3]!.portrait!.url).toBe(PORTRAIT_SHINY_ATLAS_URL);
  });

  it('prints the frame’s title, version and three figures', () => {
    const desktop = frame as Frame;
    expect(view!.title).toBe(textOf(desktop, 'title'));
    expect(view!.version).toBe(textOf(desktop, 'version'));
    expect(view!.stats.map((stat) => [stat.id, stat.label, stat.value, stat.name])).toEqual([
      ['wins', textOf(desktop, 'stat label WINS'), '23', null],
      ['elite', textOf(desktop, 'stat label MAX ELITE STRIKE'), '2', null],
      ['monthly', textOf(desktop, 'stat label MONTHLY MAX STRIKE'), '7', 'NOVA'],
    ]);
    expect(view!.stats[2]!.name).toBe(textOf(desktop, 'stat name MONTHLY MAX STRIKE'));
  });

  it('pins the desktop board to the frame’s own rects', () => {
    const desktop = frame as Frame;
    expect(MAIN_MENU_BOARD.title).toEqual(rectOf(desktop, 'title'));
    expect(MAIN_MENU_BOARD.rule).toEqual(rectOf(desktop, 'accent rule'));
    expect(MAIN_MENU_BOARD.window).toEqual(rectOf(desktop, 'route window'));
    expect(MAIN_MENU_BOARD.footerRule).toEqual(rectOf(desktop, 'stats rule'));
    expect(MAIN_MENU_BOARD.version).toEqual(rectOf(desktop, 'version'));

    const card = rectOf(desktop, 'menu card');
    expect({ x: MAIN_MENU_BOARD.card.x, y: MAIN_MENU_BOARD.card.y, w: MAIN_MENU_BOARD.card.w }).toEqual({
      x: card.x,
      y: card.y,
      w: card.w,
    });

    const first = rectOf(desktop, ROW_NODES.continue!);
    const second = rectOf(desktop, ROW_NODES.new!);
    expect(MAIN_MENU_BOARD.row).toEqual({
      x: first.x,
      w: first.w,
      h: first.h,
      pitch: second.y - first.y,
      top: first.y,
    });

    expect(MAIN_MENU_BOARD.footer.columns).toEqual([
      rectOf(desktop, 'stat label WINS').x,
      rectOf(desktop, 'stat label MAX ELITE STRIKE').x,
      rectOf(desktop, 'stat label MONTHLY MAX STRIKE').x,
    ]);
    expect(MAIN_MENU_BOARD.footer.labelY).toBe(rectOf(desktop, 'stat label WINS').y);
    expect(MAIN_MENU_BOARD.footer.valueY).toBe(rectOf(desktop, 'stat value WINS').y);
    expect(MAIN_MENU_BOARD.footer.nameY).toBe(rectOf(desktop, 'stat name MONTHLY MAX STRIKE').y);

    const slot = rectOf(desktop, 'slot 0');
    expect(MAIN_MENU_BOARD.portrait).toEqual({
      size: slot.h,
      x: slot.x,
      y: slot.y,
      pitch: rectOf(desktop, 'slot 1').x - slot.x,
    });
    expect(slot.w).toBe(slot.h);
  });
});

describe('design/fixtures/01b-main-menu-no-save.json', () => {
  const view = fixtureMainMenuView(noSaveFixture);

  it('carries an empty snapshot state that passes isHudState unchanged', () => {
    expect(isHudState(noSaveFixture.state)).toBe(true);
    expect(Object.keys(noSaveFixture.state)).toEqual([
      'party',
      'bag',
      'money',
      'route',
      'battle',
      'notice',
    ]);
    expect(noSaveFixture.state.party).toEqual([]);
    expect(noSaveFixture.state.route).toBeNull();
  });

  it('draws the frame’s three rows plus RANKING, and no CONTINUE anywhere', () => {
    expect(view).not.toBeNull();
    const desktop = noSaveFrame as Frame;
    expect(view!.rows.map((row) => row.id)).toEqual(['new', 'options', 'stats', 'ranking']);
    expect(JSON.stringify(noSaveFixture)).not.toContain('CONTINUE');
    expect(view!.rows.map((row) => row.label)).toEqual([
      textOf(desktop, 'row label NEW RUN'),
      textOf(desktop, 'row label OPTIONS'),
      textOf(desktop, 'row label STATS'),
      t('stats.actionRanking'),
    ]);
    expect(view!.rows[0]!.value).toBe(textOf(desktop, 'row value NEW RUN'));
    expect(view!.rows.map((row) => row.value).slice(1)).toEqual(['', '', '']);
  });

  it('selects NEW RUN, the row drawn at the frame’s first row y', () => {
    const desktop = noSaveFrame as Frame;
    expect(selectedAtTop(view!, desktop)).toBe('new');
    expect(view!.selected).toBe('new');
    const first = rectOf(desktop, ROW_NODES.new!);
    expect(first.y).toBe(MAIN_MENU_BOARD.row.top);
    expect(rectOf(desktop, ROW_NODES.options!).y - first.y).toBe(MAIN_MENU_BOARD.row.pitch);
  });

  it('draws no portrait and keeps the frame’s footer and version', () => {
    expect(view!.portraits).toEqual([]);
    expect(fixtureMainMenuView(noSaveFixture)!.stats.map((stat) => stat.value)).toEqual([
      '23',
      '2',
      '7',
    ]);
    expect(view!.version).toBe(textOf(noSaveFrame as Frame, 'version'));
    expect(view!.title).toBe(textOf(noSaveFrame as Frame, 'title'));
  });
});

describe('the phone frames', () => {
  const phone = phoneFrame as Frame;
  const phoneNoSave = phoneNoSaveFrame as Frame;

  it('pins the narrow board to the m01 rects', () => {
    const title = printedRect(phone, 'POKERANDOMLIKE');
    expect(MAIN_MENU_BOARD_NARROW.title).toEqual(title);
    expect(MAIN_MENU_BOARD_NARROW.rule).toEqual(rectOf(phone, 'm rule'));
    expect(MAIN_MENU_BOARD_NARROW.window).toEqual(rectOf(phone, 'm route window'));

    const card = rectOf(phone, 'm menu card');
    expect({
      x: MAIN_MENU_BOARD_NARROW.card.x,
      y: MAIN_MENU_BOARD_NARROW.card.y,
      w: MAIN_MENU_BOARD_NARROW.card.w,
    }).toEqual({ x: card.x, y: card.y, w: card.w });

    const first = rectOf(phone, 'm row CONTINUE');
    const second = rectOf(phone, 'm row NEW RUN');
    expect(MAIN_MENU_BOARD_NARROW.row).toEqual({
      x: first.x,
      w: first.w,
      h: first.h,
      pitch: second.y - first.y,
      top: first.y,
    });

    expect(MAIN_MENU_BOARD_NARROW.footer.labelY).toBe(printedRect(phone, 'WINS').y);
    expect(MAIN_MENU_BOARD_NARROW.footer.valueY).toBe(printedRect(phone, '23').y);
    expect(MAIN_MENU_BOARD_NARROW.footer.columns).toEqual([
      printedRect(phone, 'WINS').x,
      printedRect(phone, 'MAX STRIKE').x,
      printedRect(phone, 'MONTHLY').x,
    ]);

    const cell = rectOf(phone, 'portrait CH');
    expect(MAIN_MENU_BOARD_NARROW.portrait).toEqual({
      size: cell.h,
      y: cell.y,
      pitch: rectOf(phone, 'portrait PI').x - cell.x,
    });
    expect(cell.w).toBe(cell.h);
  });

  it('keeps the no-save phone frame on the same columns and one row shorter', () => {
    const first = rectOf(phoneNoSave, 'm row NEW RUN');
    expect(first.y).toBe(MAIN_MENU_BOARD_NARROW.row.top);
    expect(rectOf(phoneNoSave, 'm row OPTIONS').y - first.y).toBe(MAIN_MENU_BOARD_NARROW.row.pitch);
    expect(printedRect(phoneNoSave, '23').y).toBe(MAIN_MENU_BOARD_NARROW.footer.valueY);
    expect(printedRect(phoneNoSave, 'WINS').x).toBe(MAIN_MENU_BOARD_NARROW.footer.columns[0]);
  });
});

describe('fixtureMainMenuView guards', () => {
  it('falls back to the frame’s slug for a payload that carries no preview seed', () => {
    expect(fixtureMainMenuView(fixture)!.previewSeed).toBe(MAIN_MENU_SLUG);
    expect(fixtureMainMenuView(noSaveFixture)!.previewSeed).toBe(MAIN_MENU_SLUG);
    expect(JSON.stringify(fixture)).not.toContain('previewSeed');
  });

  it('reads a preview seed the payload does carry, and ignores an empty one', () => {
    const seeded = payloadWith((menu) => {
      menu.previewSeed = 'frame-seed';
    });
    const empty = payloadWith((menu) => {
      menu.previewSeed = '';
    });

    expect(fixtureMainMenuView(seeded)!.previewSeed).toBe('frame-seed');
    expect(fixtureMainMenuView(empty)!.previewSeed).toBe(MAIN_MENU_SLUG);
  });

  it('rejects a payload without a menu block', () => {
    expect(fixtureMainMenuView(null)).toBeNull();
    expect(fixtureMainMenuView('01-main-menu')).toBeNull();
    expect(fixtureMainMenuView({ slug: '01-main-menu' })).toBeNull();
    expect(fixtureMainMenuView({ menu: 'nope' })).toBeNull();
  });

  it('rejects a row with an unknown id', () => {
    const payload = payloadWith((menu) => {
      const rows = menu.rows as Record<string, unknown>[];
      rows[1]!.id = 'missions';
    });
    expect(fixtureMainMenuView(payload)).toBeNull();
  });

  it('rejects duplicate ids and ids out of board order', () => {
    const duplicate = payloadWith((menu) => {
      const rows = menu.rows as Record<string, unknown>[];
      rows[2]!.id = 'new';
    });
    expect(fixtureMainMenuView(duplicate)).toBeNull();

    const swapped = payloadWith((menu) => {
      const rows = menu.rows as Record<string, unknown>[];
      const first = rows[0]!;
      rows[0] = rows[1]!;
      rows[1] = first;
    });
    expect(fixtureMainMenuView(swapped)).toBeNull();
  });

  it('rejects a stats array that is not empty and not the board’s three', () => {
    const payload = payloadWith((menu) => {
      menu.stats = (menu.stats as Record<string, unknown>[]).slice(0, 2);
    });
    expect(fixtureMainMenuView(payload)).toBeNull();
  });

  it('rejects a selected row that names nothing drawn', () => {
    const payload = payloadWith((menu) => {
      menu.selected = 'stats';
      menu.rows = (menu.rows as Record<string, unknown>[]).slice(0, 3);
    });
    expect(fixtureMainMenuView(payload)).toBeNull();
    expect(
      fixtureMainMenuView(
        payloadWith((menu) => {
          menu.selected = 'ranking';
          menu.rows = (menu.rows as Record<string, unknown>[]).slice(0, 4);
        }),
      ),
    ).toBeNull();
  });

  it('keeps reading portraits from the state, whatever the rows say', () => {
    const payload = payloadWith((menu) => {
      menu.rows = (menu.rows as Record<string, unknown>[]).slice(1);
      menu.selected = 'new';
    }) as { state: { party: unknown[] } };
    const view = fixtureMainMenuView(payload);
    expect(view!.rows.map((row) => row.id)).toEqual(['new', 'options', 'stats', 'ranking']);
    expect(view!.portraits.length).toBe(payload.state.party.length);
  });
});
