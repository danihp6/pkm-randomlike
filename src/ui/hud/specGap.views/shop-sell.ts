import shopFixture from '../../../../design/fixtures/03e-route-shop-sell.json';
import {
  shopPanelView,
  type Rect,
  type ShopInput,
  type ShopMode,
  type ShopPanelView,
} from '../panels/shop/view';
import { GAP_TOLERANCE, type GapBox, type PanelView, type ScreenSpec } from '../specGap';

/** The screen this adapter answers for: one slug, one spec, one panel. */
export const slug = '03e-route-shop-sell';

const DESKTOP = { width: 1280, height: 800 };

/** An atlas URL is a runtime concern, and no box and no string depends on the icon. */
const NO_ICON = () => null;

/** The fixture's own row block, as the sell tab's eight stock rows and their copy. */
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

const FIXTURE = shopFixture as unknown as Readonly<{ sell: ShopBlock }>;

/** The block's rows as the `ShopRow`s the scene module hands the view, exactly as `fixture.test.ts` maps them. */
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
 * The Mart's view, built exactly as the running panel builds it — the fixture's own `sell`
 * block (title `MART`, money 2480, eight rows, selection 0, scroll 0) at 1280×800, on the
 * SELL tab — and narrowed to the three facts `gapFor` compares against the frame
 * `03e Route · shop · sell`. The frame's own 704 × 336 shell is republished here under the
 * **bag's** names, so a candidate named after `03d` would report a `missing` gap: every
 * candidate below wears **this** frame's name for the rect.
 *
 * | frame box | frame rect | shipped | why not claimed |
 * | --- | --- | --- | --- |
 * | `shop shell` | `288, 232, 704, 336` | `view.box` = `320, 130, 640, 540` | dx +32, dy −102, dw −64, dh +204: the board's shell is a 704 × 336 window at 232, the card a 640 × 540 window centred at 130 |
 * | `bag panel` (and `bag panel group`, `bag grid viewport`, the same rect under three names) | `312, 364, 656, 164` | `view.list.box` → `340, 242, 600, 320` | dx +28, dy −122, dw −56, dh +156: sixteen tiles in a 656 × 164 grid against seven 588 × 40 rows. The frame calls the window the **bag's**, so a `shop panel` candidate copied from `03d` is a `missing` gap, not a claim |
 * | `bag panel highlight` | `324, 372, 632, 1` | `view.highlight` → `332, 142, 616, 1` | follows the card, and is 16 px narrower than the board's |
 * | `tab buy` | `312, 294, 66, 24` | `view.tabs[0].box` → `340, 200, 108, 30` | dx +28, dy −94, dw +42, dh +6 |
 * | `tab sell` | `378, 294, 66, 24` | `view.tabs[1].box` → `454, 200, 108, 30` | dx +76, dy −94, dw +42, dh +6 |
 * | `bag tile 1…16`, `bag icon …` | local `(12, 16)` … `64 × 60` at an 81 px / 72 px pitch inside the grid viewport | `view.rows[i].box` → `346, 248 + 44i, 588, 40`, seven of the fixture's eight rows | the board draws tiles inside a grid viewport; the card draws a row list, and the frame's rects there are local to that viewport |
 * | `bag search field`, `bag search icon`, `Vector` ×2 | `744, 294, 224, 24` / `754, 301, 10, 10` | — | the shipped card has no search field and no glyph |
 * | `filter consumables`, `filter pokeballs`, `filter held` | `312, 330, 116, 20` … | — | the shipped card has no category chips |
 * | `cursor ring` | `322, 378, 68, 64` | — | a selected row is a CSS wash on the row (`shop.css`'s `[data-selected]`), not a ring |
 * | `shell highlight`, `header divider` | `300, 244, 680, 1` / `312, 280, 656, 1` | `view.highlight` only | the card draws one 1 px rule 12 px inside its own top edge; the board's two extra rules have no field |
 * | `route screenshot`, `scrim` | `0, 0, 1280, 800` | — | the frame's painted scene and its dimming layer: a floating card paints no scrim (`D45`) |
 *
 * **Two strings are claimed**, the two chip labels the frame and the card agree on:
 * `BUY` (the frame's `tab label buy`) and `SELL` (`tab label sell`). **The rest of the copy
 * misses everywhere**: the card's `MART` against `shop title`'s `SHOP`; its `MONEY  ¥2480`
 * (two spaces) against the board's one line `$ 2,480`; each row's `¥150` against the board's
 * compound `×3 · $150`; its `x3` owned count against the board's `×`; and the message, the
 * hint and the `✕`, which the board never prints at all. `gapFor` folds case only, so none of
 * those is the board's line. The frame's `SEARCH ITEMS`, its three `filter label`s and its
 * `bag slots` `16/20` have no field to live in: the shipped card has no search field, no chip
 * and no slot counter.
 *
 * No colour is claimed: the card's fills and borders are `shop.css`'s tokens and the item
 * atlas, and the view model carries no colour literal. The board's accent on the active SELL
 * chip is a stylesheet token too (`shop.css`'s `[data-active='true']`), not a view literal.
 *
 * Deterministic and total: no `Rng`, no clock, no DOM and no store — `shopPanelView` is pure
 * and the fixture is a module constant, so the same spec always yields the same view.
 */
export function buildView(spec: ScreenSpec): PanelView {
  const view = shopPanelView(inputFrom(FIXTURE.sell, 'sell'), DESKTOP, NO_ICON);
  return { boxes: boxClaims(view, spec), strings: stringClaims(view, spec), colours: [] };
}

/**
 * Every box the card draws, under **this** frame's name for it and at its viewport rect,
 * claimed only when the frame draws that name within `GAP_TOLERANCE`: the whole card is
 * 102 px higher and 64 px narrower than the board's shell, so nothing is claimed here, and a
 * card that ever lands on the board becomes a claim instead of a silent pass.
 */
function boxClaims(view: ShopPanelView, spec: ScreenSpec): readonly GapBox[] {
  const candidates: readonly Readonly<{ name: string; rect: Rect }>[] = [
    { name: 'shop shell', rect: view.box },
    { name: 'bag panel', rect: at(view.box, view.list.box) },
    { name: 'bag panel highlight', rect: at(view.box, view.highlight) },
    { name: 'tab buy', rect: at(view.box, view.tabs[0].box) },
    { name: 'tab sell', rect: at(view.box, view.tabs[1].box) },
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
 * The copy the card prints, claimed only where it is the board's line: `gapFor` folds case
 * and nothing else, so `x3` is not `×3` and `MONEY  ¥2480` is not `$ 2,480`. A copy fix lands
 * as a claim here instead of passing silently.
 */
function stringClaims(view: ShopPanelView, spec: ScreenSpec): readonly string[] {
  const fold = (line: string): string => line.trim().toUpperCase();
  const printed: readonly string[] = [
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
