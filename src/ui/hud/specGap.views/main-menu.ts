import mainMenuFixture from '../../../../design/fixtures/01-main-menu.json';
import {
  MAIN_MENU_BOARD,
  MAIN_MENU_NARROW_QUERY,
  fixtureMainMenuView,
  type MainMenuRowId,
} from '../panels/main-menu';
import { forLayout } from '../panels/main-menu/view';
import type { GapBox, PanelView, ScreenSpec } from '../specGap';

/** The screen this adapter answers for: one slug, one spec, one panel. */
export const slug = '01-main-menu';

/** The frame's own viewport, where the board's rects are measured. */
const DESKTOP = { width: 1280, height: 800 };

/** The breakpoint `main-menu.css` switches boards at, read from the query it shares. */
const NARROW_WIDTH = Number(/\d+/.exec(MAIN_MENU_NARROW_QUERY)?.[0] ?? 0);

/** The frame's names for four of the card's five rows, in board order, and the row each draws. */
const ROW_BOXES: readonly (readonly [string, MainMenuRowId])[] = [
  ['row sel CONTINUE', 'continue'],
  ['row NEW RUN', 'new'],
  ['row OPTIONS', 'options'],
  ['row STATS', 'stats'],
];

/**
 * The title screen's view, built exactly as the running panel builds it, narrowed to the
 * facts the frame actually draws: the eight of this adapter's nine candidate boxes that frame
 * `01` draws as boxes, the copy over them, no colour (the panel paints its fills and borders
 * from `styles/root.css` tokens, so its view model carries no literal). `spec` is read only as
 * that structural selector — is this box in the frame at all — never as the answer.
 *
 * **What this view does not claim, and why** — the record the frame exists for:
 *
 * - `version` — the frame draws the bottom-right line as a **text node** (`1:1601`,
 *   `1065, 750, 122, 15`), not as a box: frame `01` names no `version` box, and neither does
 *   `01b`. `gapFor` compares `view.boxes` against `spec.boxes` alone, so claiming
 *   `MAIN_MENU_BOARD.version` as a box reports `missing: ['version']` and no behaviour could
 *   close it; the candidate stays in the table below and the frame's box set drops it. The
 *   line is still claimed as the string `v0.7.0 · PHASE 7`, and its rect is already the text
 *   node's, so the panel's line is measured there.
 *
 * - `menu card` — the frame draws `724, 236, 460, 362`; the panel draws
 *   `460 × MAIN_MENU_CARD_H[5] = 372` because the shipped card has **five** rows
 *   (`docs/hud-fidelity.md` §5, "The menu card's five rows"; the board has no node for the
 *   fifth). Delta `dh = +10`. Claiming it would report a `moved` gap that only a behaviour
 *   change could close.
 * - `card highlight` — the kit `Panel`'s 1 px inset highlight, painted by CSS at
 *   `(x+12, y+12, w-24, 1)`; the view carries no such node.
 * - `slot 0` … `slot 3` — the four party cells. The view carries one block
 *   (`view.portraitsBox`), right-aligned at `1042 … 1158`; the frame draws the four separate
 *   cells at `922 … 1038`. The panel keeps the board's cell size and pitch, and the block's
 *   position is `docs/hud-fidelity.md` §9's decision, so the cells are not claimable.
 * - `window base` — the route preview's clipped tile layer, a stylesheet node.
 * - `row bar CONTINUE` and the cursor `>` of `row sel CONTINUE` — `.main-menu__bar` and
 *   `.main-menu__cursor`, painted by the panel from its `selected` row, not carried by the
 *   view.
 * - the fifth row (`RANKING`) — neither a box nor the string `RANKING` exists in frame
 *   `01`; it belongs to `01b`'s family and the board's card predates the row, so naming only
 *   the four rows above projects it away and it is never emitted.
 *
 * The CONTINUE row's value stays claimed: `MAP 3 · FOREST` draws 114 px inside its 124 px
 * box, so `elideValue`, with the four portraits reserved, does not cut it and the frame's
 * `row value CONTINUE` is the same string.
 */
export function buildView(spec: ScreenSpec): PanelView {
  const built = fixtureMainMenuView(mainMenuFixture);
  if (built === null) throw new Error(`${slug}: the fixture is not a main-menu payload`);
  const view = forLayout(built, DESKTOP.width > NARROW_WIDTH ? 'wide' : 'compact');
  const frame = new Set(
    spec.boxes.flatMap((box) => (box.name === null || box.name === '' ? [] : [box.name])),
  );

  const rows = ROW_BOXES.flatMap(([name, id]) => {
    const at = view.rows.findIndex((row) => row.id === id);
    const row = view.rows[at];
    if (row === undefined) return [];
    const box: GapBox = {
      name,
      x: MAIN_MENU_BOARD.row.x,
      y: MAIN_MENU_BOARD.row.top + at * MAIN_MENU_BOARD.row.pitch,
      w: MAIN_MENU_BOARD.row.w,
      h: MAIN_MENU_BOARD.row.h,
    };
    return [{ box, row }];
  });

  const boxes: readonly GapBox[] = [
    { name: 'glow', ...view.glow.box },
    { name: 'accent rule', ...MAIN_MENU_BOARD.rule },
    { name: 'route window', ...MAIN_MENU_BOARD.window },
    { name: 'stats rule', ...MAIN_MENU_BOARD.footerRule },
    { name: 'version', ...MAIN_MENU_BOARD.version },
    ...rows.map((entry) => entry.box),
  ].filter((box) => frame.has(box.name));

  const strings = [
    view.title,
    ...(view.version === null ? [] : [view.version]),
    ...rows.map((entry) => entry.row.label),
    ...rows.map((entry) => entry.row.value),
    ...view.stats.map((stat) => stat.label),
    ...view.stats.map((stat) => stat.value),
    ...view.stats.flatMap((stat) => (stat.name === null ? [] : [stat.name])),
  ].filter((line) => line !== '');

  return { boxes, strings, colours: [] };
}
