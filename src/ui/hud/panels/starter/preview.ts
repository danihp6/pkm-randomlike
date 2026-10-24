import payload from '../../../../../design/fixtures/04-starter-pick.json';
import { FIXTURE_MODULES, installFixture, parseHudFlags } from '../../fixtures';
import { mountStarter, type StarterHandle } from './mount';
import { STARTER_SLUG, STARTER_SLUGS, fixtureStarterView, type StarterView } from './view';

/** True only when the URL asks for `?hud=dom&hudFixture=<a starter-pick slug>`. */
export function starterPreviewRequested(search: string): boolean {
  const flags = parseHudFlags(search);
  if (!flags.dom || flags.fixture === null) return false;
  return (STARTER_SLUGS as readonly string[]).includes(flags.fixture);
}

let installed = false;

/**
 * Mounts the frame's panel once into the HUD layer and returns its disposer, or
 * null when the URL does not ask for it. Inert — no node, no listener — otherwise.
 * The phone slug reads the same payload: `m04` prints the desk frame's copy and
 * only the stylesheet's breakpoint changes which board is drawn.
 */
export function installStarterPreview(search: string): (() => void) | null {
  if (typeof document === 'undefined' || typeof window === 'undefined') return null;
  if (installed || !starterPreviewRequested(search)) return null;
  const flags = parseHudFlags(search);
  const fixture = installFixture({ dom: flags.dom, fixture: STARTER_SLUG }, FIXTURE_MODULES);
  if (fixture === null) return null;

  const view: StarterView | null = fixtureStarterView(payload);
  if (view === null) return null;

  installed = true;
  let handle: StarterHandle | null = null;
  let cancelled = false;

  const attach = (): void => {
    if (cancelled) return;
    const host = document.getElementById('hud');
    if (host === null) return;
    handle = mountStarter(host, view);
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
