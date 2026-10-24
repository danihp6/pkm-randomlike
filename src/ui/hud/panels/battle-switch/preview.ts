import payload from '../../../../../design/fixtures/05d-battle-pokemon.json';
import { FIXTURE_MODULES, installFixture, parseHudFlags } from '../../fixtures';
import { mountBattleSwitch, type BattleSwitchController } from './mount';
import { fixtureSwitchInput, type Viewport } from './view';

/** The frame this preview pins: `?hud=dom&hudFixture=05d-battle-pokemon`. */
const PREVIEW_SLUG = '05d-battle-pokemon';

/** True only when the URL asks for `?hud=dom&hudFixture=05d-battle-pokemon`. */
export function previewRequested(search: string): boolean {
  const flags = parseHudFlags(search);
  return flags.dom && flags.fixture === PREVIEW_SLUG;
}

let installed = false;

/**
 * Mounts the fixture's card once into the HUD layer and returns its disposer, or
 * null when the URL does not ask for it. Inert — no node, no listener — otherwise:
 * headless (no `document`/`window`) it returns null before touching either.
 */
export function installBattleSwitchPreview(search: string): (() => void) | null {
  if (typeof document === 'undefined' || typeof window === 'undefined') return null;
  if (installed || !previewRequested(search)) return null;
  const fixture = installFixture(parseHudFlags(search), FIXTURE_MODULES);
  if (fixture === null) return null;

  const viewport = (): Viewport => ({ width: window.innerWidth, height: window.innerHeight });
  if (fixtureSwitchInput(payload, viewport()) === null) return null;

  installed = true;
  let controller: BattleSwitchController | null = null;
  let cancelled = false;

  // The card follows the device: the fixture's card is the viewport's own box, so a
  // resize re-derives it instead of leaving a desktop card on a phone.
  const push = (): void => {
    const next = fixtureSwitchInput(payload, viewport());
    if (next !== null) controller?.update(next);
  };

  const attach = (): void => {
    if (cancelled) return;
    const host = document.getElementById('hud');
    if (host === null) return;
    controller = mountBattleSwitch(host);
    push();
  };
  const start = (): void => {
    queueMicrotask(attach);
  };
  const dispose = (): void => {
    cancelled = true;
    document.removeEventListener('DOMContentLoaded', start);
    window.removeEventListener('resize', push);
    if (controller !== null) controller.dispose();
    controller = null;
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
