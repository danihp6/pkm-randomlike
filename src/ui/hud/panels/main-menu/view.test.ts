import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { getBiome } from '../../../../data/biomes';
import { biomeForMap } from '../../../../engine/maps/plan';
import { createRun, createRunPokemon, type RunPokemon, type RunState } from '../../../../engine/run';
import type { RunHistoryRecord } from '../../../../engine/run/history';
import { DEFAULT_LOCALE, setLocale, t } from '../../../../i18n';
import { partyRows } from '../../../partyScreen';
import { runPositionLabel } from '../../../runSummary';
import { portraitCrop } from '../../portrait';
import {
  EMPTY_MAIN_MENU_RECORDS,
  MAIN_MENU_ACTIONS,
  MAIN_MENU_BOARD,
  MAIN_MENU_BOARD_NARROW,
  MAIN_MENU_FOOTER_NARROW,
  MAIN_MENU_GLOW,
  MAIN_MENU_SLUG,
  fixtureMainMenuView,
  forLayout,
  glowBackground,
  liveMainMenuView,
  mainMenuRecords,
  mainMenuStats,
  type MainMenuGlow,
  type MainMenuLayout,
  type MainMenuRecords,
  type Rect,
} from './view';

const MAIN_MENU_CSS = readFileSync(fileURLToPath(new URL('./main-menu.css', import.meta.url)), 'utf8');
const MAIN_MENU_FIXTURE: unknown = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../../../../design/fixtures/01-main-menu.json', import.meta.url)),
    'utf8',
  ),
);

const SEED = 'pkm-145';
const NOW = new Date('2026-10-18T12:00:00.000Z');

function member(id: string, speciesId: string, nickname?: string): RunPokemon {
  return createRunPokemon({
    id,
    speciesId,
    level: 12,
    moves: ['tackle'],
    ...(nickname === undefined ? {} : { nickname }),
  });
}

/** A run standing on map 3 with the four members the mobile frame names. */
function savedRun(): RunState {
  const party = [
    member('charmander-1', 'charmander'),
    member('pikachu-2', 'pikachu'),
    member('bulbasaur-3', 'bulbasaur'),
    member('gastly-4', 'gastly'),
  ];
  return { ...createRun({ seed: SEED, starter: party[0]! }), mapIndex: 3, party };
}

function historyRecord(
  edit: Partial<RunHistoryRecord> & Pick<RunHistoryRecord, 'seed'>,
): RunHistoryRecord {
  return {
    mode: 'finite',
    mapReached: 1,
    catches: 0,
    casualties: 0,
    playtimeMs: 0,
    won: false,
    endedAt: '2026-10-18T09:30:00.000Z',
    species: [],
    ...edit,
  };
}

/**
 * Four finished runs: a won finite run at floor 5, a lost finite run at floor 2
 * inside the month, a lost finite run at floor 7 from September, and an infinite
 * run at floor 9 that must never raise a strike.
 */
function history(): readonly RunHistoryRecord[] {
  return [
    historyRecord({ seed: 'pkm-won', won: true, mapReached: 5 }),
    historyRecord({ seed: 'pkm-lost', mapReached: 2, endedAt: '2026-10-02T00:05:00.000Z' }),
    historyRecord({ seed: 'pkm-old', mapReached: 3, endedAt: '2026-09-30T23:59:59.000Z' }),
    historyRecord({ seed: 'pkm-infinite', mode: 'infinite', mapReached: 9 }),
  ];
}

afterEach(() => {
  setLocale(DEFAULT_LOCALE);
});

