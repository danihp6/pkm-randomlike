import rewardsFixture from '../../../../design/fixtures/03g-panels-reward-pokemon.json';
import {
  rewardsPanelView,
  type Rect,
  type RewardsInput,
  type RewardsPanelView,
} from '../panels/rewards/view';
import { GAP_TOLERANCE, type GapBox, type PanelView, type ScreenSpec } from '../specGap';

/** The screen this adapter answers for: one slug, one spec, one panel. */
export const slug = '03g-panels-reward-pokemon';

/** The frame's own viewport, where the board's rects are measured. */
const DESKTOP = { width: 1280, height: 800 };

/** One offer as the fixture records it: a Pokémon row carries its label and nothing else. */
type PokemonRow = Readonly<{
  index: number;
  kind: 'pokemon';
  topStat: string;
  nature: string;
  label: string;
}>;

type PokemonBlock = Readonly<{
  title: string;
  choose: string;
  armed: number;
  open: boolean;
  rows: readonly PokemonRow[];
}>;

const FIXTURE = rewardsFixture as unknown as Readonly<{ pokemon: PokemonBlock }>;

/**
 * The card as the running panel builds it from the fixture: the title, the choose line and
 * one row per offer. `rewardsPanelView` writes every row's `box` and `armed` itself and forces
 * `description: ''` / `icon: null` on a `kind: 'pokemon'` row, so those two are placeholders
 * here; `topStat` and `nature` are not read, because the label is the model's own string.
 */
function inputFrom(block: PokemonBlock): RewardsInput {
  return {
    title: block.title,
    choose: block.choose,
    rows: block.rows.map((row) => ({
      index: row.index,
      kind: 'pokemon' as const,
      label: row.label,
      description: '',
      icon: null,
      armed: false,
      box: { x: 0, y: 0, w: 0, h: 0 },
    })),
    armed: block.armed,
    open: block.open,
  };
}

/**
 * The mini-boss reward card's view on its Pokémon half, built exactly as the running panel
 * builds it — the fixture's own `pokemon` block at 1280×800 — and narrowed to the three facts
 * `gapFor` compares against the frame `03g Panels · reward pokemon`. `spec` is read only as a
 * structural selector — is this box in the frame at all, is this line the board's text —
 * never as the answer.
 *
 * **This frame is the shipped card, on its other three rows**, so the card *is* the board's
 * and five boxes are claimed, every delta 0:
 *
 * | frame box | frame rect | shipped | why it is (or is not) claimed |
 * | --- | --- | --- | --- |
 * | `reward panel` | `360, 196, 560, 342` | `view.box` = the same | **claimed**, delta 0: the card *is* the board's card |
 * | `panel highlight` | `372, 208, 536, 1` | `view.highlight` → the same | **claimed**: 12 px inside the card's top edge (`REWARDS_HIGHLIGHT_INSET`, a module-private constant of `panels/rewards/view.ts` — do not import it) |
 * | `row 1`, `row 2`, `row 3` | `380, 274 / 358 / 442, 520, 76` | `view.rows[i].box` → the same | **claimed**: `REWARDS_ROW_TOP` 78 and an 84 px pitch (`REWARDS_ROW_H` 76 + `REWARDS_ROW_GAP` 8) |
 * | `close` (text node) | `876, 206, 24, 24` | `view.close.box` → `876, 206, 24, 24` | a **text node**, not a box: the rect matches to the pixel, and declaring it would report `missing`; claimed as the string `×` |
 * | `panel title` (text node) | `380, 212, 460, 30` | `view.title.box` → the same | a text node: claimed as the string `MINI-BOSS REWARD` |
 * | `choose line` (text node) | `380, 240, 400, 20` | `view.choose.box` → the same | a text node: claimed as the string `Choose one.` |
 * | `option label 1…3` (text nodes) | `396, 304 / 388 / 472, 480, 24` | `view.rows[i].label` | text nodes: claimed as the three `STAT · Nature` strings; the card's label sits at the row's own inset, which no text-node rect is compared against |
 * | `route screenshot`, `scrim` | `0, 0, 1280, 800` | — | the frame's painted scene and its dimming layer: a floating card paints no scrim (`D45`) |
 *
 * There is **no icon row** in that table at all: `03g` draws no `item icon` box, because a
 * Pokémon offer may leak nothing but its label (`panels/rewards/README.md` rule 2). The live
 * card offers **six** rows (three items then three unidentified Pokémon, `src/ui/rewards.ts`'s
 * `rewardRows`) and the panel clips them into the board's three slots (`rewardsRowBand`); the
 * fixture's three Pokémon rows are the board's own last three, so this comparison measures the
 * card on its Pokémon half.
 *
 * Six strings are claimed, in the card's draw order: the title, the choose line, the ✕ and the
 * three labels. `view.rows[i].description` is `''` on every row and the fold drops it, which is
 * the label-only rule made visible. No colour is claimed: the card's fills, strokes and the
 * armed row's accent wash are `rewards.css`'s tokens. It reads no `Rng`, no clock, no DOM and
 * no store — `rewardsPanelView` is pure and the fixture is a module constant — so the same
 * spec always yields the same view.
 */
export function buildView(spec: ScreenSpec): PanelView {
  const view = rewardsPanelView(inputFrom(FIXTURE.pokemon), DESKTOP);
  return { boxes: boxClaims(view, spec), strings: stringClaims(view, spec), colours: [] };
}

/**
 * Every box the card draws, at its viewport rect, claimed only when the frame draws that name
 * at the shipped rect: the board's own five. A row's name is `row ${index + 1}`, which is the
 * frame's own naming, so a renamed box is a `missing` gap instead of a silent pass.
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
 * The copy the card prints, claimed only where `gapFor`'s own fold (trim + upper-case) makes
 * it the board's line, so a copy fix lands as a claim instead of passing silently. The list is
 * a filter, never a literal: a future drift leaves the board's set. A Pokémon row's
 * `description` is `''` and is dropped here, which is the label-only rule made visible.
 */
function stringClaims(view: RewardsPanelView, spec: ScreenSpec): readonly string[] {
  const fold = (line: string): string => line.trim().toUpperCase();
  const printed: readonly string[] = [
    view.title.text,
    view.choose.text,
    view.close.label,
    ...view.rows.flatMap((row) => [row.label, row.description]),
  ];
  const board = new Set(spec.text.map((node) => fold(node.characters)));
  return printed.filter((line) => line !== '' && board.has(fold(line)));
}
