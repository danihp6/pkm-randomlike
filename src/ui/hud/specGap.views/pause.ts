import pauseFixture from '../../../../design/fixtures/03n-panels-pause-menu.json';
import { fixturePausePanelView, type PausePanelView, type Rect } from '../panels/pause/view';
import { GAP_TOLERANCE, type GapBox, type PanelView, type ScreenSpec } from '../specGap';

/** The screen this adapter answers for: one slug, one spec, one panel. */
export const slug = '03n-panels-pause-menu';

/** The frame's own viewport, where the board's rects are measured. */
const DESKTOP = { width: 1280, height: 800 };

/**
 * The pause card's view, built exactly as the running panel builds it — the fixture module's
 * own `menu` block (title `MENU`, cursor 0, Reset unarmed, rows `Settings` / `Reset run`) at
 * 1280×800 — and narrowed to the three facts `gapFor` compares against the frame
 * `03n Panels · pause menu`. `spec` is read only as a structural selector — does the frame
 * draw this box name, is this line the board's text — never as the answer.
 *
 * The game ships the board's 360 px card with **two** rows and the board draws **four**, so
 * the card's height is the frame's own formula `88 + 56 × rows` at two rows — 200 against
 * the frame's 312 — and every card-relative rect follows the card by exactly 56 px:
 *
 * | frame box | frame rect | shipped (1280×800) | why it is (or is not) claimed |
 * | --- | --- | --- | --- |
 * | `pause scrim` | `0, 0, 1280, 800` | `view.scrim` = the same | **claimed**, delta 0, with no `at()` lift: the scrim is in viewport space and it is the one rect both sides share |
 * | `pause panel` | `460, 244, 360, 312` | `view.box` = `460, 300, 360, 200` | dy +56, dh −112: the card carries the game's two rows, not the board's four |
 * | `pause panel highlight` | `472, 256, 336, 1` | `at(view.box, view.highlight)` = `472, 312, 336, 1` | dy +56: it rides the card |
 * | `pause divider` | `484, 304, 312, 1` | `at(view.box, view.divider)` = `484, 360, 312, 1` | dy +56 |
 * | `pause row 0` | `484, 320, 312, 48` | `at(view.box, view.rows[0].box)` = `484, 376, 312, 48` | dy +56 |
 * | `pause row 1` | `484, 376, 312, 48` | `at(view.box, view.rows[1].box)` = `484, 432, 312, 48` | dy +56 |
 *
 * The two rows are named by `PauseRowView.index` — the row's place in the card's own order —
 * and never by the frame rect they land on. The 56 px pitch drops `rows[1]` onto the frame's
 * `pause row 2` to the pixel, and a candidate named after that rect would be claimed at delta 0
 * while asserting that the card's `Reset run` is the board's `OPTIONS`.
 *
 * **Declared in prose and not claimed:** `pause title` (`484, 264, 200, 30`) is a text node
 * whose rect equals `view.title.box` + `view.box` to the pixel — declaring it as a box would
 * report `missing` — so it is claimed as the string `MENU` instead. `pause label 0…3`
 * (`CONTINUE` / `OPTIONS` / `NEW RUN` / `EXIT`) are the board's four rows: three of them do
 * not ship, and the two the card draws are different words. `route screenshot`
 * (`0, 0, 1280, 800`) is the frame's painted scene, which is the route canvas behind the card;
 * the dimming layer is the view's own `scrim`, already claimed under its own name.
 *
 * The copy is a **filter** over the three lines the card prints in draw order —
 * `view.title.text` (`MENU`), `Settings`, `Reset run` — against the spec's text set, folded
 * trim + upper-case on both sides. Only `MENU` survives; `SETTINGS` and `RESET RUN` are not
 * the board's `OPTIONS` / `NEW RUN` and are dropped. `colours: []`: the card's fills, strokes
 * and the selected row's accent wash are `pause.css`'s tokens, not view literals.
 *
 * Deterministic and total: no `Rng`, no clock, no DOM, no store, no Phaser — the fixture is a
 * module constant and `fixturePausePanelView` is pure — so the same spec always yields the
 * same view.
 */
export function buildView(spec: ScreenSpec): PanelView {
  const view = fixturePausePanelView(pauseFixture, DESKTOP);
  if (view === null) {
    throw new Error(`the 03n fixture is not a pause card: ${slug}`);
  }
  return { boxes: boxClaims(view, spec), strings: stringClaims(view, spec), colours: [] };
}

/**
 * Every box the card draws, claimed only when the frame draws that name at the shipped rect.
 * The scrim is the only one of the six that does; a card moved onto the board — or a board
 * that gained the game's two rows — lands as a claim instead of staying silent.
 */
function boxClaims(view: PausePanelView, spec: ScreenSpec): readonly GapBox[] {
  const candidates: readonly Readonly<{ name: string; rect: Rect }>[] = [
    { name: 'pause scrim', rect: view.scrim },
    { name: 'pause panel', rect: view.box },
    { name: 'pause panel highlight', rect: at(view.box, view.highlight) },
    { name: 'pause divider', rect: at(view.box, view.divider) },
    ...view.rows.map((row) => ({ name: `pause row ${row.index}`, rect: at(view.box, row.box) })),
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
 * The copy the card prints, claimed only where `gapFor`'s own fold makes it the board's line,
 * so a copy fix lands as a claim instead of passing silently. A filter, never a literal list:
 * the card's `Settings` / `Reset run` leave the board's set and only `MENU` stays.
 */
function stringClaims(view: PausePanelView, spec: ScreenSpec): readonly string[] {
  const fold = (line: string): string => line.trim().toUpperCase();
  const printed: readonly string[] = [view.title.text, ...view.rows.map((row) => row.label)];
  const board = new Set(spec.text.map((node) => fold(node.characters)));
  return printed.filter((line) => line !== '' && board.has(fold(line)));
}
