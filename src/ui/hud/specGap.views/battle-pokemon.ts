import fixture from '../../../../design/fixtures/05d-battle-pokemon.json';
import {
  battleSwitchView,
  fixtureSwitchInput,
  type BattleSwitchView,
  type Rect,
  type Viewport,
} from '../panels/battle-switch/view';
import { GAP_TOLERANCE, type GapBox, type PanelView, type ScreenSpec } from '../specGap';

/** The screen this adapter answers for: one slug, one spec, one panel. */
export const slug = '05d-battle-pokemon';

const DESKTOP: Viewport = { width: 1280, height: 800 };

type FixtureFile = Readonly<{ switch: unknown }>;

const FIXTURE = fixture as unknown as FixtureFile;

/**
 * The frame's own names for its four party cells, in the order it reads them: the two
 * columns of the 2 × 2 grid (`party sel` is the selected cell, `slot tile 2…4` the rest).
 * The shipped window is one six-row list, so only its first four rows have a counterpart.
 */
const SLOT_NAMES: readonly string[] = ['party sel', 'slot tile 2', 'slot tile 3', 'slot tile 4'];

/**
 * The battle's SWITCH window against `05d Battle · pokemon`, built exactly as the preview
 * builds it — the frame's own fixture at 1280×800, where `fixtureSwitchInput` forces the card
 * to `battleSwitchBox(1280×800)` — and narrowed to the three facts `gapFor` compares.
 *
 * **No box is claimed**: the frame draws a two-column grid of `264 × 70` tiles inside
 * `party grid group (684, 600, 536, 148)`, while the shipped window is `partyGridLayout`'s
 * six-row list inside the battle menu's card `676, 582, 564, 192`. Every candidate is that
 * far off, so the honest claim is the strings below plus this table.
 *
 * | frame box | frame rect | shipped | why not claimed |
 * | --- | --- | --- | --- |
 * | `party grid group` | `684, 600, 536, 148` | the card `battleSwitchBox(DESKTOP)` = `676, 582, 564, 192` | dx −8, dy −18, dw +28, dh +44: the shipped window is the battle menu's card, and the grid's bounding box is a different shape |
 * | `battle menu` | `664, 544, 576, 216` | the same card `676, 582, 564, 192` | dx +12, dy +38, dw −12, dh −24: the card is the menu's bottom box; the frame's menu also spans its tab row |
 * | `party sel`, `slot tile 2` | `684, 600, 264, 70` / `956, 600, 264, 70` | `partyGridLayout`'s row 0 = `760, 606, 452, 19` (112/6 tall, a 26.67 pitch) | the frame draws two columns of 264 × 70 tiles, the shipped grid one six-row list 452 px wide: row 0 is dy +6, dw +188, dh −51 from `party sel` |
 * | `slot tile 3`, `slot tile 4` | `684, 678, 264, 70` / `956, 678, 264, 70` | rows 1 and 2 = `760, 633, 452, 19` / `760, 659, 452, 19` | the frame's second row of tiles starts 72 px down its window; the shipped rows step 26.67 px |
 * | `party sel bar` | `688, 608, 3, 54` | `battleSwitch.css`'s selected accent on `.battle-switch__row--selected` | painted by CSS off `SwitchRowView.selected`, never a view field |
 * | `portrait CH…GA`, `hp track CH…GA`, `hp fill CH…GA`, `status ENV CH/PAR` | `696, 613, 44, 44` … | `SwitchRowView.portrait`, `.hp.track`, `.hp.fill`, `.status.box` | they are card-relative rects inside the row above; the frame insets a 44 px portrait into a 70 px tile, the shipped 14.67 px one into a 18.67 px row |
 * | the battle behind the window: `battle menu group`, `menu tab 0…3`, `mon move cell 1…4`, `attack detail`, the two HP plates, the ball rows, `foe/player sprite art`, `weather chip`, `Vector` | — | — | `battle-hp`'s, `battle-moves`' and the canvas's (`D49`) |
 *
 * **The copy it claims** is the four member names the frame spells its `mon name …` nodes with
 * (`CHARIZARD`, `PIKACHU`, `BULBASAUR`, `GASTLY`) and the lead's HP line `98/112`, which the
 * frame carries twice (`player hp text`, `attack power`). **The copy it cannot claim**: the
 * row's own fitted line `CHARIZARD  Lv36`, because the board splits the name and the level into
 * `mon name CH` / `LV 36` (and the shipped one prints `Lv` with no space), the `PAR` and `PSN`
 * marks, the fainted row's `0/78`, and the ◀ back glyph — none of them is a text node of the
 * frame.
 *
 * `colours: []`: the glass, the row skins, the three HP fills and the status mark are
 * `battleSwitch.css`'s tokens, which `scripts/design/check.mjs` covers.
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
 * folds case and trims, and nothing else, so `Lv36` is not `LV 36`.
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
