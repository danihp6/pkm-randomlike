import bagFixture from '../../../../design/fixtures/05c-battle-bag.json';
import {
  battleBagBox,
  battleBagView,
  type BattleBagInput,
  type BattleBagView,
  type Viewport,
} from '../panels/battle-bag/view';
import type { PanelView, ScreenSpec } from '../specGap';

/** The screen this adapter answers for: one slug, one spec, one panel. */
export const slug = '05c-battle-bag';

const DESKTOP: Viewport = { width: 1280, height: 800 };

type FixtureFile = Readonly<{ bag: BattleBagInput }>;

const FIXTURE = bagFixture as unknown as FixtureFile;

/**
 * The battle bag's view, built exactly as the running panel builds it — the fixture's own
 * `bag` block with the scene's card, `battleBagBox({ width: 1280, height: 800 })`, not the
 * fixture's `276, 582` one — and narrowed to the three facts `gapFor` compares against
 * frame `05c Battle · bag`.
 *
 * **The frame draws a bigger bag than the card, so no box lands** and the claim is the copy
 * alone. Every rect the view model returns is **card-relative**: the table below translates
 * each one by the card's origin, `676, 582`, before comparing it with the frame's page rect.
 * The delta is `shipped − frame`, per `gapFor`'s own sign.
 *
 * | frame box | frame rect | shipped | delta / why not claimed |
 * | --- | --- | --- | --- |
 * | `battle menu`, `battle menu group` | `664, 544, 576, 216` | `battleBagBox(1280×800)` = `676, 582, 564, 192` | dx +12, dy +38, dw −12, dh −24: both right edges are the window's 40 px margin (1240), and the shipped bottom is the battle menu's shared 774 line while the frame's is 760 |
 * | `battle menu highlight` | `676, 556, 552, 1` | the card's `box-shadow: inset 0 0 0 1px` ring, i.e. `676, 582, 564, 1` | dy +26, dw +12: the highlight is `battleBag.css`'s rule on the card, not a view field |
 * | `menu tab 0…3` | `128 × 30` at `684 / 820 / 956 / 1092, 564` | the card's **two** chips, `tabs[i].box` = card + `(20 + 124 i, 16)`, `120 × 26` = `696 / 820, 598` | tab 0 dx +12, dy +34, dw −8, dh −4; tab 1 dx 0 at a 124 px pitch against the frame's 136, dy +34, dw −8, dh −4; tabs 2 and 3 have no chip at all: the bag paints two pockets in the menu's four-command strip |
 * | `bag search` | `684, 602, 216, 24` | `search.box` = card + `(20, 50, 524, 24)` = `696, 632, 524, 24` | dx +12, dy +30, dw +308, dh 0: the field spans the card's content width, the frame gives 216 of its row to the two filter chips beside it |
 * | `filter consumables`, `filter pokeballs` | `908, 602, 152, 24` / `1068, 602, 152, 24` | the two pockets are the chips above, at `696 / 820, 598`, `120 × 26` | dx −212 / −248, dy −4, dw −32, dh +2: the panel prints its pockets in the menu's tab strip, the frame in the search row, and the chips are 124 px apart against the frame's 160 |
 * | `item tile 1…8` | `128 × 52` at `684 / 820 / 956 / 1092`, rows `636` / `696` | `cells[i].box` = 35 × 35 at a 41 px pitch from `858, 664`, row 2 at `705` | tile 1 dx +174, dy +28, dw −93, dh −17; tiles 4 and 8 sit 111 and 152 px left of the frame's |
 * | `item icon 1…8` | `24 × 24`, centred in the tile at `736 / 872 / 1008 / 1144`, rows `644` / `704` | the atlas's 24 px icon, centred in its 35 px cell | cell 0's icon would land at `863.5, 669.5, 24, 24` — dx +127.5, dy +25.5, dw 0, dh 0 — and the view model carries no icon rect, so no icon is claimed |
 * | `attack detail`, `attack detail group` | `664, 372, 576, 160` | `info.box` = card + `(20, 74 − 87, 320, 87)` = `696, 569, 320, 87` | dx +32, dy +197, dw −256, dh −73: the item card is 320 wide and floats above the grid **inside** the battle menu, 13 px over the card's own top edge, where the frame's detail card is the menu's full width above it |
 * | `attack detail highlight` | `676, 384, 552, 1` | `.battle-bag__info`'s own 1 px border ring, i.e. `696, 569, 320, 1` | dx +20, dy +185, dw −232: a stylesheet ring on the floating card, not a view rect |
 * | `item icon` (the detail card's) | `684, 428, 24, 24` | — | not drawn: `.battle-bag__info` paints text only, and the card around it lands at `696, 569` (dx +12, dy +141) |
 *
 * The rest of the frame is another row's: `battle field`, its 34 `Vector` nodes, both shadows
 * and both sprite arts are the battle canvas's (`D49`), and `foe panel`, `player panel`, their
 * highlights, their hp tracks and fills, the four type chips, `player status ENV`, the three
 * `foe party ball`s and `weather chip` are the battle HUD's plates (`05`/`05a`). The selected
 * stack's line, `696, 746, 524, 20`, and the ◀, `710, 715, 36, 36`, have **no frame box**: the
 * frame prints the stack's name and count in its detail card (`attack name`, `attack pp`) and
 * draws no back control. The fixture's `empty` is `null`, so the panel paints no empty line.
 *
 * **The copy it claims** is the painted lines the frame spells the same way: the two pocket
 * labels `CONSUMIBLES` / `POKEBALLS` (the frame's `filter label`s), the field's placeholder
 * and the quantity badges `×3`, `×2`, `×1`, `×12`, `×5`, `×4` (the frame's `item qty 1…8`).
 * The placeholder is claimed as the **board's** spelling, `SEARCH ITEMS`: the panel prints
 * `search items...`, and `gapFor` folds case and nothing else, so the trailing dots are the
 * panel's own abbreviation of that line and the claim records the board's.
 *
 * **The copy it does not claim**, each recorded rather than dropped: the selected line
 * `Potion x3`, which folds to `POTION X3` while the frame keeps the name and the count in two
 * nodes (`attack name` and `attack pp` `×3`, and `×` is not `x`); the stack names
 * (`Potion`, `Super Potion`, …), which are a cell button's `title`/`aria-label` and not a
 * painted line — the only line the frame spells `POTION` is its `attack name`, the item card's
 * title, which the panel prints as the first of three lines of `info.text`; `info.text`
 * itself, whose three lines fold to neither the frame's two-line `attack description` nor the
 * title alone; and the ◀ glyph, which the frame never prints. The query is empty in this
 * fixture, so the field's value claims nothing.
 *
 * No colour is claimed: the glass, the chip skins and the dim tail outline are
 * `battleBag.css`'s tokens, and the view model carries no colour literal. Reads no battle, no
 * run, no i18n table and no clock — the fixture is a module constant and `battleBagView` is
 * pure, so the same spec always yields the same view.
 */
