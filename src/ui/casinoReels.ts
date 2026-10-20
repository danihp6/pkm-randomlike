import { CASINO, EGG_ITEM_ID } from '../data/casino';
import type { BandId } from '../data/run';
import { casinoHeldPool, type CasinoOutcome } from './casino';

/**
 * The casino window's **reels** (`docs/maps-spec.md` §7, D33/D47): the card and
 * band geometry, the faces the machine can pay, the three strips a spin turns and
 * the schedule the reveal follows. Pure — no Phaser, no clock, no RNG and no run
 * state — so the window draws what this module computes and every geometry and
 * timing decision is unit-tested headless (`src/ui/README.md` rule 1).
 */

/** The card the machine draws in, and the band the three windows sit in. */
export const CASINO_CARD_W = 460;
export const CASINO_CARD_H = 300;
export const REEL_BAND_LEFT = 146;
export const REEL_BAND_TOP = 72;

/** The three windows: 48 px square, 12 px apart (3 × 48 + 2 × 12 = 168, centred in 460). */
export const REEL_COUNT = 3;
export const REEL_W = 48;
export const REEL_H = 48;
export const REEL_GAP = 12;

/** The reveal: an 800 ms spin, a 160 ms left-to-right stagger, a 100 ms face step. */
export const REEL_SPIN_MS = 800;
export const REEL_STOP_STAGGER_MS = 160;
export const REEL_TICK_MS = 100;

/** The passing faces each strip carries before the outcome face. */
export const REEL_DECOY_COUNT = 5;

export type ReelFace = Readonly<{ kind: 'item'; itemId: string }> | Readonly<{ kind: 'rocket' }>;

export type ReelRect = Readonly<{ x: number; y: number; w: number; h: number }>;

/** The face a booked outcome lands on. */
export function reelFace(outcome: CasinoOutcome): ReelFace {
  if (outcome.kind === 'item') return { kind: 'item', itemId: outcome.itemId };
  if (outcome.kind === 'egg') return { kind: 'item', itemId: EGG_ITEM_ID };
  return { kind: 'rocket' };
}

/**
 * Every face the machine can pay at `band`, in table order, deduplicated: the
 * fixed `item` rows and the Egg where its row sits, then the band's own
 * `casinoHeldPool` (the grouped `'held'` row names no id). It never invents a
 * face the machine cannot pay and never returns the Rocket face.
 */
export function bandFaces(band: BandId): readonly ReelFace[] {
  const ids: string[] = [];
  for (const row of CASINO.prizes[band]) {
    if (row.kind === 'item') {
      const itemId = row.itemId;
      if (itemId === undefined || itemId === '') continue;
      ids.push(itemId);
    } else if (row.kind === 'egg') {
      ids.push(EGG_ITEM_ID);
    }
  }
  ids.push(...casinoHeldPool(band));
  const seen = new Set<string>();
  const faces: ReelFace[] = [];
  for (const itemId of ids) {
    if (seen.has(itemId)) continue;
    seen.add(itemId);
    faces.push({ kind: 'item', itemId });
  }
  return faces;
}

function clampReel(reel: number): number {
  return Math.max(0, Math.min(REEL_COUNT - 1, Math.floor(reel)));
}

/** The face a reel shows at rest, before any spin. */
export function reelRestFace(band: BandId, reel: number): ReelFace {
  const faces = bandFaces(band);
  return faces[clampReel(reel) % faces.length];
}

/** The three strips: each is `REEL_DECOY_COUNT` passing faces then the outcome face. */
export function reelStrips(band: BandId, outcome: CasinoOutcome): readonly (readonly ReelFace[])[] {
  const faces = bandFaces(band);
  const outcomeFace = reelFace(outcome);
  const strips: ReelFace[][] = [];
  for (let reel = 0; reel < REEL_COUNT; reel++) {
    const strip: ReelFace[] = [];
    for (let k = 0; k < REEL_DECOY_COUNT; k++) {
      strip.push(faces[(reel * REEL_DECOY_COUNT + k) % faces.length]);
    }
    strip.push(outcomeFace);
    strips.push(strip);
  }
  return strips;
}

/** When reel `reel` stops: 800, 960, 1 120 ms. */
export function reelStopAt(reel: number): number {
  return REEL_SPIN_MS + clampReel(reel) * REEL_STOP_STAGGER_MS;
}

/** The strip index reel `reel` shows `elapsedMs` after the spin started. */
export function reelFaceIndex(reel: number, elapsedMs: number): number {
  const last = REEL_DECOY_COUNT;
  return Math.min(last, Math.floor((Math.max(0, elapsedMs) * last) / reelStopAt(reel)));
}

/** The three reel windows in screen px, for a card whose top-left is `(cardX, cardY)`. */
export function reelRects(cardX: number, cardY: number): readonly ReelRect[] {
  const rects: ReelRect[] = [];
  for (let reel = 0; reel < REEL_COUNT; reel++) {
    rects.push({
      x: cardX + REEL_BAND_LEFT + reel * (REEL_W + REEL_GAP),
      y: cardY + REEL_BAND_TOP,
      w: REEL_W,
      h: REEL_H,
    });
  }
  return rects;
}
