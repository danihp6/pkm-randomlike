import fixture from '../../../../design/fixtures/05e-battle-stats.json';
import {
  battleSwitchView,
  fixtureSwitchInput,
  type BattleSwitchView,
  type Rect,
  type Viewport,
} from '../panels/battle-switch/view';
import { GAP_TOLERANCE, type GapBox, type PanelView, type ScreenSpec } from '../specGap';

/**
 * The screen this adapter answers for: the SWITCH window's second state, the one the
 * panel's own `05d` frame never draws.
 */
export const slug = '05e-battle-stats';

const DESKTOP: Viewport = { width: 1280, height: 800 };

type FixtureFile = Readonly<{ switch: unknown }>;

const FIXTURE = fixture as unknown as FixtureFile;

/** The frame's own names for its four party cells, in the order it reads them. */
const SLOT_NAMES: readonly string[] = ['party sel', 'slot tile 2', 'slot tile 3', 'slot tile 4'];

/**
 * The SWITCH window against `05e Battle · stats`, built exactly as the preview builds it —
 * the frame's own fixture at 1280×800, where `fixtureSwitchInput` forces the card to
 * `battleSwitchBox(1280×800)` = `676, 582, 564, 192` — and narrowed to the three facts
 * `gapFor` compares.
 *
 * **No box is claimed**, and the reason is the same one `05d` records: the frame draws the
 * party as two columns of `264 × 70` tiles, the shipped window as `partyGridLayout`'s one
 * six-row list inside the battle menu's card. Every candidate is measured, and every one of
 * them misses by more than `GAP_TOLERANCE`:
 *
 * | frame box | frame rect | shipped rect | delta |
 * | --- | --- | --- | --- |
 * | `party grid group` | `684, 600, 536, 148` | the card `676, 582, 564, 192` | dx −8, dy −18, dw +28, dh +44 |
 * | `battle menu`, `battle menu group` | `664, 544, 576, 216` | the same card | dx +12, dy +38, dw −12, dh −24 |
 * | `party sel` | `684, 600, 264, 70` | `slots[0]` = `760, 606, 452, 18.67` | dx +76, dy +6, dw +188, dh −51 |
 * | `slot tile 2` | `956, 600, 264, 70` | `slots[1]` = `760, 632.67, 452, 18.67` | dx −196, dy +33, dw +188, dh −51 |
 * | `slot tile 3` | `684, 678, 264, 70` | `slots[2]` = `760, 659.33, 452, 18.67` | dx +76, dy −19, dw +188, dh −51 |
 * | `slot tile 4` | `956, 678, 264, 70` | `slots[3]` = `760, 686, 452, 18.67` | dx −196, dy +8, dw +188, dh −51 |
 * | `battle menu highlight` | `676, 556, 552, 1` | `battleSwitch.css`'s card hairline | painted by CSS off the card, never a view field |
 * | `party sel bar` | `688, 608, 3, 54` | `.battle-switch__row--selected` | painted by CSS off `SwitchRowView.selected` |
 * | `portrait CH…`, `hp track …`, `hp fill …`, `status ENV CH` / `status PAR BU` | `696, 613, 44, 44` … | `SwitchRowView.portrait`, `.hp.track`, `.hp.fill`, `.status.box` | card-relative rects inside the row above: the frame insets a 44 px portrait into a 70 px tile, the shipped 14.67 px one into a 18.67 px row |
 *
 * **The stat block is the frame's own, not a gap.** `05e` adds the attack-detail window's
 * second tab — the stats state — and the shipped `BattleSwitchView` has no stats state, so
 * it neither draws these boxes nor prints these lines. The labels and values are text nodes,
 * the rules, tabs and item slots are boxes; all of them are listed here so the next task
 * reads them as the frame's own geometry rather than as missing panel output:
 *
 * | frame box / node | frame rect | characters |
 * | --- | --- | --- |
 * | `stat row label 0` / `stat row value 0` | `694, 450, 200, 15` / `1000, 448, 200, 18` | `ATTACK` / `84` |
 * | `stat row label 1` / `stat row value 1` | `694, 468, 200, 15` / `1000, 466, 200, 18` | `DEFENSE` / `78` |
 * | `stat row label 2` / `stat row value 2` | `694, 486, 200, 15` / `1000, 484, 200, 18` | `SP. ATK` / `109` |
 * | `stat row label 3` / `stat row value 3` | `694, 504, 200, 15` / `1000, 502, 200, 18` | `SP. DEF` / `85` |
 * | `stat row label 4` / `stat row value 4` | `694, 522, 200, 15` / `1000, 520, 200, 18` | `SPEED` / `100` |
 * | `stat row rule 0…4` | `694, 466…538, 506, 1` | — |
 * | `tab stats label` / `tab moves label` | `684, 398, 70, 24` / `762, 398, 76, 24` | `STATS` / `MOVES` |
 * | `detail nature` / `detail ability` / `detail item name` | `694, 426, 180, 12` / `880, 426, 150, 12` / `1066, 428, 110, 12` | `NATURE · ADAMANT` / `ABILITY · BLAZE` / `CHARCOAL` |
 *
 * **The copy it claims** is the four member names the frame spells its `mon name …` nodes
 * with (`CHARIZARD`, `PIKACHU`, `BULBASAUR`, `GASTLY`) and the lead's HP line `98/112`,
 * which the frame carries twice (`player hp text`, `attack power`). **The copy it cannot
 * claim**: the row's own fitted line `CHARIZARD  Lv36`, because the board splits the name
 * and the level into `mon name CH` / `LV 36` (and the shipped line prints `Lv` with no
 * space), the `PAR` and `PSN` marks — the frame has `status PAR BU` as a box and no text
 * node for either — the other three HP readouts, and the ◀ back glyph.
 *
 * `colours: []`: the glass, the bars and the marks are `battleSwitch.css`'s tokens, which
 * `scripts/design/check.mjs` covers.
 */
