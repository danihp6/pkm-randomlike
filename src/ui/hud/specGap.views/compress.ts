import { DEFAULT_KEYBINDS } from '../../../data/keybinds';
import { stripView, type StripChip, type StripChipId, type StripSlot } from '../panels/hud';
import { GAP_TOLERANCE, type GapBox, type PanelView, type ScreenSpec } from '../specGap';

/** The screen this adapter answers for: the compressed state the five collapsed cards leave. */
export const slug = '03c-panels-compress';

const DESKTOP = { width: 1280, height: 800 };

/**
 * The four docks of a fresh save at 1280×800, which is `defaultHudDock`'s own arithmetic
 * (`src/scenes/panels/hud.ts`) written down here so the adapter has no host to ask:
 * `header` keeps the free top-left corner at `HUD_PANEL_MARGIN`/`HUD_TOP` (8, 8) and the
 * `party`/`bag`/`box` rail stacks down the right column at `hudColumnLeft` = 1280 − 344 − 8
 * = 928, one 34 px `HUD_CHIP_PITCH` apart from `HUD_TOP` 8.
 */
const SLOTS: readonly StripSlot[] = [
  { id: 'header', x: 8, y: 8, dx: 0, dy: 0, collapsed: true },
  { id: 'box', x: 928, y: 76, dx: 0, dy: 0, collapsed: true },
  { id: 'bag', x: 928, y: 42, dx: 0, dy: 0, collapsed: true },
  { id: 'party', x: 928, y: 8, dx: 0, dy: 0, collapsed: true },
];

/**
 * The frame names a card's own chip `key <panel>`, so a badge carries the board's name for
 * its card. This is deliberately the same four pairs `specGap.views/hud.ts` keeps privately,
 * not a second rule: the strip has one badge per panel and one name per badge.
 */
const CHIP_BOX_NAMES: Readonly<Record<StripChipId, string>> = {
  header: 'key map',
  box: 'key pc',
  party: 'key party',
  bag: 'key bag',
};

/**
 * The compressed state (`03c Panels · compress`, 6 boxes / 5 strings / 5 colours): every
 * card collapsed, no saved offset, painted as the strip `stripView` draws — four 26 × 26
 * badges and nothing else. A collapsed card paints nothing of its own, chip included
 * (`docs/hud-fidelity.md` §5, "A panel's chip and its compressed state"), so the strip's
 * edge chip **is** the compressed form and the party card has no view of its own here.
 *
 * **The board's five chips are not the strip's four, box for box, so no box is claimed.**
 * Each board chip sits 12 px inside a card corner frame `03 Route HUD` draws, and the strip
 * paints 26 px at the panel's own dock instead:
 *
 * | frame box | frame rect | shipped (1280×800) | why not claimed |
 * | --- | --- | --- | --- |
 * | `key bag` | `36, 36, 24, 24` | `bag` chip at `defaultHudDock` = `928, 42, 26, 26` | dx +892, dy +6, dw +2, dh +2: the board's chip is 24 px inset 12 px inside a corner the shipped card does not use |
 * | `key map` | `942.59, 36, 29.18, 24` | `header` chip at `8, 8, 26, 26` | dx −934.59, dy −28, dw −3.18, dh +2 |
 * | `key party` | `940, 320, 26, 26` | `party` chip at `928, 8, 26, 26` (`partyPanelView(...).chip` sits at the card's own corner, `928, 8`) | dy −312: the board docks the party card low and right, the shipped rail stacks it at the top; the 26 px size is the one thing the two agree on |
 * | `key pc` | `36, 360, 24, 24` | `box` chip at `928, 76, 26, 26` | dx +892, dy −284, dw +2, dh +2 |
 * | `key stats` | `460, 100, 24, 24` | — | **no shipped chip**: the strip's four ids are `header`/`box`/`party`/`bag`, and the detail card is the one panel with no badge (`panels/detail/README.md` rule 8) |
 * | `route screenshot` | `0, 0, 1280, 800` | — | the frame's painted scene |
 *
 * The board's two fills (`#0b1017@0.5` + `#7dd3fc@0.55` on bag/map/party, `#ffffff@0.06` +
 * `#ffffff@0.16` on pc/stats) are the stylesheet's business: `StripChip` carries no colour
 * and no "active" state, so no colour is claimed either.
 *
 * Deterministic and total: no `Rng`, no clock, no DOM, no store, no scene — `stripView` is
 * pure and `DEFAULT_KEYBINDS` is a constant table.
 */
export function buildView(spec: ScreenSpec): PanelView {
  const strip = stripView({ open: true, slots: SLOTS, keybinds: DEFAULT_KEYBINDS }, DESKTOP);
  const boardText = new Set(spec.text.map((line) => line.characters.trim().toUpperCase()));
  return {
    boxes: chipClaim(spec, strip.chips),
    strings: strip.chips
      .map((chip) => chip.letter)
      .filter((letter) => boardText.has(letter.toUpperCase())),
    colours: [],
  };
}

/**
 * A badge is the board's chip only when the frame draws that chip name within
 * `GAP_TOLERANCE` of the shipped rect — the way `specGap.views/detail.ts`'s `cardClaim` does —
 * so a badge that ever lands on a board chip becomes a claim instead of a silent pass. At
 * these docks all four are far outside it and the claim is empty.
 */
function chipClaim(spec: ScreenSpec, chips: readonly StripChip[]): readonly GapBox[] {
  const claimed: GapBox[] = [];
  for (const chip of chips) {
    const name = CHIP_BOX_NAMES[chip.id];
    const frame = spec.boxes.find((box) => box.name === name);
    if (frame === undefined) continue;
    const near =
      Math.abs(chip.box.x - frame.x) <= GAP_TOLERANCE &&
      Math.abs(chip.box.y - frame.y) <= GAP_TOLERANCE &&
      Math.abs(chip.box.w - frame.width) <= GAP_TOLERANCE &&
      Math.abs(chip.box.h - frame.height) <= GAP_TOLERANCE;
    if (near) claimed.push({ name, ...chip.box });
  }
  return claimed;
}
