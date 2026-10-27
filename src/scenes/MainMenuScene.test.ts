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
}));

vi.mock('../engine/rng', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../engine/rng')>();
  return { ...actual, randomSeed: mocks.randomSeed };
});

vi.mock('../audio/audio', () => ({ playMusic: mocks.playMusic }));

import type { MainMenuView } from '../ui/hud/panels/main-menu';
import type { MainMenuScene } from './MainMenuScene';

/** The DOM path the scene takes under `?hud=dom`, with the Phaser seams stubbed. */
type SceneInternals = {
  previewSeed: string;
  run: null;
  index: number;
  input: { keyboard: { on: () => void } };
  events: { on: () => void; once: () => void };
  create(): void;
  menuView(): MainMenuView;
};

let MainMenuSceneClass: typeof MainMenuScene;

beforeAll(async () => {
  // `DOM_HUD` is read once at module load, so the flag has to be on the window
  // before the scene is imported.
  vi.stubGlobal('window', { location: { search: '?hud=dom' } });
  ({ MainMenuScene: MainMenuSceneClass } = await import('./MainMenuScene'));
});

beforeEach(() => {
  mocks.randomSeed.mockClear();
  mocks.randomSeed.mockReturnValue('boot-seed');
  mocks.playMusic.mockClear();
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
    expect(view.rows.map((row) => row.id)).toEqual(['new', 'options', 'stats']);
  });

  it('is a pure read: two calls are deep-equal', () => {
    const instance = scene();
    instance.previewSeed = 'kept-seed';

    expect(instance.menuView()).toEqual(instance.menuView());
  });
});

/** The scene draws with Phaser, so its mount and repaint seams are read off the source. */
const SOURCE = readFileSync(fileURLToPath(new URL('./MainMenuScene.ts', import.meta.url)), 'utf8');

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
    expect(SOURCE).toContain('return liveMainMenuView(this.run, this.index, this.previewSeed);');
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
});
