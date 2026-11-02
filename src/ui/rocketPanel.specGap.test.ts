import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import fixture from '../../design/fixtures/03h-panels-rocket-slots.json';
import screenSpec from '../../design/screens/03h-panels-rocket-slots.json';
import { t } from '../i18n';
import { CASINO_CARD_H, CASINO_CARD_W, REEL_COUNT, REEL_H, REEL_W } from './casinoReels';
import {
  GAP_TOLERANCE,
  gapFor,
  gapIsEmpty,
  type GapBox,
  type ScreenSpec,
  type SpecBox,
} from './hud/specGap';
import { CANDIDATES, buildView, slug } from './hud/specGap.views/rocket';

/**
 * The `03h Panels · rocket slots` frame measured against the slot machine's own geometry:
 * the adapter that answers for this slug, the seven candidates it declares and cannot claim,
 * the two lines it prints as the board does and the copy deltas it records.
 */

const SPEC = screenSpec as ScreenSpec;

const DESKTOP = { width: 1280, height: 800 };

type FrameText = Readonly<{ name: string; characters: string }>;

const TEXT = screenSpec.text as unknown as readonly FrameText[];

const fold = (line: string): string => line.trim().toUpperCase();

const textOf = (name: string): string => TEXT.find((node) => node.name === name)?.characters ?? '';

const frameBox = (name: string): SpecBox => {
  const box = SPEC.boxes.find((entry) => entry.name === name);
  if (box === undefined) throw new Error(`the frame draws no box named "${name}"`);
  return box;
};

/** The seven rects the declared candidates must be, pinned as literals. */
const SHIPPED: readonly GapBox[] = [
  { name: 'casino card', x: 410, y: 250, w: 460, h: 300 },
  { name: 'reel field', x: 548, y: 314, w: 184, h: 64 },
  { name: 'reel 1', x: 556, y: 322, w: 48, h: 48 },
  { name: 'reel 2', x: 616, y: 322, w: 48, h: 48 },
  { name: 'reel 3', x: 676, y: 322, w: 48, h: 48 },
  { name: 'row 1', x: 434, y: 386, w: 412, h: 38 },
  { name: 'row 2', x: 434, y: 430, w: 412, h: 38 },
];

type Delta = Readonly<{ name: string; dx: number; dy: number; dw: number; dh: number }>;

const deltaOf = (candidate: GapBox): Delta => {
  const frame = frameBox(candidate.name);
  return {
    name: candidate.name,
    dx: candidate.x - frame.x,
    dy: candidate.y - frame.y,
    dw: candidate.w - frame.width,
    dh: candidate.h - frame.height,
  };
};

const DELTAS: readonly Delta[] = [
  { name: 'casino card', dx: 0, dy: 22, dw: 0, dh: -44 },
  { name: 'reel field', dx: 0, dy: -22, dw: 0, dh: 0 },
  { name: 'reel 1', dx: 0, dy: -22, dw: 0, dh: 0 },
  { name: 'reel 2', dx: 0, dy: -22, dw: 0, dh: 0 },
  { name: 'reel 3', dx: 0, dy: -22, dw: 0, dh: 0 },
  { name: 'row 1', dx: 0, dy: -24, dw: 0, dh: 0 },
  { name: 'row 2', dx: 0, dy: -24, dw: 0, dh: 0 },
];

