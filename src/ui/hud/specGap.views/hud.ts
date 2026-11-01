import { DEFAULT_KEYBINDS } from '../../../data/keybinds';
import { stripView, type StripChipId, type StripSlot } from '../panels/hud/view';
import type { PanelView, ScreenSpec } from '../specGap';

/** The screen this adapter answers for: the route HUD frame, its four cards and their strip. */
export const slug = '03-route-hud';

const DESKTOP = { width: 1280, height: 800 };

/**
 * The frame's own card corners — `map panel` (928, 24), `pc panel` (24, 348), `bag panel`
 * (24, 24), `party panel` (928, 308) — with **every card open** and no saved offset, which is
 * the state the frame draws.
 */
const SLOTS: readonly StripSlot[] = [
  { id: 'header', x: 928, y: 24, dx: 0, dy: 0, collapsed: false },
  { id: 'box', x: 24, y: 348, dx: 0, dy: 0, collapsed: false },
  { id: 'bag', x: 24, y: 24, dx: 0, dy: 0, collapsed: false },
  { id: 'party', x: 928, y: 308, dx: 0, dy: 0, collapsed: false },
];

/**
 * The frame names a card's own chip `key <panel>` (`03c-panels-compress` draws all five), and
 * a collapsed card's badge is that same control where the card is not drawn, so a chip's box
 * carries the frame's own name for its panel's chip.
 */
const CHIP_BOX_NAMES: Readonly<Record<StripChipId, string>> = {
  header: 'key map',
  box: 'key pc',
  party: 'key party',
  bag: 'key bag',
};

/**
 * The route strip's own comparison, measured at 1280 × 800 (`D57`). The strip
 * (`panels/hud/view.ts`) draws **one 26 × 26 badge per collapsed panel** and nothing else
 * (`panels/hud/README.md` rules 1–2); this frame draws all four cards **open**, each card
 * painting its own chip, so the strip draws nothing and `gapFor` has nothing to say. The
 * fixture records the same projection: `strip.wide.chips` is `[]` at 1280 × 800
 * (`design/fixtures/03-route-hud.json`).
 *
 * The frame's 201 boxes, 63 strings and 36 colours are **five cards'**, never the strip's:
 *
 * - `map panel` — 16: its panel, group and highlight, `view map`/`view route`, `room 0…10`.
 * - `bag panel` — 45: its panel, group and highlight, the search field and icon, the view
 *   toggle with its two lines and thumbs, the grid's viewport and scroll track/thumb,
 *   `bag tile 1…16` and their sixteen `bag icon …` items.
 * - `party panel` — 35: its panel, group and highlight, `party sel`/`sel bar`, the view toggle,
 *   four `portrait CH…GA` with their `hp track`/`hp fill`, the `party xp track`/`fill`, two
 *   `status …`, the `held item`/`held icon` cells, `vial 0…2`, the nickname field and caret,
 *   two `type square …`.
 * - `pc panel` — 77: its panel, group and highlight, the search field and icon, the view
 *   toggle with its lines and thumbs, the grid's viewport and scroll track/thumb,
 *   `pc slot 1…30` with their thirty `pc mon …`, `pc rip button`/`icon`, `empty slot 4`/`5`.
 * - `detail panel` — 12: `stats panel`, its panel, highlight and portrait, six `stat rule …`,
 *   `tab stats` and `tab moves`.
 *
 * The other 16 are the shell's: `route screenshot`, six `Vector` shapes, the four `toggle …`
 * lines and thumbs, and the five `key …` chips. Each card is measured by its own row
 * (`03o`, `03b`, `03c`, `03p`, `03m`) — **not** here.
 *
 * Those chips are the **cards' own control** (`PanelFrame`, `D49`): the badge that collapses
 * and drags its card, never content, so it is outside this comparison and measured by the
 * `03c` row. The frame's `key map` (942.59, 36, 29.18, 24), `key bag` (36, 36, 24, 24),
 * `key party` (940, 320, 26, 26) and `key pc` (36, 360, 24, 24) are the four cards' chips;
 * the fifth, `key stats` (460, 100, 24, 24), is the detail card's tab chip and belongs to the
 * same row.
 *
 * The strip's badges *do* have a frame, at 390 × 844 — `m03-route-hud`'s `m chip MAP` (8, 55),
 * `m chip BOX` (8, 119) and `m chip BAG` (38, 551), which the fixture repeats in
 * `strip.narrow.chips` — but `design/screens/` carries the 33 desktop frames only, so that
 * projection is measured by `panels/hud/fixture.test.ts` and is not this comparison's business.
 *
 * Deterministic and total: no `Rng`, no clock, no store, no scene — `stripView` is pure and
 * `DEFAULT_KEYBINDS` is a constant table.
 */
export function buildView(_spec: ScreenSpec): PanelView {
  const strip = stripView({ open: true, slots: SLOTS, keybinds: DEFAULT_KEYBINDS }, DESKTOP);
  return {
    boxes: strip.chips.map((chip) => ({
      name: CHIP_BOX_NAMES[chip.id],
      x: chip.box.x,
      y: chip.box.y,
      w: chip.box.w,
      h: chip.box.h,
    })),
    strings: [],
    colours: [],
  };
}
