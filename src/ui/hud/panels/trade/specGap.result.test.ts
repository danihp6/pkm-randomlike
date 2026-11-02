import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import fixture from '../../../../../design/fixtures/03j-panels-trade-result.json';
import screenSpec from '../../../../../design/screens/03j-panels-trade-result.json';
import { gapFor, gapIsEmpty, type ScreenSpec, type SpecBox } from '../../specGap';
import { buildView, slug } from '../../specGap.views/trade-result';
import {
  tradePanelView,
  type Rect,
  type TradeInput,
  type TradePanelView,
  type TradePartyTile,
  type TradePcTile,
} from './view';

/**
 * The `03j Panels · trade result` frame measured against the panel's own result state: the
 * adapter that answers for this slug, the premise that the shipped card *is* the board's card
 * (four boxes, two coordinate frames), the rects the frame draws and the card does not, and the
 * five lines the card prints on it.
 */

const SPEC = screenSpec as ScreenSpec;
const DESKTOP = { width: 1280, height: 800 };

type FrameText = Readonly<{ name: string; characters: string }>;

const TEXT = screenSpec.text as unknown as readonly FrameText[];
const RAW_TEXT = screenSpec as unknown as Readonly<{ text: readonly FrameText[] }>;

const fold = (line: string): string => line.trim().toUpperCase();

const textOf = (name: string): string => TEXT.find((node) => node.name === name)?.characters ?? '';

const frameBox = (name: string): SpecBox => {
  const box = SPEC.boxes.find((entry) => entry.name === name);
  if (box === undefined) throw new Error(`the frame draws no box named "${name}"`);
  return box;
};

const rectOf = (box: SpecBox): Rect => ({
  x: box.x,
  y: box.y,
  w: box.width,
  h: box.height,
});

/** A panel-relative rect as the page shows it. */
const absolute = (rect: Rect, panel: TradePanelView): Rect => ({
  x: panel.box.x + rect.x,
  y: panel.box.y + rect.y,
  w: rect.w,
  h: rect.h,
});

/** A result card rect at its viewport position: the card is panel-relative, its rects are not. */
const lifted = (rect: Rect, panel: TradePanelView): Rect => {
  const card = panel.result!.card;
  return {
    x: panel.box.x + card.x + rect.x,
    y: panel.box.y + card.y + rect.y,
    w: rect.w,
    h: rect.h,
  };
};

/** The delta between a shipped rect and the frame's own, as `gapFor` rounds it. */
const delta = (shipped: Rect, frame: SpecBox): Readonly<Record<string, number>> => ({
  dx: Math.round(shipped.x - frame.x),
  dy: Math.round(shipped.y - frame.y),
  dw: Math.round(shipped.w - frame.width),
  dh: Math.round(shipped.h - frame.height),
});

type FixtureTile = Readonly<{ memberId: string; name: string; level?: number; frame: number | null }>;

type FixtureBlock = Readonly<{
  kind: string;
  message: string;
  canTrade: boolean;
  selected: number;
  partyCount: number;
  pcCount: number;
  open: boolean;
  received: TradeInput['received'];
  party: readonly FixtureTile[];
  pc: readonly FixtureTile[];
}>;

/** The mapping `fixture.test.ts` uses: a tile's rect and selection are the view's own. */
function partyOf(tiles: readonly FixtureTile[]): readonly TradePartyTile[] {
  return tiles.map((tile) => ({
    memberId: tile.memberId,
    name: tile.name,
    level: tile.level ?? 0,
    frame: tile.frame,
    selected: false,
    box: { x: 0, y: 0, w: 0, h: 0 },
  }));
}

function pcOf(tiles: readonly FixtureTile[]): readonly TradePcTile[] {
  return tiles.map((tile) => ({
    memberId: tile.memberId,
    name: tile.name,
    frame: tile.frame,
    box: { x: 0, y: 0, w: 0, h: 0 },
  }));
}

function input(block: FixtureBlock): TradeInput {
  return {
    kind: block.kind === 'result' ? 'result' : 'pick',
    message: block.message,
    canTrade: block.canTrade,
    party: partyOf(block.party),
    pc: pcOf(block.pc),
    selected: block.selected,
    partyCount: block.partyCount,
    pcCount: block.pcCount,
    received: block.kind === 'result' ? block.received : null,
    open: block.open,
  };
}

const block = fixture.result as FixtureBlock;

const view = (): TradePanelView => tradePanelView(input(block), DESKTOP);

