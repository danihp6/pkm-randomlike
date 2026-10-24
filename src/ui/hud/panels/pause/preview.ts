import { signal } from '@preact/signals';
import payload from '../../../../../design/fixtures/03n-panels-pause-menu.json';
import { FIXTURE_MODULES, installFixture, parseHudFlags } from '../../fixtures';
import { mountPausePanel } from './mount';
import { PAUSE_SLUG, fixturePausePanelView, type PausePanelView } from './view';

/** True only when the URL asks for `?hud=dom&hudFixture=03n-panels-pause-menu`. */
export function pausePreviewRequested(search: string): boolean {
  const flags = parseHudFlags(search);
  return flags.dom && flags.fixture === PAUSE_SLUG;
}

let installed = false;

/**
 * Mounts the fixture card into `#hud` once and returns its disposer, or null when
 * the URL does not ask for it (or the layer/fixture is missing). Inert — no node,
 * no listener — otherwise. `#hud` does not exist when this module is first
 * evaluated (it is imported by the scene list before `mountHud` runs), so the
 * attach is deferred past the microtask queue.
 */
export function installPausePreview(search: string): (() => void) | null {
  if (typeof document === 'undefined' || typeof window === 'undefined') return null;
  if (installed || !pausePreviewRequested(search)) return null;
  const fixture = installFixture(parseHudFlags(search), FIXTURE_MODULES);
  if (fixture === null) return null;

  const initial = fixturePausePanelView(payload, {
    width: window.innerWidth,
    height: window.innerHeight,
  });
  if (initial === null) return null;

  installed = true;
  const view = signal<PausePanelView>(initial);
  let dispose: (() => void) | null = null;
  let cancelled = false;

  const attach = (): void => {
    if (cancelled) return;
    const host = document.getElementById('hud');
    if (host === null) return;
    dispose = mountPausePanel(host, view);
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
    if (dispose !== null) dispose();
    dispose = null;
    installed = false;
  };
}
