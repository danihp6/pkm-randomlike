import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => {
  class Scene {}
  return {
    default: {
      Scene,
      Scenes: { Events: { SHUTDOWN: 'shutdown', RESUME: 'resume' } },
      Input: { Keyboard: { KeyCodes: {} } },
    },
  };
});

const mocks = vi.hoisted(() => ({
  randomSeed: vi.fn((): string => 'boot-seed'),
  playMusic: vi.fn(),
  mountMainMenu: vi.fn((_host: object, _view: unknown, _intent: unknown) => ({
    update: vi.fn(),
    dispose: vi.fn(),
  })),
  mountStats: vi.fn(() => ({ update: vi.fn(), dispose: vi.fn() })),
  loadRankingEndpoint: vi.fn(async (): Promise<string | null> => null),
}));

vi.mock('../engine/rng', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../engine/rng')>();
  return { ...actual, randomSeed: mocks.randomSeed };
});

vi.mock('../audio/audio', () => ({ playMusic: mocks.playMusic }));

vi.mock('../ui/hud/panels/main-menu', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ui/hud/panels/main-menu')>();
  return { ...actual, mountMainMenu: mocks.mountMainMenu };
});

vi.mock('../ui/hud/panels/stats', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ui/hud/panels/stats')>();
  return { ...actual, mountStats: mocks.mountStats };
});

vi.mock('../net/ranking', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../net/ranking')>();
  return { ...actual, loadRankingEndpoint: mocks.loadRankingEndpoint };
});

import type { MainMenuIntent, MainMenuView } from '../ui/hud/panels/main-menu';
import { menuVersionLabel } from '../ui/hud/panels/main-menu';
import type { RunHistoryRecord } from '../engine/run/history';
import { createRun, createRunPokemon, type RunState } from '../engine/run';
import { t } from '../i18n';
import type { RankingBoard } from '../net/ranking';
import type { StatsMode, StatsView } from '../ui/hud/panels/stats';
import type Phaser from 'phaser';
import { mainMenuDrawnObjectCount, type MainMenuScene } from './MainMenuScene';

/** The scene's own state, with the Phaser seams stubbed. */
type SceneInternals = {
  previewSeed: string;
  run: RunState | null;
  index: number;
  items: string[];
  statsOpen: boolean;
  input: { keyboard: { on: () => void } };
  events: { on: () => void; once: () => void };
  create(): void;
  createDom(): void;
  menuView(): MainMenuView;
  history: readonly RunHistoryRecord[];
  statsMode: StatsMode;
  statsMonth: string | null;
  globalRanking: RankingBoard | null;
  statsView(): StatsView;
  handleIntent(intent: MainMenuIntent): void;
  move(delta: number): void;
  openStats(mode?: StatsMode): void;
};

let MainMenuSceneClass: typeof MainMenuScene;

beforeAll(async () => {
  // A clean boot, with no query string: the DOM HUD is the HUD.
  vi.stubGlobal('window', { location: { search: '' } });
  ({ MainMenuScene: MainMenuSceneClass } = await import('./MainMenuScene'));
});

beforeEach(() => {
  mocks.randomSeed.mockClear();
  mocks.randomSeed.mockReturnValue('boot-seed');
  mocks.playMusic.mockClear();
  mocks.mountMainMenu.mockClear();
  mocks.mountStats.mockClear();
  mocks.loadRankingEndpoint.mockClear();
});

function scene(): SceneInternals {
  const created = new MainMenuSceneClass() as unknown as SceneInternals;
  created.input = { keyboard: { on: (): void => {} } };
  created.events = { on: (): void => {}, once: (): void => {} };
  return created;
}

describe('create', () => {
  it('draws the preview seed once, on the on-ramp to the DOM panel', () => {
    const instance = scene();

    instance.create();

    expect(mocks.randomSeed).toHaveBeenCalledTimes(1);
    expect(instance.previewSeed).toBe('boot-seed');
    expect(instance.menuView().previewSeed).toBe('boot-seed');
  });

  it('does not draw again on a repaint', () => {
    const instance = scene();
    instance.create();
    mocks.randomSeed.mockClear();

    expect(instance.menuView().previewSeed).toBe('boot-seed');
    expect(instance.menuView().previewSeed).toBe('boot-seed');
    expect(mocks.randomSeed).not.toHaveBeenCalled();
  });
});

describe('menuView', () => {
  it('passes the scene’s own seed, run and cursor into the live view', () => {
    const instance = scene();
    instance.previewSeed = 'kept-seed';
    instance.index = 2;

    const view = instance.menuView();

    expect(view.previewSeed).toBe('kept-seed');
    expect(view.selected).toBe('stats');
    expect(view.rows.map((row) => row.id)).toEqual(['new', 'options', 'stats', 'ranking']);
  });

  it('is a pure read: two calls are deep-equal', () => {
    const instance = scene();
    instance.previewSeed = 'kept-seed';

    expect(instance.menuView()).toEqual(instance.menuView());
  });

  it('carries the build’s version line and the three footer figures', () => {
    const view = scene().menuView();

    expect(view.version).toBe(menuVersionLabel());
    expect(view.stats.map((stat) => stat.id)).toEqual(['wins', 'elite', 'monthly']);
    expect(view.stats.map((stat) => stat.value)).toEqual(['0', '0', '0']);
  });
});

