import { describe, expect, it } from 'vitest';
import framePick from '../../../../../design/frames/03i-panels-trade-pick.json';
import frameResult from '../../../../../design/frames/03j-panels-trade-result.json';
import framePickMobile from '../../../../../design/frames/m03i-panels-trade-pick.json';
import frameResultMobile from '../../../../../design/frames/m03j-panels-trade-result.json';
import { t } from '../../../../i18n';
import {
  tradePanelBox,
  tradePanelView,
  type Rect,
  type TradeInput,
  type TradePartyTile,
  type TradePcTile,
} from './index';

/**
 * The board's own frames are the source of the numbers, not this test: every rect
 * below is read out of the exported frame and compared with the view, so the panel
 * and the board cannot drift apart quietly.
 */

type FrameNode = Readonly<{
  name?: string;
  type?: string;
  properties?: Readonly<{
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    characters?: string;
  }>;
  children?: readonly FrameNode[];
}>;

type Frame = Readonly<{ geometry: readonly FrameNode[] }>;

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

function find(nodes: readonly FrameNode[], name: string): FrameNode {
  for (const node of nodes) {
    if (node.name === name) return node;
    const hit = find(node.children ?? [], name);
    if (hit.name !== undefined) return hit;
  }
  return {};
}

/** The absolute rect a named node of a frame occupies on the page. */
function frameRect(frame: unknown, name: string): Rect {
  const properties = find((frame as Frame).geometry, name).properties ?? {};
  return {
    x: properties.x ?? Number.NaN,
    y: properties.y ?? Number.NaN,
    w: properties.width ?? Number.NaN,
    h: properties.height ?? Number.NaN,
  };
}

/** A frame rect measured from the card's own top-left, as the model reports it. */
function inside(rect: Rect, card: Rect): Rect {
  return { x: rect.x - card.x, y: rect.y - card.y, w: rect.w, h: rect.h };
}

function partyTile(memberId: string, name: string, level: number, frame: number | null): TradePartyTile {
  return { memberId, name, level, frame, selected: false, box: { x: 0, y: 0, w: 0, h: 0 } };
}

function pcTile(memberId: string, name: string, frame: number | null): TradePcTile {
  return { memberId, name, frame, box: { x: 0, y: 0, w: 0, h: 0 } };
}

const PARTY: readonly TradePartyTile[] = [
  partyTile('member-1', 'Bulbasaur', 18, 1),
  partyTile('member-2', 'Charmander', 17, 4),
  partyTile('member-3', 'Squirtle', 18, 7),
  partyTile('member-4', 'Growlithe', 16, 58),
  partyTile('member-5', 'Eevee', 20, 133),
  partyTile('member-6', 'Gastly', 15, 92),
];

const PC: readonly TradePcTile[] = Array.from({ length: 5 }, (_, i) =>
  pcTile(`box-${i}`, `Box ${i}`, 60 + i),
);

function input(overrides: Partial<TradeInput> = {}): TradeInput {
  return {
    kind: 'pick',
    message: 'Pick the Pokémon you will give away.',
    canTrade: true,
    party: PARTY,
    pc: PC,
    selected: 0,
    partyCount: 6,
    pcCount: 5,
    received: null,
    open: true,
    ...overrides,
  };
}

function view(overrides: Partial<TradeInput> = {}, viewport = DESKTOP) {
  return tradePanelView(input(overrides), viewport);
}

describe('tradePanelBox', () => {
  it('sits on the board’s own card at both QA viewports', () => {
    expect(tradePanelBox(DESKTOP)).toEqual(frameRect(framePick, 'trade panel'));
    expect(tradePanelBox(PHONE)).toEqual(frameRect(framePickMobile, 'm panel'));
  });

  it('keeps a 390 × 844 window inside its 8 px margin on every edge', () => {
    const box = tradePanelBox(PHONE);
    expect(box.x).toBe(8);
    expect(box.y).toBeGreaterThanOrEqual(8);
    expect(box.x + box.w).toBeLessThanOrEqual(PHONE.width - 8);
    expect(box.y + box.h).toBeLessThanOrEqual(PHONE.height - 8);
  });

  it('gives way inside the margin before it overflows a narrow screen', () => {
    expect(tradePanelBox({ width: 320, height: 800 })).toEqual({ x: 8, y: 146, w: 304, h: 508 });
  });

  it('draws the board’s card for an unmeasurable viewport', () => {
    expect(tradePanelBox({ width: Number.NaN, height: Number.NaN })).toEqual({
      x: 8,
      y: 8,
      w: 760,
      h: 560,
    });
  });
});

