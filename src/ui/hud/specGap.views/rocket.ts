import rocketFixture from '../../../../design/fixtures/03h-panels-rocket-slots.json';
import { t } from '../../../i18n';
import {
  CASINO_CARD_H,
  CASINO_CARD_W,
  REEL_BAND_LEFT,
  REEL_BAND_TOP,
  REEL_COUNT,
  REEL_GAP,
  REEL_H,
  REEL_W,
  reelRects,
} from '../../casinoReels';
import { GAP_TOLERANCE, type GapBox, type PanelView, type ScreenSpec } from '../specGap';

/** The screen this adapter answers for: one slug, one spec, one panel. */
export const slug = '03h-panels-rocket-slots';

/** The frame's own viewport, where the board's rects are measured. */
const DESKTOP = { width: 1280, height: 800 };

/**
 * The three layout numbers `rocketPanel.ts` keeps private, restated here because the panel
 * imports Phaser and this adapter must stay headless. Each comment names the line it mirrors.
 */
// rocketPanel.ts:63 — the cabinet card's 24 px inner padding.
const CASINO_PAD = 24;
// rocketPanel.ts:64 — the 44 px row pitch under the reel band.
const CASINO_ROW_H = 44;
// rocketPanel.ts:66 — the first row's top in the card: REEL_BAND_TOP + REEL_H + 16 = 136.
const CASINO_ROW_TOP = REEL_BAND_TOP + REEL_H + 16;

type RocketRow = Readonly<{
  index: number;
  kind: 'spin' | 'leave';
  label: string;
  price: number | null;
  enabled: boolean;
}>;

type RocketBlock = Readonly<{
  title: string;
  money: number;
  message: string;
  rows: readonly RocketRow[];
  selected: number;
}>;

const FIXTURE = rocketFixture as unknown as Readonly<{ rocket: RocketBlock }>;

const CARD_X = (DESKTOP.width - CASINO_CARD_W) / 2;
const CARD_Y = (DESKTOP.height - CASINO_CARD_H) / 2;

/** One visible row bar: the 44 px press zone is not drawn, its 38 px highlight is. */
function rowRect(index: number): GapBox {
  return {
    name: `row ${index + 1}`,
    x: CARD_X + CASINO_PAD,
    y: CARD_Y + CASINO_ROW_TOP + index * CASINO_ROW_H,
    w: CASINO_CARD_W - CASINO_PAD * 2,
    h: CASINO_ROW_H - 6,
  };
}

/**
 * The seven boxes the shipped cabinet draws, in `rocketPanel.ts`'s own order and geometry at
 * 1280×800. They are **declared** so a cabinet that ever moved onto the board's rect would be
 * claimed, and the spec-gap comparison gates each one within `GAP_TOLERANCE`; today all seven
 * are outside it, so `buildView` claims none of them.
 */
export const CANDIDATES: readonly GapBox[] = [
  { name: 'casino card', x: CARD_X, y: CARD_Y, w: CASINO_CARD_W, h: CASINO_CARD_H },
  {
    name: 'reel field',
    x: CARD_X + REEL_BAND_LEFT - 8,
    y: CARD_Y + REEL_BAND_TOP - 8,
    w: REEL_COUNT * REEL_W + (REEL_COUNT - 1) * REEL_GAP + 16,
    h: REEL_H + 16,
  },
  ...reelRects(CARD_X, CARD_Y).map((rect, index) => ({ name: `reel ${index + 1}`, ...rect })),
  rowRect(0),
  rowRect(1),
];