describe('liveMainMenuView', () => {
  it('draws the four navigable rows, in board order, with the run’s position', () => {
    const run = savedRun();
    const view = liveMainMenuView(run, 0);

    expect(view.rows.map((row) => row.id)).toEqual(['continue', 'new', 'options', 'stats']);
    expect(view.rows.map((row) => row.id)).toEqual([...MAIN_MENU_ACTIONS]);
    expect(view.rows.every((row) => row.enabled)).toBe(true);
    expect(view.rows.map((row) => row.label)).toEqual([
      t('menu.continue'),
      t('menu.new'),
      t('menu.options'),
      t('menu.stats'),
    ]);
    expect(view.rows[0]!.value).toBe(runPositionLabel(run));
    expect(view.rows[0]!.value).toContain(getBiome(biomeForMap(run.seed, run.mapIndex)).name);
    expect(view.rows.slice(1).map((row) => row.value)).toEqual(['', '', '']);
    expect(view.title).toBe(t('menu.title'));
    expect(view.stats.map((stat) => stat.id)).toEqual(['wins', 'elite', 'monthly']);
    expect(view.version).toBeNull();
  });

  it('pushes the STATS row with and without a run', () => {
    for (const run of [savedRun(), null]) {
      const rows = liveMainMenuView(run, 0).rows;

      expect(rows.at(-1)).toEqual({
        id: 'stats',
        label: t('menu.stats'),
        value: '',
        enabled: true,
      });
    }
  });

  it('carries one portrait per party member, in party order', () => {
    const run = savedRun();
    const view = liveMainMenuView(run, 0);

    expect(view.portraits.length).toBe(run.party.length);
    expect(view.portraits.map((portrait) => portrait.memberId)).toEqual(
      partyRows(run).map((row) => row.id),
    );
    expect(view.portraits.map((portrait) => portrait.name)).toEqual(
      partyRows(run).map((row) => row.name),
    );
    expect(view.portraits[0]!.name).toBe('Charmander');
  });

  it('resolves each party member’s own atlas cell', () => {
    const run = savedRun();
    const rows = partyRows(run);
    const portraits = liveMainMenuView(run, 0).portraits;

    expect(portraits.map((portrait) => portrait.portrait)).toEqual(
      rows.map((row) => portraitCrop(row.speciesId, row.shiny)),
    );
    for (const portrait of portraits) expect(portrait.portrait).not.toBeNull();
    const cells = portraits.map((portrait) => {
      const crop = portrait.portrait!;
      return crop.row * crop.cols + crop.col;
    });
    expect(new Set(cells).size).toBe(4);
    expect(portraits.some((portrait) => portrait.portrait!.row > 0)).toBe(true);
  });

  it('drops the CONTINUE row and every portrait without a run', () => {
    const view = liveMainMenuView(null, 0);

    expect(view.rows.map((row) => row.id)).toEqual(['new', 'options', 'stats']);
    expect(view.rows.some((row) => row.id === 'continue')).toBe(false);
    expect(view.portraits).toEqual([]);
    expect(view.stats.map((stat) => stat.id)).toEqual(['wins', 'elite', 'monthly']);
    expect(view.selected).toBe('new');
  });

  it('follows the cursor and clamps it onto the last row', () => {
    const run = savedRun();

    expect(liveMainMenuView(run, 0).selected).toBe('continue');
    expect(liveMainMenuView(run, 1).selected).toBe('new');
    expect(liveMainMenuView(run, 2).selected).toBe('options');
    expect(liveMainMenuView(run, 3).selected).toBe('stats');
    expect(liveMainMenuView(run, 9).selected).toBe('stats');
    expect(liveMainMenuView(run, -4).selected).toBe('continue');
    expect(liveMainMenuView(null, 0).selected).toBe('new');
    expect(liveMainMenuView(null, 2).selected).toBe('stats');
    expect(liveMainMenuView(null, 9).selected).toBe('stats');
  });

  it('is pure: the same input is deep-equal and JSON round-trips unchanged', () => {
    const run = savedRun();
    const first = liveMainMenuView(run, 1);
    const second = liveMainMenuView(run, 1);

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
  });
});

