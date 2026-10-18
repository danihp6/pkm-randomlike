import {
  KEYBIND_ACTIONS,
  isKeybindAction,
  keyLabel,
  withBinding,
  type KeybindAction,
} from '../data/keybinds';
import { LOCALES, t, type Locale, type TranslationKey } from '../i18n';
import type { AiLevel, Settings, TextSpeed } from '../engine/save';

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

/** The difficulty a click or a left/right key steps through (`D46`). */
export const AI_LEVELS: readonly AiLevel[] = ['normal', 'hard'];

/** The text speeds, in the order the row steps them. */
const TEXT_SPEED_KEYS: Readonly<Record<TextSpeed, TranslationKey>> = {
  slow: 'settings.speed.slow',
  normal: 'settings.speed.normal',
  fast: 'settings.speed.fast',
};

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
  | 'aiLevel'
  | 'language'
  | KeybindAction;

export type SettingsRowKind = 'step' | 'keybind';

export type SettingsRow = Readonly<{
  id: SettingsRowId;
  /** The row's label and hint are keys, resolved when the row is drawn. */
  labelKey: TranslationKey;
  hintKey: TranslationKey;
  kind: SettingsRowKind;
}>;

/** Each language named in its own language, so the picker reads from either one. */
export const LANGUAGE_LABELS: Readonly<Record<Locale, string>> = {
  en: 'English',
  es: 'Español',
};

/** The keybind rows' labels, keyed (the English text stays in `src/data/keybinds.ts`). */
export const KEYBIND_LABEL_KEYS: Readonly<Record<KeybindAction, TranslationKey>> = {
  confirm: 'keybind.confirm',
  cancel: 'keybind.cancel',
  up: 'keybind.up',
  down: 'keybind.down',
  left: 'keybind.left',
  right: 'keybind.right',
  run: 'keybind.run',
  interact: 'keybind.interact',
  reset: 'keybind.reset',
  party: 'keybind.party',
  bag: 'keybind.bag',
  map: 'keybind.map',
  box: 'keybind.box',
  settings: 'keybind.settings',
};

const STEP_ROWS: readonly SettingsRow[] = [
  {
    id: 'textSpeed',
    labelKey: 'settings.textSpeed',
    hintKey: 'settings.textSpeed.hint',
    kind: 'step',
  },
  {
    id: 'volume',
    labelKey: 'settings.volume',
    hintKey: 'settings.volume.hint',
    kind: 'step',
  },
  {
    id: 'alwaysRun',
    labelKey: 'settings.alwaysRun',
    hintKey: 'settings.alwaysRun.hint',
    kind: 'step',
  },
  {
    id: 'hudTransparent',
    labelKey: 'settings.hudTransparent',
    hintKey: 'settings.hudTransparent.hint',
    kind: 'step',
  },
  {
    id: 'reducedFlash',
    labelKey: 'settings.reducedFlash',
    hintKey: 'settings.reducedFlash.hint',
    kind: 'step',
  },
  {
    id: 'aiLevel',
    labelKey: 'settings.aiLevel',
    hintKey: 'settings.aiLevel.hint',
    kind: 'step',
  },
  // The language is the last step row, so every shipped index keeps its order (`D46`).
  {
    id: 'language',
    labelKey: 'settings.language',
    hintKey: 'settings.language.hint',
    kind: 'step',
  },
];

const KEYBIND_ROWS: readonly SettingsRow[] = KEYBIND_ACTIONS.map((action) => ({
  id: action,
  labelKey: KEYBIND_LABEL_KEYS[action],
  hintKey: 'settings.keybind.hint',
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
  return t(TEXT_SPEED_KEYS[speed]);
}

/** The label and hint of a row, resolved from the current locale as it is drawn. */
export function settingsRowLabel(row: SettingsRow): string {
  return t(row.labelKey);
}

export function settingsRowHint(row: SettingsRow): string {
  return t(row.hintKey);
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
      return settings.alwaysRun ? t('settings.toggle.on') : t('settings.toggle.off');
    case 'hudTransparent':
      return settings.hudTransparent ? t('settings.toggle.on') : t('settings.toggle.off');
    case 'reducedFlash':
      return settings.reducedFlash ? t('settings.toggle.on') : t('settings.toggle.off');
    case 'aiLevel':
      return settings.aiLevel === 'hard'
        ? t('settings.difficulty.hard')
        : t('settings.difficulty.normal');
    case 'language':
      return LANGUAGE_LABELS[settings.language];
    default:
      return isKeybindAction(row) ? keyLabel(settings.keybinds[row]) : '';
  }
}

/** Steps a step row's value, clamped at both ends; `delta` 0 is the identity. */
export function changeSetting(settings: Settings, row: SettingsRowId, delta: number): Settings {
  if (delta === 0) return settings;
  switch (row) {
    case 'textSpeed': {
      const index = clamp(
        TEXT_SPEED_ORDER.indexOf(settings.textSpeed) + delta,
        0,
        TEXT_SPEED_ORDER.length - 1,
      );
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
    case 'aiLevel': {
      const index = clamp(AI_LEVELS.indexOf(settings.aiLevel) + delta, 0, AI_LEVELS.length - 1);
      return { ...settings, aiLevel: AI_LEVELS[index] };
    }
    case 'language': {
      const index = clamp(LOCALES.indexOf(settings.language) + delta, 0, LOCALES.length - 1);
      return { ...settings, language: LOCALES[index] };
    }
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
  const wrap = (index: number, length: number): number => (((index + delta) % length) + length) % length;
  switch (row) {
    case 'textSpeed':
      return {
        ...settings,
        textSpeed:
          TEXT_SPEED_ORDER[wrap(TEXT_SPEED_ORDER.indexOf(settings.textSpeed), TEXT_SPEED_ORDER.length)],
      };
    case 'aiLevel':
      return {
        ...settings,
        aiLevel: AI_LEVELS[wrap(AI_LEVELS.indexOf(settings.aiLevel), AI_LEVELS.length)],
      };
    case 'language':
      return {
        ...settings,
        language: LOCALES[wrap(LOCALES.indexOf(settings.language), LOCALES.length)],
      };
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
export function settingsRow(index: number, rows: readonly SettingsRow[] = SETTINGS_ROWS): SettingsRow {
  return rows[clamp(index, 0, rows.length - 1)];
}
