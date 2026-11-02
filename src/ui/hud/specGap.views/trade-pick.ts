import tradeFixture from '../../../../design/fixtures/03i-panels-trade-pick.json';
import { tradePanelView, type Rect, type TradeInput, type TradePanelView } from '../panels/trade/view';
import { GAP_TOLERANCE, type GapBox, type PanelView, type ScreenSpec } from '../specGap';

/** The screen this adapter answers for: one slug, one spec, one panel. */
export const slug = '03i-panels-trade-pick';

/** The frame's own viewport, where the board's rects are measured. */
const DESKTOP = { width: 1280, height: 800 };

/** A tile as the fixture records it: an id, a name, a level on the party, a dex frame. */
type PickTile = Readonly<{
  memberId: string;
  name: string;
  level?: number;
  frame: number | null;
}>;

/** The fixture's own `pick` block: the line, the two counts and the eleven tiles. */
type PickBlock = Readonly<{
  message: string;
  canTrade: boolean;
  party: readonly PickTile[];
  pc: readonly PickTile[];
  selected: number;
  partyCount: number;
  pcCount: number;
  open: boolean;
}>;

const FIXTURE = tradeFixture as unknown as Readonly<{ pick: PickBlock }>;

/**
 * The block as the trade panel's own input, mapped exactly as `panels/trade/fixture.test.ts`
 * maps it: a tile's `box` and `selected` are the view's arithmetic over the grid, and the
 * result field is null because this frame is the pick state.
 */
function inputFrom(block: PickBlock): TradeInput {
  return {
    kind: 'pick',
    message: block.message,
    canTrade: block.canTrade,
    party: block.party.map((tile) => ({
      memberId: tile.memberId,
      name: tile.name,
      level: tile.level ?? 0,
      frame: tile.frame,
      selected: false,
      box: { x: 0, y: 0, w: 0, h: 0 },
    })),
    pc: block.pc.map((tile) => ({
      memberId: tile.memberId,
      name: tile.name,
      frame: tile.frame,
      box: { x: 0, y: 0, w: 0, h: 0 },
    })),
    selected: block.selected,
    partyCount: block.partyCount,
    pcCount: block.pcCount,
    received: null,
    open: block.open,
  };
}

/**
 * The trade counter's pick sheet, built exactly as the running panel builds it — the
 * fixture's own `pick` block at 1280×800 — and narrowed to the three facts `gapFor` compares
 * against the frame `03i Panels · trade pick`. `spec` is read only as a structural selector —
 * is this box in the frame at all, is this line the board's text — never as the answer.
 *
 * **This frame is the shipped card**, so the card *is* the board's and every box it draws is
 * claimed, every delta 0:
 *
 * | frame box | frame rect | shipped | why it is claimed |
 * | --- | --- | --- | --- |
 * | `trade panel` | `260, 120, 760, 560` | `view.box` = `tradePanelBox(DESKTOP)` | the card and the board are the same 760 × 560 rect |
 * | `panel highlight` | `272, 132, 736, 1` | `view.highlight` → the same | 12 px inside the card's top edge (`TRADE_HIGHLIGHT_INSET`) |
 * | `party row 1`…`6` | `284/454, 236/352/468, 158, 104` | `view.party[i].box` → the same | six 158 × 104 tiles at a 170 / 116 pitch, two a row |
 * | `pc slot 1`…`5` | `656/744/832/920 × 236/324`, `76 × 76` | `view.pc[i].box` → the same | five 76 × 76 cells at an 88 px pitch; the fixture holds five PC members, so the card paints five of the frame's sixteen cells |
 * | `give away button` | `470, 612, 340, 44` | `view.give!.box` → the same | 340 × 44, 24 px above the card's bottom edge |
 *
 * The frame's `header divider` (`284, 204, 712, 1`), its eleven `party icon` / `pc icon`
 * rects, `route screenshot` and `scrim` are **not** claimed: the divider and the scrim are
 * `trade.css`'s paint, a portrait inside a tile is centred by the stylesheet (the contract's
 * tiles carry their box, not their portrait's) and the route behind the card is the canvas.
 *
 * Five strings are claimed — `TRADE`, the room's line, `PARTY`, `PC` and `GIVE AWAY` — while
 * the meta line and the `✕` are not: `gapFor` folds case and nothing else, the board separates
 * the two counts with three spaces where the card prints `·`, and the frame draws no dismiss
 * control. `colours: []`: the card's fills and strokes are `trade.css`'s tokens and the view
 * model carries no colour literal. It reads no `Rng`, no clock, no DOM and no store —
 * `tradePanelView` is pure and the fixture is a module constant — so the same spec always
 * yields the same view.
 */
export function buildView(spec: ScreenSpec): PanelView {
  const view = tradePanelView(inputFrom(FIXTURE.pick), DESKTOP);
  return { boxes: boxClaims(view, spec), strings: stringClaims(view, spec), colours: [] };
}

/**
 * Every box the card draws, at its viewport rect and under the frame's own name, claimed only
 * when the frame draws that name within `GAP_TOLERANCE`: the board's card. A row is
 * `party row ${index + 1}` and a cell `pc slot ${index + 1}`, which is the frame's own naming,
 * so a renamed box is a `missing` gap instead of a silent pass.
 */
function boxClaims(view: TradePanelView, spec: ScreenSpec): readonly GapBox[] {
  const candidates: Readonly<{ name: string; rect: Rect }>[] = [
    { name: 'trade panel', rect: view.box },
    { name: 'panel highlight', rect: at(view.box, view.highlight) },
    ...view.party.map((tile, index) => ({
      name: `party row ${index + 1}`,
      rect: at(view.box, tile.box),
    })),
    ...view.pc.map((tile, index) => ({
      name: `pc slot ${index + 1}`,
      rect: at(view.box, tile.box),
    })),
    ...(view.give === null ? [] : [{ name: 'give away button', rect: at(view.box, view.give.box) }]),
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
 * The copy the card prints, claimed only where `gapFor`'s own fold (trim + upper-case) makes
 * it the board's line, so a copy fix lands as a claim instead of passing silently. The list is
 * a filter, never a literal: a future drift leaves the board's set. The meta line is printed
 * but not the board's, so the fold drops it here and `gapFor` never reports it.
 */
function stringClaims(view: TradePanelView, spec: ScreenSpec): readonly string[] {
  const fold = (line: string): string => line.trim().toUpperCase();
  const printed: readonly string[] = [
    view.title.text,
    view.meta.text,
    view.message.text,
    view.partyLabel.text,
    view.pcLabel.text,
    view.give?.label ?? '',
    view.close.label,
  ];
  const board = new Set(spec.text.map((node) => fold(node.characters)));
  return printed.filter((line) => line !== '' && board.has(fold(line)));
}