describe('the pick card at 1280 × 800', () => {
  const box = frameRect(framePick, 'trade panel');
  /** A panel-relative rect lifted back onto the page, where the frame's nodes live. */
  const abs = (rect: Rect): Rect => ({ x: box.x + rect.x, y: box.y + rect.y, w: rect.w, h: rect.h });

  it('puts the highlight, the title, the meta and the labels on the frame’s rects', () => {
    const panel = view();
    expect(panel.box).toEqual(box);
    expect(panel.highlight).toEqual(inside(frameRect(framePick, 'panel highlight'), box));
    expect(panel.title.box).toEqual(inside(frameRect(framePick, 'trade title'), box));
    expect(panel.meta.box).toEqual(inside(frameRect(framePick, 'meta'), box));
    expect(panel.message.box).toEqual(inside(frameRect(framePick, 'greeting'), box));
    expect(panel.partyLabel.box).toEqual(inside(frameRect(framePick, 'party label'), box));
    expect(panel.pcLabel.box).toEqual(inside(frameRect(framePick, 'pc label'), box));
  });

  it('lays the six party tiles in party order on the frame’s two columns', () => {
    const panel = view();
    expect(panel.party.map((tile) => abs(tile.box))).toEqual(
      [1, 2, 3, 4, 5, 6].map((n) => frameRect(framePick, `party row ${n}`)),
    );
    expect(abs(panel.party[0]!.box)).toEqual({ x: 284, y: 236, w: 158, h: 104 });
    expect(abs(panel.party[1]!.box)).toEqual({ x: 454, y: 236, w: 158, h: 104 });
    expect(abs(panel.party[5]!.box)).toEqual({ x: 454, y: 468, w: 158, h: 104 });
  });

  it('lays the sixteen PC cells on the frame’s four by four grid', () => {
    const cells = Array.from({ length: 16 }, (_, i) => pcTile(`box-${i}`, `Box ${i}`, i));
    const panel = view({ pc: cells, pcCount: 16 });
    expect(panel.pc.map((cell) => abs(cell.box))).toEqual(
      Array.from({ length: 16 }, (_, i) => frameRect(framePick, `pc slot ${i + 1}`)),
    );
    expect(abs(panel.pc[0]!.box)).toEqual({ x: 656, y: 236, w: 76, h: 76 });
    expect(abs(panel.pc[15]!.box)).toEqual({ x: 920, y: 500, w: 76, h: 76 });
  });

  it('puts the give-away button and the dismiss ✕ on the frame’s footer band', () => {
    const panel = view();
    expect(abs(panel.give!.box)).toEqual(frameRect(framePick, 'give away button'));
    expect(abs(panel.give!.box)).toEqual({ x: 470, y: 612, w: 340, h: 44 });
    // The frame carries no dismiss control, so the ✕ sits in the footer's empty
    // right end, on the button's centre line and flush with the 24 px content inset.
    expect(panel.close.box).toEqual({ x: 712, y: 502, w: 24, h: 24 });
    expect(panel.close.box.x + panel.close.box.w).toBe(panel.box.w - 24);
    expect(panel.close.box.y + panel.close.box.h / 2).toBe(panel.give!.box.y + 22);
  });

  it('prints the frame’s own strings from the shipped keys', () => {
    const panel = view();
    expect(panel.title.text).toBe('TRADE');
    expect(panel.meta.text).toBe(t('trade.meta', { party: 6, pc: 5 }));
    expect(panel.message.text).toBe('Pick the Pokémon you will give away.');
    expect(panel.partyLabel.text).toBe(t('trade.party'));
    expect(panel.pcLabel.text).toBe(t('trade.pc'));
    expect(panel.give!.label).toBe(t('trade.give'));
    expect(panel.kind).toBe('pick');
    expect(panel.result).toBeNull();
  });
});

