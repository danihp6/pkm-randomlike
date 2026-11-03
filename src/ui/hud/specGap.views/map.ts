import { planRegion } from '../../../engine/region/plan';
import { regionMapView } from '../../regionMap';
import { mapPanelView, type MapPanelView, type Rect } from '../panels/map';
import { GAP_TOLERANCE, type GapBox, type PanelView, type ScreenSpec } from '../specGap';

/** The screen this adapter answers for: one slug, one spec, one panel. */
export const slug = '03o-panels-map-routes';

const DESKTOP = { width: 1280, height: 800 };

/** The adapter's own region: a fixed seed, so the card it measures never changes. */
const SEED = '03o';

/** The frame's own names for the two rects the shipped card draws. */
const CARD = 'map routes panel';
const HIGHLIGHT = 'map routes highlight';

/**
 * The route header card's view, built exactly as the running panel builds it — a fixed
 * seed of this adapter's own through `regionMapView` and `mapPanelView` at 1280×800 —
 * narrowed to the facts `gapFor` compares. **The frame's region map now exists in the
 * game; the gap is the card's docking rect and its ROUTE/MAP toggle, so nothing is claimed.**
 *
 * | frame row | frame rect | shipped | what would turn the row into a claim |
 * | --- | --- | --- | --- |
 * | `map routes panel` | `928, 24, 304, 198` | `view.box` = `8, 8, 216, 250` | moving the card onto the board's dock and adopting its 304 × 198 rect (dx −920, dy −16, dw −88, dh +52) |
 * | `map routes highlight` | `942.59, 36, 280, 1` | the card's `12, 12, 192, 1` | the same move: the highlight is drawn 12 px inside whatever rect the card gets |
 * | `key map` | `942.59, 36, 29.18, 24` | — | giving the card a chip of its own; the frame's is a `key map` badge the panel frame does not draw |
 * | `view route`, `view map` | `1096, 36, 54, 20` / `1156, 36, 44, 20` | — | shipping the ROUTE/MAP toggle: the game has one region map and no route list to switch to |
 * | `viridian all routes`, `Group`, `Vector` | `942, 64, 276, 146` … | — | the frame's own region drawing, at the board's dock. The card **does** draw the region now (`view.nodes`, `view.edges`), but at the shipped rect, and the frame names those shapes `Vector`, never a box this view model emits |
 * | `route screenshot` | `0, 0, 1280, 800` | — | the frame's painted scene |
 *
 * **The map half of `docs/region-spec.md` §5 is shipped here**: the card is the plan's
 * straight-line graph, every settlement visible from the first frame, the visited ones
 * marked and the current one blinking. The **flight** half is not: `[Task-283]` wires the
 * click that dispatches `travel`, so the card is still inert and this table stays empty.
 *
 * No colour is claimed: the card's chrome is `map.css`'s tokens, and its dot tones
 * (`MAP_CURRENT_FILL`, `MAP_VISITED_FILL`, `MAP_UNVISITED_FILL`) are view-model data the
 * frame does not name as boxes.
 *
 * Deterministic and total: no `Rng` read here (the plan derives its own from the seed),
 * no clock, no DOM, no store — `regionMapView` and `mapPanelView` are pure and both
 * arguments are constants.
 */
export function buildView(spec: ScreenSpec): PanelView {
  const view = card();
  return {
    boxes: [...claim(spec, CARD, view.box), ...claim(spec, HIGHLIGHT, highlightRect(view))],
    strings: [],
    colours: [],
  };
}

/** The card the running panel draws, from this adapter's fixed seed. */
function card(): MapPanelView {
  const plan = planRegion(SEED);
  const region = regionMapView(plan, {
    nodeKey: plan.townKey,
    visitedNodes: [plan.townKey],
    badges: [],
  });
  return mapPanelView(region, DESKTOP);
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
