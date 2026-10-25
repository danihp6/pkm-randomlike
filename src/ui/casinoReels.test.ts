import { describe, expect, it } from 'vitest';
import { CASINO, EGG_ITEM_ID } from '../data/casino';
import { itemIconFrame } from '../data/itemIcons';
import { getItem } from '../data/items';
import { LEVEL_BANDS, type BandId } from '../data/run';
import type { CasinoOutcome } from './casino';
import {
  CASINO_CARD_H,
  CASINO_CARD_W,
  REEL_BAND_LEFT,
  REEL_BAND_TOP,
  REEL_COUNT,
  REEL_DECOY_COUNT,
  REEL_GAP,
  REEL_H,
  REEL_SPIN_MS,
  REEL_STOP_STAGGER_MS,
  REEL_TICK_MS,
  REEL_W,
  bandFaces,
  reelFace,
  reelFaceIndex,
  reelRestFace,
  reelRects,
  reelStopAt,
  reelStrips,
  type ReelFace,
} from './casinoReels';

/**
 * The casino window's reels pinned headless: the card and window geometry, every
 * band's payable faces in table order, the three strips a spin turns and the
 * schedule its reveal follows. None of it reads a clock or the run.
 */

const BANDS: readonly BandId[] = LEVEL_BANDS.map((band) => band.id);

const ITEM = (itemId: string): ReelFace => ({ kind: 'item', itemId });
const ROCKET: ReelFace = { kind: 'rocket' };

/** The exact faces each band pays, in `CASINO.prizes` order then its held pool. */
const FACES: Readonly<Record<BandId, readonly string[]>> = {
  early: [
    'potion',
    'pokeball',
    'oranberry',
    'egg',
    'charcoal',
    'mysticwater',
    'widelens',
    'muscleband',
    'wiseglasses',
    'ironball',
    'laggingtail',
  ],
  low: [
    'superpotion',
    'greatball',
    'oranberry',
    'nugget',
    'egg',
    'charcoal',
    'mysticwater',
    'widelens',
    'muscleband',
    'wiseglasses',
    'ironball',
    'laggingtail',
  ],
  mid: [
    'hyperpotion',
    'greatball',
    'nugget',
    'egg',
    'charcoal',
    'mysticwater',
    'widelens',
    'muscleband',
    'wiseglasses',
    'ironball',
    'laggingtail',
  ],
  high: [
    'hyperpotion',
    'ultraball',
    'nugget',
    'egg',
    'miracleseed',
    'magnet',
    'expertbelt',
    'scopelens',
    'razorclaw',
  ],
  late: [
    'fullrestore',
    'ultraball',
    'nugget',
    'egg',
    'bindingband',
    'leftovers',
    'blackglasses',
    'spelltag',
    'choiceband',
    'choicespecs',
    'choicescarf',
    'lifeorb',
    'focusband',
    'flameorb',
    'toxicorb',
  ],
  end: [
    'fullrestore',
    'ultraball',
    'nugget',
    'egg',
    'leftovers',
    'dragonfang',
    'metalcoat',
    'sharpbeak',
    'choiceband',
    'choicespecs',
    'choicescarf',
    'lifeorb',
    'focusband',
    'flameorb',
    'toxicorb',
  ],
};

/** The three outcome kinds a spin can book. */
const OUTCOMES: readonly CasinoOutcome[] = [
  { kind: 'item', itemId: 'nugget' },
  { kind: 'egg' },
  { kind: 'battle' },
];

function faceId(face: ReelFace): string {
  return face.kind === 'item' ? face.itemId : 'rocket';
}

