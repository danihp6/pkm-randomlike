import { describe, expect, it, vi } from 'vitest';
import { collectPanels, type PanelModules } from './registry';

/**
 * The texture-key module builds textures with Phaser, which a headless test cannot
 * load; the folder's own modules are collected without it.
 */
vi.mock('../BootScene', () => ({
  PANEL_ICON_KEYS: { header: 'route:icon-map' },
  PANEL_ICON_SIZE: 24,
  SHOP_COUNTER_TEXTURE_KEY: 'route:shop-counter',
}));

/** The folder's sources, so each file's own `descriptor` export can be read off it. */
const SOURCES = import.meta.glob('./*.ts', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Readonly<Record<string, string>>;

/** The folder's modules, exactly the map `RouteScene`'s registry glob hands over. */
const MODULES = import.meta.glob(['./*.ts', '!./*.test.ts'], { eager: true }) as PanelModules;

/** Every file of the folder that is not a test. */
const PANEL_PATHS = Object.keys(SOURCES).filter((path) => !path.endsWith('.test.ts'));

/** The folder's own shared modules: the port and the registry, neither a panel. */
const SHARED_PATHS = ['./registry.ts', './types.ts'];

/** The panels the shipped descriptors claim, in `order` sequence. */
const SHIPPED_IDS = [
  'map',
  'party',
  'hud',
  'bag',
  'pc',
  'notices',
  'rewards',
  'shop',
  'trade',
  'pause',
  'detail',
] as const;

/** Their frozen build/z orders. */
const SHIPPED_ORDERS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110];

/** A synthetic module holding one descriptor, for an id/order pair the folder never had. */
const moduleWith = (id: string, order = 1): unknown => ({ descriptor: { id, order } });

describe('collectPanels', () => {
  it('indexes the folder it is handed, in order sequence', () => {
    const registry = collectPanels(MODULES);
    expect(registry.all).toHaveLength(SHIPPED_IDS.length);
    expect(registry.all.map((panel) => panel.id)).toEqual([...SHIPPED_IDS]);
    expect(registry.all.map((panel) => panel.order)).toEqual(SHIPPED_ORDERS);
    for (const id of SHIPPED_IDS) {
      expect(registry.byId.get(id)?.id, id).toBe(id);
    }
  });

  it('discovers every panel module of the folder it is handed', () => {
    const declared = PANEL_PATHS.filter((path) => /export const descriptor\b/.test(SOURCES[path]));
    expect(declared.length).toBe(SHIPPED_IDS.length);
    for (const path of declared) {
      expect(Object.keys(MODULES), path).toContain(path);
    }
  });

  it('names every panel after its own module', () => {
    for (const id of SHIPPED_IDS) {
      const path = `./${id}.ts`;
      const descriptor = (MODULES[path] as { descriptor?: { id?: string } }).descriptor;
      expect(descriptor?.id, path).toBe(id);
    }
  });

  it('leaves the folder’s shared, descriptor-less modules out', () => {
    for (const path of SHARED_PATHS) {
      expect(SOURCES[path], path).toBeDefined();
      expect(SOURCES[path], path).not.toMatch(/export const descriptor\b/);
    }
  });

  it('gives every panel file exactly one descriptor export', () => {
    for (const path of PANEL_PATHS) {
      if (SHARED_PATHS.includes(path)) continue;
      const exports = SOURCES[path].match(/\bexport const descriptor\b/g) ?? [];
      expect(exports.length, path).toBe(1);
    }
  });

  it('keeps every panel behind the host port', () => {
    for (const path of PANEL_PATHS) {
      if (SHARED_PATHS.includes(path)) continue;
      expect(SOURCES[path], path).not.toMatch(/from '\.\.?\/RouteScene'/);
      expect(SOURCES[path], path).not.toMatch(/import Phaser from 'phaser'/);
    }
  });

  it('throws when two descriptors claim one id, in module-map key order', () => {
    const modules: PanelModules = {
      './panels/a.ts': moduleWith('bag'),
      './panels/b.ts': moduleWith('bag'),
    };
    expect(() => collectPanels(modules)).toThrow(
      'two panel descriptors claim the id bag: ./panels/a.ts, ./panels/b.ts',
    );
  });

  it('throws when two descriptors claim one order, in module-map key order', () => {
    const modules: PanelModules = {
      './panels/a.ts': moduleWith('bag', 40),
      './panels/b.ts': moduleWith('pc', 40),
    };
    expect(() => collectPanels(modules)).toThrow(
      'two panel descriptors claim the order 40: ./panels/a.ts, ./panels/b.ts',
    );
  });

  it('skips every module without a descriptor export', () => {
    const registry = collectPanels({
      './panels/types.ts': { RouteHost: {} },
      './panels/helper.ts': {},
      './panels/nothing.ts': null,
      './panels/text.ts': "export const descriptor = { id: 'map', order: 1 }",
      './panels/loose.ts': { descriptor: 'map' },
      './panels/unknown.ts': moduleWith('mystery'),
    });
    expect(registry.all).toHaveLength(0);
    expect(registry.byId.size).toBe(0);
  });
});
