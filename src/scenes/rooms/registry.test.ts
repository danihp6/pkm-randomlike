import { describe, expect, it, vi } from 'vitest';
import type { MapRoomSpecial } from '../../engine/maps';
import { collectDescriptors, type RoomModules } from './registry';

/**
 * The scene's texture-key module builds textures with Phaser, which a headless test
 * cannot load; the folder's own modules are collected without it.
 */
vi.mock('../BootScene', () => ({ SHOP_COUNTER_TEXTURE_KEY: 'route:shop-counter' }));

/** The folder's sources, so each file's own `descriptor` export can be read off it. */
const SOURCES = import.meta.glob('./*.ts', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Readonly<Record<string, string>>;

/** The folder's modules, exactly the map `RouteScene`'s registry glob hands over. */
const MODULES = import.meta.glob(['./*.ts', '!./*.test.ts'], { eager: true }) as RoomModules;

/** Every file of the folder that is not a test. */
const ROOM_PATHS = Object.keys(SOURCES).filter((path) => !path.endsWith('.test.ts'));

/** The folder's own shared modules: the port and the registry, neither a room. */
const SHARED_PATHS = ['./registry.ts', './types.ts'];

/** The kinds the shipped descriptors claim (`docs/maps-spec.md` §7). */
const SHIPPED_KINDS = [
  'mini-boss',
  'mega-stone',
  'casino',
  'gated',
  'trade',
  'no-heal',
  'static',
] as const;

/** A synthetic module holding one descriptor, for a kind the folder never had. */
const moduleWith = (kind: string): unknown => ({ descriptor: { kind, marker: kind } });

describe('collectDescriptors', () => {
  it('indexes one descriptor per shipped kind', () => {
    const registry = collectDescriptors(MODULES);
    for (const kind of SHIPPED_KINDS) {
      const descriptor = registry.byKind.get(kind);
      expect(descriptor, kind).toBeDefined();
      expect(descriptor?.kind, kind).toBe(kind);
      expect(registry.byMarker.get(kind), kind).toBe(descriptor);
    }
  });

  it('finds no shop descriptor: the Mart is the merchant NPC', () => {
    const registry = collectDescriptors(MODULES);
    const kinds: readonly string[] = [...registry.byKind.keys()];
    expect(kinds).not.toContain('shop');
    expect(Object.keys(MODULES), './shop.ts is still a module').toContain('./shop.ts');
    expect(registry.byKind.size).toBe(SHIPPED_KINDS.length);
  });

  it('discovers every room module of the folder it is handed', () => {
    const declared = ROOM_PATHS.filter((path) => /export const descriptor\b/.test(SOURCES[path]));
    expect(declared.length).toBeGreaterThanOrEqual(SHIPPED_KINDS.length);
    for (const path of declared) {
      expect(Object.keys(MODULES), path).toContain(path);
    }
    expect(collectDescriptors(MODULES).byKind.size).toBe(declared.length);
  });

  it('leaves the folder’s shared, descriptor-less modules out', () => {
    for (const path of [...SHARED_PATHS, './shop.ts']) {
      expect(SOURCES[path], path).toBeDefined();
      expect(SOURCES[path], path).not.toMatch(/export const descriptor\b/);
    }
  });

  it('collects a module with a kind the registry has never seen', () => {
    const registry = collectDescriptors({
      './rooms/mystery.ts': moduleWith('mystery'),
      './rooms/casino.ts': moduleWith('casino'),
    });
    expect(registry.byKind.get('casino' as MapRoomSpecial)).toMatchObject({ kind: 'casino' });
  });

  it('keys a marker by the room kind that draws it', () => {
    const registry = collectDescriptors(MODULES);
    for (const kind of SHIPPED_KINDS) {
      expect(registry.byMarker.get(kind)?.kind, kind).toBe(kind);
    }
  });

  it('throws when two descriptors claim one kind, in module-map key order', () => {
    const modules: RoomModules = {
      './rooms/first.ts': moduleWith('trade'),
      './rooms/second.ts': moduleWith('trade'),
    };
    expect(() => collectDescriptors(modules)).toThrow(
      'two room descriptors claim the kind trade: ./rooms/first.ts, ./rooms/second.ts',
    );
  });

  it('skips every module without a descriptor export', () => {
    const registry = collectDescriptors({
      './rooms/types.ts': { RoomHost: {} },
      './rooms/helper.ts': {},
      './rooms/nothing.ts': null,
      './rooms/text.ts': "export const descriptor = { kind: 'mystery' }",
      './rooms/loose.ts': { descriptor: 'mystery' },
    });
    expect(registry.byKind.size).toBe(0);
    expect(registry.byMarker.size).toBe(0);
  });
});
