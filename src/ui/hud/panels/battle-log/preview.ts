import payload from '../../../../../design/fixtures/05b-battle-message.json';
import { FIXTURE_MODULES, installFixture, parseHudFlags } from '../../fixtures';
import { mountBattleLog, type BattleLogHandle } from './mount';
import { BATTLE_LOG_SLUG, BATTLE_LOG_SLUGS, fixtureBattleLogView, type BattleLogView } from './view';

/** True only when the URL asks for `?hud=dom&hudFixture=<05b frame>`. */
export function battleLogPreviewRequested(search: string): boolean {
  const flags = parseHudFlags(search);
  if (!flags.dom || flags.fixture === null) return false;
  return (BATTLE_LOG_SLUGS as readonly string[]).includes(flags.fixture);
}

let installed = false;

/**
 * Mounts the fixture's message box once into the HUD layer and returns its disposer,
 * or null when the URL does not ask for it. The fixture is the desktop frame's own
 * copy; the phone export asks for the same card, which draws the `m05b` board from
 * `battleLogBoard('narrow')` at its own viewport. Inert — no node, no listener —
 * otherwise: headless (no `document`/`window`) it returns null before touching either.
 */
export function installBattleLogPreview(search: string): (() => void) | null {
  if (typeof document === 'undefined' || typeof window === 'undefined') return null;
  if (installed || !battleLogPreviewRequested(search)) return null;
  const flags = parseHudFlags(search);
  const fixture = installFixture({ dom: flags.dom, fixture: BATTLE_LOG_SLUG }, FIXTURE_MODULES);
  if (fixture === null) return null;
  const view = fixtureBattleLogView(payload);
  if (view === null) return null;

  installed = true;
  let handle: BattleLogHandle | null = null;
  let cancelled = false;

  // The card follows the device: a push after a resize re-derives the board.
  const push = (): void => {
    const next: BattleLogView | null = fixtureBattleLogView(payload);
    if (next !== null) handle?.update(next);
  };

  const attach = (): void => {
    if (cancelled) return;
    const host = document.getElementById('hud');
    if (host === null) return;
    handle = mountBattleLog(host, view);
  };
  const start = (): void => {
    queueMicrotask(attach);
  };
  const dispose = (): void => {
    cancelled = true;
    document.removeEventListener('DOMContentLoaded', start);
    window.removeEventListener('resize', push);
    if (handle !== null) handle.dispose();
    handle = null;
    installed = false;
  };

  window.addEventListener('resize', push);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  return dispose;
}
