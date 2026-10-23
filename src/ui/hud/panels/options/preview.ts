import { signal } from '@preact/signals';
import payload from '../../../../../design/fixtures/02-options.json';
import {
  FIXTURE_MODULES,
  installFixture,
  parseHudFlags,
} from '../../fixtures';
import { mountOptionsPanel } from './mount';
import {
  OPTIONS_NARROW_QUERY,
  OPTIONS_SLUG,
  fixtureOptionsView,
  type OptionsView,
} from './view';

/** True only when the URL asks for `?hud=dom&hudFixture=02-options`. */
export function previewRequested(search: string): boolean {
  const flags = parseHudFlags(search);
  return flags.dom && flags.fixture === OPTIONS_SLUG;
}

let installed = false;

/**
 * Mounts the fixture's panel once into the HUD layer and returns its disposer, or
 * null when the URL does not ask for it. Inert — no node, no listener — otherwise.
 */
export function installOptionsPreview(search: string): (() => void) | null {
  if (typeof document === 'undefined' || typeof window === 'undefined') return null;
  if (installed || !previewRequested(search)) return null;
  const fixture = installFixture(parseHudFlags(search), FIXTURE_MODULES);
  if (fixture === null) return null;

  const query = window.matchMedia(OPTIONS_NARROW_QUERY);
  const initial: OptionsView | null = fixtureOptionsView(payload, query.matches);
  if (initial === null) return null;

  installed = true;
  const view = signal<OptionsView>(initial);
  let dispose: (() => void) | null = null;
  let cancelled = false;

  const variant = (): void => {
    const next = fixtureOptionsView(payload, query.matches);
    if (next !== null) view.value = next;
  };

  const attach = (): void => {
    if (cancelled) return;
    const host = document.getElementById('hud');
    if (host === null) return;
    dispose = mountOptionsPanel(host, view);
  };
  const start = (): void => {
    queueMicrotask(attach);
  };

  query.addEventListener('change', variant);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  return () => {
    cancelled = true;
    document.removeEventListener('DOMContentLoaded', start);
    query.removeEventListener('change', variant);
    if (dispose !== null) dispose();
    dispose = null;
    installed = false;
  };
}
