import type Phaser from 'phaser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings, loadSave, type Settings } from '../../engine/save';
import { createRun, createRunPokemon } from '../../engine/run';
import type { RunState } from '../../engine/run/state';
import { initialPartyUi } from '../../ui/partyScreen';
import { descriptor as bag } from './bag';
import { createPanels, createScenePanels, NODE_PANEL_IDS } from './host';
import { hudMetrics } from './hud';
import { descriptor as missions } from './missions';
import { descriptor as party } from './party';
import type { RoutePanelDescriptor, RoutePanelHost } from './types';

/**
 * The folder's panel modules read their texture keys from `BootScene`, which builds
 * textures with Phaser and cannot load headless, exactly as the registry's own test
 * treats it.
 */
vi.mock('../BootScene', () => ({
  PANEL_ICON_KEYS: { header: 'route:icon-map' },
  PANEL_ICON_SIZE: 24,
  SHOP_COUNTER_TEXTURE_KEY: 'route:shop-counter',
}));

/** The port's frozen members, in the order `RoutePanelHost` declares them. */
const HOST_MEMBERS = [
  'scene',
  'run',
  'settings',
  'hudLayout',
  'setHudLayout',
  'hud',
  'hudCardOpen',
  'setHudCardOpen',
  'ui',
  'setUi',
  'commitRun',
  'persistRun',
  'refreshHud',
  'openPanel',
  'closePanel',
  'panelOpen',
  'showNotice',
  'startWildBattle',
  'startTrainerBattle',
  'route',
  'openSettings',
  'restartRun',
  'flyToNode',
];

/** Every card the folder ships, in `order` sequence, with the order each claims. */
const SHIPPED = [
  ['map', 10],
  ['party', 20],
  ['hud', 30],
  ['bag', 40],
  ['pc', 50],
  ['notices', 60],
  ['missions', 65],
  ['rewards', 70],
  ['shop', 80],
  ['trade', 90],
  ['pause', 100],
  ['detail', 110],
] as const;

/** The scene a headless build hands the host: a scale, the pause flag and the bus. */
type StubScene = {
  scale: { width: number; height: number };
  sys: { isPaused: () => boolean };
  events: {
    once: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
  };
};

function stubScene(width = 1280, height = 800): StubScene {
  return {
    scale: { width, height },
    sys: { isPaused: () => false },
    events: { once: vi.fn(), on: vi.fn(), off: vi.fn() },
  };
}

function sceneOf(stub: StubScene): Phaser.Scene {
  return stub as unknown as Phaser.Scene;
}

function aRun(seed = 'task-300'): RunState {
  return createRun({
    seed,
    starter: createRunPokemon({ id: 'starter', speciesId: 'treecko', level: 5, moves: ['pound'] }),
  });
}

function aSettings(): Settings {
  return defaultSettings();
}

/** A descriptor's hooks as a mutable record, so a test can spy on one panel only. */
type Spyable = {
  build(host: RoutePanelHost): void;
  refresh?(host: RoutePanelHost): void;
  close?(host: RoutePanelHost): void;
};

