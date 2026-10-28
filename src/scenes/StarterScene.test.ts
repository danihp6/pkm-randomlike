import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { KEYBIND_LABEL_KEYS } from '../ui/settingsScreen';

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

const mocks = vi.hoisted(() => {
  const offers: Readonly<Record<string, readonly string[]>> = {
    'fresh-seed': ['bulbasaur', 'charmander', 'squirtle'],
    'kept-seed': ['chikorita', 'cyndaquil', 'totodile'],
  };
  return {
    offers,
    randomSeed: vi.fn((): string => 'fresh-seed'),
    starterOffer: vi.fn((seed: string): readonly string[] => offers[seed] ?? ['missingno']),
    mountStarter: vi.fn((_host: object, _view: unknown, _intent: unknown) => ({
      update: vi.fn(),
      dispose: vi.fn(),
    })),
  };
});

vi.mock('../engine/rng', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../engine/rng')>();
  return { ...actual, randomSeed: mocks.randomSeed };
});

vi.mock('../engine/run', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../engine/run')>();
  return { ...actual, starterOffer: mocks.starterOffer };
});

vi.mock('../ui/hud/panels/starter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ui/hud/panels/starter')>();
  return { ...actual, mountStarter: mocks.mountStarter };
});

import { keyLabel, type KeybindAction } from '../data/keybinds';
import { LOCALES, es, setLocale, t } from '../i18n';
import { STARTER_POOL_SIZE } from '../data/run';
import { starterDrawnObjectCount, StarterScene } from './StarterScene';

type StarterInternals = {
  seed: string;
  mode: string;
  index: number;
  pool: readonly string[];
  compact: boolean;
  hint: string;
  handleAction(action: KeybindAction): void;
  rerollOffer(): void;
  controlsCopy(): string;
};

function starter(): StarterInternals {
  const scene = new StarterScene() as unknown as StarterInternals;
  scene.mode = 'finite';
  scene.seed = 'kept-seed';
  scene.index = 2;
  scene.pool = ['chikorita', 'cyndaquil', 'totodile'];
  scene.hint = '';
  scene.compact = false;
  return scene;
}

beforeEach(() => {
  mocks.randomSeed.mockClear();
  mocks.starterOffer.mockClear();
  mocks.randomSeed.mockReturnValue('fresh-seed');
});

/** A `#hud` host, so the scene's mount lands on it instead of bailing out. */
function stubHud(host: object | null): void {
  vi.stubGlobal('document', {
    getElementById: (id: string): object | null => (id === 'hud' ? host : null),
  });
}

/** The pieces of a Phaser scene `create` touches, recorded. */
function sceneWithSeams(): {
  scene: StarterScene;
  drawn: string[];
  events: { once: ReturnType<typeof vi.fn> };
} {
  const drawn: string[] = [];
  const scene = new StarterScene() as unknown as {
    scale: { width: number; height: number };
    input: { keyboard: { on: () => void } };
    events: { once: ReturnType<typeof vi.fn> };
    add: unknown;
    create(): void;
  };
  scene.scale = { width: 1280, height: 800 };
  scene.input = { keyboard: { on: (): void => undefined } };
  scene.events = { once: vi.fn() };
  scene.add = new Proxy(
    {},
    {
      get: (_t, property) => (): void => {
        drawn.push(String(property));
      },
    },
  );
  return { scene: scene as unknown as StarterScene, drawn, events: scene.events };
}

describe('the DOM picker on a clean boot', () => {
  beforeAll(() => {
    vi.stubGlobal('window', {
      location: { search: '' },
      localStorage: { getItem: (): null => null, setItem: (): void => undefined },
    });
  });

  beforeEach(() => {
    mocks.mountStarter.mockClear();
    vi.unstubAllGlobals();
  });

  it('mounts its panel once, with no query string, and draws no chrome', () => {
    vi.stubGlobal('window', {
      location: { search: '' },
      localStorage: { getItem: (): null => null, setItem: (): void => undefined },
    });
    const host = {};
    stubHud(host);
    const { scene, drawn } = sceneWithSeams();

    scene.create();

    expect(mocks.mountStarter).toHaveBeenCalledTimes(1);
    expect(mocks.mountStarter.mock.calls[0]?.[0]).toBe(host);
    expect(drawn).toEqual([]);
    expect(starterDrawnObjectCount(scene)).toBe(0);
  });

  it('mounts nothing without a HUD layer', () => {
    vi.stubGlobal('window', {
      location: { search: '' },
      localStorage: { getItem: (): null => null, setItem: (): void => undefined },
    });
    stubHud(null);
    const { scene } = sceneWithSeams();

    scene.create();

    expect(mocks.mountStarter).not.toHaveBeenCalled();
  });
});

describe('rerollOffer', () => {
  it('draws the next offer from the fresh seed, through starterOffer', () => {
    const scene = starter();
    scene.rerollOffer();
    expect(mocks.randomSeed).toHaveBeenCalledTimes(1);
    expect(mocks.starterOffer).toHaveBeenCalledWith('fresh-seed');
    expect(scene.seed).toBe('fresh-seed');
    expect(scene.pool).toEqual(mocks.offers['fresh-seed']);
    expect(scene.pool).toHaveLength(STARTER_POOL_SIZE);
  });

  it('resets the cursor to the first card', () => {
    const scene = starter();
    expect(scene.index).toBe(2);
    scene.rerollOffer();
    expect(scene.index).toBe(0);
  });

  it('keeps the mode a reroll found', () => {
    const scene = starter();
    scene.mode = 'infinite';
    scene.rerollOffer();
    expect(scene.mode).toBe('infinite');
  });

  it('answers the reroll key, not the reset one', () => {
    const scene = starter();
    const reroll = vi.spyOn(scene, 'rerollOffer');
    scene.handleAction('reroll');
    expect(reroll).toHaveBeenCalledTimes(1);
    expect(scene.pool).toEqual(mocks.offers['fresh-seed']);
    reroll.mockClear();
    scene.handleAction('reset');
    expect(reroll).not.toHaveBeenCalled();
  });
});

describe('footer copy', () => {
  it('names the reroll key the player bound, on both layouts', () => {
    const scene = starter();
    scene.compact = false;
    expect(scene.controlsCopy()).toContain(`${keyLabel('R')}  reroll`);
    scene.compact = true;
    expect(scene.controlsCopy()).toContain(`${keyLabel('R')}  reroll`);
  });

  it('names it in both locales, without losing any other slot', () => {
    const wide = { left: 'A', right: 'B', confirm: 'E', reroll: 'R', settings: 'Tab', cancel: 'Q' };
    const compact = { left: 'A', right: 'B', confirm: 'E', reroll: 'R', cancel: 'Q' };
    for (const locale of LOCALES) {
      setLocale(locale);
      expect(t('starter.controls', wide)).toContain('R');
      expect(t('starter.controlsCompact', compact)).toContain('R');
      expect(es[KEYBIND_LABEL_KEYS.reroll]).toBeTruthy();
      expect(t(KEYBIND_LABEL_KEYS.reroll)).toBeTruthy();
    }
    setLocale('en');
  });
});