describe('the preview seed', () => {
  it('carries the seed the scene drew, in both layouts', () => {
    const run = savedRun();
    const view = liveMainMenuView(run, 0, 'boot-seed');

    expect(view.previewSeed).toBe('boot-seed');
    expect(forLayout(view, 'wide').previewSeed).toBe('boot-seed');
    expect(forLayout(view, 'compact').previewSeed).toBe('boot-seed');
  });

  it('falls back to the frame’s slug when no seed is given', () => {
    expect(liveMainMenuView(savedRun(), 0).previewSeed).toBe(MAIN_MENU_SLUG);
    expect(liveMainMenuView(null, 0).previewSeed).toBe(MAIN_MENU_SLUG);
    expect(liveMainMenuView(savedRun(), 0, '').previewSeed).toBe('');
  });
});

/** The cursor's row, in board order. */
function rowAt(view: ReturnType<typeof liveMainMenuView>, id: string) {
  const row = view.rows.find((entry) => entry.id === id);
  expect(row, `no ${id} row`).toBeDefined();
  return row!;
}

describe('mainMenuRecords', () => {
  it('counts every won run, finite and infinite alike', () => {
    expect(mainMenuRecords(history(), NOW).wins).toBe(1);
    expect(mainMenuRecords([], NOW).wins).toBe(0);
  });

  it('reads the elite strike from the finite runs only', () => {
    expect(mainMenuRecords(history(), NOW).elite).toBe(5);
  });

  it('reads the monthly strike from the finite runs of this UTC month only', () => {
    const records = mainMenuRecords(history(), NOW);

    expect(records.monthly).toBe(5);
    expect(records.monthlyLabel).toBe('OCT 2026');
    expect(
      mainMenuRecords([historyRecord({ seed: 'pkm-sep', mapReached: 7, endedAt: '2026-09-30T23:59:59.000Z' })], NOW),
    ).toEqual({ wins: 0, elite: 7, monthly: 0, monthlyLabel: 'OCT 2026' });
  });

  it('skips a record whose ending instant is unreadable', () => {
    const records = mainMenuRecords(
      [historyRecord({ seed: 'pkm-nothing', mapReached: 6, endedAt: 'not a date' })],
      NOW,
    );

    expect(records.monthly).toBe(0);
    expect(records.elite).toBe(6);
  });

  it('prints the month of now even with an empty store', () => {
    expect(mainMenuRecords([], NOW)).toEqual({
      wins: 0,
      elite: 0,
      monthly: 0,
      monthlyLabel: 'OCT 2026',
    });
  });

  it('prints no month for an instant the store cannot read', () => {
    expect(mainMenuRecords(history(), new Date('not-a-date'))).toEqual({
      wins: 1,
      elite: 5,
      monthly: 0,
      monthlyLabel: '',
    });
  });

  it('is pure: the same pair is deep-equal', () => {
    const store = history();

    expect(mainMenuRecords(store, NOW)).toEqual(mainMenuRecords(store, NOW));
    expect(store.map((entry) => entry.seed)).toEqual(history().map((entry) => entry.seed));
  });
});

describe('mainMenuStats', () => {
  it('always draws the three figures, in board order, with the month under the last', () => {
    const stats = mainMenuStats(mainMenuRecords(history(), NOW));

    expect(stats.map((stat) => stat.id)).toEqual(['wins', 'elite', 'monthly']);
    expect(stats.map((stat) => stat.value)).toEqual(['1', '5', '5']);
    expect(stats.map((stat) => stat.name)).toEqual([null, null, 'OCT 2026']);
    expect(stats.map((stat) => stat.label)).toEqual([
      t('menu.stat.wins'),
      t('menu.stat.elite'),
      t('menu.stat.monthly'),
    ]);
  });

  it('prints the labels and zeroes on the empty record set, never a blank', () => {
    const stats = mainMenuStats(EMPTY_MAIN_MENU_RECORDS);

    expect(stats).toHaveLength(3);
    expect(stats.map((stat) => stat.value)).toEqual(['0', '0', '0']);
    expect(stats.every((stat) => stat.value !== '')).toBe(true);
    expect(stats.every((stat) => stat.name === null)).toBe(true);
  });

  it('prints the Spanish labels, and no em dash, under the es locale', () => {
    setLocale('es');

    const labels = mainMenuStats(EMPTY_MAIN_MENU_RECORDS).map((stat) => stat.label);

    expect(labels).toEqual(['VICTORIAS', 'MEJOR ASALTO ÉLITE', 'ASALTO MÁXIMO DEL MES']);
    expect(labels.every((label) => !label.includes('\u2014'))).toBe(true);
  });
});

