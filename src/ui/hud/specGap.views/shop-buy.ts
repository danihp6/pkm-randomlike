import shopFixture from '../../../../design/fixtures/03d-route-shop-buy.json';
import {
  shopPanelView,
  type Rect,
  type ShopInput,
  type ShopMode,
  type ShopPanelView,
} from '../panels/shop/view';
import { GAP_TOLERANCE, type GapBox, type PanelView, type ScreenSpec } from '../specGap';

/** The screen this adapter answers for: one slug, one spec, one panel. */
export const slug = '03d-route-shop-buy';

const DESKTOP = { width: 1280, height: 800 };

/** An atlas URL is a runtime concern, and no box and no string depends on the icon. */
const NO_ICON = () => null;

/** One of the fixture's two blocks, as the frame wrote it: the rows the card is handed. */
type ShopBlock = Readonly<{
  title: string;
  money: number;
  message: string;
  hint: string;
  empty: string;
  rows: readonly Readonly<{
    index: number;
    itemId: string;
    name: string;
    price: number;
    count: number;
    owned: number;
    affordable: boolean;
  }>[];
  selected: number;
  scroll: number;
}>;

const FIXTURE = shopFixture as unknown as Readonly<{ buy: ShopBlock; sell: ShopBlock }>;

/**
 * The Mart's view on its BUY tab, built exactly as the running card builds it — the fixture's
 * own `buy` block (title `MART`, money 2480, two rows, nothing scrolled, row 0 selected) at
 * 1280×800, with `open: true` because the block carries no `open` field — and narrowed to
 * the three facts `gapFor` compares against the frame `03d Route · shop · buy`.
 *
 * **The board's Mart is not the shipped Mart**, and the panel's own README records it: the
 * frame draws a 704 × 336 shell with a search field, three category chips and a 656 × 164
 * grid of sixteen 64 × 60 tiles, while the shipped card is the 640 × 540 floating window with
 * seven 588 × 40 rows. So no box is claimed. The five candidates are measured against the
 * frame on every call, so a card that ever lands on the board's rect becomes a claim instead
 * of a silent pass.
 *
 * | frame box | frame rect | shipped | why not claimed |
 * | --- | --- | --- | --- |
 * | `shop shell` | `288, 232, 704, 336` | `view.box` = `320, 130, 640, 540` | dx +32, dy −102, dw −64, dh +204: the board's shell is a 704 × 336 window at 232, the card a 640 × 540 window centred at 130 |
 * | `shop panel` (and `shop panel group`, `shop grid viewport`, the same rect under three names) | `312, 364, 656, 164` | `view.list.box` → `340, 242, 600, 320` | dx +28, dy −122, dw −56, dh +156: sixteen tiles in a 656 × 164 grid against seven 588 × 40 rows |
 * | `shop panel highlight` | `324, 372, 632, 1` | `view.highlight` → `332, 142, 616, 1` | follows the card, and is 16 px narrower than the board's |
 * | `tab buy` | `312, 294, 66, 24` | `view.tabs[0].box` → `340, 200, 108, 30` | dx +28, dy −94, dw +42, dh +6 |
 * | `tab sell` | `378, 294, 66, 24` | `view.tabs[1].box` → `454, 200, 108, 30` | dx +76, dy −94, dw +42, dh +6 |
 * | `bag tile 1…16`, `bag icon …` | local `(12, 16)` … `64 × 60` at an 81 px / 72 px pitch inside the grid viewport | `view.rows[i].box` → `346, 248 + 44i, 588, 40`, seven rows | the board draws tiles inside a grid viewport; the card draws a row list, and the frame's rects there are local to that viewport |
 * | `bag search field`, `bag search icon`, `Vector` ×2 | `744, 294, 224, 24` / `754, 301, 10, 10` | — | the shipped card has no search field and no glyph |
 * | `filter consumables`, `filter pokeballs`, `filter held` | `312, 330, 116, 20` … | — | the shipped card has no category chips |
 * | `cursor ring` | `322, 378, 68, 64` | — | a selected row is a CSS wash on the row (`shop.css`'s `[data-selected]`), not a ring |
 * | `shell highlight`, `header divider` | `300, 244, 680, 1` / `312, 280, 656, 1` | `view.highlight` only | the card draws one 1 px rule 12 px inside its own top edge; the board's two extra rules have no field |
 * | `route screenshot`, `scrim` | `0, 0, 1280, 800` | — | the frame's painted scene and its dimming layer: a floating card paints no scrim (`D45`) |
 *
 * **Two strings are claimed**: the tabs' `BUY` and `SELL`, which the frame draws as its
 * `tab label buy` / `tab label sell` and `gapFor`'s case fold reaches. The rest of the copy
 * is not: `MART` against the board's `SHOP` title, `MONEY  ¥2480` against its one line
 * `$ 2,480`, each row's `¥300` / `¥700` against its `bag qty` `$300` / `$700`, the owned
 * count `x2` against the board's `×` (the frame prints no count at all for a row it owns
 * none of, and folds its `--` for the last tile), and the message, the hint and the `✕`,
 * which the board never prints.
 *
 * No colour is claimed: the card's fills and borders are `shop.css`'s tokens and the item
 * atlas, and the view model carries no colour literal. It reads no `Rng`, no clock, no DOM
 * and no store — `shopPanelView` is pure and the fixture is a module constant — so the same
 * spec always yields the same view.
 */
