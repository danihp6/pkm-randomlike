import resultFixture from '../../../../design/fixtures/03j-panels-trade-result.json';
import {
  tradePanelView,
  type Rect,
  type TradeInput,
  type TradePanelView,
  type TradePartyTile,
  type TradePcTile,
} from '../panels/trade/view';
import type { GapBox, PanelView, ScreenSpec } from '../specGap';

/** The screen this adapter answers for: the trade panel after a trade landed. */
export const slug = '03j-panels-trade-result';

/** The frame's own viewport, where the board's rects are measured. */
const DESKTOP = { width: 1280, height: 800 };

/** One fixture tile: its data, never its drawn rect or its selection. */
type FixtureTile = Readonly<{ memberId: string; name: string; level?: number; frame: number | null }>;

/** The fixture's `result` block: the input the running card is painted from. */
type ResultBlock = Readonly<{
  kind: string;
  message: string;
  canTrade: boolean;
  selected: number;
  partyCount: number;
  pcCount: number;
  open: boolean;
  received: TradeInput['received'];
  party: readonly FixtureTile[];
  pc: readonly FixtureTile[];
}>;

const FIXTURE = resultFixture as unknown as Readonly<{ result: ResultBlock }>;

/**
 * The fixture block as the panel's input, mirroring `panels/trade/fixture.test.ts`'s mapping:
 * a tile's `box` and `selected` are the view's own arithmetic over the grid, so they are
 * placeholders here and `received` is read only on the result state.
 */
function inputFrom(block: ResultBlock): TradeInput {
  return {
    kind: block.kind === 'result' ? 'result' : 'pick',
    message: block.message,
    canTrade: block.canTrade,
    party: partyOf(block.party),
    pc: pcOf(block.pc),
    selected: block.selected,
    partyCount: block.partyCount,
    pcCount: block.pcCount,
    received: block.kind === 'result' ? block.received : null,
    open: block.open,
  };
}

function partyOf(tiles: readonly FixtureTile[]): readonly TradePartyTile[] {
  return tiles.map((tile) => ({
    memberId: tile.memberId,
    name: tile.name,
    level: tile.level ?? 0,
    frame: tile.frame,
    selected: false,
    box: { x: 0, y: 0, w: 0, h: 0 },
  }));
}

function pcOf(tiles: readonly FixtureTile[]): readonly TradePcTile[] {
  return tiles.map((tile) => ({
    memberId: tile.memberId,
    name: tile.name,
    frame: tile.frame,
    box: { x: 0, y: 0, w: 0, h: 0 },
  }));
}

/**
 * The trade card's result state as the running card builds it — the fixture's own `result`
 * block at 1280×800 — narrowed to the three facts `gapFor` compares against the frame
 * `03j Panels · trade result`. `spec` is read only as a structural selector — does the frame
 * draw this box name, is this line the board's text — never as the answer: every shipped
 * number comes from `panels/trade/view.ts`.
 *
 * **The shipped result card *is* the frame's card**, so four boxes are claimed, every delta 0:
 *
 * | frame box | frame rect | shipped | why it is claimed |
 * | --- | --- | --- | --- |
 * | `result panel` | `360, 190, 560, 420` | `at(view.box, view.result.card)` | **claimed**: the card is centred inside the panel box `260, 120, 760, 560` at `100, 70` |
 * | `panel highlight` | `372, 202, 536, 1` | `at(view.box, view.highlight)` | **claimed**: `TRADE_HIGHLIGHT_INSET` 12 inside the card's top edge; `view.highlight` is already lifted into the panel |
 * | `received portrait` | `576, 278, 128, 128` | `at(view.box, at(view.result.card, view.result.portrait))` | **claimed**: the 128 px portrait centred at `216, 88` inside the card |
 * | `type WATER` | `628, 486, 24, 24` | the same double lift on `view.result.type.box` | **claimed**: the 24 px chip at `268, 296` inside the card; its name is **derived** from the type id, so a renamed chip lands as `missing` instead of passing |
 *
 * Two coordinate frames meet here: `view.result.card` is **panel**-relative while every rect
 * inside `result` is **card**-relative, so the portrait and the chip need two `at()` lifts and
 * a one-lift bug reports them at `476, 208` / `528, 416` instead of the board's rects.
 *
 * Declared and **not claimed**, because the card does not draw them:
 *
 * - `header divider` at `384, 240, 512, 1`: the pick face's rule is `trade.css`'s paint and the
 *   result card's view model has no box for it, so a claim would invent a rect.
 * - The `give away button` the frame does not draw on this card: `view.give` is `null` in the
 *   result state, so there is no box to claim.
 * - The card's own `CLOSE` press at `470, 542, 340, 44` (`view.result.button.box`, lifted like
 *   the chip, and the same rect as `view.close.box`): the frame carries no button here, so it is
 *   recorded and never claimed — a `missing` gap would be a lie.
 * - `route screenshot` and `scrim` (`0, 0, 1280, 800`): the frame's painted scene and its dimming
 *   layer; the card's own scrim is `trade.css`'s child of the root, not a view box (`D45`).
 *
 * Five strings are claimed, in the card's draw order: `TRADE`, `TRADE COMPLETE`, `RECEIVED`,
 * `SHELLDER` and `ADDED TO YOUR PARTY`. The card's `CLOSE` and the room's `Received SHELLDER!`
 * are printed but the frame carries neither on this card, so the fold drops them. `colours: []`
 * — the card's fills and strokes are `trade.css`'s tokens. It reads no `Rng`, no clock, no DOM
 * and no store, so the same spec always yields the same view.
 */