describe('the pick sheet at 390 × 844', () => {
  const box = frameRect(framePickMobile, 'm panel');

  it('centres the sheet and lays the six tiles three across', () => {
    const panel = view({}, PHONE);
    expect(panel.box).toEqual(box);
    expect(panel.party.map((tile) => tile.box)).toEqual(
      [1, 2, 3, 4, 5, 6].map((n) => inside(frameRect(framePickMobile, `m party tile ${n}`), box)),
    );
    expect(panel.party[0]!.box).toEqual({ x: 16, y: 92, w: 104, h: 64 });
    expect(panel.party[5]!.box).toEqual({ x: 240, y: 164, w: 104, h: 64 });
  });

  it('shows the twelve PC cells the sheet has room for, from y 422', () => {
    const cells = Array.from({ length: 16 }, (_, i) => pcTile(`box-${i}`, `Box ${i}`, i));
    const panel = view({ pc: cells, pcCount: 16 }, PHONE);
    expect(panel.pc).toHaveLength(12);
    expect(panel.pc.map((cell) => cell.box)).toEqual(
      Array.from({ length: 12 }, (_, i) =>
        inside(frameRect(framePickMobile, `m pc slot ${i + 1}`), box),
      ),
    );
    expect(panel.pc[0]!.box).toEqual({ x: 63, y: 254, w: 56, h: 56 });
  });

  it('derives the footer button from the sheet’s 20 px bottom inset', () => {
    const panel = view({}, PHONE);
    expect(panel.give!.box).toEqual({ x: 12, y: 444, w: 350, h: 44 });
    expect(box.h - (panel.give!.box.y + panel.give!.box.h)).toBe(20);
  });

  it('keeps the dismiss ✕ clear of the meta on the header band', () => {
    const panel = view({}, PHONE);
    expect(panel.close.box).toEqual({ x: 338, y: 10, w: 24, h: 24 });
    expect(panel.meta.box.x + panel.meta.box.w).toBeLessThan(panel.close.box.x - 4);
  });
});

describe('the result card', () => {
  const received = { name: 'SHELLDER', level: 18, type: 'water', frame: 90 };

  it('paints the 03j rects, card-relative, at 1280 × 800', () => {
    const panel = view({ kind: 'result', received, canTrade: false });
    const card = frameRect(frameResult, 'result panel');
    expect(panel.result!.card).toEqual(inside(card, frameRect(framePick, 'trade panel')));
    expect(panel.result!.highlight).toEqual(inside(frameRect(frameResult, 'panel highlight'), card));
    expect(panel.result!.titleBox).toEqual(inside(frameRect(frameResult, 'result title'), card));
    expect(panel.result!.kickerBox).toEqual(inside(frameRect(frameResult, 'kicker'), card));
    expect(panel.result!.nameBox).toEqual(inside(frameRect(frameResult, 'received name'), card));
    expect(panel.result!.addedBox).toEqual(inside(frameRect(frameResult, 'level line'), card));
    expect(panel.result!.portrait).toEqual(inside(frameRect(frameResult, 'received portrait'), card));
    expect(panel.result!.type!.box).toEqual(inside(frameRect(frameResult, 'type WATER'), card));
    // `03j` carries no button of its own: the card's one action is the shipped
    // 340 × 44 footer, on the pick card's own 24 px inset.
    expect(panel.result!.button.box).toEqual({ x: 110, y: 352, w: 340, h: 44 });
  });

  it('paints the card and the frame’s strings', () => {
    const panel = view({ kind: 'result', received, canTrade: false });
    expect(panel.result!.title).toBe('TRADE');
    expect(panel.result!.kicker).toBe(t('trade.received'));
    expect(panel.result!.name).toBe('SHELLDER');
    expect(panel.result!.added).toBe(t('trade.added'));
    expect(panel.result!.type!.id).toBe('water');
    expect(panel.result!.frame).toBe(90);
    expect(panel.result!.button.label).toBe(t('trade.close'));
    expect(panel.meta.text).toBe(`${t('trade.title')} ${t('trade.complete')}`);
    expect(panel.give).toBeNull();
    expect(panel.close.label).toBe(t('trade.close'));
    expect(panel.close.box).toEqual({
      x: panel.result!.card.x + 110,
      y: panel.result!.card.y + 352,
      w: 340,
      h: 44,
    });
  });

  it('paints the m03j sheet on the phone viewport', () => {
    const panel = view({ kind: 'result', received, canTrade: false }, PHONE);
    const card = frameRect(frameResultMobile, 'm sheet');
    const button = frameRect(frameResultMobile, 'm button');
    expect(panel.result!.card).toEqual(inside(card, frameRect(framePickMobile, 'm panel')));
    expect(panel.result!.card).toEqual({ x: 0, y: 34, w: 374, h: 440 });
    expect(panel.result!.portrait).toEqual(
      inside(frameRect(frameResultMobile, 'received portrait'), card),
    );
    expect(panel.result!.type!.box).toEqual(inside(frameRect(frameResultMobile, 'type WATER'), card));
    expect(panel.result!.button.box).toEqual(inside(button, card));
  });

  it('drops the type chip when the received member has no type', () => {
    const panel = view({ kind: 'result', received: { ...received, type: '' } });
    expect(panel.result!.type).toBeNull();
    expect(panel.result!.name).toBe('SHELLDER');
  });

  it('falls back to the pick card when a result state carries no member', () => {
    const panel = view({ kind: 'result', received: null });
    expect(panel.result).toBeNull();
    expect(panel.give).not.toBeNull();
  });
});