export function buildView(spec: ScreenSpec): PanelView {
  const view = battleBagView({ ...FIXTURE.bag, card: battleBagBox(DESKTOP) });
  return { boxes: [], strings: stringClaims(view, spec), colours: [] };
}

/** `gapFor`'s fold, so a claim is compared exactly as the gap compares it. */
function fold(line: string): string {
  return line.trim().toUpperCase();
}

/** The panel's ellipsis is its abbreviation of a line, not a different line. */
const ELLIPSIS = '...';

/** The board's text, folded, keeping the frame's own spelling for the claim. */
function boardText(spec: ScreenSpec): Map<string, string> {
  const board = new Map<string, string>();
  for (const node of spec.text) {
    const line = fold(node.characters);
    if (!board.has(line)) board.set(line, node.characters);
  }
  return board;
}

/** The board's line a painted line spells, or null when the frame does not carry it. */
function claimOf(board: Map<string, string>, line: string): string | null {
  const folded = fold(line);
  const exact = board.get(folded);
  if (exact !== undefined) return exact;
  if (!folded.endsWith(ELLIPSIS)) return null;
  return board.get(folded.slice(0, -ELLIPSIS.length)) ?? null;
}

/** The lines the card paints as text, in its draw order. */
function paintedLines(view: BattleBagView): readonly string[] {
  return [
    ...view.tabs.map((tab) => tab.label),
    view.search.placeholder,
    view.search.text,
    ...view.cells.filter((cell) => cell.itemId !== '').map((cell) => `\u00d7${cell.count}`),
    view.empty?.text ?? '',
    view.detail.text,
    view.info?.text ?? '',
    view.back.label,
  ].filter((line) => line !== '');
}

/**
 * The copy the card prints, claimed only where it is the board's line: a line the frame does
 * not carry is left out of the claim (and named in the table above) instead of passing
 * silently, and the claim keeps the board's spelling so `gapFor` reports no string gap.
 */
function stringClaims(view: BattleBagView, spec: ScreenSpec): readonly string[] {
  const board = boardText(spec);
  const claims: string[] = [];
  for (const line of paintedLines(view)) {
    const claim = claimOf(board, line);
    if (claim !== null && !claims.includes(claim)) claims.push(claim);
  }
  return claims;
}
