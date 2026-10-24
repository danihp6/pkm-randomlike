import { describe, expect, it } from 'vitest';
import fixture from '../../../../../design/fixtures/05c-battle-bag.json';
import { t } from '../../../../i18n';
import { isHudState } from '../../fixtures';
import { battleBagView, type BattleBagInput } from './view';

const BAG = fixture.bag as BattleBagInput;

describe('design/fixtures/05c-battle-bag.json', () => {
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

  it('is the desktop card at 1280×800, as the battle menu box derives it', () => {
    expect(BAG.card).toStrictEqual({ x: 276, y: 582, w: 728, h: 192 });
    expect(battleBagView(BAG).box).toStrictEqual(BAG.card);
  });

  it("carries the frame's two pocket labels", () => {
    const view = battleBagView(BAG);
    expect(view.tabs.map((tab) => tab.category)).toStrictEqual(['consumable', 'ball']);
    expect(view.tabs.map((tab) => tab.label)).toStrictEqual(['CONSUMIBLES', 'POKEBALLS']);
    expect(view.tabs.map((tab) => tab.active)).toStrictEqual([true, false]);
  });

  it('prints the frame s SEARCH ITEMS placeholder', () => {
    const view = battleBagView(BAG);
    expect(view.search.placeholder).toBe(t('hud.searchItems'));
    expect(view.search.placeholder.toUpperCase().startsWith('SEARCH ITEMS')).toBe(true);
    expect(view.search.text).toBe('');
    expect(view.search.focused).toBe(false);
  });

  it('paints the frame s eight stacks in order, with their quantities', () => {
    const view = battleBagView(BAG);
    expect(view.cells.slice(0, 8).map((cell) => cell.name)).toStrictEqual([
      'Potion',
      'Super Potion',
      'Hyper Potion',
      'Poke Ball',
      'Great Ball',
      'Ultra Ball',
      'Antidote',
      'Awakening',
    ]);
    expect(view.cells.slice(0, 8).map((cell) => `\u00d7${cell.count}`)).toStrictEqual([
      '\u00d73',
      '\u00d72',
      '\u00d71',
      '\u00d712',
      '\u00d75',
      '\u00d74',
      '\u00d72',
      '\u00d71',
    ]);
    expect(view.cells.slice(8).map((cell) => cell.itemId)).toStrictEqual(['', '']);
  });

  it('marks the first stack selected and reads its line', () => {
    const view = battleBagView(BAG);
    expect(view.cells.filter((cell) => cell.selected).map((cell) => cell.index)).toStrictEqual([0]);
    expect(view.detail.text).toBe('Potion x3');
    expect(view.empty).toBeNull();
  });

  it("floats the frame's Potion card above the grid", () => {
    const view = battleBagView(BAG);
    expect(view.info).not.toBeNull();
    expect(view.info!.text).toBe(fixture.bag.info.text);
    expect(view.info!.text).toContain('A SPRAY-TYPE MEDICINE.');
    expect(view.info!.text).toContain('RESTORES 20 HP TO ONE POKEMON.');
    expect(view.info!.box.w).toBe(320);
    expect(view.info!.box.y + view.info!.box.h).toBe(view.grid.box.y - 8);
  });
});