describe('liveMainMenuView — the footer', () => {
  it('hands the panel the records’ figures and the version line it is given', () => {
    const records: MainMenuRecords = {
      wins: 23,
      elite: 2,
      monthly: 7,
      monthlyLabel: 'OCT 2026',
    };

    const view = liveMainMenuView(savedRun(), 0, 'boot-seed', records, 'v1 · PHASE 2');

    expect(view.version).toBe('v1 · PHASE 2');
    expect(view.stats.map((stat) => stat.id)).toEqual(['wins', 'elite', 'monthly']);
    expect(view.stats.map((stat) => stat.value)).toEqual(['23', '2', '7']);
    expect(view.stats[2]!.name).toBe('OCT 2026');
    expect(view.previewSeed).toBe('boot-seed');
  });

  it('still draws three figures and no version without a record set', () => {
    const view = liveMainMenuView(savedRun(), 0);

    expect(view.version).toBeNull();
    expect(view.stats).toHaveLength(3);
    expect(view.stats.map((stat) => stat.value)).toEqual(['0', '0', '0']);
    expect(view.stats.every((stat) => stat.value !== '')).toBe(true);
    expect(view.stats.every((stat) => stat.name === null)).toBe(true);
  });

  it('keeps the footer through both layouts, the phone hiding the version in CSS', () => {
    const records: MainMenuRecords = {
      wins: 3,
      elite: 4,
      monthly: 5,
      monthlyLabel: 'OCT 2026',
    };
    const view = liveMainMenuView(savedRun(), 0, 'boot-seed', records, 'v1 · PHASE 2');

    expect(forLayout(view, 'wide').stats).toBe(view.stats);
    expect(forLayout(view, 'compact').stats).toBe(view.stats);
    expect(forLayout(view, 'wide').version).toBe('v1 · PHASE 2');
    expect(forLayout(view, 'compact').version).toBe('v1 · PHASE 2');
    expect(compactCss()).toMatch(/\.main-menu__version\s*\{[^}]*display:\s*none/);
  });

  it('keeps the version stamp on the board’s own one-line box', () => {
    const desktopCss = MAIN_MENU_CSS.slice(0, MAIN_MENU_CSS.indexOf('@media (max-width: 600px)'));
    const version = declarations(desktopCss, '.main-menu__version');

    expect(sharp(version.get('left'))).toBe(MAIN_MENU_BOARD.version.x);
    expect(sharp(version.get('top'))).toBe(MAIN_MENU_BOARD.version.y);
    expect(sharp(version.get('width'))).toBe(MAIN_MENU_BOARD.version.w);
    expect(version.get('white-space')).toBe('nowrap');
    expect(MAIN_MENU_BOARD.version.h).toBe(15);
  });
});

/** The compact block of the stylesheet, where the phone hides the version line. */
function compactCss(): string {
  return MAIN_MENU_CSS.slice(MAIN_MENU_CSS.indexOf('@media (max-width: 600px)'));
}

