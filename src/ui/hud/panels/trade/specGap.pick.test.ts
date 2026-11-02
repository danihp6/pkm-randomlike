import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import fixture from '../../../../../design/fixtures/03i-panels-trade-pick.json';
import screenSpec from '../../../../../design/screens/03i-panels-trade-pick.json';
import { t } from '../../../../i18n';
import { GAP_TOLERANCE, gapFor, gapIsEmpty, type ScreenSpec, type SpecBox } from '../../specGap';
import { buildView, slug } from '../../specGap.views/trade-pick';
import { tradePanelBox, tradePanelView, type Rect, type TradeInput, type TradePanelView } from './view';

/**
 * The `03i Panels · trade pick` frame measured against the trade card's own view model: the
 * adapter that answers for this slug, the premise that the shipped pick sheet *is* the board's
 * card, the boxes and lines it claims at a zero delta, and the box and the two lines it must
 * not claim.
 */

const SPEC = screenSpec as ScreenSpec;
const DESKTOP = { width: 1280, height: 800 };

type FrameText = Readonly<{ name: string; characters: string }>;

const TEXT = screenSpec.text as unknown as readonly FrameText[];

type FixtureTile = Readonly<{
  memberId: string;
  name: string;
  level?: number;
  frame: number | null;
}>;

type FixtureBlock = Readonly<{
  message: string;
  canTrade: boolean;
  selected: number;
  partyCount: number;
  pcCount: number;
  open: boolean;
  party: readonly FixtureTile[];
  pc: readonly FixtureTile[];
}>;

const PICK = (fixture as unknown as Readonly<{ pick: FixtureBlock }>).pick;

const fold = (line: string): string => line.trim().toUpperCase();

const textOf = (name: string): string => TEXT.find((node) => node.name === name)?.characters ?? '';

const frameBox = (name: string): SpecBox => {
  const box = SPEC.boxes.find((entry) => entry.name === name);
  if (box === undefined) throw new Error(`the frame draws no box named "${name}"`);
  return box;
};

const rectOf = (box: SpecBox): Readonly<{ x: number; y: number; width: number; height: number }> => ({
  x: box.x,
  y: box.y,
  width: box.width,
  height: box.height,
});

/** Where a panel-relative rect lands once the card is mounted at its own viewport box. */
const at = (origin: Rect, rect: Rect): Rect => ({
  x: origin.x + rect.x,
  y: origin.y + rect.y,
  w: rect.w,
  h: rect.h,
});

const deltaOf = (shipped: Rect, frame: SpecBox): Readonly<Record<string, number>> => ({
  dx: shipped.x - frame.x,
  dy: shipped.y - frame.y,
  dw: shipped.w - frame.width,
  dh: shipped.h - frame.height,
});

const ZERO = { dx: 0, dy: 0, dw: 0, dh: 0 };

/** The card on its pick state, rebuilt here exactly as the adapter's own `inputFrom` maps it. */
function view(): TradePanelView {
  const input: TradeInput = {
    kind: 'pick',
    message: PICK.message,
    canTrade: PICK.canTrade,
    party: PICK.party.map((tile) => ({
      memberId: tile.memberId,
      name: tile.name,
      level: tile.level ?? 0,
      frame: tile.frame,
      selected: false,
      box: { x: 0, y: 0, w: 0, h: 0 },
    })),
    pc: PICK.pc.map((tile) => ({
      memberId: tile.memberId,
      name: tile.name,
      frame: tile.frame,
      box: { x: 0, y: 0, w: 0, h: 0 },
    })),
    selected: PICK.selected,
    partyCount: PICK.partyCount,
    pcCount: PICK.pcCount,
    received: null,
    open: PICK.open,
  };
  return tradePanelView(input, DESKTOP);
}

/** The six party tiles and the five PC cells the fixture paints, no more and no fewer. */
const PARTY_ROWS = Array.from({ length: 6 }, (_, index) => `party row ${index + 1}`);
const PC_SLOTS = Array.from({ length: 5 }, (_, index) => `pc slot ${index + 1}`);

/** The whole card, under the frame's own names, in the card's draw order. */
const CLAIMED_BOXES: readonly string[] = [
  'trade panel',
  'panel highlight',
  ...PARTY_ROWS,
  ...PC_SLOTS,
  'give away button',
];

/** The five lines the card prints that the board carries too, in draw order. */
const CLAIMED_STRINGS: readonly string[] = [
  'trade title',
  'greeting',
  'party label',
  'pc label',
  'button label',
].map(textOf);

/** Each claimed box at the frame's own rect, which is what every assertion below reads. */
const BOXES = CLAIMED_BOXES.map((name) => {
  const frame = frameBox(name);
  return { name, x: frame.x, y: frame.y, w: frame.width, h: frame.height };
});

const claimedNames = (): readonly string[] => buildView(SPEC).boxes.map((box) => box.name);

