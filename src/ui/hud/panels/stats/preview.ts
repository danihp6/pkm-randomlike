import totalsPayload from '../../../../../design/fixtures/08-stats-totals.json';
import runsPayload from '../../../../../design/fixtures/08b-stats-runs.json';
import pokemonPayload from '../../../../../design/fixtures/08c-stats-pokemon.json';
import rankingPayload from '../../../../../design/fixtures/09-ranking.json';
import rankingPokemonPayload from '../../../../../design/fixtures/09b-ranking-pokemon.json';
import { FIXTURE_MODULES, installFixture, parseHudFlags } from '../../fixtures';
import { mountStats, type StatsHandle } from './mount';
import { STATS_SLUGS, fixtureStatsView, type StatsSlug, type StatsView } from './view';

/** Each frame's own copy, keyed by the slug its file is named after. */
const PAYLOADS: Readonly<Record<StatsSlug, unknown>> = {
  '08-stats-totals': totalsPayload,
  '08b-stats-runs': runsPayload,
  '08c-stats-pokemon': pokemonPayload,
  '09-ranking': rankingPayload,
  '09b-ranking-pokemon': rankingPokemonPayload,
};

/** True only when the URL asks for `?hud=dom&hudFixture=<a stats slug>`. */
export function statsPreviewRequested(search: string): boolean {
  const flags = parseHudFlags(search);
  if (!flags.dom || flags.fixture === null) return false;
  return (STATS_SLUGS as readonly string[]).includes(flags.fixture);
}

function isStatsSlug(value: string | null): value is StatsSlug {
  return value !== null && (STATS_SLUGS as readonly string[]).includes(value);
}

let installed = false;

/**
 * Mounts the frame's panel once into the HUD layer and returns its disposer, or
 * null when the URL does not ask for it. Inert — no node, no listener — otherwise.
 */
export function installStatsPreview(search: string): (() => void) | null {
  if (typeof document === 'undefined' || typeof window === 'undefined') return null;
  if (installed || !statsPreviewRequested(search)) return null;
  const flags = parseHudFlags(search);
  if (!isStatsSlug(flags.fixture)) return null;
  // A payload the store rejects is inert: the scene then paints its own screen.
  const fixture = installFixture(flags, FIXTURE_MODULES);
  if (fixture === null) return null;

  const view: StatsView | null = fixtureStatsView(PAYLOADS[flags.fixture]);
  if (view === null) return null;

  installed = true;
  let handle: StatsHandle | null = null;
  let cancelled = false;

  const attach = (): void => {
    if (cancelled) return;
    const host = document.getElementById('hud');
    if (host === null) return;
    handle = mountStats(host, view);
  };
  const start = (): void => {
    queueMicrotask(attach);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  return () => {
    cancelled = true;
    document.removeEventListener('DOMContentLoaded', start);
    if (handle !== null) handle.dispose();
    handle = null;
    installed = false;
  };
}
