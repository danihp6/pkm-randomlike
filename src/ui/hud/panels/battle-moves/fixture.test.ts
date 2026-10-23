import { describe, expect, it } from 'vitest';
import fixture from '../../../../../design/fixtures/05-battle-hud.json';
import { t } from '../../../../i18n';
import { isHudState } from '../../fixtures';
import { battleMovesBox, battleMovesView } from './view';

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

  it('is the desktop card at 1280×800, as battleMovesBox derives it', () => {
    expect(fixture.moves.card).toStrictEqual(battleMovesBox({ width: 1280, height: 800 }));
  });

  it('paints the frame s four cells in order', () => {
    const view = battleMovesView(fixture.moves);
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
    const first = battleMovesView(fixture.moves).slots[0]!;
    expect(first.pp).toBe(t('move.pp', { pp: 12, max: 15 }));
    expect(first.power).toBe(t('move.pwr', { value: 90 }));
    expect(first.accuracy).toBe(t('move.acc', { value: 100 }));
    expect(first.powerTone).toBe('level');
    expect(first.accuracyTone).toBe('level');
    expect(first.enabled).toBe(true);
  });

  it('marks the first cell selected and floats its description', () => {
    const view = battleMovesView(fixture.moves);
    expect(view.slots.filter((slot) => slot.selected)).toHaveLength(1);
    expect(view.slots[0]!.selected).toBe(true);
    expect(view.info).not.toBeNull();
    expect(view.info!.title).toBe('FLAMETHROWER');
    expect(view.info!.type).toBe('fire');
    expect(view.info!.category).toBe('Special');
    expect(view.info!.text).toBe(fixture.moves.cells[0]!.desc);
    expect(view.info!.box.h).toBe(48 + 13 * 3);
  });

  it('draws the MEGA column and no G-MAX one', () => {
    const view = battleMovesView(fixture.moves);
    expect(view.mega).not.toBeNull();
    expect(view.mega!.armed).toBe(false);
    expect(view.mega!.label).toBe(t('battle.mega'));
    expect(view.gmax).toBeNull();
  });
});
