import { h, render } from 'preact';
import { HudShell } from './shell';
import './styles/root.css';

/**
 * The DOM HUD is the HUD (`D49`): every boot asks for it, and the old
 * `?hud=dom` switch is a no-op alias kept so already-written links still boot.
 */
export function hudRequested(_search: string): boolean {
  return true;
}

export type HudHandle = Readonly<{ root: HTMLElement; dispose: () => void }>;

let mounted: HudHandle | null = null;

/** A webfont is fetched only when text first uses it, and the HUD stays empty until a panel mounts; asking up front keeps the first panel from flashing a fallback. */
function preloadFaces(): void {
  void document.fonts.load('400 12px Silkscreen').catch(() => undefined);
  void document.fonts.load('700 12px Silkscreen').catch(() => undefined);
}

/** Mounts the shell into a new `#hud` root, once per page. */
export function mountHud(_search: string): HudHandle | null {
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
