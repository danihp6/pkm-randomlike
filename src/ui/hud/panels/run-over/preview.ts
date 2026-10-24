import defeatPayload from '../../../../../design/fixtures/06-run-over-defeat.json';
import pokemonPayload from '../../../../../design/fixtures/07b-run-over-victory-pokemon.json';
import victoryPayload from '../../../../../design/fixtures/07-run-over-victory.json';
import { FIXTURE_MODULES, installFixture, parseHudFlags } from '../../fixtures';
import { mountRunOver, type RunOverHandle } from './mount';
import { RUN_OVER_SLUGS, fixtureRunOverView, type RunOverSlug, type RunOverView } from './view';

/** Each frame's own copy, keyed by the slug its file is named after. */
const PAYLOADS: Readonly<Record<RunOverSlug, unknown>> = {
  '06-run-over-defeat': defeatPayload,
  '07-run-over-victory': victoryPayload,
  '07b-run-over-victory-pokemon': pokemonPayload,
};

/** True only when the URL asks for `?hud=dom&hudFixture=<a run-over slug>`. */
export function runOverPreviewRequested(search: string): boolean {
  const flags = parseHudFlags(search);
  if (!flags.dom || flags.fixture === null) return false;
  return (RUN_OVER_SLUGS as readonly string[]).includes(flags.fixture);
}

function isRunOverSlug(value: string | null): value is RunOverSlug {
  return value !== null && (RUN_OVER_SLUGS as readonly string[]).includes(value);
}

let installed = false;

/**
 * Mounts the frame's panel once into the HUD layer and returns its disposer, or
 * null when the URL does not ask for it. Inert — no node, no listener — otherwise.
 */
export function installRunOverPreview(search: string): (() => void) | null {
  if (typeof document === 'undefined' || typeof window === 'undefined') return null;
  if (installed || !runOverPreviewRequested(search)) return null;
  const flags = parseHudFlags(search);
  if (!isRunOverSlug(flags.fixture)) return null;
  // A payload the store rejects is inert: the scene then paints its own screen.
  const fixture = installFixture(flags, FIXTURE_MODULES);
  if (fixture === null) return null;

  const view: RunOverView | null = fixtureRunOverView(PAYLOADS[flags.fixture]);
  if (view === null) return null;

  installed = true;
  let handle: RunOverHandle | null = null;
  let cancelled = false;

  const attach = (): void => {
    if (cancelled) return;
    const host = document.getElementById('hud');
    if (host === null) return;
    handle = mountRunOver(host, view);
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
