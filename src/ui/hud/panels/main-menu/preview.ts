import noSavePayload from '../../../../../design/fixtures/01b-main-menu-no-save.json';
import payload from '../../../../../design/fixtures/01-main-menu.json';
import { FIXTURE_MODULES, installFixture, parseHudFlags } from '../../fixtures';
import { mountMainMenu, type MainMenuHandle } from './mount';
import {
  MAIN_MENU_SLUG,
  MAIN_MENU_SLUGS,
  MAIN_MENU_SLUG_NO_SAVE,
  fixtureMainMenuView,
  type MainMenuSlug,
  type MainMenuView,
} from './view';

/** True only when the URL asks for `?hud=dom&hudFixture=<a main-menu slug>`. */
export function mainMenuPreviewRequested(search: string): boolean {
  const flags = parseHudFlags(search);
  if (!flags.dom || flags.fixture === null) return false;
  return (MAIN_MENU_SLUGS as readonly string[]).includes(flags.fixture);
}

function isMainMenuSlug(value: string | null): value is MainMenuSlug {
  return value !== null && (MAIN_MENU_SLUGS as readonly string[]).includes(value);
}

/** Each frame's own copy, keyed by the slug its file is named after. */
const PAYLOADS: Readonly<Record<MainMenuSlug, unknown>> = {
  [MAIN_MENU_SLUG]: payload,
  [MAIN_MENU_SLUG_NO_SAVE]: noSavePayload,
};

let installed = false;

/**
 * Mounts the frame's panel once into the HUD layer and returns its disposer, or
 * null when the URL does not ask for it. Inert — no node, no listener — otherwise.
 */
export function installMainMenuPreview(search: string): (() => void) | null {
  if (typeof document === 'undefined' || typeof window === 'undefined') return null;
  if (installed || !mainMenuPreviewRequested(search)) return null;
  const flags = parseHudFlags(search);
  if (!isMainMenuSlug(flags.fixture)) return null;
  // A payload the store rejects is inert: the scene then paints its own menu.
  const fixture = installFixture(flags, FIXTURE_MODULES);
  if (fixture === null) return null;

  const view: MainMenuView | null = fixtureMainMenuView(PAYLOADS[flags.fixture]);
  if (view === null) return null;

  installed = true;
  let handle: MainMenuHandle | null = null;
  let cancelled = false;

  const attach = (): void => {
    if (cancelled) return;
    const host = document.getElementById('hud');
    if (host === null) return;
    handle = mountMainMenu(host, view);
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
