import { describe, expect, it } from 'vitest';
import { DEFAULT_KEYBINDS } from '../data/keybinds';
import { defaultSettings } from '../engine/save';
import {
  changeSetting,
  isStepRow,
  moveSettingIndex,
  rebindSetting,
  settingValue,
  settingsRow,
  SETTINGS_ROWS,
  TEXT_SPEED_ORDER,
  VOLUME_STEPS,
} from './settingsScreen';

describe('rows', () => {
  it('lists the three step settings then one row per keybind action', () => {
    expect(SETTINGS_ROWS.map((row) => row.id)).toEqual([
      'textSpeed',
      'volume',
      'tileset',
      'confirm',
      'cancel',
      'up',
      'down',
      'left',
      'right',
      'party',
      'settings',
    ]);
    expect(SETTINGS_ROWS.slice(0, 3).every(isStepRow)).toBe(true);
    expect(SETTINGS_ROWS.slice(3).every((row) => !isStepRow(row))).toBe(true);
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
    expect(settingValue(defaultSettings(), 'tileset')).toBe('Auto (biome)');
    expect(settingValue({ ...defaultSettings(), tileset: 'wood' }, 'tileset')).toBe('Woods');
  });

  it('prints a keybind as its key, arrows and all', () => {
    expect(settingValue(defaultSettings(), 'confirm')).toBe('Z');
    expect(settingValue(defaultSettings(), 'cancel')).toBe('X');
    expect(settingValue(defaultSettings(), 'up')).toBe('\u2191');
    expect(settingValue({ ...defaultSettings(), keybinds: { ...DEFAULT_KEYBINDS, party: 'Q' } }, 'party')).toBe('Q');
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

  it('cycles the tileset from auto through every id and back-clamps', () => {
    let settings = changeSetting(defaultSettings(), 'tileset', 1);
    expect(settings.tileset).toBe('placeholder');
    settings = changeSetting(settings, 'tileset', 1);
    expect(settings.tileset).toBe('wood');
    expect(changeSetting(settings, 'tileset', 1).tileset).toBe('wood');
    settings = changeSetting(settings, 'tileset', -2);
    expect(settings.tileset).toBe('auto');
    expect(changeSetting(settings, 'tileset', -1).tileset).toBe('auto');
  });

  it('never mutates the settings it is given', () => {
    const settings = defaultSettings();
    changeSetting(settings, 'textSpeed', 1);
    changeSetting(settings, 'volume', -3);
    changeSetting(settings, 'tileset', 2);
    expect(settings).toEqual(defaultSettings());
  });

  it('treats a zero delta as the identity', () => {
    const settings = defaultSettings();
    expect(changeSetting(settings, 'volume', 0)).toBe(settings);
    expect(changeSetting(settings, 'tileset', 0)).toBe(settings);
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

describe('rebindSetting', () => {
  it('rebinds one action and leaves the rest', () => {
    const settings = rebindSetting(defaultSettings(), 'confirm', 'Q');
    expect(settings.keybinds.confirm).toBe('Q');
    expect(settings.keybinds.cancel).toBe('X');
  });

  it('swaps when the key already belongs to another action', () => {
    const settings = rebindSetting(defaultSettings(), 'up', 'X');
    expect(settings.keybinds.up).toBe('X');
    expect(settings.keybinds.cancel).toBe('UP');
  });

  it('returns the same settings when the key does not change', () => {
    const settings = defaultSettings();
    expect(rebindSetting(settings, 'confirm', 'Z')).toBe(settings);
  });
});
