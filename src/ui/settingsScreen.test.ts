import { describe, expect, it } from 'vitest';
import { DEFAULT_KEYBINDS } from '../data/keybinds';
import { defaultSettings } from '../engine/save';
import {
  changeSetting,
  cycleSetting,
  isStepRow,
  moveSettingIndex,
  rebindSetting,
  settingValue,
  settingsRow,
  settingsRows,
  SETTINGS_ROWS,
  TEXT_SPEED_ORDER,
  volumeFromFraction,
  VOLUME_STEPS,
} from './settingsScreen';

describe('rows', () => {
  it('lists the step settings then one row per keybind action', () => {
    expect(SETTINGS_ROWS.map((row) => row.id)).toEqual([
      'textSpeed',
      'volume',
      'alwaysRun',
      'hudTransparent',
      'confirm',
      'cancel',
      'up',
      'down',
      'left',
      'right',
      'run',
      'interact',
      'reset',
      'party',
      'bag',
      'map',
      'box',
      'settings',
    ]);
    expect(SETTINGS_ROWS.slice(0, 4).every(isStepRow)).toBe(true);
    expect(SETTINGS_ROWS.slice(4).every((row) => !isStepRow(row))).toBe(true);
  });

  it('hides the keybind rows on a touch screen', () => {
    expect(settingsRows(false)).toBe(SETTINGS_ROWS);
    const touch = settingsRows(true);
    expect(touch.every(isStepRow)).toBe(true);
    expect(touch.some((row) => row.id === 'confirm')).toBe(false);
    expect(touch.map((row) => row.id)).toEqual(['textSpeed', 'volume', 'alwaysRun', 'hudTransparent']);
  });

  it('clamps a selection to the list', () => {
    const last = SETTINGS_ROWS.length - 1;
    expect(moveSettingIndex(0, 1)).toBe(1);
    expect(moveSettingIndex(last, 1)).toBe(last);
    expect(moveSettingIndex(0, -1)).toBe(0);
    expect(settingsRow(99).id).toBe('settings');
    expect(settingsRow(-4).id).toBe('textSpeed');
  });
});

describe('settingValue', () => {
  it('prints each setting', () => {
    expect(settingValue(defaultSettings(), 'textSpeed')).toBe('Normal');
    expect(settingValue(defaultSettings(), 'volume')).toBe('80%');
    expect(settingValue(defaultSettings(), 'alwaysRun')).toBe('On');
    expect(settingValue({ ...defaultSettings(), alwaysRun: false }, 'alwaysRun')).toBe('Off');
    expect(settingValue(defaultSettings(), 'hudTransparent')).toBe('Off');
    expect(settingValue({ ...defaultSettings(), hudTransparent: true }, 'hudTransparent')).toBe('On');
  });

  it('prints a keybind as its key, arrows and all', () => {
    expect(settingValue(defaultSettings(), 'confirm')).toBe('E');
    expect(settingValue(defaultSettings(), 'cancel')).toBe('Q');
    expect(settingValue(defaultSettings(), 'up')).toBe('\u2191');
    expect(
      settingValue({ ...defaultSettings(), keybinds: { ...DEFAULT_KEYBINDS, settings: 'Y' } }, 'settings'),
    ).toBe('Y');
  });
});

