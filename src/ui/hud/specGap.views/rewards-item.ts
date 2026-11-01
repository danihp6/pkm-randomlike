import rewardsFixture from '../../../../design/fixtures/03f-panels-reward-item.json';
import {
  rewardsPanelView,
  type Rect,
  type RewardsInput,
  type RewardsPanelView,
} from '../panels/rewards';
import { GAP_TOLERANCE, type GapBox, type PanelView, type ScreenSpec } from '../specGap';

/** The screen this adapter answers for: one slug, one spec, one panel. */
export const slug = '03f-panels-reward-item';

/** The frame's own viewport, where the board's rects are measured. */
const DESKTOP = { width: 1280, height: 800 };

type ItemRow = Readonly<{
  index: number;
  kind: 'item';
  itemId: string;
  iconFrame: number;
  label: string;
  description: string;
}>;

type ItemBlock = Readonly<{
  title: string;
  choose: string;
  armed: number;
  open: boolean;
  rows: readonly ItemRow[];
}>;

const FIXTURE = rewardsFixture as unknown as Readonly<{ item: ItemBlock }>;

/**
 * The mini-boss reward card's view, built exactly as the running panel builds it — the
 * fixture's own `item` block (title, choose line, nothing armed, three items) at 1280×800 —
 * and narrowed to the three facts `gapFor` compares against the frame
 * `03f Panels · reward item`. `spec` is read only as that structural selector — is this box
 * in the frame at all, is this line the board's — never as the answer.
 *
 * **This is the one row of the wave that claims its frame to the pixel**: the shipped card
 * *is* the board's card, so every delta below is `0`.
 *
 * | frame box | frame rect | shipped | why it is (or is not) claimed |
 * | --- | --- | --- | --- |
 * | `reward panel` | `360, 196, 560, 342` | `view.box` = the same | **claimed**, delta 0: the card *is* the board's card |
 * | `panel highlight` | `372, 208, 536, 1` | `view.highlight` → the same | **claimed**: 12 px inside the card's top edge (`REWARDS_HIGHLIGHT_INSET`, a module-private constant of `panels/rewards/view.ts`) |
 * | `row 1`, `row 2`, `row 3` | `380, 274 / 358 / 442, 520, 76` | `view.rows[i].box` → the same | **claimed**: `REWARDS_ROW_TOP` 78 and an 84 px pitch (`REWARDS_ROW_H` 76 + `REWARDS_ROW_GAP` 8) |
 * | `item icon 1…3` | `394, 288 / 372 / 456, 24, 24` | — | **not claimable**: the view's `row.icon` is a CSS atlas cell (`{ url, size, x, y }`), not a rect, and `rewards.css` places it; there is no box to name |
 * | `close` (text node) | `876, 206, 24, 24` | `view.close.box` → the same | a **text node**, not a box: the rect matches to the pixel, and declaring it would report `missing`; claimed as the string `×` |
 * | `panel title` (text node) | `380, 212, 460, 30` | `view.title.box` → the same | a text node: claimed as the string `MINI-BOSS REWARD` |
 * | `choose line` (text node) | `380, 240, 400, 20` | `view.choose.box` → the same | a text node: claimed as the string `Choose one.` |
 * | `route screenshot`, `scrim` | `0, 0, 1280, 800` | — | the frame's painted scene and its dimming layer: a floating card paints no scrim (`D45`) |
 *
 * And the copy it prints — `MINI-BOSS REWARD`, `Choose one.`, `×`, then each item's label and
 * description — is all nine of the board's own lines after `gapFor`'s fold. The live card of
 * this panel offers **six** rows (three items then three unidentified Pokémon, `rewardRows`
 * in `src/ui/rewards.ts`) and the panel clips them into the board's three slots
 * (`rewardsRowBand`, `panels/rewards/README.md` rule 4); the fixture's three item rows are the
 * board's own, so the first three slots are what this comparison measures.
 *
 * No colour is claimed: the card's fills, strokes and the armed row's accent wash are
 * `rewards.css`'s tokens, and the view model carries no colour literal.
 */
export function buildView(spec: ScreenSpec): PanelView {
  const view = rewardsPanelView(inputFrom(FIXTURE.item), DESKTOP);
  return { boxes: boxClaims(view, spec), strings: stringClaims(view, spec), colours: [] };
}

/**
 * The fixture's `item` block as the scene module's `RewardsInput`: `rewardsPanelView` writes
 * every row's `box` and `armed` itself, so the values handed in are placeholders, and
 * `icon: null` is the same stub `specGap.views/bag.ts` sets (an atlas URL is a runtime
 * concern, and no box and no string depends on it).
 */
function inputFrom(block: ItemBlock): RewardsInput {
  return {
    title: block.title,
    choose: block.choose,
    rows: block.rows.map((row) => ({
      index: row.index,
      kind: 'item' as const,
      label: row.label,
      description: row.description,
      icon: null,
      armed: false,
      box: { x: 0, y: 0, w: 0, h: 0 },
    })),
    armed: block.armed,
    open: block.open,
  };
}

/**
 * Every box the card draws at the board's rect, claimed only when the shipped rect is within
 * `GAP_TOLERANCE` of the frame's box of that name: a card that drifts off the board stops
 * claiming instead of passing silently. A row's name is `row ${row.index + 1}`, which is the
 * frame's own naming because the fixture's indices are `0, 1, 2`.
 */
function boxClaims(view: RewardsPanelView, spec: ScreenSpec): readonly GapBox[] {
  const candidates: readonly Readonly<{ name: string; rect: Rect }>[] = [
    { name: 'reward panel', rect: view.box },
    { name: 'panel highlight', rect: at(view.box, view.highlight) },
    ...view.rows.map((row) => ({ name: `row ${row.index + 1}`, rect: at(view.box, row.box) })),
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
 * The nine lines the card prints, claimed only where `gapFor`'s own fold (trim + upper-case)
 * makes it the board's: `MINI-BOSS REWARD`, `Choose one.`, the drawn `×`, then each row's
 * label and description. Written as a filter, not a literal, so a copy drift leaves the
 * board's set instead of passing silently.
 */
function stringClaims(view: RewardsPanelView, spec: ScreenSpec): readonly string[] {
  const fold = (line: string): string => line.trim().toUpperCase();
  const board = new Set(spec.text.map((node) => fold(node.characters)));
  const printed = [
    view.title.text,
    view.choose.text,
    view.close.label,
    ...view.rows.flatMap((row) => [row.label, row.description]),
  ].filter((line) => line !== '');
  return printed.filter((line) => board.has(fold(line)));
}
