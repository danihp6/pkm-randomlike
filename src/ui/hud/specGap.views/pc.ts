import pcFixture from '../../../../design/fixtures/03p-panels-pc-rip.json';
import { pcPanelView, type PcPanelUi, type PcRow, type Rect } from '../panels/pc';
import { GAP_TOLERANCE, type GapBox, type PanelView, type ScreenSpec } from '../specGap';

/** The screen this adapter answers for: one slug, one spec, one panel. */
export const slug = '03p-panels-pc-rip';

const DESKTOP = { width: 1280, height: 800 };

/** `pcPanel.tsx` types the tab's label as the literal `RIP`, not as a `t` key, so it is retyped here. */
const RIP_LABEL = 'RIP';

type FixtureFile = Readonly<{
  ui: PcPanelUi;
  pc: Readonly<{ pageCount: number; rows: readonly PcRow[] }>;
}>;

const FIXTURE = pcFixture as unknown as FixtureFile;

/** One box the shipped card draws, under the name the frame gives it. */
type Candidate = Readonly<{ name: string; box: Rect }>;

/**
 * The PC box's view, built exactly as the route panel builds it — the fixture's own
 * `pc.rows`, `ui` and `pc.pageCount` at 1280×800, its `pane` the frame's `rip` — narrowed to
 * the three facts `gapFor` compares.
 *
 * **The card is a 344 × 378 grid where the board paints a 304 × 243 list, so no box is
 * claimed.** The four candidates are measured against the frame on every call, so a card
 * that ever lands on the board's rect becomes a claim instead of a silent pass.
 *
 * | frame box | frame rect | shipped | why not claimed |
 * | --- | --- | --- | --- |
 * | `pc panel` | `24, 348, 304, 243` | `view.box` = `576, 72, 344, 378` | dx +552, dy −276, dw +40, dh +135: the board draws a 304 × 243 list card bottom-left, the game a 344 × 378 grid card in the middle column |
 * | `pc panel highlight` | `36, 360, 280, 1` | `view.highlight` = the card's `12, 12, 320, 1` | follows the card |
 * | `key pc` | `36, 360, 24, 24` | `view.chip.box` = the card's corner, `24 × 24` | the chip is flush with the card and the board insets it 12 px, so it inherits both deltas; its letter is `O` in the view, `C` on the board and `C` in the strip |
 * | `pc search field`, `pc search icon` | `68, 360, 190, 24` / `76, 367, 10, 10` | — | the shipped card has no search field |
 * | `pc view toggle`, `pc toggle thumb 1/2`, `pc toggle line 1/2` | `292, 360, 24, 24` … | — | the shipped card has no row/grid toggle; its strip is the page tabs |
 * | `pc rip button`, `pc rip icon` | `264, 360, 24, 24` / `268, 364, 16, 16` | `view.rip.box` → `868, 88, 32, 26` | the board draws a 24 × 24 icon button, the card a 32 × 26 labelled tab at the strip's right end |
 * | `rip viewport`, `rip row 0…5`, `rip icon n`, `rip grid scroll track/thumb` | `36, 396, 280, 183`; rows 280 × 38 at a 44 px pitch | `view.grid.band` `590, 122, 316, 316` and 16 cells of 76 × 76 | the board draws a six-row list, the card one 4 × 4 grid for both panes: `PcPanelView.rip` has no per-row box |
 * | `rip name n`, `rip meta n`, `rip tag n` | text nodes | `cell.name`, the level line + `cell.hpText`, the `RIP` tab label | the names and `RIP` are claimed as strings; the meta is `LV 30 · ROUTE 3` on the board against `Lv30` and `0/92` on two lines in the card, and the route is not in the view |
 * | `route screenshot`, `Vector` ×5 | — | — | the frame's painted scene and the search/rip glyph shapes |
 *
 * **Seven strings are claimed**, in the card's draw order: the RIP tab's `RIP` (a literal in
 * the component, which the frame draws six times as its `rip tag n`) and the six named cells
 * `PSYDUCK`, `MACHOP`, `RATICATE`, `GLOOM`, `ZUBAT`, `DODUO`, which are exactly the frame's
 * `rip name 0…5` and the fixture's six rows at levels 30, 27, 22, 19, 16, 21. **Three lines
 * the card prints are not claimed**: `Lv30` (against the board's `LV 30 · ROUTE 3` — one
 * space and a missing route apart, which `gapFor`'s case fold cannot reach, so the
 * `common.level` copy defect registered under Bugs is not papered over here), `0/92` (the
 * card's HP text, which the board does not print) and the page tab's `1` (the frame draws no
 * page number).
 *
 * No colour is claimed: the card's fill, border and RIP paint are `pc.css`'s tokens and the
 * view model carries no colour literal. It reads no `Rng`, no clock, no DOM and no store —
 * `pcPanelView` is pure and the fixture is a module constant — so the same spec always
 * yields the same view.
 */
export function buildView(spec: ScreenSpec): PanelView {
  const view = pcPanelView(FIXTURE.pc.rows, FIXTURE.ui, FIXTURE.pc.pageCount, DESKTOP);
  const strings = [
    RIP_LABEL,
    ...view.cells.filter((cell) => cell.memberId !== null).map((cell) => cell.name),
  ];
  return {
    boxes: boardBoxes(spec, [
      { name: 'pc panel', box: view.box },
      { name: 'pc panel highlight', box: viewportBox(view.box, view.highlight) },
      { name: 'key pc', box: viewportBox(view.box, view.chip.box) },
      { name: 'rip viewport', box: viewportBox(view.box, view.grid.band) },
    ]),
    strings,
    colours: [],
  };
}

/** The panel-relative rect as the viewport draws it, the frame's own origin. */
function viewportBox(origin: Rect, box: Rect): Rect {
  return { x: origin.x + box.x, y: origin.y + box.y, w: box.w, h: box.h };
}

/**
 * The shipped rects that are also the frame's, box by box: within `GAP_TOLERANCE` of the
 * frame's box of that name, never a hard-coded list, so a card moved onto the board
 * reports a claim instead of staying silent.
 */
function boardBoxes(spec: ScreenSpec, candidates: readonly Candidate[]): readonly GapBox[] {
  const claims: GapBox[] = [];
  for (const candidate of candidates) {
    const frame = spec.boxes.find((box) => box.name === candidate.name);
    if (frame === undefined) continue;
    const { x, y, w, h } = candidate.box;
    const near =
      Math.abs(x - frame.x) <= GAP_TOLERANCE &&
      Math.abs(y - frame.y) <= GAP_TOLERANCE &&
      Math.abs(w - frame.width) <= GAP_TOLERANCE &&
      Math.abs(h - frame.height) <= GAP_TOLERANCE;
    if (near) claims.push({ name: candidate.name, x, y, w, h });
  }
  return claims;
}