export function buildView(spec: ScreenSpec): PanelView {
  return buildViewFor(FIXTURE, spec);
}

/**
 * The same claim from any payload: a payload with no `switch` block (or `null`) is an empty
 * claim, never a throw.
 */
export function buildViewFor(payload: unknown, spec: ScreenSpec): PanelView {
  const input = fixtureSwitchInput(payload, DESKTOP);
  if (input === null) return { boxes: [], strings: [], colours: [] };
  const view = battleSwitchView(input);
  return { boxes: boxClaims(view, spec), strings: stringClaims(view, spec), colours: [] };
}

/** Every candidate at its page rect, claimed only where the frame draws that name there. */
function boxClaims(view: BattleSwitchView, spec: ScreenSpec): readonly GapBox[] {
  const candidates: readonly Readonly<{ name: string; rect: Rect }>[] = [
    { name: 'party grid group', rect: view.card },
    { name: 'battle menu', rect: view.card },
    { name: 'battle menu group', rect: view.card },
    ...view.slots.slice(0, SLOT_NAMES.length).map((rect, index) => ({ name: SLOT_NAMES[index]!, rect })),
  ];
  return candidates.flatMap((candidate) => claim(spec, candidate.name, candidate.rect));
}

function claim(spec: ScreenSpec, name: string, shipped: Rect): readonly GapBox[] {
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
 * The copy the card prints — each row's name, its fitted line, its HP readout and its status
 * mark, plus the ◀ — claimed only where the frame carries the same line folded. `gapFor`
 * folds case and trims, and nothing else, so `Lv36` is not `LV 36`, and the `PAR` / `PSN`
 * marks are absent because the frame keeps them as boxes and writes no text node for either.
 */
function stringClaims(view: BattleSwitchView, spec: ScreenSpec): readonly string[] {
  const fold = (line: string): string => line.trim().toUpperCase();
  const printed: readonly string[] = [
    ...view.rows.flatMap((row) => [row.name, row.label.text, row.hpText, row.statusLabel ?? '']),
    view.back.label,
  ];
  const board = new Set(spec.text.map((node) => fold(node.characters)));
  return printed.filter((line) => line !== '' && board.has(fold(line)));
}
