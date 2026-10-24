import { describe, expect, it } from 'vitest';
import fixture from '../../../../../design/fixtures/05d-battle-pokemon.json';
import { isHudState } from '../../fixtures';
import { battleSwitchBox, battleSwitchView, fixtureSwitchInput } from './view';

const DESKTOP = { width: 1280, height: 800 } as const;
const PHONE = { width: 390, height: 844 } as const;

describe('design/fixtures/05d-battle-pokemon.json', () => {
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
    expect(fixture.switch.card).toStrictEqual({ x: 276, y: 582, w: 728, h: 192 });
    expect(fixture.switch.card).toStrictEqual(battleSwitchBox(DESKTOP));
    expect(fixtureSwitchInput(fixture, DESKTOP)).not.toBeNull();
    expect(fixtureSwitchInput(fixture, DESKTOP)!.card).toStrictEqual(fixture.switch.card);
    expect(fixtureSwitchInput(fixture, PHONE)!.card).toStrictEqual(battleSwitchBox(PHONE));
  });

  it('paints the frame s six members in party order', () => {
    const input = fixtureSwitchInput(fixture, DESKTOP)!;
    expect(input.open).toBe(true);
    expect(input.selected).toBe(0);
    expect(input.rows.map((row) => row.name)).toStrictEqual([
      'CHARIZARD',
      'PIKACHU',
      'BULBASAUR',
      'GASTLY',
      'CHARMANDER',
      'SQUIRTLE',
    ]);
    expect(input.rows.map((row) => row.level)).toStrictEqual([36, 32, 30, 28, 24, 22]);
    expect(battleSwitchView(input).rows).toHaveLength(6);
    expect(battleSwitchView(input).slots).toHaveLength(6);
  });

  it('carries exactly the two status marks, and only on their own rows', () => {
    const view = battleSwitchView(fixtureSwitchInput(fixture, DESKTOP)!);
    expect(view.rows.map((row) => row.statusLabel)).toStrictEqual([
      null,
      null,
      'PAR',
      'PSN',
      null,
      null,
    ]);
    expect(view.rows.filter((row) => row.status !== null).map((row) => row.index)).toStrictEqual([2, 3]);
  });

  it('spans the three hpColor bands at their boundaries', () => {
    const view = battleSwitchView(fixtureSwitchInput(fixture, DESKTOP)!);
    expect(view.rows.map((row) => (row.hp === null ? null : row.hp.tone))).toStrictEqual([
      'healthy',
      'healthy',
      'caution',
      'caution',
      'danger',
      null,
    ]);
    expect(view.rows[2].fraction).toBe(0.5);
    expect(view.rows[4].fraction).toBe(0.2);
    expect(view.rows[5].hp).toBeNull();
  });

  it('refuses a switch to the member already on the field', () => {
    const view = battleSwitchView(fixtureSwitchInput(fixture, DESKTOP)!);
    expect(view.rows[0].field).toBe(true);
    expect(view.rows[0].enabled).toBe(false);
    expect(view.rows.filter((row) => row.field).map((row) => row.index)).toStrictEqual([0]);
    expect(view.rows.filter((row) => !row.enabled).map((row) => row.index)).toStrictEqual([0, 5]);
  });

  it('is null without a switch block, without rows, or without a payload', () => {
    const withoutRows: unknown = { switch: { open: true, selected: 0 } };
    expect(fixtureSwitchInput({}, DESKTOP)).toBeNull();
    expect(fixtureSwitchInput({ state: fixture.state }, DESKTOP)).toBeNull();
    expect(fixtureSwitchInput(withoutRows, DESKTOP)).toBeNull();
    expect(fixtureSwitchInput(null, DESKTOP)).toBeNull();
  });
});