describe('the selection and the give-away rule', () => {
  it('marks exactly the selected tile and numbers it from the input', () => {
    expect(view({ selected: 2 }).party.map((tile) => tile.selected)).toEqual([
      false,
      false,
      true,
      false,
      false,
      false,
    ]);
    expect(view({ selected: -1 }).party.some((tile) => tile.selected)).toBe(false);
    expect(view({ selected: 99 }).party.filter((tile) => tile.selected)).toHaveLength(1);
    expect(view({ selected: Number.NaN }).party[0]!.selected).toBe(true);
  });

  it('enables the press only while the rule would accept it', () => {
    expect(view().give!.enabled).toBe(true);
    expect(view({ canTrade: false }).give!.enabled).toBe(false);
    expect(view({ selected: -1 }).give!.enabled).toBe(false);
    expect(view({ selected: 9 }).give!.enabled).toBe(true);
    expect(view({ party: [], selected: 0 }).give!.enabled).toBe(false);
  });

  it('keeps the received member’s own level off the printed line', () => {
    const panel = view({
      kind: 'result',
      received: { name: 'SHELLDER', level: 21, type: 'water', frame: 90 },
    });
    expect(panel.result!.added).toBe('ADDED TO YOUR PARTY');
    expect(panel.result!.name).toBe('SHELLDER');
  });
});

describe('the view is pure and total', () => {
  it('returns a deep-equal view for the same input twice', () => {
    expect(view({ selected: 3 })).toEqual(view({ selected: 3 }));
    expect(
      view({ kind: 'result', received: { name: 'Eevee', level: 5, type: 'normal', frame: 133 } }),
    ).toEqual(
      view({ kind: 'result', received: { name: 'Eevee', level: 5, type: 'normal', frame: 133 } }),
    );
    expect(view({}, PHONE)).toEqual(view({}, PHONE));
  });

  it('never writes the input', () => {
    const before = JSON.stringify(input({ selected: 4 }));
    view({ selected: 4 });
    view({ selected: 4 }, PHONE);
    expect(JSON.stringify(input({ selected: 4 }))).toBe(before);
  });

  it('carries the room’s line and the open flag through untouched', () => {
    expect(view({ message: 'The trade in this room is done.' }).message.text).toBe(
      'The trade in this room is done.',
    );
    expect(view({ open: false }).open).toBe(false);
  });
});
