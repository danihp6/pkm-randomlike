import { getBiome } from '../data/biomes';
import { biomeForMap } from '../engine/maps/plan';
import { encodeRunShare, type RunState } from '../engine/run';
import { t } from '../i18n';

/**
 * The end-of-run score screen's model (Phase 7). It reports what the run did —
 * routes cleared, Pokémon caught, Pokémon lost, enemies fainted — and the seed
 * that reproduces it, both as the raw seed and as the share string someone could
 * hand over (D21). Pure, so the numbers are testable without a scene;
 * `RunOverScene` draws the lines.
 */

/** The window after the last release beat during which a stray confirm is ignored. */
export const RUN_OVER_INPUT_DELAY_MS = 300;

/**
 * The dash both run-over surfaces print for a figure the run never recorded
 * (U+2014). It is the mark of *unknown*, never of zero.
 */
export const RUN_SUMMARY_EM_DASH = '\u2014';

/**
 * A counter the run recorded, as a whole number of at least zero, or `null` when
 * the run never recorded it. `undefined`, `NaN` and `Infinity` are *unrecorded*
 * (`null`); any finite number is recorded, is truncated toward zero and is clamped
 * to `0`. A recorded `0` therefore reads `0`, not `null`.
 */
export function recordedCount(value: number | undefined): number | null {
  if (value === undefined || !Number.isFinite(value)) return null;
  return Math.max(0, Math.trunc(value));
}

export type RunSummary = Readonly<{
  won: boolean;
  /** Routes fully cleared: everything before the one that ended a lost run. */
  routesCleared: number;
  catches: number;
  casualties: number;
  /** Enemies the run fainted (`recordedCount(run.stats.faints)`); `null` when never recorded. */
  faints: number | null;
  seed: string;
  /** The seed and mode as a token that starts the same run again (`D21`). */
  share: string;
}>;

/** What the score screen reports: a win clears its route, a loss does not. */
export function runSummary(run: RunState, won: boolean): RunSummary {
  return {
    won,
    routesCleared: won ? run.routeIndex : Math.max(0, run.routeIndex - 1),
    catches: run.stats.catches,
    casualties: run.stats.casualties,
    faints: recordedCount(run.stats.faints),
    seed: run.seed,
    share: encodeRunShare(run),
  };
}

/** The lines the score screen shows, in order: headline, blurb, then the stats. */
export function runSummaryLines(summary: RunSummary): string[] {
  const headline = summary.won ? t('runOver.headlineWin') : t('runOver.headlineLoss');
  const blurb = summary.won ? t('runOver.blurbWin') : t('runOver.blurbLoss');
  return [
    headline,
    blurb,
    t('runOver.routes', { count: summary.routesCleared }),
    t('runOver.caught', { count: summary.catches }),
    t('runOver.lostFainted', {
      lost: summary.casualties,
      fainted: summary.faints ?? RUN_SUMMARY_EM_DASH,
    }),
    t('runOver.seed', { seed: summary.seed }),
    t('runOver.share', { share: summary.share }),
  ];
}

/**
 * The saved run's position for the main menu's Continue row: the map it stands on
 * and that map's biome, in the route HUD's own wording, so the menu and the HUD
 * can never disagree.
 */
export function runPositionLabel(run: RunState): string {
  return t('route.mapTitle', {
    map: run.mapIndex,
    biome: getBiome(biomeForMap(run.seed, run.mapIndex)).name,
  });
}
