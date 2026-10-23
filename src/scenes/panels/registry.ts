import type { RoutePanelDescriptor, RoutePanelId } from './types';

/**
 * The panel registry (`D47`'s shape, one folder over): one descriptor per route
 * panel, collected from the `src/scenes/panels/` folder itself, so a new panel is a
 * new file and the scene is not edited. It imports Phaser **not at all** — not even
 * as a type — and knows nothing about the browser, so the collection rules are
 * unit-tested headless.
 */

/** A Vite module map: what `import.meta.glob(..., { eager: true })` returns. */
export type PanelModules = Readonly<Record<string, unknown>>;

/** The route's panels, indexed once per scene. */
export type PanelRegistry = Readonly<{
  /** Every descriptor, keyed by the id it claims. */
  byId: ReadonlyMap<RoutePanelId, RoutePanelDescriptor>;
  /** Every descriptor, ascending by `order` — the build, raise and close sequence. */
  all: readonly RoutePanelDescriptor[];
}>;

/** Every id a descriptor may claim, so a stray export can never name a panel. */
const PANEL_IDS: readonly RoutePanelId[] = [
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
];

/** True for a string the panel union names (`RoutePanelId` is erased at run time). */
function isPanelId(value: unknown): value is RoutePanelId {
  return typeof value === 'string' && (PANEL_IDS as readonly string[]).includes(value);
}

/**
 * The `descriptor` a module exports, when it exports one that is an object with an
 * id in `RoutePanelId`. Every other module (`types.ts`, `registry.ts`, a helper) is
 * skipped silently, so the folder may hold non-descriptor files.
 */
function descriptorOf(module: unknown): RoutePanelDescriptor | null {
  if (typeof module !== 'object' || module === null) return null;
  const candidate = (module as { descriptor?: unknown }).descriptor;
  if (typeof candidate !== 'object' || candidate === null) return null;
  if (!isPanelId((candidate as { id?: unknown }).id)) return null;
  return candidate as RoutePanelDescriptor;
}

/** Collects the `descriptor` each module exports. Throws on a duplicate id or order. */
export function collectPanels(modules: PanelModules): PanelRegistry {
  const byId = new Map<RoutePanelId, RoutePanelDescriptor>();
  const idOwner = new Map<RoutePanelId, string>();
  const orderOwner = new Map<number, string>();
  for (const [path, module] of Object.entries(modules)) {
    const descriptor = descriptorOf(module);
    if (!descriptor) continue;
    const claimed = idOwner.get(descriptor.id);
    if (claimed !== undefined) {
      throw new Error(`two panel descriptors claim the id ${descriptor.id}: ${claimed}, ${path}`);
    }
    idOwner.set(descriptor.id, path);
    const sorted = orderOwner.get(descriptor.order);
    if (sorted !== undefined) {
      throw new Error(`two panel descriptors claim the order ${descriptor.order}: ${sorted}, ${path}`);
    }
    orderOwner.set(descriptor.order, path);
    byId.set(descriptor.id, descriptor);
  }
  const all = [...byId.values()].sort((a, b) => a.order - b.order);
  return { byId, all };
}
