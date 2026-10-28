import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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
import { runOverDrawnObjectCount, RunOverScene } from './RunOverScene';

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