const claimedRect = (name: string): Rect => {
  const box = buildView(SPEC).boxes.find((entry) => entry.name === name);
  if (box === undefined) throw new Error(`the adapter claims no box named "${name}"`);
  return { x: box.x, y: box.y, w: box.w, h: box.h };
};

const withinTolerance = (left: Rect, right: Rect): boolean =>
  Math.abs(left.x - right.x) <= GAP_TOLERANCE &&
  Math.abs(left.y - right.y) <= GAP_TOLERANCE &&
  Math.abs(left.w - right.w) <= GAP_TOLERANCE &&
  Math.abs(left.h - right.h) <= GAP_TOLERANCE;

describe('the 03i adapter', () => {
  it('answers for the board frame it is named after', () => {
    expect(slug).toBe('03i-panels-trade-pick');
    expect(SPEC.slug).toBe(slug);
    expect(SPEC.boxes).toHaveLength(39);
    expect(TEXT).toHaveLength(6);
    expect(SPEC.colours).toHaveLength(11);
  });

  it('claims every box the card draws and the five lines the board carries, and no colour', () => {
    expect(claimedNames()).toStrictEqual(CLAIMED_BOXES);
    expect(buildView(SPEC)).toStrictEqual({
      boxes: BOXES,
      strings: CLAIMED_STRINGS,
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
});

describe('the premises: the shipped pick sheet is the board’s card', () => {
  it('draws the panel at 260, 120, 760, 560, every delta 0', () => {
    expect(tradePanelBox(DESKTOP)).toStrictEqual({ x: 260, y: 120, w: 760, h: 560 });
    expect(rectOf(frameBox('trade panel'))).toStrictEqual({
      x: 260,
      y: 120,
      width: 760,
      height: 560,
    });
    expect(deltaOf(tradePanelBox(DESKTOP), frameBox('trade panel'))).toStrictEqual(ZERO);
  });

  it('hangs the highlight 12 px inside the card’s top edge, on 272, 132, 736, 1', () => {
    expect(rectOf(frameBox('panel highlight'))).toStrictEqual({
      x: 272,
      y: 132,
      width: 736,
      height: 1,
    });
    expect(at(view().box, view().highlight)).toStrictEqual({ x: 272, y: 132, w: 736, h: 1 });
    expect(deltaOf(at(view().box, view().highlight), frameBox('panel highlight'))).toStrictEqual(ZERO);
  });

  it('lays six 158 × 104 party tiles on the board’s rows, 170 / 116 apart', () => {
    const shipped = view().party;
    expect(shipped).toHaveLength(6);
    expect(shipped.map((tile) => at(view().box, tile.box))).toStrictEqual(
      PARTY_ROWS.map((name) => {
        const frame = frameBox(name);
        return { x: frame.x, y: frame.y, w: frame.width, h: frame.height };
      }),
    );
    const lifted = shipped.map((tile) => at(view().box, tile.box));
    expect(lifted[1]!.x - lifted[0]!.x).toBe(170);
    expect(lifted[2]!.y - lifted[0]!.y).toBe(116);
    for (let index = 0; index < lifted.length; index += 1) {
      expect(deltaOf(lifted[index]!, frameBox(`party row ${index + 1}`))).toStrictEqual(ZERO);
      expect(lifted[index]!.w).toBe(158);
      expect(lifted[index]!.h).toBe(104);
    }
  });

  it('lays five 76 × 76 PC cells on the board’s first five slots, 88 px apart', () => {
    const shipped = view().pc;
    expect(shipped).toHaveLength(5);
    const lifted = shipped.map((cell) => at(view().box, cell.box));
    expect(lifted).toStrictEqual([
      { x: 656, y: 236, w: 76, h: 76 },
      { x: 744, y: 236, w: 76, h: 76 },
      { x: 832, y: 236, w: 76, h: 76 },
      { x: 920, y: 236, w: 76, h: 76 },
      { x: 656, y: 324, w: 76, h: 76 },
    ]);
    for (let index = 0; index < lifted.length; index += 1) {
      expect(deltaOf(lifted[index]!, frameBox(`pc slot ${index + 1}`))).toStrictEqual(ZERO);
    }
    expect(lifted[1]!.x - lifted[0]!.x).toBe(88);
    expect(lifted[4]!.y - lifted[0]!.y).toBe(88);
  });

  it('draws the give-away button 24 px above the card’s bottom edge, on 470, 612, 340, 44', () => {
    const give = view().give;
    expect(give).not.toBeNull();
    expect(at(view().box, give!.box)).toStrictEqual({ x: 470, y: 612, w: 340, h: 44 });
    expect(deltaOf(at(view().box, give!.box), frameBox('give away button'))).toStrictEqual(ZERO);
    expect(at(view().box, give!.box).y + give!.box.h + 24).toBe(view().box.y + view().box.h);
  });
});

describe('the boxes the card does not claim', () => {
  it('draws no header divider, so the board’s 284, 204, 712, 1 is never a claim', () => {
    expect(rectOf(frameBox('header divider'))).toStrictEqual({
      x: 284,
      y: 204,
      width: 712,
      height: 1,
    });
    const divider = { x: 284, y: 204, w: 712, h: 1 };
    expect(claimedNames()).not.toContain('header divider');
    for (const name of claimedNames()) {
      expect(withinTolerance(claimedRect(name), divider), name).toBe(false);
    }
  });

  it('paints five of the frame’s sixteen cells, and claims exactly pc slot 1 to 5', () => {
    expect(view().pc).toHaveLength(5);
    expect(PICK.pc).toHaveLength(5);
    expect(claimedNames().filter((name) => name.startsWith('pc slot '))).toStrictEqual(PC_SLOTS);
    for (let index = 6; index <= 16; index += 1) {
      expect(
        SPEC.boxes.some((box) => box.name === `pc slot ${index}`),
        `pc slot ${index}`,
      ).toBe(true);
      expect(claimedNames()).not.toContain(`pc slot ${index}`);
    }
  });

  it('claims no scrim and no route screenshot: the route behind the card is the canvas', () => {
    for (const name of ['route screenshot', 'scrim']) {
      expect(rectOf(frameBox(name)), name).toStrictEqual({
        x: 0,
        y: 0,
        width: 1280,
        height: 800,
      });
      expect(claimedNames()).not.toContain(name);
      expect(withinTolerance(claimedRect('trade panel'), { x: 0, y: 0, w: 1280, h: 800 })).toBe(false);
    }
  });

  it('claims no portrait: the eleven icon rects are centred inside the tiles they belong to', () => {
    const partyIcons = SPEC.boxes.filter((box) => (box.name ?? '').startsWith('party icon '));
    const pcIcons = SPEC.boxes.filter((box) => (box.name ?? '').startsWith('pc icon '));
    expect(partyIcons).toHaveLength(6);
    expect(pcIcons).toHaveLength(5);
    const claimed = buildView(SPEC).boxes;
    for (const icon of [...partyIcons, ...pcIcons]) {
      expect(claimedNames()).not.toContain(icon.name);
      const rect = { x: icon.x, y: icon.y, w: icon.width, h: icon.height };
      for (const box of claimed) {
        expect(withinTolerance({ x: box.x, y: box.y, w: box.w, h: box.h }, rect), box.name).toBe(false);
      }
    }
    for (const [index, icon] of [...partyIcons, ...pcIcons].entries()) {
      const tileName = index < partyIcons.length ? PARTY_ROWS[index]! : PC_SLOTS[index - 6]!;
      const tile = frameBox(tileName);
      expect(icon.x - tile.x, icon.name ?? '').toBe((tile.width - icon.width) / 2);
      expect(icon.y - tile.y, icon.name ?? '').toBe((tile.height - icon.height) / 2);
    }
  });
});

describe('the copy the card prints', () => {
  it('claims the five lines the board carries, and each of them is one of the frame’s text nodes', () => {
    expect(CLAIMED_STRINGS).toStrictEqual([
      'TRADE',
      'Pick the Pokémon you will give away.',
      'PARTY',
      'PC',
      'GIVE AWAY',
    ]);
    expect(buildView(SPEC).strings).toStrictEqual(CLAIMED_STRINGS);
    const board = new Set(SPEC.text.map((node) => fold(node.characters)));
    for (const line of buildView(SPEC).strings) expect(board.has(fold(line)), line).toBe(true);
  });

  it('prints the frame’s meta line with the card’s separator, so it is not claimed', () => {
    expect(view().meta.text).toBe('PARTY 6/6 · PC 5/16');
    expect(view().meta.text).toBe(t('trade.meta', { party: 6, pc: 5 }));
    expect(textOf('meta')).toBe('PARTY 6/6   PC 5/16');
    expect(fold(view().meta.text)).not.toBe(fold(textOf('meta')));
    expect(buildView(SPEC).strings).not.toContain(view().meta.text);
  });

  it('prints the ✕ the frame never draws, so it is not claimed', () => {
    expect(view().close.label).toBe('✕');
    expect(SPEC.boxes.some((box) => (box.name ?? '').startsWith('close'))).toBe(false);
    const board = new Set(SPEC.text.map((node) => fold(node.characters)));
    expect(board.has(fold(view().close.label))).toBe(false);
    expect(buildView(SPEC).strings).not.toContain(view().close.label);
  });
});

describe('the adapter is pure', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../../specGap.views/trade-pick.ts', import.meta.url)),
    'utf8',
  );

  it('imports no phaser and reaches no DOM global', () => {
    expect(source).not.toMatch(/from ['"]phaser['"]/);
    expect(source).not.toMatch(/\b(document|window|localStorage|navigator)\b/);
  });

  it('draws no random value and reads no clock', () => {
    expect(source).not.toMatch(/Math\.random|Date\.now|performance\.now/);
  });
});