describe('forLayout', () => {
  it('hands the desk layout the very same view, label and all', () => {
    const run = savedRun();
    const view = liveMainMenuView(run, 0);
    const wide = forLayout(view, 'wide');

    expect(wide).toBe(view);
    expect(wide.rows[0]!.value).toBe(runPositionLabel(run));
    expect(wide.rows[0]!.value.toUpperCase()).toMatch(/^MAP 3 · /);
  });

  it('drops only the CONTINUE row’s label on the phone and keeps its four portraits', () => {
    const run = savedRun();
    const view = liveMainMenuView(run, 0);
    const compact = forLayout(view, 'compact');
    const row = rowAt(compact, 'continue');

    expect(row.value).toBe('');
    expect(row.label).toBe(view.rows[0]!.label);
    expect(row.enabled).toBe(true);
    expect(compact.rows.map((entry) => entry.id)).toEqual(view.rows.map((entry) => entry.id));
    expect(compact.rows.slice(1)).toEqual(view.rows.slice(1));
    expect(rowAt(view, 'continue').value).toBe(runPositionLabel(run));
  });

  it('keeps the portrait list, the title, the stats and the cursor identical', () => {
    const run = savedRun();
    const view = liveMainMenuView(run, 2);
    const compact = forLayout(view, 'compact');

    expect(compact.portraits).toBe(view.portraits);
    expect(compact.portraits.length).toBe(4);
    expect(compact.portraits.map((portrait) => portrait.memberId)).toEqual(
      view.portraits.map((portrait) => portrait.memberId),
    );
    expect(compact.title).toBe(view.title);
    expect(compact.stats).toEqual(view.stats);
    expect(compact.version).toBe(view.version);
    expect(compact.selected).toBe(view.selected);
    expect(compact.selected).toBe('options');
  });

  it('passes a view with no run through both layouts unchanged', () => {
    const view = liveMainMenuView(null, 0);

    expect(view.portraits).toEqual([]);
    expect(view.rows.some((row) => row.id === 'continue')).toBe(false);
    expect(view.rows.map((row) => row.value)).toEqual(['', '', '']);
    expect(forLayout(view, 'wide')).toBe(view);
    expect(forLayout(view, 'compact')).toBe(view);
  });

  it('falls back to the desk layout for anything that is not the phone’s', () => {
    const view = liveMainMenuView(savedRun(), 0);

    expect(forLayout(view, 'narrow' as MainMenuLayout)).toBe(view);
  });

  it('is pure: the same pair is deep-equal and the input is untouched', () => {
    const view = liveMainMenuView(savedRun(), 1);
    const before = JSON.parse(JSON.stringify(view)) as unknown;

    expect(forLayout(view, 'compact')).toEqual(forLayout(view, 'compact'));
    expect(JSON.parse(JSON.stringify(view))).toEqual(before);
  });
});

