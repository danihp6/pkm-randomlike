/**
 * The region node scenes' folder registry (`D47`'s shape, one folder over): a city,
 * a gym or the League registers itself by exporting `regionSceneKey` and
 * `regionSceneClass`, so a new node scene is a new file and `src/main.ts` is not
 * edited again. The glob names `services.ts` beside the `*Scene.ts` files, so a room
 * whose file is named for what it is (the Centre) is collected too. The collection
 * rules are pure and unit-tested headless: this module imports Phaser **not at all**,
 * not even as a type.
 */

/** What the registry reads off a scene module: both markers or neither. */
export type RegionSceneEntry = Readonly<{ key: string; Scene: unknown }>;

/**
 * The two exports a module needs, or null when it exports one and not the other — a
 * module exporting neither is skipped silently, so the folder may hold helpers and
 * the base `WorldScene`.
 */
function entryOf(module: unknown): RegionSceneEntry | null {
  if (typeof module !== 'object' || module === null) return null;
  const candidate = module as { regionSceneKey?: unknown; regionSceneClass?: unknown };
  if (typeof candidate.regionSceneKey !== 'string') return null;
  if (candidate.regionSceneClass === undefined || candidate.regionSceneClass === null) return null;
  return { key: candidate.regionSceneKey, Scene: candidate.regionSceneClass };
}

/** Collects every module that exports both markers; throws on a duplicate key. */
export function collectRegionScenes(
  modules: Readonly<Record<string, unknown>>,
): readonly RegionSceneEntry[] {
  const entries: RegionSceneEntry[] = [];
  const owners = new Map<string, string>();
  for (const [path, module] of Object.entries(modules)) {
    const entry = entryOf(module);
    if (entry === null) continue;
    const claimed = owners.get(entry.key);
    if (claimed !== undefined) {
      throw new Error(`two region scenes claim the key ${entry.key}: ${claimed}, ${path}`);
    }
    owners.set(entry.key, path);
    entries.push(entry);
  }
  return entries;
}

/** Every region scene file in this folder, eagerly, so `REGION_SCENES` is a plain array. */
const MODULES = import.meta.glob(['./*Scene.ts', './services.ts', '!./*.test.ts'], { eager: true });

/** Every region node scene in this folder, ready for `main.ts`'s `scene` array. */
export const REGION_SCENES: readonly RegionSceneEntry[] = collectRegionScenes(MODULES);