/**
 * The slot machine against `03h Panels · rocket slots`, at the desk viewport the frame
 * draws: the cabinet's card, the recessed reel field, its three windows and the two row bars.
 *
 * The machine is Phaser, not Preact (`src/ui/rocketPanel.ts`, the `src/ui/<panel>Panel.ts`
 * half of `design/README.md`'s component check), so this adapter must not import it. It reads
 * the panel's **pure** half `src/ui/casinoReels.ts` and restates the three private layout
 * numbers above, which keeps the module graph free of `phaser` while leaving the panel as the
 * one owner of what it draws.
 *
 * **Seven candidates, none claimed.** The shipped cabinet sits 22 px lower than the board's
 * and is 44 px shorter, so its field and reels are 22 px lower and its rows 24 px higher. The
 * signs are shipped − frame:
 *
 * | frame box | frame rect | shipped (1280×800) | delta |
 * | --- | --- | --- | --- |
 * | `casino card` | `410, 228, 460, 344` | `410, 250, 460, 300` | dy +22, dh −44 |
 * | `reel field` | `548, 336, 184, 64` | `548, 314, 184, 64` | dy −22 |
 * | `reel 1` | `556, 344, 48, 48` | `556, 322, 48, 48` | dy −22 |
 * | `reel 2` | `616, 344, 48, 48` | `616, 322, 48, 48` | dy −22 |
 * | `reel 3` | `676, 344, 48, 48` | `676, 322, 48, 48` | dy −22 |
 * | `row 1` | `434, 410, 412, 38` | `434, 386, 412, 38` | dy −24 |
 * | `row 2` | `434, 454, 412, 38` | `434, 430, 412, 38` | dy −24 |
 *
 * Declared in prose and not claimed:
 *
 * - `card highlight` (`422, 240, 436, 1`): the panel draws its card with `addFrlgWindow`, a
 *   nine-slice with no separate 1 px bar, so the frame's rule has no view box.
 * - `reel face 1 potion` / `2 poke_ball` / `3 oran_berry` (`568/628/688, 356, 24, 24`): the
 *   panel paints each item icon at `REEL_W / ITEM_ICON_SIZE`, i.e. it **fills** the 48 px
 *   window, while the frame draws a 24 px face centred 12 px inside it (dw +24, dh +24). The
 *   fixture's faces are not the frame's three prizes, so only the rect is comparable and it is
 *   not the panel's.
 * - `rocket emblem` (`624, 276, 32, 48`): the panel has no emblem at all — the Rocket face
 *   exists only inside a reel when the booked outcome is the fight.
 * - `route screenshot`, `scrim` (`0, 0, 1280, 800`): the frame's painted scene and its dimming
 *   layer; the machine is a Phaser container with no scrim of its own.
 * - The 44 px press zone (`CASINO_ROW_H`) is not a drawn box: the visible bar is the 38 px
 *   highlight above it.
 *
 * **Exactly two strings are claimed.** The panel prints the fixture's own title, money, spin,
 * leave and message lines; `strings` filters them against the frame's text set (trim +
 * upper-case both sides), never a literal list. `SLOT MACHINE` and `LEAVE` are the board's
 * own, while `MONEY  ¥2480` against the frame's `MONEY  $ 2,480` and `SPIN  ¥300` against
 * `SPIN  $ 300` are the copy deltas this row records. The message line has no frame text node.
 * No colour is claimed: every tone is `frlg.ts`'s token or `src/data/ui/chrome.json`'s, not a
 * view literal.
 *
 * Deterministic and total: no `Rng`, no clock, no DOM, no store, no Phaser — the fixture is a
 * module constant and the geometry is `casinoReels.ts`'s own arithmetic, so the same spec
 * always yields the same view.
 */
export function buildView(spec: ScreenSpec): PanelView {
  const block = FIXTURE.rocket;
  const printed: readonly string[] = [
    t('casino.title'),
    t('casino.money', { amount: block.money }),
    t('casino.spin', { price: block.rows[0]?.price ?? 0 }),
    t('casino.leave'),
    block.message,
  ];
  const fold = (line: string): string => line.trim().toUpperCase();
  const board = new Set(spec.text.map((node) => fold(node.characters)));
  return {
    boxes: CANDIDATES.flatMap((candidate) => claim(spec, candidate)),
    strings: printed.filter((line) => line !== '' && board.has(fold(line))),
    colours: [],
  };
}

/** A candidate is the board's box only when the frame draws its name within tolerance. */
function claim(spec: ScreenSpec, candidate: GapBox): readonly GapBox[] {
  const frame = spec.boxes.find((box) => box.name === candidate.name);
  if (frame === undefined) return [];
  const near =
    Math.abs(candidate.x - frame.x) <= GAP_TOLERANCE &&
    Math.abs(candidate.y - frame.y) <= GAP_TOLERANCE &&
    Math.abs(candidate.w - frame.width) <= GAP_TOLERANCE &&
    Math.abs(candidate.h - frame.height) <= GAP_TOLERANCE;
  return near ? [candidate] : [];
}