describe("the board's glow", () => {
  it('paints one radial gradient, never a flat fill', () => {
    expect(glowBackground(MAIN_MENU_GLOW)).toBe(
      'radial-gradient(closest-side, rgb(125 211 252 / 22%) 0%, rgb(125 211 252 / 10%) 45%, rgb(125 211 252 / 0%) 100%)',
    );
  });

  it('carries the frame’s oval box and its three stops', () => {
    expect(MAIN_MENU_GLOW.box).toEqual({ x: -180, y: -140, w: 1000, h: 720 });
    expect(MAIN_MENU_GLOW.stops).toEqual([
      { at: 0, color: 'rgb(125 211 252 / 22%)' },
      { at: 0.45, color: 'rgb(125 211 252 / 10%)' },
      { at: 1, color: 'rgb(125 211 252 / 0%)' },
    ]);
    expect(MAIN_MENU_GLOW.box.w / 2).toBe(500);
    expect(MAIN_MENU_GLOW.box.h / 2).toBe(360);
  });

  it('prints a stop’s position as a percentage of two decimals at most', () => {
    const glow: MainMenuGlow = {
      box: { x: 0, y: 0, w: 400, h: 200 },
      stops: [
        { at: 0.5, color: 'red' },
        { at: 0.333333, color: 'green' },
        { at: 0.125, color: 'blue' },
      ],
    };

    expect(glowBackground(glow)).toBe(
      'radial-gradient(closest-side, red 50%, green 33.33%, blue 12.5%)',
    );
    expect(glowBackground(glow)).not.toContain('.00%');
  });

  it('hands the live menu the oval with and without a run', () => {
    const records: MainMenuRecords = { wins: 23, elite: 2, monthly: 7, monthlyLabel: 'OCT 2026' };

    expect(liveMainMenuView(null, 0).glow).toEqual(MAIN_MENU_GLOW);
    expect(liveMainMenuView(savedRun(), 1, 'seed', records, 'v1').glow).toEqual(MAIN_MENU_GLOW);
    expect(liveMainMenuView(savedRun(), 0).glow).toBe(MAIN_MENU_GLOW);
  });

  it('hands the fixture’s unedited payload the same oval, which it does not carry', () => {
    const view = fixtureMainMenuView(MAIN_MENU_FIXTURE);

    expect(view).not.toBeNull();
    expect(view!.glow).toEqual(MAIN_MENU_GLOW);
    expect(JSON.stringify(MAIN_MENU_FIXTURE)).not.toContain('glowBackground');
  });

  it('keeps the very same oval through both layouts and away from the Continue row', () => {
    const view = liveMainMenuView(savedRun(), 0);

    expect(forLayout(view, 'wide').glow).toBe(view.glow);
    expect(forLayout(view, 'compact').glow).toBe(view.glow);
    expect(forLayout(view, 'compact').glow).toEqual(MAIN_MENU_GLOW);
  });

  it('leaves the stylesheet nothing but the box’s position, so the view owns the paint', () => {
    const desktopCss = MAIN_MENU_CSS.slice(0, MAIN_MENU_CSS.indexOf('@media (max-width: 600px)'));
    const glow = declarations(desktopCss, '.main-menu__glow');

    expect([...glow.entries()]).toEqual([['position', 'absolute']]);
    expect(MAIN_MENU_CSS).not.toContain('border-radius: 50%');
    expect(MAIN_MENU_CSS).not.toContain('rgb(125 211 252 / 10%)');
    expect(MAIN_MENU_CSS).not.toContain('radial-gradient');
  });

  it('paints that gradient on the glow node, boxed from the view', () => {
    const panel = readFileSync(fileURLToPath(new URL('./mainMenuPanel.tsx', import.meta.url)), 'utf8');

    expect(panel).toContain('data-hud-main-menu-glow');
    expect(panel).toContain('backgroundImage: glowBackground(view.glow)');
    expect(panel).toContain('boxPaint(view.glow.box)');
  });
});

describe('the compact CONTINUE row', () => {
  it('lays out for the portraits alone, sizing no value node', () => {
    expect([...declarations(COMPACT_CSS, '.main-menu__value').keys()]).toEqual([]);
  });

  it('keeps the phone portraits on the frame’s 22 px cell and 25 px pitch', () => {
    const cell = declarations(COMPACT_CSS, '.main-menu__portrait');
    const strip = declarations(COMPACT_CSS, '.main-menu__portraits');

    expect(sharp(cell.get('width'))).toBe(MAIN_MENU_BOARD_NARROW.portrait.size);
    expect(sharp(cell.get('height'))).toBe(MAIN_MENU_BOARD_NARROW.portrait.size);
    expect(sharp(cell.get('width')) + sharp(strip.get('gap'))).toBe(
      MAIN_MENU_BOARD_NARROW.portrait.pitch,
    );
    expect(sharp(strip.get('left')) + 4 * MAIN_MENU_BOARD_NARROW.portrait.pitch).toBeLessThanOrEqual(
      MAIN_MENU_BOARD_NARROW.row.w,
    );
  });
});

/** The gap between two rects: positive on the axis that separates them, negative when they overlap. */
function gap(a: Rect, b: Rect): number {
  const dx = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w));
  const dy = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h));
  return Math.max(dx, dy);
}

