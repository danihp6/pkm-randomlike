/**
 * The one browser probe the touch controls need: whether this is a touch-first
 * screen. A coarse, hover-less pointer means a phone or tablet, so the on-screen
 * pad shows; a mouse or trackpad keeps the keyboard-only layout. The keyboard
 * works everywhere regardless. Kept apart from the Phaser half so it is the only
 * thing that ever touches `window.matchMedia`.
 */
export function prefersTouchControls(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  const matches = (query: string): boolean => window.matchMedia(query).matches;
  return matches('(pointer: coarse)') || matches('(hover: none)');
}