export function buildView(spec: ScreenSpec): PanelView {
  const view = shopPanelView(inputFrom(FIXTURE.buy, 'buy'), DESKTOP, NO_ICON);
  return { boxes: boxClaims(view, spec), strings: stringClaims(view, spec), colours: [] };
}

/** The fixture's block, as the `ShopInput` the scene module hands the view. */
function inputFrom(block: ShopBlock, mode: ShopMode): ShopInput {
  return {
    title: block.title,
    mode,
    rows: block.rows.map((row) => ({
      itemId: row.itemId,
      name: row.name,
      price: row.price,
      count: row.count,
      owned: row.owned,
      affordable: row.affordable,
      draggable: mode === 'buy' && row.affordable,
    })),
    scroll: block.scroll,
    selected: block.selected,
    money: block.money,
    message: block.message,
    empty: block.empty,
    open: true,
  };
}

/**
 * The five boxes the shipped card draws, at their viewport rect, claimed only when the frame
 * draws that name at the shipped rect: the card is a 640 × 540 window where the board's shell
 * is 704 × 336, so this frame claims nothing, and a card moved onto the board becomes a claim.
 */
function boxClaims(view: ShopPanelView, spec: ScreenSpec): readonly GapBox[] {
  const candidates: readonly Readonly<{ name: string; rect: Rect }>[] = [
    { name: 'shop shell', rect: view.box },
    { name: 'shop panel', rect: at(view.box, view.list.box) },
    { name: 'shop panel highlight', rect: at(view.box, view.highlight) },
    { name: 'tab buy', rect: at(view.box, view.tabs[0]!.box) },
    { name: 'tab sell', rect: at(view.box, view.tabs[1]!.box) },
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
 * The copy the card prints, in its draw order, claimed only where it is the board's line:
 * `gapFor` folds case and nothing else, so `¥300` is not `$300` and `MONEY  ¥2480` is not
 * `$ 2,480`. Only the two tab labels survive that fold.
 */
function stringClaims(view: ShopPanelView, spec: ScreenSpec): readonly string[] {
  const fold = (line: string): string => line.trim().toUpperCase();
  const printed = [
    ...view.tabs.map((tab) => tab.label),
    view.title,
    view.money.text,
    ...view.rows.flatMap((row) => [row.name, row.price, row.owned]),
    view.message.text,
    view.hint.text,
    view.close.label,
    view.empty?.text ?? '',
  ].filter((line) => line !== '');
  const board = new Set(spec.text.map((node) => fold(node.characters)));
  return printed.filter((line) => board.has(fold(line)));
}