describe('changeSetting', () => {
  it('steps the text speed and stops at the ends', () => {
    let settings = defaultSettings();
    expect(settings.textSpeed).toBe('normal');
    settings = changeSetting(settings, 'textSpeed', 1);
    expect(settings.textSpeed).toBe('fast');
    expect(changeSetting(settings, 'textSpeed', 1).textSpeed).toBe('fast');
    settings = changeSetting(settings, 'textSpeed', -1);
    settings = changeSetting(settings, 'textSpeed', -1);
    settings = changeSetting(settings, 'textSpeed', -1);
    expect(settings.textSpeed).toBe('slow');
    expect(TEXT_SPEED_ORDER).toEqual(['slow', 'normal', 'fast']);
  });

  it('steps the volume in ten-point steps, clamped to 0..1', () => {
    let settings = changeSetting(defaultSettings(), 'volume', 1);
    expect(settings.volume).toBeCloseTo(0.9);
    for (let i = 0; i < 20; i++) settings = changeSetting(settings, 'volume', -1);
    expect(settings.volume).toBe(0);
    for (let i = 0; i < 20; i++) settings = changeSetting(settings, 'volume', 1);
    expect(settings.volume).toBe(1);
    expect(changeSetting(settings, 'volume', 1).volume).toBe(1);
  });

  it('normalises an off-step volume to the nearest step on the first change', () => {
    const settings = changeSetting({ ...defaultSettings(), volume: 0.83 }, 'volume', 1);
    expect(settings.volume).toBeCloseTo(0.9);
  });

  it('turns a slider position into a volume snapped to the ten-point steps', () => {
    expect(volumeFromFraction(0)).toBe(0);
    expect(volumeFromFraction(1)).toBe(1);
    expect(volumeFromFraction(-0.5)).toBe(0);
    expect(volumeFromFraction(2)).toBe(1);
    expect(volumeFromFraction(0.5)).toBeCloseTo(0.5);
    expect(volumeFromFraction(0.57)).toBeCloseTo(0.6);
    expect(volumeFromFraction(0.54)).toBeCloseTo(0.5);
  });

  it('toggles always-run off and back on', () => {
    let settings = defaultSettings();
    expect(settings.alwaysRun).toBe(true);
    settings = changeSetting(settings, 'alwaysRun', 1);
    expect(settings.alwaysRun).toBe(false);
    settings = changeSetting(settings, 'alwaysRun', -1);
    expect(settings.alwaysRun).toBe(true);
  });

  it('toggles transparent HUD off and back on', () => {
    let settings = defaultSettings();
    expect(settings.hudTransparent).toBe(false);
    settings = changeSetting(settings, 'hudTransparent', 1);
    expect(settings.hudTransparent).toBe(true);
    settings = changeSetting(settings, 'hudTransparent', -1);
    expect(settings.hudTransparent).toBe(false);
  });

  it('never mutates the settings it is given', () => {
    const settings = defaultSettings();
    changeSetting(settings, 'textSpeed', 1);
    changeSetting(settings, 'volume', -3);
    expect(settings).toEqual(defaultSettings());
  });

  it('treats a zero delta as the identity', () => {
    const settings = defaultSettings();
    expect(changeSetting(settings, 'volume', 0)).toBe(settings);
  });

  it('does nothing to a keybind row', () => {
    const settings = defaultSettings();
    expect(changeSetting(settings, 'confirm', 1)).toBe(settings);
    expect(changeSetting(settings, 'confirm', -1)).toBe(settings);
  });

  it('keeps VOLUME_STEPS in step with the percentage the screen prints', () => {
    expect(VOLUME_STEPS).toBe(10);
    expect(settingValue({ ...defaultSettings(), volume: 1 / VOLUME_STEPS }, 'volume')).toBe('10%');
  });
});

describe('cycleSetting', () => {
  it('wraps the ordered rows so a click can reach every value', () => {
    let settings = cycleSetting(defaultSettings(), 'textSpeed', 1);
    expect(settings.textSpeed).toBe('fast');
    settings = cycleSetting(settings, 'textSpeed', 1);
    expect(settings.textSpeed).toBe('slow');
    settings = cycleSetting(settings, 'textSpeed', -1);
    expect(settings.textSpeed).toBe('fast');
  });

  it('toggles the on/off rows like changeSetting', () => {
    expect(cycleSetting(defaultSettings(), 'alwaysRun', 1).alwaysRun).toBe(false);
    expect(cycleSetting(defaultSettings(), 'hudTransparent', 1).hudTransparent).toBe(true);
  });
});

describe('rebindSetting', () => {
  it('rebinds one action and leaves the rest', () => {
    const settings = rebindSetting(defaultSettings(), 'confirm', 'K');
    expect(settings.keybinds.confirm).toBe('K');
    expect(settings.keybinds.cancel).toBe('Q');
  });

  it('swaps when the key already belongs to another action', () => {
    const settings = rebindSetting(defaultSettings(), 'up', 'Q');
    expect(settings.keybinds.up).toBe('Q');
    expect(settings.keybinds.cancel).toBe('UP');
  });

  it('returns the same settings when the key does not change', () => {
    const settings = defaultSettings();
    expect(rebindSetting(settings, 'confirm', 'E')).toBe(settings);
  });
});
