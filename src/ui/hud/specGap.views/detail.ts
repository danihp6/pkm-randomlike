import detailFixture from '../../../../design/fixtures/03m-panels-pokemon-moves.json';
import type { MemberDetail } from '../../partyDetail';
import {
  detailPanelBox,
  detailPanelView,
  type DetailPanelUi,
  type DetailPoolRow,
} from '../panels/detail';
import { GAP_TOLERANCE, type GapBox, type PanelView, type ScreenSpec } from '../specGap';

/** The screen this adapter answers for: one slug, one spec, one panel. */
export const slug = '03m-panels-pokemon-moves';

const DESKTOP = { width: 1280, height: 800 };

/** The frame's own name for the card, the one the geometry table below records. */
const CARD = 'detail panel';

type FixtureFile = Readonly<{
  detail: MemberDetail;
  pool: readonly DetailPoolRow[];
  ui: DetailPanelUi;
}>;

const FIXTURE = detailFixture as unknown as FixtureFile;

/**
 * The member detail card's view, built exactly as the running panel builds it — the
 * fixture's own `detail`, `pool` and `ui` at 1280×800, its `tab` is the frame's `moves`
 * — narrowed to the copy the frame draws: the name, the level line, the four move cells'
 * name / PP / power / accuracy lines and the learnset search placeholder.
 *
 * **The card is not the board's card, box by box, so no box is claimed.**
 *
 * | frame box | frame rect | shipped | why not claimed |
 * | --- | --- | --- | --- |
 * | `detail panel` | `448, 88, 360, 508` | `detailPanelBox` = `108, 72, 460, 560` | the shipped card is the 460×560 one (`DETAIL_PANEL_W/H`); dw +100, dh +52 |
 * | `detail panel highlight` | `460, 100, 336, 1` | `box + (12, 12, 436, 1)` | follows the card |
 * | `tab stats`, `tab moves` | `576/654, 176, 70/76, 28` | `128/269/410, 144, 137/137/138, 26` | the card's tab row is a control; three tabs, not two |
 * | `key stats` | `460, 100, 24, 24` | — | the board draws **no** chip for this card (`panels/detail/README.md` rule 8); the card's `×` control is `data-hud-detail-close` |
 * | `move tile 0…3`, `move type/category 0…3` | `472/632, 248/332, 152, 76` | `moveSlots(...).box` / `typeBox` / `categoryBox` inside the 460 card | follows the card's size |
 * | `detail portrait` | `472, 140, 88, 88` | the header's portrait cell | follows the card |
 * | `nickname field`, `nickname caret`, `type square fire/flying` | — | `view.nickname.box`, `view.types[].box` | follows the card |
 * | `stats panel`, `route screenshot` | — | — | the frame's painted scene and its stats overlay, not this card |
 *
 * The strings it claims are those nineteen lines: the level line is `LV 36` on the card and
 * on the board alike, so it is part of the claim rather than a gap beside it.
 *
 * The strings it does not claim: the tab labels `STATS` / `MOVES` and the letters `S` and
 * `X` (the card's own controls); the learnset band's eight names (`EMBER`… `GROWL`,
 * another family than the fixture's pool); and every label the board's card does not
 * print (`NATURE`, `ABILITY`, `HELD`, the hints).
 *
 * No colour is claimed: the card's fills and borders are `detail.css`'s tokens and the
 * two atlases, and the view model carries no colour literal.
 */
export function buildView(spec: ScreenSpec): PanelView {
  const view = detailPanelView(FIXTURE.detail, FIXTURE.pool, FIXTURE.ui, DESKTOP);
  const cells = view.moves.flatMap((move) => [move.name, move.pp, move.power, move.accuracy]);
  return {
    boxes: cardClaim(spec),
    strings: [view.name, view.level, ...cells, view.search.placeholder].filter(
      (line) => line !== '',
    ),
    colours: [],
  };
}

/**
 * The card is the board's card only when the frame draws the shipped rect: the board's
 * `448, 88, 360, 508` is 100 px narrower and 52 px shorter, so this frame claims nothing
 * and the empty claim cannot rot silently — a card resized to the board becomes a claim.
 */
function cardClaim(spec: ScreenSpec): readonly GapBox[] {
  const frame = spec.boxes.find((box) => box.name === CARD);
  if (frame === undefined) return [];
  const shipped = detailPanelBox(DESKTOP);
  const near =
    Math.abs(shipped.x - frame.x) <= GAP_TOLERANCE &&
    Math.abs(shipped.y - frame.y) <= GAP_TOLERANCE &&
    Math.abs(shipped.w - frame.width) <= GAP_TOLERANCE &&
    Math.abs(shipped.h - frame.height) <= GAP_TOLERANCE;
  return near ? [{ name: CARD, ...shipped }] : [];
}
