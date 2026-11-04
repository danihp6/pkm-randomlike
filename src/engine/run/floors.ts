import { levelCapForMap } from '../../data/maps';
import { LEVEL_BANDS, bandForLevel, type LevelBand } from '../../data/run';

/**
 * The level window a screen reads: it opens at the **previous map's cap** and closes
 * at this map's cap. Map 1 opens at the run's first band floor
 * (`LEVEL_BANDS[0].minLevel`), because there is no previous cap. The cap is a map's
 * only level anchor, so the window is derived, never stored (D29).
 */
export function levelWindowForMap(
  mapIndex: number,
): Readonly<{ minLevel: number; maxLevel: number }> {
  const index = Math.max(1, Math.floor(mapIndex));
  const minLevel = index <= 1 ? LEVEL_BANDS[0].minLevel : levelCapForMap(index - 1);
  return { minLevel, maxLevel: levelCapForMap(index) };
}

/**
 * The **band** a carver preview reads for its species pool and roster size: the
 * floor's level window (`docs/maps-spec.md` §5) with the archetype pool its floor
 * falls in. A preview is not a region node, so it has no plan to walk and no node
 * badge to read: the route index it carries is the floor it stands for.
 */
export function runBand(seed: string, routeIndex: number): LevelBand {
  void seed;
  return bandForMap(routeIndex);
}

/**
 * The band of a map by its badge, for callers that hold the node the run stands on
 * (`runNode(run).badge`) rather than a carver preview's global route index.
 */
export function bandForMap(mapIndex: number): LevelBand {
  const window = levelWindowForMap(mapIndex);
  return {
    ...bandForLevel(window.minLevel),
    minLevel: window.minLevel,
    maxLevel: window.maxLevel,
  };
}
