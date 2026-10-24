import { describe, expect, it } from 'vitest';
import pickFrame from '../../../../../design/fixtures/03i-panels-trade-pick.json';
import resultFrame from '../../../../../design/fixtures/03j-panels-trade-result.json';
import { t } from '../../../../i18n';
import { isHudState } from '../../fixtures';
import { tradePanelView, type TradeInput, type TradePartyTile, type TradePcTile } from './index';

/**
 * The two fixtures carry the input's own **data** fields — the ids, names, levels and
 * dex frames, the line, the counts and the selection. A tile's `box` and `selected`
 * are the view's arithmetic over the grid and `selected`, so the files do not repeat
 * them, exactly as `03d-route-shop-buy` carries rows without their drawn rects.
 */

const VIEWPORT = { width: 1280, height: 800 };

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

function boxOf(tiles: readonly FixtureTile[]): readonly TradePcTile[] {
  return tiles.map((tile) => ({
    memberId: tile.memberId,
    name: tile.name,
    frame: tile.frame,
    box: { x: 0, y: 0, w: 0, h: 0 },
  }));
}

function inputFrom(block: FixtureBlock): TradeInput {
  return {
    kind: block.kind === 'result' ? 'result' : 'pick',
    message: block.message,
    canTrade: block.canTrade,
    party: partyOf(block.party),
    pc: boxOf(block.pc),
    selected: block.selected,
    partyCount: block.partyCount,
    pcCount: block.pcCount,
    received: block.kind === 'result' ? block.received : null,
    open: block.open,
  };
}

function paint(block: FixtureBlock) {
  return tradePanelView(inputFrom(block), VIEWPORT);
}

describe('design/fixtures/03i-panels-trade-pick.json', () => {
  it('is the frame’s own slug over a snapshot state that passes isHudState', () => {
    expect(pickFrame.slug).toBe('03i-panels-trade-pick');
    expect(isHudState(pickFrame.state)).toBe(true);
    expect(Object.keys(pickFrame.state)).toEqual(['party', 'bag', 'money', 'route', 'battle', 'notice']);
  });

  it('paints the six tiles in party order with the first one selected', () => {
    const view = paint(pickFrame.pick as FixtureBlock);
    expect(view.kind).toBe('pick');
    expect(view.party.map((tile) => tile.name)).toEqual([
      'Bulbasaur',
      'Charmander',
      'Squirtle',
      'Growlithe',
      'Eevee',
      'Gastly',
    ]);
    expect(view.party.map((tile) => tile.level)).toEqual([18, 17, 18, 16, 20, 15]);
    expect(view.party.map((tile) => tile.frame)).toEqual([1, 4, 7, 58, 133, 92]);
    expect(view.party.flatMap((tile, index) => (tile.selected ? [index] : []))).toEqual([0]);
    expect((pickFrame.pick as FixtureBlock).selected).toBe(0);
  });

  it('prints the frame’s meta line and counts the box column', () => {
    const view = paint(pickFrame.pick as FixtureBlock);
    expect(view.meta.text).toBe('PARTY 6/6 · PC 5/16');
    expect(view.meta.text).toBe(t('trade.meta', { party: 6, pc: 5 }));
    expect(view.pc).toHaveLength(5);
    expect(view.pc.map((cell) => cell.name)).toEqual(['Abra', 'Machop', 'Oddish', 'Psyduck', 'Ponyta']);
    expect(view.message.text).toBe('Pick the Pokémon you will give away.');
  });

  it('offers the give-away press while the room can still trade', () => {
    const view = paint(pickFrame.pick as FixtureBlock);
    expect(view.give).not.toBeNull();
    expect(view.give!.label).toBe('GIVE AWAY');
    expect(view.give!.enabled).toBe(true);
    expect(view.close.label).toBe('✕');
  });

  it('paints the pair’s result block: SHELLDER, water, the level line', () => {
    const view = paint(pickFrame.result as FixtureBlock);
    expect(view.kind).toBe('result');
    expect(view.result!.name).toBe('SHELLDER');
    expect(view.result!.type!.id).toBe('water');
    expect(view.result!.frame).toBe(90);
    expect(view.result!.added).toBe(t('trade.added'));
    expect(view.result!.kicker).toBe(t('trade.received'));
    expect(view.result!.button.label).toBe(t('trade.close'));
  });
});

describe('design/fixtures/03j-panels-trade-result.json', () => {
  it('is the frame’s own slug over a snapshot state that passes isHudState', () => {
    expect(resultFrame.slug).toBe('03j-panels-trade-result');
    expect(isHudState(resultFrame.state)).toBe(true);
  });

  it('pins a spent room: canTrade false disables the give-away press', () => {
    const view = paint(resultFrame.pick as FixtureBlock);
    expect(view.kind).toBe('pick');
    expect(view.give!.enabled).toBe(false);
    expect(view.message.text).toBe('The trade in this room is done.');
    expect(view.party).toHaveLength(5);
  });

  it('pins the result card the frame draws', () => {
    const view = paint(resultFrame.result as FixtureBlock);
    expect(view.result!.name).toBe('SHELLDER');
    expect(view.result!.type).toEqual({ id: 'water', box: { x: 268, y: 296, w: 24, h: 24 } });
    expect(view.result!.added).toBe('ADDED TO YOUR PARTY');
    expect(view.result!.nameBox).toEqual({ x: 24, y: 232, w: 512, h: 30 });
    expect(view.result!.addedBox).toEqual({ x: 24, y: 268, w: 512, h: 16 });
    expect(view.give).toBeNull();
  });
});
