import bagFixture from '../../../../design/fixtures/03b-panels-row-view.json';
import { bagPanelView, type BagPanelUi, type BagPanelView, type Rect } from '../panels/bag';
import type { HudState } from '../state';
import { GAP_TOLERANCE, type GapBox, type PanelView, type ScreenSpec } from '../specGap';

/** The screen this adapter answers for: one slug, one spec, one panel. */
export const slug = '03b-panels-row-view';

const DESKTOP = { width: 1280, height: 800 };

/** An atlas URL is a runtime concern, and no box and no string depends on the icon. */
const NO_ICON = () => null;

/** The frame's own name for the card, the one the geometry table below records. */
const CARD = 'bag panel';

type FixtureFile = Readonly<{ state: HudState; ui: BagPanelUi }>;

const FIXTURE = bagFixture as unknown as FixtureFile;

/**
 * The route bag's view, built exactly as the running panel builds it — the fixture's own
 * `state` and `ui` (pocket `consumable`, cursor 0, no query) at 1280×800 — and narrowed to
 * the three facts `gapFor` compares against the frame `03b Panels · row view`.
 *
 * **The frame draws three cards and only the bag's is this row's**: the party's
 * (`928, 536, 304, 124`) and the PC's (`24, 208, 304, 112`) belong to their own rows
 * (`03c`, `03p`). The bag's card is a 304 × 130 **row** and the shipped one a 344 × 308
 * **grid**, so no box is claimed.
 *
 * | frame box | frame rect | shipped | why not claimed |
 * | --- | --- | --- | --- |
 * | `bag panel` | `24, 24, 304, 130` | `bagPanelBox(DESKTOP)` = `928, 422, 344, 308` | dx +904, dy +398, dw +40, dh +178: the card is the 344 × 308 grid, not the board's 304 × 130 row |
 * | `bag panel highlight` | `36, 36, 280, 1` | `view.highlight` = the card's `12, 12, 320, 1` | follows the card |
 * | `key bag` | `36, 36, 24, 24` | `view.chip.box` = the card's corner, `24 × 24` | the chip is flush with the card; the board insets it 12 px, so it inherits both deltas |
 * | `bag search field`, `bag search icon` | `140, 36, 142, 24` / `148, 43, 10, 10` | `view.search.box` = `20, 50, 304, 24` | follows the card; the icon is a glyph inside the field |
 * | `bag view toggle`, `bag toggle grid`, `bag scroll track`, `bag scroll thumb` | — | — | the shipped card has **five pocket tabs** and no row/grid toggle and no scroll bar |
 * | `bag row viewport`, `bag tile 1…8`, `bag icon …` | `36, 72, 280, 60`, 64 × 60 at a 72 px pitch | `view.grid` = `{ columns: 5, gap: 6, cell: 56 }` in a band `20, 82, 304, 180` | the board draws the **row** view and the card draws the **grid**; the fixture's six consumable stacks fill one 5-cell row and one cell of the next |
 * | `party group`, `party panel`, `portrait CH…GA`, `party xp track/fill`, `key party` | `928, 536, 304, 124` … | — | the party card's own row (`03c`) |
 * | `pc group`, `pc panel`, `pc slot 1…30`, `pc mon …`, `pc rip button` | `24, 208, 304, 112` … | — | the PC card's own row (`03p`) |
 * | `route screenshot`, `Vector` ×2 | — | — | the frame's painted scene and the search glyph's two shapes |
 *
 * And the copy it does not claim: `money` `$ 2,480` against the footer's `MONEY` + `2480`;
 * `bag search placeholder` `SEARCH ITEM` against `search items...`; `bag qty 1…8` `×n`
 * against `view.tiles[i].count` `xn`; and the six stack names, the description card's body
 * and the pocket strip's five labels, none of which the board's bag row prints.
 *
 * No colour is claimed: the card's fills and borders are `bag.css`'s tokens and the atlases,
 * and the view model carries no colour literal.
 */
export function buildView(spec: ScreenSpec): PanelView {
  const view = bagPanelView(FIXTURE.state, FIXTURE.ui, DESKTOP, NO_ICON);
  return { boxes: boxClaims(view, spec), strings: stringClaims(view, spec), colours: [] };
}

/**
 * Every box the card draws, at its viewport rect, claimed only when the frame draws that
 * name at the shipped rect: the whole card is 178 px taller and 40 px wider than the board's
 * row, so this frame claims nothing, and a card moved onto the board becomes a claim.
 */
function boxClaims(view: BagPanelView, spec: ScreenSpec): readonly GapBox[] {
  const candidates: readonly Readonly<{ name: string; rect: Rect }>[] = [
    { name: CARD, rect: view.box },
    { name: 'bag panel highlight', rect: at(view.box, view.highlight) },
    { name: 'key bag', rect: at(view.box, view.chip.box) },
    { name: 'bag search field', rect: at(view.box, view.search.box) },
    ...view.tiles.map((tile, index) => ({
      name: `bag tile ${index + 1}`,
      rect: at(view.box, tile.box),
    })),
  ];
  return candidates.flatMap((candidate) => claim(spec, candidate.name, candidate.rect));
}

/** Where a panel-relative rect lands once the card is mounted at its own viewport box. */
function at(origin: Rect, rect: Rect): Rect {
  return { x: origin.x + rect.x, y: origin.y + rect.y, w: rect.w, h: rect.h };
}

function claim(spec: ScreenSpec, name: string, shipped: Rect): readonly GapBox[] {
  const frame = spec.boxes.find((box) => box.name === name);
  if (frame === undefined) return [];
  const near =
    Math.abs(shipped.x - frame.x) <= GAP_TOLERANCE &&
    Math.abs(shipped.y - frame.y) <= GAP_TOLERANCE &&
    Math.abs(shipped.w - frame.width) <= GAP_TOLERANCE &&
    Math.abs(shipped.h - frame.height) <= GAP_TOLERANCE;
  return near ? [{ name, ...shipped }] : [];
}

/**
 * The copy the card prints, claimed only where it is the board's line: `gapFor` folds case
 * and nothing else, so `x3` is not `×3` and the footer's two pieces are not `$ 2,480`. A
 * copy fix lands as a claim here instead of passing silently.
 */
function stringClaims(view: BagPanelView, spec: ScreenSpec): readonly string[] {
  const fold = (line: string): string => line.trim().toUpperCase();
  const printed: readonly string[] = [
    ...view.tabs.map((tab) => tab.label),
    view.search.value,
    view.search.placeholder,
    ...view.tiles.flatMap((tile) => [tile.name, tile.count]),
    view.footer.label,
    view.footer.value,
    view.info?.title ?? '',
    view.info?.text ?? '',
  ];
  const board = new Set(spec.text.map((node) => fold(node.characters)));
  return printed.filter((line) => line !== '' && board.has(fold(line)));
}