describe('the 03h adapter', () => {
  it('answers for the board frame it is named after', () => {
    expect(slug).toBe('03h-panels-rocket-slots');
    expect(SPEC.slug).toBe(slug);
    expect(SPEC.boxes).toHaveLength(14);
    expect(TEXT).toHaveLength(4);
    expect(SPEC.colours).toHaveLength(11);
  });

  it('declares seven candidates and claims none of them', () => {
    expect(CANDIDATES).toStrictEqual(SHIPPED);
    expect(CANDIDATES).toHaveLength(7);
    expect(buildView(SPEC)).toStrictEqual({
      boxes: [],
      strings: ['SLOT MACHINE', 'LEAVE'],
      colours: [],
    });
  });

  it('reports an empty gap against its own spec', () => {
    expect(gapFor(buildView(SPEC), SPEC)).toStrictEqual({
      missing: [],
      moved: [],
      strings: [],
      colours: [],
    });
    expect(gapIsEmpty(gapFor(buildView(SPEC), SPEC))).toBe(true);
  });

  it('builds the same view twice: no clock, no rng, no store', () => {
    expect(buildView(SPEC)).toStrictEqual(buildView(SPEC));
  });

  it('never imports the panel or Phaser: its whole import list is pinned', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./hud/specGap.views/rocket.ts', import.meta.url)),
      'utf8',
    );
    const imports = [...source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1]);
    expect(imports).toStrictEqual([
      '../../../../design/fixtures/03h-panels-rocket-slots.json',
      '../../../i18n',
      '../../casinoReels',
      '../specGap',
    ]);
    for (const specifier of imports) {
      expect(specifier).not.toMatch(/phaser/);
      expect(specifier).not.toMatch(/rocketPanel/);
    }
  });
});

describe('the seven declared candidates', () => {
  it('draws the card at 410, 250, 460, 300 from the reels’ own constants', () => {
    expect([CASINO_CARD_W, CASINO_CARD_H]).toStrictEqual([460, 300]);
    expect([DESKTOP.width, DESKTOP.height]).toStrictEqual([1280, 800]);
    const card = CANDIDATES[0]!;
    expect(card).toStrictEqual({
      name: 'casino card',
      x: (1280 - CASINO_CARD_W) / 2,
      y: (800 - CASINO_CARD_H) / 2,
      w: CASINO_CARD_W,
      h: CASINO_CARD_H,
    });
  });

  it('draws the field 548, 314, 184, 64 and the three 48 px windows 22 px above the frame', () => {
    expect([REEL_COUNT, REEL_W, REEL_H]).toStrictEqual([3, 48, 48]);
    expect(CANDIDATES.slice(1, 5)).toStrictEqual(SHIPPED.slice(1, 5));
  });

  it('draws two 412 × 38 row bars 24 px above the frame’s own rows', () => {
    expect(CANDIDATES.slice(5)).toStrictEqual(SHIPPED.slice(5));
    expect(CANDIDATES.slice(5).every((row) => row.h === 38 && row.w === 412)).toBe(true);
    expect(CANDIDATES.some((box) => box.h === 44)).toBe(false);
  });

  it('pins every delta as shipped − frame and keeps all seven outside 1 px', () => {
    expect(CANDIDATES.map(deltaOf)).toStrictEqual(DELTAS);
    for (const candidate of CANDIDATES) {
      const delta = deltaOf(candidate);
      const farthest = Math.max(
        Math.abs(delta.dx),
        Math.abs(delta.dy),
        Math.abs(delta.dw),
        Math.abs(delta.dh),
      );
      expect(farthest, candidate.name).toBeGreaterThan(GAP_TOLERANCE);
    }
  });

  it('reports each candidate as moved, not missing, when the raw cabinet is measured', () => {
    const gap = gapFor({ boxes: CANDIDATES, strings: [], colours: [] }, SPEC);
    expect(gap.missing).toStrictEqual([]);
    expect(gap.moved).toStrictEqual(DELTAS);
  });

  it('would claim a cabinet that ever moved onto the board’s own rects', () => {
    const aligned: ScreenSpec = {
      ...SPEC,
      boxes: SPEC.boxes.map((box) => {
        const shipped = SHIPPED.find((candidate) => candidate.name === box.name);
        return shipped === undefined
          ? box
          : { ...box, x: shipped.x, y: shipped.y, width: shipped.w, height: shipped.h };
      }),
    };
    expect(buildView(aligned).boxes).toStrictEqual(CANDIDATES);
    expect(gapIsEmpty(gapFor(buildView(aligned), aligned))).toBe(true);
  });
});

