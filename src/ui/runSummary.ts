import { encodeRunShare, type RunState } from '../engine/run';

/**
 * The end-of-run score screen's model (Phase 7). It reports what the run did —
 * routes cleared, Pokémon caught, Pokémon lost — and the seed that reproduces
 * it, both as the raw seed and as the share string someone could hand over
 * (D21). Pure, so the numbers are testable without a scene; `RunOverScene`
 * draws the lines.
 */

/** The window after the last release beat during which a stray confirm is ignored. */
export const RUN_OVER_INPUT_DELAY_MS = 300;

export type RunSummary = Readonly<{
  won: boolean;
  /** Routes fully cleared: everything before the one that ended a lost run. */
  routesCleared: number;
  catches: number;
  casualties: number;
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
    seed: run.seed,
    share: encodeRunShare(run),
  };
}

/** The lines the score screen shows, in order: headline, blurb, then the stats. */
export function runSummaryLines(summary: RunSummary): string[] {
  const headline = summary.won ? 'The final route falls. You win!' : 'You have no more Pokémon!';
  const blurb = summary.won
    ? 'Every route cleared — the chain ends here.'
    : 'The run is over — nothing carries over.';
  return [
    headline,
    blurb,
    `Routes cleared: ${summary.routesCleared}`,
    `Pokémon caught: ${summary.catches}`,
    `Pokémon lost: ${summary.casualties}`,
    `Seed: ${summary.seed}`,
    `Share: ${summary.share}`,
  ];
}