describe('the casino window geometry', () => {
  it('pins the card, the band, the windows and the reveal schedule', () => {
    expect(CASINO_CARD_W).toBe(460);
    expect(CASINO_CARD_H).toBe(300);
    expect(REEL_BAND_LEFT).toBe(146);
    expect(REEL_BAND_TOP).toBe(72);
    expect(REEL_COUNT).toBe(3);
    expect(REEL_W).toBe(48);
    expect(REEL_H).toBe(48);
    expect(REEL_GAP).toBe(12);
    expect(REEL_SPIN_MS).toBe(800);
    expect(REEL_STOP_STAGGER_MS).toBe(160);
    expect(REEL_TICK_MS).toBe(100);
    expect(REEL_DECOY_COUNT).toBe(5);
    // Three 48 px windows and two 12 px gaps fill 168 px of the 460 px card.
    expect(REEL_COUNT * REEL_W + (REEL_COUNT - 1) * REEL_GAP).toBe(168);
  });

  it('places the three windows inside a 460 × 300 card centred at (410, 250)', () => {
    expect(reelRects(410, 250)).toEqual([
      { x: 410 + REEL_BAND_LEFT, y: 250 + REEL_BAND_TOP, w: 48, h: 48 },
      { x: 410 + REEL_BAND_LEFT + 60, y: 250 + REEL_BAND_TOP, w: 48, h: 48 },
      { x: 410 + REEL_BAND_LEFT + 120, y: 250 + REEL_BAND_TOP, w: 48, h: 48 },
    ]);
    expect(reelRects(410, 250)).toEqual([
      { x: 556, y: 322, w: 48, h: 48 },
      { x: 616, y: 322, w: 48, h: 48 },
      { x: 676, y: 322, w: 48, h: 48 },
    ]);
  });

  it('stops the reels left to right at 800, 960 and 1 120 ms', () => {
    expect([reelStopAt(0), reelStopAt(1), reelStopAt(2)]).toEqual([800, 960, 1120]);
    // The clamp keeps a stray index on the last window, never a phantom fourth reel.
    expect([reelStopAt(-4), reelStopAt(9)]).toEqual([800, 1120]);
  });
});

describe('reelFace', () => {
  it('lands an item on that id, the Egg on the Egg item and the fight on the Rocket', () => {
    expect(reelFace({ kind: 'item', itemId: 'nugget' })).toEqual(ITEM('nugget'));
    expect(reelFace({ kind: 'egg' })).toEqual(ITEM(EGG_ITEM_ID));
    expect(reelFace({ kind: 'battle' })).toEqual(ROCKET);
  });
});

describe('bandFaces', () => {
  it('pays every band exactly its table rows, the Egg where it sits, then its held pool', () => {
    for (const band of BANDS) {
      expect(bandFaces(band).map(faceId), band).toEqual(FACES[band]);
    }
  });

  it('pins the early band as the eleven ids the window shows', () => {
    expect(bandFaces('early').map(faceId)).toEqual([
      'potion',
      'pokeball',
      'oranberry',
      'egg',
      'charcoal',
      'mysticwater',
      'widelens',
      'muscleband',
      'wiseglasses',
      'ironball',
      'laggingtail',
    ]);
  });

  it('never invents a face, deduplicates and stays non-empty on every band', () => {
    for (const band of BANDS) {
      const faces = bandFaces(band);
      expect(faces.length, band).toBeGreaterThan(0);
      expect(new Set(faces.map(faceId)).size, band).toBe(faces.length);
      expect(
        faces.some((face) => face.kind === 'rocket'),
        band,
      ).toBe(false);
      for (const face of faces) {
        expect(face.kind, band).toBe('item');
        if (face.kind !== 'item') continue;
        expect(getItem(face.itemId), `${band} ${face.itemId}`).toBeDefined();
        expect(itemIconFrame(face.itemId), `${band} ${face.itemId}`).not.toBeNull();
      }
      // Every fixed item row of the table is reachable from the faces.
      for (const row of CASINO.prizes[band]) {
        if (row.kind === 'item' && row.itemId) expect(faces.map(faceId), band).toContain(row.itemId);
      }
    }
  });
});