describe('what the frame draws and the view cannot claim', () => {
  it('draws the card’s 1 px rule with no separate view box', () => {
    expect(frameBox('card highlight')).toMatchObject({
      x: 422,
      y: 240,
      width: 436,
      height: 1,
    });
    expect(CANDIDATES.some((box) => box.name === 'card highlight')).toBe(false);
    expect(CANDIDATES.some((box) => box.h === 1)).toBe(false);
  });

  it('paints each item icon over its whole 48 px window where the frame draws a 24 px face', () => {
    const faces = ['reel face 1 potion', 'reel face 2 poke_ball', 'reel face 3 oran_berry'];
    faces.forEach((name, index) => {
      const face = frameBox(name);
      const window = frameBox(`reel ${index + 1}`);
      expect({ x: face.x, y: face.y, width: face.width, height: face.height }).toStrictEqual({
        x: 568 + index * 60,
        y: 356,
        width: 24,
        height: 24,
      });
      expect(face.x - window.x).toBe(12);
      expect(face.y - window.y).toBe(12);
      expect(window.width - face.width + 24).toBe(48);
      expect(window.height - face.height + 24).toBe(48);
    });
    expect(CANDIDATES.some((box) => box.name.startsWith('reel face'))).toBe(false);
  });

  it('draws no rocket emblem: the Rocket face lives only inside a reel', () => {
    expect(frameBox('rocket emblem')).toMatchObject({
      x: 624,
      y: 276,
      width: 32,
      height: 48,
    });
    expect(CANDIDATES.some((box) => box.name === 'rocket emblem')).toBe(false);
    expect(CANDIDATES.some((box) => box.x === 624 && box.y === 276)).toBe(false);
  });

  it('has neither the frame’s painted scene nor a scrim of its own', () => {
    for (const name of ['route screenshot', 'scrim']) {
      expect(frameBox(name)).toMatchObject({
        x: 0,
        y: 0,
        width: 1280,
        height: 800,
      });
      expect(CANDIDATES.some((box) => box.name === name)).toBe(false);
    }
  });
});

describe('the copy the machine prints', () => {
  it('claims exactly the two lines the frame carries, as a filter not a list', () => {
    expect(buildView(SPEC).strings).toStrictEqual(['SLOT MACHINE', 'LEAVE']);
    const carried = new Set(TEXT.map((node) => fold(node.characters)));
    for (const line of buildView(SPEC).strings) expect(carried.has(fold(line)), line).toBe(true);
    expect(textOf('card title')).toBe('SLOT MACHINE');
    expect(textOf('row label 2')).toBe('LEAVE');
  });

  it('folds the money line to MONEY  ¥2480 against the frame’s MONEY  $ 2,480', () => {
    expect(fixture.rocket.money).toBe(2480);
    const printed = t('casino.money', { amount: fixture.rocket.money });
    expect(printed).toBe('MONEY  ¥2480');
    expect(fold(printed)).toBe('MONEY  ¥2480');
    expect(textOf('money')).toBe('MONEY  $ 2,480');
    expect(fold(textOf('money'))).not.toBe(fold(printed));
    expect(buildView(SPEC).strings).not.toContain(printed);
  });

  it('folds the SPIN line to SPIN  ¥300 against the frame’s SPIN  $ 300', () => {
    expect(fixture.rocket.rows[0]!.price).toBe(300);
    const printed = t('casino.spin', { price: fixture.rocket.rows[0]!.price ?? 0 });
    expect(printed).toBe('SPIN  ¥300');
    expect(fold(printed)).toBe('SPIN  ¥300');
    expect(textOf('row label 1')).toBe('SPIN  $ 300');
    expect(fold(textOf('row label 1'))).not.toBe(fold(printed));
    expect(buildView(SPEC).strings).not.toContain(printed);
  });

  it('leaves the room’s message line unclaimed, because the frame prints none', () => {
    expect(fixture.rocket.message).toBe('One spin, three reels.');
    expect(TEXT.some((node) => fold(node.characters) === fold(fixture.rocket.message))).toBe(false);
    expect(buildView(SPEC).strings).not.toContain(fixture.rocket.message);
  });

  it('claims no colour: every tone is a chrome token, not a view literal', () => {
    expect(buildView(SPEC).colours).toStrictEqual([]);
  });
});