/** The declarations of a selector's rule, read out of the stylesheet's text. */
function declarations(css: string, selector: string): Map<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const found = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  const out = new Map<string, string>();
  if (found === null) return out;
  for (const line of found[1]!.split(';')) {
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    out.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
  }
  return out;
}

const COMPACT_CSS = MAIN_MENU_CSS.slice(MAIN_MENU_CSS.indexOf('@media (max-width: 600px)'));

describe('MAIN_MENU_FOOTER_NARROW', () => {
  const ids = ['wins', 'elite', 'monthly'] as const;

  it('puts two blocks on the first row and the monthly figure under them', () => {
    expect(Object.keys(MAIN_MENU_FOOTER_NARROW)).toEqual([...ids]);
    expect(MAIN_MENU_FOOTER_NARROW.wins.y).toBe(MAIN_MENU_BOARD_NARROW.footer.labelY);
    expect(MAIN_MENU_FOOTER_NARROW.elite.y).toBe(MAIN_MENU_FOOTER_NARROW.wins.y);
    expect(MAIN_MENU_FOOTER_NARROW.monthly.y).toBeGreaterThan(MAIN_MENU_FOOTER_NARROW.wins.y);
    expect(MAIN_MENU_FOOTER_NARROW.monthly.y).toBeGreaterThanOrEqual(
      MAIN_MENU_FOOTER_NARROW.wins.y + MAIN_MENU_FOOTER_NARROW.wins.h,
    );
  });

  it('keeps every pair of blocks apart by at least the kit’s 8 px gutter', () => {
    const pairs: [Rect, Rect][] = [];
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        pairs.push([MAIN_MENU_FOOTER_NARROW[ids[i]!], MAIN_MENU_FOOTER_NARROW[ids[j]!]]);
      }
    }

    expect(pairs).toHaveLength(3);
    for (const [first, second] of pairs) expect(gap(first, second)).toBeGreaterThanOrEqual(8);
  });

  it('fits the three blocks inside the 390 px column', () => {
    expect(MAIN_MENU_FOOTER_NARROW.wins.x).toBe(16);
    expect(MAIN_MENU_FOOTER_NARROW.monthly.x).toBe(16);
    for (const id of ids) {
      const rect = MAIN_MENU_FOOTER_NARROW[id];
      expect(rect.w).toBeGreaterThanOrEqual(160);
      expect(rect.x).toBeGreaterThanOrEqual(16);
      expect(rect.x + rect.w).toBeLessThanOrEqual(390 - 16);
      expect(rect.y + rect.h).toBeLessThan(844);
    }
  });

  it('is what the compact block of the stylesheet draws', () => {
    for (const id of ids) {
      const rule = declarations(COMPACT_CSS, `.main-menu__stat[data-hud-main-menu-stat='${id}']`);
      const shared = declarations(COMPACT_CSS, '.main-menu__stat');
      const rect = MAIN_MENU_FOOTER_NARROW[id];

      expect(rule.get('left') ?? shared.get('left')).toBe(`${rect.x}px`);
      expect(rule.get('top') ?? shared.get('top')).toBe(`${rect.y}px`);
      expect(sharp(rule.get('width') ?? shared.get('width'))).toBe(rect.w);
      expect(sharp(rule.get('height') ?? shared.get('height'))).toBe(rect.h);
    }
  });

  it('leaves the desktop footer on the frame’s own columns', () => {
    const desktopCss = MAIN_MENU_CSS.slice(0, MAIN_MENU_CSS.indexOf('@media (max-width: 600px)'));

    expect([...MAIN_MENU_BOARD.footer.columns]).toEqual([96, 240, 724]);
    expect(MAIN_MENU_BOARD.footer.labelY).toBe(616);
    expect(declarations(desktopCss, '.main-menu__stat').get('top')).toBe('616px');
  });
});

function sharp(value: string | undefined): number {
  return Number.parseFloat(value ?? '');
}
