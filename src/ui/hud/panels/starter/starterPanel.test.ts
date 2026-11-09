import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const PANEL = readFileSync(fileURLToPath(new URL('./starterPanel.tsx', import.meta.url)), 'utf8');
const CSS = readFileSync(fileURLToPath(new URL('./starter.css', import.meta.url)), 'utf8');

// The card's 24 x 24 type cell is the board's own Añil glyph, so the panel must
// draw the kit's `MoveTypeBadge` and never the word chip: a type word does not
// fit a 24 px cell and clips. Both are pinned on the source because the panel is
// a DOM tree the headless suite never mounts.
describe('the starter card type cell', () => {
  it('draws the kit type glyph inside the measured 24 x 24 cell', () => {
    expect(PANEL).toContain('MoveTypeBadge');
    expect(PANEL).toContain('data-hud-starter-badge={type}');
  });

  it('never falls back to the word chip in the panel itself', () => {
    expect(/\bTypeBadge\b/.test(PANEL)).toBe(false);
  });

  it('boxes the glyph in the cell the frame measures', () => {
    expect(CSS).toContain('.starter__badge > .kit-move-type');
    expect(CSS).not.toContain('.kit-type');
  });
});