export function buildView(spec: ScreenSpec): PanelView {
  const view = tradePanelView(inputFrom(FIXTURE.result), DESKTOP);
  return { boxes: boxClaims(view, spec), strings: stringClaims(view, spec), colours: [] };
}

/**
 * Every box the result card draws, at its viewport rect, claimed only when the frame draws that
 * name: the board's own four. The chip's name is `type ${id.toUpperCase()}`, which is the frame's
 * own naming, so a missing or renamed chip is a `missing` gap instead of a silent pass.
 */
function boxClaims(view: TradePanelView, spec: ScreenSpec): readonly GapBox[] {
  const result = view.result;
  if (result === null) return [];
  const candidates: readonly Readonly<{ name: string; rect: Rect }>[] = [
    { name: 'result panel', rect: at(view.box, result.card) },
    { name: 'panel highlight', rect: at(view.box, view.highlight) },
    { name: 'received portrait', rect: at(view.box, at(result.card, result.portrait)) },
    ...(result.type === null
      ? []
      : [
          {
            name: `type ${result.type.id.toUpperCase()}`,
            rect: at(view.box, at(result.card, result.type.box)),
          },
        ]),
  ];
  return candidates.flatMap((candidate) => claim(spec, candidate.name, candidate.rect));
}

/** Where a panel-relative rect lands once the card is mounted at its own viewport box. */
function at(origin: Rect, rect: Rect): Rect {
  return { x: origin.x + rect.x, y: origin.y + rect.y, w: rect.w, h: rect.h };
}

/** The claim, or nothing when the frame does not draw that name at all. */
function claim(spec: ScreenSpec, name: string, shipped: Rect): readonly GapBox[] {
  const drawn = spec.boxes.some((box) => box.name === name);
  return drawn ? [{ name, ...shipped }] : [];
}

/**
 * The copy the card prints, claimed only where `gapFor`'s own fold (trim + upper-case) makes it
 * the board's line, so a copy fix lands as a claim instead of passing silently. The list is a
 * filter, never a literal: a future drift leaves the board's set.
 */
function stringClaims(view: TradePanelView, spec: ScreenSpec): readonly string[] {
  const fold = (line: string): string => line.trim().toUpperCase();
  const printed: readonly string[] = [
    view.title.text,
    view.meta.text,
    view.message.text,
    view.close.label,
    ...(view.result === null
      ? []
      : [
          view.result.title,
          view.result.kicker,
          view.result.name,
          view.result.added,
          view.result.button.label,
        ]),
  ];
  const board = new Set(spec.text.map((node) => fold(node.characters)));
  const claimed: string[] = [];
  for (const line of printed) {
    if (line === '' || !board.has(fold(line)) || claimed.includes(line)) continue;
    claimed.push(line);
  }
  return claimed;
}
