import type { MapRoomSpecial } from '../../engine/maps';
import type { MapRoomMarker } from '../../ui/mapView';
import type { RoomDescriptor } from './types';

/**
 * The room registry (`D47`): one descriptor per special room kind, collected from
 * the `src/scenes/rooms/` folder itself, so a new room kind is a new file and the
 * scene is not edited. It imports Phaser **not at all** — not even as a type — and
 * knows nothing about the browser, so the collection rules are unit-tested
 * headless.
 */

/** A Vite module map: what `import.meta.glob(..., { eager: true })` returns. */
export type RoomModules = Readonly<Record<string, unknown>>;

/** The floor's descriptors, indexed once per scene. */
export type RoomRegistry = Readonly<{
  /** Every descriptor, keyed by the room kind it claims. */
  byKind: ReadonlyMap<MapRoomSpecial, RoomDescriptor>;
  /** Every descriptor that draws a marker, keyed by the marker it draws. */
  byMarker: ReadonlyMap<MapRoomMarker, RoomDescriptor>;
}>;

/**
 * The `descriptor` a module exports, when it exports one that is an object with a
 * string `kind`. Every other module (`types.ts`, `registry.ts`, a helper) is
 * skipped silently, so the folder may hold non-descriptor files.
 */
function descriptorOf(module: unknown): RoomDescriptor | null {
  if (typeof module !== 'object' || module === null) return null;
  const candidate = (module as { descriptor?: unknown }).descriptor;
  if (typeof candidate !== 'object' || candidate === null) return null;
  if (typeof (candidate as { kind?: unknown }).kind !== 'string') return null;
  return candidate as RoomDescriptor;
}

/** Collects the descriptor each module exports as `descriptor`. */
export function collectDescriptors(modules: RoomModules): RoomRegistry {
  const byKind = new Map<MapRoomSpecial, RoomDescriptor>();
  const byMarker = new Map<MapRoomMarker, RoomDescriptor>();
  const claimedBy = new Map<MapRoomSpecial, string>();
  for (const [path, module] of Object.entries(modules)) {
    const descriptor = descriptorOf(module);
    if (!descriptor) continue;
    const claimed = claimedBy.get(descriptor.kind);
    if (claimed !== undefined) {
      throw new Error(`two room descriptors claim the kind ${descriptor.kind}: ${claimed}, ${path}`);
    }
    claimedBy.set(descriptor.kind, path);
    byKind.set(descriptor.kind, descriptor);
    if (descriptor.drawMarker) byMarker.set(descriptor.marker, descriptor);
  }
  return { byKind, byMarker };
}