describe('reelRestFace', () => {
  it('shows the band’s faces in order and clamps a stray reel', () => {
    const faces = bandFaces('early');
    for (let reel = 0; reel < REEL_COUNT; reel++) {
      expect(reelRestFace('early', reel)).toEqual(faces[reel]);
    }
    expect(reelRestFace('early', -1)).toEqual(faces[0]);
    expect(reelRestFace('early', 7)).toEqual(faces[REEL_COUNT - 1]);
    expect(reelRestFace('late', 9)).toEqual(bandFaces('late')[REEL_COUNT - 1]);
  });
});

describe('reelStrips', () => {
  it('builds three decoy strips ending on the booked face', () => {
    for (const band of BANDS) {
      const faces = bandFaces(band);
      for (const outcome of OUTCOMES) {
        const strips = reelStrips(band, outcome);
        const landing = reelFace(outcome);
        expect(strips.length, `${band} ${outcome.kind}`).toBe(REEL_COUNT);
        strips.forEach((strip, reel) => {
          expect(strip.length, `${band} ${outcome.kind} ${reel}`).toBe(REEL_DECOY_COUNT + 1);
          expect(strip[strip.length - 1], `${band} ${outcome.kind} ${reel}`).toEqual(landing);
          for (const face of strip.slice(0, -1)) {
            expect(faces, `${band} ${outcome.kind} ${reel}`).toContainEqual(face);
          }
          // The decoys walk the band's own faces from this reel's offset.
          for (let k = 0; k < REEL_DECOY_COUNT; k++) {
            expect(strip[k]).toEqual(faces[(reel * REEL_DECOY_COUNT + k) % faces.length]);
          }
        });
      }
    }
  });

  it('reaches the Rocket face only as the last face of a fight', () => {
    for (const band of BANDS) {
      for (const outcome of OUTCOMES) {
        const strips = reelStrips(band, outcome);
        strips.forEach((strip) => {
          strip.forEach((face, index) => {
            const isLast = index === strip.length - 1;
            if (face.kind === 'rocket') {
              expect(outcome.kind, band).toBe('battle');
              expect(isLast, band).toBe(true);
            }
            if (isLast) expect(face).toEqual(reelFace(outcome));
          });
        });
      }
      expect(
        reelStrips(band, { kind: 'item', itemId: EGG_ITEM_ID })
          .flat()
          .some((face) => face.kind === 'rocket'),
      ).toBe(false);
    }
  });
});

describe('reelFaceIndex', () => {
  it('starts on the first face and lands on the outcome at the stop', () => {
    for (let reel = 0; reel < REEL_COUNT; reel++) {
      expect(reelFaceIndex(reel, 0), `reel ${reel}`).toBe(0);
      expect(reelFaceIndex(reel, -500), `reel ${reel}`).toBe(0);
      expect(reelFaceIndex(reel, reelStopAt(reel)), `reel ${reel}`).toBe(REEL_DECOY_COUNT);
      expect(reelFaceIndex(reel, 5_000), `reel ${reel}`).toBe(REEL_DECOY_COUNT);
    }
  });

  it('never runs backwards over the reveal and never passes the last face', () => {
    for (let reel = 0; reel < REEL_COUNT; reel++) {
      let previous = -1;
      for (let elapsed = 0; elapsed <= 1_200; elapsed += 100) {
        const index = reelFaceIndex(reel, elapsed);
        expect(index, `reel ${reel} at ${elapsed}`).toBeGreaterThanOrEqual(previous);
        expect(index, `reel ${reel} at ${elapsed}`).toBeLessThanOrEqual(REEL_DECOY_COUNT);
        expect(index, `reel ${reel} at ${elapsed}`).toBeGreaterThanOrEqual(0);
        previous = index;
      }
      expect(previous).toBe(REEL_DECOY_COUNT);
    }
  });

  it('steps one face per tick in the middle of the spin', () => {
    expect(reelFaceIndex(0, 400)).toBe(2);
    expect(reelFaceIndex(0, 1_120)).toBe(REEL_DECOY_COUNT);
    expect(reelFaceIndex(2, 1_120)).toBe(REEL_DECOY_COUNT);
  });
});
