import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../engine/save';
import {
  changeSetting,
  moveSettingIndex,
  settingValue,
  settingsRow,
  SETTINGS_ROWS,
  TEXT_SPEED_ORDER,
  VOLUME_STEPS,
} from './settingsScreen';

describe('rows', () => {
  it('lists text speed, volume and tileset', () => {
    expect(SETTINGS_ROWS.map((row) => row.id)).toEqual(['textSpeed', 'volume', 'tileset']);
  });

  it('clamps a selection to the list', () => {
    expect(moveSettingIndex(0, 1)).toBe(1);
    expect(moveSettingIndex(2, 1)).toBe(2);
    expect(moveSettingIndex(0, -1)).toBe(0);
    expect(settingsRow(9).id).toBe('tileset');
    expect(settingsRow(-4).id).toBe('textSpeed');
  });
});

describe('settingValue', () => {
  it('prints each row', () => {
    expect(settingValue(defaultSettings(), 'textSpeed')).toBe('Normal');
    expect(settingValue(defaultSettings(), 'volume')).toBe('80%');
    expect(settingValue(defaultSettings(), 'tileset')).toBe('Auto (biome)');
    expect(settingValue({ ...defaultSettings(), tileset: 'wood' }, 'tileset')).toBe('Woods');
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

  it('keeps VOLUME_STEPS in step with the percentage the screen prints', () => {
    expect(VOLUME_STEPS).toBe(10);
    expect(settingValue({ ...defaultSettings(), volume: 1 / VOLUME_STEPS }, 'volume')).toBe('10%');
  });
});
