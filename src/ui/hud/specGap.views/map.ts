import mapFixture from '../../../../design/fixtures/03o-panels-map-routes.json';
import type { MapView } from '../../mapView';
import { mapPanelView, type MapPanelView, type Rect } from '../panels/map';
import { GAP_TOLERANCE, type GapBox, type PanelView, type ScreenSpec } from '../specGap';

/** The screen this adapter answers for: one slug, one spec, one panel. */
export const slug = '03o-panels-map-routes';

const DESKTOP = { width: 1280, height: 800 };

/** The frame's own names for the two rects the shipped card also draws. */
const CARD = 'map routes panel';
const HIGHLIGHT = 'map routes highlight';

type FixtureFile = Readonly<{ map: Readonly<{ title: string; view: unknown }> }>;

const FIXTURE = mapFixture as unknown as FixtureFile;

/**
 * The route header card's view, built exactly as the running panel builds it — the
 * fixture's own `map.title` and `map.view` at 1280×800 — narrowed to the facts `gapFor`
 * compares. **The frame draws a region map the game does not have, so nothing is claimed.**
 *
 * | frame box | frame rect | shipped | why not claimed |
 * | --- | --- | --- | --- |
 * | `map routes panel` | `928, 24, 304, 198` | `view.box` = `8, 8, 216, 250` | dx −920, dy −16, dw −88, dh +52: the board draws a 304 × 198 region card top-right, the game a 216 × 250 floor minimap top-left |
 * | `map routes highlight` | `942.59, 36, 280, 1` | `view.highlight` = the card's `12, 12, 192, 1` | follows the card |
 * | `key map` | `942.59, 36, 29.18, 24` | — | the shipped card draws no chip of its own (`panels/map/README.md` rule 3) |
 * | `view route`, `view map` | `1096, 36, 54, 20` / `1156, 36, 44, 20` | — | there is no route/map toggle: the game has one map and `MapPanelView` has no such field |
 * | `viridian all routes`, `Group`, `Vector` | `942, 64, 276, 146` … | — | the board's **region** map, one `Vector` per route; the game draws the floor's own rooms (`view.rooms`) and no region at all |
 * | `route screenshot` | `0, 0, 1280, 800` | — | the frame's painted scene |
 *
 * A box is claimed only when the shipped rect lands within `GAP_TOLERANCE` of the frame's
 * box of that name, so a card that ever moves onto the board becomes a claim instead of a
 * silent pass. The one line the card prints, `view.title.text` = `Map 1 · Viridian
 * Forest`, is **not** the board's string: the board's `map routes title` is `VIRIDIAN
 * FOREST`, and `gapFor`'s case fold cannot reach the `Map 1 · ` prefix and separator. The
 * title is also a text node, not a box, so it is never a box claim either.
 *
 * No colour is claimed: the card's chrome is `map.css`'s tokens, and its one content
 * colour set (`MAP_CURRENT_FILL`, `MAP_SPECIAL_TONES`, the entry and portal strokes)
 * belongs to rooms and markers, none of which this frame draws as a box.
 *
 * Deterministic and total: no `Rng`, no clock, no DOM, no store — `mapPanelView` is pure
 * and the fixture is a module constant.
 */
export function buildView(spec: ScreenSpec): PanelView {
  const view = mapPanelView(FIXTURE.map.view as unknown as MapView, FIXTURE.map.title, DESKTOP);
  return {
    boxes: [...claim(spec, CARD, view.box), ...claim(spec, HIGHLIGHT, highlightRect(view))],
    strings: [],
    colours: [],
  };
}

/** The highlight is panel-relative in the view model, so a claim reads it at the card's own origin. */
function highlightRect(view: MapPanelView): Rect {
  return {
    x: view.box.x + view.highlight.x,
    y: view.box.y + view.highlight.y,
    w: view.highlight.w,
    h: view.highlight.h,
  };
}

/** The card is the board's card only when the frame draws the shipped rect, ±1 px. */
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