function spyOn(descriptor: RoutePanelDescriptor): Spyable {
  return descriptor as Spyable;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('createScenePanels over a scene that brings nothing but a run', () => {
  it('defines every member of the port and nothing else', () => {
    const { host } = createScenePanels({
      scene: sceneOf(stubScene()),
      run: () => aRun(),
      settings: () => aSettings(),
    });

    expect(Object.keys(host)).toEqual(HOST_MEMBERS);
  });

  it('answers the total defaults a scene without a slot or route gets', () => {
    const scene = stubScene();
    const { host } = createScenePanels({
      scene: sceneOf(scene),
      run: () => aRun(),
      settings: () => aSettings(),
    });

    expect(host.scene).toBe(sceneOf(scene));
    expect(host.panelOpen()).toBe(false);
    expect(() => host.openPanel({ close: () => undefined })).not.toThrow();
    expect(() => host.closePanel()).not.toThrow();
    expect(host.panelOpen()).toBe(false);
    expect(host.route()).toBeNull();
    expect(host.ui()).toEqual(initialPartyUi());
    for (const action of [
      () => host.showNotice({ text: 'a', holdMs: 10 }),
      () => host.startWildBattle({ speciesId: 'zigzagoon', level: 3, key: 'dev' }),
      () => host.startTrainerBattle({} as never),
      () => host.openSettings(),
      () => host.restartRun(),
      () => host.flyToNode('city:1'),
      () => host.commitRun(aRun()),
      () => host.persistRun(),
    ]) {
      expect(action).not.toThrow();
    }
  });

  it('reads the run, the settings and the HUD metrics live', () => {
    const scene = stubScene();
    let run = aRun('first');
    const { host } = createScenePanels({
      scene: sceneOf(scene),
      run: () => run,
      settings: () => aSettings(),
    });

    run = aRun('second');
    expect(host.run().seed).toBe('second');
    expect(host.hud()).toEqual(hudMetrics(1280));
    scene.scale = { width: 390, height: 844 };
    expect(host.hud()).toEqual(hudMetrics(390));
  });

  it('starts with the saved layout open flags and keeps its own copy of them', () => {
    const { host } = createScenePanels({
      scene: sceneOf(stubScene()),
      run: () => aRun(),
      settings: () => aSettings(),
    });

    // A fresh save opens PARTY and collapses every other card.
    expect(host.hudCardOpen('party')).toBe(true);
    expect(host.hudCardOpen('bag')).toBe(false);

    host.setHudCardOpen('bag', true);
    expect(host.hudCardOpen('bag')).toBe(true);
    expect(host.hudLayout().bag).toEqual({ dx: 0, dy: 0, collapsed: false });

    host.setHudCardOpen('bag', false);
    expect(host.hudCardOpen('bag')).toBe(false);
    expect(host.hudLayout().bag.collapsed).toBe(true);
  });

  it('persists a layout through the settings before it repaints', () => {
    const stored = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => stored.get(key) ?? null,
        setItem: (key: string, value: string) => stored.set(key, value),
        removeItem: (key: string) => stored.delete(key),
      },
    });
    const { host } = createScenePanels({
      scene: sceneOf(stubScene()),
      run: () => aRun(),
      settings: () => aSettings(),
    });

    const layout = { ...host.hudLayout(), missions: { dx: 12, dy: -4, collapsed: false } };
    host.setHudLayout(layout);

    expect(host.hudLayout().missions).toEqual({ dx: 12, dy: -4, collapsed: false });
    expect(host.hudCardOpen('missions')).toBe(true);
    const storage = { getItem: (k: string) => stored.get(k) ?? null } as never;
    expect(loadSave(storage).settings.hudLayout.missions).toEqual({
      dx: 12,
      dy: -4,
      collapsed: false,
    });
  });

  it('delegates every action the scene hands over', () => {
    const calls: string[] = [];
    const { host } = createScenePanels({
      scene: sceneOf(stubScene()),
      run: () => aRun(),
      settings: () => aSettings(),
      slot: {
        open: () => calls.push('open'),
        close: () => calls.push('close'),
        isOpen: () => true,
      },
      actions: {
        showNotice: () => calls.push('notice'),
        startWildBattle: () => calls.push('wild'),
        startTrainerBattle: () => calls.push('trainer'),
        openSettings: () => calls.push('settings'),
        restartRun: () => calls.push('restart'),
        flyToNode: () => calls.push('fly'),
        commitRun: () => calls.push('commit'),
        persistRun: () => calls.push('persist'),
      },
    });

    host.openPanel({ close: () => undefined });
    host.closePanel();
    expect(host.panelOpen()).toBe(true);
    host.showNotice({ text: 'a', holdMs: 10 });
    host.startWildBattle({ speciesId: 'zigzagoon', level: 3, key: 'dev' });
    host.startTrainerBattle({} as never);
    host.openSettings();
    host.restartRun();
    host.flyToNode('city:1');
    host.commitRun(aRun());
    host.persistRun();

    expect(calls).toEqual([
      'open',
      'close',
      'notice',
      'wild',
      'trainer',
      'settings',
      'restart',
      'fly',
      'commit',
      'persist',
    ]);
  });
});

