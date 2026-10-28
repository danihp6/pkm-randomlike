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
  mountOptionsPanel: vi.fn((_host: object, _view: unknown, _command: unknown) => () => undefined),
}));

vi.mock('../ui/hud/panels/options', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ui/hud/panels/options')>();
  return { ...actual, mountOptionsPanel: mocks.mountOptionsPanel };
});

import { SettingsScene } from './SettingsScene';

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

/** The pieces of a Phaser scene `create` touches, recorded. */
function sceneWithSeams(): { scene: SettingsScene; drawn: string[] } {
  const drawn: string[] = [];
  const scene = new SettingsScene() as unknown as {
    input: { keyboard: { on: ReturnType<typeof vi.fn> } | null };
    events: { once: ReturnType<typeof vi.fn> };
    add: unknown;
    init(data?: { from?: 'Route' | 'Starter' | 'MainMenu' }): void;
    create(): void;
  };
  scene.input = { keyboard: { on: vi.fn() } };
  scene.events = { once: vi.fn() };
  scene.add = new Proxy(
    {},
    {
      get: (_target, property) => (): void => {
        drawn.push(String(property));
      },
    },
  );
  return { scene: scene as unknown as SettingsScene, drawn };
}

beforeAll(() => {
  stubBrowser();
});

beforeEach(() => {
  mocks.mountOptionsPanel.mockClear();
  vi.unstubAllGlobals();
});

describe('the DOM options page on a clean boot', () => {
  it('mounts its panel once, with no query string, and draws no canvas page', () => {
    stubBrowser();
    const host = {};
    stubHud(host);
    const { scene, drawn } = sceneWithSeams();
    scene.init({ from: 'MainMenu' });

    scene.create();

    expect(mocks.mountOptionsPanel).toHaveBeenCalledTimes(1);
    expect(mocks.mountOptionsPanel.mock.calls[0]?.[0]).toBe(host);
    expect(drawn).toEqual([]);
  });

  it('keeps the key router on the keyboard plugin and not on a canvas row', () => {
    stubBrowser();
    stubHud({});
    const { scene } = sceneWithSeams();
    scene.init({ from: 'Starter' });

    scene.create();

    // The shared keybind map's own `keydown` plus the capture listener.
    expect(scene.input.keyboard?.on).toHaveBeenCalledTimes(2);
    expect(scene.events.once).toHaveBeenCalledWith('shutdown', expect.any(Function));
  });

  it('mounts nothing without a HUD layer', () => {
    stubBrowser();
    stubHud(null);
    const { scene } = sceneWithSeams();
    scene.init();

    scene.create();

    expect(mocks.mountOptionsPanel).not.toHaveBeenCalled();
  });
});
