import {
  KEYBIND_ACTIONS,
  KEYBIND_LABELS,
  isKeybindAction,
  keyLabel,
  withBinding,
  type KeybindAction,
} from '../data/keybinds';
import type { Settings, TextSpeed } from '../engine/save';

/**
 * The settings screen's model (Phase 7): the rows the player can change and the
 * pure rules for changing them. The scene only draws it and feeds it keys, the
 * same split as `partyScreen.ts`.
 *
 * Two kinds of row share the list: a `step` row (text speed, volume) whose value
 * walks a fixed list with left/right, and a `keybind` row whose value is one key,
 * changed by a capture that the scene runs. Text speed and volume clamp at the
 * ends (like the original options menus). The volume row is drawn as a slider, and
 * on a touch screen the keybind rows are dropped (`settingsRows`). The tileset is
 * not a preference: a route always renders its biome's own (`D10`).
 */

export const TEXT_SPEED_ORDER: readonly TextSpeed[] = ['slow', 'normal', 'fast'];

/** Volume moves in ten-point steps; the stored value is normalised to one. */
export const VOLUME_STEPS = 10;

/** The volume a slider position (0..1) picks, snapped to the ten-point steps. */
export function volumeFromFraction(fraction: number): number {
  const step = clamp(Math.round(fraction * VOLUME_STEPS), 0, VOLUME_STEPS);
  return step / VOLUME_STEPS;
}

export type SettingsRowId =
  | 'textSpeed'
  | 'volume'
  | 'alwaysRun'
  | 'hudTransparent'
  | 'reducedFlash'
  | KeybindAction;

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
    id: 'alwaysRun',
    label: 'Always run',
    hint: 'Walk at running speed without holding the run key.',
    kind: 'step',
  },
  {
    id: 'hudTransparent',
    label: 'Transparent HUD',
    hint: 'Hide the route panels’ window background, leaving only their content.',
    kind: 'step',
  },
  {
    id: 'reducedFlash',
    label: 'Reduce flashing',
    hint: 'Use calmer transitions: no full-screen flashes.',
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

/**
 * The rows on a touch screen: the step settings only. Binding keys is pointless
 * without a keyboard (and the touch pad drives the screen), so those rows are
 * hidden there.
 */
export const TOUCH_SETTINGS_ROWS: readonly SettingsRow[] = STEP_ROWS;

/** The rows the screen shows for the given device. */
export function settingsRows(touch: boolean): readonly SettingsRow[] {
  return touch ? TOUCH_SETTINGS_ROWS : SETTINGS_ROWS;
}

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
    case 'alwaysRun':
      return settings.alwaysRun ? 'On' : 'Off';
    case 'hudTransparent':
      return settings.hudTransparent ? 'On' : 'Off';
    case 'reducedFlash':
      return settings.reducedFlash ? 'On' : 'Off';
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
    case 'alwaysRun':
      return { ...settings, alwaysRun: !settings.alwaysRun };
    case 'hudTransparent':
      return { ...settings, hudTransparent: !settings.hudTransparent };
    case 'reducedFlash':
      return { ...settings, reducedFlash: !settings.reducedFlash };
    default:
      return settings;
  }
}

/**
 * Steps a step row the way a click does: the ordered rows (text speed) **wrap**
 * so every value is reachable by clicking alone, and the on/off rows simply
 * toggle. Used by the pointer path, where there is no left/right key.
 */
export function cycleSetting(settings: Settings, row: SettingsRowId, delta: number): Settings {
  const wrap = (index: number, length: number): number => ((index + delta) % length + length) % length;
  switch (row) {
    case 'textSpeed':
      return { ...settings, textSpeed: TEXT_SPEED_ORDER[wrap(TEXT_SPEED_ORDER.indexOf(settings.textSpeed), TEXT_SPEED_ORDER.length)] };
    default:
      return changeSetting(settings, row, delta);
  }
}

/** Rebinds one action, swapping with whichever action held the key (see `D23`). */
export function rebindSetting(settings: Settings, action: KeybindAction, key: string): Settings {
  const keybinds = withBinding(settings.keybinds, action, key);
  return keybinds === settings.keybinds ? settings : { ...settings, keybinds };
}

/** Moves the highlighted row, clamped to the list. */
export function moveSettingIndex(
  index: number,
  delta: number,
  count: number = SETTINGS_ROWS.length,
): number {
  return clamp(index + delta, 0, count - 1);
}

/** The row at an index, clamped so a stale index can never read past the list. */
export function settingsRow(
  index: number,
  rows: readonly SettingsRow[] = SETTINGS_ROWS,
): SettingsRow {
  return rows[clamp(index, 0, rows.length - 1)];
}