/** The scene draws with Phaser, so its mount and repaint seams are read off the source. */
const SOURCE = readFileSync(fileURLToPath(new URL('./MainMenuScene.ts', import.meta.url)), 'utf8');

const BOARD: RankingBoard = {
  month: '2026-10',
  ownDeviceId: 'd-00000000beef',
  rows: [{ deviceId: 'qa-device-0001', runs: 1, wins: 1, bestFloor: 3 }],
};

function rankingRecord(): RunHistoryRecord {
  return {
    seed: 'pkm-qa',
    mode: 'finite',
    mapReached: 4,
    catches: 2,
    casualties: 1,
    playtimeMs: 3_600_000,
    won: true,
    endedAt: '2026-10-18T09:30:00.000Z',
    species: [],
  };
}

describe('statsView', () => {
  it('hands the month’s global board through as the fifth argument', () => {
    const instance = scene();
    instance.history = [rankingRecord()];
    instance.statsMode = 'ranking';
    instance.statsMonth = '2026-10';
    instance.globalRanking = BOARD;

    const view = instance.statsView();

    expect(view.mode).toBe('ranking');
    expect(view.blurb).toBe(t('stats.blurbRankingGlobal'));
    expect(view.rows).toEqual([
      { id: 'global-0', cells: ['#0001', '1', '1', '3'] },
      { id: 'you', cells: [t('stats.you'), '1', '1', '4'] },
    ]);
  });

  it('paints the local blurb and the device’s own record with no board', () => {
    const instance = scene();
    instance.history = [rankingRecord()];
    instance.statsMode = 'ranking';
    instance.statsMonth = '2026-10';
    instance.globalRanking = null;

    const view = instance.statsView();

    expect(view.blurb).toBe(t('stats.blurbRanking'));
    expect(view.rows).toEqual([{ id: 'you', cells: [t('stats.you'), '1', '1', '4'] }]);
  });
});

describe('the global board’s seams', () => {
  it('is handed to the one live view', () => {
    expect(SOURCE).toContain(
      'return liveStatsView(this.history, this.statsMode, this.statsMonth, new Date(), this.globalRanking);',
    );
    expect(SOURCE).toContain('private globalRanking: RankingBoard | null = null;');
    expect(SOURCE).toContain('private rankingEndpoint: string | null | undefined;');
  });

  it('is fetched when the panel opens and again on a month step', () => {
    expect(SOURCE).toContain('this.loadGlobalRanking();');
    const opAt = SOURCE.indexOf("private openStats(mode: StatsMode = 'totals'): void {");
    const closeAt = SOURCE.indexOf('private closeStats(): void {');
    const fetchAt = SOURCE.indexOf('this.loadGlobalRanking();');
    expect(fetchAt).toBeGreaterThan(opAt);
    expect(fetchAt).toBeLessThan(closeAt);
    expect(SOURCE).toContain("if (intent.type === 'month') this.loadGlobalRanking();");
    expect(SOURCE).toContain('this.globalRanking = null;');
  });

  it('marks its own line with the id the storage keeps, and awaits only in the fetch', () => {
    expect(SOURCE).toContain(
      '          : { ...board, month, ownDeviceId: rankingDeviceId(browserStorage()) };',
    );
    expect(SOURCE).toContain('if (this.statsMonth !== month) return;');
    expect(SOURCE).toContain('if (this.statsOpen) this.stats?.update(this.statsView());');
    const awaits = SOURCE.match(/\bawait\b/g) ?? [];
    expect(awaits).toHaveLength(2);
    expect(SOURCE).not.toContain('setTimeout');
  });
});

