import {
  KEYBIND_ACTIONS,
  KEYBIND_LABELS,
  isKeybindAction,
  keyLabel,
  withBinding,
  type KeybindAction,
} from '../data/keybinds';
import { TILESET_PREFERENCES, tilesetLabel } from '../data/tilesets/ids';
import type { Settings, TextSpeed } from '../engine/save';

/**
 * The settings screen's model (Phase 7): the rows the player can change and the
 * pure rules for changing them. The scene only draws it and feeds it keys, the
 * same split as `partyScreen.ts`.
 *
 * Two kinds of row share the list: a `step` row (text speed, volume, tileset)
 * whose value walks a fixed list with left/right, and a `keybind` row whose
 * value is one key, changed by a capture that the scene runs. Text speed and
 * volume clamp at the ends (like the original options menus) and the tileset
 * preference walks `auto` plus the registered ids.
 */

export const TEXT_SPEED_ORDER: readonly TextSpeed[] = ['slow', 'normal', 'fast'];

/** Volume moves in ten-point steps; the stored value is normalised to one. */
export const VOLUME_STEPS = 10;

export type SettingsRowId = 'textSpeed' | 'volume' | 'tileset' | KeybindAction;

export type SettingsRowKind = 'step' | 'keybind';

export type SettingsRow = Readonly<{
  id: SettingsRowId;
  label: string;
  hint: string;
  kind: SettingsRowKind;
}>;

const STEP_ROWS: readonly SettingsRow[] = [
  {
    id: 'textSpeed',
    label: 'Text speed',
    hint: 'How fast the battle text types itself out.',
    kind: 'step',
  },
  {
    id: 'volume',
    label: 'Volume',
    hint: 'Master volume for every sound the game plays.',
    kind: 'step',
  },
  {
    id: 'tileset',
    label: 'Tileset',
    hint: 'Auto follows the biome; anything else is forced everywhere.',
    kind: 'step',
  },
];

const KEYBIND_ROWS: readonly SettingsRow[] = KEYBIND_ACTIONS.map((action) => ({
  id: action,
  label: KEYBIND_LABELS[action],
  hint: 'Press confirm to rebind this key.',
  kind: 'keybind',
}));

export const SETTINGS_ROWS: readonly SettingsRow[] = [...STEP_ROWS, ...KEYBIND_ROWS];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function textSpeedLabel(speed: TextSpeed): string {
  return speed.charAt(0).toUpperCase() + speed.slice(1);
}

/** Whether a row's value is set by stepping it (as opposed to pressing a key). */
export function isStepRow(row: SettingsRow): boolean {
  return row.kind === 'step';
}

/** The value as the screen prints it. */
export function settingValue(settings: Settings, row: SettingsRowId): string {
  switch (row) {
    case 'textSpeed':
      return textSpeedLabel(settings.textSpeed);
    case 'volume':
      return `${Math.round(settings.volume * 100)}%`;
    case 'tileset':
      return tilesetLabel(settings.tileset);
    default:
      return isKeybindAction(row) ? keyLabel(settings.keybinds[row]) : '';
  }
}

/** Steps a step row's value, clamped at both ends; `delta` 0 is the identity. */
export function changeSetting(settings: Settings, row: SettingsRowId, delta: number): Settings {
  if (delta === 0) return settings;
  switch (row) {
    case 'textSpeed': {
      const index = clamp(TEXT_SPEED_ORDER.indexOf(settings.textSpeed) + delta, 0, TEXT_SPEED_ORDER.length - 1);
      return { ...settings, textSpeed: TEXT_SPEED_ORDER[index] };
    }
    case 'volume': {
      const step = clamp(Math.round(settings.volume * VOLUME_STEPS) + delta, 0, VOLUME_STEPS);
      return { ...settings, volume: step / VOLUME_STEPS };
    }
    case 'tileset': {
      const index = clamp(
        TILESET_PREFERENCES.indexOf(settings.tileset) + delta,
        0,
        TILESET_PREFERENCES.length - 1,
      );
      return { ...settings, tileset: TILESET_PREFERENCES[index] };
    }
    default:
      return settings;
  }
}

/** Rebinds one action, swapping with whichever action held the key (see `D23`). */
export function rebindSetting(settings: Settings, action: KeybindAction, key: string): Settings {
  const keybinds = withBinding(settings.keybinds, action, key);
  return keybinds === settings.keybinds ? settings : { ...settings, keybinds };
}

/** Moves the highlighted row, clamped to the list. */
export function moveSettingIndex(index: number, delta: number): number {
  return clamp(index + delta, 0, SETTINGS_ROWS.length - 1);
}

/** The row at an index, clamped so a stale index can never read past the list. */
export function settingsRow(index: number): SettingsRow {
  return SETTINGS_ROWS[clamp(index, 0, SETTINGS_ROWS.length - 1)];
}
