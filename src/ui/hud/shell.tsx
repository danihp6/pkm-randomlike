import type { JSX } from 'preact';

/** The DOM HUD's empty layer: the panels of `design/` mount into it, the canvas stays below. */
export function HudShell(): JSX.Element {
  return <div class="hud" data-hud="root" />;
}
