import noticeLevelUpFixture from '../../../../design/fixtures/03l-panels-notice-level-up.json';
import { noticesPanelView } from '../panels/notices';
import type { PanelView, ScreenSpec } from '../specGap';

/** The screen this adapter answers for: one slug, one spec, one panel. */
export const slug = '03l-panels-notice-level-up';

const DESKTOP = { width: 1280, height: 800 };

/**
 * The notice strip against `03l Panels · notice level up`, at the desk viewport the frame
 * draws.
 *
 * The panel is handed the frame's own fixture, so the view is the one the route mounts: a
 * single line in the 720 × 56 card at (280, 24). The frame's card is the same 720 wide and in
 * the same place, but **132 tall** — it carries a learned-moves block — so the box is moved,
 * not drawn, and the only honest box claim is none. `boxes: []` is that measurement, not an
 * omission: the frame's two `move type` chips have no field in `Notice`, the hairline is the
 * stylesheet's, and the route behind the strip is the canvas's. The strings claim is the one
 * line the card prints, which is the frame's own `level line`, and no colour is claimed
 * because the glass is `notices.css`'s tokens, which `scripts/design/check.mjs` already
 * covers.
 *
 * The boxes this view does **not** claim:
 *
 * | frame box | frame rect | shipped | why not claimed |
 * | --- | --- | --- | --- |
 * | `level up strip` | `280, 24, 720, 132` | `noticeBox(1280×800)` = `280, 24, 720, 56` | the frame is 76 px taller: x, y and w agree to the pixel, and that extra height is the learned-moves block, which is the Phaser learn popup in the running game |
 * | `level up strip highlight` | `292, 36, 696, 1` | `notices.css` `::before`, 12 px in from the card's top and sides, 1 px tall | painted by the stylesheet off the card, not a view box: it lands on the frame's hairline exactly and is not this comparison's |
 * | `move type 1`, `move type 2` | `304, 92, 24, 24` / `304, 118, 24, 24` | — | the learned-moves rows' type chips; `Notice` carries text and a hold only, so the panel has no field for them |
 * | `route screenshot` | `0, 0, 1280, 800` | the route canvas | the route behind the strip, which the scene draws (`D49`), not this panel |
 *
 * Of the frame's five strings only `level line` is claimed below, because it is the line the
 * card prints; `level meta` (`LEVEL UP`), `learned kicker` (`LEARNED MOVES`) and the two move
 * names belong to the learned-moves block the panel does not have.
 *
 * Deterministic and total: no `Rng`, no clock, no DOM, no i18n — the fixture's line and the
 * same exported `noticeBox` the panel uses give the same view every time.
 */
export function buildView(_spec: ScreenSpec): PanelView {
  const view = noticesPanelView({ notice: noticeLevelUpFixture.notice.text, area: null }, DESKTOP);
  return {
    boxes: [],
    strings: [view.notice?.text ?? ''].filter((line) => line !== ''),
    colours: [],
  };
}
