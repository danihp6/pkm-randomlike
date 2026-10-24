import { getSpecies } from '../../../../data/dex';
import { encodeRunShare, type RunMode } from '../../../../engine/run';
import { t } from '../../../../i18n';

/** The desk frame (`04`) and the phone one (`m04`); both draw this panel. */
export const STARTER_SLUG = '04-starter-pick' as const;
export const STARTER_SLUGS = [STARTER_SLUG, 'm04-starter-pick'] as const;
export type StarterSlug = (typeof STARTER_SLUGS)[number];

/** The breakpoint the board's two frames switch at; the stylesheet uses the same 600px. */
export const STARTER_NARROW_QUERY = '(max-width: 600px)';

/** One card of the offer: the species and everything the card prints about it. */
export type StarterCardView = Readonly<{
  speciesId: string;
  num: number;
  name: string;
  types: readonly string[];
}>;

export type StarterView = Readonly<{
  title: string;
  /** Exactly the pool's order; the first card is the pool's first draw. */
  cards: readonly StarterCardView[];
  /** The cursor's card, clamped into `cards`. */
  selected: number;
  /** The frame's `SHARE: …` line, already localised. */
  share: string;
  /** The footer line, already localised. */
  hint: string;
}>;

export type StarterViewport = 'desktop' | 'narrow';

export type StarterRect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type StarterOffset = Readonly<{ dx: number; dy: number; w: number; h: number }>;

export type StarterBoard = Readonly<{
  title: StarterRect;
  /** `x`/`y` are the first card's corner, `pitch` the step to the next one. */
  card: Readonly<{ x: number; y: number; w: number; h: number; pitch: number }>;
  /** A card's name box, from the card's corner. */
  name: StarterOffset;
  /**
   * A card's type badges: `dx`/`dy` from the card's corner, each badge `size`
   * square, `gap` between two. The desk draws the row centred on the card (so
   * `dx` is where a two-badge row starts) and the phone anchors it at `dx`.
   */
  badge: Readonly<{ dx: number; dy: number; size: number; gap: number }>;
  share: StarterRect;
  hint: StarterRect;
}>;

/** The desk board's rects (`04`), page coordinates at 1280×800. */
export const STARTER_BOARD: StarterBoard = {
  title: { x: 240, y: 26, w: 800, h: 40 },
  card: { x: 218, y: 176, w: 260, h: 320, pitch: 292 },
  name: { dx: 20, dy: 199, w: 220, h: 30 },
  badge: { dx: 100, dy: 246, size: 24, gap: 12 },
  share: { x: 240, y: 688, w: 800, h: 18 },
  hint: { x: 480, y: 716, w: 320, h: 12 },
};

/**
 * The phone board's rects (`m04`), page coordinates at 390×844. The phone frame
 * prints each name in its own box, so `name.w` is the room the name has, not a
 * measured width; its duplicate type badge sits on the first one, so the phone
 * keeps the desk's 12 px gap.
 */
export const STARTER_BOARD_NARROW: StarterBoard = {
  title: { x: 55, y: 58, w: 279, h: 23 },
  card: { x: 25, y: 243, w: 340, h: 104, pitch: 116 },
  name: { dx: 116, dy: 24, w: 208, h: 15 },
  badge: { dx: 116, dy: 64, size: 24, gap: 12 },
  share: { x: 117, y: 740, w: 155, h: 12 },
  hint: { x: 138, y: 788, w: 113, h: 12 },
};

/** Both boards' measured rects, for the fixture test and the diff. */
export function starterBoard(viewport: StarterViewport): StarterBoard {
  return viewport === 'narrow' ? STARTER_BOARD_NARROW : STARTER_BOARD;
}

function clampIndex(value: number, length: number): number {
  const last = Math.max(0, length - 1);
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(0, Math.trunc(value)), last);
}

function cardView(speciesId: string): StarterCardView {
  const species = getSpecies(speciesId);
  return {
    speciesId,
    num: species?.num ?? 0,
    name: species?.name ?? speciesId,
    types: species?.types ?? [],
  };
}

/** Live: the pool's species, the cursor, the share string and the footer copy. */
export function liveStarterView(
  pool: readonly string[],
  selected: number,
  seed: string,
  mode: RunMode,
  hint: string,
): StarterView {
  const cards = pool.map(cardView);
  return {
    title: t('starter.title'),
    cards,
    selected: clampIndex(selected, cards.length),
    share: t('starter.share', { share: encodeRunShare({ seed, mode }) }),
    hint,
  };
}

type PlainRecord = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isTypeList(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function fixtureCard(value: unknown): StarterCardView | null {
  if (!isPlainObject(value)) return null;
  const { speciesId, num, name, types } = value;
  if (!isNonEmpty(speciesId) || !isNonEmpty(name)) return null;
  if (typeof num !== 'number' || !Number.isInteger(num) || num < 0) return null;
  if (!isTypeList(types)) return null;
  return { speciesId, num, name, types: [...types] };
}

/** One card per entry, at least one; anything else is null. */
function fixtureCards(value: unknown): readonly StarterCardView[] | null {
  if (!Array.isArray(value) || value.length < 1) return null;
  const cards: StarterCardView[] = [];
  for (const entry of value) {
    const card = fixtureCard(entry);
    if (card === null) return null;
    cards.push(card);
  }
  return cards;
}

/**
 * The frame's own payload, or null when it is not one this panel can draw. The
 * panel reads `starter` alone: the snapshot's `state` is the HUD layer's, and the
 * fixture store has already refused a file whose state is not a `HudState`.
 */
export function fixtureStarterView(payload: unknown): StarterView | null {
  if (!isPlainObject(payload)) return null;
  const starter = payload.starter;
  if (!isPlainObject(starter)) return null;

  const { title, cards: rawCards, selected, share, hint } = starter;
  if (!isNonEmpty(title) || !isNonEmpty(share) || !isNonEmpty(hint)) return null;

  const cards = fixtureCards(rawCards);
  if (cards === null) return null;
  if (typeof selected !== 'number' || !Number.isInteger(selected)) return null;
  if (selected < 0 || selected >= cards.length) return null;

  return { title, cards, selected, share, hint };
}
