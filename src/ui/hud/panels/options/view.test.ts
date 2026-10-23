import { describe, expect, it } from 'vitest';
import { KEYBIND_ACTIONS, keyLabel } from '../../../../data/keybinds';
import { defaultSettings } from '../../../../engine/save';
import { t } from '../../../../i18n';
import { settingsRows } from '../../../settingsScreen';
import fixture from '../../../../../design/fixtures/02-options.json';
import { OPTIONS_SLUG, fixtureOptionsView, liveOptionsView } from './view';

const settings = { ...defaultSettings(), volume: 0.7 };
const rows = settingsRows(false);
const stepCount = rows.filter((row) => row.kind === 'step').length;

function clone(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(fixture)) as Record<string, unknown>;
}

function panelOf(payload: Record<string, unknown>): Record<string, unknown> {
  return payload.panel as Record<string, unknown>;
}

describe('liveOptionsView', () => {
  it('splits settingsRows(false) into the gameplay rows and one row per keybind action', () => {
    const view = liveOptionsView(settings, false, 0, false);
    expect(stepCount).toBe(7);
    expect(view.groups.map((group) => group.id)).toEqual(['gameplay', 'keybinds']);
    expect(view.groups[0]!.rows).toHaveLength(stepCount);
    expect(view.groups[1]!.rows).toHaveLength(KEYBIND_ACTIONS.length);
    expect(view.groups[1]!.rows.map((row) => row.id)).toEqual([...KEYBIND_ACTIONS]);
    expect(view.groups[1]!.rows.every((row) => row.kind === 'keybind')).toBe(true);
  });

  it('keeps the step rows in the model order and prints their settingValue', () => {
    const view = liveOptionsView(settings, false, 0, false);
    expect(view.groups[0]!.rows.map((row) => row.id)).toEqual([
      'textSpeed',
      'volume',
      'alwaysRun',
      'hudTransparent',
      'reducedFlash',
      'aiLevel',
      'language',
    ]);
    const volume = view.groups[0]!.rows.find((row) => row.id === 'volume');
    expect(volume?.kind).toBe('slider');
    expect(volume?.fraction).toBe(0.7);
    expect(volume?.value).toBe('70%');
    const textSpeed = view.groups[0]!.rows.find((row) => row.id === 'textSpeed');
    expect(textSpeed?.kind).toBe('step');
    expect(textSpeed?.fraction).toBeNull();
    expect(textSpeed?.on).toBeNull();
  });

  it('draws the three boolean settings as toggles carrying their state', () => {
    const view = liveOptionsView(settings, false, 0, false);
    for (const id of ['alwaysRun', 'hudTransparent', 'reducedFlash'] as const) {
      const row = view.groups[0]!.rows.find((entry) => entry.id === id);
      expect(row?.kind, id).toBe('toggle');
      expect(row?.on, id).toBe(settings[id]);
      expect(row?.value, id).toBe(settings[id] ? t('settings.toggle.on') : t('settings.toggle.off'));
    }
  });

  it('prints each keybind through keyLabel', () => {
    const view = liveOptionsView(settings, false, 0, false);
    for (const action of KEYBIND_ACTIONS) {
      const row = view.groups[1]!.rows.find((entry) => entry.id === action);
      expect(row?.value, action).toBe(keyLabel(settings.keybinds[action]));
      expect(row?.fraction, action).toBeNull();
      expect(row?.on, action).toBeNull();
    }
    const head = KEYBIND_ACTIONS[0];
    expect(view.groups[1]!.rows[0]!.label).toBe(t(`keybind.${head}`));
  });

  it('marks the row at index as selected, and null past the list', () => {
    const view = liveOptionsView(settings, false, 4, false);
    expect(view.selected).toBe(rows[4]!.id);
    expect(liveOptionsView(settings, false, -1, false).selected).toBeNull();
    expect(liveOptionsView(settings, false, rows.length, false).selected).toBeNull();
  });

  it('prints the press-key hint while capturing, on the selected keybind row only', () => {
    const keybind = rows.findIndex((row) => row.kind === 'keybind');
    const view = liveOptionsView(settings, false, keybind, true);
    const selected = view.groups[1]!.rows[0]!;
    expect(selected.value).toBe(t('settings.pressKey'));
    expect(view.groups[0]!.rows.every((row) => row.value !== t('settings.pressKey'))).toBe(true);
    expect(liveOptionsView(settings, false, keybind, false).groups[1]!.rows[0]!.value).toBe(
      keyLabel(settings.keybinds[KEYBIND_ACTIONS[0]]),
    );
  });

  it('drops the keybind rows on a touch screen and still carries the two groups', () => {
    const view = liveOptionsView(settings, true, 0, false);
    expect(settingsRows(true)).toHaveLength(7);
    expect(view.groups[0]!.rows).toHaveLength(7);
    expect(view.groups[1]!.rows).toEqual([]);
    expect(view.groups.map((group) => group.id)).toEqual(['gameplay', 'keybinds']);
  });

  it('carries the chrome strings and no reset control', () => {
    const view = liveOptionsView(settings, false, 0, false);
    expect(view.title).toBe(t('settings.title'));
    expect(view.subtitle).toBe(t('settings.subtitle'));
    expect(view.footer).toBe(t('settings.footer'));
    expect(view.back).toBe(t('settings.back'));
    expect(view.reset).toBeNull();
    expect(view.groups[0]!.title).toBe(t('settings.group.gameplay'));
    expect(view.groups[1]!.title).toBe(t('settings.group.keybinds'));
  });
});

