import fixture from '../../../../design/fixtures/06-run-over-defeat.json';
import {
  fixtureRunOverView,
  runOverBoard,
  type RunOverBoard,
  type RunOverRect,
  type RunOverView,
} from '../panels/run-over/view';
import { GAP_TOLERANCE, type GapBox, type PanelView, type ScreenSpec } from '../specGap';

/** The screen this adapter answers for: one slug, one spec, one panel. */
export const slug = '06-run-over-defeat';

/** The frame's own viewport, where `runOverBoard`'s desktop rects are measured: 1280×800. */
const DESKTOP: 'desktop' = 'desktop';

type FixtureFile = Readonly<{ runOver: unknown }>;

const FIXTURE = fixture as unknown as FixtureFile;

/**
 * The run-over card's defeat frame (`06 Run over · defeat`) against the panel's own view model:
 * the four boxes the shipped board lands on to the pixel, the copy the frame and the card share,
 * and the eight boxes the frame draws that this task does not claim.
 *
 * The card is built exactly as the preview builds it — the fixture module's own `runOver` block
 * (defeat, the TOTALS tab, `YOU HAVE NO MORE POKEMON!`, the blurb, four stat rows, the share
 * line, `MAIN MENU`, the two tab labels and no rows) at 1280×800 — and narrowed to the three
 * facts `gapFor` compares. `spec` is read only as a structural selector — does the frame draw
 * this box name, is this line the board's text — never as the answer.
 *
 * **Claimed, at the board's own rects, all delta 0:**
 *
 * | frame box | frame rect | shipped (`runOverBoard('desktop')`) |
 * | --- | --- | --- |
 * | `run over panel` | `280, 170, 720, 480` | `board.panel` |
 * | `main menu button` | `540, 590, 200, 40` | `board.button` |
 * | `tab totals` | `336, 312, 90, 24` | `board.tabs[0]` |
 * | `tab pokemon` | `432, 312, 100, 24` | `board.tabs[1]` |
 *
 * **Drawn by the frame, declared here and never claimed:**
 *
 * | frame box | frame rect | why it is not a box claim |
 * | --- | --- | --- |
 * | `run over panel highlight` | `292, 182, 692, 1` | `run-over.css` paints it off the panel wrapper (`.run-over__highlight`), not a view field |
 * | `run over accent` | `616, 186, 48, 2` | the same: `.run-over__accent`, the stylesheet's paint |
 * | `run over rule 0` | `336, 386, 608, 1` | the first stat row's rule, `.run-over__rule`, painted per row |
 * | `run over rule 1` | `336, 432, 608, 1` | the second row's rule |
 * | `run over rule 2` | `336, 478, 608, 1` | the third row's rule |
 * | `run over rule 3` | `336, 524, 608, 1` | the fourth row's rule |
 * | `route screenshot` | `0, 0, 1280, 800` | the route canvas behind the card, the scene's (`D49`) |
 * | `scrim` | `0, 0, 1280, 800` | the scene's dimming layer, not the panel's |
 *
 * The title, the blurb, the four stat rows and the share line have **no named box** in the
 * frame — they are text nodes only — so they are claimed as strings and never as boxes.
 *
 * `colours: []`: the panel skin, the accent, the rules, the tab washes and the six text tones
 * are all `run-over.css`'s tokens, which `scripts/design/check.mjs` covers.
 *
 * Deterministic and total: no `Rng`, no clock, no DOM, no store, no i18n — the fixture is a
 * module constant and `fixtureRunOverView` is pure — so the same spec always yields the same
 * view, and a payload that is not a run-over card is an empty claim rather than a throw.
 */
export function buildView(spec: ScreenSpec): PanelView {
  return buildViewFor(FIXTURE, spec);
}

/** The same claim from any payload: a payload with no `runOver` block is an empty claim. */
export function buildViewFor(payload: unknown, spec: ScreenSpec): PanelView {
  const view = fixtureRunOverView(payload);
  if (view === null) return { boxes: [], strings: [], colours: [] };
  return { boxes: boxClaims(spec), strings: stringClaims(view, spec), colours: [] };
}

/** The four rects the board draws, claimed only where the frame draws that name there. */
function boxClaims(spec: ScreenSpec): readonly GapBox[] {
  const board: RunOverBoard = runOverBoard(DESKTOP);
  const candidates: readonly Readonly<{ name: string; rect: RunOverRect }>[] = [
    { name: 'run over panel', rect: board.panel },
    { name: 'main menu button', rect: board.button },
    { name: 'tab totals', rect: board.tabs[0]! },
    { name: 'tab pokemon', rect: board.tabs[1]! },
  ];
  return candidates.flatMap((candidate) => claim(spec, candidate.name, candidate.rect));
}

function claim(spec: ScreenSpec, name: string, shipped: RunOverRect): readonly GapBox[] {
  const frame = spec.boxes.find((box) => box.name === name);
  if (frame === undefined) return [];
  const near =
    Math.abs(shipped.x - frame.x) <= GAP_TOLERANCE &&
    Math.abs(shipped.y - frame.y) <= GAP_TOLERANCE &&
    Math.abs(shipped.w - frame.width) <= GAP_TOLERANCE &&
    Math.abs(shipped.h - frame.height) <= GAP_TOLERANCE;
  return near ? [{ name, x: shipped.x, y: shipped.y, w: shipped.w, h: shipped.h }] : [];
}

/**
 * The copy the card prints, in view order, claimed only where `gapFor`'s own fold makes it the
 * board's line, so a copy fix lands as a claim instead of passing silently. A filter, never a
 * literal list; `''` is dropped.
 */
function stringClaims(view: RunOverView, spec: ScreenSpec): readonly string[] {
  const fold = (line: string): string => line.trim().toUpperCase();
  const printed: readonly string[] = [
    view.title,
    view.blurb,
    ...view.stats.flatMap((stat) => [stat.label, stat.value]),
    view.share,
    view.button.label,
    view.tabLabels.totals,
    view.tabLabels.pokemon,
  ];
  const board = new Set(spec.text.map((node) => fold(node.characters)));
  return printed.filter((line) => line !== '' && board.has(fold(line)));
}