describe('createPanels', () => {
  it('collects the twelve shipped cards in order sequence', () => {
    const registry = createPanels();

    expect(registry.all.map((panel) => panel.id)).toEqual(SHIPPED.map(([id]) => id));
    expect(registry.all.map((panel) => panel.order)).toEqual(SHIPPED.map(([, order]) => order));
  });

  it('selects the twelve when a scene names none', () => {
    const { panels } = createScenePanels({
      scene: sceneOf(stubScene()),
      run: () => aRun(),
      settings: () => aSettings(),
    });

    expect(panels.map((panel) => panel.id)).toEqual(SHIPPED.map(([id]) => id));
  });

  it('selects a node scene’s seven in the same relative order', () => {
    const { panels } = createScenePanels({
      scene: sceneOf(stubScene()),
      run: () => aRun(),
      settings: () => aSettings(),
      panels: NODE_PANEL_IDS,
    });

    expect(panels.map((panel) => panel.id)).toEqual([
      'party',
      'bag',
      'missions',
      'rewards',
      'trade',
      'pause',
      'detail',
    ]);
    expect(panels.map((panel) => panel.order)).toEqual([20, 40, 65, 70, 90, 100, 110]);
  });

  it('throws on an id the folder does not ship', () => {
    expect(() =>
      createScenePanels({
        scene: sceneOf(stubScene()),
        run: () => aRun(),
        settings: () => aSettings(),
        panels: ['party', 'mystery' as never],
      }),
    ).toThrow('unknown panel id: mystery');
  });
});

describe('the layer lifecycle', () => {
  /** The three cards a lifecycle test mounts, in registry order. */
  const buildOrder = (): string[] => {
    const order: string[] = [];
    const record = (name: string) => () => {
      order.push(name);
    };
    vi.spyOn(spyOn(party), 'build').mockImplementation(record('party'));
    vi.spyOn(spyOn(bag), 'build').mockImplementation(record('bag'));
    vi.spyOn(spyOn(missions), 'build').mockImplementation(record('missions'));
    vi.spyOn(spyOn(party), 'refresh').mockImplementation(record('party'));
    vi.spyOn(spyOn(bag), 'refresh').mockImplementation(record('bag'));
    vi.spyOn(spyOn(missions), 'refresh').mockImplementation(record('missions'));
    return order;
  };

  it('mounts every card in order and registers one shutdown', () => {
    const order = buildOrder();
    const closeSpies = [
      vi.spyOn(spyOn(party), 'close').mockImplementation(() => order.push('party')),
      vi.spyOn(spyOn(bag), 'close').mockImplementation(() => order.push('bag')),
      vi.spyOn(spyOn(missions), 'close').mockImplementation(() => order.push('missions')),
    ];
    const scene = stubScene();
    const layer = createScenePanels({
      scene: sceneOf(scene),
      run: () => aRun(),
      settings: () => aSettings(),
      panels: ['party', 'bag', 'missions'],
    });

    layer.build();

    expect(order).toEqual(['party', 'bag', 'missions']);
    expect(scene.events.once).toHaveBeenCalledTimes(1);
    expect(scene.events.once.mock.calls[0]?.[0]).toBe('shutdown');
    expect(closeSpies.every((spy) => spy.mock.calls.length === 0)).toBe(true);
  });

  it('unmounts in reverse order and only once', () => {
    const order = buildOrder();
    [
      vi.spyOn(spyOn(party), 'close').mockImplementation(() => order.push('party')),
      vi.spyOn(spyOn(bag), 'close').mockImplementation(() => order.push('bag')),
      vi.spyOn(spyOn(missions), 'close').mockImplementation(() => order.push('missions')),
    ];
    const scene = stubScene();
    const layer = createScenePanels({
      scene: sceneOf(scene),
      run: () => aRun(),
      settings: () => aSettings(),
      panels: ['party', 'bag', 'missions'],
    });
    layer.build();
    order.length = 0;

    const onShutdown = scene.events.once.mock.calls[0]?.[1] as (() => void) | undefined;
    onShutdown?.();
    layer.close();
    layer.close();

    expect(order).toEqual(['missions', 'bag', 'party']);
  });

  it('repaints every selected card once, in order', () => {
    const order = buildOrder();
    const layer = createScenePanels({
      scene: sceneOf(stubScene()),
      run: () => aRun(),
      settings: () => aSettings(),
      panels: ['party', 'bag', 'missions'],
    });

    layer.refresh();

    expect(order).toEqual(['party', 'bag', 'missions']);
  });
});