describe('fixtureOptionsView', () => {
  it('answers to the slug this task ships', () => {
    expect(OPTIONS_SLUG).toBe('02-options');
    expect(fixture.slug).toBe(OPTIONS_SLUG);
  });

  it('returns the frame’s own content from the fixture file', () => {
    const view = fixtureOptionsView(fixture);
    expect(view).not.toBeNull();
    expect(view!.title).toBe('SETTINGS');
    expect(view!.subtitle).toBe('Changes apply immediately and save to this browser.');
    expect(view!.footer).toBe('Keybinds are shared with the route and battle screens.');
    expect(view!.back).toBe('BACK');
    expect(view!.reset).toBe('RESET DEFAULTS');
    expect(view!.selected).toBe('textSpeed');
    expect(view!.groups[0]!.rows).toHaveLength(5);
    expect(view!.groups[1]!.rows).toHaveLength(7);
    expect(view!.groups[0]!.rows.find((row) => row.id === 'volume')?.fraction).toBe(0.7);
    expect(view!.groups[0]!.rows.find((row) => row.id === 'menuOpacity')?.fraction).toBe(0.8);
    expect(view!.groups[0]!.rows.find((row) => row.id === 'alwaysRun')?.on).toBe(false);
  });

  it('accepts the panel block on its own', () => {
    expect(fixtureOptionsView(clone().panel)).not.toBeNull();
  });

  it('is null without a panel block', () => {
    const payload = clone();
    delete payload.panel;
    expect(fixtureOptionsView(payload)).toBeNull();
  });

  it('is null for anything that is not an object', () => {
    for (const value of [null, undefined, 3, 'panel', [], [{ title: 'X' }]]) {
      expect(fixtureOptionsView(value), String(value)).toBeNull();
    }
  });

  it('is null for a row with an unknown kind', () => {
    const payload = clone();
    const rowsOf = panelOf(payload).groups as { rows: Record<string, unknown>[] }[];
    rowsOf[0]!.rows[0]!.kind = 'wheel';
    expect(fixtureOptionsView(payload)).toBeNull();
  });

  it('is null for a slider whose fraction is out of range or missing', () => {
    const payload = clone();
    const rowsOf = panelOf(payload).groups as { rows: Record<string, unknown>[] }[];
    rowsOf[0]!.rows[1]!.fraction = 1.5;
    expect(fixtureOptionsView(payload)).toBeNull();
    rowsOf[0]!.rows[1]!.fraction = null;
    expect(fixtureOptionsView(payload)).toBeNull();
  });

  it('is null for a toggle whose on is not a boolean', () => {
    const payload = clone();
    const rowsOf = panelOf(payload).groups as { rows: Record<string, unknown>[] }[];
    rowsOf[0]!.rows[2]!.on = 'yes';
    expect(fixtureOptionsView(payload)).toBeNull();
  });

  it('is null when a group is missing, doubled or renamed', () => {
    const payload = clone();
    const groups = panelOf(payload).groups as Record<string, unknown>[];
    expect(fixtureOptionsView({ ...payload, panel: { ...panelOf(payload), groups: [groups[0]] } })).toBeNull();
    expect(
      fixtureOptionsView({ ...payload, panel: { ...panelOf(payload), groups: [groups[0], groups[0]] } }),
    ).toBeNull();
    const renamed = JSON.parse(JSON.stringify(fixture)) as Record<string, unknown>;
    (panelOf(renamed).groups as Record<string, unknown>[])[1]!.id = 'keys';
    expect(fixtureOptionsView(renamed)).toBeNull();
  });

  it('is null for a row without an id or a label', () => {
    const payload = clone();
    const rowsOf = panelOf(payload).groups as { rows: Record<string, unknown>[] }[];
    rowsOf[0]!.rows[0]!.id = '';
    expect(fixtureOptionsView(payload)).toBeNull();
    rowsOf[0]!.rows[0]!.id = 'textSpeed';
    rowsOf[0]!.rows[0]!.label = 4;
    expect(fixtureOptionsView(payload)).toBeNull();
  });

  it('mutates nothing', () => {
    const payload = clone();
    const before = JSON.stringify(payload);
    fixtureOptionsView(payload);
    expect(JSON.stringify(payload)).toBe(before);
  });
});