describe('the seed’s seams', () => {
  it('starts empty and is drawn once inside create', () => {
    expect(SOURCE).toContain("  private previewSeed = '';\n");
    const draws = SOURCE.match(/this\.previewSeed = randomSeed\(\);/g) ?? [];
    expect(draws).toHaveLength(1);
    const createAt = SOURCE.indexOf('create(): void {');
    const createDomAt = SOURCE.indexOf('createDom(): void {');
    const seedAt = SOURCE.indexOf('this.previewSeed = randomSeed();');
    expect(seedAt).toBeGreaterThan(createAt);
    expect(seedAt).toBeLessThan(createDomAt);
  });

  it('is the only live view the mount and the repaint read', () => {
    const calls = SOURCE.match(/liveMainMenuView\(/g) ?? [];
    expect(calls).toHaveLength(1);
    expect(SOURCE).toContain(
      'return liveMainMenuView(this.run, this.index, this.previewSeed, this.records, this.versionLabel);',
    );
    expect(SOURCE).toContain('const view = this.menuView();');
    expect(SOURCE).toContain('this.controller?.update(this.menuView());');
    expect(SOURCE).toContain('this.mountPanel(this.menuView());');
  });

  it('draws no route and reads no preview model outside the panel', () => {
    expect(SOURCE).not.toContain('routes/preview');
    expect(SOURCE).not.toContain('previewRoute(');
    expect(SOURCE).not.toContain('Math.random');
    expect(SOURCE).not.toContain('Date.now');
  });

  it('reads the footer records once, from the history create already loaded', () => {
    expect(SOURCE).toContain('this.records = mainMenuRecords(this.history, new Date());');
    const reads = SOURCE.match(/mainMenuRecords\(/g) ?? [];
    expect(reads).toHaveLength(1);
  });
});

/** A HUD layer whose `#hud` host is `host` (or absent); the panel mounts are stubbed. */
function stubDocument(host: object | null): void {
  vi.stubGlobal('document', {
    getElementById: (id: string): object | null => (id === 'hud' ? host : null),
  });
}

/** A saved run with a living party, the only shape that draws the CONTINUE row. */
function savedRun(): RunState {
  const starter = createRunPokemon({
    id: 'charmander-1',
    speciesId: 'charmander',
    level: 12,
    moves: ['tackle'],
  });
  return createRun({ seed: 'pkm-211', starter });
}

describe('the canvas chrome path', () => {
  const SCENES = [
    'MainMenuScene.ts',
    'StarterScene.ts',
    'RouteScene.ts',
    'BattleScene.ts',
    'RunOverScene.ts',
    'SettingsScene.ts',
    'BootScene.ts',
  ];

  it('is gone from every scene: no flag, no DOM/canvas branch', () => {
    const flag = ['DOM', 'HUD'].join('_');
    for (const file of SCENES) {
      const source = readFileSync(fileURLToPath(new URL(`./${file}`, import.meta.url)), 'utf8');
      expect(source, file).not.toContain(flag);
      expect(source, file).not.toMatch(/hudRequested|parseHudFlags\(/);
    }
  });
});

describe('the RANKING row', () => {
  it('opens the stats panel on its ranking mode', () => {
    stubDocument({});
    const instance = scene();
    instance.history = [rankingRecord()];

    instance.handleIntent({ type: 'ranking' });

    expect(mocks.mountStats).toHaveBeenCalledTimes(1);
    expect(instance.statsOpen).toBe(true);
    expect(instance.statsMode).toBe('ranking');
    expect(instance.statsView().mode).toBe('ranking');
  });

  it('leaves STATS opening the panel on TOTALS', () => {
    stubDocument({});
    const instance = scene();
    instance.history = [rankingRecord()];

    instance.handleIntent({ type: 'stats' });

    expect(instance.statsMode).toBe('totals');
    expect(instance.statsView().mode).toBe('totals');
  });

  it('keeps TOTALS as the default parameter', () => {
    stubDocument({});
    const instance = scene();
    instance.openStats('totals');

    expect(instance.statsMode).toBe('totals');
    expect(instance.statsView().mode).toBe('totals');
  });

  it('walks to the fifth row and wraps back to the first', () => {
    stubDocument(null);
    const instance = scene();
    instance.run = savedRun();
    instance.createDom();

    expect(instance.items).toEqual(['continue', 'new', 'options', 'stats', 'ranking']);
    expect(instance.index).toBe(0);
    for (const expected of [1, 2, 3, 4]) {
      instance.move(1);
      expect(instance.index).toBe(expected);
    }
    instance.move(1);
    expect(instance.index).toBe(0);
    instance.move(-1);
    expect(instance.index).toBe(4);
    expect(instance.menuView().selected).toBe('ranking');
  });

  it('draws four rows without a save, ending on RANKING', () => {
    stubDocument(null);
    const instance = scene();
    instance.run = null;
    instance.createDom();

    expect(instance.items).toEqual(['new', 'options', 'stats', 'ranking']);
    instance.move(1);
    expect(instance.index).toBe(1);
    instance.move(2);
    expect(instance.menuView().selected).toBe('ranking');
  });

  it('mounts its panel on a clean boot and draws no chrome of its own', () => {
    const host = {};
    stubDocument(host);
    const instance = scene();

    instance.create();

    expect(mocks.mountMainMenu).toHaveBeenCalledTimes(1);
    expect(mocks.mountMainMenu.mock.calls[0]?.[0]).toBe(host);
    expect(mainMenuDrawnObjectCount(instance as unknown as Phaser.Scene)).toBe(0);
    expect(SOURCE).not.toContain(['DOM', 'HUD'].join('_'));
    expect(SOURCE).not.toContain('addFrlgText');
  });
});