/** The four boxes the card draws at the board's own rects, in draw order. */
const BOXES = [
  { name: 'result panel', x: 360, y: 190, w: 560, h: 420 },
  { name: 'panel highlight', x: 372, y: 202, w: 536, h: 1 },
  { name: 'received portrait', x: 576, y: 278, w: 128, h: 128 },
  { name: 'type WATER', x: 628, y: 486, w: 24, h: 24 },
];

/** The five lines the card prints on this frame, in draw order. */
const STRINGS: readonly string[] = [
  'TRADE',
  'TRADE COMPLETE',
  'RECEIVED',
  'SHELLDER',
  'ADDED TO YOUR PARTY',
];

describe('the 03j adapter', () => {
  it('answers for the board frame it is named after', () => {
    expect(slug).toBe('03j-panels-trade-result');
    expect(SPEC.slug).toBe(slug);
    expect(SPEC.boxes).toHaveLength(7);
    expect(TEXT).toHaveLength(5);
    expect(SPEC.colours).toHaveLength(7);
  });

  it('claims the four boxes and the five lines the card prints, and no colour', () => {
    expect(buildView(SPEC)).toStrictEqual({ boxes: BOXES, strings: STRINGS, colours: [] });
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

describe('the premise: the shipped result card is the board’s card', () => {
  it('centres the card inside the panel box on the board’s 360, 190, 560, 420', () => {
    expect(view().box).toStrictEqual({ x: 260, y: 120, w: 760, h: 560 });
    expect(view().result!.card).toStrictEqual({ x: 100, y: 70, w: 560, h: 420 });
    expect(rectOf(frameBox('result panel'))).toStrictEqual({ x: 360, y: 190, w: 560, h: 420 });
    expect(absolute(view().result!.card, view())).toStrictEqual({
      x: 360,
      y: 190,
      w: 560,
      h: 420,
    });
    expect(delta(absolute(view().result!.card, view()), frameBox('result panel'))).toStrictEqual({
      dx: 0,
      dy: 0,
      dw: 0,
      dh: 0,
    });
  });

  it('hangs the highlight 12 px inside the card’s top edge, on the board’s 372, 202, 536, 1', () => {
    expect(rectOf(frameBox('panel highlight'))).toStrictEqual({ x: 372, y: 202, w: 536, h: 1 });
    expect(view().result!.highlight).toStrictEqual({ x: 12, y: 12, w: 536, h: 1 });
    expect(absolute(view().highlight, view())).toStrictEqual({ x: 372, y: 202, w: 536, h: 1 });
    expect(delta(absolute(view().highlight, view()), frameBox('panel highlight'))).toStrictEqual({
      dx: 0,
      dy: 0,
      dw: 0,
      dh: 0,
    });
  });

  it('centres the 128 px portrait on the board’s 576, 278, 128, 128', () => {
    expect(rectOf(frameBox('received portrait'))).toStrictEqual({
      x: 576,
      y: 278,
      w: 128,
      h: 128,
    });
    expect(view().result!.portrait).toStrictEqual({ x: 216, y: 88, w: 128, h: 128 });
    expect(lifted(view().result!.portrait, view())).toStrictEqual({
      x: 576,
      y: 278,
      w: 128,
      h: 128,
    });
    expect(delta(lifted(view().result!.portrait, view()), frameBox('received portrait'))).toStrictEqual({
      dx: 0,
      dy: 0,
      dw: 0,
      dh: 0,
    });
  });

  it('reaches the type chip through both lifts, on the board’s 628, 486, 24, 24', () => {
    expect(rectOf(frameBox('type WATER'))).toStrictEqual({ x: 628, y: 486, w: 24, h: 24 });
    expect(view().result!.type!.box).toStrictEqual({ x: 268, y: 296, w: 24, h: 24 });
    expect(lifted(view().result!.type!.box, view())).toStrictEqual({
      x: 628,
      y: 486,
      w: 24,
      h: 24,
    });
    expect(delta(lifted(view().result!.type!.box, view()), frameBox('type WATER'))).toStrictEqual({
      dx: 0,
      dy: 0,
      dw: 0,
      dh: 0,
    });
    expect(absolute(view().result!.type!.box, view())).toStrictEqual({
      x: 528,
      y: 416,
      w: 24,
      h: 24,
    });
  });

  it('claims the chip under the name the board gives it, derived from the type id', () => {
    expect(view().result!.type!.id).toBe('water');
    expect(`type ${view().result!.type!.id.toUpperCase()}`).toBe('type WATER');
    expect(SPEC.boxes.map((box) => box.name)).toContain('type WATER');
    expect(buildView(SPEC).boxes.map((box) => box.name)).toContain('type WATER');
  });
});

describe('the rects the frame draws and the card does not', () => {
  it('draws no give-away button on this card and invents none', () => {
    expect(SPEC.boxes.some((box) => box.name === 'give away button')).toBe(false);
    expect(view().give).toBeNull();
    expect(buildView(SPEC).boxes.some((box) => box.name === 'give away button')).toBe(false);
  });

  it('prints a CLOSE press at 470, 542, 340, 44 that no frame box carries', () => {
    expect(view().result!.button.label).toBe('CLOSE');
    expect(view().result!.button.box).toStrictEqual({ x: 110, y: 352, w: 340, h: 44 });
    expect(absolute(view().close.box, view())).toStrictEqual({
      x: 470,
      y: 542,
      w: 340,
      h: 44,
    });
    expect(absolute(view().close.box, view())).toStrictEqual(lifted(view().result!.button.box, view()));
    expect(SPEC.boxes.some((box) => box.name === 'CLOSE')).toBe(false);
    expect(SPEC.boxes.some((box) => box.name === 'close')).toBe(false);
    expect(buildView(SPEC).boxes).toHaveLength(4);
  });

  it('leaves the header divider at 384, 240, 512, 1 unclaimed', () => {
    expect(rectOf(frameBox('header divider'))).toStrictEqual({
      x: 384,
      y: 240,
      w: 512,
      h: 1,
    });
    expect(buildView(SPEC).boxes.some((box) => box.name === 'header divider')).toBe(false);
  });

  it('leaves the frame’s painted scene and its scrim to the panel’s own layers', () => {
    for (const name of ['route screenshot', 'scrim']) {
      expect(rectOf(frameBox(name))).toStrictEqual({ x: 0, y: 0, w: 1280, h: 800 });
      expect(buildView(SPEC).boxes.some((box) => box.name === name)).toBe(false);
    }
  });
});

describe('the copy the card prints', () => {
  it('prints the frame’s own five lines, in the card’s draw order', () => {
    expect(['result title', 'meta', 'kicker', 'received name', 'level line'].map(textOf)).toStrictEqual(
      STRINGS,
    );
    expect(buildView(SPEC).strings).toStrictEqual(STRINGS);
  });

  it('reaches every line from the view’s own fields, never from a literal', () => {
    expect(view().result!.title).toBe('TRADE');
    expect(textOf('result title')).toBe(view().result!.title);
    expect(view().meta.text).toBe('TRADE COMPLETE');
    expect(textOf('meta')).toBe(view().meta.text);
    expect(view().result!.kicker).toBe('RECEIVED');
    expect(textOf('kicker')).toBe(view().result!.kicker);
    expect(view().result!.name).toBe('SHELLDER');
    expect(textOf('received name')).toBe(view().result!.name);
    expect(view().result!.added).toBe('ADDED TO YOUR PARTY');
    expect(textOf('level line')).toBe(view().result!.added);
  });

  it('claims neither the CLOSE press nor the room’s own line', () => {
    const board = new Set(RAW_TEXT.text.map((node) => fold(node.characters)));
    expect(board.has(fold(view().result!.button.label))).toBe(false);
    expect(board.has(fold(view().message.text))).toBe(false);
    expect(buildView(SPEC).strings).not.toContain(view().result!.button.label);
    expect(buildView(SPEC).strings).not.toContain(view().message.text);
  });

  it('claims nothing the board does not carry', () => {
    const board = new Set(RAW_TEXT.text.map((node) => fold(node.characters)));
    for (const line of buildView(SPEC).strings) expect(board.has(fold(line)), line).toBe(true);
  });
});

describe('the adapter’s purity', () => {
  const SOURCE = readFileSync(new URL('../../specGap.views/trade-result.ts', import.meta.url), 'utf8');

  it('imports no phaser, no scene and no engine', () => {
    for (const forbidden of ["from 'phaser'", '/scenes/', '/engine/', '/data/']) {
      expect(SOURCE.includes(forbidden), forbidden).toBe(false);
    }
  });

  it('reads no DOM global, no clock and no rng', () => {
    for (const forbidden of ['document.', 'window.', 'localStorage', 'Math.random', 'Date.now']) {
      expect(SOURCE.includes(forbidden), forbidden).toBe(false);
    }
  });
});
