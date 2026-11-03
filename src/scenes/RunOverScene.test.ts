import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

vi.mock('phaser', () => {
  class Scene {}
  return {
    default: {
      Scene,
      Scenes: { Events: { SHUTDOWN: 'shutdown' } },
      Input: { Keyboard: { KeyCodes: {} } },
    },
  };
});

const mocks = vi.hoisted(() => ({
  mountRunOver: vi.fn((_host: object, _view: unknown, _intent: unknown) => ({
    update: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock('../ui/hud/panels/run-over', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ui/hud/panels/run-over')>();
  return { ...actual, mountRunOver: mocks.mountRunOver };
});

import { createRun, createRunPokemon, type RunState } from '../engine/run';
import type { RunOverView } from '../ui/hud/panels/run-over';
import { runOverDrawnObjectCount, runOverStatValues, RunOverScene } from './RunOverScene';

/** A saved run with a living party: the only shape the score screen reads. */
function lostRun(): RunState {
  const starter = createRunPokemon({
    id: 'charmander-1',
    speciesId: 'charmander',
    level: 12,
    moves: ['tackle'],
  });
  return createRun({ seed: 'pkm-200', starter });
}

/** The pieces of a Phaser scene `create` touches, recorded. */
function sceneWithSeams(): { scene: RunOverScene; drawn: string[] } {
  const drawn: string[] = [];
  const scene = new RunOverScene() as unknown as {
    scale: { width: number; height: number };
    input: { keyboard: { on: () => void } };
    events: { once: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn> };
    time: { delayedCall: ReturnType<typeof vi.fn> };
    add: unknown;
    init(data: { run: RunState; won?: boolean }): void;
    create(): void;
  };
  scene.scale = { width: 1280, height: 800 };
  scene.input = { keyboard: { on: (): void => undefined } };
  scene.events = { once: vi.fn(), on: vi.fn() };
  scene.time = { delayedCall: vi.fn() };
  scene.add = new Proxy(
    {},
    {
      get: (_target, property) => (): void => {
        drawn.push(String(property));
      },
    },
  );
  return { scene: scene as unknown as RunOverScene, drawn };
}

/** A `#hud` host, so the scene's mount lands on it instead of bailing out. */
function stubHud(host: object | null): void {
  vi.stubGlobal('document', {
    getElementById: (id: string): object | null => (id === 'hud' ? host : null),
  });
}

function stubBrowser(search = ''): void {
  vi.stubGlobal('window', {
    location: { search },
    localStorage: { getItem: (): null => null, setItem: (): void => undefined },
  });
  // `loadSettings` drafts the locale from the browser's tag, so the stub pins one:
  // Node ships the machine's `navigator`, and without this an `es-ES` laptop reads
  // the Spanish table and fails a suite that is green on CI.
  vi.stubGlobal('navigator', { language: 'en-US' });
}

beforeAll(() => {
  stubBrowser();
});

beforeEach(() => {
  mocks.mountRunOver.mockClear();
  vi.unstubAllGlobals();
});

describe('the DOM score screen on a clean boot', () => {
  it('mounts its panel once, with no query string, and draws no chrome', () => {
    stubBrowser();
    const host = {};
    stubHud(host);
    const { scene, drawn } = sceneWithSeams();
    scene.init({ run: lostRun(), won: false });

    scene.create();

    expect(mocks.mountRunOver).toHaveBeenCalledTimes(1);
    expect(mocks.mountRunOver.mock.calls[0]?.[0]).toBe(host);
    expect(drawn).toEqual([]);
    expect(runOverDrawnObjectCount(scene)).toBe(0);
  });

  it('arms the input only after its own delay', () => {
    stubBrowser();
    stubHud({});
    const { scene } = sceneWithSeams();
    scene.init({ run: lostRun(), won: false });

    scene.create();

    expect(scene.time.delayedCall).toHaveBeenCalledTimes(1);
  });

  it('mounts nothing without a HUD layer', () => {
    stubBrowser();
    stubHud(null);
    const { scene } = sceneWithSeams();
    scene.init({ run: lostRun(), won: true });

    scene.create();

    expect(mocks.mountRunOver).not.toHaveBeenCalled();
  });
});

/** The view the panel was mounted with, as the scene built it. */
function mountedView(): RunOverView {
  const view = mocks.mountRunOver.mock.calls[0]?.[1];
  return view as RunOverView;
}

/** A run that earned three badges and eleven tower wins, on floor 20 of the old scale. */
function deepRun(): RunState {
  const run = lostRun();
  return {
    ...run,
    routeIndex: 20,
    badges: [1, 2, 3],
    towerStreak: 11,
    stats: { catches: 9, casualties: 4, faints: 61 },
  };
}

describe('runOverStatValues', () => {
  it('reads the badge count, not the deprecated floor counter', () => {
    const values = runOverStatValues(deepRun());
    expect(values[0]).toBe(3);
    expect(values[0]).not.toBe(20);
  });

  it('reads the catches, the casualties and the tower’s streak', () => {
    expect(runOverStatValues(deepRun())).toStrictEqual([3, 9, 4, 11]);
  });

  it('floors a missing or unreadable streak at zero', () => {
    const run = deepRun();
    expect(runOverStatValues({ ...run, towerStreak: -6 })[3]).toBe(0);
    expect(runOverStatValues({ ...run, towerStreak: Number.NaN })[3]).toBe(0);
    expect(runOverStatValues({ ...run, towerStreak: 2.7 })[3]).toBe(2);
  });
});

describe('the card has no victory state', () => {
  it('mounts a won: false view even when init was handed won: true', () => {
    stubBrowser();
    stubHud({});
    const { scene } = sceneWithSeams();
    scene.init({ run: deepRun(), won: true });

    scene.create();

    const view = mountedView();
    expect(view.won).toBe(false);
    expect(view.title).toBe('You have no more Pokémon!');
    expect(view.blurb).toBe('The run is over — nothing carries over.');
  });

  it('prints the badge count first and the streak fourth, padded to two figures', () => {
    stubBrowser();
    stubHud({});
    const { scene } = sceneWithSeams();
    scene.init({ run: deepRun(), won: true });

    scene.create();

    const stats = mountedView().stats;
    expect(stats.map((stat) => stat.id)).toEqual(['routes', 'catches', 'lost', 'fainted']);
    expect(stats[0].value).toBe('03');
    expect(stats[1].value).toBe('09');
    expect(stats[2].value).toBe('04');
    expect(stats[3].value).toBe('11');
    expect(stats[3].label).toBe('MAX ELITE STRIKE');
  });

  it('reports the same view it mounts', () => {
    stubBrowser();
    stubHud({});
    const { scene } = sceneWithSeams();
    scene.init({ run: deepRun() });

    scene.create();

    const debug = (
      scene as unknown as { debugRunOverState(): ReturnType<RunOverScene['debugRunOverState']> }
    ).debugRunOverState();
    expect(debug.won).toBe(false);
    expect(debug.badges).toBe(3);
    expect(debug.towerStreak).toBe(11);
    expect(debug.tab).toBe('totals');
    expect(debug.stats.map((stat) => stat.value)).toEqual(['03', '09', '04', '11']);
  });

  it('leaves no live victory path in the scene', () => {
    const source = readFileSync(new URL('./RunOverScene.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/headlineWin|blurbWin|won: true/);
    expect(source).toMatch(/liveRunOverView\(this\.run, false,/);
  });
});
