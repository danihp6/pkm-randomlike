import { describe, expect, it } from 'vitest';
import fixture from '../../../../../design/fixtures/05-battle-hud.json';
import { t } from '../../../../i18n';
import { isHudState } from '../../fixtures';
import { INFO_CARD_H, battleMovesBox, battleMovesView } from './view';

describe('design/fixtures/05-battle-hud.json', () => {
  it('carries an empty HudState, which the panel itself does not read', () => {
    expect(isHudState(fixture.state)).toBe(true);
    expect(fixture.state).toStrictEqual({
      party: [],
      bag: [],
      money: null,
      route: null,
      battle: null,
      notice: null,
    });
  });

  it('pins the frame s card: the same right edge and height as battleMovesBox', () => {
    const derived = battleMovesBox({ width: 1280, height: 800 });
    // The frame predates the HP column s clearance: the menu keeps its right edge and
    // its height, and the shipped card only starts further right, clear of the boxes.
    expect(fixture.moves.card.y).toBe(derived.y);
    expect(fixture.moves.card.h).toBe(derived.h);
    expect(fixture.moves.card.x + fixture.moves.card.w).toBe(derived.x + derived.w);
    expect(derived.x).toBeGreaterThanOrEqual(fixture.moves.card.x);
    expect(derived.w).toBeLessThanOrEqual(fixture.moves.card.w);
  });

  it('paints the frame s four cells in order', () => {
    const view = battleMovesView({ ...fixture.moves, target: null });
    expect(view.slots).toHaveLength(4);
    expect(view.slots.map((slot) => slot.name)).toStrictEqual([
      'FLAMETHROWER',
      'AIR SLASH',
      'DRAGON CLAW',
      'EARTHQUAKE',
    ]);
    expect(view.slots.map((slot) => slot.type)).toStrictEqual(['fire', 'flying', 'dragon', 'ground']);
    expect(view.slots.map((slot) => slot.empty)).toStrictEqual([false, false, false, false]);
  });

  it('reads the first cell s PP, power and accuracy as the frame prints them', () => {
    const first = battleMovesView({ ...fixture.moves, target: null }).slots[0]!;
    expect(first.pp).toBe(t('move.pp', { pp: 12, max: 15 }));
    expect(first.power).toBe(t('move.pwr', { value: 90 }));
    expect(first.accuracy).toBe(t('move.acc', { value: 100 }));
    expect(first.powerTone).toBe('level');
    expect(first.accuracyTone).toBe('level');
    expect(first.enabled).toBe(true);
  });

  it('marks the first cell selected and describes it in the card', () => {
    const view = battleMovesView({ ...fixture.moves, target: null });
    expect(view.slots.filter((slot) => slot.selected)).toHaveLength(1);
    expect(view.slots[0]!.selected).toBe(true);
    expect(view.info).not.toBeNull();
    expect(view.info!.title).toBe('FLAMETHROWER');
    expect(view.info!.type).toBe('fire');
    expect(view.info!.category).toBe('Special');
    expect(view.info!.text).toBe(fixture.moves.cells[0]!.desc);
    expect(view.info!.pp).toBe(t('move.pp', { pp: 12, max: 15 }));
    expect(view.info!.power).toBe(t('move.pwr', { value: 90 }));
    expect(view.info!.accuracy).toBe(t('move.acc', { value: 100 }));
    expect(view.info!.box.h).toBe(INFO_CARD_H);
  });

  it('draws the move card as the frame s own 160 px detail, 8 px above the menu', () => {
    const view = battleMovesView({ ...fixture.moves, target: null });
    const card = fixture.moves.card;
    expect(view.info!.box).toStrictEqual({
      x: card.x + 20,
      y: card.y - 8 - 160,
      w: card.w - 40,
      h: 160,
    });
    // The frame's own `attack detail` is 576×160 at (664,372), above its 576 px menu:
    // the same height, anchored to this menu's top edge instead of the frame's.
    expect(view.info!.box.h).toBe(160);
  });

  it('draws the MEGA column and no G-MAX one', () => {
    const view = battleMovesView({ ...fixture.moves, target: null });
    expect(view.mega).not.toBeNull();
    expect(view.mega!.armed).toBe(false);
    expect(view.mega!.label).toBe(t('battle.mega'));
    expect(view.gmax).toBeNull();
  });
});
