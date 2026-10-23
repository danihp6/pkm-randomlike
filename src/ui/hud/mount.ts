import { h, render } from 'preact';
import { HudShell } from './shell';
import './styles/root.css';

function normalised(value: string): string {
  return value.trim().toLowerCase();
}

/** Whether the DOM HUD was asked for: `?hud=dom`, anywhere in the query string. */
export function hudRequested(search: string): boolean {
  const query = search.startsWith('?') ? search.slice(1) : search;
  for (const pair of query.split('&')) {
    const separator = pair.indexOf('=');
    if (separator < 0) continue;
    if (normalised(pair.slice(0, separator)) !== 'hud') continue;
    if (normalised(pair.slice(separator + 1)) === 'dom') return true;
  }
  return false;
}

export type HudHandle = Readonly<{ root: HTMLElement; dispose: () => void }>;

let mounted: HudHandle | null = null;

/** A webfont is fetched only when text first uses it, and the HUD stays empty until a panel mounts; asking up front keeps the first panel from flashing a fallback. */
function preloadFaces(): void {
  void document.fonts.load('400 12px Silkscreen').catch(() => undefined);
  void document.fonts.load('700 12px Silkscreen').catch(() => undefined);
}

/** Mounts the shell into a new `#hud` root, or returns null when not requested. */
export function mountHud(search: string): HudHandle | null {
  if (!hudRequested(search)) return null;
  if (mounted !== null) return mounted;

  const root = document.createElement('div');
  root.id = 'hud';
  document.body.appendChild(root);
  render(h(HudShell, null), root);
  preloadFaces();

  const handle: HudHandle = {
    root,
    dispose: () => {
      if (mounted !== handle) return;
      render(null, root);
      root.remove();
      mounted = null;
    },
  };
  mounted = handle;
  return handle;
}
